import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import { placetopayPseProcessor } from '@support/interfaces/payment_processors';
import { PlacetopayPseFormData } from '@pages/explore/forms/placetopayPseFormPage';

const formData: PlacetopayPseFormData = {
  email: 'dmorocho@deuna.com',
  bankName: 'BANCO AV VILLAS',
  personType: 'Natural',
  holderName: 'App App',
  documentNumber: '1234567890',
  phone: '3222222222',
  address: 'Calle 123 #45-67',
};

test.describe(
  '@regression @visual PlaceToPay PSE - Formularios - UI Visual Consistency',
  { tag: ['@forms', '@pse', '@team_enterprise', '@visual'] },
  () => {
    test(
      '@ENTP1-T2667 [VISUAL] PlaceToPay PSE: validación visual del formulario, errores y redirect en Formularios',
      { tag: ['@visual', '@service_apm'] },
      async ({ page }) => {
        const testing = new TestingFramework({ page, test });

        await testing.run({
          step: [
            {
              action: 'setup.merchant.configureCheckout',
              params: { country: 'CO' },
              stepName: 'Setup CO merchant with checkout support',
            },
            {
              action: 'setup.processor.createProcessor',
              params: { processorConfig: placetopayPseProcessor },
              stepName: 'Configure PlaceToPay PSE processor',
            },
            {
              action: 'setup.order.createOrder',
              params: {
                country: 'CO',
                options: { user_email: formData.email },
              },
              stepName: 'Create CO order',
            },
            {
              action: 'checkout.openCheckout',
              params: { experienceType: 'Formularios' },
              stepName: 'Open Formularios experience',
            },
            {
              action: 'checkout.apm.placetopayPse.selectForm',
              stepName: 'Select PlaceToPay PSE payment method',
            },
            {
              action: 'checkout.apm.placetopayPse.waitUntilLoadPage',
              stepName: 'Wait until PSE form card has loaded',
            },
            {
              action: 'checkout.apm.placetopayPse.verifyFormVisualConsistency',
              params: { snapshotName: 'placetopay-pse-form-empty' },
              stepName: '[VISUAL] Verify empty PlaceToPay PSE form consistency',
            },
            {
              action: 'checkout.apm.placetopayPse.submitEmptyForm',
              stepName: 'Click Pay button with empty form',
            },
            {
              action: 'checkout.apm.placetopayPse.assertValidationErrorsVisible',
              stepName: 'Verify field validation errors are visible',
            },
            {
              action: 'checkout.apm.placetopayPse.verifyFormVisualConsistency',
              params: { snapshotName: 'placetopay-pse-form-error-visible' },
              stepName: '[VISUAL] Verify PlaceToPay PSE form with errors consistency',
            },
            {
              action: 'checkout.apm.placetopayPse.fillForm',
              params: { formData },
              stepName: 'Fill PSE form with valid test data',
            },
            {
              action: 'checkout.apm.placetopayPse.verifyFormVisualConsistency',
              params: { snapshotName: 'placetopay-pse-form-filled' },
              stepName: '[VISUAL] Verify filled PlaceToPay PSE form consistency',
            },
            {
              action: 'checkout.apm.placetopayPse.completeBankRedirect',
              params: { status: 'APPROVED', reason: '00' },
              stepName: 'Submit the PSE form and approve the transaction in PlaceToPay sandbox',
            },
            {
              action: 'checkout.apm.placetopayPse.waitUntilBankPopupClosed',
              stepName: 'Wait for the PlaceToPay sandbox popup to close',
            },
            {
              action: 'admin.orders.goToOrder',
              stepName: 'Order is validated through admin',
            },
            {
              action: 'admin.orders.assertStatus',
              params: { status: 'processed' },
              stepName: 'Order status is processed',
            },
          ],
        });
      }
    );
  }
);
