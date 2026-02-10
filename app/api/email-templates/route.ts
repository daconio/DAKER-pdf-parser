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

export interface EmailTemplate {
  id: string
  user_id: string
  name: string
  type: "header" | "footer" | "signature"
  content: string
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// GET: 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") as EmailTemplate["type"] | null

    let query = auth.supabase
      .from("email_templates")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })

    if (type) {
      query = query.eq("type", type)
    }

    const { data: templates, error } = await query

    if (error) {
      console.error("[Email Templates] Query error:", error)
      throw error
    }

    return NextResponse.json({ templates })
  } catch (error) {
    console.error("[Email Templates] GET error:", error)
    return NextResponse.json(
      { error: "템플릿을 불러오는데 실패했습니다." },
      { status: 500 }
    )
  }
}

// POST: 템플릿 추가
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, content, is_default } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "템플릿 이름이 필요합니다." }, { status: 400 })
    }

    if (!type || !["header", "footer", "signature"].includes(type)) {
      return NextResponse.json({ error: "올바른 템플릿 유형이 필요합니다." }, { status: 400 })
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: "템플릿 내용이 필요합니다." }, { status: 400 })
    }

    // If setting as default, unset other defaults of same type
    if (is_default) {
      await auth.supabase
        .from("email_templates")
        .update({ is_default: false })
        .eq("user_id", auth.user.id)
        .eq("type", type)
    }

    // Get max sort_order
    const { data: maxOrderData } = await auth.supabase
      .from("email_templates")
      .select("sort_order")
      .eq("user_id", auth.user.id)
      .eq("type", type)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single()

    const newSortOrder = (maxOrderData?.sort_order ?? -1) + 1

    const { data, error } = await auth.supabase
      .from("email_templates")
      .insert({
        user_id: auth.user.id,
        name: name.trim(),
        type,
        content: content.trim(),
        is_default: is_default || false,
        sort_order: newSortOrder,
      })
      .select()
      .single()

    if (error) {
      console.error("[Email Templates] Insert error:", error)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "같은 이름의 템플릿이 이미 존재합니다." },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, template: data })
  } catch (error) {
    console.error("[Email Templates] POST error:", error)
    return NextResponse.json(
      { error: "템플릿 추가에 실패했습니다." },
      { status: 500 }
    )
  }
}

// PUT: 템플릿 수정
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, content, is_default, sort_order } = body

    if (!id) {
      return NextResponse.json({ error: "템플릿 ID가 필요합니다." }, { status: 400 })
    }

    // Get current template to check type
    const { data: currentTemplate } = await auth.supabase
      .from("email_templates")
      .select("type")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .single()

    if (!currentTemplate) {
      return NextResponse.json({ error: "템플릿을 찾을 수 없습니다." }, { status: 404 })
    }

    // If setting as default, unset other defaults of same type
    if (is_default) {
      await auth.supabase
        .from("email_templates")
        .update({ is_default: false })
        .eq("user_id", auth.user.id)
        .eq("type", currentTemplate.type)
        .neq("id", id)
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (content !== undefined) updateData.content = content.trim()
    if (is_default !== undefined) updateData.is_default = is_default
    if (sort_order !== undefined) updateData.sort_order = sort_order

    const { data, error } = await auth.supabase
      .from("email_templates")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .select()
      .single()

    if (error) {
      console.error("[Email Templates] Update error:", error)
      throw error
    }

    return NextResponse.json({ success: true, template: data })
  } catch (error) {
    console.error("[Email Templates] PUT error:", error)
    return NextResponse.json(
      { error: "템플릿 수정에 실패했습니다." },
      { status: 500 }
    )
  }
}

// PATCH: 템플릿 순서 변경 (bulk update)
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const { updates } = body as { updates: Array<{ id: string; sort_order: number }> }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: "순서 정보가 필요합니다." }, { status: 400 })
    }

    // Update each template's sort_order
    for (const update of updates) {
      await auth.supabase
        .from("email_templates")
        .update({ sort_order: update.sort_order })
        .eq("id", update.id)
        .eq("user_id", auth.user.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Email Templates] PATCH error:", error)
    return NextResponse.json(
      { error: "순서 변경에 실패했습니다." },
      { status: 500 }
    )
  }
}

// DELETE: 템플릿 삭제 (단일 또는 다중)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const { ids } = body as { ids: string[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "삭제할 템플릿 ID가 필요합니다." }, { status: 400 })
    }

    const { error } = await auth.supabase
      .from("email_templates")
      .delete()
      .in("id", ids)
      .eq("user_id", auth.user.id)

    if (error) {
      console.error("[Email Templates] Delete error:", error)
      throw error
    }

    return NextResponse.json({
      success: true,
      message: `${ids.length}개의 템플릿이 삭제되었습니다.`,
      count: ids.length,
    })
  } catch (error) {
    console.error("[Email Templates] DELETE error:", error)
    return NextResponse.json(
      { error: "템플릿 삭제에 실패했습니다." },
      { status: 500 }
    )
  }
}
