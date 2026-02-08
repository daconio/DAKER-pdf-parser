"use client"

import { useState, useCallback } from "react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export interface EmailContact {
  id: string
  user_id: string
  email: string
  name: string | null
  group_name: string
  created_at: string
}

export interface AddContactParams {
  email: string
  name?: string
  group_name?: string
}

interface UseEmailContactsProps {
  user: SupabaseUser | null
  getAccessToken: () => Promise<string | null>
}

export function useEmailContacts({ user, getAccessToken }: UseEmailContactsProps) {
  const [contacts, setContacts] = useState<EmailContact[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 연락처 목록 조회
  const fetchContacts = useCallback(async (group?: string, search?: string) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const params = new URLSearchParams()
      if (group && group !== "all") params.set("group", group)
      if (search) params.set("search", search)

      const response = await fetch(`/api/email-contacts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setContacts(data.contacts || [])
      setGroups(data.groups || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "연락처를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }, [user, getAccessToken])

  // 단일 연락처 추가
  const addContact = useCallback(async (contact: AddContactParams): Promise<boolean> => {
    if (!user) {
      setError("로그인이 필요합니다.")
      return false
    }

    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const response = await fetch("/api/email-contacts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contacts: [contact] }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      await fetchContacts()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "연락처 추가에 실패했습니다.")
      return false
    }
  }, [user, getAccessToken, fetchContacts])

  // 대량 연락처 추가
  const addBulkContacts = useCallback(async (contactList: AddContactParams[]): Promise<{ success: boolean; count: number }> => {
    if (!user) {
      setError("로그인이 필요합니다.")
      return { success: false, count: 0 }
    }

    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const response = await fetch("/api/email-contacts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contacts: contactList }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      await fetchContacts()
      return { success: true, count: data.count || contactList.length }
    } catch (err) {
      setError(err instanceof Error ? err.message : "대량 등록에 실패했습니다.")
      return { success: false, count: 0 }
    } finally {
      setLoading(false)
    }
  }, [user, getAccessToken, fetchContacts])

  // CSV 문자열 파싱 (이메일, 이름 형식)
  const parseCSV = useCallback((csvText: string, groupName?: string): AddContactParams[] => {
    const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean)
    const result: AddContactParams[] = []

    for (const line of lines) {
      // 쉼표로 분리, 첫 번째는 이메일, 두 번째는 이름
      const parts = line.split(",").map(p => p.trim())
      if (parts.length >= 1 && parts[0]) {
        const email = parts[0]
        const name = parts[1] || undefined
        result.push({ email, name, group_name: groupName || "default" })
      }
    }

    return result
  }, [])

  // 연락처 수정
  const updateContact = useCallback(async (
    id: string,
    updates: Partial<Omit<EmailContact, "id" | "user_id" | "created_at">>
  ): Promise<boolean> => {
    if (!user) {
      setError("로그인이 필요합니다.")
      return false
    }

    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const response = await fetch("/api/email-contacts", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, ...updates }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "연락처 수정에 실패했습니다.")
      return false
    }
  }, [user, getAccessToken])

  // 연락처 삭제 (단일 또는 다중)
  const deleteContacts = useCallback(async (ids: string[]): Promise<boolean> => {
    if (!user) {
      setError("로그인이 필요합니다.")
      return false
    }

    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const response = await fetch("/api/email-contacts", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setContacts(prev => prev.filter(c => !ids.includes(c.id)))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "연락처 삭제에 실패했습니다.")
      return false
    }
  }, [user, getAccessToken])

  return {
    contacts,
    groups,
    loading,
    error,
    fetchContacts,
    addContact,
    addBulkContacts,
    parseCSV,
    updateContact,
    deleteContacts,
    clearError: () => setError(null),
  }
}
