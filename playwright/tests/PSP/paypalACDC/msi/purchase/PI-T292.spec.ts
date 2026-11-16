import GlobalAssert from '@support/api_sup/global_assert/globalAssert';
import { test, expect } from '@support/fixtures';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import ConfigMerchant from '@support/api_sup/config_merchant_sup/configMerchant';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import { retryGetOrderStatus } from '@support/utils/retries';
import { buildPaypalAcdcMciMsiOrder } from '../../common/TokenizeOrderPayPalACDC';

const configMerchant = new ConfigMerchant();
const globalAssert = new GlobalAssert();

const INSTALLMENTS_CASES = ['3', '6', '9', '12', '18'] as const;

const CUSTOM_BODY_INSTALLMENTS = new Set(['3', '18']);

test.describe('@regression Pays with PayPal ACDC MX', () => {
  let merchantId: string;
  let merchantToken: string;
  let merchantName: string;
  let privateKey: string;
  let publicKey: string;
  let orderToken: string;
  let orderId: string;
  let responsePurchase: any;

  test.beforeAll(async () => {
    const merchant = await configMerchant.basicSetup('MX');
    merchantId = merchant.merchantId;
    merchantToken = merchant.merchantToken;
    merchantName = merchant.merchantName;
    privateKey = merchant.privateKey;
    publicKey = merchant.publicKey;
    await apiCallNewman.createPaymentProcessor(
      processorsConfig.paypalACDCProcessor,
      merchantId,
      merchantToken
    );
    await apiCallNewman.createCampaignMSI('MXN', merchantId, merchantToken);
  });

  test(
    '@PI-T292 Purchase installments 3, 6, 9, 12 y 18 meses - Paypal ACDC',
    {
      tag: [
        '@payments_integration',
        '@installments',
        '@flaky',
        '@team_payment_integration',
        '@preprod',
        '@purchase',
        '@installments_mci_msi',
        '@service_install',
      ],
    },
    async ({ paymentService, userAuthService, emaService }) => {
      const status = 'processed';

      for (const installments of INSTALLMENTS_CASES) {
        await test.step(`${installments} meses`, async () => {
          await test.step('The user opens the testing page and opens the required widget', async () => {
            if (CUSTOM_BODY_INSTALLMENTS.has(installments)) {
              const tokenized = await emaService.tokenizeOrderWithCustomBody(
                privateKey,
                buildPaypalAcdcMciMsiOrder()
              );
              orderToken = tokenized.data.token;
              orderId = tokenized.data.order.order_id;
            } else {
              const tokenized = await emaService.tokenizeDeunaNowOrder('MX', privateKey, {
                amount: 300000,
              });
              orderToken = tokenized.data.token;
              orderId = tokenized.data.order.order_id;
            }
          });

          await test.step(`The user send purchase request with ${installments} MSI installments`, async () => {
            const responseUserAuth = await userAuthService.loginAsGuest(merchantId, privateKey);
            const userToken = responseUserAuth.data.token;
            responsePurchase = await paymentService.purchaseV2(
              privateKey,
              userToken,
              buildPurchaseV2Payload({
                country: 'MX',
                processorName: processorsConfig.paypalACDCProcessor.name,
                card: creditCardData.paypalACDCMasterCardSucessful,
                token: orderToken,
                installments: Number(installments),
              })
            );
          });

          await test.step('Validate that the order has been processed successfully with status code "200" and status order "processed"', async () => {
            expect(responsePurchase.status).toBe(200);
            await retryGetOrderStatus(emaService, privateKey, orderToken, status);
            await globalAssert.assertInstallmentsQuantity(installments, privateKey, orderToken);
            await globalAssert.assertInstallmentesType('MSI', privateKey, orderToken);
          });
        });
      }
    }
  );
});
