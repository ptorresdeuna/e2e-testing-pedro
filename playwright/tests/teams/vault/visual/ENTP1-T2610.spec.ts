import { test } from '@support/fixtures';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import ConfigMerchant from '@support/api_sup/config_merchant_sup/configMerchant';
import * as processorsConfig from '@support/interfaces/payment_processors';
import { widgetsGeneralConfig } from '@support/mocks/newThemeConfig';
import { VaultWidgetPage } from '@pages/vault/vaultWidgetPage';
import { TestingFramework } from 'playwright/framework/core';
import { randomUUID } from 'crypto';

const configMerchant = new ConfigMerchant();

const customStyles = {
  UpperTagPattern: {
    title: 'This is a custom upper tag',
    description: 'This is the upper tag description',
    style: {
      backgroundColor: '#7c3aed',
      color: '#ffffff',
      marginBottom: '12px',
    },
  },
  LowerTagPattern: {
    title: 'This is a custom lower tag',
    description: 'This is the lower tag description',
    style: {
      backgroundColor: '#dc2626',
      color: '#ffffff',
      marginBottom: '12px',
    },
  },
};

const generalWidgetConfig: apiCallNewman.ConfigurationV2 = {
  widgets_general_config: {
    ...widgetsGeneralConfig,
    user_experience: {
      show_saved_cards_flow: false,
    },
  },
  elementsConfig: {
    init_with_guest_user: true,
    user_authentication_flow: false,
    theme_config: [
      {
        id: randomUUID(),
        name: 'upper_lower_tag_alert_v3',
        config: JSON.stringify(customStyles),
      },
    ],
  },
};

test.describe(
  '@regression @visual Vault Elements: Validar Upper y Lower Tag con Alert V3',
  { tag: ['@checkout', '@elements_link', '@vault'] },
  () => {
    let merchantId: string;
    let merchantToken: string;
    let privateKey: string;
    let publicKey: string;
    let orderToken: string;

    test.beforeAll(async ({ emaService }) => {
      const merchant = await configMerchant.basicSetup('MX');
      merchantId = merchant.merchantId;
      merchantToken = merchant.merchantToken;
      privateKey = merchant.privateKey;
      publicKey = merchant.publicKey;

      await apiCallNewman.configureVaultWidget(merchantId, merchantToken, generalWidgetConfig);

      await apiCallNewman.createPaymentProcessor(
        processorsConfig.stripeProcessor,
        merchantId,
        merchantToken
      );

      const tokenizeResult = await emaService.tokenizeDeunaNowOrder('MX', privateKey, {
        amount: 100000,
      });
      orderToken = tokenizeResult.data.token;
    });

    test(
      '@ENTP1-T2610 Vault Elements: Validar Upper y Lower Tag con colores y márgenes personalizados usando Alert V3',
      { tag: ['@visual', '@team_enterprise', '@service_token'] },
      async ({ page }) => {
        const testing = new TestingFramework({ page, test });
        const vaultWidgetPage = new VaultWidgetPage(page);

        await testing.run({
          step: [
            {
              action: 'checkout.openCheckout',
              params: {
                experienceType: 'Formularios',
                orderToken,
                publicKey,
                privateKey,
              },
              stepName: 'Open the Formularios experience',
            },
            {
              action: 'payment.page.selectPaymentMethod',
              params: { method: 'Payment Vault (Web SDK External Button)' },
              stepName: 'Select Payment Vault (Web SDK External Button) as the payment method',
            },
            {
              action: 'payment.page.clickOnPayButtonEmbedded',
              stepName: 'Open the embedded vault widget',
            },
          ],
        });

        await test.step('Wait for vault guest form to load with UpperTag', async () => {
          await vaultWidgetPage.upperTag.waitFor({ state: 'visible', timeout: 15000 });
        });

        await testing.run({
          step: [
            {
              action: 'visual.verifyCheckoutIframe',
              params: {
                snapshotName: 'vault-widget-alert-v3-tags',
                viewports: 'desktopOnly',
              },
              stepName: 'Verify full vault widget renders with custom tag colors and margins',
            },
          ],
        });
      }
    );
  }
);
