import { Context, FrameworkPlugin } from '../interface';
import {
  PlacetopayPseFormPaymentLinkPage,
  PlacetopayPseFormData,
} from '@pages/payment_link/forms/placetopayPseFormPaymentLinkPage';

export class PluginCheckoutPaymentLinkApmPlacetopayPse extends FrameworkPlugin {
  pluginBaseName = 'checkout.paymentLink.apm.placetopayPse';

  placetopayPseFormPage!: PlacetopayPseFormPaymentLinkPage;

  setTestContext(context: Context) {
    super.setTestContext(context);
    this.placetopayPseFormPage = new PlacetopayPseFormPaymentLinkPage(context.page);
  }

  /** @description Fills the PlaceToPay PSE form rendered directly on the Payment Link page (no iframe) with the given email, bank, person type, holder name, document, phone, and address. */
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

  /** @description Submits the PSE form, then in PlaceToPay's own sandbox popup selects the given status/reason and clicks "Procesar transacción". */
  async $tf_completeBankRedirect(params: {
    status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'FAILED';
    reason: string;
  }) {
    const { closePromise } = await this.placetopayPseFormPage.payAndCompleteBankRedirect(
      params.status,
      params.reason
    );
    // Payment Link never waits on the popup closing, so nothing else will
    // observe this promise — silence it to avoid an unhandled rejection if it
    // times out.
    closePromise.catch(() => {});
  }
}
