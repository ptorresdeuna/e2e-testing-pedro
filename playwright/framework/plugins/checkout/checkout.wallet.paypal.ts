import { expect } from '@playwright/test';
import { Context, FrameworkPlugin } from '../interface';
import { PayPalPage } from '@pages/wallet/paypalPage';
import { PaymentPage } from '@pages/checkout/payment/paymentPage';
import { PaymentPage as PaymentLinkPage } from '@pages/payment_link/payment/paymentPage';
import { AdminOrderDetailsPage } from '@pages/admin/orders/adminOrderDetailsPage';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';
import { OrderStatusTypes } from '@support/interfaces/orderStatusTypes';
import { resolveMerchantId, resolveOrderToken } from '../../resolve';

export class PluginCheckoutWalletPaypal extends FrameworkPlugin {
  pluginBaseName = 'checkout.wallet.paypal';

  paypalPage!: PayPalPage;
  paymentPage!: PaymentPage;
  paymentLinkPage!: PaymentLinkPage;
  adminOrderDetailsPage!: AdminOrderDetailsPage;

  setTestContext(context: Context) {
    super.setTestContext(context);
    this.paypalPage = new PayPalPage(context.page);
    this.paymentPage = new PaymentPage(context.page);
    this.paymentLinkPage = new PaymentLinkPage(context.page);
    this.adminOrderDetailsPage = new AdminOrderDetailsPage(context.page);
  }

  /** @description Fills the email input on the PayPal login page. */
  async $tf_insertEmail(params: { email: string }) {
    await this.paypalPage.insertEmail(params.email);
  }

  /** @description Fills the password input on the PayPal login page. */
  async $tf_insertPassword(params: { password: string }) {
    await this.paypalPage.insertPassword(params.password);
  }

  /** @description Logs in to PayPal for a checkout flow by entering email, password, and clicking the login button. */
  async $tf_loginCheckout(params: { email: string; password: string }) {
    await this.paypalPage.loginCheckout(params.email, params.password);
  }

  /** @description Logs in to PayPal for a vaulting flow by entering email, clicking continue, then entering password. */
  async $tf_loginVaulting(params: { email: string; password: string }) {
    await this.paypalPage.loginVaulting(params.email, params.password);
  }

  /** @description Fills the OTP code field and submits it during the PayPal login verification step. */
  async $tf_insertOtp(params?: { otpCode?: string }) {
    await this.paypalPage.insertOtp(params?.otpCode);
  }

  /** @description Clicks the PayPal payment submit button to initiate the payment. */
  async $tf_clickPaymentButton() {
    await this.paypalPage.clickOnPaymentButton();
  }

  /** @description Clicks the PayPal consent button to authorize the payment. */
  async $tf_clickConsentButton() {
    await this.paypalPage.clickOnConsentButton();
  }

  /** @description Clicks the return-to-store/cancel button on the PayPal page. */
  async $tf_clickReturnToStoreButton() {
    await this.paypalPage.clickOnReturnToStoreButton();
  }

  /** @description Selects the 1x installment option in the PayPal checkout installments selector. */
  async $tf_selectCheckoutInstallments() {
    await this.paypalPage.selectCheckoutInstallments();
  }

  /** @description Closes the current PayPal page (used for popup flows). */
  async $tf_closePage() {
    await this.paypalPage.closePage();
  }

  /** @description Asserts that the current URL corresponds to the PayPal sandbox checkout experience page. */
  async $tf_assertPayPalCheckoutExperiencePage() {
    await this.paypalPage.assertPayPalCheckoutExperiencePage();
  }

  /** @description Asserts that the current URL corresponds to the PayPal sandbox vaulting/agreements experience page. */
  async $tf_assertPayPalVaultingExperiencePage() {
    await this.paypalPage.assertPayPalVaultingExperiencePage();
  }

  /** @description Asserts that the redirect page main text matches the expected string. */
  async $tf_assertRedirectPage(params: { text: string }) {
    await this.paypalPage.assertRedirectPage(params.text);
  }

  /** @description Asserts that the unified PayPal tab and the Cash tab are visible while standalone PayPal Wallet and PayPal Pay Later tabs are hidden. */
  async $tf_assertUnifiedPayPalAndCashTabsVisible() {
    await this.paymentPage.assertUnifiedPayPalTabAndCashTabVisible();
  }

  /** @description Clicks on the unified PayPal tab in the payment widget. */
  async $tf_selectUnifiedPayPalTab() {
    await this.paymentPage.clickOnPayPalUnifiedTab();
  }

  /** @description Asserts that the PayPal guest options selector (Wallet and Pay Later radio cards) and the PayPal Wallet button are visible while the SPB button is hidden. */
  async $tf_assertGuestOptionsAndWalletButtonVisible() {
    await this.paymentPage.assertPayPalGuestOptionsAndWalletButtonVisible();
  }

  /** @description Selects the PayPal Pay Later radio option inside the unified PayPal tab. */
  async $tf_selectPayLaterOptionInGroup() {
    await this.paymentPage.clickOnPayPalPayLaterOption();
  }

  /** @description Selects the PayPal Wallet radio option inside the unified PayPal tab. */
  async $tf_selectWalletOptionInGroup() {
    await this.paymentPage.clickOnPayPalWalletOption();
  }

  /** @description Asserts that the PayPal SPB button is visible and the PayPal Wallet button is hidden inside the unified PayPal tab. */
  async $tf_assertSpbButtonVisibleAndWalletButtonHidden() {
    await this.paymentPage.assertPayPalSpbButtonVisibleAndWalletButtonHidden();
  }

  /** @description Clicks the Cash tab and then clicks back on the unified PayPal tab to verify state restoration across tab switches. */
  async $tf_switchToCashAndBackToUnifiedPayPalTab() {
    await this.paymentPage.selectCashTab();
    await this.paymentPage.clickOnPayPalUnifiedTab();
  }

  /** @description Clicks the PayPal Wallet button in the payment widget and waits for the PayPal popup window to open. */
  async $tf_clickPayPalButtonAndOpenPopup() {
    const popupPromise = this.context.page.waitForEvent('popup');
    await this.paymentPage.clickOnPayPalButton();
    const popup = await popupPromise;
    this.paypalPage = new PayPalPage(popup);
  }

  /** @description Asserts that the authenticated PayPal saved account view is displayed with the preselected account, pay with another account option, Pay Later option, and standard pay button. */
  async $tf_assertAuthenticatedSavedAccountView() {
    await this.paymentPage.assertPayPalAuthenticatedSavedAccountView();
  }

  /** @description Asserts that selecting Pay Later in the authenticated unified PayPal tab displays the SPB button and the view saved accounts shortcut while hiding the standard pay button. */
  async $tf_assertAuthenticatedPayLaterSelectedView() {
    await this.paymentPage.assertPayPalAuthenticatedPayLaterSelectedView();
  }

  /** @description Clicks the pay with another account radio option in the authenticated unified PayPal tab. */
  async $tf_selectPayWithAnotherAccountInGroup() {
    await this.paymentPage.clickOnPayWithAnotherAccountPayPal();
  }

  /** @description Asserts that selecting pay with another account in the authenticated unified PayPal tab displays the PayPal Wallet button while hiding the SPB and standard pay buttons. */
  async $tf_assertAuthenticatedAnotherAccountSelectedView() {
    await this.paymentPage.assertPayPalAuthenticatedAnotherAccountSelectedView();
  }

  /** @description Clicks the view saved accounts shortcut and selects the saved PayPal account radio option, then asserts that the saved account view and standard pay button are restored. */
  async $tf_restoreSavedAccountFromViewSavedAccounts() {
    await this.paymentPage.clickOnViewSavedAccountsPayPal();
    await this.paymentPage.clickOnSavedAccountPayPal();
    await this.paymentPage.assertPayPalSavedAccountRestored();
  }

  /** @description Clicks the standard pay button to purchase with a saved PayPal account and asserts that the purchase request payload includes a valid non-empty device_id. */
  async $tf_clickPayWithSavedAccountAndAssertDeviceId() {
    const { requestPayload } = (await this.paymentPage.clickOnPay()) ?? {};
    expect(requestPayload?.device_id).toBeTruthy();
    expect(requestPayload?.device_id).not.toBe('e30=');
  }

  /** @description Asserts that the processing modal dialog displays the expected title text. */
  async $tf_assertProcessingModalTitle(params: { text: string }) {
    await this.paymentPage.assertProcessingModalWithTitle(params.text);
  }

  /** @description Asserts that the payment widget thank-you page displays the expected title text. */
  async $tf_assertWidgetThankYouPage(params: { text: string }) {
    await this.paymentLinkPage.assertThankyouPage(params.text);
  }

  /** @description Navigates to the admin order details page and asserts the payment status, PayPal processor name, and number of installments for a PayPal Wallet order. */
  async $tf_assertWalletOrderDetails(params: {
    installments: number;
    expectedStatus?: OrderStatusTypes;
    orderToken?: string;
    merchantId?: string;
  }) {
    await this.adminOrderDetailsPage.goToOrderDetails(
      resolveMerchantId(
        this.context,
        'checkout.wallet.paypal.assertWalletOrderDetails',
        params.merchantId
      ),
      resolveOrderToken(
        this.context,
        'checkout.wallet.paypal.assertWalletOrderDetails',
        params.orderToken
      )
    );
    await this.adminOrderDetailsPage.assertPaymentStatus(params.expectedStatus ?? 'processed');
    await this.adminOrderDetailsPage.assertProcessorName(ConnectionsAvailable.paypal);
    await this.adminOrderDetailsPage.assertNumberOfInstallments(params.installments);
  }
}
