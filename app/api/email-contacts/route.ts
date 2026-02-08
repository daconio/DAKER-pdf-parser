import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Supabase client for server-side operations
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

// Verify auth and get user
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, error: "인증이 필요합니다." }
  }

  const token = authHeader.split(" ")[1]
  const supabase = getSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { user: null, error: "인증이 만료되었습니다." }
  }

  return { user, error: null, supabase }
}

export interface EmailContact {
  id: string
  user_id: string
  email: string
  name: string | null
  group_name: string
  created_at: string
}

// GET: 연락처 목록 조회
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const group = searchParams.get("group")
    const search = searchParams.get("search")

    let query = auth.supabase
      .from("email_contacts")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("name", { ascending: true, nullsFirst: false })

    if (group && group !== "all") {
      query = query.eq("group_name", group)
    }

    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
    }

    const { data: contacts, error } = await query

    if (error) {
      console.error("[Email Contacts] Query error:", error)
      throw error
    }

    // 그룹 목록도 함께 반환
    const { data: groups } = await auth.supabase
      .from("email_contacts")
      .select("group_name")
      .eq("user_id", auth.user.id)

    const uniqueGroups = [...new Set(groups?.map(g => g.group_name) || [])]

    return NextResponse.json({ contacts, groups: uniqueGroups })
  } catch (error) {
    console.error("[Email Contacts] GET error:", error)
    return NextResponse.json(
      { error: "연락처를 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}

// POST: 연락처 추가 (단일 또는 대량)
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const { contacts } = body as { contacts: Array<{ email: string; name?: string; group_name?: string }> }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: "연락처 데이터가 필요합니다." }, { status: 400 })
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalidEmails = contacts.filter(c => !emailRegex.test(c.email))
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: `올바르지 않은 이메일 형식: ${invalidEmails.map(c => c.email).join(", ")}` },
        { status: 400 }
      )
    }

    // 데이터 준비
    const insertData = contacts.map(c => ({
      user_id: auth.user!.id,
      email: c.email.toLowerCase().trim(),
      name: c.name?.trim() || null,
      group_name: c.group_name?.trim() || "default",
    }))

    // upsert로 중복 처리 (email + user_id가 unique)
    const { data, error } = await auth.supabase
      .from("email_contacts")
      .upsert(insertData, {
        onConflict: "user_id,email",
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      console.error("[Email Contacts] Insert error:", error)
      // unique constraint violation 처리
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "이미 등록된 이메일이 있습니다.", code: "DUPLICATE_EMAIL" },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      message: `${insertData.length}개의 연락처가 등록되었습니다.`,
      contacts: data,
      count: insertData.length,
    })
  } catch (error) {
    console.error("[Email Contacts] POST error:", error)
    return NextResponse.json(
      { error: "연락처 등록에 실패했습니다." },
      { status: 500 }
    )
  }
}

// PUT: 연락처 수정
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const { id, email, name, group_name } = body

    if (!id) {
      return NextResponse.json({ error: "연락처 ID가 필요합니다." }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: "올바르지 않은 이메일 형식입니다." }, { status: 400 })
      }
      updateData.email = email.toLowerCase().trim()
    }
    if (name !== undefined) updateData.name = name?.trim() || null
    if (group_name !== undefined) updateData.group_name = group_name?.trim() || "default"

    const { data, error } = await auth.supabase
      .from("email_contacts")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .select()
      .single()

    if (error) {
      console.error("[Email Contacts] Update error:", error)
      throw error
    }

    return NextResponse.json({ success: true, contact: data })
  } catch (error) {
    console.error("[Email Contacts] PUT error:", error)
    return NextResponse.json(
      { error: "연락처 수정에 실패했습니다." },
      { status: 500 }
    )
  }
}

// DELETE: 연락처 삭제 (단일 또는 다중)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const { ids } = body as { ids: string[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "삭제할 연락처 ID가 필요합니다." }, { status: 400 })
    }

    const { error } = await auth.supabase
      .from("email_contacts")
      .delete()
      .in("id", ids)
      .eq("user_id", auth.user.id)

    if (error) {
      console.error("[Email Contacts] Delete error:", error)
      throw error
    }

    return NextResponse.json({
      success: true,
      message: `${ids.length}개의 연락처가 삭제되었습니다.`,
      count: ids.length,
    })
  } catch (error) {
    console.error("[Email Contacts] DELETE error:", error)
    return NextResponse.json(
      { error: "연락처 삭제에 실패했습니다." },
      { status: 500 }
    )
  }
}
