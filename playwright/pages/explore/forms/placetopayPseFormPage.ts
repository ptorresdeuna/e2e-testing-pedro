import { expect, Locator, Page } from '@playwright/test';
import { FormHelpers } from './formHelpers';

export interface PlacetopayPseFormData {
  email: string;
  bankName: string;
  personType: 'Natural' | 'Juridica';
  holderName: string;
  documentNumber: string;
  phone: string;
  address: string;
}

// #payment_method_placetopay_pse follows the established naming convention
// (see bizumPushFormPage.ts / oxxopayFormPage.ts: #payment_method_<processor_name>).
// Field ids below come from the declarative-apm engine's generic id assignment
// (modular-checkout: sub-form's createFormInstance.js — `id = fieldConfig.id || fieldConfig.name`,
// no override set in placetopay_pse.json's field componentProps), mirrored against the
// equivalent fields already proven in payuPseFormPage.ts (same checkout-core sub-form
// components, same `dropdown-input-<id>` / `<id>-value-input` testid conventions).
export class PlacetopayPseFormPage extends FormHelpers {
  readonly page: Page;
  readonly optionFormPlacetopayPse: Locator;
  readonly sectionPlacetopayPse: Locator;
  readonly buttonEmbedDesktop: Locator;
  readonly textFormTitle: Locator;
  readonly buttonSubmit: Locator;
  readonly inputEmail: Locator;
  readonly dropdownFinancialInstitution: Locator;
  readonly dropdownPersonType: Locator;
  readonly inputHolderName: Locator;
  readonly inputUserDocument: Locator;
  readonly inputPhoneNumber: Locator;
  readonly inputAddress: Locator;
  readonly textValidationError: Locator;
  readonly textRedirectTitle: Locator;
  readonly buttonChangePaymentMethod: Locator;
  readonly labelSuccessfulOrderTitle: Locator;

  constructor(page: Page) {
    super(page);

    this.page = page;
    this.optionFormPlacetopayPse = page.locator('#payment_method_placetopay_pse');
    this.sectionPlacetopayPse = page.locator('section', {
      has: this.optionFormPlacetopayPse,
    });
    // NOTE: fintocFormPage.ts/bizumPushFormPage.ts use getByTestId('pay-button-desktop')
    // for this same "Embedir Pago" step, but that testid actually belongs to the
    // "Pagar" button (embed=false/undefined — opens a Zoid popup, not inline target
    // mode). "Embedir Pago" itself is 'embed-button-desktop' (explore-deuna:
    // src/pages/checkout/index.tsx — handlePayButton(true) / dataTestId="embed-button-desktop").
    // PSE needs the inline embed (mode: 'target') so its own form fields render,
    // not a bare popup, so this uses the correct testid directly.
    this.buttonEmbedDesktop = page.getByTestId('embed-button-desktop');
    this.textFormTitle = this.iframePaymentWidget.getByText('Paga con PSE');
    this.buttonSubmit = page.locator('#payment-button').or(page.getByTestId('pay-button'));
    this.inputEmail = page
      .locator('input[id="email"]')
      .or(page.locator('[data-testid="email-value-input"]'));
    this.dropdownFinancialInstitution = page.locator(
      '[data-testid="dropdown-input-financialInstitution"]'
    );
    this.dropdownPersonType = page.locator('[data-testid="dropdown-input-personType"]');
    this.inputHolderName = page
      .locator('input[id="holderName"]')
      .or(page.locator('[data-testid="holderName-value-input"]'));
    this.inputUserDocument = page
      .locator('[data-testid="userDocumentId-value-input"]')
      .or(page.locator('input[id="userDocumentId-input"]'));
    this.inputPhoneNumber = page
      .locator('[data-testid="phone-value-input"]')
      .or(page.locator('input[id="phone-value-input"]'));
    this.inputAddress = page
      .locator('input[id="address"]')
      .or(page.locator('[data-testid="address-value-input"]'));
    // Same robust pattern proven in addiReferencePayModalPage.ts — matches the
    // sub-form library's error caption/icon markup directly instead of the
    // literal translated text, which can vary across fields/locales.
    this.textValidationError = page
      .locator('p[role="alert"], [data-testid$="-error-icon"], [id$="-error"]')
      .first();
    // From placetopay_pse.json's own translations: apm.redirect.title.
    this.textRedirectTitle = this.iframePaymentWidget.getByText('Procesando tu pago con PSE');
    this.buttonChangePaymentMethod = this.iframePaymentWidget.getByTestId('changeMethod-button');
    this.labelSuccessfulOrderTitle = page.locator('#successful_order_text h1');
  }

  async selectForm(mode: 'embed' | 'modal' = 'embed') {
    await this.ensureVisibleToClick(this.optionFormPlacetopayPse);
    // Selecting a card updates cartState.paymentMethod asynchronously (React
    // re-render) — clicking "Embedir Pago" right after the raw click can fire
    // handlePayButton while cartState.paymentMethod is still the previous
    // selection (e.g. credit_card), silently no-op'ing since no order/purchase
    // call ever fires for the stale method. Wait for the card's own selected
    // background (confirmed visually: rgb(244, 244, 244)) before proceeding.
    await expect(this.sectionPlacetopayPse).toHaveCSS('background-color', 'rgb(244, 244, 244)');
    await this.page.evaluate(() => window.scrollTo(0, 0));
    if (mode === 'modal') {
      await this.ensureVisibleToClick(this.page.getByTestId('pay-button-desktop'));
    } else {
      await this.ensureVisibleToClick(this.buttonEmbedDesktop);
      await this.scrollToForm();
    }
  }

  async selectPaymentMethod() {
    const pseOption = this.iframePaymentWidget
      .locator('p:has-text("PSE")')
      .or(this.iframePaymentWidget.getByText('PSE', { exact: true }));
    if (await pseOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pseOption.click();
    }
  }

  async waitUntilLoadPage() {
    await expect(this.textFormTitle).toBeVisible({ timeout: 15000 });
  }

  /** Scrolls the embedded #payment-embed container into view, same as Addi's scrollToEmbedContainer. */
  async scrollToForm() {
    await this.scrollIntoPaymentEmbedIframe();
  }

  async selectFinancialInstitution(bankName: string) {
    await this.iframeLocator(this.dropdownFinancialInstitution).click();
    await this.iframeLocator(this.page.locator(`text="${bankName}"`)).click();
  }

  async selectPersonType(personType: 'Natural' | 'Juridica') {
    await this.iframeLocator(this.dropdownPersonType).click();
    await this.iframeLocator(this.page.locator(`text="${personType}"`)).click();
  }

  async fillForm(formData: PlacetopayPseFormData) {
    if (formData.email) {
      await this.iframeLocator(this.inputEmail).fill(formData.email);
    }
    await this.selectFinancialInstitution(formData.bankName);
    await this.selectPersonType(formData.personType);
    await this.iframeLocator(this.inputHolderName).fill(formData.holderName);
    await this.iframeLocator(this.inputUserDocument).fill(formData.documentNumber);
    await this.iframeLocator(this.inputPhoneNumber).fill(formData.phone);
    await this.iframeLocator(this.inputAddress).fill(formData.address);
  }

  async submitEmptyForm() {
    await this.ensureVisibleToClick(this.iframeLocator(this.buttonSubmit));
  }

  async assertValidationErrorsVisible() {
    await expect(this.iframeLocator(this.textValidationError)).toBeVisible();
  }

  async submit() {
    await this.ensureVisibleToClick(this.iframeLocator(this.buttonSubmit));
  }

  /** Waits for the redirect/waiting-for-bank-confirmation view to render after submit. */
  async waitUntilRedirectViewVisible() {
    await expect(this.textRedirectTitle).toBeVisible({ timeout: 30000 });
  }

  /**
   * Clicks the Pay button (opens PlaceToPay's real sandbox in a new window —
   * a true window.open popup, not an element inside our own page) and
   * completes the sandbox's own test-transaction form there: select the
   * desired outcome (status + reason) and submit. Returns the popup page plus
   * a `closePromise` already armed before the "Procesar transacción" click —
   * that click is what closes the popup for a terminal status, so the close
   * listener must be registered before it fires, not after: attaching it in a
   * later step risks missing an event that already happened (see
   * docs/flaky-test-patterns.md #1).
   */
  async payAndCompleteBankRedirect(
    status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'FAILED',
    reason: string
  ) {
    const popupPromise = this.page.context().waitForEvent('page');
    await this.submit();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');

    await popup.locator('#status').selectOption(status);
    await popup.locator('#reason').selectOption(reason);

    const closePromise = popup.waitForEvent('close', { timeout: 30000 });
    await popup.getByRole('button', { name: 'Procesar transacción' }).click();

    return { popup, closePromise };
  }

  async clickChangePaymentMethod() {
    await this.ensureVisibleToClick(this.buttonChangePaymentMethod);
  }

  async assertPaymentSuccessful() {
    await expect(
      this.labelSuccessfulOrderTitle,
      'Explore thank-you page "Pago completado" was not visible'
    ).toHaveText('Pago completado', { timeout: 45000 });
  }
}
