# Runtime: repositories, ADMIN_URL, and Playwright

Load this before the first test run.

## Bind repositories and authorization

Resolve e2e-testing from the current worktree. Resolve admin-ff from the user's absolute path, otherwise check sibling `../admin-ff`. If absent or ambiguous, ask for the intended checkout and stop. Do not select an unrelated worktree automatically. Read its repository instructions before edits.

Local execution may still contact remote APIs, identity providers, or test-data services. Before remote work, establish explicit authorization for the destination, operation, and credential/session. A local Admin URL, an existing `.env`, or cached authentication is not permission. If authorization is missing, stay with local source/artifact inspection and ask; do not probe remote services to resolve it.

## Bind ADMIN_URL

1. If the user supplied `ADMIN_URL`, use it. Do not infer a remote URL from `.env` or config defaults.
2. If omitted, use local Vite at `http://localhost:5173`:
   - Check the existing local listener and verify that it is the intended admin-ff app before reusing it. A successful HTTP response alone is insufficient.
   - If free, run `pnpm dev` in the resolved admin-ff checkout and wait for readiness at that origin.
   - If startup fails, authentication/dependencies are missing, or another application owns the port, ask. Do not kill the listener, install dependencies, authenticate, or guess another port automatically.
3. Never write `.env` or `.env.*` in either repository. Pass the URL only to the Playwright child process as `ADMIN_URL=<url>`.
4. Leave existing servers and servers started by this session running; report which was reused or started.
5. If admin-ff was changed locally while testing a remote Admin, ask to switch to local or leave verification blocked. Local edits are not deployed; a remote green run cannot verify them.

## Run selected specs

Resolve IDs and globs to concrete spec paths before execution. Use the project's configured test directory; do not assume a Zephyr project prefix alone establishes Admin scope. Confirm each resolved test exercises Admin and the filename matches its case ID.

Functional example:

```bash
ADMIN_URL=<url> npx playwright test <resolved-spec-path> --project=chromium
```

Visual example:

```bash
ADMIN_URL=<url> npx playwright test <resolved-spec-path> --project=visual-testing --grep @visual
```

Check the current Playwright config for the applicable project and artifacts. Run one selected spec at a time, not the entire suite. Show visual diffs; update snapshots only for the explicit case/path authorized by the user. Do not treat a retry pass as proof of stability.

Reports and traces are optional inputs, not prerequisites. Preserve relevant existing evidence before a new run overwrites it. Obtain available failure artifacts from the configured output; report when console, network, timing, or trace evidence was not captured rather than inventing it.
