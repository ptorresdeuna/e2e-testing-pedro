import { expect, Locator, Page } from '@playwright/test';
import { LanguageCodes } from '@support/interfaces/languageCodeTypes';
import { getTranslations } from '@support/translations/getTranslations';
import { AstropayTranslations } from '@support/translations/selectors/explore/astropay/astropayTranslations';
import { CheckoutTranslations } from '@support/translations/selectors/checkout/checkoutTranslations';
import { FormHelpers } from './formHelpers';

export class AstropayPage extends FormHelpers {
  page: Page;
  readonly checkoutSelectors: CheckoutTranslations;
  readonly selectors: AstropayTranslations;

  readonly labelProcessingPayment: Locator;
  readonly buttonBack: Locator;
  readonly labelSummary: Locator;
  readonly labelSummarySubtitle: Locator;
  readonly buttonAstropay: Locator;

  readonly buttonGoToSite: Locator;
  readonly buttonChangeMethod: Locator;
  readonly labelWindowClosedWarning: Locator;
  readonly pulsingDots: Locator;
  readonly progressBar: Locator;
  readonly redirectContainer: Locator;

  constructor(page: Page, languageCode: LanguageCodes = 'ES') {
    super(page);

    this.page = page;
    this.checkoutSelectors = getTranslations('checkout', languageCode);
    this.selectors = getTranslations('explore/astropay', languageCode);

    this.labelProcessingPayment = page.getByText(
      this.checkoutSelectors.apmRedirectView.labelProcessingPayment
    );
    this.buttonGoToSite = page.getByTestId('go_to_site-button');
    this.buttonChangeMethod = page.getByTestId('changeMethod-button');
    this.labelWindowClosedWarning = page.getByText(
      this.checkoutSelectors.apmRedirectView.windowClosedWithoutAction
    );
    this.pulsingDots = page.getByTestId('declarative-apm-redirect-pulsing-dots');
    this.progressBar = page.getByTestId('progress-bar-base');
    this.redirectContainer = page.getByTestId('declarative-apm-redirect-view');

    const s = this.selectors.screenAstropayCheckout;

    this.buttonBack = page.getByText(s.buttonBack);
    this.labelSummary = page.getByText(s.labelSummary, { exact: true });
    this.labelSummarySubtitle = page.getByText(s.labelSummarySubtitle);
    this.buttonAstropay = page.getByRole('button').filter({ hasText: s.buttonAstropay });
  }

  async assertLabelProcessingPaymentVisible() {
    await this.ensureVisible(this.iframeLocator(this.labelProcessingPayment), { timeout: 40_000 });
  }

  async assertAstropayProcessingStateVisible() {
    await this.ensureVisible(this.iframeLocator(this.redirectContainer), { timeout: 40_000 });
    await this.assertLabelProcessingPaymentVisible();
    await this.ensureVisible(this.iframeLocator(this.pulsingDots), { timeout: 20_000 });
    await this.ensureVisible(this.iframeLocator(this.buttonGoToSite), { timeout: 20_000 });
    await expect(this.iframeLocator(this.buttonGoToSite)).toBeDisabled();
    await this.ensureVisible(this.iframeLocator(this.buttonChangeMethod), { timeout: 20_000 });
  }

  async assertAstropayWindowClosedStateVisible() {
    await this.ensureVisible(this.iframeLocator(this.labelWindowClosedWarning), {
      timeout: 20_000,
    });
    await this.ensureVisible(this.iframeLocator(this.progressBar), { timeout: 20_000 });
    await this.ensureVisible(this.iframeLocator(this.buttonGoToSite), { timeout: 20_000 });
    await expect(this.iframeLocator(this.buttonGoToSite)).toBeEnabled();
    await this.ensureVisible(this.iframeLocator(this.buttonChangeMethod), { timeout: 20_000 });
  }

  async clickAstropayChangeMethod() {
    await this.ensureVisibleToClick(this.iframeLocator(this.buttonChangeMethod));
  }

  async clickOnAstropay() {
    await this.ensureVisibleToClick(this.buttonAstropay);
  }

  async assertCheckoutVisible() {
    await this.ensureVisible(this.labelSummary, { timeout: 20_000 });
    await this.ensureVisible(this.buttonAstropay, { timeout: 20_000 });
  }
}
