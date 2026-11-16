import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import { DeunanowTranslations } from '@support/translations/selectors/deunanow/deunanowTranslations';
import { getTranslations } from '@support/translations/getTranslations';
import ConfigMerchantCheckout from '@support/api_sup/config_merchant_sup/configMerchantCheckout';
import ConfigAuth from '@support/api_sup/config_merchant_sup/configAuth';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import * as processorsConfig from '@support/interfaces/payment_processors';
import {
  paypalAccount,
  deletePaymentProcessor,
  registerProcessorForCleanup,
  registerUserWithAddress,
} from '../common';
import { DeunacheckoutOrderBuilder } from '@support/http/testData/ema/DEUNA_CHECKOUT';

const deunanowTranslations: DeunanowTranslations = getTranslations('deunanow', 'ES');

test.describe(
  '@regression PayPal Group - Authenticated Saved Account Purchase',
  { tag: ['@checkout', '@checkout_base', '@payment_widget'] },
  () => {
    const userEmail = `${Math.floor(Math.random() * 9999999)}.qa@deuna.com`;
    let paypalProcessorId: string;
    let payLaterProcessorId: string;
    let cashProcessorId: string;
    let privateKey: string;
    let publicKey: string;
    let userToken: string;
    let merchantId: string;
    let merchantToken: string;
    let initialOrderToken: string;

    test.beforeAll(async ({ emaService }) => {
      const configMerchantCheckout = new ConfigMerchantCheckout();
      const setup = await configMerchantCheckout.basicSetup('MX');
      merchantId = setup.merchantId;
      merchantToken = setup.merchantToken;
      privateKey = setup.privateKey;
      publicKey = setup.publicKey;

      paypalProcessorId = await apiCallNewman.createPaymentProcessor(
        processorsConfig.paypalWalletProcessorWithInstallments,
        merchantId,
        merchantToken
      );
      registerProcessorForCleanup(paypalProcessorId, merchantId, merchantToken);

      payLaterProcessorId = await apiCallNewman.createPaymentProcessor(
        processorsConfig.paypalPayLaterProcessor,
        merchantId,
        merchantToken
      );
      registerProcessorForCleanup(payLaterProcessorId, merchantId, merchantToken);

      cashProcessorId = await apiCallNewman.createPaymentProcessor(
        processorsConfig.cashProcessor,
        merchantId,
        merchantToken
      );
      registerProcessorForCleanup(cashProcessorId, merchantId, merchantToken);

      await registerUserWithAddress(userEmail, merchantId, privateKey);

      const configAuth = new ConfigAuth();
      userToken = await configAuth.setUserToken(userEmail, merchantId, privateKey);

      const orderBody = DeunacheckoutOrderBuilder.createBody('MX', {
        amount: 7980000,
        user_email: userEmail,
      });
      const tokenized = await emaService.tokenizeOrderWithCustomBody(privateKey, orderBody);
      initialOrderToken = tokenized.data.token;
    });

    test.beforeEach(async ({ page }) => {
      const testing = new TestingFramework({ page, test });

      await testing.run({
        step: [
          {
            action: 'checkout.openCheckout',
            params: {
              experienceType: 'Payment Widget',
              language: 'ES',
              orderToken: initialOrderToken,
              userToken,
              publicKey,
              privateKey,
            },
            stepName: 'Should open Payment Widget to establish initial vaulted account',
          },
          {
            action: 'checkout.wallet.paypal.selectUnifiedPayPalTab',
            stepName: 'Should select unified PayPal tab for initial account setup',
          },
          {
            action: 'checkout.wallet.paypal.clickPayPalButtonAndOpenPopup',
            stepName: 'Should click PayPal button and open login popup',
          },
          {
            action: 'checkout.wallet.paypal.loginVaulting',
            params: {
              email: paypalAccount.email,
              password: paypalAccount.password,
            },
            stepName: 'Should complete PayPal vaulting login',
          },
          {
            action: 'checkout.wallet.paypal.clickConsentButton',
            stepName: 'Should accept vaulting agreement to save account',
          },
          {
            action: 'checkout.wallet.paypal.assertWidgetThankYouPage',
            params: {
              text: deunanowTranslations.screenThankYouPage.labelSuccessfulTitle,
            },
            stepName: 'Should verify thank you page confirms initial account vaulting',
          },
        ],
      });
    });

    test(
      '@ENTP1-T2666 PayPal Group (Wallet + Pay Later): Successful authenticated purchase with saved account after switching options',
      { tag: ['@team_enterprise', '@service_apm'] },
      async ({ page, emaService }) => {
        const testing = new TestingFramework({ page, test });
        const installments = 1;

        const orderBody = DeunacheckoutOrderBuilder.createBody('MX', {
          amount: 7980000,
          user_email: userEmail,
        });
        const tokenized = await emaService.tokenizeOrderWithCustomBody(privateKey, orderBody);
        const secondOrderToken = tokenized.data.token;

        await testing.run({
          step: [
            {
              action: 'checkout.openCheckout',
              params: {
                experienceType: 'Payment Widget',
                language: 'ES',
                orderToken: secondOrderToken,
                userToken,
                publicKey,
                privateKey,
              },
              stepName: 'Should open Payment Widget for second purchase as authenticated user',
            },
            {
              action: 'checkout.wallet.paypal.assertUnifiedPayPalAndCashTabsVisible',
              stepName: 'Should verify unified PayPal tab and Cash tab are visible',
            },
            {
              action: 'checkout.wallet.paypal.selectUnifiedPayPalTab',
              stepName: 'Should select unified PayPal tab',
            },
            {
              action: 'checkout.wallet.paypal.assertAuthenticatedSavedAccountView',
              stepName:
                'Should verify saved PayPal account is preselected and pay button is visible',
            },
            {
              action: 'checkout.wallet.paypal.selectPayLaterOptionInGroup',
              stepName: 'Should select Pay Later option inside the unified tab',
            },
            {
              action: 'checkout.wallet.paypal.assertAuthenticatedPayLaterSelectedView',
              stepName:
                'Should verify Pay Later SPB button and view saved accounts shortcut are visible',
            },
            {
              action: 'checkout.wallet.paypal.selectPayWithAnotherAccountInGroup',
              stepName: 'Should select pay with another account option',
            },
            {
              action: 'checkout.wallet.paypal.assertAuthenticatedAnotherAccountSelectedView',
              stepName: 'Should verify PayPal Wallet button is visible for new account setup',
            },
            {
              action: 'checkout.wallet.paypal.restoreSavedAccountFromViewSavedAccounts',
              stepName:
                'Should restore saved PayPal account selection via view saved accounts shortcut',
            },
            {
              action: 'checkout.wallet.paypal.clickPayWithSavedAccountAndAssertDeviceId',
              stepName:
                'Should submit payment with saved PayPal account and assert non-empty device_id',
            },
            {
              action: 'checkout.wallet.paypal.assertProcessingModalTitle',
              params: {
                text: deunanowTranslations.screenRedirectToCommerceView.labelProcessingOrder,
              },
              stepName: 'Should verify order processing modal dialog is displayed',
            },
            {
              action: 'checkout.wallet.paypal.assertWidgetThankYouPage',
              params: {
                text: deunanowTranslations.screenThankYouPage.labelSuccessfulTitle,
              },
              stepName:
                'Should verify thank you page is displayed upon successful order completion',
            },
            {
              action: 'checkout.wallet.paypal.assertWalletOrderDetails',
              params: {
                installments,
                expectedStatus: 'processed',
                merchantId,
                orderToken: secondOrderToken,
              },
              stepName:
                'Should verify order details in admin portal match processed PayPal Wallet payment',
            },
          ],
        });
      }
    );

    test.afterAll(async () => {
      await Promise.allSettled([
        deletePaymentProcessor(paypalProcessorId, merchantId, merchantToken),
        deletePaymentProcessor(payLaterProcessorId, merchantId, merchantToken),
        deletePaymentProcessor(cashProcessorId, merchantId, merchantToken),
      ]);
    });
  }
);
