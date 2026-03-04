#!/bin/bash

# HumanOnly SQLite -> PostgreSQL cutover helper
#
# Thin shell wrapper for the governed TypeScript cutover script.
# Prefer this command from repo root:
#   npm run db:cutover:postgres -- --action=plan ...
#
# Backward-compatible usage:
#   ./scripts/db-migrate-sqlite-to-postgres.sh plan   [extra flags]
#   ./scripts/db-migrate-sqlite-to-postgres.sh apply  [extra flags]
#   ./scripts/db-migrate-sqlite-to-postgres.sh verify [extra flags]

set -euo pipefail

ACTION=${1:-}
shift || true

if [[ -z "$ACTION" ]]; then
  echo "Usage: $0 <plan|apply|verify> [flags]"
  echo "Example: $0 apply --execute --human-approval-ref=CHANGE-123 --postgres-url=postgres://..."
  exit 1
fi

if [[ "$ACTION" != "plan" && "$ACTION" != "apply" && "$ACTION" != "verify" ]]; then
  echo "Invalid action '$ACTION'. Expected one of: plan, apply, verify"
  exit 1
fi

npm run db:cutover:postgres -w apps/web -- --action="$ACTION" "$@"
