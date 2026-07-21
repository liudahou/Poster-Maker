#!/usr/bin/env bash
set -euo pipefail

npm run start -- -H 0.0.0.0 -p "${PORT:-9000}"
