import { test, expect } from '@support/fixtures';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import * as validationVoid from '@support/interfaces/void';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import { retryGetOrderStatus } from '@support/utils/retries';

test.describe('@regression Void with processor Nuvei MX from payment widget', () => {
  let merchantId: string;
  let merchantToken: string;
  let merchantName: string;
  let privateKey: string;
  let publicKey: string;
  let orderToken: string;
  let orderId: string;
  let responsePurchase: any;

  test.beforeAll(async ({ emaService, merchantPool }) => {
    const merchantConfig = await merchantPool.acquire('NUVEI_PROCESSOR_AUTHORIZE_MX');
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
    '@PI-T317 Void a una transaccion con estado captured',
    {
      tag: [
        '@preprod',
        '@void',
        '@payments_integration',
        '@team_payment_integration',
        '@healthcheck',
        '@service_ema',
      ],
    },
    async ({ paymentService, userAuthService, emaService }) => {
      let userToken: string;
      let purchaseRequest: ReturnType<typeof buildPurchaseV2Payload>;

      await test.step('The user inserts a credit card "nuvei exitosa" from DeunaNow', async () => {
        purchaseRequest = buildPurchaseV2Payload({
          country: 'MX',
          processorName: processorsConfig.nuveiProcessorAuthorize.name,
          card: creditCardData.nuveiMasterCardSucessfull,
          token: orderToken,
        });
      });

      await test.step('The user send purchase request', async () => {
        const responseUserAuth = await userAuthService.loginAsGuest(merchantId, privateKey);
        userToken = responseUserAuth.data.token;
        responsePurchase = await paymentService.purchaseV2(privateKey, userToken, purchaseRequest);
      });

      await test.step('It is validated that the order has been processed successfully with status authorized', async () => {
        const status = 'authorized';
        expect(responsePurchase.status).toBe(200);
        await retryGetOrderStatus(emaService, privateKey, orderToken, status);
      });

      await test.step('A capture is sent to the authorized transaction', async () => {
        const captureResponse = await paymentService.captureV2(privateKey, orderToken);
        expect(captureResponse.status).toBe(200);
        const status = 'captured';
        await retryGetOrderStatus(emaService, privateKey, orderToken, status);
      });

      await test.step('Validate error when trying to void transaction with status captured', async () => {
        await apiCallNewman.voidOrder(
          validationVoid.errorVoidOrderCaptured,
          privateKey,
          0,
          orderToken
        ); //TODO review Erika
        const status = 'captured';
        await retryGetOrderStatus(emaService, privateKey, orderToken, status);
      });
    }
  );
});
