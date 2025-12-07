#!/bin/bash
# Netlify build script - injects WS_URL environment variable into config.js

if [ -n "$WS_URL" ]; then
  echo "Injecting WS_URL: $WS_URL"
  echo "window.WS_URL = \"$WS_URL\";" > config.js
else
  echo "WS_URL not set, using null"
  echo "window.WS_URL = null;" > config.js
fi
