import { Context, FrameworkPlugin } from '../interface';
import { PixVoucherPage } from '@pages/voucher/pixVoucherPage';
import { PaymentPage } from '@pages/checkout/payment/paymentPage';

export type PixProcessorType = 'asaas_pix' | 'nuvei_pix';

export interface SelectPixTabParams {
  processorType: PixProcessorType;
}

export class PluginCheckoutVoucherPix extends FrameworkPlugin {
  pluginBaseName = 'checkout.voucher.pix';

  pixPage!: PixVoucherPage;
  paymentPage!: PaymentPage;

  setTestContext(context: Context) {
    super.setTestContext(context);
    this.pixPage = new PixVoucherPage(context.page);
    this.paymentPage = new PaymentPage(context.page);
  }

  /** @description Selects the PIX payment tab for the given processor type ('asaas_pix' or 'nuvei_pix'). */
  async $tf_selectPixTab({ processorType }: SelectPixTabParams) {
    await this.paymentPage.clickOnPixTab(processorType);
  }

  /** @description Clicks the Pay button in the payment widget and waits for the purchase API request and response. */
  async $tf_clickPay() {
    await this.paymentPage.clickOnPay();
  }

  /** @description Clicks the copy reference/PIX key button in the Pix voucher. */
  async $tf_clickCopyReference() {
    await this.pixPage.clickOnCopyReference();
  }

  /** @description Clicks the cancel button and confirms the cancellation in the Pix voucher dialog. */
  async $tf_clickCancel() {
    await this.pixPage.clickOnCancel();
  }

  /** @description Asserts that the Pix voucher title, description, QR code section, reference title, and countdown are visible. */
  async $tf_assertPixVoucher() {
    await this.pixPage.assertPixVoucher();
  }

  /** @description Asserts that the Pix voucher active countdown text is visible. */
  async $tf_assertPixVoucherCountdown() {
    await this.pixPage.assertPixVoucherCountdown();
  }

  /** @description Asserts that the download reference button is present and then becomes hidden after interaction. */
  async $tf_assertDownloadReferenceButton() {
    await this.pixPage.assertDownloadReferenceButton();
  }

  /** @description Asserts that the Pix voucher expiration text is visible (waits up to 2 minutes). */
  async $tf_assertPixVoucherExpirationText() {
    await this.pixPage.assertPixVoucherExpirationText();
  }
}
