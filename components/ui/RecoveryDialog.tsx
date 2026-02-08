"use client"

interface RecoveryData {
  editFileName: string
  editPages: Array<{ pageNumber: number }>
  timestamp: number
}

interface RecoveryDialogProps {
  isOpen: boolean
  recoveryData: RecoveryData | null
  onRecover: () => void
  onDismiss: () => void
}

export function RecoveryDialog({
  isOpen,
  recoveryData,
  onRecover,
  onDismiss,
}: RecoveryDialogProps) {
  if (!isOpen || !recoveryData) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-popover border border-border rounded-2xl p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold text-foreground">이전 작업 복구</h3>
        <p className="text-sm text-muted-foreground">
          저장되지 않은 이전 작업이 있습니다.
          <br />
          <span className="text-foreground font-medium">{recoveryData.editFileName}</span>{" "}
          ({recoveryData.editPages.length}페이지)
          <br />
          <span className="text-xs text-muted-foreground">
            {new Date(recoveryData.timestamp).toLocaleString("ko-KR")}
          </span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={onRecover}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/25"
          >
            복구하기
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold rounded-xl transition-all duration-200"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
