import { test, expect } from '@support/fixtures';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import * as validationCapture from '@support/interfaces/capture';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import { retryGetOrderStatus } from '@support/utils/retries';

test.describe(
  '@regression Pays with Wompi CO',
  { tag: ['@checkout', '@checkout_base', '@payment_widget'] },
  () => {
    let merchantId: string;
    let merchantToken: string;
    let merchantName: string;
    let privateKey: string;
    let publicKey: string;
    let orderToken: string;
    let orderId: string;
    let responsePurchase: any;

    test.beforeAll(async ({ emaService, merchantPool }) => {
      const merchant = await merchantPool.acquire('WOMPI_PROCESSOR_AUTHORIZE_CO');
      merchantId = merchant.merchantId;
      merchantToken = merchant.merchantToken;
      merchantName = merchant.merchantName;
      privateKey = merchant.privateKey;
      publicKey = merchant.publicKey;
      const tokenized = await emaService.tokenizeDeunaNowOrder('CO', merchant.privateKey);
      orderToken = tokenized.data.token;
      orderId = tokenized.data.order.order_id;
    });

    test(
      '@ENTP1-T1885 Captura a una orden capturada (error) Wompi usando el payment widget',
      {
        tag: [
          '@payments_integration',
          '@fixme_wompi_preprod',
          '@team_payment_integration',
          '@preprod',
          '@checkout_ui',
          '@service_paycore',
        ],
      },
      async ({ paymentService, userAuthService, emaService }) => {
        let userToken: string;
        let purchaseRequest: ReturnType<typeof buildPurchaseV2Payload>;

        await test.step('The user inserts a credit card "wompiVisaSuccessfull" from DeunaNow', async () => {
          purchaseRequest = buildPurchaseV2Payload({
            country: 'CO',
            processorName: processorsConfig.wompiProcessorAuthorize.name,
            card: creditCardData.wompiVisaSuccessfull,
            token: orderToken,
          });
        });

        await test.step('The user send purchase request', async () => {
          const responseUserAuth = await userAuthService.loginAsGuest(merchantId, privateKey);
          userToken = responseUserAuth.data.token;
          responsePurchase = await paymentService.purchaseV2(
            privateKey,
            userToken,
            purchaseRequest
          );
        });

        await test.step('Validate that the order has been processed successfully with status code "200" and status order "authorized"', async () => {
          const status = 'authorized';
          expect(responsePurchase.status).toBe(200);
          await retryGetOrderStatus(emaService, privateKey, orderToken, status);
        });

        await test.step('Validate error "capture" transaction captured', async () => {
          const captureResponse = await paymentService.captureV2(privateKey, orderToken);
          expect(captureResponse.status).toBe(200);
          const status = 'captured';
          await retryGetOrderStatus(emaService, privateKey, orderToken, status);
          await apiCallNewman.captureV2(
            validationCapture.errorCaptureOrderCaptured,
            privateKey,
            0,
            undefined,
            { orderToken }
          );
        });
      }
    );
  }
);
