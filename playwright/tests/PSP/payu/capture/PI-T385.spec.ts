import { test, expect } from '@support/fixtures';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import { retryGetOrderStatus } from '@support/utils/retries';

test.describe('@regression Pays with PayU MX', () => {
  let merchantId: string;
  let merchantToken: string;
  let merchantName: string;
  let privateKey: string;
  let publicKey: string;
  let orderToken: string;
  let orderId: string;
  let responsePurchase: any;

  test.beforeAll(async ({ emaService, merchantPool }) => {
    const merchantConfig = await merchantPool.acquire('PAY_U_PROCESSOR_AUTHORIZE_MX');
    merchantId = merchantConfig.merchantId;
    merchantToken = merchantConfig.merchantToken;
    merchantName = merchantConfig.merchantName;
    privateKey = merchantConfig.privateKey;
    publicKey = merchantConfig.publicKey;
    const tokenized = await emaService.tokenizeDeunaNowOrder('MX', merchantConfig.privateKey);
    orderToken = tokenized.data.token;
    orderId = tokenized.data.order.order_id;
  });

  test(
    '@PI-T385 Partial Capture exitoso por monto menor',
    {
      tag: [
        '@payments_integration',
        '@flaky',
        '@fixme_payu_preprod',
        '@team_payment_integration',
        '@preprod',
        '@partial_capture',
        '@service_newint',
      ],
    },
    async ({ paymentService, userAuthService, emaService }) => {
      let userToken: string;
      let purchaseRequest: ReturnType<typeof buildPurchaseV2Payload>;

      await test.step('The user inserts a credit card "payUMasterCardSuccessful" from DeunaNow', async () => {
        purchaseRequest = buildPurchaseV2Payload({
          country: 'MX',
          processorName: processorsConfig.payUProcessorAuthorize.name,
          card: creditCardData.payUMasterCardSuccessful,
          token: orderToken,
        });
      });

      await test.step('The user send purchase request', async () => {
        const responseUserAuth = await userAuthService.loginAsGuest(merchantId, privateKey);
        userToken = responseUserAuth.data.token;
        responsePurchase = await paymentService.purchaseV2(privateKey, userToken, purchaseRequest);
      });

      await test.step('Validate that the order has been processed successfully with status code "200" and status order "authorized"', async () => {
        const status = 'authorized';
        expect(responsePurchase.status).toBe(200);
        await retryGetOrderStatus(emaService, privateKey, orderToken, status);
      });

      await test.step('Validate succesful "capture" with minor value to authorized', async () => {
        const captureAmount = 2;
        const captureResponse = await paymentService.captureV2(privateKey, orderToken, {
          amount: captureAmount * 100,
        });
        expect(captureResponse.status).toBe(200);
        const status = 'partial_captured';
        await retryGetOrderStatus(emaService, privateKey, orderToken, status);
      });
    }
  );
});
