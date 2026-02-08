"use client"

import { ConversionMode, AI_EDIT, type AppMode } from "@/lib/types"

interface ModeInfo {
  id: AppMode
  label: string
  emoji: string
  accept: string
  desc: string
}

const MODES: ModeInfo[] = [
  { id: ConversionMode.PDF_TO_PNG, label: "PDF → 이미지", emoji: "🖼️", accept: ".pdf", desc: "PDF를 고품질 PNG 이미지로 변환" },
  { id: ConversionMode.PNG_TO_PDF, label: "이미지 → PDF", emoji: "📄", accept: "image/*", desc: "여러 이미지를 하나의 PDF로 결합" },
  { id: ConversionMode.MERGE_PDF, label: "PDF 합치기", emoji: "📑", accept: ".pdf", desc: "여러 PDF 파일을 하나로 병합" },
  { id: ConversionMode.FLATTEN_PDF, label: "PDF 병합", emoji: "📋", accept: ".pdf", desc: "PDF를 이미지로 변환 후 다시 PDF로" },
  { id: ConversionMode.SPLIT_PDF, label: "PDF 분할", emoji: "✂️", accept: ".pdf", desc: "PDF 페이지를 개별 파일로 분리" },
  { id: AI_EDIT, label: "AI PDF 수정", emoji: "✨", accept: ".pdf", desc: "AI로 PDF 텍스트를 자연어로 수정" },
]

interface ModeSelectorProps {
  currentMode: AppMode
  onModeChange: (mode: AppMode) => void
  disabled?: boolean
}

export function ModeSelector({
  currentMode,
  onModeChange,
  disabled = false,
}: ModeSelectorProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        변환 모드
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {MODES.map((mode) => {
          const isActive = currentMode === mode.id
          const isAI = mode.id === AI_EDIT

          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              disabled={disabled}
              className={`relative flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 text-left group ${
                isActive
                  ? isAI
                    ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20"
                    : "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20"
                  : "border-border hover:border-ring hover:bg-secondary/50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {/* AI Badge */}
              {isAI && (
                <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-[9px] text-white font-bold rounded-full uppercase tracking-wider shadow-lg">
                  AI
                </div>
              )}

              {/* Icon & Label */}
              <div className="flex items-center gap-2">
                <span className="text-lg">{mode.emoji}</span>
                <span className={`text-sm font-semibold ${
                  isActive ? "text-foreground" : "text-foreground/80"
                }`}>
                  {mode.label}
                </span>
              </div>

              {/* Description */}
              <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                {mode.desc}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { MODES }
export type { ModeInfo }
