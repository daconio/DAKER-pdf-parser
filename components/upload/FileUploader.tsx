"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, FileText, X, Loader2 } from "lucide-react"

interface FileUploaderProps {
  accept: string
  multiple?: boolean
  files: File[]
  onFilesChange: (files: File[]) => void
  onFilesAdd: (newFiles: File[]) => void
  onFileRemove: (index: number) => void
  maxFiles?: number
  disabled?: boolean
  processing?: boolean
  title?: string
  description?: string
}

export function FileUploader({
  accept,
  multiple = true,
  files,
  onFilesChange,
  onFilesAdd,
  onFileRemove,
  maxFiles = 10,
  disabled = false,
  processing = false,
  title = "파일 업로드",
  description = "파일을 드래그하거나 클릭하여 업로드하세요",
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    const validFiles = droppedFiles.slice(0, maxFiles - files.length)
    if (validFiles.length > 0) {
      onFilesAdd(validFiles)
    }
  }, [disabled, files.length, maxFiles, onFilesAdd])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const validFiles = selectedFiles.slice(0, maxFiles - files.length)
    if (validFiles.length > 0) {
      if (multiple) {
        onFilesAdd(validFiles)
      } else {
        onFilesChange(validFiles.slice(0, 1))
      }
    }
    e.target.value = ""
  }, [files.length, maxFiles, multiple, onFilesAdd, onFilesChange])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragging
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-border hover:border-ring hover:bg-secondary/50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          {processing ? (
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <Upload className="w-6 h-6 text-indigo-400" />
            </div>
          )}
          <div>
            <p className="text-foreground font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              선택된 파일 ({files.length})
            </h4>
            {files.length > 1 && (
              <button
                onClick={() => onFilesChange([])}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                전체 삭제
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-2.5 bg-secondary rounded-xl group"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onFileRemove(index)
                  }}
                  disabled={disabled}
                  className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
