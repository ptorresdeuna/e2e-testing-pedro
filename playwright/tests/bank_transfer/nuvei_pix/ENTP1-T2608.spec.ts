import { test } from '@support/fixtures';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import ConfigMerchantCheckout from '@support/api_sup/config_merchant_sup/configMerchantCheckout';
import { TestingFramework } from 'playwright/framework/core';
import { CheckoutEventsName } from '@tests/events/checkoutEventsName';
import { DeunacheckoutOrderBuilder } from '@support/http/testData/ema/DEUNA_CHECKOUT';

const configMerchantCheckout = new ConfigMerchantCheckout();

test.describe(
  '@regression Nuvei PIX - Validates apmReferenceShown event fires when QR screen is shown',
  { tag: ['@checkout', '@checkout_base', '@payment_widget', '@team_enterprise'] },
  () => {
    test.describe.configure({ timeout: 2 * 60 * 1000 });

    let processorId = '';
    let merchantId: string;
    let merchantToken: string;
    let privateKey: string;
    let publicKey: string;
    let orderToken: string;

    test.beforeAll(async ({ emaService }) => {
      test.setTimeout(5 * 60 * 1000);
      const merchant = await configMerchantCheckout.basicSetup('BR');
      merchantId = merchant.merchantId;
      merchantToken = merchant.merchantToken;
      privateKey = merchant.privateKey;
      publicKey = merchant.publicKey;

      await apiCallNewman.createPaymentProcessor(
        processorsConfig.cashProcessor,
        merchantId,
        merchantToken
      );
      processorId = await apiCallNewman.createPaymentProcessor(
        processorsConfig.nuveiPixProcessor,
        merchantId,
        merchantToken
      );

      const orderBody = DeunacheckoutOrderBuilder.createBody('BR', { amount: 100000 });
      const tokenized = await emaService.tokenizeOrderWithCustomBody(privateKey, orderBody);
      orderToken = tokenized.data.token;
    });

    test(
      '@ENTP1-T2608 Nuvei PIX — Payment Widget: apmReferenceShown event fires when QR screen loads',
      { tag: ['@team_enterprise', '@service_apm'] },
      async ({ page }) => {
        const testing = new TestingFramework({ page, test });

        await testing.run({
          step: [
            {
              action: 'analytics.events.startCapture',
              stepName: 'Start capturing analytics events before navigation',
            },
            {
              action: 'checkout.openCheckout',
              params: {
                experienceType: 'Payment Widget',
                orderToken,
                publicKey,
                privateKey,
              },
              stepName: 'Open Payment Widget',
            },
            {
              action: 'checkout.voucher.pix.selectPixTab',
              params: { processorType: 'nuvei_pix' },
              stepName: 'Select Nuvei PIX payment tab',
            },
            {
              action: 'checkout.voucher.pix.clickPay',
              stepName: 'Click Pay button',
            },
            {
              action: 'checkout.voucher.pix.assertPixVoucher',
              stepName: 'Assert PIX QR voucher screen is visible',
            },
            {
              action: 'analytics.events.verifyMetadata',
              params: {
                event: CheckoutEventsName.apmReferenceShown,
                expected: {
                  methodType: 'bank_transfer',
                  processorName: 'nuvei_pix',
                },
              },
              stepName: 'Verify apmReferenceShown event fired with correct metadata',
            },
          ],
          cleanup: [
            {
              action: 'analytics.events.verifyEventCount',
              params: { event: CheckoutEventsName.apmReferenceShown, expected: 1 },
              stepName: 'Verify apmReferenceShown fired exactly once',
            },
          ],
        });
      }
    );

    test.afterAll(async ({ paymentService }) => {
      await paymentService.deletePaymentProcessor(processorId, merchantId, merchantToken);
    });
  }
);
