"use client"

import { useState, useCallback } from "react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export interface EmailTemplate {
  id: string
  user_id: string
  name: string
  type: "header" | "footer" | "signature"
  content: string
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AddTemplateParams {
  name: string
  type: EmailTemplate["type"]
  content: string
  is_default?: boolean
}

interface UseEmailTemplatesProps {
  user: SupabaseUser | null
  getAccessToken: () => Promise<string | null>
}

export function useEmailTemplates({ user, getAccessToken }: UseEmailTemplatesProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Undo/Redo history for templates
  const [undoStack, setUndoStack] = useState<EmailTemplate[][]>([])
  const [redoStack, setRedoStack] = useState<EmailTemplate[][]>([])

  // Push current state to undo stack
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), templates])
    setRedoStack([])
  }, [templates])

  // 템플릿 목록 조회
  const fetchTemplates = useCallback(async (type?: EmailTemplate["type"]) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const params = new URLSearchParams()
      if (type) params.set("type", type)

      const response = await fetch(`/api/email-templates?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setTemplates(data.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }, [user, getAccessToken])

  // 템플릿 추가
  const addTemplate = useCallback(async (template: AddTemplateParams): Promise<boolean> => {
    if (!user) {
      setError("로그인이 필요합니다.")
      return false
    }

    setError(null)
    pushUndo()

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const response = await fetch("/api/email-templates", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(template),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setTemplates(prev => [...prev, data.template])
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿 추가에 실패했습니다.")
      return false
    }
  }, [user, getAccessToken, pushUndo])

  // 템플릿 수정
  const updateTemplate = useCallback(async (
    id: string,
    updates: Partial<Omit<EmailTemplate, "id" | "user_id" | "created_at" | "updated_at">>
  ): Promise<boolean> => {
    if (!user) {
      setError("로그인이 필요합니다.")
      return false
    }

    setError(null)
    pushUndo()

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const response = await fetch("/api/email-templates", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, ...updates }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setTemplates(prev => prev.map(t => t.id === id ? data.template : t))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿 수정에 실패했습니다.")
      return false
    }
  }, [user, getAccessToken, pushUndo])

  // 템플릿 삭제
  const deleteTemplates = useCallback(async (ids: string[]): Promise<boolean> => {
    if (!user) {
      setError("로그인이 필요합니다.")
      return false
    }

    setError(null)
    pushUndo()

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const response = await fetch("/api/email-templates", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setTemplates(prev => prev.filter(t => !ids.includes(t.id)))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "템플릿 삭제에 실패했습니다.")
      return false
    }
  }, [user, getAccessToken, pushUndo])

  // 템플릿 순서 변경
  const reorderTemplates = useCallback(async (
    updates: Array<{ id: string; sort_order: number }>
  ): Promise<boolean> => {
    if (!user) {
      setError("로그인이 필요합니다.")
      return false
    }

    setError(null)
    pushUndo()

    // Optimistic update
    setTemplates(prev => {
      const updated = [...prev]
      for (const update of updates) {
        const idx = updated.findIndex(t => t.id === update.id)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], sort_order: update.sort_order }
        }
      }
      return updated.sort((a, b) => a.sort_order - b.sort_order)
    })

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const response = await fetch("/api/email-templates", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ updates }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "순서 변경에 실패했습니다.")
      // Revert on error
      await fetchTemplates()
      return false
    }
  }, [user, getAccessToken, pushUndo, fetchTemplates])

  // 기본 템플릿 설정
  const setDefaultTemplate = useCallback(async (id: string): Promise<boolean> => {
    return updateTemplate(id, { is_default: true })
  }, [updateTemplate])

  // 템플릿 복제
  const duplicateTemplate = useCallback(async (id: string): Promise<boolean> => {
    const template = templates.find(t => t.id === id)
    if (!template) {
      setError("템플릿을 찾을 수 없습니다.")
      return false
    }

    return addTemplate({
      name: `${template.name} (복사본)`,
      type: template.type,
      content: template.content,
      is_default: false,
    })
  }, [templates, addTemplate])

  // Undo
  const undo = useCallback(async () => {
    if (undoStack.length === 0) return

    const previousState = undoStack[undoStack.length - 1]
    setRedoStack(prev => [...prev, templates])
    setUndoStack(prev => prev.slice(0, -1))
    setTemplates(previousState)

    // Note: This is a local undo, server state may differ
    // For full consistency, you'd need to sync with server
  }, [undoStack, templates])

  // Redo
  const redo = useCallback(async () => {
    if (redoStack.length === 0) return

    const nextState = redoStack[redoStack.length - 1]
    setUndoStack(prev => [...prev, templates])
    setRedoStack(prev => prev.slice(0, -1))
    setTemplates(nextState)
  }, [redoStack, templates])

  // Get templates by type
  const getHeaderTemplates = useCallback(() =>
    templates.filter(t => t.type === "header"), [templates])

  const getFooterTemplates = useCallback(() =>
    templates.filter(t => t.type === "footer"), [templates])

  const getSignatureTemplates = useCallback(() =>
    templates.filter(t => t.type === "signature"), [templates])

  // Get default template by type
  const getDefaultTemplate = useCallback((type: EmailTemplate["type"]) =>
    templates.find(t => t.type === type && t.is_default), [templates])

  // Clipboard operations
  const [clipboard, setClipboard] = useState<EmailTemplate | null>(null)

  const copyTemplate = useCallback((id: string) => {
    const template = templates.find(t => t.id === id)
    if (template) {
      setClipboard({ ...template })
    }
  }, [templates])

  const cutTemplate = useCallback(async (id: string): Promise<boolean> => {
    const template = templates.find(t => t.id === id)
    if (template) {
      setClipboard({ ...template })
      return deleteTemplates([id])
    }
    return false
  }, [templates, deleteTemplates])

  const pasteTemplate = useCallback(async (): Promise<boolean> => {
    if (!clipboard) {
      setError("클립보드가 비어있습니다.")
      return false
    }

    return addTemplate({
      name: `${clipboard.name} (붙여넣기)`,
      type: clipboard.type,
      content: clipboard.content,
      is_default: false,
    })
  }, [clipboard, addTemplate])

  return {
    templates,
    loading,
    error,
    clipboard,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    fetchTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplates,
    reorderTemplates,
    setDefaultTemplate,
    duplicateTemplate,
    undo,
    redo,
    copyTemplate,
    cutTemplate,
    pasteTemplate,
    getHeaderTemplates,
    getFooterTemplates,
    getSignatureTemplates,
    getDefaultTemplate,
    clearError: () => setError(null),
  }
}
