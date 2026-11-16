import { Page } from '@playwright/test';
import { Context, FrameworkPlugin } from '../interface';
import { FormsPage } from '@pages/explore/formsPage';
import { AstropayPage } from '@pages/explore/forms/astropayPage';
import { verifyIframeVisualConsistency } from '@visual/utils/visualTestingUtils';
import { commonViewportSets } from '@visual/utils/viewports';

type ViewportSetKey = keyof typeof commonViewportSets;

export interface VerifyAstropayRedirectVisualParams {
  snapshotName: string;
  viewports?: ViewportSetKey;
  maskProgressBar?: boolean;
}

export class PluginCheckoutWalletAstropay extends FrameworkPlugin {
  pluginBaseName = 'checkout.wallet.astropay';

  formsPage!: FormsPage;
  astropayPage!: AstropayPage;
  private popupPromise?: Promise<Page>;
  private popup?: Page;

  setTestContext(context: Context) {
    super.setTestContext(context);
    this.formsPage = new FormsPage(context.page);
    this.astropayPage = new AstropayPage(context.page);
    this.popupPromise = undefined;
    this.popup = undefined;
  }

  private async resolvePopup() {
    if (this.popupPromise) {
      this.popup = await this.popupPromise;
      this.popupPromise = undefined;
    }
    return this.popup;
  }

  /** @description Registers a popup listener and selects AstroPay in the Formularios payment methods list to open the redirect modal. */
  async $tf_selectAstropayAndCapturePopup() {
    this.popupPromise = this.context.page.waitForEvent('popup', { timeout: 60_000 });
    this.popupPromise.catch(() => {});
    await this.formsPage.selectProcessorToOpenModal('astropay');
  }

  /** @description Waits for the AstroPay external popup window to open and asserts that the processing state (pulsing dots, disabled go-to-site button, and change-method button) is visible in the checkout iframe. */
  async $tf_waitForAstropayPopupAndAssertProcessing() {
    await this.resolvePopup();
    await this.astropayPage.assertAstropayProcessingStateVisible();
  }

  /** @description Closes the external AstroPay popup window and asserts that the window-closed warning alert, progress bar, and enabled redirect controls are visible in the checkout iframe. */
  async $tf_closeAstropayPopupAndAssertWarning() {
    const popup = await this.resolvePopup();
    if (popup && !popup.isClosed()) {
      await popup.close();
    }
    this.popup = undefined;
    await this.astropayPage.assertAstropayWindowClosedStateVisible();
  }

  /** @description Closes the AstroPay popup window if it is still open during test cleanup. */
  async $tf_closeAstropayPopup() {
    if (this.popup && !this.popup.isClosed()) {
      await this.popup.close();
    }
    this.popup = undefined;
    this.popupPromise = undefined;
  }

  /** @description Clicks the "Cambiar método de pago" button in the AstroPay redirect view and asserts that the modal closes and the Formularios payment methods list is visible again. */
  async $tf_clickAstropayChangeMethodAndAssertFormList() {
    await this.astropayPage.clickAstropayChangeMethod();
    await this.astropayPage.assertIframeClosed();
    await this.formsPage.ensureVisible(this.formsPage.divAstropay, { timeout: 20_000 });
  }

  /** @description Captures a visual snapshot of the AstroPay redirect container inside the payment widget iframe across the specified viewport set, optionally masking the progress bar. */
  async $tf_verifyAstropayRedirectVisualConsistency(params: VerifyAstropayRedirectVisualParams) {
    const maskLocators = params.maskProgressBar
      ? [this.astropayPage.iframeLocator(this.astropayPage.progressBar)]
      : undefined;

    await verifyIframeVisualConsistency({
      frameLocator: this.astropayPage.iframePaymentWidget,
      targetLocator: this.astropayPage.iframeLocator(this.astropayPage.redirectContainer),
      viewports: commonViewportSets[params.viewports ?? 'desktopOnly'],
      snapshotName: params.snapshotName,
      ...(maskLocators ? { options: { maskLocators } } : {}),
    });
  }
}
