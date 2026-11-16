import { Page } from '@playwright/test';
import { Context, FrameworkPlugin } from '../interface';
import {
  PlacetopayPseFormPage,
  PlacetopayPseFormData,
} from '@pages/explore/forms/placetopayPseFormPage';
import { verifyIframeBodyVisualConsistency } from '@visual/utils/visualTestingUtils';
import { commonViewportSets } from '@visual/utils/viewports';

type ViewportSetKey = keyof typeof commonViewportSets;

export class PluginCheckoutApmPlacetopayPse extends FrameworkPlugin {
  pluginBaseName = 'checkout.apm.placetopayPse';

  placetopayPseFormPage!: PlacetopayPseFormPage;
  private bankPopup: Page | null = null;
  private bankPopupClosePromise: Promise<unknown> | null = null;

  setTestContext(context: Context) {
    super.setTestContext(context);
    this.placetopayPseFormPage = new PlacetopayPseFormPage(context.page);
  }

  /** @description Selects the PlaceToPay PSE option in the Formularios payment methods list. Pass mode="modal" to open via the "Pagar" button instead of embedding. */
  async $tf_selectForm(params?: { mode?: 'embed' | 'modal' }) {
    await this.placetopayPseFormPage.selectForm(params?.mode ?? 'embed');
  }

  /** @description Selects the PSE payment method inside Payment Widget if payment methods list is visible. */
  async $tf_selectPaymentMethod() {
    await this.placetopayPseFormPage.selectPaymentMethod();
  }

  /** @description Waits until the PlaceToPay PSE form title is visible, indicating the Haruka card has loaded. */
  async $tf_waitUntilLoadPage() {
    await this.placetopayPseFormPage.waitUntilLoadPage();
  }

  /** @description Captures a visual snapshot of the PlaceToPay PSE form across the specified viewport set. */
  async $tf_verifyFormVisualConsistency(params: {
    snapshotName: string;
    viewports?: ViewportSetKey;
  }) {
    await verifyIframeBodyVisualConsistency({
      page: this.context.page,
      frameLocator: this.placetopayPseFormPage.iframePaymentWidget,
      snapshotName: params.snapshotName,
      viewports: commonViewportSets[params.viewports ?? 'desktopOnly'],
    });
  }

  /** @description Scrolls the embedded PSE form into view (same as Addi's scrollToEmbedContainer step). */
  async $tf_scrollToForm() {
    await this.placetopayPseFormPage.scrollToForm();
  }

  /** @description Fills the PlaceToPay PSE form with the given email, bank, person type, holder name, document, phone, and address. */
  async $tf_fillForm(params: { formData: PlacetopayPseFormData }) {
    await this.placetopayPseFormPage.fillForm(params.formData);
  }

  /** @description Clicks the Pay button with the PSE form left empty, to trigger field validation errors. */
  async $tf_submitEmptyForm() {
    await this.placetopayPseFormPage.submitEmptyForm();
  }

  /** @description Asserts that field validation error messages are visible in the PSE form. */
  async $tf_assertValidationErrorsVisible() {
    await this.placetopayPseFormPage.assertValidationErrorsVisible();
  }

  /** @description Clicks the Pay button to submit the filled PSE form, triggering the bank redirect. */
  async $tf_pay() {
    await this.placetopayPseFormPage.submit();
  }

  /** @description Waits for the redirect/waiting-for-bank-confirmation view to render after submitting the PSE form. */
  async $tf_waitUntilRedirectViewVisible() {
    await this.placetopayPseFormPage.waitUntilRedirectViewVisible();
  }

  /** @description Submits the PSE form, then in PlaceToPay's own sandbox popup selects the given status/reason and clicks "Procesar transacción". */
  async $tf_completeBankRedirect(params: {
    status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'FAILED';
    reason: string;
  }) {
    // A retry flow (e.g. ENTP1-T2695) calls this twice: once for a PENDING
    // status that doesn't close the popup, then again to approve it. Silence
    // the first call's close listener before replacing it so its eventual
    // timeout never surfaces as an unhandled rejection once nothing is
    // awaiting it anymore.
    this.bankPopupClosePromise?.catch(() => {});

    const { popup, closePromise } = await this.placetopayPseFormPage.payAndCompleteBankRedirect(
      params.status,
      params.reason
    );
    this.bankPopup = popup;
    this.bankPopupClosePromise = closePromise;
  }

  /** @description Waits for PlaceToPay's sandbox popup to close after the test transaction is processed. */
  async $tf_waitUntilBankPopupClosed() {
    if (!this.bankPopup || !this.bankPopupClosePromise) {
      throw new Error('$tf_completeBankRedirect must run before $tf_waitUntilBankPopupClosed');
    }
    await this.bankPopupClosePromise;
  }

  /** @description Clicks the "Cambiar método de pago" button in the PSE redirect view. */
  async $tf_clickChangePaymentMethod() {
    await this.placetopayPseFormPage.clickChangePaymentMethod();
    if (this.bankPopup && !this.bankPopup.isClosed()) {
      await this.bankPopup.close().catch(() => {});
      this.bankPopup = null;
      this.bankPopupClosePromise = null;
    }
  }

  /** @description Captures a visual snapshot of the PSE redirect/waiting-for-bank-confirmation view across the specified viewport set. */
  async $tf_verifyRedirectViewVisualConsistency(params: {
    snapshotName: string;
    viewports?: ViewportSetKey;
  }) {
    await verifyIframeBodyVisualConsistency({
      page: this.context.page,
      frameLocator: this.placetopayPseFormPage.iframePaymentWidget,
      snapshotName: params.snapshotName,
      viewports: commonViewportSets[params.viewports ?? 'desktopOnly'],
    });
  }

  /** @description Asserts that the explore thank-you page with "Pago completado" is visible after PlaceToPay popup closes. */
  async $tf_assertPaymentSuccessful() {
    await this.placetopayPseFormPage.assertPaymentSuccessful();
  }
}
