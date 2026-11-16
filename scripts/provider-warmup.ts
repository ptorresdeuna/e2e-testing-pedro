/**
 * Warms up the anti-fraud providers whose staging sandbox answers slowly after a pause, so the
 * regression does not start against a cold one. Today: Clearsale (see
 * playwright/support/warmup/clearsaleWarmup.ts for the evidence).
 *
 * Run before each wave of a regression, because a retry round starts 20+ minutes after the
 * previous one, against a cold sandbox again. regression_tests.yml (github-actions) runs it once in
 * the admin-session job for the primary wave and in every retry shard with --test-cases.
 *
 *   npm run warmup:providers
 *   npm run warmup:providers -- --timeout-ms 150000 --interval-ms 5000
 *   npm run warmup:providers -- --test-cases "api_guard/PI-T1914.spec.ts:49 PI-T1902"  # retry waves
 *
 * With --test-cases it only warms up when one of those specs uses Clearsale, so a retry wave
 * without Clearsale cases does not pay for it.
 *
 * Best effort by design: it always exits 0. A provider that stays cold is reported with a GitHub
 * Actions warning, and the tests that use it fail on their own with the real error.
 */
import * as fs from 'fs';
import * as path from 'path';
import { warmUpClearsale } from '@support/warmup/clearsaleWarmup';

const TESTS_DIR = path.join(__dirname, '..', 'playwright', 'tests');

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const numberArg = (name: string): number | undefined =>
  arg(name) === undefined ? undefined : Number(arg(name));

function specFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return specFiles(full);
    return entry.name.endsWith('.spec.ts') ? [full] : [];
  });
}

/**
 * The cases among `selectors` whose spec mentions Clearsale (its processor, rule bodies or name).
 * A selector is a test case id (`PI-T1902`) or what the retry waves pass to Playwright
 * (`api_guard/merchant_profile/PI-T1902.spec.ts:70`).
 */
function clearsaleCases(selectors: string[]): string[] {
  const wanted = new Set(
    selectors.map((selector) =>
      path.basename(selector.replace(/:\d+$/, ''), '.spec.ts').replace(/^@/, '')
    )
  );
  return specFiles(TESTS_DIR)
    .filter((file) => wanted.has(path.basename(file, '.spec.ts')))
    .filter((file) => /clearsale/i.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.basename(file, '.spec.ts'));
}

async function main() {
  const testCases = arg('test-cases');
  if (testCases !== undefined) {
    const matching = clearsaleCases(testCases.split(/[\s,]+/).filter(Boolean));
    if (matching.length === 0) {
      console.log('[provider-warmup] no Clearsale case in this wave; skipping the warm-up');
      return;
    }
    console.log(`[provider-warmup] Clearsale cases in this wave: ${matching.join(' ')}`);
  }

  const result = await warmUpClearsale({
    timeoutMs: numberArg('timeout-ms'),
    intervalMs: numberArg('interval-ms'),
  });
  console.log(`[provider-warmup] clearsale ${JSON.stringify(result)}`);
  if (!result.warmed) {
    console.log(
      `::warning::Clearsale did not approve a purchase within ${result.totalMs} ms ` +
        `(${result.attempts.length} attempts); Clearsale tests may fail with DP-8001.`
    );
  }
}

main().catch((error: Error) => {
  // The warm-up never blocks a regression: report why it could not run and let the tests go on.
  console.log(`::warning::Provider warm-up could not run: ${error.message}`);
});
