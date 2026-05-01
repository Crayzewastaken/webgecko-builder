// lib/supabase.ts
// Supabase client — server-side (uses service role key for full access)
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side client with full privileges (use in API routes)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Browser-safe client (use in client components)
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
