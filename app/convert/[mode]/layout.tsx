import { notFound } from "next/navigation"
import { MODE_SLUG_MAP } from "@/lib/types"
import type { Metadata } from "next"

const MODE_META: Record<string, { title: string; description: string }> = {
  "pdf-to-image": { title: "PDF → 이미지 변환", description: "PDF를 고품질 PNG 이미지로 변환합니다" },
  "image-to-pdf": { title: "이미지 → PDF 변환", description: "여러 이미지를 하나의 PDF로 결합합니다" },
  "merge": { title: "PDF 합치기", description: "여러 PDF 파일을 하나로 병합합니다" },
  "flatten": { title: "PDF 병합", description: "PDF를 이미지로 변환 후 다시 PDF로 만듭니다" },
  "split": { title: "PDF 분할", description: "PDF 페이지를 개별 파일로 분리합니다" },
  "ai-edit": { title: "AI PDF 수정", description: "AI로 PDF 텍스트를 자연어로 수정합니다" },
}

export function generateStaticParams() {
  return Object.keys(MODE_SLUG_MAP).map((mode) => ({ mode }))
}

export async function generateMetadata({ params }: { params: Promise<{ mode: string }> }): Promise<Metadata> {
  const { mode } = await params
  const meta = MODE_META[mode]
  if (!meta) return {}
  return {
    title: `${meta.title} | DAKER PDF Parser`,
    description: meta.description,
  }
}

export default async function ConvertModeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ mode: string }>
}) {
  const { mode } = await params
  if (!MODE_SLUG_MAP[mode]) notFound()
  return <>{children}</>
}
