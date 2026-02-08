"use client"

import { useState, useCallback } from "react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface CloudFile {
  name: string
  path: string
  createdAt: string
  size: number
}

interface UseCloudStorageProps {
  user: SupabaseUser | null
  getAccessToken: () => Promise<string | null>
}

export function useCloudStorage({ user, getAccessToken }: UseCloudStorageProps) {
  const [files, setFiles] = useState<CloudFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showPanel, setShowPanel] = useState(false)

  const fetchFiles = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await fetch("/api/pdf-storage", {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setFiles(data.files || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [user, getAccessToken])

  const uploadFile = useCallback(async (
    pdfBytes: Uint8Array,
    fileName: string,
    onProgress?: (label: string, percent: number) => void
  ) => {
    if (!user) throw new Error("로그인이 필요합니다.")

    setUploading(true)
    onProgress?.("업로드 중", 60)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("로그인이 필요합니다.")

      const formData = new FormData()
      formData.append("file", new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }))
      formData.append("fileName", fileName)

      onProgress?.("업로드 중", 80)
      const res = await fetch("/api/pdf-storage", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "업로드 실패")

      onProgress?.("완료", 100)
      await fetchFiles()
    } finally {
      setUploading(false)
    }
  }, [user, getAccessToken, fetchFiles])

  const downloadFile = useCallback(async (path: string): Promise<ArrayBuffer> => {
    if (!user) throw new Error("로그인이 필요합니다.")

    const token = await getAccessToken()
    if (!token) throw new Error("로그인이 필요합니다.")

    const res = await fetch("/api/pdf-storage", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ path }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "다운로드 실패")

    const pdfRes = await fetch(data.signedUrl)
    return await pdfRes.arrayBuffer()
  }, [user, getAccessToken])

  const deleteFile = useCallback(async (path: string) => {
    if (!user) return

    try {
      const token = await getAccessToken()
      if (!token) return

      const res = await fetch("/api/pdf-storage", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ path }),
      })

      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.path !== path))
      }
    } catch {
      // ignore
    }
  }, [user, getAccessToken])

  const togglePanel = useCallback(() => {
    setShowPanel((prev) => {
      if (!prev) fetchFiles()
      return !prev
    })
  }, [fetchFiles])

  const closePanel = useCallback(() => {
    setShowPanel(false)
  }, [])

  return {
    files,
    loading,
    uploading,
    showPanel,
    fetchFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    togglePanel,
    closePanel,
  }
}
