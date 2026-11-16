---
name: test-inventory
description: Genera el inventario CSV completo de test cases E2E del repo (test_id, title, file, service, spec_tags, services_called) leyendo los specs con el AST de TypeScript. Úsala cuando el usuario pida el inventario, listado o CSV de todos los tests, "extrae los test cases del repo", o cuántos tests hay con sus tags.
---

# Inventario de test cases E2E

Extrae lo que dice el código, sin decidir si un test es nuevo o viejo. Nunca inventes valores: lo que el repo no define va vacío.

## Ejecutar

Desde la raíz del repo (necesita `node_modules/typescript` instalado):

```bash
node ~/.claude/skills/test-inventory/scripts/inventory.cjs <repoRoot> [outCsv] [reportJson]
```

Defaults: `outCsv` = `<repoRoot>/test_inventory.csv`, `reportJson` = `$TMPDIR/test_inventory_report.json` (contiene `noid`, `dups`, `warns`, `condSkips`). Si el CSV cae dentro del repo, no lo agregues a git ni lo commitees; el usuario quiere esto solo local.

## Qué hace el script

- Recorre todos los `.ts/.js/.tsx` versionados bajo `playwright/tests/` (no solo `.spec.ts`: hay tests definidos en `share/*.ts`, `.example.ts`, etc.).
- Columnas: `test_id,title,file,service,spec_tags,services_called`.
- `test_id`: primer tag con forma `@PREFIJO-T####` del título, sin `@`. `title`: título sin ID ni tags.
- `spec_tags`: unión sin repetir de tags del título y `{ tag }` de TODOS los `test.describe` envolventes y del propio `test()`, sin filtrar ni normalizar.
- Marcas: `test.fixme` → `@fixme`, `test.skip` → `@skip`, `test.only` → `@only`; también `test.skip(true, ...)` / `test.fixme()` a nivel describe, `beforeEach` o archivo (heredado por los tests del scope). Skips condicionales (`test.skip(() => cond, ...)`) NO se marcan; salen en `condSkips`.
- `service` y `services_called` quedan vacías: ningún spec las define hoy. Si eso cambia, revisa el repo y extiende el script en vez de adivinar.

## Verificar y reportar

1. Parsea el CSV con un lector CSV real y confirma que todas las filas tienen 6 columnas.
2. Reporta aparte, al final: total de tests incluidos; tests sin ID (listados, no van al CSV; p. ej. `seed.spec.ts`); IDs duplicados (ambas filas incluidas); tests con más de un ID (usa el primero; las advertencias `MULTI-ID` están en `warns`); skips condicionales; archivos que no son `.spec.ts` y que definen tests; conteo por prefijo de ID y por tag `@team_*`; convenciones de tags/IDs notadas.
