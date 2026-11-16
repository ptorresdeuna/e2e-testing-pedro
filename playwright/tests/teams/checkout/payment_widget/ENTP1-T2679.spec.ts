import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import { test } from '@support/fixtures';
import { TestingFramework, ref } from 'playwright/framework/core';

const widgetGeneralsConfig = {
  user_experience: {
    render_3ds_strategy: 'iframe',
  },
};

test.describe(
  '@regression Payment Widget: fallback "the view didnt load?" when 3DS iframe doesnt load',
  { tag: ['@checkout', '@checkout_base', '@payment_widget'] },
  () => {
    test(
      '@ENTP1-T2679 Payment Widget: fallback "the view didnt load?" when 3DS iframe doesnt load',
      { tag: ['@team_enterprise', '@service_threeds'] },
      async ({ page }) => {
        const testing = new TestingFramework({ page, test });

        await testing.run({
          step: [
            {
              action: 'setup.merchant.configureCheckout',
              params: { country: 'MX' },
              saveAs: 'merchant',
            },
            {
              action: 'setup.processor.createProcessor',
              params: { processorConfig: processorsConfig.stripe3dsProcessor },
            },
            { action: 'setup.checkout.configureV2', params: { widgetGeneralsConfig } },
            { action: 'setup.order.createOrder', params: { country: 'MX' }, saveAs: 'order' },
            {
              action: 'checkout.3ds.holdChallengeIframeLoad',
              stepName: 'The 3DS challenge iframe is kept from loading',
            },
            {
              action: 'checkout.openCheckout',
              params: {
                experienceType: 'Payment Widget',
                publicKey: ref('merchant').at('publicKey'),
                privateKey: ref('merchant').at('privateKey'),
                orderToken: ref('order').at('data.token'),
              },
              stepName: 'The user opens the testing page and Payment Widget',
            },
            {
              action: 'checkout.paymentWidget.fillCreditCardData',
              params: {
                creditCardData: creditCardData.stripe3dsPass,
                opts: { country: 'MX' },
              },
              stepName: 'The user inserts a Stripe 3DS credit card',
            },
            {
              action: 'checkout.paymentWidget.clickOnPayButton',
              params: { withResponse: false },
              stepName: 'The user clicks pay',
            },
            {
              action: 'checkout.paymentWidget.assert3dsFallbackCollapsed',
              stepName: 'The "¿La vista no cargó?" fallback appears collapsed',
            },
            {
              action: 'checkout.paymentWidget.expand3dsFallback',
              stepName:
                'The user expands the fallback and sees "Recargar vista" and "Cambiar método de pago"',
            },
            {
              action: 'checkout.paymentWidget.open3dsFallbackChangeMethodModal',
              stepName: 'The user clicks "Cambiar método de pago" and sees the confirmation modal',
            },
            {
              action: 'checkout.paymentWidget.dismiss3dsFallbackChangeMethodModal',
              stepName: 'The user clicks "Volver" and stays on the challenge',
            },
            {
              action: 'checkout.paymentWidget.open3dsFallbackChangeMethodModal',
              stepName: 'The user opens the confirmation modal again',
            },
            {
              action: 'checkout.paymentWidget.confirm3dsFallbackChangeMethod',
              stepName: 'The user confirms "Cambiar método"',
            },
            {
              action: 'checkout.paymentWidget.assertUserSeePaymentForm',
              stepName: 'The user is back on the payment form',
            },
          ],
        });
      }
    );
  }
);
