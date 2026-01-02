#!/bin/bash
# Build script for Netlify deployment
# This replaces placeholders in config.template.js with environment variables

echo "Building config.js from template..."

# Replace placeholders with environment variables
SB_KEY=${SUPABASE_KEY:-$SUPABASE_ANON_KEY}

if [ -z "$SUPABASE_URL" ] || [ -z "$SB_KEY" ]; then
  echo "ERROR: SUPABASE_URL or SUPABASE_KEY/SUPABASE_ANON_KEY not set!"
  exit 1
fi

sed "s|{{SUPABASE_URL}}|$SUPABASE_URL|g; \
     s|{{SUPABASE_KEY}}|$SB_KEY|g; \
     s|{{R2_ACCESS_KEY_ID}}|$R2_ACCESS_KEY_ID|g; \
     s|{{R2_SECRET_ACCESS_KEY}}|$R2_SECRET_ACCESS_KEY|g; \
     s|{{R2_ENDPOINT}}|$R2_ENDPOINT|g; \
     s|{{R2_BUCKET_NAME}}|$R2_BUCKET_NAME|g; \
     s|{{R2_PUBLIC_URL}}|$R2_PUBLIC_URL|g" js/config.template.js > js/config.js

echo "config.js generated successfully"
