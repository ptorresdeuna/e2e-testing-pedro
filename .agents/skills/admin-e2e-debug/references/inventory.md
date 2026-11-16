# Testid inventory and mapping

Load this after reproducing a locator failure, before editing locators. Inventory the selected set once; retain the failing baseline before applying remaps.

## Extract IDs the specs actually use

1. Open each given spec. Record imported admin POMs (`playwright/pages/admin/**`) and admin DSL plugins (`playwright/framework/plugins/admin/**`).
2. From those files (not from the spec), collect:
   - `getByTestId('…')` / `getByTestId("…")` / ``getByTestId(`…`)``
   - `[data-testid=…]` / `[data-testid^=…]`
   - Values of local `DATA_TEST_IDS` / `*_TEST_IDS` objects used by those locators
3. Ignore checkout/vault/payment locators. This inventory is admin UI only.
4. Keep the **definition path + line** with each string. That is the only place a remap may be written.

## Cross against admin-ff

Search the resolved admin-ff repo, not e2e-testing.

Prefer feature constants over raw JSX:

- `src/**/constants/dataTestIds.ts`
- `src/**/constants/test-ids/**`
- symbols `*_TEST_IDS`, `DATA_TEST_IDS`, `DATA_TEST_ID_SCOPE`

Then search JSX/`data-testid=` only if the constant files do not decide it.

**Same feature** means the admin-ff view/component that implements the screen the POM is exercising (e.g. Reports POM → `src/components/views/Reports/**`), not a fuzzy match across the whole admin-ff tree.

## Confidence

Before any automatic remap, establish that the rendered candidate's role/name, its source action or handler, and its place in the flow preserve the selected test's intended operation and outcome. Record the supporting source/runtime evidence. Uniqueness, matching prefixes, element types, and unchanged constant keys are not proof of equivalent purpose.

For example, a sole remaining cancel button cannot replace a refund button merely because both belong to Orders. If equivalent purpose is unproven or the intended control was removed, present the evidence and ask; do not remap or assume a missing testid.

| Result in the same feature                                                                                                                 | Action                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Exact string still present                                                                                                                 | No remap                                                            |
| Constant **key** unchanged, **value** changed, single candidate                                                                            | Auto-remap at the definition site only after proving equivalent purpose |
| Dead string, exactly one obvious sibling (same scope prefix + same element type, or the only remaining control of that role on the screen) | Auto-remap only after proving equivalent purpose; otherwise ask       |
| Dead string, 0 candidates                                                                                                                  | Confirm the intended control still exists; then use `admin-ff-testid.md` if its id is missing, otherwise ask |
| Dead string, ≥2 candidates                                                                                                                 | Interrogate. Show each candidate with file + JSX snippet + constant |

Do not grep-best-match across unrelated features (`orders-button-save` must not snap to a reports toast).

## After remaps

- Do not duplicate the new string into the spec.
- If the spec is already DSL, keep calling the same action; the POM under it carries the new id.
- List affected Admin E2Es consuming the changed POM/plugin, directly or through shared helpers. Ask the user whether to execute them; report any that were not run.
