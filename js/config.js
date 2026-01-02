// Supabase Configuration
// Replace with your actual project URL and Anon Key
const supabaseUrl = 'https://qqauqfzkfmomztfwwull.supabase.co';
const supabaseKey = 'sb_publishable_iY16s4oZvnU9-73qbzJolw_Hbm7W6GP';

// Use 'supabaseClient' to avoid collision with the global 'supabase' library object from the CDN
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
