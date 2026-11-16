import { test } from '@support/fixtures';
import { runShadowModeScenario, ShadowModeScenario } from './shadowModeScenario';
import { PF_T177_RULE, PF_T178_RULE } from './shadowModeRules';

/**
 * Clearsale as a pre-auth shadow provider, with and without a pre-auth main provider. It absorbs
 * PF-T178. Each scenario keeps the setup of its former spec.
 */
const SCENARIOS: ShadowModeScenario[] = [
  {
    name: 'Pre-auth main and shadow providers',
    fraudConnections: ['cybersource', 'clearsale'],
    enableCommerceShadowMode: true,
    rule: PF_T177_RULE,
    main: {
      riskLevel: 'low',
      fraudDecision: 'low_risk',
      status: 'accepted',
      processor: 'CYBERSOURCE',
    },
    shadows: [
      {
        riskLevel: 'low',
        fraudDecision: 'low_risk',
        status: 'automatic_decision',
        processor: 'CLEARSALE',
      },
    ],
  },
  {
    name: 'No main provider - one pre-auth shadow provider (former PF-T178)',
    fraudConnections: ['clearsale'],
    enableCommerceShadowMode: true,
    rule: PF_T178_RULE,
    shadows: [
      {
        riskLevel: 'low',
        fraudDecision: 'low_risk',
        status: 'automatic_decision',
        processor: 'CLEARSALE',
      },
    ],
  },
];

test.describe('@regression feature to validate with the automated test case', () => {
  test(
    '@PF-T177 Purchase with fraud shadow mode - Clearsale pre-auth shadow provider with and without a pre-auth main provider',
    {
      tag: ['@fraud', '@admin_connection', '@admin-preprod', '@team_payconnect', '@service_fraud'],
    },
    async ({ page, emaService, paymentService, paymentRoutingService }) => {
      for (const scenario of SCENARIOS) {
        await runShadowModeScenario(
          page,
          { emaService, paymentService, paymentRoutingService },
          scenario
        );
      }
    }
  );
});
