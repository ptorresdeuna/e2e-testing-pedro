import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import { DeunanowTranslations } from '@support/translations/selectors/deunanow/deunanowTranslations';
import { getTranslations } from '@support/translations/getTranslations';
import * as processorsConfig from '@support/interfaces/payment_processors';
import ConfigMerchantCheckout from '@support/api_sup/config_merchant_sup/configMerchantCheckout';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import { DeunacheckoutOrderBuilder } from '@support/http/testData/ema/DEUNA_CHECKOUT';
import {
  deletePaymentProcessor,
  registerProcessorForCleanup,
} from '@tests/wallet/paypal_wallet/common';

const configMerchantCheckout = new ConfigMerchantCheckout();
const deunanowTranslations: DeunanowTranslations = getTranslations('deunanow', 'ES');

test.describe(
  '@regression PayPal Group - Guest Pay Later Purchase',
  { tag: ['@checkout', '@checkout_base', '@payment_widget'] },
  () => {
    let merchantId = '';
    let merchantToken = '';
    let privateKey = '';
    let publicKey = '';
    let orderToken = '';
    let paypalWalletProcessorId = '';
    let paypalPayLaterProcessorId = '';
    let cashProcessorId = '';

    test.beforeEach(async ({ emaService }) => {
      const basicSetup = await configMerchantCheckout.basicSetup('US');
      merchantId = basicSetup.merchantId;
      merchantToken = basicSetup.merchantToken;
      privateKey = basicSetup.privateKey;
      publicKey = basicSetup.publicKey;

      [paypalWalletProcessorId, paypalPayLaterProcessorId, cashProcessorId] = await Promise.all([
        apiCallNewman.createPaymentProcessor(
          processorsConfig.paypalWalletProcessorUSD,
          merchantId,
          merchantToken
        ),
        apiCallNewman.createPaymentProcessor(
          processorsConfig.paypalPayLaterProcessor,
          merchantId,
          merchantToken
        ),
        apiCallNewman.createPaymentProcessor(
          processorsConfig.cashProcessorEC,
          merchantId,
          merchantToken
        ),
      ]);
      registerProcessorForCleanup(paypalWalletProcessorId, merchantId, merchantToken);
      registerProcessorForCleanup(paypalPayLaterProcessorId, merchantId, merchantToken);
      registerProcessorForCleanup(cashProcessorId, merchantId, merchantToken);

      const orderBody = DeunacheckoutOrderBuilder.createBody('US');
      const order = await emaService.tokenizeOrderWithCustomBody(privateKey, orderBody);
      orderToken = order.data.token;
    });

    test(
      '@ENTP1-T2665 PayPal Group (Wallet + Pay Later): Successful guest purchase with Pay Later from unified tab',
      { tag: ['@team_enterprise', '@service_apm'] },
      async ({ page }) => {
        const testing = new TestingFramework({ page, test });
        const installments = 1;

        await testing.run({
          step: [
            {
              action: 'checkout.openCheckout',
              params: {
                experienceType: 'Payment Widget',
                language: 'ES',
                privateKey,
                publicKey,
                orderToken,
              },
              stepName:
                'Should open Payment Widget with the tokenized order and merchant credentials',
            },
            {
              action: 'checkout.wallet.paypal.assertUnifiedPayPalAndCashTabsVisible',
              stepName:
                'Should verify unified PayPal tab and Cash tab are visible while standalone tabs are hidden',
            },
            {
              action: 'checkout.wallet.paypal.selectUnifiedPayPalTab',
              stepName: 'Should click on the unified PayPal tab',
            },
            {
              action: 'checkout.wallet.paypal.assertGuestOptionsAndWalletButtonVisible',
              stepName:
                'Should verify guest options selector is displayed with PayPal Wallet button active by default',
            },
            {
              action: 'checkout.wallet.paypal.selectPayLaterOptionInGroup',
              stepName: 'Should select PayPal Pay Later option inside the unified tab',
            },
            {
              action: 'checkout.wallet.paypal.assertSpbButtonVisibleAndWalletButtonHidden',
              stepName: 'Should verify PayPal SPB button is displayed and Wallet button is hidden',
            },
            {
              action: 'checkout.wallet.paypal.selectWalletOptionInGroup',
              stepName: 'Should select PayPal Wallet option inside the unified tab',
            },
            {
              action: 'checkout.wallet.paypal.assertGuestOptionsAndWalletButtonVisible',
              stepName: 'Should verify PayPal Wallet button is restored and SPB button is hidden',
            },
            {
              action: 'checkout.wallet.paypal.switchToCashAndBackToUnifiedPayPalTab',
              stepName:
                'Should switch to Cash tab and back to unified PayPal tab to verify selection persistence',
            },
            {
              action: 'checkout.wallet.paypal.assertGuestOptionsAndWalletButtonVisible',
              stepName:
                'Should verify default options selector view is preserved upon returning to PayPal tab',
            },
            {
              action: 'checkout.wallet.paypal.selectPayLaterOptionInGroup',
              stepName: 'Should select PayPal Pay Later option to proceed with payment',
            },
            {
              action: 'checkout.wallet.paypal.assertSpbButtonVisibleAndWalletButtonHidden',
              stepName: 'Should verify PayPal SPB button is ready for checkout',
            },
            {
              action: 'checkout.bnpl.paypalPayLater.clickPayButtonAndOpenPaypal',
              stepName: 'Should click on PayPal SPB pay button and await popup window',
            },
            {
              action: 'checkout.bnpl.paypalPayLater.loginInPaypal',
              stepName: 'Should login to PayPal sandbox with test credentials',
            },
            {
              action: 'checkout.bnpl.paypalPayLater.selectCardInPaypal',
              stepName: 'Should select payment card inside PayPal popup',
            },
            {
              action: 'checkout.bnpl.paypalPayLater.clickPayInPaypal',
              stepName: 'Should authorize payment in PayPal popup',
            },
            {
              action: 'checkout.bnpl.paypalPayLater.assertProcessingView',
              stepName: 'Should assert that the processing view is displayed in checkout',
            },
            {
              action: 'checkout.bnpl.paypalPayLater.assertThankyouPage',
              params: { text: deunanowTranslations.screenThankYouPage.labelSuccessfulTitle },
              stepName: 'Should verify thank you page with completed payment title is displayed',
            },
            {
              action: 'checkout.bnpl.paypalPayLater.assertOrderDetails',
              params: {
                installments,
                expectedStatus: 'processed',
                expectedPaymentMethod: 'bnpl',
                merchantId,
                orderToken,
              },
              stepName:
                'Should verify order status, processor name, and installments in admin order details',
            },
          ],
        });
      }
    );

    test.afterEach(async () => {
      await Promise.allSettled([
        deletePaymentProcessor(paypalWalletProcessorId, merchantId, merchantToken),
        deletePaymentProcessor(paypalPayLaterProcessorId, merchantId, merchantToken),
        deletePaymentProcessor(cashProcessorId, merchantId, merchantToken),
      ]);
    });
  }
);
