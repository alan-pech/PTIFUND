// Supabase Configuration
const supabaseUrl = '{{SUPABASE_URL}}';
const supabaseKey = '{{SUPABASE_KEY}}';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Cloudflare R2 Configuration (S3 Compatible)
const R2_CONFIG = {
    accessKeyId: '{{R2_ACCESS_KEY_ID}}',
    secretAccessKey: '{{R2_SECRET_ACCESS_KEY}}',
    endpoint: '{{R2_ENDPOINT}}',
    bucketName: '{{R2_BUCKET_NAME}}',
    publicUrl: '{{R2_PUBLIC_URL}}'
};
