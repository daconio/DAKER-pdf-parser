import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

// Naver Cloud Outbound Mailer API
const NCP_API_URL = "https://mail.apigw.ntruss.com/api/v1"
const ACCESS_KEY = process.env.NAVER_CLOUD_ACCESS_KEY
const SECRET_KEY = process.env.NAVER_CLOUD_SECRET_KEY
const SENDER_EMAIL = process.env.NAVER_CLOUD_SENDER_EMAIL

// 환경변수 검증 함수
function validateEnvVars(): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  if (!ACCESS_KEY) missing.push("NAVER_CLOUD_ACCESS_KEY")
  if (!SECRET_KEY) missing.push("NAVER_CLOUD_SECRET_KEY")
  if (!SENDER_EMAIL) missing.push("NAVER_CLOUD_SENDER_EMAIL")
  return { valid: missing.length === 0, missing }
}

// Generate signature for Naver Cloud API
function generateSignature(method: string, url: string, timestamp: string): string {
  const message = `${method} ${url}\n${timestamp}\n${ACCESS_KEY}`
  const hmac = crypto.createHmac("sha256", SECRET_KEY!)
  hmac.update(message)
  return hmac.digest("base64")
}

// Send email via Naver Cloud
async function sendNaverEmail(params: {
  to: string[]
  subject: string
  body: string
  attachments?: Array<{ filename: string; content: string; contentType: string }>
}) {
  const timestamp = Date.now().toString()
  const url = "/mails"
  const signature = generateSignature("POST", url, timestamp)

  // Prepare recipients
  const recipients = params.to.map((email) => ({
    address: email,
    type: "R", // R = 수신자
  }))

  // Prepare attachments if any
  const attachFiles = params.attachments?.map((att) => ({
    fileName: att.filename,
    fileBody: att.content, // base64 encoded content
    contentType: att.contentType,
  })) || []

  const requestBody = {
    senderAddress: SENDER_EMAIL,
    senderName: "DAKER PDF Parser",
    title: params.subject,
    body: params.body,
    recipients,
    individual: true,
    advertising: false,
    ...(attachFiles.length > 0 && { attachFiles }),
  }

  const response = await fetch(`${NCP_API_URL}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ncp-apigw-timestamp": timestamp,
      "x-ncp-iam-access-key": ACCESS_KEY!,
      "x-ncp-apigw-signature-v2": signature,
    },
    body: JSON.stringify(requestBody),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || "이메일 발송에 실패했습니다.")
  }

  return data
}

// Supabase client for saving email records
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

// POST: Send email
export async function POST(request: NextRequest) {
  try {
    // 환경변수 검증
    const envCheck = validateEnvVars()
    if (!envCheck.valid) {
      console.error("[Email API] Missing environment variables:", envCheck.missing)
      return NextResponse.json(
        {
          error: "이메일 서비스가 설정되지 않았습니다.",
          details: `환경변수 누락: ${envCheck.missing.join(", ")}`,
          code: "ENV_MISSING"
        },
        { status: 503 }
      )
    }

    // Verify auth
    const authHeader = request.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[Email API] Missing or invalid Authorization header")
      return NextResponse.json({ error: "인증이 필요합니다.", code: "AUTH_REQUIRED" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const supabase = getSupabaseClient()

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error("[Email API] Auth error:", authError?.message || "User not found")
      return NextResponse.json({ error: "인증이 만료되었습니다.", code: "AUTH_EXPIRED" }, { status: 401 })
    }

    const body = await request.json()
    const { to, subject, htmlBody, textBody, attachments, saveToHistory = true } = body

    if (!to || !Array.isArray(to) || to.length === 0) {
      console.error("[Email API] Invalid recipients:", to)
      return NextResponse.json({ error: "수신자 이메일이 필요합니다.", code: "INVALID_RECIPIENTS" }, { status: 400 })
    }
    if (!subject) {
      console.error("[Email API] Missing subject")
      return NextResponse.json({ error: "제목이 필요합니다.", code: "MISSING_SUBJECT" }, { status: 400 })
    }

    console.log("[Email API] Sending email to:", to, "Subject:", subject, "Attachments:", attachments?.length || 0)

    // Send email
    let result
    try {
      result = await sendNaverEmail({
        to,
        subject,
        body: htmlBody || textBody || "",
        attachments,
      })
      console.log("[Email API] Naver Cloud response:", result)
    } catch (ncpError) {
      console.error("[Email API] Naver Cloud API error:", ncpError)
      throw new Error(
        ncpError instanceof Error
          ? `네이버 클라우드 API 오류: ${ncpError.message}`
          : "네이버 클라우드 이메일 발송 실패"
      )
    }

    // Save to history if requested
    if (saveToHistory) {
      try {
        const { error: insertError } = await supabase.from("email_history").insert({
          user_id: user.id,
          recipients: to,
          subject,
          body: htmlBody || textBody || "",
          has_attachment: !!attachments?.length,
          attachment_count: attachments?.length || 0,
          status: "sent",
          sent_at: new Date().toISOString(),
          ncp_request_id: result.requestId,
        })
        if (insertError) {
          console.error("[Email API] Failed to save email history:", insertError)
          // 히스토리 저장 실패는 이메일 발송 성공에 영향을 주지 않음
        }
      } catch (dbError) {
        console.error("[Email API] Database error saving history:", dbError)
      }
    }

    return NextResponse.json({
      success: true,
      message: "이메일이 발송되었습니다.",
      requestId: result.requestId,
    })
  } catch (error) {
    console.error("[Email API] Send error:", error)
    const errorMessage = error instanceof Error ? error.message : "이메일 발송에 실패했습니다."
    return NextResponse.json(
      { error: errorMessage, code: "SEND_FAILED" },
      { status: 500 }
    )
  }
}

// GET: Get email history
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const supabase = getSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "인증이 만료되었습니다." }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    const { data: emails, error } = await supabase
      .from("email_history")
      .select("*")
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Return empty array if table doesn't exist or other error
    if (error) {
      console.error("Email history query error:", error)
      // Return empty array instead of error (table might not exist yet)
      return NextResponse.json({ emails: [] })
    }

    return NextResponse.json({ emails: emails || [] })
  } catch (error) {
    console.error("Email history error:", error)
    // Return empty array on any error to avoid blocking the UI
    return NextResponse.json({ emails: [] })
  }
}

// DELETE: Delete email from history
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const supabase = getSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "인증이 만료되었습니다." }, { status: 401 })
    }

    const body = await request.json()
    const { emailId } = body

    if (!emailId) {
      return NextResponse.json({ error: "이메일 ID가 필요합니다." }, { status: 400 })
    }

    const { error } = await supabase
      .from("email_history")
      .delete()
      .eq("id", emailId)
      .eq("user_id", user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Email delete error:", error)
    return NextResponse.json(
      { error: "이메일 삭제에 실패했습니다." },
      { status: 500 }
    )
  }
}
