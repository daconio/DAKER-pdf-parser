"use client"

import { Pencil, Type, Square, Eraser } from "lucide-react"

type DirectTool = "text" | "draw" | "rect" | "eraser"

interface DirectToolbarProps {
  activeTool: DirectTool
  onToolChange: (tool: DirectTool) => void
  drawColor: string
  onColorChange: (color: string) => void
  drawSize: number
  onSizeChange: (size: number) => void
  textSize: number
  onTextSizeChange: (size: number) => void
  disabled?: boolean
}

const TOOLS: { id: DirectTool; icon: React.ReactNode; label: string }[] = [
  { id: "draw", icon: <Pencil className="w-4 h-4" />, label: "그리기" },
  { id: "text", icon: <Type className="w-4 h-4" />, label: "텍스트" },
  { id: "rect", icon: <Square className="w-4 h-4" />, label: "사각형" },
  { id: "eraser", icon: <Eraser className="w-4 h-4" />, label: "지우개" },
]

const PRESET_COLORS = [
  "#FF0000", "#FF9500", "#FFCC00", "#34C759",
  "#007AFF", "#5856D6", "#AF52DE", "#000000",
]

export function DirectToolbar({
  activeTool,
  onToolChange,
  drawColor,
  onColorChange,
  drawSize,
  onSizeChange,
  textSize,
  onTextSizeChange,
  disabled = false,
}: DirectToolbarProps) {
  return (
    <div className="space-y-4">
      {/* Tool Selection */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          도구
        </h4>
        <div className="flex gap-1">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              disabled={disabled}
              className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 ${
                activeTool === tool.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={tool.label}
            >
              {tool.icon}
              <span className="text-[10px] font-medium">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color Picker */}
      {activeTool !== "eraser" && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            색상
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => onColorChange(color)}
                disabled={disabled}
                className={`w-7 h-7 rounded-lg transition-all duration-200 hover:scale-110 ${
                  drawColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-background" : ""
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <input
              type="color"
              value={drawColor}
              onChange={(e) => onColorChange(e.target.value)}
              disabled={disabled}
              className="w-7 h-7 rounded-lg cursor-pointer border-none"
            />
          </div>
        </div>
      )}

      {/* Size Control */}
      {(activeTool === "draw" || activeTool === "eraser") && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              크기
            </h4>
            <span className="text-xs text-foreground font-medium">{drawSize}px</span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            value={drawSize}
            onChange={(e) => onSizeChange(parseInt(e.target.value))}
            disabled={disabled}
            className="w-full accent-indigo-500"
          />
        </div>
      )}

      {/* Text Size Control */}
      {activeTool === "text" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              텍스트 크기
            </h4>
            <span className="text-xs text-foreground font-medium">{textSize}px</span>
          </div>
          <input
            type="range"
            min="12"
            max="72"
            value={textSize}
            onChange={(e) => onTextSizeChange(parseInt(e.target.value))}
            disabled={disabled}
            className="w-full accent-indigo-500"
          />
        </div>
      )}
    </div>
  )
}
