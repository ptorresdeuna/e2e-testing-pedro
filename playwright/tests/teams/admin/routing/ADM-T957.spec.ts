import { test } from '@support/fixtures';
import { TestingFramework } from 'playwright/framework/core';
import * as processorsConfig from '@support/interfaces/payment_processors';
import { ConnectionsAvailable } from '@support/interfaces/connectionsAvailable';

test.describe('@regression Estrategias: los filtros "Buscar por procesador" y "Buscar por conexión" aparecen con sus labels correctos y en el orden definido', () => {
  test(
    '@ADM-T957 Los filtros "Buscar por procesador" y "Buscar por conexión" aparecen con sus labels correctos y en el orden definido',
    { tag: ['@routing', '@filtros', '@ui', '@team_admin', '@service_routing'] },
    async ({ page }) => {
      const testing = new TestingFramework({ page, test });
      await testing.run({
        step: [
          { action: 'setup.merchant.basicSetup', params: { country: 'MX' } },
          {
            action: 'setup.processor.createProcessor',
            params: { processorConfig: processorsConfig.kushkiProcessor },
          },
          { action: 'admin.consolidatedFlows.goToAdminAndSetMerchantId' },
          {
            action: 'admin.navigate.goToRouting',
            stepName: 'Navegar a la sección Routing Strategies del merchant en admin',
          },
          { action: 'admin.routing.skipRoutingTourIfShown' },
          {
            action: 'admin.routing.assertOldPSPFilterLabelAbsent',
            stepName: 'Verificar que el label "Buscar por PSP" no aparece en ningún filtro',
          },
          {
            action: 'admin.routing.assertCanonicalProcessorFilterVisible',
            stepName: 'Verificar que el filtro "Buscar por procesador" está presente en el panel',
          },
          {
            action: 'admin.routing.assertConnectionFilterVisible',
            stepName: 'Verificar que el filtro "Buscar por conexión" está presente en el panel',
          },
          {
            action: 'admin.routing.assertCanonicalProcessorFilterBeforeConnectionFilter',
            stepName:
              'Verificar que "Buscar por procesador" aparece antes que "Buscar por conexión" en la lista de filtros',
          },
        ],
      });
    }
  );
});
