"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Link from "next/link"
import {
  FileText,
  Upload,
  Download,
  ArrowLeft,
  Loader2,
  CheckCircle,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Send,
  Pipette,
  Palette,
  Trash2,
  Pencil,
  Type,
  Square,
  Eraser,
  Save,
  ImagePlus,
  LogOut,
  Cloud,
  CloudUpload,
  FolderOpen,
  User,
} from "lucide-react"
import JSZip from "jszip"
import * as pdfjsLib from "pdfjs-dist"
import { PDFDocument } from "pdf-lib"
import {
  ConversionMode,
  ProcessStatus,
  type GeneratedFile,
} from "@/lib/types"
import {
  convertPdfToImages,
  convertImagesToPdf,
  mergePdfs,
  splitPdf,
  flattenPdfs,
  getPdfPageCount,
} from "@/lib/pdfService"
import { getSupabase } from "@/lib/supabase"
import { saveEditSession, loadEditSession, deleteEditSession } from "@/lib/idb"
import type { User as SupabaseUser } from "@supabase/supabase-js"

const pdfjs: any = (pdfjsLib as any).default || pdfjsLib
const PDFJS_VERSION = "3.11.174"

if (typeof window !== "undefined" && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`
}

const AI_EDIT = "AI_EDIT" as const

type AppMode = ConversionMode | typeof AI_EDIT
type EditSubMode = "ai" | "direct"
type DirectTool = "text" | "draw" | "rect" | "eraser"

const MODES: { id: AppMode; label: string; emoji: string; accept: string; desc: string }[] = [
  { id: ConversionMode.PDF_TO_PNG, label: "PDF → 이미지", emoji: "🖼️", accept: ".pdf", desc: "PDF를 고품질 PNG 이미지로 변환" },
  { id: ConversionMode.PNG_TO_PDF, label: "이미지 → PDF", emoji: "📄", accept: "image/*", desc: "여러 이미지를 하나의 PDF로 결합" },
  { id: ConversionMode.MERGE_PDF, label: "PDF 합치기", emoji: "📑", accept: ".pdf", desc: "여러 PDF 파일을 하나로 병합" },
  { id: ConversionMode.FLATTEN_PDF, label: "PDF 병합", emoji: "📋", accept: ".pdf", desc: "PDF를 이미지로 변환 후 다시 PDF로" },
  { id: ConversionMode.SPLIT_PDF, label: "PDF 분할", emoji: "✂️", accept: ".pdf", desc: "PDF 페이지를 개별 파일로 분리" },
  { id: AI_EDIT, label: "AI PDF 수정", emoji: "✨", accept: ".pdf", desc: "AI로 PDF 텍스트를 자연어로 수정" },
]

const MAX_UNDO_HISTORY = 20

const PRESET_BG_COLORS = [
  "#FFFFFF", "#F5F5F5", "#E8E8E8", "#000000", "#1A1A2E",
  "#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF",
  "#5856D6", "#AF52DE", "#FF2D55", "#2C3E50", "#1ABC9C",
]

interface TextItemData {
  text: string
  left: number
  top: number
  width: number
  height: number
}

interface EditPageData {
  pageNumber: number
  originalImageBase64: string
  editedImageBase64: string | null
  width: number
  height: number
  textItems: TextItemData[]
}

export default function ConvertPage() {
  const [mode, setMode] = useState<AppMode>(ConversionMode.PDF_TO_PNG)
  const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.IDLE)
  const [files, setFiles] = useState<File[]>([])
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState("")
  const [pageCount, setPageCount] = useState(0)
  const [pageRange, setPageRange] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI Edit state
  const [editPages, setEditPages] = useState<EditPageData[]>([])
  const [editCurrentPage, setEditCurrentPage] = useState(0)
  const [editPrompt, setEditPrompt] = useState("")
  const [editProcessing, setEditProcessing] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editStatusText, setEditStatusText] = useState("")
  const [editFileName, setEditFileName] = useState("")
  const [editOriginalBytes, setEditOriginalBytes] = useState<ArrayBuffer | null>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  // Inline text editing state
  const [editClickPos, setEditClickPos] = useState<{ left: number; top: number } | null>(null)
  const [editingOriginalText, setEditingOriginalText] = useState("")
  const [editingNewText, setEditingNewText] = useState("")
  const inlineInputRef = useRef<HTMLInputElement>(null)

  // Background color picker state
  const [bgColor, setBgColor] = useState("#FFFFFF")
  const [eyedropperMode, setEyedropperMode] = useState(false)

  // Drag-to-delete state
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const isDragRef = useRef(false)
  const imageWrapRef = useRef<HTMLDivElement>(null)

  // Direct editing state
  const [editSubMode, setEditSubMode] = useState<EditSubMode>("ai")
  const [directTool, setDirectTool] = useState<DirectTool>("draw")
  const [drawColor, setDrawColor] = useState("#FF0000")
  const [drawSize, setDrawSize] = useState(4)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDirectDrawingRef = useRef(false)
  const lastDrawPointRef = useRef<{ x: number; y: number } | null>(null)
  const [directTextInput, setDirectTextInput] = useState<{ x: number; y: number } | null>(null)
  const [directTextValue, setDirectTextValue] = useState("")
  const [directTextSize, setDirectTextSize] = useState(24)
  const [directRectStart, setDirectRectStart] = useState<{ x: number; y: number } | null>(null)
  const canvasSnapshotRef = useRef<ImageData | null>(null)
  const [canvasInitTrigger, setCanvasInitTrigger] = useState(0)
  const isConfirmingRef = useRef(false)

  // Undo history: per-page stack of previous image states
  const undoHistoryRef = useRef<Map<number, string[]>>(new Map())

  // Logo overlay state
  const [logoImage, setLogoImage] = useState<string | null>(null)
  const [logoFileName, setLogoFileName] = useState("")
  const [logoPosition, setLogoPosition] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("bottom-right")
  const [logoScale, setLogoScale] = useState(10)
  const [logoMargin, setLogoMargin] = useState(3)
  const [logoOpacity, setLogoOpacity] = useState(100)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Auth state
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Cloud storage state
  const [cloudFiles, setCloudFiles] = useState<Array<{ name: string; path: string; createdAt: string; size: number }>>([])
  const [cloudLoading, setCloudLoading] = useState(false)
  const [showCloudPanel, setShowCloudPanel] = useState(false)
  const [cloudUploading, setCloudUploading] = useState(false)

  // Session recovery state
  const [recoveryData, setRecoveryData] = useState<{
    editPages: EditPageData[]
    editFileName: string
    editCurrentPage: number
    timestamp: number
  } | null>(null)
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const currentMode = MODES.find((m) => m.id === mode)!
  const isAiEdit = mode === AI_EDIT

  useEffect(() => {
    if (editPages.length > 0 && promptInputRef.current) {
      promptInputRef.current.focus()
    }
  }, [editPages.length])

  // Auth initialization
  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // IndexedDB: Load recovery data on mount
  useEffect(() => {
    loadEditSession().then((data) => {
      if (data && data.editPages.length > 0) {
        // Cast - textItems is omitted from saved data, add empty arrays
        const restored = data.editPages.map((p) => ({ ...p, textItems: [] as TextItemData[] }))
        setRecoveryData({ ...data, editPages: restored })
        setShowRecoveryDialog(true)
      }
    })
  }, [])

  // IndexedDB: Auto-save editPages (debounced)
  useEffect(() => {
    if (editPages.length === 0) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      // Save without textItems to reduce storage size
      const stripped = editPages.map(({ textItems: _t, ...rest }) => rest)
      saveEditSession({
        editPages: stripped,
        editFileName: editFileName,
        editCurrentPage: editCurrentPage,
        timestamp: Date.now(),
      })
    }, 2000)
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [editPages, editCurrentPage, editFileName])

  // Keyboard shortcuts
  useEffect(() => {
    const saveCanvas = () => {
      if (editSubMode === "direct" && drawCanvasRef.current) {
        const b64 = drawCanvasRef.current.toDataURL("image/png").split(",")[1]
        setEditPages((prev) => prev.map((p, i) => i === editCurrentPage ? { ...p, editedImageBase64: b64 } : p))
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save PDF: Cmd+S / Ctrl+S (works even in INPUT/TEXTAREA)
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (isAiEdit && editPages.length > 0 && !editLoading && editPages.some((p) => p.editedImageBase64)) {
          downloadEditedPdf()
        }
        return
      }

      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (!isAiEdit || editPages.length === 0 || editLoading) return

      // Undo: Cmd+Z (Mac) / Ctrl+Z (Windows)
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        if (editProcessing) return
        if (editSubMode === "direct" && drawCanvasRef.current) {
          const b64 = drawCanvasRef.current.toDataURL("image/png").split(",")[1]
          setEditPages((prev) => prev.map((p, i) => i === editCurrentPage ? { ...p, editedImageBase64: b64 } : p))
        }
        performUndo()
        return
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault(); saveCanvas()
          setEditCurrentPage((p) => Math.max(0, p - 1))
          break
        case "ArrowRight":
          e.preventDefault(); saveCanvas()
          setEditCurrentPage((p) => Math.min(editPages.length - 1, p + 1))
          break
        case "Home":
          e.preventDefault(); saveCanvas()
          setEditCurrentPage(0)
          break
        case "End":
          e.preventDefault(); saveCanvas()
          setEditCurrentPage(editPages.length - 1)
          break
        case "Escape":
          if (editSubMode === "direct") {
            if (directTextInput) { setDirectTextInput(null); e.preventDefault() }
          } else {
            if (eyedropperMode) { setEyedropperMode(false); e.preventDefault() }
            else if (selectionBox) { setSelectionBox(null); e.preventDefault() }
            else if (editClickPos) { setEditClickPos(null); e.preventDefault() }
          }
          break
        case "Delete":
        case "Backspace":
          if (editSubMode === "ai" && selectionBox && !editProcessing) { deleteSelection(); e.preventDefault() }
          break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAiEdit, editPages.length, editLoading, eyedropperMode, editClickPos, selectionBox, editProcessing, editSubMode, directTextInput, editCurrentPage])

  // Warn before closing tab with unsaved edits
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editPages.some((p) => p.editedImageBase64)) {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [editPages])

  // Initialize canvas for direct editing mode
  useEffect(() => {
    if (editSubMode !== "direct" || editPages.length === 0) return
    const page = editPages[editCurrentPage]
    if (!page) return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const imgSrc = page.editedImageBase64 || page.originalImageBase64
    const img = new Image()
    img.onload = () => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0)
    }
    img.src = `data:image/png;base64,${imgSrc}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSubMode, editCurrentPage, canvasInitTrigger])

  const reset = () => {
    setStatus(ProcessStatus.IDLE)
    setFiles([])
    setGeneratedFiles([])
    setProgress({ current: 0, total: 0 })
    setError("")
    setPageCount(0)
    setPageRange("")
  }

  const resetEdit = () => {
    setEditPages([])
    setEditCurrentPage(0)
    setEditPrompt("")
    setEditProcessing(false)
    setEditLoading(false)
    setEditStatusText("")
    setEditFileName("")
    setEditOriginalBytes(null)
    setError("")
    setEditClickPos(null)
    setEditingOriginalText("")
    setEditingNewText("")
    setBgColor("#FFFFFF")
    setEyedropperMode(false)
    setDragStart(null)
    setDragEnd(null)
    setSelectionBox(null)
    setEditSubMode("ai")
    setDirectTool("draw")
    setDrawColor("#FF0000")
    setDrawSize(4)
    setDirectTextInput(null)
    setDirectTextValue("")
    setDirectTextSize(24)
    setDirectRectStart(null)
    undoHistoryRef.current.clear()
    setLogoImage(null)
    setLogoFileName("")
    setLogoPosition("bottom-right")
    setLogoScale(10)
    setLogoMargin(3)
    setLogoOpacity(100)
    deleteEditSession()
  }

  // --- Auth functions ---
  const signInWithGoogle = async () => {
    await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const signOut = async () => {
    await getSupabase().auth.signOut()
    setAuthUser(null)
    setShowCloudPanel(false)
    setCloudFiles([])
  }

  // --- Session recovery ---
  const recoverSession = () => {
    if (!recoveryData) return
    setMode(AI_EDIT)
    setEditPages(recoveryData.editPages)
    setEditCurrentPage(recoveryData.editCurrentPage)
    setEditFileName(recoveryData.editFileName)
    setShowRecoveryDialog(false)
    setRecoveryData(null)
  }

  const dismissRecovery = () => {
    setShowRecoveryDialog(false)
    setRecoveryData(null)
    deleteEditSession()
  }

  // --- Cloud storage functions ---
  const getAccessToken = async () => {
    const { data: { session } } = await getSupabase().auth.getSession()
    return session?.access_token || null
  }

  const fetchCloudFiles = async () => {
    if (!authUser) return
    setCloudLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await fetch("/api/pdf-storage", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setCloudFiles(data.files || [])
    } catch { /* ignore */ } finally { setCloudLoading(false) }
  }

  const uploadPdfToCloud = async () => {
    if (!authUser || !editOriginalBytes || !editFileName) return
    setCloudUploading(true)
    setError("")
    try {
      let pdfBytes: ArrayBuffer
      if (editPages.some((p) => p.editedImageBase64)) {
        const pdfDoc = await PDFDocument.load(editOriginalBytes)
        for (const page of editPages) {
          if (page.editedImageBase64) {
            const imageBytes = Uint8Array.from(atob(page.editedImageBase64), (c) => c.charCodeAt(0))
            const mimeType = page.editedImageBase64.startsWith("/9j") ? "jpeg" : "png"
            const image = mimeType === "jpeg" ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes)
            const pdfPage = pdfDoc.getPage(page.pageNumber - 1)
            const { width, height } = pdfPage.getSize()
            pdfPage.drawImage(image, { x: 0, y: 0, width, height })
          }
        }
        const saved = await pdfDoc.save()
        pdfBytes = saved.buffer as ArrayBuffer
      } else {
        pdfBytes = editOriginalBytes
      }

      const token = await getAccessToken()
      if (!token) { setError("로그인이 필요합니다."); return }

      const formData = new FormData()
      formData.append("file", new Blob([pdfBytes], { type: "application/pdf" }))
      formData.append("fileName", editFileName)

      const res = await fetch("/api/pdf-storage", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "업로드 실패"); return }
      await fetchCloudFiles()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류"
      setError(`클라우드 업로드 실패: ${msg}`)
    } finally { setCloudUploading(false) }
  }

  const downloadFromCloud = async (path: string) => {
    if (!authUser) return
    setEditLoading(true)
    setEditStatusText("클라우드에서 PDF 다운로드 중...")
    try {
      const token = await getAccessToken()
      if (!token) { setError("로그인이 필요합니다."); setEditLoading(false); return }

      const res = await fetch("/api/pdf-storage", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "다운로드 실패"); setEditLoading(false); return }

      const pdfRes = await fetch(data.signedUrl)
      const arrayBuffer = await pdfRes.arrayBuffer()
      setEditOriginalBytes(arrayBuffer)
      const fileName = path.split("/").pop()?.replace(/^\d+_/, "") || "cloud.pdf"
      setEditFileName(fileName)
      setMode(AI_EDIT)
      resetEdit()
      await renderEditPdfPages(arrayBuffer)
      setShowCloudPanel(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류"
      setError(`클라우드 파일 로드 실패: ${msg}`)
    } finally { setEditLoading(false); setEditStatusText("") }
  }

  const deleteFromCloud = async (path: string) => {
    if (!authUser) return
    try {
      const token = await getAccessToken()
      if (!token) return
      const res = await fetch("/api/pdf-storage", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      })
      if (res.ok) setCloudFiles((prev) => prev.filter((f) => f.path !== path))
    } catch { /* ignore */ }
  }

  const pushUndoSnapshot = (pageIndex: number) => {
    const page = editPages[pageIndex]
    if (!page) return
    const history = undoHistoryRef.current.get(pageIndex) || []
    history.push(page.editedImageBase64 || "")
    if (history.length > MAX_UNDO_HISTORY) {
      history.splice(0, history.length - MAX_UNDO_HISTORY)
    }
    undoHistoryRef.current.set(pageIndex, history)
  }

  const performUndo = () => {
    const history = undoHistoryRef.current.get(editCurrentPage)
    if (!history || history.length === 0) return
    const previousState = history.pop()!
    undoHistoryRef.current.set(editCurrentPage, history)
    const restoredValue = previousState === "" ? null : previousState
    setEditPages((prev) => prev.map((p, i) => i === editCurrentPage ? { ...p, editedImageBase64: restoredValue } : p))
    if (editSubMode === "direct") {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode)
    reset()
    resetEdit()
  }

  // --- Convert logic ---
  const handleFiles = async (newFiles: File[]) => {
    if (newFiles.length === 0) return
    setError("")
    const convMode = mode as ConversionMode
    if (convMode === ConversionMode.PDF_TO_PNG || convMode === ConversionMode.SPLIT_PDF) {
      try {
        const count = await getPdfPageCount(newFiles[0])
        setPageCount(count)
        setPageRange(`1-${count}`)
        setFiles([newFiles[0]])
      } catch {
        setError("PDF 파일을 읽을 수 없습니다. 암호화된 파일인지 확인해주세요.")
      }
    } else {
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const droppedFiles = Array.from(e.dataTransfer.files)
      if (isAiEdit) {
        const file = droppedFiles[0]
        if (file) handleEditFile(file)
      } else {
        handleFiles(droppedFiles)
      }
    },
    [mode],
  )

  const parsePageRange = (range: string, total: number): number[] | null => {
    const pages = new Set<number>()
    const parts = range.split(",")
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed.includes("-")) {
        const [startStr, endStr] = trimmed.split("-")
        const start = parseInt(startStr)
        const end = parseInt(endStr)
        if (isNaN(start) || isNaN(end) || start < 1 || end > total || start > end) return null
        for (let i = start; i <= end; i++) pages.add(i)
      } else {
        const num = parseInt(trimmed)
        if (isNaN(num) || num < 1 || num > total) return null
        pages.add(num)
      }
    }
    return Array.from(pages).sort((a, b) => a - b)
  }

  const startConversion = async () => {
    if (files.length === 0) return
    setStatus(ProcessStatus.PROCESSING)
    setError("")
    try {
      let results: GeneratedFile[] = []
      const onProgress = (c: number, t: number) => setProgress({ current: c, total: t })
      const convMode = mode as ConversionMode

      if (convMode === ConversionMode.PDF_TO_PNG) {
        const pages = parsePageRange(pageRange, pageCount)
        if (!pages) { setError("페이지 범위가 올바르지 않습니다."); setStatus(ProcessStatus.IDLE); return }
        const blobs = await convertPdfToImages(files[0], onProgress, pages)
        results = blobs.map((b, i) => ({ id: `res-${i}`, name: `${files[0].name.replace(".pdf", "")}_${pages[i]}.png`, url: URL.createObjectURL(b), blob: b }))
      } else if (convMode === ConversionMode.PNG_TO_PDF) {
        const blob = await convertImagesToPdf(files, onProgress)
        results = [{ id: "res-0", name: "converted.pdf", url: URL.createObjectURL(blob), blob }]
      } else if (convMode === ConversionMode.MERGE_PDF) {
        const blob = await mergePdfs(files, onProgress)
        results = [{ id: "res-0", name: "merged.pdf", url: URL.createObjectURL(blob), blob }]
      } else if (convMode === ConversionMode.FLATTEN_PDF) {
        const blob = await flattenPdfs(files, onProgress)
        results = [{ id: "res-0", name: "flattened.pdf", url: URL.createObjectURL(blob), blob }]
      } else if (convMode === ConversionMode.SPLIT_PDF) {
        const pages = parsePageRange(pageRange, pageCount)
        if (!pages) { setError("페이지 범위가 올바르지 않습니다."); setStatus(ProcessStatus.IDLE); return }
        const blobs = await splitPdf(files[0], pages, onProgress)
        results = blobs.map((b, i) => ({ id: `res-${i}`, name: `${files[0].name.replace(".pdf", "")}_page${pages[i]}.pdf`, url: URL.createObjectURL(b), blob: b }))
      }
      setGeneratedFiles(results)
      setStatus(ProcessStatus.COMPLETED)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "변환 중 오류가 발생했습니다.")
      setStatus(ProcessStatus.ERROR)
    }
  }

  const downloadAll = async () => {
    if (generatedFiles.length === 1) {
      const link = document.createElement("a"); link.href = generatedFiles[0].url; link.download = generatedFiles[0].name; link.click()
    } else {
      const zip = new JSZip(); generatedFiles.forEach((f) => zip.file(f.name, f.blob))
      const content = await zip.generateAsync({ type: "blob" })
      const link = document.createElement("a"); link.href = URL.createObjectURL(content); link.download = "daker_results.zip"; link.click()
    }
  }

  const removeFile = (index: number) => { setFiles((prev) => prev.filter((_, i) => i !== index)) }

  const needsPageRange = mode === ConversionMode.PDF_TO_PNG || mode === ConversionMode.SPLIT_PDF
  const isSingleFileMode = mode === ConversionMode.PDF_TO_PNG || mode === ConversionMode.SPLIT_PDF

  // --- AI Edit logic ---
  const renderEditPdfPages = async (arrayBuffer: ArrayBuffer) => {
    setEditLoading(true)
    setEditStatusText("PDF 페이지 렌더링 중...")
    try {
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer, cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`, cMapPacked: true })
      const pdf = await loadingTask.promise
      const totalPages = pdf.numPages
      const pagesData: EditPageData[] = []
      for (let i = 1; i <= totalPages; i++) {
        setEditStatusText(`페이지 렌더링 중... (${i}/${totalPages})`)
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2.0 })
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")!
        canvas.width = viewport.width; canvas.height = viewport.height
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport }).promise

        // Extract text content for click-to-edit overlay
        const textContent = await page.getTextContent()
        const textItems: TextItemData[] = []
        const vt = viewport.transform
        for (const item of textContent.items) {
          if (!("str" in item) || !item.str.trim()) continue
          const tx = item.transform[4]
          const ty = item.transform[5]
          const vx = tx * vt[0] + ty * vt[2] + vt[4]
          const vy = tx * vt[1] + ty * vt[3] + vt[5]
          const fontSize = Math.abs(item.transform[3]) * viewport.scale
          if (fontSize < 1) continue
          let textWidth: number
          if (item.width && item.width > 0) {
            const vx2 = (tx + item.width) * vt[0] + ty * vt[2] + vt[4]
            textWidth = Math.abs(vx2 - vx)
          } else {
            // Fallback for CJK fonts where width may not be computed
            textWidth = item.str.length * fontSize * 0.65
          }
          if (textWidth < 1) textWidth = item.str.length * fontSize * 0.65
          textItems.push({
            text: item.str,
            left: (vx / viewport.width) * 100,
            top: ((vy - fontSize) / viewport.height) * 100,
            width: (textWidth / viewport.width) * 100,
            height: ((fontSize * 1.4) / viewport.height) * 100,
          })
        }

        pagesData.push({ pageNumber: i, originalImageBase64: canvas.toDataURL("image/png").split(",")[1], editedImageBase64: null, width: viewport.width, height: viewport.height, textItems })
      }
      setEditPages(pagesData)
      setEditCurrentPage(0)
      setEditStatusText("")
    } catch { setError("PDF를 읽을 수 없습니다.") } finally { setEditLoading(false) }
  }

  const handleEditFile = async (file: File) => {
    if (!file.name.endsWith(".pdf")) { setError("PDF 파일만 지원합니다."); return }
    setError(""); setEditFileName(file.name)
    const arrayBuffer = await file.arrayBuffer()
    setEditOriginalBytes(arrayBuffer)
    await renderEditPdfPages(arrayBuffer)
  }

  const submitEditPage = async (overridePrompt?: string) => {
    const promptToUse = overridePrompt || editPrompt.trim()
    if (!promptToUse || editProcessing) return
    const page = editPages[editCurrentPage]
    if (!page) return
    setEditProcessing(true); setError(""); setEditStatusText("AI가 페이지를 수정하고 있습니다...")
    try {
      const res = await fetch("/api/edit-pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: page.editedImageBase64 || page.originalImageBase64, prompt: promptToUse }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "수정에 실패했습니다."); return }
      pushUndoSnapshot(editCurrentPage)
      setEditPages((prev) => prev.map((p, i) => i === editCurrentPage ? { ...p, editedImageBase64: data.editedImageBase64 } : p))
      setEditPrompt(""); setEditStatusText("")
    } catch { setError("서버 연결에 실패했습니다.") } finally { setEditProcessing(false); setEditStatusText("") }
  }

  const resetEditCurrentPage = () => {
    pushUndoSnapshot(editCurrentPage)
    setEditPages((prev) => prev.map((p, i) => (i === editCurrentPage ? { ...p, editedImageBase64: null } : p)))
    if (editSubMode === "direct") {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  const getImagePercent = (e: React.MouseEvent, rect: DOMRect) => ({
    x: ((e.clientX - rect.left) / rect.width) * 100,
    y: ((e.clientY - rect.top) / rect.height) * 100,
  })

  const handleImageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editProcessing || editClickPos) return
    if (eyedropperMode) { pickColorFromImage(e); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = getImagePercent(e, rect)
    setDragStart(pos)
    setDragEnd(pos)
    isDragRef.current = false
    setSelectionBox(null)
  }

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStart || editProcessing || eyedropperMode) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = getImagePercent(e, rect)
    const dx = Math.abs(pos.x - dragStart.x)
    const dy = Math.abs(pos.y - dragStart.y)
    if (dx > 2 || dy > 2) isDragRef.current = true
    setDragEnd(pos)
  }

  const handleImageMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (eyedropperMode || editProcessing) { setDragStart(null); setDragEnd(null); return }
    if (!dragStart) return

    if (isDragRef.current && dragEnd) {
      // Drag completed → create selection box
      const left = Math.min(dragStart.x, dragEnd.x)
      const top = Math.min(dragStart.y, dragEnd.y)
      const width = Math.abs(dragEnd.x - dragStart.x)
      const height = Math.abs(dragEnd.y - dragStart.y)
      if (width > 3 && height > 3) {
        setSelectionBox({ left, top, width, height })
      }
    } else {
      // Simple click → inline text edit
      const rect = e.currentTarget.getBoundingClientRect()
      const clickLeft = ((e.clientX - rect.left) / rect.width) * 100
      const clickTop = ((e.clientY - rect.top) / rect.height) * 100
      let foundText = ""
      if (editPageData?.textItems) {
        for (const t of editPageData.textItems) {
          if (clickLeft >= t.left - 2 && clickLeft <= t.left + t.width + 2 &&
              clickTop >= t.top - 2 && clickTop <= t.top + t.height + 2) {
            foundText = t.text
            break
          }
        }
        if (!foundText) {
          let minDist = Infinity
          for (const t of editPageData.textItems) {
            const cx = t.left + t.width / 2
            const cy = t.top + t.height / 2
            const dist = Math.sqrt((clickLeft - cx) ** 2 + (clickTop - cy) ** 2)
            if (dist < minDist && dist < 6) { minDist = dist; foundText = t.text }
          }
        }
      }
      setEditClickPos({ left: clickLeft, top: clickTop })
      setEditingOriginalText(foundText)
      setEditingNewText(foundText)
      setTimeout(() => inlineInputRef.current?.select(), 0)
    }
    setDragStart(null)
    setDragEnd(null)
  }

  const deleteSelection = () => {
    if (!selectionBox) return
    const page = editPages[editCurrentPage]
    if (!page) return
    const imgSrc = page.editedImageBase64 || page.originalImageBase64
    const { left, top, width, height } = selectionBox

    pushUndoSnapshot(editCurrentPage)
    setSelectionBox(null)

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0)
      const rx = (left / 100) * img.naturalWidth
      const ry = (top / 100) * img.naturalHeight
      const rw = (width / 100) * img.naturalWidth
      const rh = (height / 100) * img.naturalHeight
      ctx.fillStyle = bgColor
      ctx.fillRect(rx, ry, rw, rh)
      const newBase64 = canvas.toDataURL("image/png").split(",")[1]
      setEditPages((prev) => prev.map((p, i) => i === editCurrentPage ? { ...p, editedImageBase64: newBase64 } : p))
    }
    img.src = `data:image/png;base64,${imgSrc}`
  }

  // Live drag rectangle (during dragging)
  const liveDragBox = dragStart && dragEnd && isDragRef.current ? {
    left: Math.min(dragStart.x, dragEnd.x),
    top: Math.min(dragStart.y, dragEnd.y),
    width: Math.abs(dragEnd.x - dragStart.x),
    height: Math.abs(dragEnd.y - dragStart.y),
  } : null

  const confirmTextEdit = () => {
    if (!editClickPos) return
    const newText = editingNewText.trim()
    if (!newText) {
      setEditClickPos(null)
      return
    }
    // Guard against blur handler closing the input during confirmation
    isConfirmingRef.current = true
    let prompt: string
    if (editingOriginalText && newText !== editingOriginalText) {
      prompt = `"${editingOriginalText}"을(를) "${newText}"(으)로 변경해주세요. 정확히 해당 텍스트만 변경하고 나머지는 그대로 유지하세요.`
    } else if (editingOriginalText && newText === editingOriginalText) {
      // User didn't change the text — no-op
      setEditClickPos(null)
      isConfirmingRef.current = false
      return
    } else {
      prompt = newText
    }
    setEditClickPos(null)
    setEditPrompt(prompt)
    submitEditPage(prompt)
    setTimeout(() => { isConfirmingRef.current = false }, 100)
  }

  const pickColorFromImage = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editDisplayImage) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0)
      const scaleX = img.naturalWidth / rect.width
      const scaleY = img.naturalHeight / rect.height
      const px = Math.max(0, Math.min(Math.round(x * scaleX), img.naturalWidth - 1))
      const py = Math.max(0, Math.min(Math.round(y * scaleY), img.naturalHeight - 1))
      const pixel = ctx.getImageData(px, py, 1, 1).data
      const hex = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`.toUpperCase()
      setBgColor(hex)
      setEyedropperMode(false)
    }
    img.src = `data:image/png;base64,${editDisplayImage}`
  }

  const startEyedropper = async () => {
    // Try native EyeDropper API first (Chrome/Edge)
    if ("EyeDropper" in window) {
      try {
        const eyeDropper = new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper()
        const result = await eyeDropper.open()
        setBgColor(result.sRGBHex.toUpperCase())
        return
      } catch {
        // User cancelled or API failed
      }
    }
    // Fallback: enable canvas-based color picking on image
    setEyedropperMode(true)
  }

  const applyBgColor = () => {
    if (editProcessing) return
    const prompt = `전체 배경색을 ${bgColor} 색상으로 변경해주세요. 텍스트, 이미지, 도형 등 다른 모든 요소는 그대로 유지하고 배경색만 변경해주세요.`
    setEditPrompt(prompt)
    submitEditPage(prompt)
  }

  const applyBgColorAll = async () => {
    if (editProcessing || editPages.length === 0) return
    const prompt = `전체 배경색을 ${bgColor} 색상으로 변경해주세요. 텍스트, 이미지, 도형 등 다른 모든 요소는 그대로 유지하고 배경색만 변경해주세요.`
    setEditProcessing(true)
    setError("")
    let failCount = 0
    for (let i = 0; i < editPages.length; i++) {
      setEditCurrentPage(i)
      setEditStatusText(`배경색 변경 중... (${i + 1}/${editPages.length})`)
      const page = editPages[i]
      try {
        const res = await fetch("/api/edit-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: page.editedImageBase64 || page.originalImageBase64, prompt }),
        })
        const data = await res.json()
        if (res.ok && data.editedImageBase64) {
          pushUndoSnapshot(i)
          setEditPages((prev) => prev.map((p, idx) => idx === i ? { ...p, editedImageBase64: data.editedImageBase64 } : p))
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }
    setEditProcessing(false)
    setEditStatusText("")
    if (failCount > 0) {
      setError(`${editPages.length - failCount}/${editPages.length} 페이지 완료 (${failCount}개 실패)`)
    }
  }

  // --- Logo overlay functions ---
  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1]
      setLogoImage(base64)
      setLogoFileName(file.name)
    }
    reader.readAsDataURL(file)
  }

  const applyLogoToPage = (pageIndex: number): Promise<void> => {
    return new Promise((resolve) => {
      if (!logoImage) { resolve(); return }
      const page = editPages[pageIndex]
      if (!page) { resolve(); return }
      const imgSrc = page.editedImageBase64 || page.originalImageBase64
      const bgImg = new window.Image()
      bgImg.onload = () => {
        const logoImg = new window.Image()
        logoImg.onload = () => {
          const canvas = document.createElement("canvas")
          canvas.width = bgImg.naturalWidth
          canvas.height = bgImg.naturalHeight
          const ctx = canvas.getContext("2d")!
          ctx.drawImage(bgImg, 0, 0)

          const logoW = (logoScale / 100) * canvas.width
          const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth)
          const m = (logoMargin / 100) * canvas.width

          let x = 0, y = 0
          switch (logoPosition) {
            case "top-left":     x = m;                        y = m; break
            case "top-right":    x = canvas.width - logoW - m; y = m; break
            case "bottom-left":  x = m;                        y = canvas.height - logoH - m; break
            case "bottom-right": x = canvas.width - logoW - m; y = canvas.height - logoH - m; break
          }

          ctx.globalAlpha = logoOpacity / 100
          ctx.drawImage(logoImg, x, y, logoW, logoH)
          ctx.globalAlpha = 1

          const newBase64 = canvas.toDataURL("image/png").split(",")[1]
          setEditPages((prev) => prev.map((p, i) => i === pageIndex ? { ...p, editedImageBase64: newBase64 } : p))
          resolve()
        }
        logoImg.src = `data:image/png;base64,${logoImage}`
      }
      bgImg.src = `data:image/png;base64,${imgSrc}`
    })
  }

  const applyLogoCurrent = async () => {
    if (!logoImage || editProcessing) return
    setEditProcessing(true)
    setEditStatusText("로고 적용 중...")
    pushUndoSnapshot(editCurrentPage)
    await applyLogoToPage(editCurrentPage)
    setEditProcessing(false)
    setEditStatusText("")
  }

  const applyLogoAll = async () => {
    if (!logoImage || editProcessing || editPages.length === 0) return
    setEditProcessing(true)
    setError("")
    for (let i = 0; i < editPages.length; i++) {
      setEditCurrentPage(i)
      setEditStatusText(`로고 적용 중... (${i + 1}/${editPages.length})`)
      pushUndoSnapshot(i)
      await applyLogoToPage(i)
    }
    setEditProcessing(false)
    setEditStatusText("")
  }

  // --- Direct editing functions ---
  const saveDirectCanvas = (pageIndex?: number) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const idx = pageIndex ?? editCurrentPage
    pushUndoSnapshot(idx)
    const base64 = canvas.toDataURL("image/png").split(",")[1]
    setEditPages((prev) => prev.map((p, i) => i === idx ? { ...p, editedImageBase64: base64 } : p))
  }

  const handleSubModeChange = (newMode: EditSubMode) => {
    if (newMode === editSubMode) return
    if (editSubMode === "direct") saveDirectCanvas()
    setEditSubMode(newMode)
    setDirectTextInput(null)
    setDirectTextValue("")
    setEditClickPos(null)
    setSelectionBox(null)
    setEyedropperMode(false)
  }

  const navigateToPage = (page: number) => {
    if (page === editCurrentPage) return
    if (editSubMode === "direct") saveDirectCanvas()
    setEditCurrentPage(page)
  }

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const handleDirectMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const pos = getCanvasCoords(e)
    const ctx = canvas.getContext("2d")!
    const scale = canvas.width / canvas.getBoundingClientRect().width

    if (directTool === "draw" || directTool === "eraser") {
      isDirectDrawingRef.current = true
      lastDrawPointRef.current = pos
      canvasSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.strokeStyle = directTool === "eraser" ? "#FFFFFF" : drawColor
      ctx.lineWidth = (directTool === "eraser" ? drawSize * 5 : drawSize) * scale
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
    } else if (directTool === "text") {
      if (directTextInput && directTextValue.trim()) addDirectText()
      setDirectTextInput(pos)
      setDirectTextValue("")
    } else if (directTool === "rect") {
      setDirectRectStart(pos)
      canvasSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    }
  }

  const handleDirectMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const pos = getCanvasCoords(e)
    const ctx = canvas.getContext("2d")!

    if ((directTool === "draw" || directTool === "eraser") && isDirectDrawingRef.current) {
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastDrawPointRef.current = pos
    } else if (directTool === "rect" && directRectStart) {
      if (canvasSnapshotRef.current) {
        ctx.putImageData(canvasSnapshotRef.current, 0, 0)
      }
      const scale = canvas.width / canvas.getBoundingClientRect().width
      ctx.strokeStyle = drawColor
      ctx.lineWidth = drawSize * scale
      ctx.strokeRect(directRectStart.x, directRectStart.y, pos.x - directRectStart.x, pos.y - directRectStart.y)
    }
  }

  const handleDirectMouseUp = () => {
    if ((directTool === "draw" || directTool === "eraser") && isDirectDrawingRef.current) {
      isDirectDrawingRef.current = false
      lastDrawPointRef.current = null
    } else if (directTool === "rect" && directRectStart) {
      setDirectRectStart(null)
      canvasSnapshotRef.current = null
    }
  }

  const addDirectText = () => {
    if (!directTextInput || !directTextValue.trim() || !drawCanvasRef.current) return
    const canvas = drawCanvasRef.current
    const ctx = canvas.getContext("2d")!
    const scale = canvas.width / canvas.getBoundingClientRect().width
    const fontSize = directTextSize * scale
    ctx.fillStyle = drawColor
    ctx.font = `${fontSize}px sans-serif`
    ctx.fillText(directTextValue, directTextInput.x, directTextInput.y + fontSize)
    setDirectTextInput(null)
    setDirectTextValue("")
  }

  const downloadEditedPdf = async () => {
    if (!editOriginalBytes) return
    setEditStatusText("PDF 생성 중...")
    try {
      const pdfDoc = await PDFDocument.load(editOriginalBytes)
      for (const page of editPages) {
        if (page.editedImageBase64) {
          const imageBytes = Uint8Array.from(atob(page.editedImageBase64), (c) => c.charCodeAt(0))
          const mimeType = page.editedImageBase64.startsWith("/9j") ? "jpeg" : "png"
          const image = mimeType === "jpeg" ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes)
          const pdfPage = pdfDoc.getPage(page.pageNumber - 1)
          const { width, height } = pdfPage.getSize()
          pdfPage.drawImage(image, { x: 0, y: 0, width, height })
        }
      }
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" })
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `edited_${editFileName}`; link.click()
    } catch { setError("PDF 저장에 실패했습니다.") } finally { setEditStatusText("") }
  }

  const editPageData = editPages[editCurrentPage]
  const editDisplayImage = editPageData ? editPageData.editedImageBase64 || editPageData.originalImageBase64 : null
  const hasEdits = editPages.some((p) => p.editedImageBase64)

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Session Recovery Dialog */}
      {showRecoveryDialog && recoveryData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">이전 작업 복구</h3>
            <p className="text-sm text-gray-400">
              저장되지 않은 이전 작업이 있습니다.
              <br />
              <span className="text-gray-300 font-medium">{recoveryData.editFileName}</span> ({recoveryData.editPages.length}페이지)
              <br />
              <span className="text-xs text-gray-500">{new Date(recoveryData.timestamp).toLocaleString("ko-KR")}</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={recoverSession}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all"
              >
                복구하기
              </button>
              <button
                onClick={dismissRecovery}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl transition-all"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud PDF Panel (Overlay) */}
      {showCloudPanel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-indigo-400" />
                내 클라우드 PDF
              </h3>
              <button onClick={() => setShowCloudPanel(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {cloudLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : cloudFiles.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                저장된 PDF가 없습니다.
                <br />
                PDF를 편집한 후 &quot;클라우드 저장&quot; 버튼으로 저장할 수 있습니다.
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-2">
                {cloudFiles.map((file) => (
                  <div key={file.path} className="flex items-center gap-3 p-3 bg-gray-800/50 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
                    <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {file.createdAt ? new Date(file.createdAt).toLocaleString("ko-KR") : ""}
                        {file.size ? ` · ${(file.size / 1024 / 1024).toFixed(1)}MB` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadFromCloud(file.path)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all"
                    >
                      열기
                    </button>
                    <button
                      onClick={() => deleteFromCloud(file.path)}
                      className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <ArrowLeft className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400">
                DAKER
              </span>{" "}
              <span className="text-white/90">PDF Parser</span>
            </h1>
          </Link>
          <div className="flex items-center gap-3">
            {isAiEdit && hasEdits && (
              <>
                <button
                  onClick={downloadEditedPdf}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/25"
                >
                  <Download className="w-4 h-4" />
                  PDF 다운로드
                </button>
                {authUser && (
                  <button
                    onClick={uploadPdfToCloud}
                    disabled={cloudUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25"
                  >
                    {cloudUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                    클라우드 저장
                  </button>
                )}
              </>
            )}
            {authUser && (
              <button
                onClick={() => { setShowCloudPanel(!showCloudPanel); if (!showCloudPanel) fetchCloudFiles() }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                내 PDF
              </button>
            )}
            {/* Auth */}
            {authLoading ? (
              <div className="w-9 h-9 rounded-full bg-gray-800/60 animate-pulse ring-1 ring-gray-700" />
            ) : authUser ? (
              <div className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-gray-800/60 border border-gray-700/50 rounded-full hover:border-gray-600 transition-all group">
                {authUser.user_metadata?.avatar_url ? (
                  <img src={authUser.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-full ring-2 ring-indigo-500/40" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ring-2 ring-indigo-500/40">
                    <User className="w-3 h-3 text-white" />
                  </div>
                )}
                <span className="text-xs text-gray-300 font-medium max-w-[80px] truncate hidden sm:inline px-1">
                  {authUser.user_metadata?.full_name || authUser.email?.split("@")[0]}
                </span>
                <button
                  onClick={signOut}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="로그아웃"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-full shadow-sm hover:shadow-md border border-gray-200 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0">
          <nav className="space-y-2 sticky top-8">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all duration-200 ${
                  mode === m.id
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent"
                }`}
              >
                <span className="text-base flex-shrink-0">{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Mode Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight mb-2">{currentMode.label}</h2>
            <p className="text-gray-400">{currentMode.desc}</p>
          </div>

          {/* ====== CONVERT MODES ====== */}
          {!isAiEdit && (
            <>
              {/* IDLE: Drop Zone */}
              {(status === ProcessStatus.IDLE || status === ProcessStatus.ERROR) && (
                <div className="space-y-6">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${
                      isDragging ? "border-indigo-400 bg-indigo-500/10" : "border-gray-700 hover:border-gray-500 bg-gray-900/30"
                    }`}
                  >
                    <input ref={fileInputRef} type="file" accept={currentMode.accept} multiple={!isSingleFileMode} className="hidden" onChange={(e) => handleFiles(Array.from(e.target.files || []))} />
                    <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragging ? "text-indigo-400" : "text-gray-600"}`} />
                    <p className="text-lg font-medium text-gray-300 mb-1">파일을 드래그하거나 클릭하세요</p>
                    <p className="text-sm text-gray-500">모든 파일은 기기 내에서만 처리됩니다</p>
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-3">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
                          <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                          <span className="text-sm text-gray-300 truncate flex-1">{f.name}</span>
                          <span className="text-xs text-gray-500">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                          {!isSingleFileMode && (
                            <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                          )}
                        </div>
                      ))}
                      {!isSingleFileMode && (
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400 hover:text-white border border-dashed border-gray-700 hover:border-gray-500 rounded-xl w-full justify-center transition-colors">
                          <Plus className="w-4 h-4" /> 파일 추가
                        </button>
                      )}
                    </div>
                  )}

                  {needsPageRange && pageCount > 0 && (
                    <div className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-300">페이지 선택</span>
                        <span className="text-xs text-gray-500">총 {pageCount}페이지</span>
                      </div>
                      <input type="text" value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="예: 1-5, 8, 11-15" className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                    </div>
                  )}

                  {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">{error}</div>}

                  {files.length > 0 && (
                    <button onClick={startConversion} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/25">
                      변환 시작
                    </button>
                  )}
                </div>
              )}

              {status === ProcessStatus.PROCESSING && (
                <div className="flex flex-col items-center justify-center py-24 space-y-6">
                  <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                  <div className="text-center">
                    <p className="text-lg font-medium text-white mb-2">변환 중...</p>
                    {progress.total > 0 && <p className="text-sm text-gray-400">{progress.current} / {progress.total}</p>}
                  </div>
                  {progress.total > 0 && (
                    <div className="w-full max-w-md">
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {status === ProcessStatus.COMPLETED && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-5 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-medium text-green-300">변환 완료 — {generatedFiles.length}개 파일 생성</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {generatedFiles.map((f) => (
                      <div key={f.id} className="group border border-gray-800 rounded-xl overflow-hidden bg-gray-900/50 hover:border-gray-600 transition-colors">
                        <div className="aspect-square bg-gray-800/50 flex items-center justify-center">
                          {f.name.endsWith(".png") ? <img src={f.url} alt={f.name} className="w-full h-full object-cover" /> : <FileText className="w-8 h-8 text-gray-600" />}
                        </div>
                        <div className="p-2 truncate text-[10px] text-gray-400 font-medium">{f.name}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <button onClick={downloadAll} className="flex-1 flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/25">
                      <Download className="w-5 h-5" />
                      {generatedFiles.length === 1 ? "다운로드" : "ZIP 다운로드"}
                    </button>
                    <button onClick={reset} className="px-8 py-4 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-semibold rounded-xl transition-all duration-300">
                      새로 시작
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ====== AI EDIT MODE ====== */}
          {isAiEdit && (
            <>
              {/* Drop zone */}
              {editPages.length === 0 && !editLoading && (
                <div className="space-y-6">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                    onClick={() => editFileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${
                      isDragging ? "border-indigo-400 bg-indigo-500/10" : "border-gray-700 hover:border-gray-500 bg-gray-900/30"
                    }`}
                  >
                    <input ref={editFileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEditFile(f) }} />
                    <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? "text-indigo-400" : "text-gray-600"}`} />
                    <p className="text-lg font-medium text-gray-300 mb-1">PDF 파일을 드래그하거나 클릭하세요</p>
                    <p className="text-sm text-gray-500">AI로 PDF 텍스트를 자연어로 수정할 수 있습니다</p>
                  </div>
                  {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">{error}</div>}
                </div>
              )}

              {/* Loading */}
              {editLoading && (
                <div className="flex flex-col items-center justify-center py-24">
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
                  <p className="text-gray-400">{editStatusText}</p>
                </div>
              )}

              {/* Editor */}
              {editPages.length > 0 && !editLoading && (
                <div className="flex flex-col gap-4">
                  {/* Page nav + thumbnails + mode toggle */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl px-4 py-2">
                      <button onClick={() => navigateToPage(Math.max(0, editCurrentPage - 1))} disabled={editCurrentPage === 0} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-sm text-gray-300 font-medium min-w-[80px] text-center">{editCurrentPage + 1} / {editPages.length}</span>
                      <button onClick={() => navigateToPage(Math.min(editPages.length - 1, editCurrentPage + 1))} disabled={editCurrentPage === editPages.length - 1} className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                    {/* Inline thumbnails */}
                    <div className="flex gap-1.5 overflow-x-auto flex-1">
                      {editPages.map((page, i) => (
                        <button
                          key={page.pageNumber}
                          onClick={() => navigateToPage(i)}
                          className={`relative flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                            i === editCurrentPage ? "border-indigo-500 ring-1 ring-indigo-500/30" : "border-gray-800 hover:border-gray-600"
                          }`}
                        >
                          <img src={`data:image/png;base64,${page.editedImageBase64 || page.originalImageBase64}`} alt={`Page ${page.pageNumber}`} className="w-full h-full object-cover" />
                          {page.editedImageBase64 && <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-indigo-500 rounded-full" />}
                          <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/60 py-0.5">{page.pageNumber}</span>
                        </button>
                      ))}
                    </div>
                    {/* Mode toggle: AI vs Direct */}
                    <div className="flex items-center bg-gray-900/80 border border-gray-800 rounded-xl p-1 flex-shrink-0">
                      <button
                        onClick={() => handleSubModeChange("ai")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          editSubMode === "ai" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        ✨ AI 수정
                      </button>
                      <button
                        onClick={() => handleSubModeChange("direct")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          editSubMode === "direct" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        ✏️ 직접 수정
                      </button>
                    </div>
                  </div>

                  {/* AI Mode: PDF Image with inline click-to-edit and drag-to-delete */}
                  {editSubMode === "ai" && editDisplayImage && (
                    <div className="flex items-center justify-center">
                      <div
                        ref={imageWrapRef}
                        className={`relative ${eyedropperMode ? "cursor-crosshair" : "cursor-text"} select-none`}
                        style={editPageData ? { maxHeight: "calc(100vh - 420px)", aspectRatio: `${editPageData.width} / ${editPageData.height}` } : undefined}
                        onMouseDown={handleImageMouseDown}
                        onMouseMove={handleImageMouseMove}
                        onMouseUp={handleImageMouseUp}
                        onMouseLeave={() => { if (dragStart && !isDragRef.current) { setDragStart(null); setDragEnd(null) } }}
                      >
                        <img
                          src={`data:image/png;base64,${editDisplayImage}`}
                          alt={`Page ${editCurrentPage + 1}`}
                          className="w-full h-full rounded-lg shadow-2xl border border-gray-800 select-none"
                          draggable={false}
                        />
                        {/* Live drag rectangle */}
                        {liveDragBox && (
                          <div
                            className="absolute border-2 border-red-400 bg-red-400/15 pointer-events-none z-10"
                            style={{
                              left: `${liveDragBox.left}%`, top: `${liveDragBox.top}%`,
                              width: `${liveDragBox.width}%`, height: `${liveDragBox.height}%`,
                            }}
                          />
                        )}
                        {/* Selection box with delete button */}
                        {selectionBox && (
                          <>
                            <div
                              className="absolute border-2 border-red-500 bg-red-500/10 z-10"
                              style={{
                                left: `${selectionBox.left}%`, top: `${selectionBox.top}%`,
                                width: `${selectionBox.width}%`, height: `${selectionBox.height}%`,
                              }}
                            />
                            <div
                              className="absolute z-20 flex gap-1"
                              style={{
                                left: `${selectionBox.left + selectionBox.width / 2}%`,
                                top: `${selectionBox.top + selectionBox.height}%`,
                                transform: "translate(-50%, 4px)",
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={deleteSelection}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-lg transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                삭제
                              </button>
                              <button
                                onClick={() => setSelectionBox(null)}
                                className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg shadow-lg transition-all"
                              >
                                취소
                              </button>
                            </div>
                          </>
                        )}
                        {/* Inline edit input at click position */}
                        {editClickPos && (
                          <div
                            className="absolute z-20"
                            style={{ left: `${editClickPos.left}%`, top: `${editClickPos.top}%` }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1 -translate-y-1/2 shadow-2xl">
                              <input
                                ref={inlineInputRef}
                                value={editingNewText}
                                onChange={(e) => setEditingNewText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") confirmTextEdit()
                                  if (e.key === "Escape") setEditClickPos(null)
                                }}
                                onBlur={() => { if (!editProcessing && !isConfirmingRef.current) setEditClickPos(null) }}
                                placeholder="수정할 텍스트 입력"
                                className="px-2 py-1.5 bg-white text-black text-sm border-2 border-indigo-500 rounded-lg outline-none min-w-[140px] max-w-[300px] shadow-lg"
                              />
                              <button
                                onMouseDown={(e) => { e.preventDefault(); confirmTextEdit() }}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg text-sm font-bold"
                              >
                                ✓
                              </button>
                              <button
                                onMouseDown={(e) => { e.preventDefault(); setEditClickPos(null) }}
                                className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow-lg text-sm"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Loading overlay */}
                        {editProcessing && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-30 pointer-events-none">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                              <span className="text-sm text-white font-medium">AI 수정 중...</span>
                            </div>
                          </div>
                        )}
                        {editPageData?.editedImageBase64 && !editProcessing && (
                          <div className="absolute top-3 right-3 flex gap-2" onMouseDown={(e) => e.stopPropagation()}>
                            <span className="px-2 py-1 bg-indigo-600/80 backdrop-blur-sm text-xs font-medium rounded-md text-white">수정됨</span>
                            <button onClick={resetEditCurrentPage} className="p-1.5 bg-gray-800/80 backdrop-blur-sm hover:bg-gray-700 rounded-md transition-colors cursor-pointer" title="원본으로 복원">
                              <RotateCcw className="w-3.5 h-3.5 text-gray-300" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Direct Mode: Canvas for drawing/text/shapes */}
                  {editSubMode === "direct" && (
                    <div className="flex items-center justify-center">
                      <div className="relative" style={editPageData ? { maxHeight: "calc(100vh - 420px)", aspectRatio: `${editPageData.width} / ${editPageData.height}` } : undefined}>
                        <canvas
                          ref={drawCanvasRef}
                          className="w-full h-full rounded-lg shadow-2xl border border-gray-800 select-none"
                          style={{ cursor: directTool === "text" ? "text" : directTool === "eraser" ? "cell" : "crosshair" }}
                          onMouseDown={handleDirectMouseDown}
                          onMouseMove={handleDirectMouseMove}
                          onMouseUp={handleDirectMouseUp}
                          onMouseLeave={() => { isDirectDrawingRef.current = false; lastDrawPointRef.current = null }}
                        />
                        {/* Text input overlay */}
                        {directTextInput && (
                          <div
                            className="absolute z-20"
                            style={{
                              left: `${(directTextInput.x / (drawCanvasRef.current?.width || 1)) * 100}%`,
                              top: `${(directTextInput.y / (drawCanvasRef.current?.height || 1)) * 100}%`,
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1 shadow-2xl">
                              <input
                                value={directTextValue}
                                onChange={(e) => setDirectTextValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") addDirectText()
                                  if (e.key === "Escape") setDirectTextInput(null)
                                }}
                                autoFocus
                                placeholder="텍스트 입력"
                                className="px-2 py-1.5 bg-white text-black text-sm border-2 border-emerald-500 rounded-lg outline-none min-w-[140px] max-w-[300px] shadow-lg"
                              />
                              <button
                                onMouseDown={(e) => { e.preventDefault(); addDirectText() }}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg text-sm font-bold"
                              >
                                ✓
                              </button>
                              <button
                                onMouseDown={(e) => { e.preventDefault(); setDirectTextInput(null) }}
                                className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow-lg text-sm"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                        {editPageData?.editedImageBase64 && (
                          <div className="absolute top-3 right-3 flex gap-2">
                            <span className="px-2 py-1 bg-emerald-600/80 backdrop-blur-sm text-xs font-medium rounded-md text-white">수정됨</span>
                            <button onClick={resetEditCurrentPage} className="p-1.5 bg-gray-800/80 backdrop-blur-sm hover:bg-gray-700 rounded-md transition-colors cursor-pointer" title="원본으로 복원">
                              <RotateCcw className="w-3.5 h-3.5 text-gray-300" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Mode: Controls */}
                  {editSubMode === "ai" && (
                    <>
                      {/* Background color picker */}
                      <div className="border border-gray-800/50 rounded-xl bg-gray-950/50 p-4">
                        <div className="flex items-center gap-3">
                          <Palette className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-300 flex-shrink-0">배경색</span>
                          <div className="w-8 h-8 rounded-lg border-2 border-gray-600 flex-shrink-0" style={{ backgroundColor: bgColor }} title={bgColor} />
                          <div className="flex gap-1 flex-wrap flex-1">
                            {PRESET_BG_COLORS.map((c) => (
                              <button
                                key={c}
                                onClick={() => setBgColor(c)}
                                className={`w-6 h-6 rounded-md border-2 transition-all ${bgColor === c ? "border-indigo-400 scale-110" : "border-gray-700 hover:border-gray-500"}`}
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            ))}
                          </div>
                          <label className="w-8 h-8 rounded-lg border border-gray-700 hover:border-gray-500 cursor-pointer overflow-hidden transition-colors flex-shrink-0" title="커스텀 색상">
                            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value.toUpperCase())} className="w-12 h-12 -mt-1 -ml-1 cursor-pointer" />
                          </label>
                          <button
                            onClick={startEyedropper}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all flex-shrink-0 ${eyedropperMode ? "border-indigo-500 bg-indigo-500/20 text-indigo-300" : "border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white"}`}
                            title="스포이드 (이미지에서 색상 추출)"
                          >
                            <Pipette className="w-4 h-4" />
                          </button>
                          <button onClick={applyBgColor} disabled={editProcessing} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0">현재 페이지</button>
                          <button onClick={applyBgColorAll} disabled={editProcessing} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0">전체 적용</button>
                        </div>
                        {eyedropperMode && <p className="text-xs text-indigo-300 mt-2 ml-7">PDF 이미지를 클릭하여 색상을 추출하세요</p>}
                      </div>

                      {/* Logo overlay panel */}
                      <div className="border border-gray-800/50 rounded-xl bg-gray-950/50 p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <ImagePlus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-300 flex-shrink-0">로고</span>
                          {logoImage ? (
                            <>
                              <img src={`data:image/png;base64,${logoImage}`} alt="logo" className="w-8 h-8 rounded-md border border-gray-600 object-contain bg-white flex-shrink-0" />
                              <span className="text-xs text-gray-400 truncate max-w-[120px]">{logoFileName}</span>
                              <button onClick={() => { setLogoImage(null); setLogoFileName("") }} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <button onClick={() => logoInputRef.current?.click()} className="px-3 py-1.5 text-xs text-gray-400 border border-dashed border-gray-700 hover:border-gray-500 hover:text-white rounded-lg transition-colors">
                              이미지 업로드
                            </button>
                          )}
                          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }} />
                        </div>
                        {logoImage && (
                          <>
                            <div className="flex items-center gap-3 ml-7">
                              <span className="text-xs text-gray-500 flex-shrink-0 w-8">위치</span>
                              {([
                                { pos: "top-left" as const, label: "↖ 좌상" },
                                { pos: "top-right" as const, label: "↗ 우상" },
                                { pos: "bottom-left" as const, label: "↙ 좌하" },
                                { pos: "bottom-right" as const, label: "↘ 우하" },
                              ]).map(({ pos, label }) => (
                                <button
                                  key={pos}
                                  onClick={() => setLogoPosition(pos)}
                                  className={`px-2 py-1 text-xs rounded-md transition-all ${logoPosition === pos ? "bg-indigo-600 text-white" : "text-gray-400 border border-gray-800 hover:border-gray-600 hover:text-white"}`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-4 ml-7">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">크기</span>
                                <input type="range" min="3" max="30" value={logoScale} onChange={(e) => setLogoScale(Number(e.target.value))} className="w-16 accent-indigo-500" />
                                <span className="text-xs text-gray-400 w-8">{logoScale}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">여백</span>
                                <input type="range" min="0" max="10" value={logoMargin} onChange={(e) => setLogoMargin(Number(e.target.value))} className="w-16 accent-indigo-500" />
                                <span className="text-xs text-gray-400 w-8">{logoMargin}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">투명도</span>
                                <input type="range" min="10" max="100" value={logoOpacity} onChange={(e) => setLogoOpacity(Number(e.target.value))} className="w-16 accent-indigo-500" />
                                <span className="text-xs text-gray-400 w-8">{logoOpacity}%</span>
                              </div>
                              <div className="flex-1" />
                              <button onClick={applyLogoCurrent} disabled={editProcessing} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0">현재 페이지</button>
                              <button onClick={applyLogoAll} disabled={editProcessing} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0">전체 적용</button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Prompt panel */}
                      <div className="border border-gray-800/50 rounded-xl bg-gray-950/50 overflow-hidden">
                        <div className="p-4 space-y-3">
                          <div className="flex flex-wrap gap-1.5">
                            {['제목을 "새로운 제목"으로 변경', "본문 글꼴을 더 크게", "오타 수정"].map((ex) => (
                              <button key={ex} onClick={() => setEditPrompt(ex)} className="px-2.5 py-1 text-xs text-gray-400 border border-gray-800 hover:border-gray-600 hover:text-white rounded-lg transition-colors">{ex}</button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <textarea
                              ref={promptInputRef}
                              value={editPrompt}
                              onChange={(e) => setEditPrompt(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEditPage() } }}
                              placeholder="예: 제목을 '2025 보고서'로 변경"
                              rows={2}
                              className="flex-1 p-3 bg-black/50 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors"
                            />
                            <button
                              onClick={() => submitEditPage()}
                              disabled={!editPrompt.trim() || editProcessing}
                              className="flex items-center justify-center gap-2 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-semibold rounded-xl transition-all duration-300 flex-shrink-0"
                            >
                              {editProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                          </div>
                          {editProcessing && editStatusText && <p className="text-xs text-indigo-300 text-center">{editStatusText}</p>}
                          {error && <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">{error}</div>}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Direct Mode: Toolbar */}
                  {editSubMode === "direct" && (
                    <div className="border border-gray-800/50 rounded-xl bg-gray-950/50 p-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Tool buttons */}
                        {([
                          { tool: "draw" as const, icon: Pencil, label: "그리기" },
                          { tool: "eraser" as const, icon: Eraser, label: "지우개" },
                          { tool: "text" as const, icon: Type, label: "텍스트" },
                          { tool: "rect" as const, icon: Square, label: "사각형" },
                        ] as const).map(({ tool, icon: Icon, label }) => (
                          <button
                            key={tool}
                            onClick={() => setDirectTool(tool)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                              directTool === tool
                                ? "bg-emerald-600 text-white"
                                : "text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600"
                            }`}
                            title={label}
                          >
                            <Icon className="w-4 h-4" />
                            {label}
                          </button>
                        ))}

                        <div className="w-px h-6 bg-gray-800" />

                        {/* Color picker */}
                        <label className="w-8 h-8 rounded-lg border border-gray-700 hover:border-gray-500 cursor-pointer overflow-hidden flex-shrink-0" title="색상">
                          <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-12 h-12 -mt-1 -ml-1 cursor-pointer" />
                        </label>

                        {/* Size slider */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">굵기</span>
                          <input type="range" min="1" max="20" value={drawSize} onChange={(e) => setDrawSize(Number(e.target.value))} className="w-20 accent-emerald-500" />
                          <span className="text-xs text-gray-400 w-6">{drawSize}</span>
                        </div>

                        {/* Text size (only when text tool) */}
                        {directTool === "text" && (
                          <>
                            <div className="w-px h-6 bg-gray-800" />
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">글자</span>
                              <input type="range" min="12" max="72" value={directTextSize} onChange={(e) => setDirectTextSize(Number(e.target.value))} className="w-20 accent-emerald-500" />
                              <span className="text-xs text-gray-400 w-6">{directTextSize}</span>
                            </div>
                          </>
                        )}

                        <div className="flex-1" />

                        {/* Save button */}
                        <button
                          onClick={() => saveDirectCanvas()}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all"
                        >
                          <Save className="w-3.5 h-3.5" />
                          적용
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error display (both modes) */}
                  {editSubMode === "direct" && error && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">{error}</div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
