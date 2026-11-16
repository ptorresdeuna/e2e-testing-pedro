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
  '@regression PlaceToPay PSE - Formularios - Payment Rejected',
  { tag: ['@forms', '@pse', '@team_enterprise'] },
  () => {
    test(
      '@ENTP1-T2680 PlaceToPay PSE: validación de pago rechazado en Formularios',
      { tag: ['@service_apm'] },
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
              action: 'checkout.apm.placetopayPse.fillForm',
              params: { formData },
              stepName: 'Fill PSE form with valid test data',
            },
            {
              action: 'checkout.apm.placetopayPse.completeBankRedirect',
              params: { status: 'REJECTED', reason: '?C' },
              stepName:
                'Submit the PSE form and reject the transaction (CANCELLED_TRANSACTION) in PlaceToPay sandbox',
            },
            {
              action: 'checkout.postTransaction.assertPaymentRejected',
              stepName: 'Verify the "Pago rechazado" result screen is visible',
            },
          ],
        });
      }
    );
  }
);
