import { expect, test } from '@support/fixtures';
import * as processorsConfig from '@support/interfaces/payment_processors';
import { AdminHomePage } from '@pages/admin/adminHomePage';
import { AdminLoginPage } from '@pages/admin/adminLoginPage';
import { AdminConnectionsPage } from '@pages/admin/connections/adminConnectionsPage';
import { AdminPaymentStrategyPage } from '@pages/admin/adminPaymentStrategyPage';
import ConfigMerchant from '@support/api_sup/config_merchant_sup/configMerchant';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';
import { ALLOW_STRIPE_DIRECT_CONFIGURATION } from '@support/http/testData/payment/PaymentMerchantConfigurations';
import * as creditCardData from '@support/interfaces/credit_cards';
import { PaymentDeunaNowPage } from '@pages/deuna_now/deunaNowPage';
import { nagivateAndConfigureWidget } from '@support/testing_tool/TestingTool';
import { AdminCommercePage } from '@pages/admin/commerce/adminCommercePage';
import { RiskOption } from '@support/interfaces/riskOption';
import { AdminOrderDetailsPage } from '@pages/admin/orders/adminOrderDetailsPage';
import { makeRequest } from '@support/request_helper/requestUtil';
import envConfig from '@support/envConfig';

const configMerchant = new ConfigMerchant();

interface ManualReviewOrder {
  orderToken: string;
  orderId: string;
}

/**
 * Clearsale manual review, end to end, on one merchant configured once through the Admin.
 * It absorbs PI-T1907 (medium risk → manual_review), PF-T159 (in_review → FRD → rejected) and
 * PF-T160 (in_review → APA → accepted), which repeated this same setup and purchase, so the
 * suite sends two purchases to Clearsale instead of four.
 */
test.describe('@regression Clearsale manual review: decision, rejection with refund and acceptance', () => {
  let privateKey: string;
  let publicKey: string;
  let merchantId: string;
  let rejectedOrder: ManualReviewOrder;
  let acceptedOrder: ManualReviewOrder;

  test.beforeAll(async ({ emaService, paymentService }) => {
    const merchantSetup = await configMerchant.basicSetup('MX');
    merchantId = merchantSetup.merchantId;
    privateKey = merchantSetup.privateKey;
    publicKey = merchantSetup.publicKey;
    await paymentService.createConfigMerchantPayments(
      ALLOW_STRIPE_DIRECT_CONFIGURATION,
      merchantId,
      merchantSetup.merchantToken
    );

    const createOrder = async (): Promise<ManualReviewOrder> => {
      const response = await emaService.tokenizeDeunaNowOrder('MX', privateKey, {
        user_email: 'dlora@deuna.com',
        amount: 20000,
      });
      return { orderToken: response.data.token, orderId: response.data.order.order_id };
    };
    rejectedOrder = await createOrder();
    acceptedOrder = await createOrder();
  });

  test(
    '@PI-T1912 Transacción Clearsale en manual review: decisión medium risk, rechazo que pasa a refunded y aprobación',
    {
      tag: [
        '@fraud',
        '@admin_connection',
        '@admin-preprod',
        '@team_payments_capabilities',
        '@service_fraud',
      ],
    },
    async ({ page }) => {
      const adminHomePage = new AdminHomePage(page, 'ES');
      const adminLoginPage = new AdminLoginPage(page);
      const adminCommercePage = new AdminCommercePage(page, 'ES');
      const adminConnectionsPage = new AdminConnectionsPage(page, 'ES');
      const adminPaymentStrategyPage = new AdminPaymentStrategyPage(page, 'ES');
      const paymentDeunaNowPage = new PaymentDeunaNowPage(page);
      const adminOrderDetailsPage = new AdminOrderDetailsPage(page);

      const payInReview = async ({ orderToken }: ManualReviewOrder) => {
        await test.step('The user opens the widget and pays as guest', async () => {
          const testingTool = nagivateAndConfigureWidget(page, 'Payment Widget');
          await testingTool.navigateAndSetup({
            orderToken,
            merchantCredentials: { publicKey, privateKey },
          });
          await paymentDeunaNowPage.userGuest();
          await paymentDeunaNowPage.fillCreditCardDataDeunaNow(
            creditCardData.stripeVisaSuccessful,
            { country: 'MX' }
          );
          await paymentDeunaNowPage.clickPay();
        });

        await test.step('The order is processed and its fraud status is in_review', async () => {
          await paymentDeunaNowPage.assertOrderStatusRequestPurchase('processed', 200);
          await paymentDeunaNowPage.assertFraudProcessStatus('in_review', {
            privateKey,
            orderToken,
          });
          await adminOrderDetailsPage.goToOrderDetails(merchantId, orderToken);
          await adminOrderDetailsPage.assertPaymentStatus('processed');
        });
      };

      // Clearsale reports the order id in uppercase in sandbox, and its webhook carries it so.
      const sendManualReviewDecision = async ({ orderId }: ManualReviewOrder, status: string) => {
        const response = await makeRequest('POST', envConfig.BASE_URL_POSTMAN + '/manual-review', {
          headers: {
            'Clearsale-Apikey':
              processorsConfig.clearsaleFraudProcessor.properties[0].property_name,
          },
          data: { ID: orderId.toUpperCase(), Score: '', Status: status },
        });
        expect(response.status, 'Clearsale manual-review webhook response').toBe(200);
      };

      await test.step('The user opens the admin page and set merchant id session', async () => {
        await adminLoginPage.gotoAdmin();
        await adminHomePage.setMerchantIdSessionStorage(merchantId);
      });

      await test.step('The user configures the Stripe and Clearsale connections', async () => {
        await adminHomePage.goToConnections();
        await adminConnectionsPage.configureConnection(
          ConnectionsAvailable.stripeDirect,
          processorsConfig.stripeProcessor
        );
        await adminConnectionsPage.configureConnection(
          ConnectionsAvailable.clearsale,
          processorsConfig.clearsaleFraudProcessor
        );
      });

      await test.step('The user goes to commerce to activate general fraud adjusts', async () => {
        await adminHomePage.goToCommerce();
        await adminCommercePage.activateManualReview();
        await adminCommercePage.activateOpsAutoExecution();
      });

      const processWithStripe: RiskOption['processor'] = {
        name: ConnectionsAvailable.stripeDirect,
        validateCvv: true,
        require3ds: false,
        actionForProcessor: 'decline',
      };
      const risk: RiskOption[] = [
        { riskLevel: 'medium', action: 'process', processor: processWithStripe },
        { riskLevel: 'low', action: 'process', processor: processWithStripe },
      ];

      await test.step('The user routes medium and low risk to Stripe with Clearsale', async () => {
        await adminHomePage.goToPaymentStrategy();
        await adminPaymentStrategyPage.editDefaultRouting(ConnectionsAvailable.clearsale, risk);
      });

      await test.step('Rejected order: Clearsale decides medium risk and manual review', async () => {
        await payInReview(rejectedOrder);
        await paymentDeunaNowPage.assertFraudDecision(
          ConnectionsAvailable.clearsale,
          'medium',
          'manual_review',
          { privateKey, orderToken: rejectedOrder.orderToken }
        );
      });

      await test.step('Rejected order: the FRD webhook rejects it and the order is refunded', async () => {
        await sendManualReviewDecision(rejectedOrder, 'FRD');
        await paymentDeunaNowPage.assertFraudProcessStatusChanged(
          'rejected',
          privateKey,
          rejectedOrder.orderToken
        );
        await adminOrderDetailsPage.goToOrderDetails(merchantId, rejectedOrder.orderToken);
        await adminOrderDetailsPage.assertPaymentStatus('refunded');
      });

      await test.step('Accepted order: the APA webhook accepts it', async () => {
        await payInReview(acceptedOrder);
        await sendManualReviewDecision(acceptedOrder, 'APA');
        await paymentDeunaNowPage.assertFraudProcessStatusChanged(
          'accepted',
          privateKey,
          acceptedOrder.orderToken
        );
      });
    }
  );
});
