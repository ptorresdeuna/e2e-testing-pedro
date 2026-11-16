import type {
  Reporter,
  FullConfig,
  Suite,
  FullResult,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import envConfig from '@support/envConfig';

type TestRow = {
  file: string;
  title: string;
  country?: string;
  currency?: string;
  orderToken?: string;
  merchantId?: string;
  merchantName?: string;
  versionId?: string;
  transaction?: string;
  status: string;
  durationMs: number;
};

export default class IntegrationHubReporter implements Reporter {
  private results: TestRow[] = [];
  private runStartedAt = new Date();
  private totalTests = 0;

  constructor() {
    if (!process.env.VERSION_ID) {
      console.warn('⚠️ VERSION_ID is not defined. Results will not be sent.');
    }
  }

  async onTestEnd(test: TestCase, result: TestResult) {
    // Multi-country runs execute all countries in one Playwright run, so the
    // aggregated callback needs per-test debug context to stay
    // distinguishable and debuggable. Tests push these via
    // test.info().annotations (see authorize.spec.ts / refund.spec.ts).
    const findAnnotation = (type: string) =>
      test.annotations.find((a) => a.type === type)?.description;

    this.results.push({
      file: test.location.file,
      title: test.title,
      country: findAnnotation('Country'),
      currency: findAnnotation('Currency'),
      orderToken: findAnnotation('Order Token'),
      merchantId: findAnnotation('Merchant ID'),
      merchantName: findAnnotation('Merchant'),
      versionId: findAnnotation('Version ID'),
      transaction: findAnnotation('Transaction'),
      status: result.status,
      durationMs: result.duration, // Playwright's TestResult.duration is already in ms
    });
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.totalTests = suite.allTests().length;
    console.log(`Starting the run with ${this.totalTests} tests`);
  }

  async onEnd(result: FullResult) {
    // ENTITY_ID is only set for the merchant-granularity integration-hub
    // flow (see @support/ihub/config); the pre-existing psp-wide flow has no
    // merchant to scope to, so it's omitted there and the hub skips
    // releasing an assignment.
    const versionId = process.env.VERSION_ID;
    if (!versionId) return;

    const finishedAt = new Date();

    // GITHUB_RUN_ID/GITHUB_SERVER_URL/GITHUB_REPOSITORY are injected by
    // Actions into every job automatically — no GitHub API call needed to
    // identify which run produced this callback.
    const runId = process.env.GITHUB_RUN_ID;
    const runUrl = runId
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}`
      : undefined;

    // The callback path is joined onto PAYCONNECT_TESTING_HUB_URL the same
    // way loadIhubConfig/activateIhubVersion build their request URLs.
    const callbackUrl = `${envConfig.PAYCONNECT_TESTING_HUB_URL.replace(/\/$/, '')}/connections/${versionId}/callback-e2e`;

    await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.PAYCONNECT_TESTING_HUB_API_KEY
          ? { 'X-API-Key': process.env.PAYCONNECT_TESTING_HUB_API_KEY }
          : {}),
      },
      body: JSON.stringify({
        status: result.status,
        startedAt: this.runStartedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - this.runStartedAt.getTime(),
        runId,
        runUrl,
        version: process.env.Version,
        ...(versionId ? { versionId } : {}),
        tests: this.results,
      }),
    });
  }
}
