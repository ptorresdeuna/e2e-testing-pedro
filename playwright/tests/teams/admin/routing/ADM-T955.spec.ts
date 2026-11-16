import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import * as processorsConfig from '@support/interfaces/payment_processors';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';

const RULE_STANDARD_NAME = 'Regla_Kushki_T955';
const RULE_CUSTOM_NAME = 'Regla_KushkiCustom_T955';

test.describe('@regression Estrategias: filtro "Buscar por procesador" retorna reglas que usan cualquier conexión del procesador seleccionado', () => {
  test(
    '@ADM-T955 Filtro "Buscar por procesador" retorna reglas que usan cualquier conexión del procesador seleccionado',
    { tag: ['@routing', '@filtros', '@procesador', '@kushki', '@team_admin', '@service_routing'] },
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
            stepName: 'Navegar a la sección Routing Strategies',
          },
          { action: 'admin.routing.skipRoutingTourIfShown' },
          // Rule 1: uses the standard Kushki connection
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
          {
            action: 'admin.routing.saveRule',
            stepName: 'Guardar regla asociada a la conexión Kushki estándar',
          },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_STANDARD_NAME },
          },
          // Rule 2: uses the custom-name Kushki connection
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
          {
            action: 'admin.routing.saveRule',
            stepName: 'Guardar regla asociada a la conexión "Kushki Custom"',
          },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_STANDARD_NAME },
            stepName: 'Verificar que ambas reglas están presentes antes del filtro',
          },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_CUSTOM_NAME },
          },
          {
            action: 'admin.routing.reloadRoutingPage',
            stepName: 'Recargar para que el catálogo de filtros incluya las reglas recién creadas',
          },
          {
            action: 'admin.routing.filterByCanonicalProcessor',
            params: { processorName: ConnectionsAvailable.kushki },
            stepName: 'Abrir el filtro "Buscar por procesador" y seleccionar "Kushki"',
          },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_STANDARD_NAME },
            stepName: 'Verificar que aparece la regla asociada a la conexión Kushki estándar',
          },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_CUSTOM_NAME },
            stepName:
              'Verificar que también aparece la regla asociada a la conexión "Kushki Custom"',
          },
        ],
      });
    }
  );
});
