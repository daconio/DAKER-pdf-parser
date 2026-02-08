import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const BUCKET_NAME = "images"

/** Encode a user-facing filename into a Supabase-safe storage key segment. */
function encodeFileName(fileName: string): string {
    const baseName = fileName.replace(/\.(png|jpg|jpeg|gif|webp)$/i, "")
    const ext = fileName.split('.').pop()
    return `${Buffer.from(baseName, "utf-8").toString("base64url")}.${ext}`
}

/**
 * Decode a storage key segment back into the original user-facing filename.
 */
function decodeFileName(storageFileName: string): string {
    const withoutTimestamp = storageFileName.replace(/^\d+_/, "")
    const parts = withoutTimestamp.split('.')
    const ext = parts.pop()
    const encoded = parts.join('.')

    if (!encoded) return `.${ext}`
    try {
        const decoded = Buffer.from(encoded, "base64url").toString("utf-8")
        if (Buffer.from(decoded, "utf-8").toString("base64url") === encoded) {
            return `${decoded}.${ext}`
        }
    } catch { /* not base64url */ }
    return withoutTimestamp
}

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

// Upload Image
export async function POST(request: NextRequest) {
    try {
        const user = await getUser(request)
        if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

        const formData = await request.formData()
        const file = formData.get("file") as File | null
        const fileName = formData.get("fileName") as string | null
        if (!file || !fileName) return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 })

        const safeName = encodeFileName(fileName)
        const filePath = `${user.id}/${Date.now()}_${safeName}`
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)

        const serviceClient = getServiceClient()
        const { error: uploadError } = await serviceClient.storage
            .from(BUCKET_NAME)
            .upload(filePath, uint8Array, { contentType: file.type, upsert: false })

        if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
        return NextResponse.json({ path: filePath, fileName })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "알 수 없는 오류"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

// List Images
export async function GET(request: NextRequest) {
    try {
        const user = await getUser(request)
        if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

        const serviceClient = getServiceClient()
        const { data: files, error: listError } = await serviceClient.storage
            .from(BUCKET_NAME)
            .list(user.id, { limit: 100, sortBy: { column: "created_at", order: "desc" } })

        if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

        const imageFiles = (files || [])
            .map((f) => ({
                name: decodeFileName(f.name),
                path: `${user.id}/${f.name}`,
                createdAt: f.created_at,
                size: f.metadata?.size || 0,
                url: serviceClient.storage.from(BUCKET_NAME).getPublicUrl(`${user.id}/${f.name}`).data.publicUrl
            }))

        return NextResponse.json({ files: imageFiles })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "알 수 없는 오류"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

// Delete Image
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
