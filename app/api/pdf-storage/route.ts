import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const BUCKET_NAME = "pdf-files"

// Service role client for storage operations (bypasses RLS)
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  return createClient(supabaseUrl, serviceRoleKey)
}

// Anon client with user token for auth verification
function getAuthClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader) return null
  const token = authHeader.replace("Bearer ", "")
  const supabase = getAuthClient(token)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// Upload PDF
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const fileName = formData.get("fileName") as string | null
    if (!file || !fileName) return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 })

    const filePath = `${user.id}/${Date.now()}_${fileName}`
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    const serviceClient = getServiceClient()
    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET_NAME)
      .upload(filePath, uint8Array, { contentType: "application/pdf", upsert: false })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
    return NextResponse.json({ path: filePath, fileName })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// List PDFs
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

    const serviceClient = getServiceClient()
    const { data: files, error: listError } = await serviceClient.storage
      .from(BUCKET_NAME)
      .list(user.id, { limit: 100, sortBy: { column: "created_at", order: "desc" } })

    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

    const pdfFiles = (files || [])
      .filter((f) => f.name.endsWith(".pdf"))
      .map((f) => ({
        name: f.name.replace(/^\d+_/, ""),
        path: `${user.id}/${f.name}`,
        createdAt: f.created_at,
        size: f.metadata?.size || 0,
      }))

    return NextResponse.json({ files: pdfFiles })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Delete PDF
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

    const { path } = await request.json()
    if (!path || !path.startsWith(user.id)) {
      return NextResponse.json({ error: "잘못된 파일 경로입니다." }, { status: 400 })
    }

    const serviceClient = getServiceClient()
    const { error: deleteError } = await serviceClient.storage
      .from(BUCKET_NAME)
      .remove([path])

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Download PDF (signed URL)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

    const { path } = await request.json()
    if (!path || !path.startsWith(user.id)) {
      return NextResponse.json({ error: "잘못된 파일 경로입니다." }, { status: 400 })
    }

    const serviceClient = getServiceClient()
    const { data, error } = await serviceClient.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 300) // 5 minute URL

    if (error || !data) return NextResponse.json({ error: error?.message || "URL 생성 실패" }, { status: 500 })
    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
