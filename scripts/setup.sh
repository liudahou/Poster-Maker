#!/bin/sh
set -eu

# Local .env.local is useful for development, but if Meoo uploads it, it can
# override platform Secrets inside the container. Keep .env because Meoo may use
# it to inject runtime project and secret values.
rm -f .env.local

npm ci
npm run build
