import { expect, Page, Locator } from '@playwright/test';
import { CommonsActions } from '@pages/commonActions';
import { LanguageCodes } from '@support/interfaces/languageCodeTypes';
import { getTranslations } from '@support/translations/getTranslations';
import { AddiTranslations } from '@support/translations/selectors/explore/addi/addiTranslation';

export enum AddiRedirectPageFlow {
  error,
  decline,
  approve,
}

export class AddiRedirectPage extends CommonsActions {
  readonly page: Page;
  popupClosed: Promise<unknown>;

  // Locators como propiedades de la clase
  private labelAddiTitle: Locator;
  private pseButtonLocator: Locator;
  private paymentFormLocator: Locator;
  private bankSelectorLocator: Locator;
  private inputNameLocator: Locator;
  private inputIdsNumberLocator: Locator;
  private inputEmailLocator: Locator;
  private payButtonLocator: Locator;
  private cancelButtonLocator: Locator;
  private exitButtonLocator: Locator;
  private buttonApproveBankLocator: Locator;
  private buttonDeclineBankLocator: Locator;
  private buttonErrorBankLocator: Locator;
  private continueBtn: Locator;
  private consentCheckboxes: Locator;

  private selectors: AddiTranslations;

  constructor(page: Page, languageCode: LanguageCodes = 'ES') {
    super(page);
    this.page = page;
    this.selectors = getTranslations('explore/addi', languageCode);

    // Inicialización de locators
    this.labelAddiTitle = this.page.locator(
      `h1:has-text("${this.selectors.screenAddiForm.labelEnterYourData}")`
    );

    this.pseButtonLocator = this.page.locator(
      `text=${this.selectors.screenAddiForm.buttonDebitWithPSE}`
    );
    this.paymentFormLocator = this.page.locator('#pse-payment-form');
    this.bankSelectorLocator = this.page.locator('#bank-selector');
    this.inputNameLocator = this.page.locator(
      `input[placeholder="${this.selectors.screenAddiForm.placeholderFullName}"]`
    );
    this.inputIdsNumberLocator = this.page.locator('#ids-number input').nth(0);
    this.inputEmailLocator = this.page.locator(
      `input[placeholder="${this.selectors.screenAddiForm.placeholderEmail}"]`
    );
    this.payButtonLocator = this.page.getByRole('button', {
      name: this.selectors.screenAddiForm.buttonPayWithPSE,
    });
    this.cancelButtonLocator = this.page.locator('button i[name="e90b"]');
    this.exitButtonLocator = this.page.getByRole('button', {
      name: this.selectors.screenAddiForm.buttonExit,
    });
    this.buttonApproveBankLocator = this.page.getByText(/Banco que aprueba/i);
    this.buttonDeclineBankLocator = this.page.getByText(/Banco que declina/i);
    this.buttonErrorBankLocator = this.page.getByText(/Banco que simula un error/i);
    this.popupClosed = new Promise((resolve) => {
      this.page.on('close', resolve);
    });
    this.continueBtn = this.page.getByRole('button', { name: /continuar/i });
    this.consentCheckboxes = this.page.getByRole('checkbox', {
      name: /autorizo el tratamiento/i,
    });
  }

  async assertAddiPage() {
    // Wait for the external page to fully load
    await this.page.waitForLoadState('domcontentloaded');
    await this.failIfAddiAnsweredServerError();
    await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    await expect(this.labelAddiTitle, 'Addi landing page is not visible')
      .toBeVisible({ timeout: 60000 })
      .catch(async (error: Error) => {
        await this.failIfAddiAnsweredServerError();
        throw error;
      });
  }

  /**
   * Addi's sandbox sometimes answers its own login (`login.addi-staging.com/token`) with a 500
   * from Cloudflare in ~200 ms, right after DEUNA handed the shopper over: the popup never shows
   * the landing page (runs 40628483686, ENTP1-T2066/T2067/T2068/T2070/T2478). Name that failure
   * as Addi's instead of reporting a missing title 60 s later. The query string is left out of
   * the message: it carries Addi's access_token.
   */
  private async failIfAddiAnsweredServerError() {
    for (const request of await this.page.requests()) {
      const url = new URL(request.url());
      if (
        request.resourceType() !== 'document' ||
        !/(^|\.)addi(-staging)?\.com$/.test(url.hostname)
      ) {
        continue;
      }
      const response = await request.response();
      if (response && response.status() >= 500) {
        const cfRay = response.headers()['cf-ray'] ?? 'none';
        throw new Error(
          `[ADDI EXTERNAL ERROR] Addi answered HTTP ${response.status()} on ` +
            `${url.origin}${url.pathname} (CF-RAY ${cfRay}) before showing its landing page. ` +
            'The popup already reached Addi, so DEUNA handed the shopper over: the failure is ' +
            "inside Addi's sandbox."
        );
      }
    }
  }

  private async continueAfterConsent() {
    // The identity step is not always shown: wait up to 5s for it, then skip when it is absent.
    const identityStepShown = await this.continueBtn.waitFor({ timeout: 5000 }).then(
      () => true,
      () => false
    );
    if (!identityStepShown) {
      return;
    }

    for (const consentCheckbox of await this.consentCheckboxes.all()) {
      await consentCheckbox.check();
    }
    await expect(
      this.continueBtn,
      'Addi: Continuar sigue deshabilitado tras aceptar los consentimientos'
    ).toBeEnabled();
    await this.continueBtn.click();
  }

  async selectDebitWithPSE() {
    if (this.page.isClosed()) {
      throw new Error('Popup page was closed unexpectedly');
    }

    await this.page.waitForLoadState('domcontentloaded');
    await this.continueAfterConsent();

    await expect(this.pseButtonLocator).toBeVisible({ timeout: 120000 });
    await this.pseButtonLocator.click();
  }

  async assertPaymentFormMustBeVisible() {
    await expect(this.paymentFormLocator, 'AddiChallenge: Payment form is not visible').toBeVisible(
      { timeout: 50000 }
    );
  }

  async waitForClose(timeout = 60_000) {
    await Promise.race([
      this.popupClosed,
      this.page.waitForTimeout(timeout).then(() => {
        if (!this.page.isClosed()) {
          throw new Error(`Popup did not close within ${timeout}ms`);
        }
      }),
    ]);
  }

  async selectApproveBank() {
    await this.bankSelectorLocator.click();
    await this.buttonApproveBankLocator.click();
  }

  async selectDeclineBank() {
    await this.bankSelectorLocator.click();
    await this.buttonDeclineBankLocator.click();
  }

  async selectErrorBank() {
    await this.bankSelectorLocator.click();
    await this.buttonErrorBankLocator.click();
  }

  async fillUserData() {
    await this.inputNameLocator.fill('John Doe');
    await this.inputIdsNumberLocator.fill('3211234567');
    await this.inputEmailLocator.fill('test@test.com');
  }

  async sendPayment() {
    await this.payButtonLocator.click();
  }

  async cancelPurchase() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.continueAfterConsent();
    await this.cancelButtonLocator.click();
    await this.exitButtonLocator.click();
  }
}
