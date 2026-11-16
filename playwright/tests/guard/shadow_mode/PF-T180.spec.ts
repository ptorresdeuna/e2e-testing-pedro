import { test } from '@support/fixtures';
import { runShadowModeScenario, ShadowModeScenario } from './shadowModeScenario';
import { PF_T179_RULE, PF_T180_RULE, PF_T181_RULE, PF_T182_RULE } from './shadowModeRules';

/**
 * Clearsale as a post-auth shadow provider in the four main/shadow combinations. It absorbs
 * PF-T179, PF-T181 and PF-T182. Each scenario keeps the setup of its former spec.
 */
const SCENARIOS: ShadowModeScenario[] = [
  {
    name: 'Post-auth main and shadow providers',
    fraudConnections: ['cybersource', 'clearsale'],
    enableCommerceShadowMode: true,
    rule: PF_T180_RULE,
    main: {
      riskLevel: '',
      fraudDecision: 'pending_risk',
      status: 'pending',
      processor: 'CYBERSOURCE',
    },
    shadows: [
      {
        riskLevel: '',
        fraudDecision: 'pending_risk',
        status: 'pending_analysis',
        processor: 'CLEARSALE',
      },
    ],
  },
  {
    name: 'Pre-auth main and shadow providers - one post-auth shadow (former PF-T179)',
    fraudConnections: ['cybersource', 'sift', 'clearsale'],
    enableCommerceShadowMode: false,
    rule: PF_T179_RULE,
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
        processor: 'SIFT',
      },
      { riskLevel: '', fraudDecision: '', status: 'pending_analysis', processor: 'CLEARSALE' },
    ],
  },
  {
    name: 'No main provider - one post-auth shadow provider (former PF-T181)',
    fraudConnections: ['clearsale'],
    enableCommerceShadowMode: false,
    rule: PF_T181_RULE,
    shadows: [
      { riskLevel: '', fraudDecision: '', status: 'pending_analysis', processor: 'CLEARSALE' },
    ],
  },
  {
    name: 'Post-auth main and shadow providers - one pre-auth shadow (former PF-T182)',
    fraudConnections: ['cybersource', 'sift', 'clearsale'],
    enableCommerceShadowMode: false,
    rule: PF_T182_RULE,
    main: {
      riskLevel: '',
      fraudDecision: 'pending_risk',
      status: 'pending',
      processor: 'CYBERSOURCE',
    },
    shadows: [
      {
        riskLevel: 'low',
        fraudDecision: 'low_risk',
        status: 'automatic_decision',
        processor: 'SIFT',
      },
      {
        riskLevel: '',
        fraudDecision: 'pending_risk',
        status: 'pending_analysis',
        processor: 'CLEARSALE',
      },
    ],
  },
];

test.describe('@regression feature to validate with the automated test case', () => {
  test(
    '@PF-T180 Purchase with fraud shadow mode - Clearsale post-auth shadow provider with and without main and pre-auth shadow providers',
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
