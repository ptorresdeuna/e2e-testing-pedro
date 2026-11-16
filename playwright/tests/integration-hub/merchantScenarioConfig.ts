import { getIhubScenarios, type IhubScenario } from '@support/ihub/loadConfig';

export type { IhubScenario };

// Reads the merchant-granularity integration-hub config straight from the
// pipeline's env vars — PROCESSOR_ID and TEST_CONFIGS, set by the GitHub
// Actions dispatch payload (payconnect-testing-hub resolves and pushes them
// at trigger time; this runner never calls back for them). These are the
// SAME env vars envTestConfig.ts reads for the pre-existing psp-wide
// @integration-hub flow, but with a different TEST_CONFIGS shape — one
// scenario (card + credential) per entry, not one country per entry. Only
// one of the two shapes is ever on the wire for a given run, since each flow
// runs its own, disjoint set of tagged specs. VERSION_ID is specific to the
// merchant-granularity flow (not read by the psp-wide flow).
const REQUIRED_ENV_VARS = ['PROCESSOR_ID', 'PROCESSOR_NAME', 'TEST_CONFIGS', 'VERSION_ID'] as const;

/**
 * Returns a list of missing required environment variables.
 * Useful for generating a descriptive skip/fail message before test execution.
 */
export function getMissingIhubEnvVars(): string[] {
  return REQUIRED_ENV_VARS.filter((name) => !process.env[name]) as unknown as string[];
}

export function getIhubProcessorId(): number {
  const processorId = parseInt(process.env.PROCESSOR_ID ?? '', 10);
  if (isNaN(processorId)) {
    throw new Error('PROCESSOR_ID must be a valid number');
  }
  return processorId;
}

/**
 * The PSP name to register on the payment processor created for this run,
 * resolved by payconnect-testing-hub and sent directly in the dispatch
 * payload (same as PROCESSOR_ID) — not part of a TEST_CONFIGS scenario,
 * since it's one value per run, not per scenario.
 */
export function getIhubProcessorName(): string {
  const processorName = process.env.PROCESSOR_NAME;
  if (!processorName) {
    throw new Error('PROCESSOR_NAME must be set');
  }
  return processorName;
}

/**
 * The payconnect-testing-hub version under test for this run, set directly
 * by the dispatch payload (see e2e-testing-hub.yml). Specs report it as an
 * annotation so it reaches the integrationHubReporter callback.
 */
export function getIhubVersionId(): string {
  const versionId = process.env.VERSION_ID;
  if (!versionId) {
    throw new Error('VERSION_ID must be set');
  }
  return versionId;
}

export { getIhubScenarios };

/**
 * Looks up one scenario by scenario_id. Each merchant-granularity spec file
 * in this folder is dedicated to a single Zephyr test case (per the repo's
 * one-file-per-testcaseid convention — see CLAUDE.md) and calls this with
 * its own literal ID, e.g. getScenario('IHUB-T101') from IHUB-T101.spec.ts.
 * payconnect-testing-hub resolves scenario_id to match that same ID.
 */
export function getScenario(scenarioId: string): IhubScenario | undefined {
  return getIhubScenarios().find((s) => s.scenario_id === scenarioId);
}
