#!/bin/bash
# Build script for Netlify deployment
# This replaces placeholders in config.template.js with environment variables

echo "Building config.js from template..."

# Replace placeholders with environment variables
# Handle both SUPABASE_KEY and SUPABASE_ANON_KEY for convenience
SB_KEY=${SUPABASE_KEY:-$SUPABASE_ANON_KEY}

if [ -z "$SUPABASE_URL" ] || [ -z "$SB_KEY" ]; then
  echo "ERROR: SUPABASE_URL or SUPABASE_KEY/SUPABASE_ANON_KEY not set!"
  exit 1
fi

sed "s|{{SUPABASE_URL}}|$SUPABASE_URL|g; s|{{SUPABASE_KEY}}|$SB_KEY|g" js/config.template.js > js/config.js

echo "config.js generated successfully"
# cat js/config.js | sed 's/key = .*/key = "HIDDEN"/' # Optional: mask key in logs
