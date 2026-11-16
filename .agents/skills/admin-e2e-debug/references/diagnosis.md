# Evidence-driven Admin E2E diagnosis

## Scope and authority

Start from the selected Admin E2Es, including their authentication, API, and setup dependencies. Repair relevant test infrastructure in e2e-testing or product code in admin-ff only when the evidence demonstrates the cause. Unrelated checkout/PSP cases remain outside scope.

Invoking this skill authorizes the complete local diagnosis → repair → verification loop unless the user explicitly restricts the request to read-only work. Continue from a demonstrated diagnosis directly to the smallest local repair without asking for separate repair approval or approval for each edit. Backend and external services remain diagnosis-only. Ask before changing expected behavior, weakening an assertion, or expanding scope. A legitimate extra interaction can be added when it preserves the same control, intent, and outcome; moved/removed screens or obsolete assertions require clarification.

## Establish the baseline

1. Resolve every selector to concrete specs. Missing or ambiguous files require one focused question. Record the selected set and each test's intended outcome from its assertions and available case documentation.
2. Record git status in both repositories. Read applicable instructions before edits. Preserve staged, unstaged, and untracked work; do not reset, stash, commit, or reformat unrelated files.
3. If reports/traces are supplied or relevant local artifacts exist, inspect them first. Match the spec, attempt, environment, and available revision metadata; unknown freshness must be reported. Preserve relevant artifacts before a new run can overwrite them. Do not treat an old failure as a current reproduction.
4. Run the selected spec with the bound runtime. Capture the failing step, assertion, console errors, request/response evidence, and timing when available. If the failure does not reproduce, report that limit rather than making a speculative edit.

## Diagnose before repairing

Trace the failing observation back to its producer: spec → DSL action/POM/helper → Admin behavior → request/response. Use CodeGraph for structural tracing as required by repository instructions; fall back only when unavailable or failed. Inspect only relevant code and history.

| Failure | Evidence to distinguish the cause | Repair boundary |
| --- | --- | --- |
| Locator or strict-mode error | Rendered control, definition site, same-feature testid constants | Map at the definition site; missing id follows the dedicated reference |
| Flow/assertion mismatch | Expected intent versus actual steps, UI source, and relevant recent changes | Fix test drift or a demonstrated Admin regression, not whichever is easiest |
| Admin runtime/rendering error | Browser error, source path, actual inputs and response | Minimal admin-ff fix preserving intended behavior |
| Authentication/setup/API dependency | First failing operation, status/body or transport error, fixture/config provenance | Relevant e2e-testing or Admin fix only; backend changes are excluded |
| Intermittent behavior | Attempt timings, trace/network ordering, controlled reproduction | Load `../../flaky-rca/SKILL.md`; use its RCA and validation procedure |
| Visual mismatch | Expected, actual, and diff for the selected case | Show the diff; ask before updating that case's baseline |
| Backend/external or unknown | Request, response, timing, and competing explanations | Report confirmed observations and missing proof; stop the affected repair |

Inspect relevant recent admin-ff changes when the evidence points to a product regression. A recent commit or backend error alone does not prove responsibility. Distinguish the payload sent, what backend returned, and how Admin interpreted it. Redact credentials, tokens, and sensitive body fields in evidence and reports. An aborted request is not proof of an external outage.

For HTTP validation inside `api.*` actions, use the repository's `assertHttpResponse` / `checkHttpResponse` contract; do not hand-roll comparisons or log raw bodies. Read `playwright/framework/httpContract.ts` in the repository before changing response assertions.

## Repair and verification

- State the causal hypothesis and the evidence that can confirm or reject it. Apply a bounded fix only after reproduction; use a focused regression test where meaningful under the changed repository's rules.
- Reuse existing helpers and DSL actions. Load `../../dsl-test/SKILL.md` before editing tests; discover actions with `npm run list-actions` and `npm run describe-actions`. Follow generation requirements when an action changes. Do not turn a repair into a broad DSL migration; surface conflicts with repository rules instead of bypassing them.
- Do not hide failures using larger timeouts, arbitrary sleeps, retries, skipped tests, or weaker assertions. Count each repair-and-rerun cycle as one fix attempt per spec. After three unsuccessful attempts, summarize evidence and ask before continuing.
- For deterministic failures, require an observed failing baseline followed by a green rerun of the selected spec. One green run is not evidence that an intermittent failure is resolved: follow the flaky RCA verification procedure and report its actual outcome.
- Run focused checks applicable to the changed repository. Run `npm run pr-review -- --worktree --no-llm` in e2e-testing; resolve findings within scope or explain justified findings without suppressing rules.
- When a POM, plugin, or helper is shared, identify affected Admin tests, explain the impact, and ask whether to execute them. If declined or unavailable, list them as not executed. Finding consumers does not authorize changing them.
- If one spec is blocked, ask whether to continue the remaining selected set or stop. Do not silently skip it or claim the set is green.
- Keep unverified local Admin fixes distinct from deployed behavior. Report blockers, checks not run, and any remaining uncertainty using `report.md`.
