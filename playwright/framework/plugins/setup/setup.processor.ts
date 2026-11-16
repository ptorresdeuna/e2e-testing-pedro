import { Context, FrameworkPlugin } from '../interface';
import { resolveMerchantId, resolveMerchantToken } from '../../resolve';
import { createPaymentProcessor } from '@support/newman/apiCallNewman';
import { BaseProcessor } from '@support/interfaces/payment_processors/baseProcessor';
import { ServiceFactory, SERVICE_KEYS } from '@support/http';
import { ProcessorRegistry } from '@support/utils/ProcessorRegistry';

export class PluginSetupProcessor extends FrameworkPlugin {
  pluginBaseName = 'setup.processor';

  setTestContext(context: Context) {
    super.setTestContext(context);
  }

  /** @description Creates a payment processor. merchantId defaults to the merchant from a previous setup.merchant action. Returns the created processor id — add saveAs to capture it, then pass ref() to setup.processor.deleteProcessor. */
  async $tf_createProcessor({
    processorConfig,
    merchantId,
    merchantToken,
  }: {
    processorConfig: BaseProcessor;
    merchantId?: string;
    merchantToken?: string;
  }) {
    const action = 'setup.processor.createProcessor';
    const resolvedMerchantId = resolveMerchantId(this.context, action, merchantId);
    const resolvedMerchantToken = resolveMerchantToken(this.context, action, merchantToken);
    const processorId = await createPaymentProcessor(
      processorConfig,
      resolvedMerchantId,
      resolvedMerchantToken
    );
    ProcessorRegistry.getInstance().register(
      processorId,
      resolvedMerchantId,
      resolvedMerchantToken
    );
    return processorId;
  }

  /** @description Deletes a payment processor by its id. Expects a 204 from the payment service. Pass processorId with ref() from the step that created it; merchantId and merchantToken default to the merchant from a previous setup.merchant action. */
  async $tf_deleteProcessor({
    processorId,
    merchantId,
    merchantToken,
  }: {
    processorId: string;
    merchantId?: string;
    merchantToken?: string;
  }) {
    await ServiceFactory.getService(SERVICE_KEYS.PAYMENT).deletePaymentProcessor(
      processorId,
      resolveMerchantId(this.context, 'setup.processor.deleteProcessor', merchantId),
      resolveMerchantToken(this.context, 'setup.processor.deleteProcessor', merchantToken)
    );
    ProcessorRegistry.getInstance().unregister(processorId);
  }
}
