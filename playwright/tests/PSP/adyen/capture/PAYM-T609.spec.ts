import { EmailGenerator } from '@support/utils/EmailGenerator';
import { test, expect } from '@support/fixtures';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import * as validationCapture from '@support/interfaces/capture';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import { retryGetOrderStatus } from '@support/utils/retries';

test.describe('@regression Capture with payment processor Adyen MX', () => {
  let merchantId: string;
  let merchantToken: string;
  let merchantName: string;
  let privateKey: string;
  let publicKey: string;
  let orderToken: string;
  let orderId: string;
  let responsePurchase: any;

  test.beforeAll(async ({ emaService, merchantPool }) => {
    const merchant = await merchantPool.acquire('ADYEN_PROCESSOR_AUTHORIZE_MX');
    merchantId = merchant.merchantId;
    merchantToken = merchant.merchantToken;
    merchantName = merchant.merchantName;
    privateKey = merchant.privateKey;
    publicKey = merchant.publicKey;
    const tokenized = await emaService.tokenizeDeunaNowOrder('MX', privateKey, {
      user_email: EmailGenerator.generatePayerEmail(),
    });
    orderToken = tokenized.data.token;
    orderId = tokenized.data.order.order_id;
  });

  test(
    '@PAYM-T609 Capture rechazado por monto mayor',
    {
      tag: ['@payments_integration', '@team_payment_integration', '@service_paycore'],
    },
    async ({ paymentService, userAuthService, emaService }) => {
      await test.step('The user send purchase request', async () => {
        const responseUserAuth = await userAuthService.loginAsGuest(merchantId, privateKey);
        const userToken = responseUserAuth.data.token;
        responsePurchase = await paymentService.purchaseV2(
          privateKey,
          userToken,
          buildPurchaseV2Payload({
            country: 'MX',
            processorName: processorsConfig.adyenProcessorAuthorize.name,
            card: creditCardData.adyenVisaSuccessful,
            token: orderToken,
          })
        );
      });

      await test.step('It is validated that the order has been processed successfully with status authorized', async () => {
        const status = 'authorized';
        expect(responsePurchase.status).toBe(200);
        await retryGetOrderStatus(emaService, privateKey, orderToken, status);
      });

      await test.step('Validate error when trying to capture transaction with amount greater', async () => {
        await apiCallNewman.captureV2(
          validationCapture.errorCaptureAmountGreaterV2,
          privateKey,
          3000000,
          undefined,
          { orderToken }
        ); //TODO review Erika
        const status = 'authorized';
        await retryGetOrderStatus(emaService, privateKey, orderToken, status);
      });
    }
  );
});
