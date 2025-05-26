import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ihkkzvlzdzmtmsmjqgjd.supabase.co';         // Replace with your Supabase URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloa2t6dmx6ZHptdG1zbWpxZ2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyODIxNjMsImV4cCI6MjA2Mzg1ODE2M30.MVfiBFU9ZpuCX8pR94wauTFYR_z0aLw2FivkzHKvyFE';  // Replace with your anon key

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
});
