import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import * as processorsConfig from '@support/interfaces/payment_processors';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';

// "Kushki MX" is the custom-name connection in this test to match the Zephyr scenario (ADM-T958).
const KUSHKI_CUSTOM_NAME_T958 = 'Kushki MX';
const RULE_STANDARD_NAME = 'Regla_Kushki_T958';
const RULE_CUSTOM_NAME = 'Regla_KushkiMX_T958';

test.describe('@regression Estrategias: combinación de filtro por procesador y filtro por conexión reduce resultados al subconjunto correcto', () => {
  test(
    '@ADM-T958 Combinación de filtro por procesador y filtro por conexión reduce resultados al subconjunto correcto',
    {
      tag: [
        '@routing',
        '@filtros',
        '@kushki',
        '@combinacion-filtros',
        '@team_admin',
        '@service_routing',
      ],
    },
    async ({ page }) => {
      // Processor config for the custom-name connection used in this test.
      const kushkiProcessorCustomMX = {
        ...processorsConfig.kushkiProcessor,
        name: KUSHKI_CUSTOM_NAME_T958,
      };

      const testing = new TestingFramework({ page, test });
      await testing.run({
        step: [
          { action: 'setup.merchant.basicSetup', params: { country: 'MX' } },
          {
            action: 'setup.processor.createProcessor',
            params: { processorConfig: processorsConfig.kushkiProcessor },
            stepName: 'Crear conexión Kushki estándar vía API',
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
              processorData: kushkiProcessorCustomMX,
            },
            stepName: `Crear conexión Kushki con custom name "${KUSHKI_CUSTOM_NAME_T958}" vía UI`,
          },
          {
            action: 'admin.navigate.goToRouting',
            stepName: 'Navegar a la sección Routing Strategies y abrir el panel de filtros',
          },
          { action: 'admin.routing.skipRoutingTourIfShown' },
          // Rule for standard Kushki connection
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
          // Rule for "Kushki MX" custom connection
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
              connectionName: KUSHKI_CUSTOM_NAME_T958,
            },
          },
          { action: 'admin.routing.saveRule' },
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
            stepName:
              'Seleccionar "Kushki" en el filtro "Buscar por procesador" y aplicar — se deben listar todas las estrategias asociadas a cualquier conexión de Kushki (ambas reglas visibles)',
          },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_STANDARD_NAME },
            stepName: 'Verificar que ambas reglas son visibles tras filtrar por procesador Kushki',
          },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_CUSTOM_NAME },
          },
          {
            action: 'admin.routing.filterByConnection',
            params: { connectionName: KUSHKI_CUSTOM_NAME_T958 },
            stepName: `Sin quitar el filtro anterior, seleccionar "${KUSHKI_CUSTOM_NAME_T958}" en "Buscar por conexión" y aplicar`,
          },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_CUSTOM_NAME },
            stepName: `Verificar que solo aparece la regla de la conexión "${KUSHKI_CUSTOM_NAME_T958}"`,
          },
          {
            action: 'admin.routing.validateCustomRuleNotPresent',
            params: { ruleName: RULE_STANDARD_NAME },
            stepName:
              'Verificar que la regla de la conexión estándar Kushki desaparece con el filtro combinado',
          },
        ],
      });
    }
  );
});
