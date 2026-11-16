import { test, expect } from '@support/fixtures';

// Support Utilities
import ConfigMerchant from '@support/api_sup/config_merchant_sup/configMerchant';
import * as apiCallNewman from '@support/newman/apiCallNewman';

// Interfaces and Data
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';
import * as creditCardData from '@support/interfaces/credit_cards';
import * as processorsConfig from '@support/interfaces/payment_processors';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import { retryGetOrderStatus } from '@support/utils/retries';

let responsePurchase: any;
const configMerchant = new ConfigMerchant();
let orderToken: string;
let merchantId: string;
let merchantToken: string;
let merchantName: string;
let privateKey: string;
let publicKey: string;
let orderId: string;

test.describe('@regression Worldpay Payment Capture via Webhook', () => {
  test.beforeAll(async ({ emaService }) => {
    const merchant = await configMerchant.basicSetup('PE');
    merchantId = merchant.merchantId;
    merchantToken = merchant.merchantToken;
    merchantName = merchant.merchantName;
    privateKey = merchant.privateKey;
    publicKey = merchant.publicKey;
    const resp = await emaService.tokenizeDeunaNowOrder('PE', privateKey);
    orderId = resp.data.order.order_id;
    orderToken = resp.data.token;
    await apiCallNewman.createPaymentProcessor(
      processorsConfig.worldpayProcessorPayconnectAuthorize_PE,
      merchantId,
      merchantToken
    );
  });

  test(
    '@PI-T1213 Successful capture with WorldPay using the payment widget - and total order captured via webhook in PE',
    {
      tag: [
        '@payments_integration',
        '@admin_connection',
        '@smoke',
        '@admin-preprod',
        '@team_payment_integration',
        '@fixme_preprod',
        '@service_inthub',
      ],
    },
    async ({ userAuthService, paymentService, emaService }) => {
      let userToken: string;
      let purchaseRequest: ReturnType<typeof buildPurchaseV2Payload>;

      await test.step('Step 4: Navigate to payment widget', async () => {
        const responseUserAuth = await userAuthService.loginAsGuest(merchantId, privateKey);
        userToken = responseUserAuth.data.token;
      });

      await test.step('Step 5: Fill credit card information in payment widget', async () => {
        purchaseRequest = buildPurchaseV2Payload({
          country: 'PE',
          processorName: processorsConfig.worldpayProcessorPayconnectAuthorize_PE.name,
          card: creditCardData.worldpayMasterCardSuccessful,
          token: orderToken,
        });
      });

      await test.step('Step 6: Submit payment to initiate authorization', async () => {
        responsePurchase = await paymentService.purchaseV2(privateKey, userToken, purchaseRequest);
      });

      await test.step('Step 7: Verify payment is authorized successfully', async () => {
        const status = 'authorized';
        expect(responsePurchase.status).toBe(200);
        await retryGetOrderStatus(emaService, privateKey, orderToken, status);
      });

      await test.step('Step 8: Initiate capture process for authorized transaction', async () => {
        await paymentService.captureV2(privateKey, orderToken);
        const status = 'capturing';
        await retryGetOrderStatus(emaService, privateKey, orderToken, status);
      });

      await test.step('Step 9: Process webhook to complete capture and verify final status', async () => {
        await paymentService.simulateWorldpayWebhook(
          orderToken,
          processorsConfig.worldpayProcessorPayconnect.name,
          merchantId,
          'CAPTURED',
          privateKey
        );
        const status = 'captured';
        await retryGetOrderStatus(emaService, privateKey, orderToken, status);
      });
    }
  );
});
