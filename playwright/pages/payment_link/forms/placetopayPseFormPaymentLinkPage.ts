import { expect, Locator, Page } from '@playwright/test';
import { CommonsActions } from '@pages/commonActions';

export interface PlacetopayPseFormData {
  email: string;
  bankName: string;
  personType: 'Natural' | 'Juridica';
  holderName: string;
  documentNumber: string;
  phone: string;
  address: string;
}

// Payment Link renders the declarative-apm/sub-form engine directly on the
// page (no iframe) -- same field ids/testids as the Formularios embed
// (sub-form's createFormInstance.js assigns `id = fieldConfig.id || fieldConfig.name`
// regardless of rendering context), see placetopayPseFormPage.ts for the
// Formularios/iframe counterpart.
export class PlacetopayPseFormPaymentLinkPage extends CommonsActions {
  readonly page: Page;
  readonly buttonSubmit: Locator;
  readonly inputEmail: Locator;
  readonly dropdownFinancialInstitution: Locator;
  readonly dropdownPersonType: Locator;
  readonly inputHolderName: Locator;
  readonly inputUserDocument: Locator;
  readonly inputPhoneNumber: Locator;
  readonly inputAddress: Locator;
  readonly textValidationError: Locator;

  constructor(page: Page) {
    super(page);

    this.page = page;
    this.buttonSubmit = page.locator('button:has-text("Pagar")');
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
    this.textValidationError = page
      .locator('p[role="alert"], [data-testid$="-error-icon"], [id$="-error"]')
      .first();
  }

  async selectFinancialInstitution(bankName: string) {
    await this.dropdownFinancialInstitution.click();
    await this.page.locator(`text="${bankName}"`).click();
  }

  async selectPersonType(personType: 'Natural' | 'Juridica') {
    await this.dropdownPersonType.click();
    await this.page.locator(`text="${personType}"`).click();
  }

  async fillForm(formData: PlacetopayPseFormData) {
    await this.inputEmail.fill(formData.email);
    await this.selectFinancialInstitution(formData.bankName);
    await this.selectPersonType(formData.personType);
    await this.inputHolderName.fill(formData.holderName);
    await this.inputUserDocument.fill(formData.documentNumber);
    await this.inputPhoneNumber.fill(formData.phone);
    await this.inputAddress.fill(formData.address);
  }

  async submitEmptyForm() {
    await this.ensureVisibleToClick(this.buttonSubmit);
  }

  async assertValidationErrorsVisible() {
    await expect(this.textValidationError).toBeVisible();
  }

  async submit() {
    await this.ensureVisibleToClick(this.buttonSubmit);
  }

  /**
   * Submits the form and completes PlaceToPay's sandbox popup (same sandbox
   * as the Formularios flow -- see placetopayPseFormPage.ts). Returns the
   * popup so the caller can wait for it to close.
   */
  /**
   * Registers the popup's close listener before clicking "Procesar
   * transacción" — that click is what closes it, so the listener must be
   * armed first or it can miss an event that already happened (see
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
}
