import { ServiceFactory, SERVICE_KEYS } from '@support/http';
import * as apiCallNewman from '@support/newman/apiCallNewman';
import * as processorsConfig from '@support/interfaces/payment_processors';
import * as creditCardData from '@support/interfaces/credit_cards';
import { buildPurchaseV2Payload } from '@support/http/testData/payment/PurchaseV2PayloadBuilder';
import {
  CLEARSALE_FRAUD_PROCESSOR_BODY,
  DYNAMIC_ROUTING_CLEARSALE_RULE_BODY,
} from '@support/http/testData/dynamicRouting/FraudRoutingConfig';
import { pollUntil } from '@support/http/utils/PollingHelper';

export interface ClearsaleWarmupAttempt {
  status: number;
  code?: string;
  durationMs: number;
}

export interface ClearsaleWarmupResult {
  warmed: boolean;
  merchantId: string;
  attempts: ClearsaleWarmupAttempt[];
  totalMs: number;
}

/**
 * Clearsale's sandbox answers slowly after DEUNA stops calling it for a while: the first calls
 * take 10-20 s or end in a 504 from its Azure Application Gateway, while payments gives guard 5 s
 * (ANTI_FRAUD_TIMEOUT_MS) and answers DP-8001. In 7 days 75 of 76 such errors fell within 3 minutes
 * of a burst that followed 20+ minutes of silence (runs 40523916618 and 40628483686).
 *
 * This sends purchases through Clearsale, with the same setup as PI-T1914, until one is approved,
 * so the regression starts once Clearsale answers in time. Each attempt uses a new order: an
 * order that got DP-8001 cannot be purchased again.
 */
export async function warmUpClearsale({
  timeoutMs = 150_000,
  intervalMs = 5_000,
}: { timeoutMs?: number; intervalMs?: number } = {}): Promise<ClearsaleWarmupResult> {
  const startedAt = Date.now();
  const emaService = ServiceFactory.getService(SERVICE_KEYS.EMA);
  const userAuthService = ServiceFactory.getService(SERVICE_KEYS.USER_AUTH);
  const paymentService = ServiceFactory.getService(SERVICE_KEYS.PAYMENT);

  // A custom name keeps the merchant out of a regression's merchant pool, which only serves
  // country-only requests, and tells the warm-up merchants apart in the admin.
  const { merchantId, merchantToken, privateKey } = await ServiceFactory.getService(
    SERVICE_KEYS.MERCHANT_AUTH
  ).createBasicMerchant({ country: 'MX', customName: `CLEARSALE_WARMUP_MX ${Date.now()}` });
  await apiCallNewman.createPaymentProcessor(
    processorsConfig.stripeProcessor,
    merchantId,
    merchantToken
  );
  await apiCallNewman.configDynamicRoutingWithFraud(
    CLEARSALE_FRAUD_PROCESSOR_BODY,
    DYNAMIC_ROUTING_CLEARSALE_RULE_BODY,
    merchantId,
    merchantToken
  );

  const attempts: ClearsaleWarmupAttempt[] = [];
  const purchaseThroughClearsale = async (): Promise<ClearsaleWarmupAttempt> => {
    const order = await emaService.tokenizeDeunaNowOrder('MX', privateKey, {
      user_email: 'dlora@deuna.com',
      amount: 4990,
    });
    const guest = await userAuthService.loginAsGuest(merchantId, privateKey);
    const sentAt = Date.now();
    const response = await paymentService.purchaseV2(
      privateKey,
      guest.data.token,
      buildPurchaseV2Payload({
        country: 'MX',
        processorName: processorsConfig.stripeProcessor.name,
        card: creditCardData.stripeVisaSuccessful,
        token: order.data.token,
      }),
      true
    );
    const errorBody = response.data as unknown as { error?: { code?: string } } | undefined;
    const attempt = {
      status: response.status,
      code: errorBody?.error?.code,
      durationMs: Date.now() - sentAt,
    };
    attempts.push(attempt);
    console.log(`[clearsale-warmup] attempt ${attempts.length}: ${JSON.stringify(attempt)}`);
    return attempt;
  };

  const warmed = await pollUntil(purchaseThroughClearsale, (attempt) => attempt.status === 200, {
    intervalMs,
    timeoutMs,
  }).then(
    () => true,
    (error: Error) => {
      console.warn(`[clearsale-warmup] Clearsale did not approve a purchase: ${error.message}`);
      return false;
    }
  );

  return { warmed, merchantId, attempts, totalMs: Date.now() - startedAt };
}
