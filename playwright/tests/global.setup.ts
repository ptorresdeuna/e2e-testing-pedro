import { type FullConfig } from '@support/fixtures';
import { createAndLoadTestCycle } from '@support/zephyr';
import { TEST_CYCLE_ID, PUBLISH_RESULTS_ZEPHYR } from '@support/zephyr/utils/config';
import { loadIhubConfig } from '@support/ihub/loadConfig';

async function globalSetup(config: FullConfig) {
  // Pulls the merchant-granularity integration-hub config (PROCESSOR_ID/
  // TEST_CONFIGS) from payconnect-testing-hub when VERSION_ID/ENTITY_ID are
  // set. Runs before test files are loaded, so merchantScenarioConfig.ts
  // (playwright/tests/integration-hub/) sees the env vars already in place.
  await loadIhubConfig();

  if (PUBLISH_RESULTS_ZEPHYR === 'true' && !TEST_CYCLE_ID) {
    await createAndLoadTestCycle();
  }
}

export default globalSetup;
