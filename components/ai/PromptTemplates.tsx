"use client"

import { Sparkles, Type, Palette, Trash2, ImagePlus, Languages } from "lucide-react"

interface PromptTemplate {
  id: string
  icon: React.ReactNode
  label: string
  prompt: string
  description: string
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "fix-typo",
    icon: <Type className="w-4 h-4" />,
    label: "오타 수정",
    prompt: "이 슬라이드의 모든 오타와 맞춤법 오류를 찾아 수정해주세요.",
    description: "자동으로 오타를 찾아 수정합니다",
  },
  {
    id: "translate-en",
    icon: <Languages className="w-4 h-4" />,
    label: "영어 번역",
    prompt: "이 슬라이드의 모든 텍스트를 영어로 번역해주세요. 레이아웃과 디자인은 유지하세요.",
    description: "모든 텍스트를 영어로 번역",
  },
  {
    id: "change-color",
    icon: <Palette className="w-4 h-4" />,
    label: "색상 변경",
    prompt: "전체 배경색을 흰색으로 변경해주세요. 다른 요소는 그대로 유지하세요.",
    description: "배경색을 변경합니다",
  },
  {
    id: "remove-watermark",
    icon: <Trash2 className="w-4 h-4" />,
    label: "워터마크 제거",
    prompt: "이 이미지에서 워터마크나 로고를 제거해주세요.",
    description: "워터마크나 로고를 제거",
  },
  {
    id: "enhance-quality",
    icon: <Sparkles className="w-4 h-4" />,
    label: "품질 향상",
    prompt: "이 이미지의 품질을 향상시켜주세요. 더 선명하고 깔끔하게 만들어주세요.",
    description: "이미지 품질을 향상시킵니다",
  },
  {
    id: "add-logo",
    icon: <ImagePlus className="w-4 h-4" />,
    label: "로고 추가",
    prompt: "오른쪽 하단에 작은 로고 공간을 만들어주세요.",
    description: "로고 영역을 추가합니다",
  },
]

interface PromptTemplatesProps {
  onSelect: (prompt: string) => void
  disabled?: boolean
}

export function PromptTemplates({ onSelect, disabled = false }: PromptTemplatesProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          빠른 편집 템플릿
        </h4>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PROMPT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template.prompt)}
            disabled={disabled}
            className="flex items-center gap-2 p-2.5 bg-secondary/50 hover:bg-secondary border border-border hover:border-ring rounded-lg text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-400 group-hover:text-indigo-300 transition-colors">
              {template.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {template.label}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {template.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export { PROMPT_TEMPLATES }
