"use client"

import { Cloud, X, FileText, Trash2, Loader2 } from "lucide-react"

interface CloudFile {
  name: string
  path: string
  createdAt: string
  size: number
}

interface CloudPanelProps {
  isOpen: boolean
  files: CloudFile[]
  loading: boolean
  onClose: () => void
  onOpenFile: (path: string) => void
  onDeleteFile: (path: string) => void
}

export function CloudPanel({
  isOpen,
  files,
  loading,
  onClose,
  onOpenFile,
  onDeleteFile,
}: CloudPanelProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-popover border border-border rounded-2xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Cloud className="w-5 h-5 text-indigo-400" />
            내 클라우드 PDF
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-secondary rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            저장된 PDF가 없습니다.
            <br />
            PDF를 편집한 후 &quot;클라우드 저장&quot; 버튼으로 저장할 수 있습니다.
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-2">
            {files.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-3 p-3 bg-secondary/50 border border-border rounded-xl hover:border-ring transition-colors group"
              >
                <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.createdAt ? new Date(file.createdAt).toLocaleString("ko-KR") : ""}
                    {file.size ? ` · ${(file.size / 1024 / 1024).toFixed(1)}MB` : ""}
                  </p>
                </div>
                <button
                  onClick={() => onOpenFile(file.path)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  열기
                </button>
                <button
                  onClick={() => onDeleteFile(file.path)}
                  className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
