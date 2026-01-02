// Supabase Configuration
// This file gets populated from environment variables during Netlify build
const supabaseUrl = '{{SUPABASE_URL}}';
const supabaseKey = '{{SUPABASE_KEY}}';

// Use 'supabaseClient' to avoid collision with the global 'supabase' library object from the CDN
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
