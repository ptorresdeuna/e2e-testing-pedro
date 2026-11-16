import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import ConfigMerchantCheckout from '@support/api_sup/config_merchant_sup/configMerchantCheckout';
import envConfig from '@support/envConfig';
import { PlacetopayPseFormData } from '@pages/payment_link/forms/placetopayPseFormPaymentLinkPage';

const configMerchantCheckout = new ConfigMerchantCheckout();

const unique = Date.now().toString().slice(-8);
const formData: PlacetopayPseFormData = {
  email: `dmorocho+${unique}@deuna.com`,
  bankName: 'BANCO AV VILLAS',
  personType: 'Natural',
  holderName: 'App App',
  documentNumber: unique,
  phone: `322${unique.slice(0, 7)}`,
  address: 'Calle 123 #45-67',
};

let merchantId: string;
let merchantToken: string;
let privateKey: string;
let paymentLinkUrl: string;

test.describe('@regression @visual PlaceToPay PSE - Payment Link - UI Visual Consistency', () => {
  test.beforeAll(async ({ emaService }) => {
    const setup = await configMerchantCheckout.basicSetup('CO');
    merchantId = setup.merchantId;
    merchantToken = setup.merchantToken;
    privateKey = setup.privateKey;

    await apiCallNewman.createPaymentProcessor(
      processorsConfig.placetopayPseProcessor,
      merchantId,
      merchantToken
    );

    const tokenized = await emaService.tokenizeDeunaPaymentLinkOrder('CO', privateKey, {
      user_email: formData.email,
    });
    paymentLinkUrl = envConfig.URL_CHECKOUT_BASE_LOCAL
      ? new URL(`/${tokenized.data.token}`, envConfig.URL_CHECKOUT_BASE_LOCAL).toString()
      : tokenized.data.order.payment_link;
  });

  test(
    '@ENTP1-T2668 [VISUAL] PlaceToPay PSE: validación de formulario, errores y redirect en Payment Link',
    { tag: ['@payment_link', '@pse', '@team_enterprise', '@visual', '@service_apm'] },
    async ({ page }) => {
      const testing = new TestingFramework({ page, test });

      await testing.run({
        step: [
          {
            action: 'checkout.websdk.openCheckoutUrl',
            params: { url: paymentLinkUrl },
            stepName: 'Open the payment link (PSE form renders directly, single-method order)',
          },
          {
            action: 'checkout.paymentLink.apm.placetopayPse.submitEmptyForm',
            stepName: 'Click Pay button with empty form',
          },
          {
            action: 'checkout.paymentLink.apm.placetopayPse.assertValidationErrorsVisible',
            stepName: 'Verify field validation errors are visible',
          },
          {
            action: 'checkout.paymentLink.apm.placetopayPse.fillForm',
            params: { formData },
            stepName: 'Fill PSE form with valid test data',
          },
          {
            action: 'checkout.paymentLink.apm.placetopayPse.completeBankRedirect',
            params: { status: 'APPROVED', reason: '00' },
            stepName: 'Submit the PSE form and approve the transaction in PlaceToPay sandbox',
          },
        ],
      });
    }
  );
});
