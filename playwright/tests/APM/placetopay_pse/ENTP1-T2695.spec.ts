import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import { placetopayPseProcessor } from '@support/interfaces/payment_processors';
import { PlacetopayPseFormData } from '@pages/explore/forms/placetopayPseFormPage';

const userEmail = 'dmorocho@deuna.com';

const formData: PlacetopayPseFormData = {
  email: userEmail,
  bankName: 'BANCO AV VILLAS',
  personType: 'Natural',
  holderName: 'App App',
  documentNumber: '1234567890',
  phone: '3222222222',
  address: 'Calle 123 #45-67',
};

test.describe(
  '@regression PlaceToPay PSE - Payment Widget - Retry Pending Payment',
  { tag: ['@payment_widget', '@pse', '@team_enterprise'] },
  () => {
    test(
      '@ENTP1-T2695 PlaceToPay PSE: Reintento de pago pendiente en Payment Widget exitoso',
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
                options: { user_email: userEmail },
              },
              stepName: 'Create CO order with clean email',
            },
            {
              action: 'checkout.openCheckout',
              params: { experienceType: 'Payment Widget' },
              stepName: 'Open Payment Widget experience',
            },
            {
              action: 'checkout.apm.placetopayPse.selectPaymentMethod',
              stepName: 'Select PlaceToPay PSE payment method if list shown',
            },
            {
              action: 'checkout.apm.placetopayPse.waitUntilLoadPage',
              stepName: 'Wait until PSE form has loaded',
            },
            {
              action: 'checkout.apm.placetopayPse.fillForm',
              params: { formData },
              stepName: 'Fill PSE form with valid test data',
            },
            {
              action: 'checkout.apm.placetopayPse.completeBankRedirect',
              params: { status: 'PENDING', reason: '?-' },
              stepName:
                'Submit the PSE form and leave transaction as PENDING in PlaceToPay sandbox',
            },
            {
              action: 'checkout.apm.placetopayPse.clickChangePaymentMethod',
              stepName: 'Click on "Cambiar método de pago" button',
            },
            {
              action: 'checkout.apm.placetopayPse.completeBankRedirect',
              params: { status: 'APPROVED', reason: '00' },
              stepName:
                'Submit the PSE form again and approve the transaction in PlaceToPay sandbox',
            },
            {
              action: 'checkout.apm.placetopayPse.waitUntilBankPopupClosed',
              stepName: 'Wait for the PlaceToPay sandbox popup to close',
            },
            {
              action: 'checkout.apm.placetopayPse.assertPaymentSuccessful',
              stepName: 'Verify the "Pago completado" result screen is visible in explorer',
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
