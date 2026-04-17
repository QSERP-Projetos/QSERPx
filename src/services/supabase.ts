import { createClient } from '@supabase/supabase-js';

const legacyUrl = 'https://tcguggbxeuafwjhemqyb.supabase.co';
const legacyAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjZ3VnZ2J4ZXVhZndqaGVtcXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwMTQ5NDcsImV4cCI6MjA1NjU5MDk0N30.eSL6dQUucsJ5Zuyj-IoFDs06h9XIeogA-UgtHRGdZlg';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || legacyUrl;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || legacyAnonKey;

// Criar cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper para verificar autenticação
export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};

// Helper para obter usuário atual
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper para fazer logout
export const signOut = async () => {
  await supabase.auth.signOut();
};
