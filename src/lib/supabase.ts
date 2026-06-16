import { createClient } from '@supabase/supabase-js';

// Load Supabase credentials from Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug logging (remove in production)
console.debug('Supabase URL:', supabaseUrl);
console.debug('Supabase anon key length:', supabaseAnonKey?.length);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key is missing. Verify that .env contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and that the dev server was restarted.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
