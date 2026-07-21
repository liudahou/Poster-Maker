#!/bin/sh
set -eu

npm run start -- -H 0.0.0.0 -p "${PORT:-9000}"
