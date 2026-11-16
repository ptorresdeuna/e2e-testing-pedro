import ConfigMerchant from '@support/api_sup/config_merchant_sup/configMerchant';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import { test, expect } from '@support/fixtures';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import { retryGetOrderStatus, retryGetFraudDecision } from '@support/utils/retries';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import {
  CLEARSALE_FRAUD_PROCESSOR_FAKE_BODY,
  CLEARSALE_FRAUD_PROCESSOR_BODY,
  DYNAMIC_ROUTING_CLEARSALE_RULE_BODY,
} from '@support/http/testData/dynamicRouting/FraudRoutingConfig';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';
import { assertExternalTransactionIdUpperCase } from '@support/newman/apiCallNewman';

let merchantId: string;
let merchantToken: string;
let privateKey: string;
let orderToken: string;
let orderId: string;
let merchantName: string;
let responsePurchase: any;
const configMerchant = new ConfigMerchant();

test.describe('@regression feature to validate merchant profile update', () => {
  test.beforeAll(async ({ emaService }) => {
    const merchantConfig = await configMerchant.basicSetup('MX');
    merchantName = merchantConfig.merchantName;
    merchantId = merchantConfig.merchantId;
    merchantToken = merchantConfig.merchantToken;
    privateKey = merchantConfig.privateKey;
    const tokenizeResponse = await emaService.tokenizeDeunaNowOrder('MX', privateKey, {
      user_email: 'dlora@deuna.com',
      amount: 4990,
      shipping_address2: 'Edificio Torre Latinoamericana, Piso 15',
    });
    orderToken = tokenizeResponse.data.token;
    orderId = tokenizeResponse.data.order.order_id;
    await apiCallNewman.createPaymentProcessor(
      processorsConfig.stripeProcessor,
      merchantId,
      merchantToken
    );
    await apiCallNewman.configureSiftProcessorOnly(
      CLEARSALE_FRAUD_PROCESSOR_FAKE_BODY,
      merchantId,
      merchantToken
    );
    await apiCallNewman.configDynamicRoutingWithFraud(
      CLEARSALE_FRAUD_PROCESSOR_BODY,
      DYNAMIC_ROUTING_CLEARSALE_RULE_BODY,
      merchantId,
      merchantToken
    );
  });

  test(
    '@PI-T1895 Actualizar merchant profile Clearsale y procesar una transacción low risk',
    {
      tag: [
        '@fraud',
        '@admin_connection',
        '@admin-preprod',
        '@team_payments_capabilities',
        '@api',
        '@fixme_preprod',
        '@checkout_configuration',
        '@service_fraud',
      ],
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
            processorName: processorsConfig.stripeProcessor.name,
            card: creditCardData.stripeVisaSuccessfulFraudAprove,
            token: orderToken,
          })
        );
      });

      await test.step('It is validated that the order has been processed successfully with status processed', async () => {
        expect(responsePurchase.status).toBe(200);
        await retryGetOrderStatus(emaService, privateKey, orderToken, 'processed');
      });

      // Absorbed from PI-T1902 (its MX low-risk case ran this same purchase on a fresh profile).
      await test.step('It validates that the fraud decision is respectively correct: processor, risk_level, fraud_decision', async () => {
        await retryGetFraudDecision(emaService, privateKey, orderToken, {
          processor: ConnectionsAvailable.clearsale,
          risk: 'low',
          decision: 'low_risk',
        });
      });
    }
  );
});
