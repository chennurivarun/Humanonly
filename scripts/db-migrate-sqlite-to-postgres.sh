#!/bin/bash

# HumanOnly SQLite -> PostgreSQL Migration Script (V1 Prototype)
# 
# Purpose: Export current SQLite-backed app state to governed snapshot, then import to Postgres.
# Usage:
#   1. Export snapshot: ./scripts/db-migrate-sqlite-to-postgres.sh export <sqlite_db_file> <snapshot_file>
#   2. Import to Postgres: ./scripts/db-migrate-sqlite-to-postgres.sh import <snapshot_file> <postgres_url>
# 
# Prerequisites:
#   - jq, sqlite3, psql (for direct script usage)
#   - HumanOnly app state (governed snapshot JSON)
# 
# SAFETY RULE:
# - Always backup SQLite file before execution.
# - Always run with maintenance mode (freeze write window) during export/import.

set -e

ACTION=$1
INPUT=$2
OUTPUT=$3

function show_usage() {
    echo "Usage: $0 export <sqlite_db_file> <snapshot_file>"
    echo "       $0 import <snapshot_file> <postgres_url>"
    exit 1
}

if [[ -z "$ACTION" || -z "$INPUT" || -z "$OUTPUT" ]]; then
    show_usage
fi

if [[ "$ACTION" == "export" ]]; then
    echo "[MIGRATE] Exporting snapshot from SQLite: $INPUT to $OUTPUT..."
    # Placeholder for export logic (calling the app's export API or logic)
    # Recommended: Use 'npm run db:export' when available.
    echo "[INFO] Snapshot export complete (placeholder)."
elif [[ "$ACTION" == "import" ]]; then
    echo "[MIGRATE] Importing snapshot from $INPUT into Postgres: $OUTPUT..."
    # Placeholder for import logic
    # Recommended: Use 'npm run db:import' when available.
    echo "[INFO] Snapshot import complete (placeholder)."
else
    show_usage
fi

echo "[MIGRATE] Operation $ACTION completed successfully."
