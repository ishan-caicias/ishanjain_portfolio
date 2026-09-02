#!/usr/bin/env bash
# run-gaia-pipeline.sh — PF-10 C0: local runner for the Gaia dataset conversion pipeline
# (bash/CI equivalent of run-gaia-pipeline.ps1 — see that file for the rationale).
#
# Examples:
#   ./scripts/run-gaia-pipeline.sh --dataset mwsc --sample 10
#   ./scripts/run-gaia-pipeline.sh --dataset mwsc --names "Melotte_22,NGC_1912,NGC_2632"
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ "$#" -eq 0 ]]; then
    echo "Usage: $0 --dataset <mwsc|hunt-reffert-2023> (--names \"A,B,C\" | --sample N) [--out path]" >&2
    exit 1
fi

exec node scripts/gaia-dataset-pipeline.mjs "$@"
