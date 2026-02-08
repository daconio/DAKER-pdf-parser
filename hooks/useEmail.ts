"use client"

import { useState, useCallback } from "react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export interface EmailHistoryItem {
  id: string
  user_id: string
  recipients: string[]
  subject: string
  body: string
  has_attachment: boolean
  attachment_count: number
  status: "sent" | "failed" | "pending"
  sent_at: string
  ncp_request_id?: string
  created_at: string
}

export interface EmailAttachment {
  filename: string
  content: string // base64
  contentType: string
}

export interface SendEmailParams {
  to: string[]
  subject: string
  htmlBody?: string
  textBody?: string
  attachments?: EmailAttachment[]
  saveToHistory?: boolean
}

interface UseEmailProps {
  user: SupabaseUser | null
  getAccessToken: () => Promise<string | null>
}

export function useEmail({ user, getAccessToken }: UseEmailProps) {
  const [emails, setEmails] = useState<EmailHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch email history
  const fetchEmails = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const response = await fetch("/api/send-email", {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setEmails(data.emails || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "이메일 기록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }, [user, getAccessToken])

  // Send email
  const sendEmail = useCallback(async (params: SendEmailParams): Promise<boolean> => {
    if (!user) {
      setError("로그인이 필요합니다.")
      return false
    }

    setSending(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      // Refresh email list
      await fetchEmails()

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "이메일 발송에 실패했습니다.")
      return false
    } finally {
      setSending(false)
    }
  }, [user, getAccessToken, fetchEmails])

  // Send PDF as attachment
  const sendPdfEmail = useCallback(async (
    pdfBytes: Uint8Array,
    fileName: string,
    params: Omit<SendEmailParams, "attachments">
  ): Promise<boolean> => {
    // Convert PDF bytes to base64
    const base64 = btoa(String.fromCharCode(...pdfBytes))

    return sendEmail({
      ...params,
      attachments: [{
        filename: fileName,
        content: base64,
        contentType: "application/pdf",
      }],
    })
  }, [sendEmail])

  // Send collaboration invite email
  const sendInviteEmail = useCallback(async (
    recipientEmail: string,
    inviteCode: string,
    sessionName: string,
    inviterName: string
  ): Promise<boolean> => {
    const inviteLink = `${typeof window !== "undefined" ? window.location.origin : ""}/convert/ai-edit?invite=${inviteCode}`

    const htmlBody = `
      <div style="font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="https://r2-images.dacon.co.kr/external/DAKER.svg" alt="DAKER" style="height: 32px;" />
        </div>
        <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 20px; text-align: center;">
          PDF 공동 작업 초대
        </h1>
        <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6; margin-bottom: 20px;">
          <strong>${inviterName}</strong>님이 <strong>"${sessionName}"</strong> 문서의 공동 작업에 초대했습니다.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            공동 작업 참여하기
          </a>
        </div>
        <p style="font-size: 14px; color: #888; text-align: center; margin-top: 30px;">
          또는 아래 링크를 복사하여 브라우저에 붙여넣기 하세요:
        </p>
        <p style="font-size: 12px; color: #6366f1; text-align: center; word-break: break-all; background: #f5f5f5; padding: 12px; border-radius: 6px;">
          ${inviteLink}
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">
          DAKER PDF Parser - AI 기반 PDF 편집 서비스
        </p>
      </div>
    `

    return sendEmail({
      to: [recipientEmail],
      subject: `[DAKER] ${inviterName}님이 PDF 공동 작업에 초대했습니다`,
      htmlBody,
      saveToHistory: true,
    })
  }, [sendEmail])

  // Delete email from history
  const deleteEmail = useCallback(async (emailId: string): Promise<boolean> => {
    if (!user) return false

    try {
      const token = await getAccessToken()
      if (!token) throw new Error("인증이 필요합니다.")

      const response = await fetch("/api/send-email", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emailId }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setEmails((prev) => prev.filter((e) => e.id !== emailId))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "이메일 삭제에 실패했습니다.")
      return false
    }
  }, [user, getAccessToken])

  return {
    emails,
    loading,
    sending,
    error,
    fetchEmails,
    sendEmail,
    sendPdfEmail,
    sendInviteEmail,
    deleteEmail,
    clearError: () => setError(null),
  }
}
