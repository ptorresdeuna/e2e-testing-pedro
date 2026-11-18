import { test, expect } from '@support/fixtures';
import { ValidateEmailPage } from '@pages/checkout/user_data/validateEmailPage';
import { GuestUserDataPage } from '@pages/checkout/user_data/guestUserDataPage';
import { PaymentPage } from '@pages/checkout/payment/paymentPage';
import { ShippingDataPage } from '@pages/checkout/shipping_data/shippingDataPage';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import { activateIhubVersion } from '@support/ihub/loadConfig';
import ConfigMerchantCheckout from '@support/api_sup/config_merchant_sup/configMerchantCheckout';
import { BaseProcessor } from '@support/interfaces/payment_processors/baseProcessor';
import { faker } from '@faker-js/faker';
import { nagivateAndConfigureWidget } from '@support/testing_tool/TestingTool';
import {
  getMissingIhubEnvVars,
  getIhubProcessorId,
  getIhubProcessorName,
  getIhubVersionId,
  getScenario,
} from '../../merchantScenarioConfig';

const configMerchantCheckout = new ConfigMerchantCheckout();
const SCENARIO_ID = 'IHUB-T100';

// This exercises the merchant-granularity integration-hub trigger flow (see
// payconnect-testing-hub's TRD "Trigger E2E con granularidad merchant"): it
// runs the scenario resolved by the hub for this test case id against
// whatever psp this merchant's version is assigned to, using the
// card/credential the hub resolved for it via /connections/e2e-config (see
// @support/ihub/loadConfig, called from global.setup.ts).
const missingVars = getMissingIhubEnvVars();
const scenario = missingVars.length === 0 ? getScenario(SCENARIO_ID) : undefined;

test.describe(`Purchase denied - error.code and error.message present in the response`, () => {
  if (!scenario) {
    test(`@${SCENARIO_ID} Purchase denied - error.code and error.message present in the response`, async () => {
      test.skip(
        true,
        missingVars.length > 0
          ? `Missing required environment variables: ${missingVars.join(', ')}. ` +
          'This spec only runs as part of the merchant-granularity integration-hub trigger.'
          : `No "${SCENARIO_ID}" scenario configured for this merchant/PSP in integration-hub.`
      );
    });
    return;
  }

  let merchantId: string;
  let publicKey: string;
  let privateKey: string;
  let orderToken: string;

  test.beforeAll(async ({ emaService }) => {
    const merchant = await configMerchantCheckout.basicSetup(scenario.country);
    merchantId = merchant.merchantId;
    publicKey = merchant.publicKey;
    privateKey = merchant.privateKey;

    const tokenized = await emaService.tokenizeDeunaCheckoutOrder(scenario.country, privateKey);
    orderToken = tokenized.data.token;

    const processorBody: BaseProcessor = {
      name: getIhubProcessorName(),
      payment_processor_id: getIhubProcessorId(),
      enabled: true,
      country_iso: scenario.country,
      currency_iso3: scenario.currency,
      automatic_capture: true,
      enable_3ds_authentication: false,
      public_api_key: scenario.credential.api_key,
      private_api_key: scenario.credential.secret_key,
      external_merchant_id: scenario.credential.merchant_id,
    };
    await apiCallNewman.createPaymentProcessor(processorBody, merchantId, merchant.merchantToken);
    await activateIhubVersion(merchantId);
  });

  test.beforeEach(
    'The user opens the testing page and opens the required widget',
    async ({ page }) => {
      const testingTool = nagivateAndConfigureWidget(page, 'Checkout Widget');
      await testingTool.navigateAndSetup({
        orderToken,
        merchantCredentials: { publicKey, privateKey },
      });
    }
  );

  test(
    `@${SCENARIO_ID} Purchase denied - error.code and error.message present in the response`,
    { tag: ['@ihub-general'] },
    async ({ page }) => {
      test.info().annotations.push({ type: 'Version ID', description: getIhubVersionId() });

      const validateEmailPage = new ValidateEmailPage(page);
      const guestUserDataPage = new GuestUserDataPage(page);
      const shippingDataPage = new ShippingDataPage(page);
      const paymentPage = new PaymentPage(page);

      await test.step('The user navigates to the payment screen as guest user', async () => {
        await validateEmailPage.emailNewUserAndContinue(faker.internet.email());
        await guestUserDataPage.enterGuestUserDataAndContinue(scenario.user);
        await shippingDataPage.searchAddressAndSelectAndContinue(scenario.address);
      });

      await test.step('The user enters the credit card information resolved for this scenario', async () => {
        await paymentPage.fillCreditCardDataWithBase(scenario.card);
      });

      await test.step('The user clicks pay', async () => {
        await paymentPage.clickOnPay();
      });

      await test.step('Validate that the purchase response contains error.code and error.message', async () => {
        const responsePurchase = await paymentPage.responsePromise;
        expect(responsePurchase.status(), 'purchase status').toBe(422);
        const responsePurchaseBody = await responsePurchase.json();
        // The PSP resolved by the hub for this scenario (and its exact DP-xxxx code/description)
        // isn't known ahead of time, so this only asserts the error fields are present, not their
        // literal values.
        expect(responsePurchaseBody.error?.code, 'response body "error.code"').toBeTruthy();
        expect(
          responsePurchaseBody.error?.description,
          'response body "error.description"'
        ).toBeTruthy();
      });
    }
  );
});
