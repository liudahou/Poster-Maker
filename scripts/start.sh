#!/bin/sh
set -eu

# Keep platform Secrets in charge at runtime too. Some image deployments may
# preserve uploaded local env files even if setup.sh removed them during build.
# Keep .env because Meoo may use it to inject runtime project and secret values.
rm -f .env.local

npm run start -- -H 0.0.0.0 -p "${PORT:-9000}"
