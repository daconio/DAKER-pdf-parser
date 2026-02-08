"use client"

import { useState, useCallback } from "react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export interface ImageFile {
    name: string
    path: string
    createdAt: string
    size: number
    url: string
}

interface UseImageStorageProps {
    user: SupabaseUser | null
    getAccessToken: () => Promise<string | null>
}

export function useImageStorage({ user, getAccessToken }: UseImageStorageProps) {
    const [images, setImages] = useState<ImageFile[]>([])
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)

    const fetchImages = useCallback(async () => {
        if (!user) return
        setLoading(true)
        try {
            const token = await getAccessToken()
            if (!token) return
            const res = await fetch("/api/image-storage", {
                headers: { Authorization: `Bearer ${token}` }
            })
            const data = await res.json()
            if (res.ok) setImages(data.files || [])
        } catch {
            // ignore
        } finally {
            setLoading(false)
        }
    }, [user, getAccessToken])

    const uploadImage = useCallback(async (
        file: File,
        onProgress?: (label: string, percent: number) => void
    ) => {
        if (!user) throw new Error("로그인이 필요합니다.")

        setUploading(true)
        onProgress?.("업로드 중", 60)

        try {
            const token = await getAccessToken()
            if (!token) throw new Error("로그인이 필요합니다.")

            const formData = new FormData()
            formData.append("file", file)
            formData.append("fileName", file.name)

            onProgress?.("업로드 중", 80)
            const res = await fetch("/api/image-storage", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "업로드 실패")

            onProgress?.("완료", 100)
            await fetchImages()
            return data
        } finally {
            setUploading(false)
        }
    }, [user, getAccessToken, fetchImages])

    const deleteImage = useCallback(async (path: string) => {
        if (!user) return

        try {
            const token = await getAccessToken()
            if (!token) return

            const res = await fetch("/api/image-storage", {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ path }),
            })

            if (res.ok) {
                setImages((prev) => prev.filter((f) => f.path !== path))
            }
        } catch {
            // ignore
        }
    }, [user, getAccessToken])

    return {
        images,
        loading,
        uploading,
        fetchImages,
        uploadImage,
        deleteImage,
    }
}
