import { FrameLocator, Locator, Page, expect } from '@playwright/test';
import { LanguageCodes } from '@support/interfaces/languageCodeTypes';
import { waitForPurchaseResponse } from '@support/utils/purchase';
import { getTranslations } from '@support/translations/getTranslations';
import { DeunanowTranslations } from '@support/translations/selectors/deunanow/deunanowTranslations';

export class PostTransactionPage {
  readonly page: Page;
  readonly iframeZoidVisible: FrameLocator;
  readonly labelMessageTransactionSuccess: Locator;
  readonly labelMessageWrongAddressError: Locator;
  readonly labelPaymentRejectedTitle: Locator;
  responsePromise: any;
  responsePromiseRegister: any;
  deunanowSelectors: DeunanowTranslations;

  constructor(page: Page, languageCode: LanguageCodes = 'ES') {
    this.page = page;
    this.deunanowSelectors = getTranslations('deunanow', languageCode);
    this.iframeZoidVisible = page.frameLocator('iframe.zoid-visible');
    this.labelMessageTransactionSuccess = this.iframeZoidVisible.locator(
      'h2:has-text("¡Gracias por elegirnos!")'
    );
    this.labelMessageWrongAddressError = this.iframeZoidVisible.locator(
      'p.di.bz.do.dp.dk.dq.dr.h0'
    );
    this.labelPaymentRejectedTitle = this.page.getByRole('heading', {
      name: this.deunanowSelectors.screenTransactionViewResult.labelDeniedTitle,
    });
    this.responsePromise = waitForPurchaseResponse(this.page, { timeout: 280000 });
    // Callers that don't care about the purchase response (e.g. assertPaymentRejected,
    // where no purchase ever succeeds) never await this. Without a handler attached, the
    // 280s timeout rejects after the test/page has already closed, surfacing as an
    // unrelated "Test ended" failure. This no-op catch only silences that unhandled
    // rejection — it doesn't affect callers that do await/chain off responsePromise.
    this.responsePromise.catch(() => {});
  }

  async getPostTransactionSuccessMessage() {
    const successMessagePostTransaction = await this.labelMessageTransactionSuccess.textContent();
    return successMessagePostTransaction;
  }

  async getPostTransactionWrongAddressErrorMessage() {
    await this.page.waitForTimeout(2000);
    const successMessagePostTransaction = await this.labelMessageWrongAddressError.textContent();
    return successMessagePostTransaction;
  }

  //Assertions
  async assertPostTransactionSuccessMessage() {
    let element = await this.labelMessageTransactionSuccess;
    await expect(element).toHaveText('¡Gracias por elegirnos!', { timeout: 70000 });
  }

  async assertOrderProcessedWithMessage(message: string) {
    await expect(this.iframeZoidVisible.getByText(message)).toBeVisible({ timeout: 70000 });
  }

  async assertPostTransactionWrongAddressError() {
    const successMsg = await this.getPostTransactionWrongAddressErrorMessage();
    expect(successMsg).toBe(this.deunanowSelectors.screenAlertNotifications.purchaseError);
  }

  async assertPaymentRejected() {
    await expect(this.labelPaymentRejectedTitle).toBeVisible({ timeout: 30000 });
  }
}
