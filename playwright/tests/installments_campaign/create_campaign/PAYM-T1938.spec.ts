import GlobalAssert from '@support/api_sup/global_assert/globalAssert';
const globalAssert = new GlobalAssert();
import { test, expect } from '@support/fixtures';
import ConfigMerchant from '@support/api_sup/config_merchant_sup/configMerchant';

import * as apiCallNewman from '@support/newman/apiCallNewman';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import { retryGetOrderStatus } from '@support/utils/retries';
import { BasicMerchantResult } from '@support/http/services/MerchantAuthService';

const configMerchant = new ConfigMerchant();

test.describe('@regression Installments Campaign', () => {
  let merchantId: string;
  let merchantToken: string;
  let merchantName: string;
  let privateKey: string;
  let publicKey: string;
  let orderToken: string;
  let orderId: string;
  let responsePurchase: any;

  test.beforeAll(async ({ emaService }) => {
    const merchantConfig = await configMerchant.basicSetup('MX');
    merchantId = merchantConfig.merchantId;
    merchantToken = merchantConfig.merchantToken;
    merchantName = merchantConfig.merchantName;
    privateKey = merchantConfig.privateKey;
    publicKey = merchantConfig.publicKey;
    const tokenized = await emaService.tokenizeDeunaNowOrder('MX', privateKey, { amount: 250000 });
    orderToken = tokenized.data.token;
    orderId = tokenized.data.order.order_id;
    await apiCallNewman.createPaymentProcessor(
      processorsConfig.nuveiProcessor,
      merchantId,
      merchantToken
    );
    await apiCallNewman.createCampaignMSI('MXN', merchantId, merchantToken);
  });

  test(
    '@PAYM-T1938 Success create Installment campaign',
    {
      tag: [
        '@installments',
        '@preprod',
        '@installments_mci_msi',
        '@team_payments_capabilities',
        '@service_install',
      ],
    },
    async ({ paymentService, userAuthService, emaService }) => {
      const installments = '3';

      await test.step(`The user send purchase request with ${installments} MSI installments`, async () => {
        const responseUserAuth = await userAuthService.loginAsGuest(merchantId, privateKey);
        const userToken = responseUserAuth.data.token;
        responsePurchase = await paymentService.purchaseV2(
          privateKey,
          userToken,
          buildPurchaseV2Payload({
            country: 'MX',
            processorName: processorsConfig.nuveiProcessor.name,
            card: creditCardData.nuveiMasterCardSucessfull,
            token: orderToken,
            installments: Number(installments),
          })
        );
      });

      await test.step('It is validated that the status of the order is processed, the number of installments and the type of installments', async () => {
        expect(responsePurchase.status).toBe(200);
        await retryGetOrderStatus(emaService, privateKey, orderToken, 'processed');
        await globalAssert.assertInstallmentsQuantity(installments, privateKey, orderToken);
        await globalAssert.assertInstallmentesType('MSI', privateKey, orderToken);
      });
    }
  );
});
