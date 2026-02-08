"use client"

import { Image as ImageIcon, X, Trash2, Loader2, Upload, Copy, Check } from "lucide-react"
import { useRef, useState } from "react"
import { ImageFile } from "@/hooks/useImageStorage"
import Image from "next/image"

interface ImagePanelProps {
    isOpen: boolean
    images: ImageFile[]
    loading: boolean
    uploading: boolean
    onClose: () => void
    onUpload: (file: File) => Promise<void>
    onDelete: (path: string) => Promise<void>
    onSelect?: (url: string) => void
}

export function ImagePanel({
    isOpen,
    images,
    loading,
    uploading,
    onClose,
    onUpload,
    onDelete,
    onSelect,
}: ImagePanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

    if (!isOpen) return null

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            await onUpload(file)
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }
    }

    const handleCopyUrl = (url: string, e: React.MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText(url)
        setCopiedUrl(url)
        setTimeout(() => setCopiedUrl(null), 2000)
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-popover border border-border rounded-2xl p-6 max-w-4xl w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <ImageIcon className="w-6 h-6 text-indigo-400" />
                        이미지 보관함
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                            {uploading ? "업로드 중..." : "이미지 업로드"}
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                        <button
                            onClick={onClose}
                            className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-secondary rounded-lg ml-2"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    </div>
                ) : images.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border">
                        <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-1">저장된 이미지가 없습니다.</p>
                        <p className="text-sm">로고나 자주 사용하는 이미지를 업로드해보세요.</p>
                    </div>
                ) : (
                    <div className="overflow-y-auto flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pr-1">
                        {images.map((image) => (
                            <div
                                key={image.path}
                                className="group relative aspect-square bg-secondary/50 border border-border rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all cursor-pointer"
                                onClick={() => onSelect?.(image.url)}
                            >
                                <div className="absolute inset-0 p-2">
                                    <div className="relative w-full h-full rounded-lg overflow-hidden">
                                        <Image
                                            src={image.url}
                                            alt={image.name}
                                            fill
                                            className="object-contain"
                                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                        />
                                    </div>
                                </div>

                                {/* Overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                    <p className="text-white text-xs font-medium truncate mb-2 px-1">{image.name}</p>
                                    <div className="flex items-center gap-2 justify-end">
                                        <button
                                            onClick={(e) => handleCopyUrl(image.url, e)}
                                            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-colors"
                                            title="URL 복사"
                                        >
                                            {copiedUrl === image.url ? (
                                                <Check className="w-4 h-4 text-green-400" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDelete(image.path)
                                            }}
                                            className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors"
                                            title="삭제"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
