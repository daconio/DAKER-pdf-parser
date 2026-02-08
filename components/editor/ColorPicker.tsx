"use client"

import { Pipette, Palette } from "lucide-react"

interface ColorPickerProps {
  color: string
  onColorChange: (color: string) => void
  onEyedropper: () => void
  onApplyCurrent?: () => void
  onApplyAll?: () => void
  eyedropperActive?: boolean
  disabled?: boolean
  showApplyButtons?: boolean
}

const PRESET_COLORS = [
  "#FFFFFF", "#F5F5F5", "#E8E8E8", "#000000", "#1A1A2E",
  "#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF",
  "#5856D6", "#AF52DE", "#FF2D55", "#2C3E50", "#1ABC9C",
]

export function ColorPicker({
  color,
  onColorChange,
  onEyedropper,
  onApplyCurrent,
  onApplyAll,
  eyedropperActive = false,
  disabled = false,
  showApplyButtons = true,
}: ColorPickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          배경색
        </h4>
      </div>

      {/* Color Presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((presetColor) => (
          <button
            key={presetColor}
            onClick={() => onColorChange(presetColor)}
            disabled={disabled}
            className={`w-6 h-6 rounded-md transition-all duration-200 hover:scale-110 border ${
              color === presetColor
                ? "ring-2 ring-indigo-500 ring-offset-1 ring-offset-background border-indigo-500"
                : "border-border"
            }`}
            style={{ backgroundColor: presetColor }}
          />
        ))}
      </div>

      {/* Custom Color & Eyedropper */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 p-2 bg-secondary rounded-lg">
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            disabled={disabled}
            className="w-8 h-8 rounded-md cursor-pointer border-none"
          />
          <input
            type="text"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            disabled={disabled}
            className="flex-1 bg-transparent text-foreground text-xs font-mono uppercase outline-none"
          />
        </div>
        <button
          onClick={onEyedropper}
          disabled={disabled}
          className={`p-2 rounded-lg transition-all ${
            eyedropperActive
              ? "bg-indigo-600 text-white"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
          title="스포이드 (이미지에서 색상 추출)"
        >
          <Pipette className="w-4 h-4" />
        </button>
      </div>

      {/* Apply Buttons */}
      {showApplyButtons && (
        <div className="flex gap-2">
          {onApplyCurrent && (
            <button
              onClick={onApplyCurrent}
              disabled={disabled}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              현재 페이지 적용
            </button>
          )}
          {onApplyAll && (
            <button
              onClick={onApplyAll}
              disabled={disabled}
              className="flex-1 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              전체 적용
            </button>
          )}
        </div>
      )}
    </div>
  )
}
