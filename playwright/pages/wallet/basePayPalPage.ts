import { Locator, Page } from '@deuna/test';
import { CommonsActions } from '@pages/commonActions';

export abstract class BasePayPalPage extends CommonsActions {
  readonly page: Page;

  readonly inputEmail: Locator;
  readonly inputPassword: Locator;
  readonly buttonNext: Locator;
  readonly buttonLogin: Locator;
  readonly buttonPaymentSubmit: Locator;

  constructor(page: Page) {
    super(page);
    this.page = page;

    this.inputEmail = this.page.locator('#email');
    // The new /pay app keeps a hidden #password (aria-hidden) mounted during the email step and
    // swaps in the real, empty one after "Next": a fill on the hidden one is lost (ENTP1-T2564).
    this.inputPassword = this.page.locator('#password:not([aria-hidden="true"])');
    // PayPal serves either the classic login (#btnNext/#btnLogin) or the new /pay app.
    this.buttonNext = this.page
      .locator('button[data-atomic-wait-task="login_enter_email"]')
      .or(this.page.locator('#btnNext'));
    this.buttonLogin = this.page
      .locator('button[data-atomic-wait-task="login_with_password"]')
      .or(this.page.locator('#btnLogin'));
    this.buttonPaymentSubmit = this.page
      .locator('#one-time-cta')
      .or(this.page.getByTestId('submit-button-initial'))
      .first();
  }

  get buttonContinue(): Locator {
    return this.buttonNext;
  }

  get buttonPay(): Locator {
    return this.buttonPaymentSubmit;
  }

  async insertEmail(email: string) {
    await this.ensureVisible(this.inputEmail, {});
    await this.inputEmail.fill(email);
  }

  async insertPassword(password: string) {
    await this.ensureVisible(this.inputPassword, {});
    await this.inputPassword.fill(password);
  }

  async clickOnPaymentButton() {
    await this.ensureVisibleToClick(this.buttonPaymentSubmit);
  }
}
