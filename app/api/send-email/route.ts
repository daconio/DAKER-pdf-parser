import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

// Naver Cloud Outbound Mailer API
const NCP_API_URL = "https://mail.apigw.ntruss.com/api/v1"
const ACCESS_KEY = process.env.NAVER_CLOUD_ACCESS_KEY!
const SECRET_KEY = process.env.NAVER_CLOUD_SECRET_KEY!
const SENDER_EMAIL = process.env.NAVER_CLOUD_SENDER_EMAIL!

// Generate signature for Naver Cloud API
function generateSignature(method: string, url: string, timestamp: string): string {
  const message = `${method} ${url}\n${timestamp}\n${ACCESS_KEY}`
  const hmac = crypto.createHmac("sha256", SECRET_KEY)
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
      "x-ncp-iam-access-key": ACCESS_KEY,
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
    // Verify auth
    const authHeader = request.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const supabase = getSupabaseClient()

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "인증이 만료되었습니다." }, { status: 401 })
    }

    const body = await request.json()
    const { to, subject, htmlBody, textBody, attachments, saveToHistory = true } = body

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: "수신자 이메일이 필요합니다." }, { status: 400 })
    }
    if (!subject) {
      return NextResponse.json({ error: "제목이 필요합니다." }, { status: 400 })
    }

    // Send email
    const result = await sendNaverEmail({
      to,
      subject,
      body: htmlBody || textBody || "",
      attachments,
    })

    // Save to history if requested
    if (saveToHistory) {
      await supabase.from("email_history").insert({
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
    }

    return NextResponse.json({
      success: true,
      message: "이메일이 발송되었습니다.",
      requestId: result.requestId,
    })
  } catch (error) {
    console.error("Email send error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "이메일 발송에 실패했습니다." },
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

    if (error) {
      throw error
    }

    return NextResponse.json({ emails })
  } catch (error) {
    console.error("Email history error:", error)
    return NextResponse.json(
      { error: "이메일 기록을 불러오는데 실패했습니다." },
      { status: 500 }
    )
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
