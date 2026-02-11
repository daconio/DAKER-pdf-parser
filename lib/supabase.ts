import { createBrowserClient } from "@supabase/ssr"
import { SupabaseClient } from "@supabase/supabase-js"

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Supabase 환경변수가 설정되지 않았습니다.\n" +
      "Vercel Dashboard → Settings → Environment Variables에서 다음을 설정하세요:\n" +
      "- NEXT_PUBLIC_SUPABASE_URL\n" +
      "- NEXT_PUBLIC_SUPABASE_ANON_KEY\n" +
      "설정 후 재배포(Redeploy)가 필요합니다."
    )
    // Throw error in production to prevent silent failures
    if (typeof window !== "undefined") {
      throw new Error("Supabase configuration missing. Check environment variables.")
    }
  }

  _supabase = createBrowserClient(supabaseUrl!, supabaseAnonKey!)
  return _supabase
}
