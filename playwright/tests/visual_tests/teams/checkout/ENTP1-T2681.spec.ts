import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import { buildMPWalletProcessor } from '@support/interfaces/payment_processors';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';
import { DeunacheckoutOrderBuilder } from '@support/http/testData/ema/DEUNA_CHECKOUT';

test.describe(
  '@regression @visual Mercado Pago Wallet - Haruka redirect view',
  { tag: ['@checkout', '@checkout_base', '@payment_widget'] },
  () => {
    test(
      '@ENTP1-T2681 Mercado Pago Wallet Testing Visual Redirect View',
      { tag: ['@visual', '@admin_connection', '@team_enterprise', '@service_apm'] },
      async ({ page }) => {
        const testing = new TestingFramework({ page, test });

        await testing.run({
          step: [
            { action: 'setup.merchant.basicSetup', params: { country: 'MX' } },
            {
              action: 'setup.order.tokenizeOrder',
              params: {
                orderData: DeunacheckoutOrderBuilder.createBody('MX', {
                  amount: 1000,
                  payment_method: 'wallet',
                }),
              },
            },
            { action: 'admin.consolidatedFlows.goToAdminAndSetMerchantId' },
            { action: 'admin.navigate.goToConnections' },
            {
              action: 'admin.connections.configureConnection',
              params: {
                connectionName: ConnectionsAvailable.mercadopagoWallet,
                processorData: buildMPWalletProcessor({ exclude_payment_methods: [] }),
              },
            },
            { action: 'checkout.openCheckout', params: { experienceType: 'Formularios' } },
            { action: 'checkout.wallet.mercadoPago.payWithFormAndWaitForPopup' },
            {
              action: 'checkout.wallet.mercadoPago.assertLabelProcessingPaymentVisible',
              stepName: 'Processing state while the Mercado Pago popup is open',
            },
            {
              action: 'visual.verifyCheckoutIframe',
              params: { snapshotName: 'mercadopago-wallet-redirect-processing' },
            },
            { action: 'checkout.wallet.mercadoPago.closePopup' },
            { action: 'checkout.wallet.mercadoPago.assertWindowClosedWarning' },
            {
              action: 'checkout.wallet.mercadoPago.assertLabelRedirectingToSiteVisible',
              stepName: 'Shopper stays on the redirect view after closing the popup',
            },
            {
              action: 'visual.verifyCheckoutIframe',
              params: { snapshotName: 'mercadopago-wallet-redirect-window-closed' },
            },
          ],
          cleanup: [{ action: 'checkout.wallet.mercadoPago.closePopup' }],
        });
      }
    );
  }
);
