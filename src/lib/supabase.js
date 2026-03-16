import { createClient } from '@supabase/supabase-js';

// Replace these with your actual credentials
const supabaseUrl = 'https://gywcfuqrwubjqiowhbsn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5d2NmdXFyd3VianFpb3doYnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDEwMTcsImV4cCI6MjA4OTE3NzAxN30.yWLjbFxnMzZt-zEmyZYHhwotzVXlINRH0fo9lxpXoME';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Secondary client for ABM to prevent auto-login when creating users
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storage: null // Ensure it doesn't touch localStorage
  }
});
