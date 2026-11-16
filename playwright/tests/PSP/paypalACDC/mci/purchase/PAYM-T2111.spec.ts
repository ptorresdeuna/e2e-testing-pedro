import GlobalAssert from '@support/api_sup/global_assert/globalAssert';
import { test, expect } from '@support/fixtures';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import ConfigMerchant from '@support/api_sup/config_merchant_sup/configMerchant';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import { retryGetOrderStatus } from '@support/utils/retries';

import { buildPaypalAcdcMciMsiOrder } from '@tests/PSP/paypalACDC/common/TokenizeOrderPayPalACDC';

const configMerchant = new ConfigMerchant();
const globalAssert = new GlobalAssert();

test.describe('@regression Pays with PayPal ACDC MX', () => {
  let orderToken: string;
  let merchantId: string;
  let merchantToken: string;
  let merchantName: string;
  let privateKey: string;
  let publicKey: string;
  let responsePurchase: any;

  test.beforeAll(async ({ emaService }) => {
    const merchant = await configMerchant.basicSetup('MX');
    merchantId = merchant.merchantId;
    merchantToken = merchant.merchantToken;
    merchantName = merchant.merchantName;
    privateKey = merchant.privateKey;
    publicKey = merchant.publicKey;
    const tokenized = await emaService.tokenizeOrderWithCustomBody(
      privateKey,
      buildPaypalAcdcMciMsiOrder()
    );
    orderToken = tokenized.data.token;
    await apiCallNewman.createPaymentProcessor(
      processorsConfig.paypalACDCProcessorWithMCItoPSPasMSI,
      merchantId,
      merchantToken
    );
    await apiCallNewman.createCampaignMCI('MXN', merchantId, merchantToken);
  });

  test(
    '@PAYM-T2111 Purchase installments 3 meses with installments_plan_option_id Paypal ACDC',
    {
      tag: [
        '@payments_integration',
        '@installments',
        '@team_payment_integration',
        '@preprod',
        '@purchase',
        '@installments_mci_msi',
        '@service_install',
      ],
    },
    async ({ paymentService, paymentMsiService, userAuthService, emaService }) => {
      const installments = '3';

      await test.step(`The user send purchase request with ${installments} MCI installments`, async () => {
        const responseUserAuth = await userAuthService.loginAsGuest(merchantId, privateKey);
        const userToken = responseUserAuth.data.token;
        const orderInstallments = await paymentMsiService.getOrderInstallments(
          orderToken,
          publicKey,
          creditCardData.paypalACDCVisaSucessful.number.slice(0, 6)
        );
        const installmentOptions = (orderInstallments.data.installments ?? []) as any[];
        const planOption = installmentOptions.find(
          (option) => option.installments === Number(installments)
        );
        if (!planOption) {
          throw new Error(`No plan option for ${installments} installments`);
        }
        responsePurchase = await paymentService.purchaseV2(
          privateKey,
          userToken,
          buildPurchaseV2Payload({
            country: 'MX',
            processorName: processorsConfig.paypalACDCProcessorWithMCItoPSPasMSI.name,
            card: creditCardData.paypalACDCVisaSucessful,
            token: orderToken,
            installments: Number(installments),
            planOptionId: planOption.plan_option_id,
          })
        );
      });

      await test.step('Validate that the order has been processed successfully with status code "200" and status order "processed"', async () => {
        expect(responsePurchase.status).toBe(200);
        await retryGetOrderStatus(emaService, privateKey, orderToken, 'processed');
        await globalAssert.assertInstallmentsQuantity(installments, privateKey, orderToken);
        await globalAssert.assertInstallmentesType('MCI', privateKey, orderToken);
      });
    }
  );
});
