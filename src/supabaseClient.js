import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock or handle gracefully if credentials are missing
    console.warn('Supabase credentials missing on client. Direct Supabase access will be limited.');
    
    // Mocking basic structure to avoid immediate crashes if methods are called
    return {
      auth: {
        signUp: () => Promise.reject(new Error('Supabase configuration missing')),
        signInWithPassword: () => Promise.reject(new Error('Supabase configuration missing')),
        signOut: () => Promise.resolve({ error: null }),
      },
      from: () => ({
        select: () => Promise.reject(new Error('Supabase configuration missing')),
        insert: () => Promise.reject(new Error('Supabase configuration missing')),
        update: () => Promise.reject(new Error('Supabase configuration missing')),
        delete: () => Promise.reject(new Error('Supabase configuration missing')),
      })
    };
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};

// For backward compatibility if needed, but getSupabase() is preferred
export const supabase = getSupabase();
