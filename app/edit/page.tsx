"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Upload,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
  Send,
} from "lucide-react"
import * as pdfjsLib from "pdfjs-dist"
import { PDFDocument } from "pdf-lib"

const pdfjs: any = (pdfjsLib as any).default || pdfjsLib
const PDFJS_VERSION = "3.11.174"

if (typeof window !== "undefined" && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`
}

interface PageData {
  pageNumber: number
  originalImageBase64: string
  editedImageBase64: string | null
  width: number
  height: number
}

export default function EditPage() {
  const [pages, setPages] = useState<PageData[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [prompt, setPrompt] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [statusText, setStatusText] = useState("")
  const [error, setError] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState("")
  const [originalPdfBytes, setOriginalPdfBytes] = useState<Uint8Array | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  // Focus prompt input when pages are loaded
  useEffect(() => {
    if (pages.length > 0 && promptInputRef.current) {
      promptInputRef.current.focus()
    }
  }, [pages.length])

  const renderPdfPages = async (arrayBuffer: ArrayBuffer) => {
    setIsLoading(true)
    setStatusText("PDF 페이지 렌더링 중...")
    try {
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
        cMapPacked: true,
      })
      const pdf = await loadingTask.promise
      const totalPages = pdf.numPages
      const pagesData: PageData[] = []

      for (let i = 1; i <= totalPages; i++) {
        setStatusText(`페이지 렌더링 중... (${i}/${totalPages})`)
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2.0 })
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")!
        canvas.width = viewport.width
        canvas.height = viewport.height
        ctx.fillStyle = "#FFFFFF"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport }).promise

        const base64 = canvas.toDataURL("image/png").split(",")[1]
        pagesData.push({
          pageNumber: i,
          originalImageBase64: base64,
          editedImageBase64: null,
          width: viewport.width,
          height: viewport.height,
        })
      }

      setPages(pagesData)
      setCurrentPage(0)
      setStatusText("")
    } catch {
      setError("PDF를 읽을 수 없습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setError("PDF 파일만 지원합니다.")
      return
    }
    setError("")
    setFileName(file.name)
    const arrayBuffer = await file.arrayBuffer()
    setOriginalPdfBytes(new Uint8Array(arrayBuffer.slice(0)))
    await renderPdfPages(arrayBuffer)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const editCurrentPage = async () => {
    if (!prompt.trim() || isProcessing) return
    const page = pages[currentPage]
    if (!page) return

    setIsProcessing(true)
    setError("")
    setStatusText("AI가 페이지를 수정하고 있습니다...")

    try {
      const res = await fetch("/api/edit-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: page.editedImageBase64 || page.originalImageBase64,
          prompt: prompt.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "수정에 실패했습니다.")
        return
      }

      setPages((prev) =>
        prev.map((p, i) =>
          i === currentPage ? { ...p, editedImageBase64: data.editedImageBase64 } : p,
        ),
      )
      setPrompt("")
      setStatusText("")
    } catch {
      setError("서버 연결에 실패했습니다.")
    } finally {
      setIsProcessing(false)
      setStatusText("")
    }
  }

  const resetCurrentPage = () => {
    setPages((prev) =>
      prev.map((p, i) => (i === currentPage ? { ...p, editedImageBase64: null } : p)),
    )
  }

  const downloadEditedPdf = async () => {
    if (!originalPdfBytes) return
    setStatusText("PDF 생성 중...")

    try {
      const pdfDoc = await PDFDocument.load(new Uint8Array(originalPdfBytes))

      for (const page of pages) {
        if (page.editedImageBase64) {
          const imageBytes = Uint8Array.from(atob(page.editedImageBase64), (c) => c.charCodeAt(0))
          const mimeType = page.editedImageBase64.startsWith("/9j") ? "jpeg" : "png"
          const image =
            mimeType === "jpeg"
              ? await pdfDoc.embedJpg(imageBytes)
              : await pdfDoc.embedPng(imageBytes)

          const pdfPage = pdfDoc.getPage(page.pageNumber - 1)
          const { width, height } = pdfPage.getSize()

          // Clear page and draw edited image
          pdfPage.drawImage(image, {
            x: 0,
            y: 0,
            width,
            height,
          })
        }
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `edited_${fileName}`
      link.click()
    } catch {
      setError("PDF 저장에 실패했습니다.")
    } finally {
      setStatusText("")
    }
  }

  const currentPageData = pages[currentPage]
  const displayImage = currentPageData
    ? currentPageData.editedImageBase64 || currentPageData.originalImageBase64
    : null
  const hasEdits = pages.some((p) => p.editedImageBase64)

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800/50 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <ArrowLeft className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400">
                DAKER
              </span>{" "}
              <span className="text-white/90">PDF Editor</span>
            </h1>
          </Link>
          <div className="flex items-center gap-3">
            {hasEdits && (
              <button
                onClick={downloadEditedPdf}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/25"
              >
                <Download className="w-4 h-4" />
                PDF 다운로드
              </button>
            )}
            <span className="text-gray-500 text-xs">AI 기반 PDF 텍스트 수정</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex">
        {/* No file loaded */}
        {pages.length === 0 && !isLoading && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${
                isDragging
                  ? "border-indigo-400 bg-indigo-500/10"
                  : "border-gray-700 hover:border-gray-500 bg-gray-900/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
              />
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? "text-indigo-400" : "text-gray-600"}`} />
              <p className="text-lg font-medium text-gray-300 mb-1">PDF 파일을 드래그하거나 클릭하세요</p>
              <p className="text-sm text-gray-500">AI로 PDF 텍스트를 자연어로 수정할 수 있습니다</p>
            </div>
            {error && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">{statusText}</p>
            </div>
          </div>
        )}

        {/* Editor */}
        {pages.length > 0 && !isLoading && (
          <>
            {/* Page viewer */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
              {/* Page navigation */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl px-4 py-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-300 font-medium min-w-[80px] text-center">
                  {currentPage + 1} / {pages.length}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
                  disabled={currentPage === pages.length - 1}
                  className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Image display */}
              {displayImage && (
                <div className="relative max-h-[calc(100vh-220px)] flex items-center justify-center">
                  <img
                    src={`data:image/png;base64,${displayImage}`}
                    alt={`Page ${currentPage + 1}`}
                    className="max-h-[calc(100vh-220px)] w-auto rounded-lg shadow-2xl border border-gray-800"
                  />
                  {currentPageData?.editedImageBase64 && (
                    <div className="absolute top-3 right-3 flex gap-2">
                      <span className="px-2 py-1 bg-indigo-600/80 backdrop-blur-sm text-xs font-medium rounded-md text-white">
                        수정됨
                      </span>
                      <button
                        onClick={resetCurrentPage}
                        className="p-1.5 bg-gray-800/80 backdrop-blur-sm hover:bg-gray-700 rounded-md transition-colors"
                        title="원본으로 복원"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-gray-300" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Status */}
              {statusText && !isProcessing && (
                <p className="mt-4 text-sm text-gray-500">{statusText}</p>
              )}
            </div>

            {/* Prompt sidebar */}
            <aside className="w-96 border-l border-gray-800/50 flex flex-col bg-gray-950/50">
              <div className="p-5 border-b border-gray-800/50">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-white">AI 수정</h3>
                </div>
                <p className="text-xs text-gray-500">
                  자연어로 현재 페이지의 텍스트를 수정하세요
                </p>
              </div>

              <div className="flex-1 p-5 flex flex-col gap-4">
                {/* Quick actions */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">빠른 수정 예시</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      '제목을 "새로운 제목"으로 변경',
                      "본문 글꼴을 더 크게",
                      "배경색을 파란색으로 변경",
                      "오타 수정",
                    ].map((example) => (
                      <button
                        key={example}
                        onClick={() => setPrompt(example)}
                        className="px-3 py-1.5 text-xs text-gray-400 border border-gray-800 hover:border-gray-600 hover:text-white rounded-lg transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt input */}
                <div className="flex-1 flex flex-col">
                  <textarea
                    ref={promptInputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        editCurrentPage()
                      }
                    }}
                    placeholder="예: 제목을 '2025 분기 보고서'로 변경해주세요"
                    className="flex-1 w-full p-4 bg-black/50 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors min-h-[120px]"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
                    {error}
                  </div>
                )}

                <button
                  onClick={editCurrentPage}
                  disabled={!prompt.trim() || isProcessing}
                  className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-semibold rounded-xl transition-all duration-300"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {statusText || "처리 중..."}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      페이지 {currentPage + 1} 수정하기
                    </>
                  )}
                </button>
              </div>

              {/* Page thumbnails */}
              <div className="p-4 border-t border-gray-800/50">
                <p className="text-xs text-gray-500 font-medium mb-3">전체 페이지</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {pages.map((page, i) => (
                    <button
                      key={page.pageNumber}
                      onClick={() => setCurrentPage(i)}
                      className={`relative flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        i === currentPage
                          ? "border-indigo-500 ring-1 ring-indigo-500/30"
                          : "border-gray-800 hover:border-gray-600"
                      }`}
                    >
                      <img
                        src={`data:image/png;base64,${page.editedImageBase64 || page.originalImageBase64}`}
                        alt={`Page ${page.pageNumber}`}
                        className="w-full h-full object-cover"
                      />
                      {page.editedImageBase64 && (
                        <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-indigo-500 rounded-full" />
                      )}
                      <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/60 py-0.5">
                        {page.pageNumber}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  )
}
