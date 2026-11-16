import envConfig from '@support/envConfig';
import { BaseUserAddress } from '@support/interfaces/address_user/baseUserAddress';
import { BaseUserData } from '@support/interfaces/user_data/baseUserData';
import { CountryCodes } from '@support/interfaces/countryCodeTypes';
import { retryApiCall } from '@support/utils/retries';

// One scenario's test data (country/currency, card, credential, guest user
// data and shipping address), resolved by payconnect-testing-hub for this
// merchant's assigned PSP version. card's shape mirrors BaseCreditCard
// (@support/interfaces/credit_cards/baseCreditCard); user's shape mirrors
// BaseUserData (@support/interfaces/user_data/baseUserData); address's shape
// mirrors BaseUserAddress (@support/interfaces/address_user/baseUserAddress).
//
// This is also the exact shape of payconnect-testing-hub's GET
// /connections/e2e-config response body: a bare list of scenarios, and
// nothing more. PROCESSOR_ID/PROCESSOR_NAME/VERSION_ID/ENTITY_ID are not in
// that response — they arrive directly as env vars from the dispatch
// payload (see e2e-testing-hub.yml), same as the pre-existing psp-wide
// flow. The PSP is one value per run (not per scenario), so it's
// PROCESSOR_NAME (merchantScenarioConfig.ts's getIhubProcessorName()), not a
// field here.
export interface IhubScenario {
  scenario_id: string;
  country: CountryCodes;
  currency: string;
  card: {
    number: string;
    expiration_date: string;
    cvv_code: string;
    cardholder_name: string;
    document_number: string;
  };
  credential: Record<string, string>;
  user: BaseUserData;
  address: BaseUserAddress;
}

/**
 * Returns this run's merchant-granularity scenarios.
 *
 * Reads them from TEST_CONFIGS rather than keeping loadIhubConfig's fetched
 * data in memory: globalSetup (where loadIhubConfig runs) and the worker
 * process that actually runs a spec file are separate OS processes — a
 * module-level variable set in one is invisible in the other. Env vars are
 * the one thing that does cross that boundary (inherited at worker fork),
 * which is why loadIhubConfig writes the fetched list back into
 * process.env.TEST_CONFIGS instead of just caching it here.
 */
export function getIhubScenarios(): IhubScenario[] {
  const raw = process.env.TEST_CONFIGS ?? '';
  let scenarios: IhubScenario[];
  try {
    scenarios = JSON.parse(raw) as IhubScenario[];
  } catch {
    throw new Error(
      `Invalid JSON in environment variable TEST_CONFIGS: ${raw.substring(0, 100)}...`
    );
  }

  if (scenarios.length === 0) {
    throw new Error('TEST_CONFIGS must contain at least one scenario');
  }

  return scenarios;
}

/**
 * Pulls this run's merchant-granularity scenario list from
 * payconnect-testing-hub and seeds TEST_CONFIGS — the same env var the
 * pre-existing psp-wide @integration-hub flow receives directly in its
 * dispatch payload — so merchantScenarioConfig.ts stays identical for both
 * flows.
 *
 * Takes no params: PROCESSOR_ID is read directly from the env (set by the
 * dispatch, same as VERSION_ID/ENTITY_ID) and sent as a path param on GET
 * /connections/e2e-config/{processorId}.
 *
 * No-ops when VERSION_ID/PROCESSOR_ID aren't set: this is a no-op for the
 * psp-wide flow and for local runs. Also no-ops when TEST_CONFIGS is already
 * populated, so calling this more than once (e.g. once from global.setup.ts
 * and again from a spec's own beforeAll, across every IHUB-Txxx.spec.ts file)
 * only hits payconnect-testing-hub's endpoint the first time.
 *
 * Called from global.setup.ts, which runs before test files are loaded, so
 * the env vars it sets here are already present when the integration-hub
 * spec files read them at module scope.
 */
export async function loadIhubConfig(): Promise<void> {
  if (process.env.TEST_CONFIGS) {
    return;
  }
  const processorId = process.env.PROCESSOR_ID;
  if (!processorId) {
    return;
  }

  const baseUrl = envConfig.PAYCONNECT_TESTING_HUB_URL;
  const apiKey = envConfig.PAYCONNECT_TESTING_HUB_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      'PROCESSOR_ID are set but PAYCONNECT_TESTING_HUB_URL/PAYCONNECT_TESTING_HUB_API_KEY are missing'
    );
  }

  // Retries only the fetch itself (e.g. a cold container network stack not yet
  // routable, seen locally under act right after the multi-minute browser
  // install step) — a non-2xx/malformed response still fails immediately below,
  // with its own specific error message, not retried away.
  const response = await retryApiCall(
    () =>
      fetch(`${baseUrl}/connections/e2e-config?psp_id=${processorId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      }),
    () => true,
    3,
    2000
  );

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(`Failed to load integration-hub config (${response.status}): ${rawBody}`);
  }

  // A 2xx with a non-JSON body (e.g. a mock server's default "no rule
  // configured for this path/method" page) would otherwise surface as an
  // opaque JSON.parse syntax error, so fail loudly with the actual body here
  // instead.
  let data: unknown;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `payconnect-testing-hub returned a 2xx with a non-JSON body for GET /connections/e2e-config: ${rawBody.substring(0, 300)}`
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      `Expected GET /connections/e2e-config to return an array of scenarios, got: ${rawBody.substring(0, 300)}`
    );
  }

  process.env.TEST_CONFIGS = JSON.stringify(data as IhubScenario[]);
}

/**
 * Starts activating this run's payconnect-testing-hub version for the given
 * merchant/entity, via POST /connections/e2e-activation. Called from each
 * merchant-granularity spec's beforeAll, right after the payment processor
 * it needs active is created, passing that beforeAll's own newly created
 * merchantId as entityId — unlike loadIhubConfig, this is a side-effecting
 * trigger, not cacheable data, so it is not guarded to run only once per
 * worker.
 */
export async function activateIhubVersion(entityId: string): Promise<void> {
  const versionId = process.env.VERSION_ID;
  if (!versionId) {
    throw new Error('VERSION_ID must be set to activate an integration-hub version');
  }

  const baseUrl = envConfig.PAYCONNECT_TESTING_HUB_URL;
  const apiKey = envConfig.PAYCONNECT_TESTING_HUB_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      'VERSION_ID is set but PAYCONNECT_TESTING_HUB_URL/PAYCONNECT_TESTING_HUB_API_KEY are missing'
    );
  }

  const response = await fetch(`${baseUrl}/connections/e2e-activation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      version_id: versionId,
      granularity: 'merchant',
      entity_id: entityId,
      bypass: true,
    }),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to activate integration-hub version (${response.status}): ${rawBody}`);
  }
}
