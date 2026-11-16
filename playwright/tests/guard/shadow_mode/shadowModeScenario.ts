import { Page } from '@playwright/test';
import { test, expect } from '@support/fixtures';
import ConfigMerchant from '@support/api_sup/config_merchant_sup/configMerchant';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';
import { ALLOW_STRIPE_DIRECT_CONFIGURATION } from '@support/http/testData/payment/PaymentMerchantConfigurations';
import { nagivateAndConfigureWidget } from '@support/testing_tool/TestingTool';
import { retryUntil } from '@support/utils/retries';
import { PaymentDeunaNowPage } from '@pages/deuna_now/deunaNowPage';
import { AdminOrderDetailsPage } from '@pages/admin/orders/adminOrderDetailsPage';
import { AdminHomePage } from '@pages/admin/adminHomePage';
import { AdminLoginPage } from '@pages/admin/adminLoginPage';
import { AdminConnectionsPage } from '@pages/admin/connections/adminConnectionsPage';
import { AdminCommercePage } from '@pages/admin/commerce/adminCommercePage';
import { EmaService } from '@support/http/services/EmaService';
import { PaymentService } from '@support/http/services/PaymentService';
import { PaymentRoutingService } from '@support/http/services/PaymentRoutingService';

export type FraudConnection = 'cybersource' | 'sift' | 'clearsale';

export interface FraudAnalysisExpectation {
  riskLevel: string;
  fraudDecision: string;
  status: string;
  processor: string;
}

/** One former shadow-mode spec: its connections, commerce switch, rule and expected analysis. */
export interface ShadowModeScenario {
  name: string;
  /** Fraud connections in the order the former spec configured them, after Stripe. */
  fraudConnections: FraudConnection[];
  /** Whether the former spec turned the commerce shadow-mode switch on. */
  enableCommerceShadowMode: boolean;
  rule: Record<string, unknown>;
  /** undefined when the scenario has no main provider and the main analysis must be empty. */
  main?: FraudAnalysisExpectation;
  shadows: FraudAnalysisExpectation[];
}

const FRAUD_CONNECTIONS = {
  cybersource: [ConnectionsAvailable.cybersourceFraud, processorsConfig.cybersourceFraudProcessor],
  sift: [ConnectionsAvailable.sift, processorsConfig.siftFraudProcessor],
  clearsale: [ConnectionsAvailable.clearsale, processorsConfig.clearsaleFraudProcessor],
} as const;

interface ScenarioServices {
  emaService: EmaService;
  paymentService: PaymentService;
  paymentRoutingService: PaymentRoutingService;
}

const configMerchant = new ConfigMerchant();

/**
 * Runs a shadow-mode scenario on its own merchant, with exactly the setup its former spec had.
 * Sharing one merchant was tried and changed the preconditions: a replaced routing rule kept
 * serving the previous one for a while, and Sift left the connections catalog once Clearsale
 * was connected. The scenarios still run one after another, so Clearsale never gets them as a
 * burst. Each one gets its own tab: the Admin keeps the merchant of the tab's first session even
 * after the merchant id in sessionStorage changes, and sessionStorage is per tab.
 */
export async function runShadowModeScenario(
  testPage: Page,
  { emaService, paymentService, paymentRoutingService }: ScenarioServices,
  scenario: ShadowModeScenario
): Promise<void> {
  const page = await testPage.context().newPage();
  const paymentDeunaNowPage = new PaymentDeunaNowPage(page, 'ES');
  const adminHomePage = new AdminHomePage(page, 'ES');
  const adminLoginPage = new AdminLoginPage(page);
  const adminConnectionsPage = new AdminConnectionsPage(page, 'ES');
  const adminCommercePage = new AdminCommercePage(page, 'ES');
  const adminOrderDetailsPage = new AdminOrderDetailsPage(page, 'ES');

  try {
    await test.step(scenario.name, async () => {
      const merchant = await configMerchant.basicSetup('MX');
      const { merchantId, merchantToken, privateKey, publicKey } = merchant;
      await paymentService.createConfigMerchantPayments(
        ALLOW_STRIPE_DIRECT_CONFIGURATION,
        merchantId,
        merchantToken
      );
      const orderToken = (await emaService.tokenizeDeunaNowOrder('MX', privateKey)).data.token;
      await apiCallNewman.configDynamicRouting(merchantId, merchantToken);

      await test.step('The user opens the admin page and set merchant id session', async () => {
        await adminLoginPage.gotoAdmin();
        await adminHomePage.setMerchantIdSessionStorage(merchantId);
      });

      await test.step('The user configures the Stripe and fraud connections', async () => {
        await adminHomePage.goToConnections();
        await adminConnectionsPage.configureConnection(
          ConnectionsAvailable.stripeDirect,
          processorsConfig.stripeProcessor
        );
        for (const connection of scenario.fraudConnections) {
          const [name, config] = FRAUD_CONNECTIONS[connection];
          await adminConnectionsPage.configureConnection(name, config);
        }
      });

      await test.step('The user goes to commerce to activate general fraud adjusts', async () => {
        await adminHomePage.goToCommerce();
        await adminCommercePage.activateManualReview();
        await adminCommercePage.activateOpsAutoExecution();
        if (scenario.enableCommerceShadowMode) await adminCommercePage.setShadowMode(true);
      });

      // Routing answers "fraud processor X not available for merchant" for a moment after the
      // Admin creates the connection. The former specs never checked the answer and paid
      // without the rule; now the creation waits until routing accepts it.
      await test.step('The user creates a merchant routing rule setting the fraud providers', async () => {
        const response = await retryUntil(
          () => paymentRoutingService.createMerchantRule(merchantId, merchantToken, scenario.rule),
          (created) => Boolean(created.data?.id),
          10,
          3000
        );
        expect(response.data?.id, 'The merchant routing rule was not created').toBeTruthy();
      });

      await test.step('The user pays the order as guest from the Payment Widget', async () => {
        const testingTool = nagivateAndConfigureWidget(page, 'Payment Widget');
        await testingTool.navigateAndSetup({
          orderToken,
          merchantCredentials: { publicKey, privateKey },
        });
        await paymentDeunaNowPage.fillCreditCardDataDeunaNow(
          creditCardData.stripeMastercardSuccessful,
          { country: 'MX' }
        );
        await paymentDeunaNowPage.clickPay();
      });

      await test.step('It is validated that the order has been processed successfully with status processed', async () => {
        await paymentDeunaNowPage.assertOrderStatusRequestPurchase('processed', 200);
        await adminOrderDetailsPage.goToOrderDetails(merchantId, orderToken);
        await adminOrderDetailsPage.assertPaymentStatus('processed');
      });

      await test.step('It is validated that the order was evaluated by the main and shadow providers', async () => {
        if (scenario.main) {
          const { riskLevel, fraudDecision, status, processor } = scenario.main;
          await adminOrderDetailsPage.assertFraudAnalysisData(
            riskLevel,
            fraudDecision,
            status,
            processor,
            privateKey,
            orderToken
          );
        } else {
          await adminOrderDetailsPage.assertFraudNull(privateKey, orderToken);
        }
        for (const [index, shadow] of scenario.shadows.entries()) {
          await adminOrderDetailsPage.assertFraudShadowAnalysisData(
            index,
            shadow.riskLevel,
            shadow.fraudDecision,
            shadow.status,
            shadow.processor,
            privateKey,
            orderToken
          );
        }
      });
    });
  } finally {
    await page.close();
  }
}
