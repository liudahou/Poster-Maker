#!/bin/sh
set -eu

# Keep platform Secrets in charge at runtime too. Some image deployments may
# preserve uploaded local env files even if setup.sh removed them during build.
rm -f .env.local .env

npm run start -- -H 0.0.0.0 -p "${PORT:-9000}"
