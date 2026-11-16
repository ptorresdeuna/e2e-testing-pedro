import { expect, FrameLocator, Locator, Page } from '@playwright/test';

/**
 * "¿La vista no cargó?" fallback that APMEmbedded (modular-checkout, @deuna/views) shows above
 * the embedded 3DS challenge when the challenge iframe has not fired `load` after a grace period
 * and the payment is still pre-auth. `root` is whatever holds the challenge iframe: the zoid
 * iframe for the Payment Widget, the page itself for the Payment Link. `challengeIframe` is that
 * apm-redirect-iframe, taken from the page class that already declares it.
 */
export class APMFallbackPage {
  readonly challengeIframe: Locator;
  readonly panel: Locator;
  readonly panelToggle: Locator;
  readonly alertLoadMayTakeSeconds: Locator;
  readonly buttonReloadView: Locator;
  readonly buttonChangeMethod: Locator;
  readonly modalChangeMethod: Locator;
  readonly buttonModalBack: Locator;
  readonly buttonModalConfirm: Locator;

  constructor(root: Page | FrameLocator, challengeIframe: Locator) {
    this.challengeIframe = challengeIframe;
    this.panel = root.getByTestId('apm_fallback_panel');
    // TODO: Add data-testid in the UI and migrate this selector
    this.panelToggle = root.getByRole('button', { name: '¿La vista no cargó?' });
    // Scoped to the panel: alert-description is the design-system Alert's generic testid.
    this.alertLoadMayTakeSeconds = this.panel.getByTestId('alert-description');
    this.buttonReloadView = root.getByTestId('redirect_to_site');
    this.buttonChangeMethod = root.getByTestId('change_payment_method');
    // TODO: Add data-testid in the UI and migrate this selector
    this.modalChangeMethod = root
      .getByRole('dialog')
      .filter({ hasText: '¿Quieres elegir otro método de pago?' });
    // TODO: Add data-testid in the UI and migrate this selector
    this.buttonModalBack = this.modalChangeMethod.getByRole('button', {
      name: 'Volver',
      exact: true,
    });
    // TODO: Add data-testid in the UI and migrate this selector
    this.buttonModalConfirm = this.modalChangeMethod.getByRole('button', {
      name: 'Cambiar método',
      exact: true,
    });
  }

  async assertFallbackCollapsed() {
    await expect(
      this.panel,
      'The 3DS fallback should appear when the challenge iframe does not load'
    ).toBeVisible({ timeout: 20_000 });
    await expect(this.buttonChangeMethod, 'The fallback should start collapsed').toBeHidden();
  }

  async expandFallback() {
    await this.panelToggle.click();
    await expect(this.alertLoadMayTakeSeconds).toBeVisible();
    await expect(this.buttonChangeMethod).toBeVisible();
    const challengeUrl = await this.challengeIframe.getAttribute('src');
    expect(challengeUrl, 'The challenge iframe should have a src').toBeTruthy();
    await expect(
      this.buttonReloadView,
      '"Recargar vista" should link to the same challenge the iframe failed to load'
    ).toHaveAttribute('href', challengeUrl as string);
  }

  async openChangeMethodModal() {
    await this.buttonChangeMethod.click();
    await expect(this.modalChangeMethod).toBeVisible();
    await expect(this.buttonModalBack).toBeVisible();
    await expect(this.buttonModalConfirm).toBeVisible();
  }

  async dismissChangeMethodModal() {
    await this.buttonModalBack.click();
    await expect(this.modalChangeMethod).toBeHidden();
    await expect(this.panel, '"Volver" should keep the shopper on the challenge').toBeVisible();
  }

  async confirmChangeMethod() {
    await this.buttonModalConfirm.click();
    await expect(this.modalChangeMethod).toBeHidden();
    await expect(this.challengeIframe, '"Cambiar método" should leave the challenge').toBeHidden();
  }
}
