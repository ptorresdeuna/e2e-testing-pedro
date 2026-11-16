import { expect, Locator, Page } from '@playwright/test';
import { LanguageCodes } from '@support/interfaces/languageCodeTypes';
import { getTranslations } from '@support/translations/getTranslations';
import { RedirectToCommerceTranslations } from '@support/translations/selectors/redirect_to_commerce/redirectToCommerce';
import { BasePayPalPage } from './basePayPalPage';

export class PayPalPage extends BasePayPalPage {
  readonly inputOtp: Locator;
  readonly buttonContinueOtp: Locator;

  readonly buttonInstallment1x: Locator;
  readonly buttonConsent: Locator;
  readonly buttonBackStore: Locator;

  readonly labelRedirectToCommercePageTitle: Locator;
  readonly labelRedirectPageTitle: Locator;

  readonly redirectToCommerceTranslations: RedirectToCommerceTranslations;

  // Locators
  constructor(page: Page, languageCode: LanguageCodes = 'ES') {
    super(page);

    this.inputOtp = page.locator('#ci-otpCode-0');
    this.buttonContinueOtp = page.locator('#buttons');

    this.buttonInstallment1x = page.getByTestId('select-installments-term-1x');
    this.buttonConsent = page.locator('#consentButton');

    this.buttonBackStore = page.getByTestId('merchantCancelDiv').or(page.locator('#cancelLink'));

    this.labelRedirectToCommercePageTitle = page.locator('#redirect-to-commerce-view h1');
    this.labelRedirectPageTitle = page.locator('.main-text');

    this.redirectToCommerceTranslations = getTranslations('redirect_to_commerce', languageCode);
  }

  // Actions
  async loginCheckout(email: string, password: string) {
    await this.page.waitForTimeout(3000);

    await this.insertEmail(email);
    await this.insertPassword(password);
    await this.ensureVisibleToClick(this.buttonLogin);
  }

  async selectCheckoutInstallments() {
    await this.ensureVisibleToClick(this.buttonPaymentSubmit);
    await this.ensureVisibleToClick(this.buttonInstallment1x);
  }

  async loginVaulting(email: string, password: string) {
    await this.page.waitForTimeout(3000);

    await this.insertEmail(email);
    await this.ensureVisibleToClick(this.buttonContinue);

    await this.page.waitForTimeout(5000);

    await this.insertPassword(password);
    await this.ensureVisibleToClick(this.buttonLogin);
  }

  async insertOtp(otpCode: string = '111111') {
    await this.inputOtp.fill(otpCode);
    await this.ensureVisibleToClick(this.buttonContinueOtp);
  }

  async clickOnConsentButton() {
    await this.ensureVisibleToClick(this.buttonConsent);
  }

  async clickOnReturnToStoreButton() {
    await this.ensureVisibleToClick(this.buttonBackStore);
  }

  async closePage() {
    await this.page.close();
  }

  // Asserts
  async assertPayPalVaultingExperiencePage() {
    const url = 'https://www.sandbox.paypal.com/agreements/approve?approval_session_id=';
    expect(this.page.url()).toContain(url);
  }

  async assertPayPalCheckoutExperiencePage() {
    const url = 'https://www.sandbox.paypal.com/checkoutnow?token=';
    expect(this.page.url()).toContain(url);
  }

  async assertRedirectPage(text: string) {
    await expect(this.labelRedirectPageTitle).toHaveText(text, { timeout: 120000 });
  }
}
