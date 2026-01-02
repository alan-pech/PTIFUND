#!/bin/bash
# Build script for Netlify deployment
# This replaces placeholders in config.template.js with environment variables

echo "Building config.js from template..."

# Replace placeholders with environment variables
sed "s|{{SUPABASE_URL}}|$SUPABASE_URL|g; s|{{SUPABASE_KEY}}|$SUPABASE_KEY|g" js/config.template.js > js/config.js

echo "config.js generated successfully"
cat js/config.js
