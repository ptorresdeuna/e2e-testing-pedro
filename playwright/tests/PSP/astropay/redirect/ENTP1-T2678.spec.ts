import { test } from '@support/fixtures';
import { TestingFramework, ref } from 'playwright/framework/core';
import * as processorsConfig from '@support/interfaces/payment_processors';

test.describe(
  '@regression @visual Astropay Haruka Redirection UI',
  { tag: ['@checkout', '@checkout_base', '@payment_widget', '@visual'] },
  () => {
    // Blocked by PF-3774: AstroPay purchase endpoint returns DP-7100 in staging.
    test.fixme(
      '@ENTP1-T2678 [AstroPay - Haruka] Redirect View: Multi-state Visual Consistency & Window Controls',
      {
        annotation: { type: 'bug', description: 'PF-3774' },
        tag: [
          '@visual',
          '@checkout',
          '@checkout_base',
          '@payment_widget',
          '@team_enterprise',
          '@service_apm',
        ],
      },
      async ({ page }) => {
        const testing = new TestingFramework({ page, test });

        await testing.run({
          step: [
            { action: 'setup.merchant.basicSetup', params: { country: 'AR' } },
            {
              action: 'setup.processor.createProcessor',
              params: { processorConfig: processorsConfig.astropayProcessorAR },
              saveAs: 'processorId',
            },
            { action: 'setup.order.createOrder', params: { country: 'AR' } },
            { action: 'checkout.openCheckout', params: { experienceType: 'Formularios' } },
            {
              action: 'checkout.wallet.astropay.selectAstropayAndCapturePopup',
              stepName: 'Select AstroPay payment method and capture popup listener',
            },
            {
              action: 'checkout.wallet.astropay.waitForAstropayPopupAndAssertProcessing',
              stepName: 'Wait for external popup and assert processing state controls',
            },
            {
              action: 'checkout.wallet.astropay.verifyAstropayRedirectVisualConsistency',
              stepName: 'Visual snapshot: Processing state with external window open',
              params: {
                snapshotName: 'astropay-redirect-processing',
              },
            },
            {
              action: 'checkout.wallet.astropay.closeAstropayPopupAndAssertWarning',
              stepName: 'Close external popup and assert window-closed warning state',
            },
            {
              action: 'checkout.wallet.astropay.verifyAstropayRedirectVisualConsistency',
              stepName: 'Visual snapshot: Window closed warning alert and redirect controls',
              params: {
                snapshotName: 'astropay-redirect-window-closed-warning',
                maskProgressBar: true,
              },
            },
            {
              action: 'checkout.wallet.astropay.clickAstropayChangeMethodAndAssertFormList',
              stepName: 'Click change payment method and return to payment methods list',
            },
          ],
          cleanup: [
            {
              action: 'checkout.wallet.astropay.closeAstropayPopup',
            },
            {
              action: 'setup.processor.deleteProcessor',
              params: { processorId: ref('processorId') },
            },
          ],
        });
      }
    );
  }
);
