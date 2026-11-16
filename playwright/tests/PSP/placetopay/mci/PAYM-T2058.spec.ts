import GlobalAssert from '@support/api_sup/global_assert/globalAssert';
import { test, expect } from '@support/fixtures';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import ConfigMerchant from '@support/api_sup/config_merchant_sup/configMerchant';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import { retryGetOrderStatus } from '@support/utils/retries';
const configMerchant = new ConfigMerchant();
const globalAssert = new GlobalAssert();

test.describe('@regression Pays with PlacetoPay CO', () => {
  let merchantId: string;
  let merchantToken: string;
  let merchantName: string;
  let privateKey: string;
  let publicKey: string;
  let orderToken: string;
  let orderId: string;
  let responsePurchase: any;

  test.beforeAll(async ({ emaService }) => {
    const merchant = await configMerchant.basicSetup('CO');
    merchantId = merchant.merchantId;
    merchantToken = merchant.merchantToken;
    merchantName = merchant.merchantName;
    privateKey = merchant.privateKey;
    publicKey = merchant.publicKey;
    const tokenized = await emaService.tokenizeDeunaNowOrder('CO', privateKey, { amount: 250000 });
    orderToken = tokenized.data.token;
    orderId = tokenized.data.order.order_id;
    await apiCallNewman.createPaymentProcessor(
      processorsConfig.placeToPayProcessor,
      merchantId,
      merchantToken
    );
    await apiCallNewman.createCampaignMCI('COP', merchantId, merchantToken);
  });

  test(
    '@PAYM-T2058 Purchase exitoso installments 3 meses - con PlacetoPay',
    {
      tag: [
        '@payments_integration',
        '@installments',
        '@team_payment_integration',
        '@service_install',
      ],
    },
    async ({
      paymentService,
      paymentMsiService,
      userAuthService,
      emaService,
      transactionTraceService,
    }) => {
      const installments = '3';

      await test.step(`The user send purchase request with ${installments} MCI installments`, async () => {
        const responseUserAuth = await userAuthService.loginAsGuest(merchantId, privateKey);
        const userToken = responseUserAuth.data.token;
        const orderInstallments = await paymentMsiService.getOrderInstallments(
          orderToken,
          publicKey,
          creditCardData.placetopayDinersSuccessful.number.slice(0, 6)
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
            country: 'CO',
            processorName: processorsConfig.placeToPayProcessor.name,
            card: creditCardData.placetopayDinersSuccessful,
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

      // TODO: migrate getOrderId() to use emaService order token
      const transactionId = orderId;
      await transactionTraceService.waitForValidTransactionVisibilityLogs(
        transactionId,
        merchantId,
        merchantToken
      );
    }
  );
});
