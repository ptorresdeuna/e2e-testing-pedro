import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import * as processorsConfig from '@support/interfaces/payment_processors';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';

const RULE_NAME = 'Regla_test_T954';

test.describe('@regression Estrategias: filtro "Buscar por procesador" muestra procesadores canónicos deduplicados', () => {
  test(
    '@ADM-T954 Filtro "Buscar por procesador" muestra procesadores canónicos deduplicados',
    {
      tag: [
        '@routing',
        '@filtros',
        '@buscar-por-procesador',
        '@deduplicacion',
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
            stepName: 'Navegar a Conexiones para crear la segunda conexión Kushki',
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
            stepName: 'Navegar a la sección de Routing Strategies',
          },
          { action: 'admin.routing.skipRoutingTourIfShown' },
          // Create a routing rule using one of the Kushki connections so the processor appears in the filter
          { action: 'admin.routing.createSpecificRule' },
          { action: 'admin.routing.firstStepSpecificRule', params: { ruleName: RULE_NAME } },
          { action: 'admin.routing.addConditionStepSpecificRule' },
          {
            action: 'admin.routing.addConditionMetadata',
            params: { variableName: 'test1', formatType: 'number', operator: 'eq', value: '3' },
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
          { action: 'admin.routing.validateCustomRuleCreated', params: { ruleName: RULE_NAME } },
          {
            action: 'admin.routing.reloadRoutingPage',
            stepName: 'Recargar para que el catálogo de filtros incluya la regla recién creada',
          },
          {
            action: 'admin.routing.assertCanonicalProcessorDeduplicatedInFilter',
            params: { processorName: ConnectionsAvailable.kushki },
            stepName:
              'Verificar que "Kushki" aparece exactamente una vez en el filtro "Buscar por procesador", sin entradas duplicadas aunque existan dos conexiones del mismo PSP',
          },
        ],
      });
    }
  );
});
