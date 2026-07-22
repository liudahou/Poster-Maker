#!/bin/sh
set -eu

# Local env files are useful for development, but if Meoo uploads them they can
# override platform Secrets inside the container. Remove them before build.
rm -f .env.local .env

npm ci
npm run build
