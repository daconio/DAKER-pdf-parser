import { createClient, SupabaseClient } from "@supabase/supabase-js"

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!supabaseUrl || supabaseUrl === "your_supabase_url_here") {
    // Return a dummy client that won't crash — auth calls will simply fail gracefully
    _supabase = createClient("https://placeholder.supabase.co", "placeholder")
  } else {
    _supabase = createClient(supabaseUrl, supabaseAnonKey)
  }
  return _supabase
}

