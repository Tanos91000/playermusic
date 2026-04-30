#!/usr/bin/env sh
set -e
wait-on -t 120000 http://127.0.0.1:3005
exec electron .
