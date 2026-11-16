---
name: admin-e2e-debug
description: "Trigger: Admin E2E failures, debugging, stale locators, visual drift. Execute, diagnose, and fix selected Admin tests or admin-ff defects."
license: ISC
metadata:
  author: e2e-testing
  version: "2.0"
---

# admin-e2e-debug

## Activation Contract

Start from one or more existing Admin E2Es: Zephyr IDs or spec paths/globs. Invoking this skill starts automatic diagnosis, repair, and verification within the boundaries below; an explicit read-only request limits it to diagnosis. Reports and traces are optional. If selectors are missing, ask once and stop. Standalone Admin symptoms, new test creation, unrelated checkout/PSP flows, and broad DSL migrations are outside this entry point.

## Hard Rules

- Fix demonstrated causes in admin-ff or e2e-testing; diagnose backend and external services without modifying them.
- Preserve intended product behavior and test assertions. Ask before changing either; current UI source is evidence, not proof of correctness.
- Keep edits local and uncommitted. Preserve unrelated work. Do not write `.env*`, publish, or update snapshots without explicit authorization.
- Ask one question at a time, then stop. Local repair authority does not authorize unspecified remote destinations, operations, or credentials.
- Read each repository's instructions before editing it. Before test edits, load `../dsl-test/SKILL.md`; follow its action discovery and generation requirements. Keep locators at their POM/plugin definition sites.

## Decision Gates

| Evidence | Route |
| --- | --- |
| Locator mismatch | Read `references/inventory.md`; map only one same-feature candidate with demonstrated equivalent purpose |
| Missing testid | Read `references/admin-ff-testid.md` |
| Intermittent failure | Load `../flaky-rca/SKILL.md` before diagnosis |
| Product intent unclear, ambiguous mapping, or visual mismatch | Present evidence and ask; never weaken checks to get green |
| Backend/external failure or insufficient evidence | Report evidence, limits, and blocker; do not claim a cause without proof |
| Shared POM/plugin/helper changed | Identify affected Admin E2Es and ask before executing them |

## Execution Steps

1. Read `references/diagnosis.md` and `references/runtime.md`. Resolve selectors, repositories, runtime, and authorization. Read optional artifacts before rerunning; preserve relevant evidence.
2. Run selected specs one at a time. Reproduce and classify the failure before edits. Read repository-root `docs/flaky-test-patterns.md` before test/POM changes.
3. Follow the diagnosis loop. Apply the smallest causal fix locally without per-edit approval; stop for unresolved expected-behavior decisions. At most three fix attempts per spec; ask before a fourth.
4. Rerun the failed spec and applicable checks for the changed repository. For shared changes, request affected-test execution separately. Distinguish deterministic verification from flaky validation.
5. Return `references/report.md`, including blocked and unverified outcomes. Leave both working trees uncommitted.

## Output Contract

Use the report template even when blocked. Separate observed facts, hypotheses, fixes, verification, and coverage not executed.

## References

- `references/diagnosis.md` — evidence, attribution, repairs, and completion.
- `references/runtime.md` — repositories, local server, authorization, and execution.
- `references/inventory.md` — locator mapping after reproduction.
- `references/admin-ff-testid.md` — missing testids.
- `references/report.md` — required result format.
