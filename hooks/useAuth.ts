"use client"

import { useState, useEffect, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export function useAuth() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }, [])

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut()
    setUser(null)
  }, [])

  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await getSupabase().auth.getSession()
    return session?.access_token || null
  }, [])

  return {
    user,
    loading,
    signInWithGoogle,
    signOut,
    getAccessToken,
  }
}
