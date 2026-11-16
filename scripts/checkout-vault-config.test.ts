// Run: npx ts-node -r tsconfig-paths/register scripts/checkout-vault-config.test.ts
import * as assert from 'assert';
import { BaseHttpClient, RequestConfig } from '../playwright/support/http/BaseHttpClient';
import { CheckoutConfigurationService } from '../playwright/support/http/services/CheckoutConfigurationService';

const merchantId = 'merchant-under-test';
const desired = {
  order_config: { notify_type: 'async' as const },
  elements_config: { show_saved_cards_flow: false },
};
const request = {
  merchant_id: merchantId,
  merchant_token: 'test-token',
  config_vault_data: {
    config_checkout_data: {
      configuration: { is_colorblind: false, is_identity_document_hide: false },
      image_url: '',
      theme: { main_color: '', secondary_color: '', background_color: '' },
    },
    config_checkout_v2_data: desired,
  },
};
const collision = {
  status: 500,
  code: 'CHKCONFIG-4106',
  description: 'configuration already exists',
};

function setup(
  postError?: unknown,
  body: unknown = { merchant_id: merchantId, ...desired },
  getStatus = 200,
  getError?: unknown
) {
  const calls: RequestConfig[] = [];
  const http = {
    async request(config: RequestConfig) {
      calls.push(config);
      if (config.method === 'POST' && postError) throw postError;
      if (config.method === 'GET' && getError) throw getError;
      return { status: config.method === 'GET' ? getStatus : 200, data: body };
    },
  } as unknown as BaseHttpClient;
  return { service: new CheckoutConfigurationService(http), calls };
}

async function main() {
  const created = setup();
  await created.service.configVault(request);
  assert.deepStrictEqual(
    created.calls.map((call) => call.method),
    ['POST']
  );

  const repeated = setup(collision, { merchant_id: merchantId, ...desired, id: 'server-id' });
  await repeated.service.configVault(request);
  assert.deepStrictEqual(
    repeated.calls.map((call) => call.method),
    ['POST', 'GET']
  );
  assert.deepStrictEqual(repeated.calls[1].pathParams, { merchantId });
  assert.deepStrictEqual(repeated.calls[1].auth, { type: 'bearer', token: 'test-token' });

  for (const body of [
    { merchant_id: merchantId, ...desired, order_config: { notify_type: 'sync' } },
    { merchant_id: 'another-merchant', ...desired },
    { merchant_id: merchantId },
  ]) {
    const mismatch = setup(collision, body);
    await assert.rejects(mismatch.service.configVault(request), /reuseExistingVaultConfiguration/);
    assert.deepStrictEqual(
      mismatch.calls.map((call) => call.method),
      ['POST', 'GET']
    );
  }

  for (const unexpected of [
    { ...collision, code: 'ANOTHER_ERROR' },
    { ...collision, description: 'cannot create merchant configuration' },
    { ...collision, status: 401 },
    new Error('network unavailable'),
  ]) {
    const failure = setup(unexpected);
    await assert.rejects(failure.service.configVault(request));
    assert.deepStrictEqual(
      failure.calls.map((call) => call.method),
      ['POST']
    );
  }

  const strict = setup(collision);
  await assert.rejects(
    strict.service.createConfigCheckoutV2({
      merchant_id: merchantId,
      merchant_token: 'test-token',
      config_checkout_v2_data: desired,
    })
  );
  assert.deepStrictEqual(
    strict.calls.map((call) => call.method),
    ['POST']
  );
  const sensitiveFailure = setup({
    ...collision,
    data: { Authorization: 'test-bearer-secret', private_key: 'test-private-secret' },
  });
  await assert.rejects(
    sensitiveFailure.service.createConfigCheckoutV2({
      merchant_id: merchantId,
      merchant_token: 'test-token',
      config_checkout_v2_data: desired,
    }),
    (error: Error) => {
      assert.deepStrictEqual(error.cause, {
        ...collision,
        data: { Authorization: '[redacted]', private_key: '[redacted]' },
      });
      assert.ok(!error.message.includes('test-bearer-secret'));
      assert.ok(!error.message.includes('test-private-secret'));
      return true;
    }
  );

  const readError = new Error('read unavailable');
  const failedRead = setup(collision, undefined, 200, readError);
  await assert.rejects(failedRead.service.configVault(request), /Existing checkout v2 read failed/);
  const sensitiveRead = setup(collision, undefined, 200, {
    status: 500,
    code: 'GET_FAILED',
    description: 'read failed',
    data: { authorization: 'test-bearer-secret' },
  });
  await assert.rejects(sensitiveRead.service.configVault(request), (error: Error) => {
    assert.ok(!error.message.includes('test-bearer-secret'));
    assert.deepStrictEqual((error.cause as { data: unknown }).data, {
      authorization: '[redacted]',
    });
    return true;
  });
  const rejectedRead = setup(collision, undefined, 503);
  await assert.rejects(
    rejectedRead.service.configVault(request),
    /reuseExistingVaultConfiguration/
  );
  const wrongOwner = setup(collision, { merchant_id: 'another-merchant', ...desired });
  const untrustedConfig = { ...desired, merchant_id: 'another-merchant' };
  await assert.rejects(
    wrongOwner.service.configVault({
      ...request,
      config_vault_data: {
        ...request.config_vault_data,
        config_checkout_v2_data: untrustedConfig,
      },
    }),
    /reuseExistingVaultConfiguration/
  );
  console.log('checkout vault setup: create, verified reuse, mismatch and error guards passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
