import { expect, Locator, Page } from '@deuna/test';
import { BasePayPalPage } from '@pages/wallet/basePayPalPage';

export class PaypalPayLaterPage extends BasePayPalPage {
  readonly buttonCard: Locator;

  constructor(page: Page) {
    super(page);

    this.buttonCard = this.page
      .getByTestId('first-fis')
      .locator(':scope > *')
      .or(this.page.locator('[data-testid^="row-"]'))
      .first();
  }

  async login() {
    const email = 'sb-yex4j49919156@personal.example.com';
    const password = '6vg?AQ:1';

    await this.inputEmail.fill(email);
    await this.ensureVisibleToClick(this.buttonNext);
    await expect(this.buttonNext).toBeHidden({ timeout: 20000 });

    const postLoginTarget = this.buttonPay.or(this.buttonCard).first();

    await expect(async () => {
      if (await this.inputPassword.isVisible()) {
        await this.inputPassword.click();
        await this.inputPassword.fill('');
        await this.inputPassword.pressSequentially(password, { delay: 50 });
        await expect(this.inputPassword).toHaveValue(password);
        await this.buttonLogin.click();
      }
      await expect(postLoginTarget).toBeVisible({ timeout: 15000 });
    }).toPass({ intervals: [2000, 3000], timeout: 45000 });
  }

  async selectCard() {
    await this.ensureVisibleToClick(this.buttonCard);
  }

  async pay() {
    await this.clickOnPaymentButton();
  }
}
