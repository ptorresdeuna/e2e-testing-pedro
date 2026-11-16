import { expect, test } from '@support/fixtures';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import * as creditCardData from '@support/interfaces/credit_cards';
import { PaymentDeunaNowPage } from '@pages/deuna_now/deunaNowPage';
import { nagivateAndConfigureWidget } from '@support/testing_tool/TestingTool';
import { makeRequest } from '@support/request_helper/requestUtil';
import envConfig from '@support/envConfig';
import * as refundData from '@support/interfaces/refund';
import { AdminOrderDetailsPage } from '@pages/admin/orders/adminOrderDetailsPage';
import ConfigMerchant from '@support/api_sup/config_merchant_sup/configMerchant';
import * as processorsConfig from '@support/interfaces/payment_processors';
import {
  DYNAMIC_ROUTING_SIFT_GLOBALPAY_RULE_BODY,
  SIFT_FRAUD_PROCESSOR_BODY,
} from '@support/http/testData/dynamicRouting/FraudRoutingConfig';

const configMerchant = new ConfigMerchant();

test.describe('@regression your description test suite', () => {
  let merchantId: string;
  let merchantToken: string;
  let merchantName: string;
  let privateKey: string;
  let publicKey: string;
  let orderToken: string;
  let orderId: string;

  test.beforeAll(async ({ emaService }) => {
    const merchant = await configMerchant.basicSetup('CO');
    merchantId = merchant.merchantId;
    merchantToken = merchant.merchantToken;
    merchantName = merchant.merchantName;
    privateKey = merchant.privateKey;
    publicKey = merchant.publicKey;
    const tokenized = await emaService.tokenizeDeunaNowOrder('CO', privateKey);
    orderToken = tokenized.data.token;
    orderId = tokenized.data.order.order_id;
    await apiCallNewman.createPaymentProcessor(
      processorsConfig.globalpayProcessor,
      merchantId,
      merchantToken
    );
    // Sift is no longer a default fraud provider; the merchant has to configure it and route to it.
    await apiCallNewman.configDynamicRoutingWithFraud(
      SIFT_FRAUD_PROCESSOR_BODY,
      DYNAMIC_ROUTING_SIFT_GLOBALPAY_RULE_BODY,
      merchantId,
      merchantToken
    );
  });

  test.beforeEach(
    'The user opens the testing page and opens the required widget',
    async ({ page }) => {
      const testingTool = nagivateAndConfigureWidget(page, 'Payment Widget');
      await testingTool.navigateAndSetup({
        orderToken: orderToken,
        merchantCredentials: { publicKey: publicKey, privateKey: privateKey },
      });
    }
  );

  test(
    '@PI-T1920 Confirm a transaction through post-transaction api is successful when the transaction is already refunded',
    { tag: ['@fraud', '@admin-preprod', '@team_payments_capabilities', '@service_fraud'] },
    async ({ page }) => {
      const paymentDeunaNowPage = new PaymentDeunaNowPage(page);
      const adminOrderDetailsPage = new AdminOrderDetailsPage(page, 'ES');

      await test.step('The user inserts a credit card "placetopayVisaSuccessful" from DeunaNow', async () => {
        await paymentDeunaNowPage.fillCreditCardDataDeunaNow(
          creditCardData.globalpayVisaSuccessful,
          { country: 'CO' }
        );
      });

      await test.step('The user clicks on pay', async () => {
        await paymentDeunaNowPage.clickPay();
      });

      await test.step('Validate that the order has been processed successfully with status code "200" and status order "processed"', async () => {
        const status = 'processed';
        await paymentDeunaNowPage.assertOrderStatusRequestPurchase(status, 200);
        await adminOrderDetailsPage.goToOrderDetails(merchantId, orderToken);
        await adminOrderDetailsPage.assertPaymentStatus(status);
      });

      await test.step('Validate total refund to transaction processed', async () => {
        await apiCallNewman.refundOrderV2(refundData.successRefund, privateKey, 0, false, {
          orderToken,
        });
      });

      await test.step('Transaction status is refunded', async () => {
        const status = 'refunded';
        await adminOrderDetailsPage.assertPaymentStatus(status);
      });

      await test.step('It validates at the moment of confirming this order, returns a 200 OK response', async () => {
        const transactionID = orderId;
        const merchantID = merchantId;

        // make request to post transaction webhook
        const response = await makeRequest(
          'POST',
          envConfig.BASE_URL_POSTMAN + '/post-transaction-manual-process/confirm',
          {
            headers: {
              'X-Api-Key': privateKey,
            },
            data: {
              merchant_id: merchantID,
              order_id: transactionID,
            },
          }
        );

        expect(response.status).toBe(200);
      });
    }
  );
});
