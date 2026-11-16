import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import * as processorsConfig from '@support/interfaces/payment_processors';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';

const RULE_STANDARD_NAME = 'Regla_Kushki_T960';
const RULE_CUSTOM_NAME = 'Regla_KushkiCustom_T960';

// The two connection names the merchant has. The connection filter must show exactly these
// names and no additional canonical-processor-only entries.
const EXPECTED_CONNECTION_FILTER_OPTIONS = [
  processorsConfig.kushkiProcessor.name,
  processorsConfig.kushkiProcessorCustom.name,
];

test.describe('@regression Estrategias: el filtro "Buscar por conexión" no incluye procesadores canónicos en su lista de opciones', () => {
  test(
    '@ADM-T960 El filtro "Buscar por conexión" no incluye procesadores canónicos en su lista de opciones',
    {
      tag: [
        '@routing',
        '@filtros',
        '@buscar-por-conexion',
        '@separacion-de-datos',
        '@kushki',
        '@team_admin',
        '@service_routing',
      ],
    },
    async ({ page }) => {
      const testing = new TestingFramework({ page, test });
      await testing.run({
        step: [
          { action: 'setup.merchant.basicSetup', params: { country: 'MX' } },
          {
            action: 'setup.processor.createProcessor',
            params: { processorConfig: processorsConfig.kushkiProcessor },
            stepName: 'Crear primera conexión Kushki estándar vía API',
          },
          { action: 'admin.consolidatedFlows.goToAdminAndSetMerchantId' },
          {
            action: 'admin.navigate.goToConnections',
            stepName: 'Navegar a Conexiones para crear la segunda conexión Kushki con custom name',
          },
          {
            action: 'admin.connections.configureConnection',
            params: {
              connectionName: ConnectionsAvailable.kushki,
              processorData: processorsConfig.kushkiProcessorCustom,
            },
            stepName: 'Crear segunda conexión Kushki con custom name "Kushki Custom" vía UI',
          },
          {
            action: 'admin.navigate.goToRouting',
            stepName: 'Navegar a la sección de Routing Strategies y abrir el panel de filtros',
          },
          { action: 'admin.routing.skipRoutingTourIfShown' },
          // Create a rule for each connection so both appear in the filter options
          { action: 'admin.routing.createSpecificRule' },
          {
            action: 'admin.routing.firstStepSpecificRule',
            params: { ruleName: RULE_STANDARD_NAME },
          },
          { action: 'admin.routing.addConditionStepSpecificRule' },
          {
            action: 'admin.routing.addConditionMetadata',
            params: { variableName: 'test1', formatType: 'number', operator: 'eq', value: '1' },
          },
          { action: 'admin.routing.nextStepRouting' },
          {
            action: 'admin.routing.selectDefaultPaymentEngine',
            params: {
              pspEngine: ConnectionsAvailable.kushki,
              connectionName: processorsConfig.kushkiProcessor.name,
            },
          },
          { action: 'admin.routing.saveRule' },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_STANDARD_NAME },
          },
          { action: 'admin.routing.createSpecificRule' },
          { action: 'admin.routing.firstStepSpecificRule', params: { ruleName: RULE_CUSTOM_NAME } },
          { action: 'admin.routing.addConditionStepSpecificRule' },
          {
            action: 'admin.routing.addConditionMetadata',
            params: { variableName: 'test1', formatType: 'number', operator: 'eq', value: '2' },
          },
          { action: 'admin.routing.nextStepRouting' },
          {
            action: 'admin.routing.selectDefaultPaymentEngine',
            params: {
              pspEngine: ConnectionsAvailable.kushki,
              connectionName: processorsConfig.kushkiProcessorCustom.name,
            },
          },
          { action: 'admin.routing.saveRule' },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_CUSTOM_NAME },
          },
          {
            action: 'admin.routing.reloadRoutingPage',
            stepName: 'Recargar para que el catálogo de filtros incluya las conexiones creadas',
          },
          {
            action: 'admin.routing.assertConnectionFilterOptions',
            params: { connectionNames: EXPECTED_CONNECTION_FILTER_OPTIONS },
            stepName:
              'Hacer clic en el selector del filtro "Buscar por conexión" y verificar que las opciones son exactamente los nombres de las conexiones del comerciante — no aparecen procesadores canónicos puros como opciones adicionales',
          },
        ],
      });
    }
  );
});
