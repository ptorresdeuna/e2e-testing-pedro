import ConfigMerchant from '@support/api_sup/config_merchant_sup/configMerchant';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import { test, expect } from '@support/fixtures';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import { retryGetOrderStatus, retryGetFraudDecision } from '@support/utils/retries';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import {
  CLEARSALE_FRAUD_PROCESSOR_MANUAL_REVIEW_BODY,
  DYNAMIC_ROUTING_CLEARSALE_ALL_RISKS_RULE_BODY,
  CLEARSALE_BRASIL_FRAUD_PROCESSOR_BODY,
  DYNAMIC_ROUTING_CLEARSALE_BRASIL_ALL_RISKS_RULE_BODY,
} from '@support/http/testData/dynamicRouting/FraudRoutingConfig';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';

const configMerchant = new ConfigMerchant();

// The MX low-risk case moved to PI-T1895, which pays the same order after updating the profile.
const CLEARSALE_CASES = [
  {
    name: 'high risk',
    merchantCountry: 'MX',
    tokenizeCountry: 'MX',
    amount: 7000,
    email: 'dlora@deuna.com',
    card: creditCardData.stripeVisaSuccessful,
    paymentProcessor: processorsConfig.stripeProcessor,
    shippingAddress2: 'Edificio Torre Latinoamericana, Piso 15',
    processorFraudBody: CLEARSALE_FRAUD_PROCESSOR_MANUAL_REVIEW_BODY,
    routingRuleBody: DYNAMIC_ROUTING_CLEARSALE_ALL_RISKS_RULE_BODY,
    fraudProcessor: ConnectionsAvailable.clearsale,
    risk: 'high',
    decision: 'high_risk',
  },
  {
    name: 'brasil low risk',
    merchantCountry: 'BR',
    tokenizeCountry: 'MX',
    amount: 4990,
    email: 'dlora@deuna.com',
    card: { ...creditCardData.stripeVisaSuccessfulFraudAprove, document_number: '51682247503' },
    paymentProcessor: processorsConfig.stripeProcessor,
    shippingAddress2: 'Edificio Torre Latinoamericana, Piso 15',
    processorFraudBody: CLEARSALE_BRASIL_FRAUD_PROCESSOR_BODY,
    routingRuleBody: DYNAMIC_ROUTING_CLEARSALE_BRASIL_ALL_RISKS_RULE_BODY,
    fraudProcessor: ConnectionsAvailable.clearsalebrasil,
    risk: 'low',
    decision: 'low_risk',
  },
  // Absorbed from PI-T1909: a Brazilian order paid through Stripe BR.
  {
    name: 'brasil low risk with a BR order',
    merchantCountry: 'BR',
    tokenizeCountry: 'BR',
    amount: 5500,
    email: 'pruebafraude@fraude.com',
    card: { ...creditCardData.stripeVisaSuccessfulFraudReprove, document_number: '51682247503' },
    paymentProcessor: processorsConfig.stripeProcessorBR,
    shippingAddress2: 'Rua B',
    processorFraudBody: CLEARSALE_BRASIL_FRAUD_PROCESSOR_BODY,
    routingRuleBody: DYNAMIC_ROUTING_CLEARSALE_BRASIL_ALL_RISKS_RULE_BODY,
    fraudProcessor: ConnectionsAvailable.clearsalebrasil,
    risk: 'low',
    decision: 'low_risk',
  },
] as const;

test.describe('@regression feature to validate with the automated test case', () => {
  test(
    '@PI-T1902 Procesar transacciones con motor de fraude Clearsale high risk y Clearsale-brasil low risk con orden MX y BR',
    {
      tag: [
        '@fraud',
        '@admin_connection',
        '@admin-preprod',
        '@team_payments_capabilities',
        '@api',
        '@service_fraud',
      ],
    },
    async ({ paymentService, userAuthService, emaService }) => {
      for (const fraudCase of CLEARSALE_CASES) {
        await test.step(fraudCase.name, async () => {
          let merchantId: string;
          let merchantToken: string;
          let privateKey: string;
          let orderToken: string;
          let responsePurchase: any;

          await test.step('Merchant and order setup', async () => {
            const merchantConfig = await configMerchant.basicSetup(fraudCase.merchantCountry);
            merchantId = merchantConfig.merchantId;
            merchantToken = merchantConfig.merchantToken;
            privateKey = merchantConfig.privateKey;
            const tokenizeResponse = await emaService.tokenizeDeunaNowOrder(
              fraudCase.tokenizeCountry,
              privateKey,
              {
                user_email: fraudCase.email,
                amount: fraudCase.amount,
                shipping_address2: fraudCase.shippingAddress2,
              }
            );
            orderToken = tokenizeResponse.data.token;
            await apiCallNewman.createPaymentProcessor(
              fraudCase.paymentProcessor,
              merchantId,
              merchantToken
            );
            await apiCallNewman.configDynamicRoutingWithFraud(
              fraudCase.processorFraudBody,
              fraudCase.routingRuleBody,
              merchantId,
              merchantToken
            );
          });

          await test.step('The user send purchase request', async () => {
            const responseUserAuth = await userAuthService.loginAsGuest(merchantId, privateKey);
            const userToken = responseUserAuth.data.token;
            responsePurchase = await paymentService.purchaseV2(
              privateKey,
              userToken,
              buildPurchaseV2Payload({
                country: fraudCase.tokenizeCountry,
                processorName: fraudCase.paymentProcessor.name,
                card: fraudCase.card,
                token: orderToken,
              })
            );
          });

          await test.step('It is validated that the order has been processed successfully with status processed', async () => {
            expect(responsePurchase.status).toBe(200);
            await retryGetOrderStatus(emaService, privateKey, orderToken, 'processed');
          });

          await test.step('It validates that the fraud decision is respectively correct: processor, risk_level, fraud_decision', async () => {
            await retryGetFraudDecision(emaService, privateKey, orderToken, {
              processor: fraudCase.fraudProcessor,
              risk: fraudCase.risk,
              decision: fraudCase.decision,
            });
          });
        });
      }
    }
  );
});
