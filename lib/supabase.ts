
import { createClient } from '@supabase/supabase-js';

// Safely access environment variables to prevent crashes if import.meta.env is undefined
const getEnvVar = (key: string) => {
  try {
    // @ts-ignore
    return import.meta.env?.[key];
  } catch (e) {
    console.warn(`Error accessing env var ${key}`, e);
    return undefined;
  }
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

if (!isSupabaseConfigured) {
  console.warn("Supabase credentials missing or invalid. Cloud features will be disabled.");
}

// Initialize with real keys or fallback placeholders to prevent instantiation crashes.
// If placeholders are used, actual network requests will simply fail/be blocked, which we handle in the services.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);
