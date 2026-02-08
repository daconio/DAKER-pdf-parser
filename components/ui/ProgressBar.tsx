"use client"

interface ProgressBarProps {
  label: string
  percent: number
  className?: string
}

export function ProgressBar({ label, percent, className = "" }: ProgressBarProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="text-foreground font-semibold">{percent}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
