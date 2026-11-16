#!/usr/bin/env bash
#
# Reproduces .github/workflows/e2e-testing-hub.yml locally: same env vars
# (the ones the workflow gets from repository_dispatch's client_payload, plus
# the "Run Playwright tests" step's own env block) and the exact same
# "CI=true npx playwright test ..." command, branched on TEST_GREP the same
# way the workflow does. Use it to reproduce a CI run without waiting for a
# real dispatch from payconnect-testing-hub.
#
# Covers both trigger flows:
#   - psp-wide:             PROCESSOR_ID + TEST_CONFIGS (country-shaped), TEST_GREP = "@integration-hub"
#   - merchant-granularity: PROCESSOR_NAME + VERSION_ID + ENTITY_ID (TEST_CONFIGS
#                           is then pulled from payconnect-testing-hub by
#                           loadIhubConfig, same as in CI), TEST_GREP = the
#                           scenario's own IHUB-Txxx id
#
# Usage:
#   cp e2e-hub-action.env.template .env.e2e-hub-action.local   # once, then fill it in
#   ./scripts/run-e2e-hub-action-locally.sh --grep IHUB-T101
#
# Flags (all optional — override whatever's in .env.e2e-hub-action.local):
#   --grep <value>            TEST_GREP
#   --processor-id <value>    PROCESSOR_ID
#   --processor-name <value>  PROCESSOR_NAME
#   --test-configs <json>     TEST_CONFIGS
#   --version-id <value>      VERSION_ID
#   --entity-id <value>       ENTITY_ID
#   --callback-url <url>      CALLBACK_URL
#   --install                 also run `npm ci` + `playwright install --with-deps chromium`
#                             first, like the workflow does (skipped by default —
#                             assumes your local deps/browsers are already set up)
#   --debug                   append --reporter=list. Under CI=true (which this
#                             script always sets, to match the workflow),
#                             playwright.config.ts's reporters are [html, blob]
#                             only — no console output — so a globalSetup
#                             crash (e.g. loadIhubConfig failing) shows up as
#                             a silent "0 tests"/"failed" with no visible
#                             error. --debug surfaces it.
#   -h, --help                show this help and exit
set -euo pipefail
cd "$(dirname "$0")/.."

LOCAL_ENV_FILE=".env.e2e-hub-action.local"
DO_INSTALL=false
# A plain string, not an array: macOS's default /bin/bash is 3.2, where
# "${arr[@]}" on an empty array trips `set -u` as an unbound variable. The
# flag is a single token with no spaces, so unquoted word-splitting below is
# intentional and safe.
DEBUG_REPORTER=""

# Reads KEY=VALUE lines and exports them as-is, without re-parsing the value
# through the shell — so a TEST_GREP like "@ihub-general|@ihub-dummy-psp" (or
# any value with $, #, spaces, etc.) is taken literally instead of being
# interpreted as a pipe/substitution/glob. `source`-ing the file directly
# doesn't have this property, since a raw "|" there is a real shell pipe.
load_env_file() {
  local file="$1" line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|'#'*) continue ;; esac
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"
    value="${line#*=}"
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:-1}"
    fi
    export "$key=$value"
  done < "$file"
}

# Load defaults from the untracked local env file first (see
# e2e-hub-action.env.template for the full list of vars) — flags parsed below
# take precedence over whatever's in it, including its blank placeholders.
if [ -f "$LOCAL_ENV_FILE" ]; then
  load_env_file "$LOCAL_ENV_FILE"
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --grep) TEST_GREP="$2"; shift 2 ;;
    --processor-id) PROCESSOR_ID="$2"; shift 2 ;;
    --processor-name) PROCESSOR_NAME="$2"; shift 2 ;;
    --test-configs) TEST_CONFIGS="$2"; shift 2 ;;
    --version-id) VERSION_ID="$2"; shift 2 ;;
    --entity-id) ENTITY_ID="$2"; shift 2 ;;
    --callback-url) CALLBACK_URL="$2"; shift 2 ;;
    --install) DO_INSTALL=true; shift ;;
    --debug) DEBUG_REPORTER="--reporter=list"; shift ;;
    -h|--help) sed -n '2,33p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ── client_payload-equivalent env vars ──────────────────────────────────────
export CALLBACK_URL="${CALLBACK_URL:-}"
export TEST_GREP="${TEST_GREP:-}"
export PROCESSOR_ID="${PROCESSOR_ID:-}"
export PROCESSOR_NAME="${PROCESSOR_NAME:-}"
export TEST_CONFIGS="${TEST_CONFIGS:-}"
export VERSION_ID="${VERSION_ID:-}"
export ENTITY_ID="${ENTITY_ID:-}"

# ── "Run Playwright tests" step's own env block ─────────────────────────────
export NODE_ENV=staging
export NODE_OPTIONS="--max-old-space-size=4096"
export METABASE_USER="${METABASE_USER:-}"
export METABASE_PASSWORD="${METABASE_PASSWORD:-}"
export MB_USER="${MB_USER:-$METABASE_USER}"
export MB_PASSWORD="${MB_PASSWORD:-$METABASE_PASSWORD}"
export PAYCONNECT_TESTING_HUB_API_KEY="${PAYCONNECT_TESTING_HUB_API_KEY:-}"

if $DO_INSTALL; then
  echo "Installing dependencies (--install)..."
  npm ci
  npx playwright install --with-deps chromium
fi

if [ -z "$TEST_GREP" ]; then
  echo "No grep provided, running all tests"
  CI=true npx playwright test @QA-T434 --project=chromium --workers 1 $DEBUG_REPORTER
else
  echo "Running tests with grep: $TEST_GREP"
  CI=true npx playwright test playwright/tests/integration-hub --grep "$TEST_GREP" --project=chromium --workers 1 $DEBUG_REPORTER
fi
