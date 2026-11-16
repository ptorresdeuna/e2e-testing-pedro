import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import * as processorsConfig from '@support/interfaces/payment_processors';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';

const RULE_KUSHKI_NAME = 'Regla_Kushki_T959';
const RULE_ADYEN_NAME = 'Regla_Adyen_T959';

// The filter catalog is built from the merchant's existing rules, so a processor with no rules
// is never offered. The empty state is reached by combining the Kushki processor filter with
// the connection of another processor (Adyen): no rule uses both.
test.describe('@regression Estrategias: filtro "Buscar por procesador" muestra estado vacío cuando no existen reglas para el procesador seleccionado', () => {
  test(
    '@ADM-T959 Filtro "Buscar por procesador" sin resultados cuando no existen reglas para el procesador seleccionado',
    { tag: ['@routing', '@filtros', '@buscar-por-procesador', '@team_admin', '@service_routing'] },
    async ({ page }) => {
      const testing = new TestingFramework({ page, test });
      await testing.run({
        step: [
          { action: 'setup.merchant.basicSetup', params: { country: 'MX' } },
          {
            action: 'setup.processor.createProcessor',
            params: { processorConfig: processorsConfig.kushkiProcessor },
            stepName: 'Crear conexión Kushki vía API',
          },
          {
            action: 'setup.processor.createProcessor',
            params: { processorConfig: processorsConfig.adyenProcessor },
            stepName: 'Crear conexión Adyen vía API',
          },
          { action: 'admin.consolidatedFlows.goToAdminAndSetMerchantId' },
          {
            action: 'admin.navigate.goToRouting',
            stepName: 'Navegar a la sección de Routing Strategies',
          },
          { action: 'admin.routing.skipRoutingTourIfShown' },
          { action: 'admin.routing.createSpecificRule' },
          { action: 'admin.routing.firstStepSpecificRule', params: { ruleName: RULE_KUSHKI_NAME } },
          { action: 'admin.routing.addConditionStepSpecificRule' },
          {
            action: 'admin.routing.addConditionMetadata',
            params: { variableName: 'test1', formatType: 'number', operator: 'eq', value: '1' },
          },
          { action: 'admin.routing.nextStepRouting' },
          {
            action: 'admin.routing.selectDefaultPaymentEngine',
            params: { pspEngine: ConnectionsAvailable.kushki },
          },
          { action: 'admin.routing.saveRule', stepName: 'Guardar regla asociada a Kushki' },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_KUSHKI_NAME },
          },
          { action: 'admin.routing.createSpecificRule' },
          { action: 'admin.routing.firstStepSpecificRule', params: { ruleName: RULE_ADYEN_NAME } },
          { action: 'admin.routing.addConditionStepSpecificRule' },
          {
            action: 'admin.routing.addConditionMetadata',
            params: { variableName: 'test1', formatType: 'number', operator: 'eq', value: '2' },
          },
          { action: 'admin.routing.nextStepRouting' },
          {
            action: 'admin.routing.selectDefaultPaymentEngine',
            params: { pspEngine: ConnectionsAvailable.adyen },
          },
          { action: 'admin.routing.saveRule', stepName: 'Guardar regla asociada a Adyen' },
          {
            action: 'admin.routing.validateCustomRuleCreated',
            params: { ruleName: RULE_ADYEN_NAME },
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
            action: 'admin.routing.filterByConnection',
            params: { connectionName: processorsConfig.adyenProcessor.name },
            stepName: 'Agregar el filtro por conexión y seleccionar la conexión de Adyen',
          },
          {
            action: 'admin.routing.assertEmptyFilterResults',
            stepName:
              'Verificar que ninguna regla coincide con Kushki y la conexión de Adyen y que la tabla sigue visible sin errores',
          },
        ],
      });
    }
  );
});
