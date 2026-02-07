import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, prompt, styleImageBase64 } = await request.json()

    if (!imageBase64 || !prompt) {
      return NextResponse.json({ error: "이미지와 프롬프트가 필요합니다." }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey })

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []

    parts.push({
      text: `You are a PDF slide editor. Edit the following slide image based on the user's instructions.
Maintain the exact same layout, fonts, colors, and design style. Only change what the user explicitly requests.
User instruction: ${prompt}`,
    })

    // Target image
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: imageBase64,
      },
    })

    // Style reference (if provided)
    if (styleImageBase64) {
      parts.push({ text: "This is the original reference image. The output must match this image's background color, style, and all elements exactly — only remove what is explicitly requested:" })
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: styleImageBase64,
        },
      })
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    })

    let editedImageBase64: string | null = null
    let responseText: string | null = null

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          editedImageBase64 = part.inlineData.data ?? null
        } else if (part.text) {
          responseText = part.text
        }
      }
    }

    if (!editedImageBase64) {
      return NextResponse.json(
        { error: "AI가 이미지를 생성하지 못했습니다. 다른 프롬프트를 시도해주세요.", responseText },
        { status: 422 },
      )
    }

    return NextResponse.json({
      editedImageBase64,
      responseText,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류"
    if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("billing")) {
      return NextResponse.json(
        { error: "Gemini API 유료 키가 필요합니다. billing이 활성화된 API 키를 사용해주세요." },
        { status: 402 },
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
