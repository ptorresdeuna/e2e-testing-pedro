import { test, expect } from '@support/fixtures';
import { ValidateEmailPage } from '@pages/checkout/user_data/validateEmailPage';
import { GuestUserDataPage } from '@pages/checkout/user_data/guestUserDataPage';
import { PaymentPage } from '@pages/checkout/payment/paymentPage';
import { ShippingDataPage } from '@pages/checkout/shipping_data/shippingDataPage';
import { Challenge3dsPage } from '@pages/checkout/3ds/challenge3dsPage';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import { activateIhubVersion } from '@support/ihub/loadConfig';
import ConfigMerchantCheckout from '@support/api_sup/config_merchant_sup/configMerchantCheckout';
import { BaseProcessor } from '@support/interfaces/payment_processors/baseProcessor';
import { faker } from '@faker-js/faker';
import { nagivateAndConfigureWidget } from '@support/testing_tool/TestingTool';
import { retryGetOrderStatus } from '@support/utils/retries';
import {
  getMissingIhubEnvVars,
  getIhubProcessorId,
  getIhubProcessorName,
  getIhubVersionId,
  getScenario,
} from '../../merchantScenarioConfig';

const configMerchantCheckout = new ConfigMerchantCheckout();
const SCENARIO_ID = 'IHUB-T107';

// This exercises the merchant-granularity integration-hub trigger flow (see
// payconnect-testing-hub's TRD "Trigger E2E con granularidad merchant"): it
// runs the scenario resolved by the hub for this test case id against
// whatever PSP this merchant's version is assigned to, using the
// card/credential the hub resolved for it via /connections/e2e-config (see
// @support/ihub/loadConfig, called from global.setup.ts).
const missingVars = getMissingIhubEnvVars();
const scenario = missingVars.length === 0 ? getScenario(SCENARIO_ID) : undefined;

test.describe(`Purchase denied in authorization after a successful DEUNA MPI 3DS challenge`, () => {
  if (!scenario) {
    test(
      `@${SCENARIO_ID} Purchase denied in authorization after a successful DEUNA MPI 3DS challenge`,
      { tag: ['@ihub-general'] },
      async () => {
        test.skip(
          true,
          missingVars.length > 0
            ? `Missing required environment variables: ${missingVars.join(', ')}. ` +
                'This spec only runs as part of the merchant-granularity integration-hub trigger.'
            : `No "${SCENARIO_ID}" scenario configured for this merchant/PSP in integration-hub.`
        );
      }
    );
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
      enable_3ds_authentication: true,
      three_ds_processing_provider: 'deuna',
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
    `@${SCENARIO_ID} Purchase denied in authorization after a successful DEUNA MPI 3DS challenge`,
    { tag: ['@ihub-general'] },
    async ({ page, emaService }) => {
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

      await test.step('The user clicks pay and completes the DEUNA MPI 3DS challenge', async () => {
        const popupPromise = page.waitForEvent('popup', { timeout: 20000 });
        await paymentPage.clickOnPay();

        const responsePurchase = await paymentPage.responsePromise;
        expect(responsePurchase.status(), 'purchase status').toBe(200);
        const responsePurchaseBody = await responsePurchase.json();
        expect(responsePurchaseBody.order.payment.data.status, 'payment status').toBe('pending');

        const challenge3ds = new Challenge3dsPage(await popupPromise);
        await challenge3ds.selectSuccessChallengeCybersource();
      });

      await test.step("Validate via API that the order is 'denied' in authorization despite a successful 3DS authentication", async () => {
        // The denial here happens asynchronously, after the challenge is completed (the
        // initial purchase response only carries 'pending'). GET /merchants/orders doesn't
        // expose an error.code/error.description for the order the way the synchronous
        // purchase response does (confirmed: `Order` has no `error` field in order.ts) — so
        // unlike IHUB-T100, this only asserts the final status and that 3DS did succeed.
        await retryGetOrderStatus(emaService, privateKey, orderToken, 'denied', 20, 3000);
        const { data } = await emaService.getOrder(privateKey, orderToken);
        const secureAuthentication = data.order.payment?.data.secure_authentication;
        expect(secureAuthentication?.eci, 'secure_authentication.eci').toBeTruthy();
        expect(secureAuthentication?.cavv, 'secure_authentication.cavv').toBeTruthy();
      });
    }
  );
});
