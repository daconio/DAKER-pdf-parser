"use client"

import { useState, useEffect } from "react"
import {
  X,
  Mail,
  Send,
  Paperclip,
  Trash2,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  ChevronLeft,
  Users,
} from "lucide-react"
import type { EmailHistoryItem } from "@/hooks/useEmail"

interface EmailPanelProps {
  isOpen: boolean
  onClose: () => void
  emails: EmailHistoryItem[]
  loading: boolean
  sending: boolean
  error: string | null
  onSendEmail: (params: {
    to: string[]
    subject: string
    htmlBody?: string
    textBody?: string
  }) => Promise<boolean>
  onSendPdfEmail?: (
    recipients: string[],
    subject: string,
    body: string
  ) => Promise<boolean>
  onDeleteEmail: (emailId: string) => Promise<boolean>
  onFetchEmails: () => Promise<void>
  pdfAvailable?: boolean
  pdfFileName?: string
  inline?: boolean  // New: render inline in content area instead of modal
}

type PanelView = "list" | "compose"

export function EmailPanel({
  isOpen,
  onClose,
  emails,
  loading,
  sending,
  error,
  onSendEmail,
  onSendPdfEmail,
  onDeleteEmail,
  onFetchEmails,
  pdfAvailable = false,
  pdfFileName,
  inline = false,
}: EmailPanelProps) {
  const [view, setView] = useState<PanelView>("list")
  const [recipients, setRecipients] = useState("")
  const [ccRecipients, setCcRecipients] = useState("")
  const [bccRecipients, setBccRecipients] = useState("")
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [attachPdf, setAttachPdf] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Fetch emails when panel opens
  useEffect(() => {
    if (isOpen) {
      onFetchEmails()
    }
  }, [isOpen, onFetchEmails])

  // Reset form when view changes
  useEffect(() => {
    if (view === "compose") {
      setRecipients("")
      setCcRecipients("")
      setBccRecipients("")
      setShowCcBcc(false)
      setSubject("")
      setBody("")
      setAttachPdf(false)
      setLocalError(null)
    }
  }, [view])

  const handleSend = async () => {
    setLocalError(null)

    // Validate
    const toList = recipients.split(",").map((e) => e.trim()).filter(Boolean)
    if (toList.length === 0) {
      setLocalError("수신자 이메일을 입력해주세요.")
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const email of toList) {
      if (!emailRegex.test(email)) {
        setLocalError(`올바르지 않은 이메일 형식: ${email}`)
        return
      }
    }

    if (!subject.trim()) {
      setLocalError("제목을 입력해주세요.")
      return
    }

    let success: boolean
    if (attachPdf && onSendPdfEmail) {
      success = await onSendPdfEmail(toList, subject, body)
    } else {
      success = await onSendEmail({
        to: toList,
        subject,
        htmlBody: body.replace(/\n/g, "<br>"),
        textBody: body,
      })
    }

    if (success) {
      setView("list")
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    } else if (days === 1) {
      return "어제"
    } else if (days < 7) {
      return `${days}일 전`
    } else {
      return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
    }
  }

  if (!isOpen) return null

  // Inline mode: render directly in content area
  if (inline) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {view === "compose" && (
              <button
                onClick={() => setView("list")}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <Mail className="w-6 h-6 text-indigo-500" />
            <h2 className="text-2xl font-bold">
              {view === "list" ? "이메일" : "새 이메일 작성"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {view === "list" && (
              <button
                onClick={() => setView("compose")}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                새 이메일
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-6">
            {view === "list" ? (
              // Email List View
              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  </div>
                ) : emails.length === 0 ? (
                  <div className="text-center py-16">
                    <Mail className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-lg text-muted-foreground mb-2">발송한 이메일이 없습니다</p>
                    <button
                      onClick={() => setView("compose")}
                      className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      첫 이메일 보내기
                    </button>
                  </div>
                ) : (
                  emails.map((email) => (
                    <div
                      key={email.id}
                      className="group flex items-start gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {email.status === "sent" ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : email.status === "failed" ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-medium text-foreground truncate">
                            {email.subject}
                          </span>
                          {email.has_attachment && (
                            <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span className="truncate">
                            {email.recipients.join(", ")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(email.sent_at)}
                        </span>
                        <button
                          onClick={() => onDeleteEmail(email.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              // Compose View
              <div className="space-y-5">
                {/* Recipients */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-muted-foreground">
                      받는 사람 <span className="text-xs text-muted-foreground">(쉼표로 구분)</span>
                    </label>
                    {!showCcBcc && (
                      <button
                        type="button"
                        onClick={() => setShowCcBcc(true)}
                        className="text-xs text-indigo-500 hover:text-indigo-400"
                      >
                        참조/숨은참조 추가
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder="email@example.com, email2@example.com"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                {/* CC/BCC Fields */}
                {showCcBcc && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        참조 (CC)
                      </label>
                      <input
                        type="text"
                        value={ccRecipients}
                        onChange={(e) => setCcRecipients(e.target.value)}
                        placeholder="참조할 이메일 주소"
                        className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        숨은참조 (BCC)
                      </label>
                      <input
                        type="text"
                        value={bccRecipients}
                        onChange={(e) => setBccRecipients(e.target.value)}
                        placeholder="숨은참조할 이메일 주소"
                        className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                  </>
                )}

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    제목
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="이메일 제목을 입력하세요"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    내용
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="이메일 내용을 입력하세요"
                    rows={8}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                  />
                </div>

                {/* PDF Attachment Option */}
                {pdfAvailable && onSendPdfEmail && (
                  <label className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50 border border-border cursor-pointer hover:border-indigo-500/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={attachPdf}
                      onChange={(e) => setAttachPdf(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                    />
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">PDF 첨부</span>
                      {pdfFileName && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({pdfFileName})
                        </span>
                      )}
                    </div>
                  </label>
                )}

                {/* Error */}
                {(localError || error) && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                    {localError || error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <button
                    onClick={() => setView("list")}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    발송
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Modal mode (original)
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            {view === "compose" && (
              <button
                onClick={() => setView("list")}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <Mail className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-semibold">
              {view === "list" ? "이메일" : "새 이메일 작성"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {view === "list" && (
              <button
                onClick={() => setView("compose")}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                새 이메일
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {view === "list" ? (
            // Email List View
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">발송한 이메일이 없습니다</p>
                  <button
                    onClick={() => setView("compose")}
                    className="mt-4 text-indigo-500 hover:text-indigo-400 text-sm font-medium"
                  >
                    첫 이메일 보내기
                  </button>
                </div>
              ) : (
                emails.map((email) => (
                  <div
                    key={email.id}
                    className="group flex items-start gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      {email.status === "sent" ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      ) : email.status === "failed" ? (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground truncate">
                          {email.subject}
                        </span>
                        {email.has_attachment && (
                          <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span className="truncate">
                          {email.recipients.join(", ")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(email.sent_at)}
                      </span>
                      <button
                        onClick={() => onDeleteEmail(email.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            // Compose View
            <div className="space-y-4">
              {/* Recipients */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">
                    받는 사람 <span className="text-xs text-muted-foreground">(쉼표로 구분)</span>
                  </label>
                  {!showCcBcc && (
                    <button
                      type="button"
                      onClick={() => setShowCcBcc(true)}
                      className="text-xs text-indigo-500 hover:text-indigo-400"
                    >
                      참조/숨은참조
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="email@example.com, email2@example.com"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* CC/BCC Fields */}
              {showCcBcc && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      참조 (CC)
                    </label>
                    <input
                      type="text"
                      value={ccRecipients}
                      onChange={(e) => setCcRecipients(e.target.value)}
                      placeholder="참조할 이메일 주소"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      숨은참조 (BCC)
                    </label>
                    <input
                      type="text"
                      value={bccRecipients}
                      onChange={(e) => setBccRecipients(e.target.value)}
                      placeholder="숨은참조할 이메일 주소"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                </>
              )}

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  제목
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="이메일 제목을 입력하세요"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  내용
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="이메일 내용을 입력하세요"
                  rows={6}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                />
              </div>

              {/* PDF Attachment Option */}
              {pdfAvailable && onSendPdfEmail && (
                <label className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border cursor-pointer hover:border-indigo-500/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={attachPdf}
                    onChange={(e) => setAttachPdf(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                  />
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">PDF 첨부</span>
                    {pdfFileName && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({pdfFileName})
                      </span>
                    )}
                  </div>
                </label>
              )}

              {/* Error */}
              {(localError || error) && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                  {localError || error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {view === "compose" && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setView("list")}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                발송
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
