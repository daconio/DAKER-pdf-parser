"use client"

import { ChevronLeft, ChevronRight, Plus, Copy, Trash2 } from "lucide-react"

interface PageNavigatorProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onAddPage: (afterIndex: number) => void
  onDuplicatePage: (index: number) => void
  onDeletePage: (index: number) => void
  onMovePage: (fromIndex: number, direction: "left" | "right") => void
  thumbnails: Array<{ pageNumber: number; imageBase64: string; hasEdits: boolean }>
  disabled?: boolean
}

export function PageNavigator({
  currentPage,
  totalPages,
  onPageChange,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
  thumbnails,
  disabled = false,
}: PageNavigatorProps) {
  const canGoBack = currentPage > 0
  const canGoForward = currentPage < totalPages - 1

  return (
    <div className="flex flex-col gap-3">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          페이지
        </h4>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={disabled || !canGoBack}
            className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="이전 페이지 (←)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-foreground min-w-[60px] text-center">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={disabled || !canGoForward}
            className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="다음 페이지 (→)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Thumbnail Strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border">
        {thumbnails.map((thumb, idx) => (
          <div key={thumb.pageNumber} className="flex-shrink-0 group relative">
            <button
              onClick={() => onPageChange(idx)}
              disabled={disabled}
              className={`relative w-16 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                idx === currentPage
                  ? "border-indigo-500 ring-2 ring-indigo-500/30"
                  : "border-border hover:border-ring"
              }`}
            >
              <img
                src={`data:image/png;base64,${thumb.imageBase64}`}
                alt={`Page ${thumb.pageNumber}`}
                className="w-full h-full object-cover"
              />
              {thumb.hasEdits && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                <span className="text-[10px] text-white font-medium">{thumb.pageNumber}</span>
              </div>
            </button>

            {/* Page Actions (visible on hover) */}
            <div className="absolute -bottom-1 left-0 right-0 flex justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onMovePage(idx, "left")}
                disabled={disabled || idx === 0}
                className="p-0.5 bg-secondary rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="왼쪽으로 이동"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDuplicatePage(idx)}
                disabled={disabled}
                className="p-0.5 bg-secondary rounded text-muted-foreground hover:text-foreground"
                title="복제"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={() => onMovePage(idx, "right")}
                disabled={disabled || idx === totalPages - 1}
                className="p-0.5 bg-secondary rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="오른쪽으로 이동"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {/* Add Page Button */}
        <button
          onClick={() => onAddPage(thumbnails.length - 1)}
          disabled={disabled}
          className="flex-shrink-0 w-16 h-20 rounded-lg border-2 border-dashed border-border hover:border-ring flex items-center justify-center text-muted-foreground hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="새 페이지 추가"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Current Page Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onDuplicatePage(currentPage)}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium rounded-lg transition-all disabled:opacity-50"
        >
          <Copy className="w-3.5 h-3.5" />
          복제
        </button>
        <button
          onClick={() => onAddPage(currentPage)}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium rounded-lg transition-all disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          뒤에 추가
        </button>
        <button
          onClick={() => onDeletePage(currentPage)}
          disabled={disabled || totalPages <= 1}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-all disabled:opacity-30"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
