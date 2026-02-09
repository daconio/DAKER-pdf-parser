"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ModeToggle } from "@/components/mode-toggle"
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
  Copy,
  MoreHorizontal,
  Lock,
  Unlock,
  Link2,
  Clipboard,
  ClipboardCopy,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeft,
  Circle,
  Mail,
  Undo2,
  Redo2,
  MousePointer2,
  Scissors,
  Hash,
} from "lucide-react"
import JSZip from "jszip"
import * as pdfjsLib from "pdfjs-dist"
import { PDFDocument } from "pdf-lib"
import {
  ConversionMode,
  ProcessStatus,
  type GeneratedFile,
  AI_EDIT,
  type AppMode,
  MODE_SLUG_MAP,
  MODE_TO_SLUG,
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
import { useCollaboration } from "@/hooks/useCollaboration"
import { useEmail } from "@/hooks/useEmail"
import { useImageStorage } from "@/hooks/useImageStorage"
import { CollaborationPanel } from "@/components/ui/CollaborationPanel"
import { EmailPanel } from "@/components/ui/EmailPanel"
import { ImagePanel } from "@/components/ui/ImagePanel"
import type { User as SupabaseUser } from "@supabase/supabase-js"

const pdfjs: any = (pdfjsLib as any).default || pdfjsLib
const PDFJS_VERSION = "3.11.174"

if (typeof window !== "undefined" && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`
}

type EditSubMode = "ai" | "direct"
type DirectTool = "text" | "draw" | "rect" | "eraser" | "select"

const MODES: { id: AppMode; label: string; emoji: string; accept: string; desc: string }[] = [
  { id: AI_EDIT, label: "AI PDF 수정", emoji: "✨", accept: ".pdf", desc: "AI로 PDF 텍스트를 자연어로 수정" },
  { id: ConversionMode.PDF_TO_PNG, label: "PDF → 이미지", emoji: "🖼️", accept: ".pdf", desc: "PDF를 고품질 PNG 이미지로 변환" },
  { id: ConversionMode.PNG_TO_PDF, label: "이미지 → PDF", emoji: "📄", accept: "image/*", desc: "여러 이미지를 하나의 PDF로 결합" },
  { id: ConversionMode.MERGE_PDF, label: "PDF 합치기", emoji: "📑", accept: ".pdf", desc: "여러 PDF 파일을 하나로 병합" },
  { id: ConversionMode.FLATTEN_PDF, label: "PDF 병합", emoji: "📋", accept: ".pdf", desc: "PDF를 이미지로 변환 후 다시 PDF로" },
  { id: ConversionMode.SPLIT_PDF, label: "PDF 분할", emoji: "✂️", accept: ".pdf", desc: "PDF 페이지를 개별 파일로 분리" },
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

// Direct mode text fonts
const DIRECT_FONTS = [
  { value: "Pretendard Variable", label: "프리텐다드" },
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier" },
  { value: "Verdana", label: "Verdana" },
]

interface EditPageData {
  pageNumber: number
  originalImageBase64: string
  editedImageBase64: string | null
  width: number
  height: number
  textItems: TextItemData[]
}

export default function ConvertPage() {
  const params = useParams()
  const router = useRouter()
  const [mode, setMode] = useState<AppMode>(() => MODE_SLUG_MAP[params.mode as string] ?? ConversionMode.PDF_TO_PNG)

  // Email panel is controlled by URL query parameter
  const [showEmailPanel, setShowEmailPanel] = useState(false)

  // Sync email panel state with URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    setShowEmailPanel(urlParams.get("panel") === "email")
  }, [])

  // Listen for URL changes (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      // Sync email panel state
      const urlParams = new URLSearchParams(window.location.search)
      setShowEmailPanel(urlParams.get("panel") === "email")

      // Sync mode state from URL path
      const pathParts = window.location.pathname.split("/")
      const modeSlug = pathParts[pathParts.length - 1]
      const newMode = MODE_SLUG_MAP[modeSlug]
      if (newMode && newMode !== mode) {
        reset()
        resetEdit()
        setMode(newMode)
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [mode])
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
  const [progressInfo, setProgressInfo] = useState<{ label: string; percent: number } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [editFileName, setEditFileName] = useState("")
  const [editOriginalBytes, setEditOriginalBytes] = useState<Uint8Array | null>(null)
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
  const [directTextFontFamily, setDirectTextFontFamily] = useState("Pretendard Variable")
  const [directTextCursorVisible, setDirectTextCursorVisible] = useState(true)
  const directTextSnapshotRef = useRef<ImageData | null>(null) // Snapshot before text input
  const hiddenTextInputRef = useRef<HTMLInputElement>(null) // Hidden input for IME support
  const [isComposing, setIsComposing] = useState(false) // Track IME composition state
  // Text objects storage for re-editing
  type TextObject = { x: number; y: number; text: string; size: number; font: string; color: string }
  const textObjectsRef = useRef<Map<number, TextObject[]>>(new Map()) // per-page text objects
  const baseCanvasDataRef = useRef<Map<number, string>>(new Map()) // per-page base canvas (without texts)
  const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null) // index of text being edited
  // Text dragging state
  const [draggingTextIndex, setDraggingTextIndex] = useState<number | null>(null)
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const dragOriginalTextPosRef = useRef<{ x: number; y: number } | null>(null)
  const isDragMovedRef = useRef(false) // Track if mouse moved during drag
  const [directRectStart, setDirectRectStart] = useState<{ x: number; y: number } | null>(null)
  const canvasSnapshotRef = useRef<ImageData | null>(null)
  const [canvasInitTrigger, setCanvasInitTrigger] = useState(0)
  // Selection tool state
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const selectionClipboardRef = useRef<ImageData | null>(null)
  const [undoCount, setUndoCount] = useState(0) // Trigger re-render on undo history change
  const isConfirmingRef = useRef(false)

  // Undo/Redo history: per-page stack of previous/future image states
  const undoHistoryRef = useRef<Map<number, string[]>>(new Map())
  const redoHistoryRef = useRef<Map<number, string[]>>(new Map())

  // Logo overlay state
  const [logoImage, setLogoImage] = useState<string | null>(null)
  const [logoFileName, setLogoFileName] = useState("")
  const [logoPosition, setLogoPosition] = useState<{ x: number; y: number }>({ x: 87, y: 87 })
  const [logoScale, setLogoScale] = useState(10)
  const [logoMargin, setLogoMargin] = useState(3)
  const [logoOpacity, setLogoOpacity] = useState(100)
  const [logoNaturalRatio, setLogoNaturalRatio] = useState(1) // height / width
  const logoInputRef = useRef<HTMLInputElement>(null)
  const logoDragRef = useRef<{ startMouseX: number; startMouseY: number; startPosX: number; startPosY: number } | null>(null)

  // Page numbering state
  type PageNumberPosition = "bottom-center" | "bottom-left" | "bottom-right" | "top-center" | "top-left" | "top-right"
  const [pageNumberEnabled, setPageNumberEnabled] = useState(false)
  const [pageNumberPosition, setPageNumberPosition] = useState<PageNumberPosition>("bottom-center")
  const [pageNumberStartFrom, setPageNumberStartFrom] = useState(2) // 1 = first page, 2 = second page (skip cover)
  const [pageNumberFontSize, setPageNumberFontSize] = useState(14)
  const [showPageNumberPanel, setShowPageNumberPanel] = useState(false)
  // Store base images before page numbers are applied (to allow re-applying without stacking)
  const pageNumberBaseImagesRef = useRef<Map<number, string>>(new Map())

  // Page drag-and-drop reorder state
  const [pageDragIndex, setPageDragIndex] = useState<number | null>(null)
  const [pageDragOverIndex, setPageDragOverIndex] = useState<number | null>(null)

  // Additional PDF upload ref
  const addPdfInputRef = useRef<HTMLInputElement>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageIndex: number } | null>(null)

  // Clipboard state for page copy/paste
  const [copiedPage, setCopiedPage] = useState<{ data: EditPageData; isStyleOnly: boolean } | null>(null)

  // Locked pages state
  const [lockedPages, setLockedPages] = useState<Set<number>>(new Set())

  // Fullscreen & Sidebar state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Temp save indicator
  const [tempSaveStatus, setTempSaveStatus] = useState<"idle" | "saving" | "saved">("idle")

  // Fullscreen toolbar visibility (auto-hide)
  const [showFullscreenToolbar, setShowFullscreenToolbar] = useState(true)
  const fullscreenToolbarTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Save feedback animation
  const [saveAnimation, setSaveAnimation] = useState<"idle" | "saving" | "success" | "error">("idle")

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

  // Access token helper (defined early for hooks)
  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await getSupabase().auth.getSession()
    return session?.access_token || null
  }, [])

  // Email hook and state
  const openEmailPanel = useCallback(() => {
    setShowEmailPanel(true)
    router.push(`/convert/ai-edit?panel=email`)
  }, [router])
  const closeEmailPanel = useCallback(() => {
    setShowEmailPanel(false)
    router.push(`/convert/ai-edit`)
  }, [router])
  const email = useEmail({
    user: authUser,
    getAccessToken,
  })

  // Image storage hook and state
  const [showImagePanel, setShowImagePanel] = useState(false)
  const imageStorage = useImageStorage({
    user: authUser,
    getAccessToken,
  })

  // Collaboration hook
  const collaboration = useCollaboration({
    user: authUser,
    onRemoteEdit: (pageIndex, editData) => {
      // Handle remote edits from other collaborators
      try {
        const data = JSON.parse(editData)
        if (data.editedImageBase64) {
          setEditPages((prev) => prev.map((p, i) =>
            i === pageIndex ? { ...p, editedImageBase64: data.editedImageBase64 } : p
          ))
        }
      } catch {
        // Ignore invalid edit data
      }
    },
    onSendInviteEmail: email.sendInviteEmail,
  })

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
    setTempSaveStatus("saving")
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      // Save without textItems to reduce storage size
      const stripped = editPages.map(({ textItems: _t, ...rest }) => rest)
      await saveEditSession({
        editPages: stripped,
        editFileName: editFileName,
        editCurrentPage: editCurrentPage,
        timestamp: Date.now(),
      })
      setTempSaveStatus("saved")
      // Reset to idle after 2 seconds
      setTimeout(() => setTempSaveStatus("idle"), 2000)
    }, 1000) // Reduced from 2000ms to 1000ms for faster auto-save
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [editPages, editCurrentPage, editFileName])

  // Immediate save function for critical operations (AI edit, etc.)
  const saveImmediately = useCallback(async (pages: EditPageData[]) => {
    if (pages.length === 0) return
    setTempSaveStatus("saving")
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    const stripped = pages.map(({ textItems: _t, ...rest }) => rest)
    await saveEditSession({
      editPages: stripped,
      editFileName: editFileName,
      editCurrentPage: editCurrentPage,
      timestamp: Date.now(),
    })
    setTempSaveStatus("saved")
    setTimeout(() => setTempSaveStatus("idle"), 2000)
  }, [editFileName, editCurrentPage])

  // Paste from clipboard (images)
  const handlePasteFromClipboard = useCallback(async (e: ClipboardEvent) => {
    if (!isAiEdit || editPages.length === 0 || editLoading || editProcessing) return
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) continue

        const reader = new FileReader()
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1]
          if (!base64) return

          // Create a new page with the pasted image
          const img = new window.Image()
          img.onload = () => {
            const newPage: EditPageData = {
              pageNumber: 0,
              originalImageBase64: base64,
              editedImageBase64: null,
              width: img.naturalWidth,
              height: img.naturalHeight,
              textItems: [],
            }
            const newPages = [...editPages]
            newPages.splice(editCurrentPage + 1, 0, newPage)
            setEditPages(reindexPages(newPages))
            setEditCurrentPage(editCurrentPage + 1)
            invalidateOriginalBytes()
          }
          img.src = `data:image/png;base64,${base64}`
        }
        reader.readAsDataURL(blob)
        return
      }
    }
  }, [isAiEdit, editPages, editCurrentPage, editLoading, editProcessing])

  // Fullscreen toolbar auto-hide
  useEffect(() => {
    if (!isFullscreen) return

    const handleMouseMove = () => {
      setShowFullscreenToolbar(true)
      if (fullscreenToolbarTimeoutRef.current) {
        clearTimeout(fullscreenToolbarTimeoutRef.current)
      }
      fullscreenToolbarTimeoutRef.current = setTimeout(() => {
        setShowFullscreenToolbar(false)
      }, 3000) // Hide after 3 seconds of no movement
    }

    window.addEventListener("mousemove", handleMouseMove)
    // Show toolbar initially
    handleMouseMove()

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      if (fullscreenToolbarTimeoutRef.current) {
        clearTimeout(fullscreenToolbarTimeoutRef.current)
      }
    }
  }, [isFullscreen])

  // Keyboard shortcuts
  useEffect(() => {
    const saveCanvas = () => {
      if (editSubMode === "direct" && drawCanvasRef.current) {
        const b64 = drawCanvasRef.current.toDataURL("image/png").split(",")[1]
        setEditPages((prev) => prev.map((p, i) => i === editCurrentPage ? { ...p, editedImageBase64: b64 } : p))
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      // Exit fullscreen on Escape (highest priority)
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
        e.preventDefault()
        return
      }

      // Toggle fullscreen: Cmd+Enter / Ctrl+Enter
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (isAiEdit && editPages.length > 0) {
          setIsFullscreen((prev) => !prev)
          e.preventDefault()
          return
        }
      }

      // Save PDF: Cmd+S / Ctrl+S (works even in INPUT/TEXTAREA)
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (isAiEdit && editPages.length > 0 && !editLoading && editPages.some((p) => p.editedImageBase64)) {
          downloadEditedPdf()
        }
        return
      }

      // Undo: Cmd+Z (Mac) / Ctrl+Z (Windows) — works even when INPUT/TEXTAREA is focused
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (!isAiEdit || editPages.length === 0 || editLoading || editProcessing) return
        e.preventDefault()
        if (editSubMode === "direct" && drawCanvasRef.current) {
          const b64 = drawCanvasRef.current.toDataURL("image/png").split(",")[1]
          setEditPages((prev) => prev.map((p, i) => i === editCurrentPage ? { ...p, editedImageBase64: b64 } : p))
        }
        performUndo()
        return
      }

      // Redo: Cmd+Shift+Z (Mac) / Ctrl+Shift+Z or Ctrl+Y (Windows)
      if ((e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) || (e.key === "y" && e.ctrlKey)) {
        if (!isAiEdit || editPages.length === 0 || editLoading || editProcessing) return
        e.preventDefault()
        if (editSubMode === "direct" && drawCanvasRef.current) {
          const b64 = drawCanvasRef.current.toDataURL("image/png").split(",")[1]
          setEditPages((prev) => prev.map((p, i) => i === editCurrentPage ? { ...p, editedImageBase64: b64 } : p))
        }
        performRedo()
        return
      }

      // Copy: Cmd+C / Ctrl+C (copy current page)
      if (e.key === "c" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (!isAiEdit || editPages.length === 0 || editLoading) return
        const tag = (e.target as HTMLElement).tagName
        if (tag === "INPUT" || tag === "TEXTAREA") return
        e.preventDefault()
        // Alt+Cmd+C = style copy
        copyPage(editCurrentPage, e.altKey)
        return
      }

      // Duplicate: Cmd+D / Ctrl+D
      if (e.key === "d" && (e.metaKey || e.ctrlKey)) {
        if (!isAiEdit || editPages.length === 0 || editLoading || editProcessing) return
        const tag = (e.target as HTMLElement).tagName
        if (tag === "INPUT" || tag === "TEXTAREA") return
        e.preventDefault()
        duplicatePage(editCurrentPage)
        return
      }

      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (!isAiEdit || editPages.length === 0 || editLoading) return

      // Close context menu or page number panel on Escape
      if (e.key === "Escape") {
        if (contextMenu) {
          closeContextMenu()
          e.preventDefault()
          return
        }
        if (showPageNumberPanel) {
          setShowPageNumberPanel(false)
          e.preventDefault()
          return
        }
        // Cancel ongoing operation (download, etc.)
        if (progressInfo && abortControllerRef.current) {
          abortControllerRef.current.abort()
          abortControllerRef.current = null
          setProgressInfo(null)
          setEditStatusText("취소됨")
          setSaveAnimation("idle")
          setTimeout(() => setEditStatusText(""), 1500)
          e.preventDefault()
          return
        }
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
          // Delete current page (if not locked and more than 1 page)
          else if (!selectionBox && !editProcessing && editPages.length > 1 && !lockedPages.has(editCurrentPage)) {
            deletePage(editCurrentPage)
            e.preventDefault()
          }
          break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("paste", handlePasteFromClipboard)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("paste", handlePasteFromClipboard)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAiEdit, editPages.length, editLoading, eyedropperMode, editClickPos, selectionBox, editProcessing, editSubMode, directTextInput, editCurrentPage, handlePasteFromClipboard, isFullscreen])

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
    setProgressInfo(null)
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
    redoHistoryRef.current.clear()
    textObjectsRef.current.clear()
    baseCanvasDataRef.current.clear()
    setEditingTextIndex(null)
    setDraggingTextIndex(null)
    setLogoImage(null)
    setLogoFileName("")
    setLogoPosition({ x: 87, y: 87 })
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
    setEditPages(recoveryData.editPages)
    setEditCurrentPage(recoveryData.editCurrentPage)
    setEditFileName(recoveryData.editFileName)
    setShowRecoveryDialog(false)
    setRecoveryData(null)
    if (mode !== AI_EDIT) {
      setMode(AI_EDIT)
      window.history.pushState(null, "", "/convert/ai-edit")
    }
  }

  const dismissRecovery = () => {
    setShowRecoveryDialog(false)
    setRecoveryData(null)
    deleteEditSession()
  }

  // --- Cloud storage functions ---
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
    if (!authUser) { setError("로그인이 필요합니다."); return }
    if (editPages.length === 0 || !editFileName) { setError("PDF 파일을 먼저 업로드해주세요."); return }
    setSaveAnimation("saving")
    setCloudUploading(true)
    setError("")
    setProgressInfo({ label: "클라우드 업로드 준비 중", percent: 0 })
    try {
      let pdfBytes: Uint8Array
      if (editOriginalBytes && editPages.some((p) => p.editedImageBase64)) {
        const pdfDoc = await PDFDocument.load(new Uint8Array(editOriginalBytes))
        const editedPages = editPages.filter((p) => p.editedImageBase64)
        let editIdx = 0
        for (const page of editPages) {
          if (page.editedImageBase64) {
            editIdx++
            setProgressInfo({ label: "PDF 생성 중", percent: Math.round((editIdx / editedPages.length) * 50) })
            const imageBytes = Uint8Array.from(atob(page.editedImageBase64), (c) => c.charCodeAt(0))
            const mimeType = page.editedImageBase64.startsWith("/9j") ? "jpeg" : "png"
            const image = mimeType === "jpeg" ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes)
            const pdfPage = pdfDoc.getPage(page.pageNumber - 1)
            const { width, height } = pdfPage.getSize()
            pdfPage.drawImage(image, { x: 0, y: 0, width, height })
          }
        }
        pdfBytes = await pdfDoc.save()
      } else if (editOriginalBytes && !editPages.some((p) => p.editedImageBase64)) {
        setProgressInfo({ label: "PDF 준비 중", percent: 50 })
        pdfBytes = new Uint8Array(editOriginalBytes)
      } else {
        // Fallback: create PDF from page images (e.g. after session recovery)
        const pdfDoc = await PDFDocument.create()
        for (let fi = 0; fi < editPages.length; fi++) {
          const page = editPages[fi]
          setProgressInfo({ label: "PDF 생성 중", percent: Math.round(((fi + 1) / editPages.length) * 50) })
          const imgSrc = page.editedImageBase64 || page.originalImageBase64
          const isJpeg = imgSrc.startsWith("/9j")
          const res = await fetch(`data:image/${isJpeg ? "jpeg" : "png"};base64,${imgSrc}`)
          const imageBytes = new Uint8Array(await res.arrayBuffer())
          const image = isJpeg ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes)
          const pageW = page.width / 2
          const pageH = page.height / 2
          const pdfPage = pdfDoc.addPage([pageW, pageH])
          pdfPage.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH })
        }
        pdfBytes = await pdfDoc.save()
      }

      setProgressInfo({ label: "업로드 중", percent: 60 })
      const token = await getAccessToken()
      if (!token) { setError("로그인이 필요합니다."); return }

      const formData = new FormData()
      formData.append("file", new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }))
      formData.append("fileName", editFileName)

      setProgressInfo({ label: "업로드 중", percent: 80 })
      const res = await fetch("/api/pdf-storage", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "업로드 실패"); return }
      setProgressInfo({ label: "완료", percent: 100 })
      await fetchCloudFiles()
      setSaveAnimation("success")
      setTimeout(() => setSaveAnimation("idle"), 1500)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`클라우드 업로드 실패: ${msg}`)
      setSaveAnimation("error")
      setTimeout(() => setSaveAnimation("idle"), 2000)
    } finally { setCloudUploading(false); setProgressInfo(null) }
  }

  const downloadFromCloud = async (path: string, displayName?: string) => {
    if (!authUser) return
    setEditLoading(true)
    setEditStatusText("클라우드에서 PDF 다운로드 중...")
    setProgressInfo({ label: "클라우드 다운로드 중", percent: 30 })
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
      const fileName = displayName || path.split("/").pop()?.replace(/^\d+_/, "") || "cloud.pdf"
      resetEdit()
      setEditOriginalBytes(new Uint8Array(arrayBuffer.slice(0)))
      setEditFileName(fileName)
      await renderEditPdfPages(arrayBuffer)
      setShowCloudPanel(false)
      if (mode !== AI_EDIT) {
        setMode(AI_EDIT)
        window.history.pushState(null, "", "/convert/ai-edit")
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류"
      setError(`클라우드 파일 로드 실패: ${msg}`)
    } finally { setEditLoading(false); setEditStatusText(""); setProgressInfo(null) }
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
    // Clear redo history on new edit action
    redoHistoryRef.current.set(pageIndex, [])
    setUndoCount((c) => c + 1) // Trigger re-render to update undo/redo button state
  }

  // --- Page CRUD helpers ---
  const reindexPages = (pages: EditPageData[]): EditPageData[] =>
    pages.map((p, i) => ({ ...p, pageNumber: i + 1 }))

  const invalidateOriginalBytes = () => {
    setEditOriginalBytes(null)
  }

  const rebuildUndoHistory = (oldToNewIndexMap: Map<number, number>) => {
    // Rebuild undo history
    const oldUndoHistory = undoHistoryRef.current
    const newUndoHistory = new Map<number, string[]>()
    for (const [oldIdx, newIdx] of oldToNewIndexMap.entries()) {
      const hist = oldUndoHistory.get(oldIdx)
      if (hist && hist.length > 0) {
        newUndoHistory.set(newIdx, [...hist])
      }
    }
    undoHistoryRef.current = newUndoHistory

    // Rebuild redo history
    const oldRedoHistory = redoHistoryRef.current
    const newRedoHistory = new Map<number, string[]>()
    for (const [oldIdx, newIdx] of oldToNewIndexMap.entries()) {
      const hist = oldRedoHistory.get(oldIdx)
      if (hist && hist.length > 0) {
        newRedoHistory.set(newIdx, [...hist])
      }
    }
    redoHistoryRef.current = newRedoHistory
  }

  const performUndo = () => {
    const history = undoHistoryRef.current.get(editCurrentPage)
    if (!history || history.length === 0) return
    // Save current state to redo history before restoring
    const currentPage = editPages[editCurrentPage]
    if (currentPage) {
      const redoHistory = redoHistoryRef.current.get(editCurrentPage) || []
      redoHistory.push(currentPage.editedImageBase64 || "")
      redoHistoryRef.current.set(editCurrentPage, redoHistory)
    }
    const previousState = history.pop()!
    undoHistoryRef.current.set(editCurrentPage, history)
    setUndoCount((c) => c + 1) // Trigger re-render to update undo/redo button state
    const restoredValue = previousState === "" ? null : previousState
    setEditPages((prev) => prev.map((p, i) => i === editCurrentPage ? { ...p, editedImageBase64: restoredValue } : p))
    if (editSubMode === "direct") {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  const performRedo = () => {
    const redoHistory = redoHistoryRef.current.get(editCurrentPage)
    if (!redoHistory || redoHistory.length === 0) return
    // Save current state to undo history before redoing
    const currentPage = editPages[editCurrentPage]
    if (currentPage) {
      const undoHistory = undoHistoryRef.current.get(editCurrentPage) || []
      undoHistory.push(currentPage.editedImageBase64 || "")
      undoHistoryRef.current.set(editCurrentPage, undoHistory)
    }
    const nextState = redoHistory.pop()!
    redoHistoryRef.current.set(editCurrentPage, redoHistory)
    setUndoCount((c) => c + 1) // Trigger re-render to update undo/redo button state
    const restoredValue = nextState === "" ? null : nextState
    setEditPages((prev) => prev.map((p, i) => i === editCurrentPage ? { ...p, editedImageBase64: restoredValue } : p))
    if (editSubMode === "direct") {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  const handleModeChange = (newMode: AppMode) => {
    if (newMode === mode) return
    // Reset states first, then change mode
    reset()
    resetEdit()
    setShowEmailPanel(false)
    setMode(newMode)
    // Update URL without causing navigation (shallow update)
    window.history.replaceState(null, "", `/convert/${MODE_TO_SLUG[newMode]}`)
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
    setProgressInfo({ label: "PDF 변환 중", percent: 0 })
    try {
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer), cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`, cMapPacked: true })
      const pdf = await loadingTask.promise
      const totalPages = pdf.numPages
      const pagesData: EditPageData[] = []
      for (let i = 1; i <= totalPages; i++) {
        setEditStatusText(`페이지 렌더링 중... (${i}/${totalPages})`)
        setProgressInfo({ label: "PDF 변환 중", percent: Math.round((i / totalPages) * 100) })
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
    } catch { setError("PDF를 읽을 수 없습니다.") } finally { setEditLoading(false); setProgressInfo(null) }
  }

  const handleEditFile = async (file: File) => {
    if (!file.name.endsWith(".pdf")) { setError("PDF 파일만 지원합니다."); return }
    setError(""); setEditFileName(file.name)
    const arrayBuffer = await file.arrayBuffer()
    setEditOriginalBytes(new Uint8Array(arrayBuffer.slice(0)))
    await renderEditPdfPages(arrayBuffer)
  }

  // Add PDF pages to existing edit session
  const addPdfToEdit = async (file: File) => {
    if (!file.name.endsWith(".pdf")) { setError("PDF 파일만 지원합니다."); return }
    setError("")
    setEditLoading(true)
    setEditStatusText("PDF 페이지 추가 중...")
    setProgressInfo({ label: "PDF 추가 중", percent: 0 })

    try {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
        cMapPacked: true,
      })
      const pdf = await loadingTask.promise
      const totalPages = pdf.numPages
      const newPagesData: EditPageData[] = []

      // Get reference dimensions from first page
      const refPage = editPages[0]
      const targetWidth = refPage?.width
      const targetHeight = refPage?.height

      for (let i = 1; i <= totalPages; i++) {
        setEditStatusText(`페이지 추가 중... (${i}/${totalPages})`)
        setProgressInfo({ label: "PDF 추가 중", percent: Math.round((i / totalPages) * 100) })
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2.0 })
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")!
        canvas.width = viewport.width
        canvas.height = viewport.height
        ctx.fillStyle = "#FFFFFF"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport }).promise

        let finalBase64 = canvas.toDataURL("image/png").split(",")[1]
        let finalWidth = viewport.width
        let finalHeight = viewport.height

        // Normalize to match first page dimensions if they exist
        if (targetWidth && targetHeight && (viewport.width !== targetWidth || viewport.height !== targetHeight)) {
          const normalizedCanvas = document.createElement("canvas")
          normalizedCanvas.width = targetWidth
          normalizedCanvas.height = targetHeight
          const normalizedCtx = normalizedCanvas.getContext("2d")!
          normalizedCtx.fillStyle = "#FFFFFF"
          normalizedCtx.fillRect(0, 0, targetWidth, targetHeight)
          // Scale to fit while maintaining aspect ratio
          const scale = Math.min(targetWidth / viewport.width, targetHeight / viewport.height)
          const scaledW = viewport.width * scale
          const scaledH = viewport.height * scale
          const offsetX = (targetWidth - scaledW) / 2
          const offsetY = (targetHeight - scaledH) / 2
          normalizedCtx.drawImage(canvas, offsetX, offsetY, scaledW, scaledH)
          finalBase64 = normalizedCanvas.toDataURL("image/png").split(",")[1]
          finalWidth = targetWidth
          finalHeight = targetHeight
        }

        newPagesData.push({
          pageNumber: 0, // Will be reindexed
          originalImageBase64: finalBase64,
          editedImageBase64: null,
          width: finalWidth,
          height: finalHeight,
          textItems: [],
        })
      }

      // Add new pages after current page
      const updatedPages = [...editPages]
      updatedPages.splice(editCurrentPage + 1, 0, ...newPagesData)
      setEditPages(reindexPages(updatedPages))
      setEditCurrentPage(editCurrentPage + 1)
      invalidateOriginalBytes()
      setEditStatusText("")
    } catch {
      setError("PDF를 읽을 수 없습니다.")
    } finally {
      setEditLoading(false)
      setProgressInfo(null)
    }
  }

  const submitEditPage = async (overridePrompt?: string) => {
    const promptToUse = overridePrompt || editPrompt.trim()
    if (!promptToUse || editProcessing) return
    const page = editPages[editCurrentPage]
    if (!page) return
    setEditProcessing(true); setError(""); setEditStatusText("AI가 페이지를 수정하고 있습니다...")
    setSaveAnimation("saving")
    try {
      const res = await fetch("/api/edit-pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: page.editedImageBase64 || page.originalImageBase64, prompt: promptToUse }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "수정에 실패했습니다."); setSaveAnimation("error"); setTimeout(() => setSaveAnimation("idle"), 2000); return }
      pushUndoSnapshot(editCurrentPage)
      const updatedPages = editPages.map((p, i) => i === editCurrentPage ? { ...p, editedImageBase64: data.editedImageBase64 } : p)
      setEditPages(updatedPages)
      // Immediately save after AI edit
      saveImmediately(updatedPages)
      setEditPrompt(""); setEditStatusText("")
      setSaveAnimation("success"); setTimeout(() => setSaveAnimation("idle"), 1500)
    } catch { setError("서버 연결에 실패했습니다."); setSaveAnimation("error"); setTimeout(() => setSaveAnimation("idle"), 2000) } finally { setEditProcessing(false); setEditStatusText("") }
  }

  const resetEditCurrentPage = () => {
    pushUndoSnapshot(editCurrentPage)
    setEditPages((prev) => prev.map((p, i) => (i === editCurrentPage ? { ...p, editedImageBase64: null } : p)))
    if (editSubMode === "direct") {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  // --- Page CRUD operations ---
  const deletePage = (targetIndex: number) => {
    if (editPages.length <= 1) return
    if (editSubMode === "direct") saveDirectCanvas()

    const indexMap = new Map<number, number>()
    let newIdx = 0
    for (let i = 0; i < editPages.length; i++) {
      if (i === targetIndex) continue
      indexMap.set(i, newIdx)
      newIdx++
    }
    rebuildUndoHistory(indexMap)

    const newPages = reindexPages(editPages.filter((_, i) => i !== targetIndex))
    setEditPages(newPages)

    if (editCurrentPage >= newPages.length) {
      setEditCurrentPage(newPages.length - 1)
    } else if (editCurrentPage > targetIndex) {
      setEditCurrentPage(editCurrentPage - 1)
    }

    invalidateOriginalBytes()
    if (editSubMode === "direct") {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  const addBlankPage = (afterIndex: number) => {
    if (editSubMode === "direct") saveDirectCanvas()

    const refPage = editPages[afterIndex]
    const width = refPage ? refPage.width : 1190
    const height = refPage ? refPage.height : 1684

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, width, height)

    // Auto-apply logo if set (Logo Consistency Feature)
    let editedBase64: string | null = null
    if (logoImage) {
      const logoImg = new window.Image()
      logoImg.onload = () => {
        const logoW = (logoScale / 100) * canvas.width
        const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth)
        const x = (logoPosition.x / 100) * canvas.width
        const y = (logoPosition.y / 100) * canvas.height
        ctx.globalAlpha = logoOpacity / 100
        ctx.drawImage(logoImg, x, y, logoW, logoH)
        ctx.globalAlpha = 1
        const withLogoBase64 = canvas.toDataURL("image/png").split(",")[1]

        // Update the page with logo applied
        setEditPages((prev) => {
          const updated = [...prev]
          const pageIndex = afterIndex + 1
          if (updated[pageIndex]) {
            updated[pageIndex] = { ...updated[pageIndex], editedImageBase64: withLogoBase64 }
          }
          return updated
        })
        if (editSubMode === "direct") {
          setTimeout(() => setCanvasInitTrigger((c) => c + 1), 100)
        }
      }
      logoImg.src = `data:image/png;base64,${logoImage}`
    }

    const blankBase64 = canvas.toDataURL("image/png").split(",")[1]

    const newPage: EditPageData = {
      pageNumber: 0,
      originalImageBase64: blankBase64,
      editedImageBase64: editedBase64,
      width,
      height,
      textItems: [],
    }

    const newPages = [...editPages]
    newPages.splice(afterIndex + 1, 0, newPage)

    const indexMap = new Map<number, number>()
    for (let i = 0; i < editPages.length; i++) {
      indexMap.set(i, i <= afterIndex ? i : i + 1)
    }
    rebuildUndoHistory(indexMap)

    setEditPages(reindexPages(newPages))
    setEditCurrentPage(afterIndex + 1)
    invalidateOriginalBytes()
    if (editSubMode === "direct" && !logoImage) {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  const duplicatePage = (targetIndex: number) => {
    if (lockedPages.has(targetIndex)) return
    if (editSubMode === "direct") saveDirectCanvas()
    const source = editPages[targetIndex]
    if (!source) return

    const clone: EditPageData = {
      ...source,
      pageNumber: 0,
      textItems: [],
    }

    const newPages = [...editPages]
    newPages.splice(targetIndex + 1, 0, clone)

    const indexMap = new Map<number, number>()
    for (let i = 0; i < editPages.length; i++) {
      indexMap.set(i, i <= targetIndex ? i : i + 1)
    }
    rebuildUndoHistory(indexMap)

    setEditPages(reindexPages(newPages))
    setEditCurrentPage(targetIndex + 1)
    invalidateOriginalBytes()
    if (editSubMode === "direct") {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  // Copy page to clipboard
  const copyPage = (pageIndex: number, styleOnly: boolean = false) => {
    const page = editPages[pageIndex]
    if (!page) return
    setCopiedPage({ data: { ...page }, isStyleOnly: styleOnly })
  }

  // Paste page from clipboard
  const pastePage = async (afterIndex: number) => {
    if (!copiedPage) return
    if (editSubMode === "direct") saveDirectCanvas()

    if (copiedPage.isStyleOnly) {
      // Style only: apply to current page
      const currentPage = editPages[afterIndex]
      if (!currentPage || lockedPages.has(afterIndex)) return
      pushUndoSnapshot(afterIndex)
      setEditPages((prev) => prev.map((p, i) =>
        i === afterIndex ? { ...p, editedImageBase64: copiedPage.data.editedImageBase64 } : p
      ))
      return
    }

    // Normalize page size to match the first page (for consistent display)
    const refPage = editPages[0]
    const targetWidth = refPage?.width || copiedPage.data.width
    const targetHeight = refPage?.height || copiedPage.data.height
    let finalImageBase64 = copiedPage.data.editedImageBase64 || copiedPage.data.originalImageBase64

    // If dimensions differ, resize the image to match
    if (copiedPage.data.width !== targetWidth || copiedPage.data.height !== targetHeight) {
      const img = new window.Image()
      img.src = `data:image/png;base64,${finalImageBase64}`
      await new Promise((resolve) => { img.onload = resolve })

      const canvas = document.createElement("canvas")
      canvas.width = targetWidth
      canvas.height = targetHeight
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = "#FFFFFF"
      ctx.fillRect(0, 0, targetWidth, targetHeight)
      // Draw image centered and scaled to fit
      const scale = Math.min(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight)
      const scaledW = img.naturalWidth * scale
      const scaledH = img.naturalHeight * scale
      const offsetX = (targetWidth - scaledW) / 2
      const offsetY = (targetHeight - scaledH) / 2
      ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH)
      finalImageBase64 = canvas.toDataURL("image/png").split(",")[1]
    }

    const newPage: EditPageData = {
      ...copiedPage.data,
      pageNumber: 0,
      originalImageBase64: finalImageBase64,
      editedImageBase64: null,
      width: targetWidth,
      height: targetHeight,
      textItems: [],
    }

    const newPages = [...editPages]
    newPages.splice(afterIndex + 1, 0, newPage)

    const indexMap = new Map<number, number>()
    for (let i = 0; i < editPages.length; i++) {
      indexMap.set(i, i <= afterIndex ? i : i + 1)
    }
    rebuildUndoHistory(indexMap)

    setEditPages(reindexPages(newPages))
    setEditCurrentPage(afterIndex + 1)
    invalidateOriginalBytes()
  }

  // Toggle page lock
  const togglePageLock = (pageIndex: number) => {
    setLockedPages((prev) => {
      const next = new Set(prev)
      if (next.has(pageIndex)) {
        next.delete(pageIndex)
      } else {
        next.add(pageIndex)
      }
      return next
    })
  }

  // Close context menu
  const closeContextMenu = () => setContextMenu(null)

  // Handle context menu action
  const handleContextMenuAction = (action: string) => {
    if (contextMenu === null) return
    const pageIndex = contextMenu.pageIndex

    switch (action) {
      case "copy":
        copyPage(pageIndex, false)
        break
      case "copyStyle":
        copyPage(pageIndex, true)
        break
      case "paste":
        pastePage(pageIndex)
        break
      case "duplicate":
        duplicatePage(pageIndex)
        break
      case "delete":
        if (!lockedPages.has(pageIndex)) deletePage(pageIndex)
        break
      case "lock":
        togglePageLock(pageIndex)
        break
    }
    closeContextMenu()
  }

  const movePage = (fromIndex: number, direction: "left" | "right") => {
    const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= editPages.length) return
    if (editSubMode === "direct") saveDirectCanvas()

    const newPages = [...editPages]
    const [moved] = newPages.splice(fromIndex, 1)
    newPages.splice(toIndex, 0, moved)

    const indexMap = new Map<number, number>()
    for (let i = 0; i < editPages.length; i++) {
      if (i === fromIndex) {
        indexMap.set(i, toIndex)
      } else if (direction === "left" && i >= toIndex && i < fromIndex) {
        indexMap.set(i, i + 1)
      } else if (direction === "right" && i > fromIndex && i <= toIndex) {
        indexMap.set(i, i - 1)
      } else {
        indexMap.set(i, i)
      }
    }
    rebuildUndoHistory(indexMap)

    setEditPages(reindexPages(newPages))
    setEditCurrentPage(toIndex)
    invalidateOriginalBytes()
    if (editSubMode === "direct") {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  // Page drag-and-drop reorder functions
  const handlePageDragStart = (e: React.DragEvent, index: number) => {
    if (lockedPages.has(index)) {
      e.preventDefault()
      return
    }
    setPageDragIndex(index)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", String(index))
  }

  const handlePageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (pageDragIndex !== null && index !== pageDragIndex) {
      setPageDragOverIndex(index)
    }
  }

  const handlePageDragLeave = () => {
    setPageDragOverIndex(null)
  }

  const handlePageDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    const fromIndex = pageDragIndex
    if (fromIndex === null || fromIndex === toIndex || lockedPages.has(toIndex)) {
      setPageDragIndex(null)
      setPageDragOverIndex(null)
      return
    }

    if (editSubMode === "direct") saveDirectCanvas()

    const newPages = [...editPages]
    const [moved] = newPages.splice(fromIndex, 1)
    newPages.splice(toIndex, 0, moved)

    // Rebuild undo history with new indices
    const indexMap = new Map<number, number>()
    for (let i = 0; i < editPages.length; i++) {
      if (i === fromIndex) {
        indexMap.set(i, toIndex)
      } else if (fromIndex < toIndex && i > fromIndex && i <= toIndex) {
        indexMap.set(i, i - 1)
      } else if (fromIndex > toIndex && i >= toIndex && i < fromIndex) {
        indexMap.set(i, i + 1)
      } else {
        indexMap.set(i, i)
      }
    }
    rebuildUndoHistory(indexMap)

    setEditPages(reindexPages(newPages))
    setEditCurrentPage(toIndex)
    invalidateOriginalBytes()
    setPageDragIndex(null)
    setPageDragOverIndex(null)

    if (editSubMode === "direct") {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  const handlePageDragEnd = () => {
    setPageDragIndex(null)
    setPageDragOverIndex(null)
  }

  // Apply page numbers to all pages
  const applyPageNumbers = async () => {
    if (editPages.length === 0) return
    if (editSubMode === "direct") saveDirectCanvas()

    const updatedPages = await Promise.all(
      editPages.map(async (page, index) => {
        const displayNumber = index + 1

        // Get or save base image (before page numbers)
        let baseImage = pageNumberBaseImagesRef.current.get(index)
        if (!baseImage) {
          // First time applying - save current state as base
          baseImage = page.editedImageBase64 || page.originalImageBase64
          pageNumberBaseImagesRef.current.set(index, baseImage)
        }

        // Skip pages before the start page (but still restore base to remove old numbers)
        if (displayNumber < pageNumberStartFrom) {
          // Restore base image (removes any previously applied page numbers)
          return { ...page, editedImageBase64: baseImage }
        }

        // Load the base image (not the current edited which may have old page numbers)
        const img = new window.Image()
        img.src = `data:image/png;base64,${baseImage}`
        await new Promise((resolve) => { img.onload = resolve })

        // Create canvas and draw the page
        const canvas = document.createElement("canvas")
        canvas.width = page.width
        canvas.height = page.height
        const ctx = canvas.getContext("2d")
        if (!ctx) return page

        ctx.drawImage(img, 0, 0)

        // Calculate page number position
        const pageNum = displayNumber - pageNumberStartFrom + 1
        const text = String(pageNum)
        // Font size as percentage of page height (pageNumberFontSize slider: 10-24 maps to ~1.25%-3% of height)
        const fontSizePercent = pageNumberFontSize / 800 // e.g., 14 -> 1.75% of height
        const scaledFontSize = Math.round(page.height * fontSizePercent)
        ctx.font = `${scaledFontSize}px Pretendard, sans-serif`
        ctx.fillStyle = "#333333"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"

        const metrics = ctx.measureText(text)
        // Padding as 2.5% of page height
        const padding = Math.round(page.height * 0.025)
        let x = page.width / 2
        let y = page.height - padding

        switch (pageNumberPosition) {
          case "bottom-left":
            x = padding + metrics.width / 2
            y = page.height - padding
            break
          case "bottom-right":
            x = page.width - padding - metrics.width / 2
            y = page.height - padding
            break
          case "bottom-center":
            x = page.width / 2
            y = page.height - padding
            break
          case "top-left":
            x = padding + metrics.width / 2
            y = padding
            break
          case "top-right":
            x = page.width - padding - metrics.width / 2
            y = padding
            break
          case "top-center":
            x = page.width / 2
            y = padding
            break
        }

        ctx.fillText(text, x, y)

        const newBase64 = canvas.toDataURL("image/png").split(",")[1]
        return { ...page, editedImageBase64: newBase64 }
      })
    )

    setEditPages(updatedPages)
    invalidateOriginalBytes()
    if (editSubMode === "direct") {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  // Remove page numbers (restore base images)
  const removePageNumbers = () => {
    if (pageNumberBaseImagesRef.current.size === 0) return
    if (editSubMode === "direct") saveDirectCanvas()

    const updatedPages = editPages.map((page, index) => {
      const baseImage = pageNumberBaseImagesRef.current.get(index)
      if (baseImage) {
        return { ...page, editedImageBase64: baseImage }
      }
      return page
    })

    // Clear the base images ref
    pageNumberBaseImagesRef.current.clear()

    setEditPages(updatedPages)
    invalidateOriginalBytes()
    if (editSubMode === "direct") {
      setTimeout(() => setCanvasInitTrigger((c) => c + 1), 50)
    }
  }

  // Normalize all pages to match first page dimensions
  const normalizeAllPageSizes = async () => {
    if (editPages.length < 2) return
    if (editSubMode === "direct") saveDirectCanvas()

    const refPage = editPages[0]
    const targetWidth = refPage.width
    const targetHeight = refPage.height

    setProgressInfo({ label: "페이지 크기 정규화 중", percent: 0 })

    const updatedPages = await Promise.all(
      editPages.map(async (page, index) => {
        setProgressInfo({ label: "페이지 크기 정규화 중", percent: Math.round(((index + 1) / editPages.length) * 100) })

        // Skip if already same size
        if (page.width === targetWidth && page.height === targetHeight) {
          return page
        }

        // Load current image
        const imgSrc = page.editedImageBase64 || page.originalImageBase64
        const img = new window.Image()
        img.src = `data:image/png;base64,${imgSrc}`
        await new Promise((resolve) => { img.onload = resolve })

        // Create normalized canvas
        const canvas = document.createElement("canvas")
        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "#FFFFFF"
        ctx.fillRect(0, 0, targetWidth, targetHeight)

        // Scale to fit while maintaining aspect ratio
        const scale = Math.min(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight)
        const scaledW = img.naturalWidth * scale
        const scaledH = img.naturalHeight * scale
        const offsetX = (targetWidth - scaledW) / 2
        const offsetY = (targetHeight - scaledH) / 2
        ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH)

        const normalizedBase64 = canvas.toDataURL("image/png").split(",")[1]

        return {
          ...page,
          originalImageBase64: normalizedBase64,
          editedImageBase64: null,
          width: targetWidth,
          height: targetHeight,
        }
      })
    )

    // Clear page number base images since dimensions changed
    pageNumberBaseImagesRef.current.clear()

    setEditPages(updatedPages)
    invalidateOriginalBytes()
    setProgressInfo(null)
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
    setProgressInfo({ label: "배경색 적용 중", percent: 0 })
    let failCount = 0
    let currentPages = [...editPages]
    for (let i = 0; i < editPages.length; i++) {
      setEditCurrentPage(i)
      setEditStatusText(`배경색 변경 중... (${i + 1}/${editPages.length})`)
      setProgressInfo({ label: "배경색 적용 중", percent: Math.round(((i + 1) / editPages.length) * 100) })
      const page = currentPages[i]
      try {
        const res = await fetch("/api/edit-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: page.editedImageBase64 || page.originalImageBase64, prompt }),
        })
        const data = await res.json()
        if (res.ok && data.editedImageBase64) {
          pushUndoSnapshot(i)
          currentPages = currentPages.map((p, idx) => idx === i ? { ...p, editedImageBase64: data.editedImageBase64 } : p)
          setEditPages(currentPages)
          // Save after each page for safety
          saveImmediately(currentPages)
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }
    setEditProcessing(false)
    setEditStatusText("")
    setProgressInfo(null)
    if (failCount > 0) {
      setError(`${editPages.length - failCount}/${editPages.length} 페이지 완료 (${failCount}개 실패)`)
    }
  }

  // --- Logo overlay functions ---
  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(",")[1]
      setLogoImage(base64)
      setLogoFileName(file.name)
      const img = new window.Image()
      img.onload = () => setLogoNaturalRatio(img.naturalHeight / img.naturalWidth)
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const handleLogoDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const container = (e.currentTarget as HTMLElement).parentElement
    if (!container) return
    const rect = container.getBoundingClientRect()
    logoDragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: logoPosition.x,
      startPosY: logoPosition.y,
    }
    const onMouseMove = (ev: MouseEvent) => {
      if (!logoDragRef.current) return
      const dx = ((ev.clientX - logoDragRef.current.startMouseX) / rect.width) * 100
      const dy = ((ev.clientY - logoDragRef.current.startMouseY) / rect.height) * 100
      setLogoPosition({
        x: Math.max(0, Math.min(100 - logoScale, logoDragRef.current.startPosX + dx)),
        y: Math.max(0, Math.min(100, logoDragRef.current.startPosY + dy)),
      })
    }
    const onMouseUp = () => {
      logoDragRef.current = null
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
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

          const x = (logoPosition.x / 100) * canvas.width
          const y = (logoPosition.y / 100) * canvas.height

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
    // Save after logo applied
    setTimeout(() => saveImmediately(editPages), 100)
    setEditProcessing(false)
    setEditStatusText("")
  }

  const applyLogoAll = async () => {
    if (!logoImage || editProcessing || editPages.length === 0) return
    setEditProcessing(true)
    setError("")
    setProgressInfo({ label: "로고 적용 중", percent: 0 })
    for (let i = 0; i < editPages.length; i++) {
      setEditCurrentPage(i)
      setEditStatusText(`로고 적용 중... (${i + 1}/${editPages.length})`)
      setProgressInfo({ label: "로고 적용 중", percent: Math.round(((i + 1) / editPages.length) * 100) })
      pushUndoSnapshot(i)
      await applyLogoToPage(i)
    }
    // Save after all logos applied
    setTimeout(() => saveImmediately(editPages), 100)
    setEditProcessing(false)
    setEditStatusText("")
    setProgressInfo(null)
  }

  // --- Direct editing functions ---
  const saveDirectCanvas = (pageIndex?: number) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const idx = pageIndex ?? editCurrentPage
    pushUndoSnapshot(idx)
    const base64 = canvas.toDataURL("image/png").split(",")[1]
    const updatedPages = editPages.map((p, i) => i === idx ? { ...p, editedImageBase64: base64 } : p)
    setEditPages(updatedPages)
    // Immediately save after direct edit
    saveImmediately(updatedPages)
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

  // Save current canvas state to editPages
  const saveCanvasToEditPages = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "")
    setEditPages((prev) =>
      prev.map((p, i) => (i === editCurrentPage ? { ...p, editedImageBase64: base64 } : p))
    )
  }

  const handleDirectMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const pos = getCanvasCoords(e)
    const ctx = canvas.getContext("2d")!
    const scale = canvas.width / canvas.getBoundingClientRect().width

    if (directTool === "draw" || directTool === "eraser") {
      // Push undo snapshot before starting new stroke
      pushUndoSnapshot(editCurrentPage)
      isDirectDrawingRef.current = true
      lastDrawPointRef.current = pos
      canvasSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.strokeStyle = directTool === "eraser" ? bgColor : drawColor
      ctx.lineWidth = (directTool === "eraser" ? drawSize * 5 : drawSize) * scale
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
    } else if (directTool === "text") {
      // If already in text input mode, confirm current text first
      if (directTextInput && directTextValue.trim()) {
        confirmDirectText()
      } else if (directTextInput) {
        cancelDirectText()
      }

      // Check if clicking on existing text object
      const pageTexts = textObjectsRef.current.get(editCurrentPage) || []
      let clickedTextIndex = -1
      for (let i = pageTexts.length - 1; i >= 0; i--) {
        const t = pageTexts[i]
        const fontSize = t.size * scale
        ctx.font = `${fontSize}px "${t.font}"`
        const textWidth = ctx.measureText(t.text).width
        const textHeight = fontSize
        // Check if click is within text bounding box
        if (pos.x >= t.x && pos.x <= t.x + textWidth &&
            pos.y >= t.y && pos.y <= t.y + textHeight) {
          clickedTextIndex = i
          break
        }
      }

      if (clickedTextIndex >= 0) {
        // Start drag mode for existing text (will decide edit vs move on mouseup)
        const textObj = pageTexts[clickedTextIndex]
        setDraggingTextIndex(clickedTextIndex)
        dragStartPosRef.current = pos
        dragOriginalTextPosRef.current = { x: textObj.x, y: textObj.y }
        isDragMovedRef.current = false

        // Use base canvas (without texts) if available, otherwise use editPages
        const baseCanvasData = baseCanvasDataRef.current.get(editCurrentPage)
        const pageData = editPages[editCurrentPage]
        const imgSrc = baseCanvasData || pageData?.originalImageBase64

        if (imgSrc) {
          const img = new Image()
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            // Redraw all texts except the one being dragged
            pageTexts.forEach((t, i) => {
              if (i !== clickedTextIndex) {
                const fontSize = t.size * scale
                ctx.fillStyle = t.color
                ctx.font = `${fontSize}px "${t.font}"`
                ctx.fillText(t.text, t.x, t.y + fontSize)
              }
            })
            // Save snapshot without the dragged text
            canvasSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
            // Draw the dragged text at original position for immediate visual feedback
            const fontSize = textObj.size * scale
            ctx.fillStyle = textObj.color
            ctx.font = `${fontSize}px "${textObj.font}"`
            ctx.fillText(textObj.text, textObj.x, textObj.y + fontSize)
          }
          img.src = `data:image/png;base64,${imgSrc}`
        }
      } else {
        // New text - push undo snapshot and start text input
        pushUndoSnapshot(editCurrentPage)
        setEditingTextIndex(null)
        directTextSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
        setDirectTextInput(pos)
        setDirectTextValue("")
        setDirectTextCursorVisible(true)
      }
    } else if (directTool === "rect") {
      // Push undo snapshot before starting rectangle
      pushUndoSnapshot(editCurrentPage)
      setDirectRectStart(pos)
      canvasSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    } else if (directTool === "select") {
      // Start selection
      setSelectionStart(pos)
      setSelectionRect(null)
      canvasSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    }
  }

  const handleDirectMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const pos = getCanvasCoords(e)
    const ctx = canvas.getContext("2d")!
    const scale = canvas.width / canvas.getBoundingClientRect().width

    if ((directTool === "draw" || directTool === "eraser") && isDirectDrawingRef.current) {
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastDrawPointRef.current = pos
    } else if (directTool === "rect" && directRectStart) {
      if (canvasSnapshotRef.current) {
        ctx.putImageData(canvasSnapshotRef.current, 0, 0)
      }
      ctx.strokeStyle = drawColor
      ctx.lineWidth = drawSize * scale
      ctx.strokeRect(directRectStart.x, directRectStart.y, pos.x - directRectStart.x, pos.y - directRectStart.y)
    } else if (directTool === "select" && selectionStart) {
      // Draw selection rectangle preview
      if (canvasSnapshotRef.current) {
        ctx.putImageData(canvasSnapshotRef.current, 0, 0)
      }
      const x = Math.min(selectionStart.x, pos.x)
      const y = Math.min(selectionStart.y, pos.y)
      const w = Math.abs(pos.x - selectionStart.x)
      const h = Math.abs(pos.y - selectionStart.y)
      // Draw selection rectangle with dashed border
      ctx.strokeStyle = "#6366f1"
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
      // Draw semi-transparent overlay
      ctx.fillStyle = "rgba(99, 102, 241, 0.1)"
      ctx.fillRect(x, y, w, h)
    } else if (directTool === "text" && draggingTextIndex !== null && dragStartPosRef.current && dragOriginalTextPosRef.current) {
      // Dragging text - check if moved more than 5px threshold
      const dx = pos.x - dragStartPosRef.current.x
      const dy = pos.y - dragStartPosRef.current.y
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDragMovedRef.current = true
      }
      if (isDragMovedRef.current) {
        // Update text position and redraw
        const pageTexts = textObjectsRef.current.get(editCurrentPage) || []
        const textObj = pageTexts[draggingTextIndex]
        if (textObj && canvasSnapshotRef.current) {
          // Restore snapshot (which doesn't include the dragged text)
          ctx.putImageData(canvasSnapshotRef.current, 0, 0)
          // Draw only the dragging text at new position
          const newX = dragOriginalTextPosRef.current.x + dx
          const newY = dragOriginalTextPosRef.current.y + dy
          const fontSize = textObj.size * scale
          ctx.fillStyle = textObj.color
          ctx.font = `${fontSize}px "${textObj.font}"`
          ctx.fillText(textObj.text, newX, newY + fontSize)
        }
      }
    }
  }

  // Update base canvas after non-text edits (drawing, eraser, rectangle)
  // This ensures text operations have correct base to work with
  const updateBaseCanvasAfterNonTextEdit = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const pageTexts = textObjectsRef.current.get(editCurrentPage) || []

    if (pageTexts.length === 0) {
      // No texts on this page - save current canvas directly as base
      const dataUrl = canvas.toDataURL("image/png")
      baseCanvasDataRef.current.set(editCurrentPage, dataUrl.replace(/^data:image\/png;base64,/, ""))
    } else if (canvasSnapshotRef.current) {
      // Texts exist - apply the drawing delta to base canvas
      const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const beforeDrawing = canvasSnapshotRef.current

      // Load base canvas to apply delta
      const baseData = baseCanvasDataRef.current.get(editCurrentPage)
      const pageData = editPages[editCurrentPage]
      const baseSrc = baseData || pageData?.originalImageBase64

      if (baseSrc) {
        const img = new Image()
        img.onload = () => {
          // Draw base (without texts)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const baseState = ctx.getImageData(0, 0, canvas.width, canvas.height)

          // Apply delta: where current differs from beforeDrawing, copy to base
          for (let i = 0; i < currentState.data.length; i += 4) {
            // Check if pixel changed (drawing happened here)
            if (currentState.data[i] !== beforeDrawing.data[i] ||
                currentState.data[i + 1] !== beforeDrawing.data[i + 1] ||
                currentState.data[i + 2] !== beforeDrawing.data[i + 2] ||
                currentState.data[i + 3] !== beforeDrawing.data[i + 3]) {
              // Copy the new pixel to base
              baseState.data[i] = currentState.data[i]
              baseState.data[i + 1] = currentState.data[i + 1]
              baseState.data[i + 2] = currentState.data[i + 2]
              baseState.data[i + 3] = currentState.data[i + 3]
            }
          }

          // Save updated base
          ctx.putImageData(baseState, 0, 0)
          const dataUrl = canvas.toDataURL("image/png")
          baseCanvasDataRef.current.set(editCurrentPage, dataUrl.replace(/^data:image\/png;base64,/, ""))

          // Restore canvas with texts
          ctx.putImageData(currentState, 0, 0)
        }
        img.src = `data:image/png;base64,${baseSrc}`
      }
    }
  }

  const handleDirectMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    if ((directTool === "draw" || directTool === "eraser") && isDirectDrawingRef.current) {
      isDirectDrawingRef.current = false
      lastDrawPointRef.current = null
      // Save canvas state after stroke completes
      saveCanvasToEditPages()
      // Also update base canvas (for text operations later)
      updateBaseCanvasAfterNonTextEdit()
    } else if (directTool === "rect" && directRectStart) {
      setDirectRectStart(null)
      canvasSnapshotRef.current = null
      // Save canvas state after rectangle completes
      saveCanvasToEditPages()
      // Also update base canvas (for text operations later)
      updateBaseCanvasAfterNonTextEdit()
    } else if (directTool === "text" && draggingTextIndex !== null) {
      const pos = getCanvasCoords(e)
      const pageTexts = textObjectsRef.current.get(editCurrentPage) || []
      const textObj = pageTexts[draggingTextIndex]

      if (isDragMovedRef.current && dragOriginalTextPosRef.current && dragStartPosRef.current && textObj) {
        // Moved - finalize new position
        pushUndoSnapshot(editCurrentPage)
        const dx = pos.x - dragStartPosRef.current.x
        const dy = pos.y - dragStartPosRef.current.y
        textObj.x = dragOriginalTextPosRef.current.x + dx
        textObj.y = dragOriginalTextPosRef.current.y + dy
        textObjectsRef.current.set(editCurrentPage, pageTexts)
        // Save canvas state
        saveCanvasToEditPages()
      } else if (textObj) {
        // Not moved - enter edit mode
        pushUndoSnapshot(editCurrentPage)
        setEditingTextIndex(draggingTextIndex)
        setDirectTextInput({ x: textObj.x, y: textObj.y })
        setDirectTextValue(textObj.text)
        setDirectTextSize(textObj.size)
        setDirectTextFontFamily(textObj.font)
        setDrawColor(textObj.color)
        // Redraw canvas without this text
        redrawCanvasWithoutText(draggingTextIndex)
        // Save snapshot after removing the text
        directTextSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
        setDirectTextCursorVisible(true)
      }

      // Reset drag state
      setDraggingTextIndex(null)
      dragStartPosRef.current = null
      dragOriginalTextPosRef.current = null
      isDragMovedRef.current = false
      canvasSnapshotRef.current = null
    } else if (directTool === "select" && selectionStart) {
      // Finalize selection
      const pos = getCanvasCoords(e)
      const x = Math.min(selectionStart.x, pos.x)
      const y = Math.min(selectionStart.y, pos.y)
      const w = Math.abs(pos.x - selectionStart.x)
      const h = Math.abs(pos.y - selectionStart.y)

      if (w > 5 && h > 5) {
        // Valid selection
        setSelectionRect({ x, y, w, h })
        // Restore canvas without selection preview
        if (canvasSnapshotRef.current) {
          ctx.putImageData(canvasSnapshotRef.current, 0, 0)
        }
      } else {
        // Too small, clear selection
        setSelectionRect(null)
        if (canvasSnapshotRef.current) {
          ctx.putImageData(canvasSnapshotRef.current, 0, 0)
        }
      }
      setSelectionStart(null)
      canvasSnapshotRef.current = null
    }
  }

  // Direct mode selection tool actions
  const copyDirectSelection = () => {
    if (!selectionRect || !drawCanvasRef.current) return
    const canvas = drawCanvasRef.current
    const ctx = canvas.getContext("2d")!
    // Copy selected region to clipboard ref
    selectionClipboardRef.current = ctx.getImageData(
      selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h
    )
  }

  const cutDirectSelection = () => {
    if (!selectionRect || !drawCanvasRef.current) return
    const canvas = drawCanvasRef.current
    const ctx = canvas.getContext("2d")!
    // Copy to clipboard first
    copyDirectSelection()
    // Fill with background color
    pushUndoSnapshot(editCurrentPage)
    ctx.fillStyle = bgColor
    ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h)
    saveCanvasToEditPages()
    setSelectionRect(null)
  }

  const deleteDirectSelection = () => {
    if (!selectionRect || !drawCanvasRef.current) return
    const canvas = drawCanvasRef.current
    const ctx = canvas.getContext("2d")!
    // Fill with background color
    pushUndoSnapshot(editCurrentPage)
    ctx.fillStyle = bgColor
    ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h)
    saveCanvasToEditPages()
    setSelectionRect(null)
  }

  const pasteDirectSelection = () => {
    if (!selectionClipboardRef.current || !drawCanvasRef.current) return
    const canvas = drawCanvasRef.current
    const ctx = canvas.getContext("2d")!
    // Paste at current selection position or center
    pushUndoSnapshot(editCurrentPage)
    const x = selectionRect?.x ?? (canvas.width - selectionClipboardRef.current.width) / 2
    const y = selectionRect?.y ?? (canvas.height - selectionClipboardRef.current.height) / 2
    ctx.putImageData(selectionClipboardRef.current, x, y)
    saveCanvasToEditPages()
  }

  // Render text with cursor on canvas (real-time preview)
  const renderDirectTextWithCursor = useCallback((showCursor: boolean) => {
    if (!directTextInput || !drawCanvasRef.current) return
    const canvas = drawCanvasRef.current
    const ctx = canvas.getContext("2d")!

    // Restore snapshot before rendering text
    if (directTextSnapshotRef.current) {
      ctx.putImageData(directTextSnapshotRef.current, 0, 0)
    }

    const scale = canvas.width / canvas.getBoundingClientRect().width
    const fontSize = directTextSize * scale
    ctx.fillStyle = drawColor
    ctx.font = `${fontSize}px "${directTextFontFamily}"`

    // Draw text
    const textY = directTextInput.y + fontSize
    if (directTextValue) {
      ctx.fillText(directTextValue, directTextInput.x, textY)
    }

    // Draw cursor
    if (showCursor) {
      const textWidth = ctx.measureText(directTextValue).width
      ctx.fillStyle = drawColor
      ctx.fillRect(directTextInput.x + textWidth + 2, directTextInput.y + 4, 2, fontSize - 4)
    }
  }, [directTextInput, directTextValue, directTextSize, directTextFontFamily, drawColor])

  // Cursor blink effect
  useEffect(() => {
    if (!directTextInput) return
    const interval = setInterval(() => {
      setDirectTextCursorVisible(v => !v)
    }, 530)
    return () => clearInterval(interval)
  }, [directTextInput])

  // Re-render text with cursor when cursor visibility changes
  useEffect(() => {
    if (directTextInput) {
      renderDirectTextWithCursor(directTextCursorVisible)
    }
  }, [directTextInput, directTextCursorVisible, directTextValue, renderDirectTextWithCursor])

  // Redraw canvas without a specific text object (for re-editing)
  const redrawCanvasWithoutText = (excludeIndex: number) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const pageData = editPages[editCurrentPage]
    if (!pageData) return

    // Use base canvas (without texts) if available
    const baseCanvasData = baseCanvasDataRef.current.get(editCurrentPage)
    const imgSrc = baseCanvasData || pageData.originalImageBase64

    // Redraw the base image
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      // Redraw all text objects except the one being edited
      const pageTexts = textObjectsRef.current.get(editCurrentPage) || []
      const scale = canvas.width / canvas.getBoundingClientRect().width
      pageTexts.forEach((t, i) => {
        if (i !== excludeIndex) {
          const fontSize = t.size * scale
          ctx.fillStyle = t.color
          ctx.font = `${fontSize}px "${t.font}"`
          ctx.fillText(t.text, t.x, t.y + fontSize)
        }
      })
    }
    img.src = `data:image/png;base64,${imgSrc}`
  }

  // Confirm text input
  const confirmDirectText = () => {
    if (!directTextInput || !drawCanvasRef.current) return
    const canvas = drawCanvasRef.current
    const ctx = canvas.getContext("2d")!
    const trimmedText = directTextValue.trim()

    // Save base canvas (before text) if this is a new text and base not yet saved
    if (directTextSnapshotRef.current && editingTextIndex === null) {
      // Save base canvas without texts for this page
      ctx.putImageData(directTextSnapshotRef.current, 0, 0)
      const baseDataUrl = canvas.toDataURL("image/png")
      baseCanvasDataRef.current.set(editCurrentPage, baseDataUrl.replace(/^data:image\/png;base64,/, ""))
    }

    // Final render without cursor (renders the text on canvas)
    renderDirectTextWithCursor(false)

    // Save text object for future re-editing
    if (trimmedText) {
      const pageTexts = textObjectsRef.current.get(editCurrentPage) || []
      const newTextObj: TextObject = {
        x: directTextInput.x,
        y: directTextInput.y,
        text: trimmedText,
        size: directTextSize,
        font: directTextFontFamily,
        color: drawColor,
      }
      if (editingTextIndex !== null) {
        // Replace existing text object
        pageTexts[editingTextIndex] = newTextObj
      } else {
        // Add new text object
        pageTexts.push(newTextObj)
      }
      textObjectsRef.current.set(editCurrentPage, pageTexts)
    } else if (editingTextIndex !== null) {
      // Empty text while editing existing - remove the text object
      const pageTexts = textObjectsRef.current.get(editCurrentPage) || []
      pageTexts.splice(editingTextIndex, 1)
      textObjectsRef.current.set(editCurrentPage, pageTexts)
    }

    directTextSnapshotRef.current = null
    setDirectTextInput(null)
    setDirectTextValue("")
    setEditingTextIndex(null)
    // Save canvas state (with text rendered) for display
    saveCanvasToEditPages()
  }

  // Cancel text input
  const cancelDirectText = () => {
    if (!directTextInput || !drawCanvasRef.current) return
    const canvas = drawCanvasRef.current
    const ctx = canvas.getContext("2d")!

    // Restore original snapshot
    if (directTextSnapshotRef.current) {
      ctx.putImageData(directTextSnapshotRef.current, 0, 0)
    }

    // If editing existing text, redraw it back
    if (editingTextIndex !== null) {
      const pageTexts = textObjectsRef.current.get(editCurrentPage) || []
      const textObj = pageTexts[editingTextIndex]
      if (textObj) {
        const scale = canvas.width / canvas.getBoundingClientRect().width
        const fontSize = textObj.size * scale
        ctx.fillStyle = textObj.color
        ctx.font = `${fontSize}px "${textObj.font}"`
        ctx.fillText(textObj.text, textObj.x, textObj.y + fontSize)
      }
    }

    directTextSnapshotRef.current = null
    setDirectTextInput(null)
    setDirectTextValue("")
    setEditingTextIndex(null)
  }

  // Handle hidden input for IME-compatible text entry
  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDirectTextValue(e.target.value)
  }

  const handleHiddenInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return // Don't handle keys during IME composition
    if (e.key === "Enter") {
      e.preventDefault()
      confirmDirectText()
    } else if (e.key === "Escape") {
      e.preventDefault()
      cancelDirectText()
    }
  }

  // Focus hidden input when text input mode starts
  useEffect(() => {
    if (directTextInput && directTool === "text" && hiddenTextInputRef.current) {
      hiddenTextInputRef.current.focus()
    }
  }, [directTextInput, directTool])

  // Delete text with Delete/Backspace key when dragging (selecting) text
  const deleteSelectedText = useCallback(() => {
    if (draggingTextIndex === null) return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    pushUndoSnapshot(editCurrentPage)

    // Remove text from storage
    const pageTexts = textObjectsRef.current.get(editCurrentPage) || []
    pageTexts.splice(draggingTextIndex, 1)
    textObjectsRef.current.set(editCurrentPage, pageTexts)

    // Redraw canvas without deleted text
    if (canvasSnapshotRef.current) {
      ctx.putImageData(canvasSnapshotRef.current, 0, 0)
    }

    // Reset drag state
    setDraggingTextIndex(null)
    dragStartPosRef.current = null
    dragOriginalTextPosRef.current = null
    isDragMovedRef.current = false
    canvasSnapshotRef.current = null

    // Save canvas state
    saveCanvasToEditPages()
  }, [draggingTextIndex, editCurrentPage, pushUndoSnapshot, saveCanvasToEditPages])

  // Handle Delete key for text deletion
  useEffect(() => {
    if (draggingTextIndex === null || directTool !== "text") return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        deleteSelectedText()
      } else if (e.key === "Escape") {
        // Cancel drag/selection
        setDraggingTextIndex(null)
        dragStartPosRef.current = null
        dragOriginalTextPosRef.current = null
        isDragMovedRef.current = false
        canvasSnapshotRef.current = null
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [draggingTextIndex, directTool, deleteSelectedText])

  const downloadEditedPdf = async () => {
    if (editPages.length === 0) return

    // Create abort controller for cancellation
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setSaveAnimation("saving")
    setEditStatusText("PDF 생성 중... (ESC로 취소)")
    setProgressInfo({ label: "PDF 저장 중", percent: 0 })
    try {
      let pdfBytes: Uint8Array
      if (editOriginalBytes) {
        const pdfDoc = await PDFDocument.load(new Uint8Array(editOriginalBytes))
        const editedPages = editPages.filter((p) => p.editedImageBase64)
        let editIdx = 0
        for (const page of editPages) {
          // Check for cancellation
          if (abortController.signal.aborted) throw new Error("cancelled")

          if (page.editedImageBase64) {
            editIdx++
            setProgressInfo({ label: "PDF 저장 중", percent: Math.round((editIdx / editedPages.length) * 90) })
            const imageBytes = Uint8Array.from(atob(page.editedImageBase64), (c) => c.charCodeAt(0))
            const mimeType = page.editedImageBase64.startsWith("/9j") ? "jpeg" : "png"
            const image = mimeType === "jpeg" ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes)
            const pdfPage = pdfDoc.getPage(page.pageNumber - 1)
            const { width, height } = pdfPage.getSize()
            pdfPage.drawImage(image, { x: 0, y: 0, width, height })
          }
        }
        if (abortController.signal.aborted) throw new Error("cancelled")
        pdfBytes = await pdfDoc.save()
      } else {
        const pdfDoc = await PDFDocument.create()
        for (let di = 0; di < editPages.length; di++) {
          // Check for cancellation
          if (abortController.signal.aborted) throw new Error("cancelled")

          const page = editPages[di]
          setProgressInfo({ label: "PDF 저장 중", percent: Math.round(((di + 1) / editPages.length) * 90) })
          const imgSrc = page.editedImageBase64 || page.originalImageBase64
          const isJpeg = imgSrc.startsWith("/9j")
          const res = await fetch(`data:image/${isJpeg ? "jpeg" : "png"};base64,${imgSrc}`)
          const imageBytes = new Uint8Array(await res.arrayBuffer())
          const image = isJpeg ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes)
          const pageW = page.width / 2
          const pageH = page.height / 2
          const pdfPage = pdfDoc.addPage([pageW, pageH])
          pdfPage.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH })
        }
        if (abortController.signal.aborted) throw new Error("cancelled")
        pdfBytes = await pdfDoc.save()
      }
      setProgressInfo({ label: "다운로드 중", percent: 100 })
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" })
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `edited_${editFileName}`; link.click()
      setSaveAnimation("success")
      setTimeout(() => setSaveAnimation("idle"), 1500)
    } catch (err) {
      // Don't show error if cancelled
      if (err instanceof Error && err.message === "cancelled") {
        return
      }
      setError("PDF 저장에 실패했습니다.")
      setSaveAnimation("error")
      setTimeout(() => setSaveAnimation("idle"), 2000)
    } finally {
      abortControllerRef.current = null
      setEditStatusText("")
      setProgressInfo(null)
    }
  }

  // Send PDF via email
  const sendPdfViaEmail = async (recipients: string[], subject: string, body: string): Promise<boolean> => {
    if (editPages.length === 0) return false
    setSaveAnimation("saving")
    try {
      let pdfBytes: Uint8Array
      if (editOriginalBytes) {
        const pdfDoc = await PDFDocument.load(new Uint8Array(editOriginalBytes))
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
        pdfBytes = await pdfDoc.save()
      } else {
        const pdfDoc = await PDFDocument.create()
        for (const page of editPages) {
          const imgSrc = page.editedImageBase64 || page.originalImageBase64
          const isJpeg = imgSrc.startsWith("/9j")
          const res = await fetch(`data:image/${isJpeg ? "jpeg" : "png"};base64,${imgSrc}`)
          const imageBytes = new Uint8Array(await res.arrayBuffer())
          const image = isJpeg ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes)
          const pageW = page.width / 2
          const pageH = page.height / 2
          const pdfPage = pdfDoc.addPage([pageW, pageH])
          pdfPage.drawImage(image, { x: 0, y: 0, width: pageW, height: pageH })
        }
        pdfBytes = await pdfDoc.save()
      }

      const success = await email.sendPdfEmail(pdfBytes, `edited_${editFileName}`, {
        to: recipients,
        subject,
        htmlBody: body.replace(/\n/g, "<br>"),
        textBody: body,
      })

      if (success) {
        setSaveAnimation("success")
        setTimeout(() => setSaveAnimation("idle"), 1500)
      } else {
        // Show the actual error message from email hook
        if (email.error) {
          setError(email.error)
        }
        setSaveAnimation("error")
        setTimeout(() => setSaveAnimation("idle"), 2000)
      }
      return success
    } catch (err) {
      setError(err instanceof Error ? err.message : "이메일 발송에 실패했습니다.")
      setSaveAnimation("error")
      setTimeout(() => setSaveAnimation("idle"), 2000)
      return false
    }
  }

  const editPageData = editPages[editCurrentPage]
  const editDisplayImage = editPageData ? editPageData.editedImageBase64 || editPageData.originalImageBase64 : null
  const hasEdits = editPages.some((p) => p.editedImageBase64)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Session Recovery Dialog */}
      {showRecoveryDialog && recoveryData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-popover border border-border rounded-2xl p-6 max-w-md w-full space-y-4">
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
          <div className="bg-popover border border-border rounded-2xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col">
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
                      onClick={() => downloadFromCloud(file.path, file.name)}
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
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {/* Header - hidden in fullscreen */}
        <header className={`h-14 border-b border-border bg-background flex-shrink-0 z-50 transition-all duration-300 ${isFullscreen ? "hidden" : ""}`}>
          <div className="h-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Hamburger menu for sidebar */}
              {isAiEdit && (
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                  title={sidebarCollapsed ? "메뉴 열기" : "메뉴 닫기"}
                >
                  {sidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                </button>
              )}
              <Link href="/" className="flex items-center gap-3 group">
                <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <img
                    src="https://r2-images.dacon.co.kr/external/DAKER.svg"
                    alt="DAKER"
                    className="h-5 w-auto"
                  />
                  <span className="text-foreground">PDF Parser</span>
                </h1>
              </Link>
              <ModeToggle />
              {/* Temp save indicator */}
              {isAiEdit && editPages.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {tempSaveStatus === "saving" && (
                    <>
                      <Circle className="w-2 h-2 fill-yellow-500 text-yellow-500 animate-pulse" />
                      <span>저장 중...</span>
                    </>
                  )}
                  {tempSaveStatus === "saved" && (
                    <>
                      <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                      <span>임시 저장됨</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isAiEdit && hasEdits && (
                <button
                  onClick={downloadEditedPdf}
                  title="PDF 다운로드 (⌘S)"
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/25"
                >
                  <Download className="w-3.5 h-3.5" />
                  다운로드
                </button>
              )}
              {isAiEdit && authUser && editPages.length > 0 && (
                <button
                  onClick={uploadPdfToCloud}
                  disabled={cloudUploading}
                  title="클라우드에 저장"
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25"
                >
                  {cloudUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                  저장
                </button>
              )}
              {authUser && (
                <button
                  onClick={() => { setShowCloudPanel(!showCloudPanel); if (!showCloudPanel) fetchCloudFiles() }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs rounded-lg transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  내 PDF
                </button>
              )}
              {/* Collaboration */}
              {isAiEdit && authUser && editPages.length > 0 && (
                <CollaborationPanel
                  session={collaboration.session}
                  collaborators={collaboration.collaborators}
                  showInviteDialog={collaboration.showInviteDialog}
                  setShowInviteDialog={collaboration.setShowInviteDialog}
                  inviteEmail={collaboration.inviteEmail}
                  setInviteEmail={collaboration.setInviteEmail}
                  inviteError={collaboration.inviteError}
                  onCreateSession={collaboration.createSession}
                  onSendInvite={collaboration.sendInvite}
                  onCopyInviteLink={collaboration.copyInviteLink}
                  fileName={editFileName}
                  isOwner={collaboration.session?.ownerId === authUser.id}
                />
              )}
              {/* Fullscreen toggle */}
              {isAiEdit && editPages.length > 0 && (
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                  title="전체 화면 (⌘Enter)"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
              {/* Auth */}
              {authLoading ? (
                <div className="w-8 h-8 rounded-full bg-secondary animate-pulse ring-1 ring-border" />
              ) : authUser ? (
                <div className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-secondary/60 border border-border rounded-full hover:border-ring transition-all group">
                  {authUser.user_metadata?.avatar_url ? (
                    <img src={authUser.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-full ring-2 ring-indigo-500/40" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ring-2 ring-indigo-500/40">
                      <User className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <span className="text-xs text-secondary-foreground font-medium max-w-[80px] truncate hidden sm:inline px-1">
                    {authUser.user_metadata?.full_name || authUser.email?.split("@")[0]}
                  </span>
                  <button
                    onClick={signOut}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="로그아웃"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-2 px-4 py-1.5 bg-card hover:bg-secondary text-foreground text-xs font-semibold rounded-full shadow-sm hover:shadow-md border border-border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar (Tool Rail) - collapsible */}
          <aside className={`flex-shrink-0 border-r border-border bg-muted/10 flex flex-col items-center py-4 gap-2 z-40 transition-all duration-300 ${isFullscreen ? "hidden" : sidebarCollapsed ? "w-0 overflow-hidden border-r-0" : "w-[72px]"
            }`}>
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg transition-all duration-200 group ${mode === m.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                title={m.label}
              >
                <span className="text-xl mb-0.5">{m.emoji}</span>
                <span className="text-[10px] font-medium opacity-70 group-hover:opacity-100">{m.label.split(' ')[0]}</span>
              </button>
            ))}

            {/* Email - always visible, prompts login if not authenticated */}
            <div className="w-8 h-px bg-border my-2" />
            <button
              onClick={() => {
                if (authUser) {
                  openEmailPanel()
                } else {
                  signInWithGoogle()
                }
              }}
              className="w-12 h-12 flex flex-col items-center justify-center rounded-lg transition-all duration-200 group text-muted-foreground hover:bg-muted hover:text-foreground"
              title={authUser ? "이메일 발송" : "로그인 후 이메일 발송"}
            >
              <Mail className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-medium opacity-70 group-hover:opacity-100">이메일</span>
            </button>
          </aside>

          {/* Main Content (Canvas) */}
          <main className={`flex-1 relative flex flex-col overflow-hidden transition-all duration-300 ${isFullscreen ? "bg-black" : "bg-muted/30"
            }`}>
            <div className={`absolute inset-0 overflow-auto flex flex-col transition-all duration-300 ${isFullscreen ? "p-0" : "p-6"
              }`}>
              <div className={`w-full flex-1 flex flex-col transition-all duration-300 ${isFullscreen ? "" : isAiEdit && editPages.length > 0 ? "max-w-7xl mx-auto" : "max-w-5xl mx-auto"
                }`}>
                {/* Mode Header - hidden in fullscreen */}
                {!isFullscreen && (
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-3xl font-bold tracking-tight text-foreground">
                        {showEmailPanel ? "이메일" : currentMode.label}
                      </h2>
                      {!showEmailPanel && isAiEdit && editFileName && (
                        <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          {editFileName}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {showEmailPanel ? "PDF를 이메일로 발송하고 발송 기록을 관리합니다" : currentMode.desc}
                    </p>
                  </div>
                )}

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
                          className={`relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${isDragging ? "border-primary bg-primary/10" : "border-border hover:border-ring bg-card"
                            }`}
                        >
                          <input ref={fileInputRef} type="file" accept={currentMode.accept} multiple={!isSingleFileMode} className="hidden" onChange={(e) => handleFiles(Array.from(e.target.files || []))} />
                          <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                          <p className="text-lg font-medium text-foreground mb-1">파일을 드래그하거나 클릭하세요</p>
                          <p className="text-sm text-muted-foreground">모든 파일은 기기 내에서만 처리됩니다</p>
                        </div>

                        {files.length > 0 && (
                          <div className="space-y-3">
                            {files.map((f, i) => (
                              <div key={i} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                                <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                                <span className="text-sm text-foreground truncate flex-1">{f.name}</span>
                                <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                                {!isSingleFileMode && (
                                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
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
                              <span className="text-sm font-medium text-foreground">페이지 선택</span>
                              <span className="text-xs text-muted-foreground">총 {pageCount}페이지</span>
                            </div>
                            <input type="text" value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="예: 1-5, 8, 11-15" className="w-full px-4 py-3 bg-background border border-input rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors" />
                          </div>
                        )}

                        {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">{error}</div>}

                        {files.length > 0 && (
                          <button onClick={startConversion} className="w-full py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/25">
                            변환 시작
                          </button>
                        )}
                      </div>
                    )}

                    {status === ProcessStatus.PROCESSING && (
                      <div className="flex flex-col items-center justify-center py-24 space-y-6">
                        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                        <div className="text-center">
                          <p className="text-lg font-medium text-foreground mb-2">변환 중...</p>
                          {progress.total > 0 && <p className="text-sm text-muted-foreground">{progress.current} / {progress.total}</p>}
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
                    {/* Email Panel (inline in content area) */}
                    {showEmailPanel && authUser && (
                      <EmailPanel
                        isOpen={showEmailPanel}
                        onClose={closeEmailPanel}
                        emails={email.emails}
                        loading={email.loading}
                        sending={email.sending}
                        error={email.error}
                        onSendEmail={email.sendEmail}
                        onSendPdfEmail={sendPdfViaEmail}
                        onDeleteEmail={email.deleteEmail}
                        onFetchEmails={email.fetchEmails}
                        pdfAvailable={editPages.some((p) => p.editedImageBase64)}
                        pdfFileName={editFileName}
                        inline={true}
                      />
                    )}

                    {/* Email Panel - Login Required */}
                    {showEmailPanel && !authUser && !authLoading && (
                      <div className="flex flex-col items-center justify-center py-24 space-y-6">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <Mail className="w-8 h-8 text-primary" />
                        </div>
                        <div className="text-center space-y-2">
                          <h3 className="text-xl font-semibold text-foreground">로그인이 필요합니다</h3>
                          <p className="text-muted-foreground">이메일 기능을 사용하려면 Google 계정으로 로그인하세요</p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={signInWithGoogle}
                            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                          >
                            <User className="w-4 h-4" />
                            Google로 로그인
                          </button>
                          <button
                            onClick={closeEmailPanel}
                            className="px-6 py-2.5 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                          >
                            돌아가기
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Drop zone */}
                    {!showEmailPanel && editPages.length === 0 && !editLoading && (
                      <div className="space-y-6">
                        <div
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={onDrop}
                          onClick={() => editFileInputRef.current?.click()}
                          className={`relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${isDragging ? "border-indigo-400 bg-indigo-500/10" : "border-gray-700 hover:border-gray-500 bg-gray-900/30"
                            }`}
                        >
                          <input ref={editFileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEditFile(f) }} />
                          <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? "text-indigo-400" : "text-gray-600"}`} />
                          <p className="text-lg font-medium text-foreground mb-1">PDF 파일을 드래그하거나 클릭하세요</p>
                          <p className="text-sm text-muted-foreground">AI로 PDF 텍스트를 자연어로 수정할 수 있습니다</p>
                        </div>
                        {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">{error}</div>}
                      </div>
                    )}

                    {/* Loading */}
                    {!showEmailPanel && editLoading && (
                      <div className="flex flex-col items-center justify-center py-24">
                        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                        <p className="text-muted-foreground">{editStatusText}</p>
                      </div>
                    )}

                    {/* Editor */}
                    {!showEmailPanel && editPages.length > 0 && !editLoading && (
                      <div className="flex flex-col gap-4">
                        {/* Page nav + thumbnails + mode toggle */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-border rounded-xl px-4 py-2">
                            <button onClick={() => navigateToPage(Math.max(0, editCurrentPage - 1))} disabled={editCurrentPage === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors" title="이전 페이지 (←)">
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-sm text-foreground font-medium min-w-[80px] text-center" title="Home: 처음 / End: 마지막">{editCurrentPage + 1} / {editPages.length}</span>
                            <button onClick={() => navigateToPage(Math.min(editPages.length - 1, editCurrentPage + 1))} disabled={editCurrentPage === editPages.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors" title="다음 페이지 (→)">
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </div>
                          {/* Page CRUD actions */}
                          <div className="flex items-center gap-1 bg-card/80 backdrop-blur-sm border border-border rounded-xl px-2 py-1.5">
                            <button
                              onClick={() => addBlankPage(editCurrentPage)}
                              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                              title="빈 페이지 추가"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => addPdfInputRef.current?.click()}
                              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                              title="PDF 파일 추가"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <input
                              ref={addPdfInputRef}
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) addPdfToEdit(f); e.target.value = "" }}
                            />
                            <button
                              onClick={() => duplicatePage(editCurrentPage)}
                              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                              title="페이지 복제 (⌘D)"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deletePage(editCurrentPage)}
                              disabled={editPages.length <= 1}
                              className="p-1.5 text-muted-foreground hover:text-red-400 disabled:opacity-20 transition-colors"
                              title="페이지 삭제 (Delete)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-border mx-0.5" />
                            <button
                              onClick={normalizeAllPageSizes}
                              disabled={editPages.length < 2 || editPages.every((p, i) => i === 0 || (p.width === editPages[0].width && p.height === editPages[0].height))}
                              className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                              title="모든 페이지 크기를 첫 번째 페이지에 맞춤"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                          </div>
                          {/* Page Numbering Controls */}
                          <div className="relative">
                            <button
                              onClick={() => setShowPageNumberPanel(!showPageNumberPanel)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-sm ${pageNumberEnabled ? "bg-indigo-600 text-white border-indigo-500" : "bg-card/80 text-muted-foreground border-border hover:text-foreground"}`}
                              title="페이지 번호 설정"
                            >
                              <Hash className="w-4 h-4" />
                              <span className="hidden sm:inline">페이지 번호</span>
                            </button>
                            {/* Page Number Settings Popover */}
                            {showPageNumberPanel && (
                            <>
                            {/* Backdrop to close on outside click */}
                            <div className="fixed inset-0 z-40" onClick={() => setShowPageNumberPanel(false)} />
                            <div className="absolute top-full left-0 mt-2 bg-popover border border-border rounded-xl p-4 shadow-xl z-50 min-w-[240px]">
                              <div className="flex flex-col gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={pageNumberEnabled}
                                    onChange={(e) => setPageNumberEnabled(e.target.checked)}
                                    className="w-4 h-4 rounded border-border"
                                  />
                                  <span className="text-sm text-foreground">페이지 번호 사용</span>
                                </label>
                                {pageNumberEnabled && (
                                  <>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-muted-foreground">위치</span>
                                      <select
                                        value={pageNumberPosition}
                                        onChange={(e) => setPageNumberPosition(e.target.value as PageNumberPosition)}
                                        className="px-2 py-1 text-sm bg-secondary border border-border rounded-lg"
                                      >
                                        <option value="bottom-center">하단 중앙</option>
                                        <option value="bottom-left">하단 좌측</option>
                                        <option value="bottom-right">하단 우측</option>
                                        <option value="top-center">상단 중앙</option>
                                        <option value="top-left">상단 좌측</option>
                                        <option value="top-right">상단 우측</option>
                                      </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-muted-foreground">시작 페이지</span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={editPages.length}
                                        value={pageNumberStartFrom}
                                        onChange={(e) => setPageNumberStartFrom(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="px-2 py-1 text-sm bg-secondary border border-border rounded-lg w-20"
                                      />
                                      <span className="text-[10px] text-muted-foreground">{pageNumberStartFrom > 1 ? `${pageNumberStartFrom - 1}페이지까지 번호 없음` : "모든 페이지에 번호"}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-muted-foreground">글꼴 크기 (상대값)</span>
                                      <input
                                        type="range"
                                        min={10}
                                        max={24}
                                        value={pageNumberFontSize}
                                        onChange={(e) => setPageNumberFontSize(parseInt(e.target.value))}
                                        className="w-full"
                                      />
                                      <span className="text-[10px] text-muted-foreground text-center">{pageNumberFontSize} (페이지 크기에 비례)</span>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                      <button
                                        onClick={applyPageNumbers}
                                        className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                                      >
                                        적용
                                      </button>
                                      <button
                                        onClick={removePageNumbers}
                                        disabled={pageNumberBaseImagesRef.current.size === 0}
                                        className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                      >
                                        제거
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            </>
                            )}
                          </div>
                          {/* Inline thumbnails with drag-and-drop reorder */}
                          <div className="flex gap-1.5 overflow-x-auto flex-1">
                            {editPages.map((page, i) => (
                              <div
                                key={`page-${i}`}
                                className={`relative flex-shrink-0 group/thumb transition-transform ${pageDragIndex === i ? "opacity-50 scale-95" : ""} ${pageDragOverIndex === i ? "translate-x-2" : ""}`}
                                draggable={!lockedPages.has(i)}
                                onDragStart={(e) => handlePageDragStart(e, i)}
                                onDragOver={(e) => handlePageDragOver(e, i)}
                                onDragLeave={handlePageDragLeave}
                                onDrop={(e) => handlePageDrop(e, i)}
                                onDragEnd={handlePageDragEnd}
                              >
                                {/* Drop indicator */}
                                {pageDragOverIndex === i && pageDragIndex !== null && pageDragIndex !== i && (
                                  <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-primary rounded-full z-40" />
                                )}
                                <button
                                  onClick={() => navigateToPage(i)}
                                  onContextMenu={(e) => {
                                    e.preventDefault()
                                    setContextMenu({ x: e.clientX, y: e.clientY, pageIndex: i })
                                  }}
                                  className={`relative h-16 rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing ${i === editCurrentPage ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-ring"
                                    } ${lockedPages.has(i) ? "opacity-60 cursor-not-allowed" : ""}`}
                                  style={{ width: `${Math.round(64 * (page.width / page.height))}px` }}
                                >
                                  <img src={`data:image/png;base64,${page.editedImageBase64 || page.originalImageBase64}`} alt={`Page ${page.pageNumber}`} className="w-full h-full object-contain pointer-events-none" />
                                  {page.editedImageBase64 && <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-indigo-500 rounded-full" />}
                                  {lockedPages.has(i) && <Lock className="absolute top-0.5 left-0.5 w-3 h-3 text-yellow-500" />}
                                  <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/60 py-0.5">{page.pageNumber}</span>
                                </button>
                                {/* Hover action overlay with more options button */}
                                <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover/thumb:flex items-center gap-0.5 bg-popover border border-border rounded-lg px-1 py-0.5 shadow-xl z-30 whitespace-nowrap">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); movePage(i, "left") }}
                                    disabled={i === 0 || lockedPages.has(i)}
                                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                                    title="왼쪽으로 이동"
                                  >
                                    <ChevronLeft className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); duplicatePage(i) }}
                                    disabled={lockedPages.has(i)}
                                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                                    title="복제 (⌘D)"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); movePage(i, "right") }}
                                    disabled={i === editPages.length - 1 || lockedPages.has(i)}
                                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                                    title="오른쪽으로 이동"
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                  {/* More options button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const rect = e.currentTarget.getBoundingClientRect()
                                      setContextMenu({ x: rect.left, y: rect.bottom + 4, pageIndex: i })
                                    }}
                                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                    title="더보기"
                                  >
                                    <MoreHorizontal className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Mode toggle: AI vs Direct */}
                          <div className="flex items-center bg-card/80 border border-border rounded-xl p-1 flex-shrink-0">
                            <button
                              onClick={() => handleSubModeChange("ai")}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${editSubMode === "ai" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                                }`}
                              title="AI로 텍스트 수정 (클릭/드래그로 영역 선택)"
                            >
                              ✨ AI 수정
                            </button>
                            <button
                              onClick={() => handleSubModeChange("direct")}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${editSubMode === "direct" ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-foreground"
                                }`}
                              title="펜/텍스트/도형으로 직접 그리기"
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
                              style={editPageData ? { maxHeight: isFullscreen ? "100vh" : "calc(100vh - 420px)", aspectRatio: `${editPageData.width} / ${editPageData.height}` } : undefined}
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
                                  <button onClick={resetEditCurrentPage} className="p-1.5 bg-gray-800/80 backdrop-blur-sm hover:bg-gray-700 rounded-md transition-colors cursor-pointer" title="원본으로 복원 (⌘Z: 실행취소)">
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
                            <div className="relative" style={editPageData ? { maxHeight: isFullscreen ? "100vh" : "calc(100vh - 420px)", aspectRatio: `${editPageData.width} / ${editPageData.height}` } : undefined}>
                              <canvas
                                ref={drawCanvasRef}
                                className="w-full h-full rounded-lg shadow-2xl border border-gray-800 select-none"
                                style={{ cursor: draggingTextIndex !== null ? "grabbing" : directTool === "text" ? "text" : directTool === "eraser" ? "cell" : "crosshair" }}
                                onMouseDown={handleDirectMouseDown}
                                onMouseMove={handleDirectMouseMove}
                                onMouseUp={handleDirectMouseUp}
                                onMouseLeave={() => {
                                  isDirectDrawingRef.current = false
                                  lastDrawPointRef.current = null
                                  // Reset text drag state on leave
                                  if (draggingTextIndex !== null) {
                                    setDraggingTextIndex(null)
                                    dragStartPosRef.current = null
                                    dragOriginalTextPosRef.current = null
                                    isDragMovedRef.current = false
                                    canvasSnapshotRef.current = null
                                  }
                                }}
                              />
                              {/* Text input hint overlay */}
                              {directTextInput && (
                                <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-gray-900/80 backdrop-blur-sm rounded-lg text-xs text-gray-300 pointer-events-none">
                                  입력 중... (Enter: 확인, ESC: 취소)
                                </div>
                              )}
                              {/* Text drag hint overlay */}
                              {draggingTextIndex !== null && (
                                <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-emerald-900/80 backdrop-blur-sm rounded-lg text-xs text-emerald-300 pointer-events-none">
                                  드래그: 이동 | 클릭: 편집 | Del: 삭제
                                </div>
                              )}
                              {/* Selection rectangle overlay */}
                              {selectionRect && directTool === "select" && drawCanvasRef.current && (
                                <div
                                  className="absolute border-2 border-indigo-500 border-dashed pointer-events-none bg-indigo-500/10"
                                  style={{
                                    left: `${(selectionRect.x / drawCanvasRef.current.width) * 100}%`,
                                    top: `${(selectionRect.y / drawCanvasRef.current.height) * 100}%`,
                                    width: `${(selectionRect.w / drawCanvasRef.current.width) * 100}%`,
                                    height: `${(selectionRect.h / drawCanvasRef.current.height) * 100}%`,
                                  }}
                                />
                              )}
                              {/* Hidden input for IME support (Korean, Japanese, Chinese, etc.) */}
                              {directTextInput && (
                                <input
                                  ref={hiddenTextInputRef}
                                  type="text"
                                  value={directTextValue}
                                  onChange={handleHiddenInputChange}
                                  onKeyDown={handleHiddenInputKeyDown}
                                  onCompositionStart={() => setIsComposing(true)}
                                  onCompositionEnd={() => setIsComposing(false)}
                                  onBlur={() => {
                                    // Re-focus if still in text input mode
                                    if (directTextInput && hiddenTextInputRef.current) {
                                      setTimeout(() => hiddenTextInputRef.current?.focus(), 0)
                                    }
                                  }}
                                  className="absolute opacity-0 pointer-events-auto"
                                  style={{
                                    left: `${(directTextInput.x / (drawCanvasRef.current?.width || 1)) * 100}%`,
                                    top: `${(directTextInput.y / (drawCanvasRef.current?.height || 1)) * 100}%`,
                                    width: "1px",
                                    height: "1px",
                                  }}
                                  autoComplete="off"
                                  autoCorrect="off"
                                  autoCapitalize="off"
                                  spellCheck={false}
                                />
                              )}
                              {editPageData?.editedImageBase64 && (
                                <div className="absolute top-3 right-3 flex gap-2">
                                  <span className="px-2 py-1 bg-emerald-600/80 backdrop-blur-sm text-xs font-medium rounded-md text-white">수정됨</span>
                                  <button onClick={resetEditCurrentPage} className="p-1.5 bg-gray-800/80 backdrop-blur-sm hover:bg-gray-700 rounded-md transition-colors cursor-pointer" title="원본으로 복원 (⌘Z: 실행취소)">
                                    <RotateCcw className="w-3.5 h-3.5 text-gray-300" />
                                  </button>
                                </div>
                              )}
                              {/* Logo preview overlay */}
                              {logoImage && (
                                <img
                                  src={`data:image/png;base64,${logoImage}`}
                                  alt="logo preview"
                                  draggable={false}
                                  onMouseDown={handleLogoDragStart}
                                  className="absolute z-20 cursor-grab active:cursor-grabbing rounded-sm ring-2 ring-transparent hover:ring-emerald-400/60 transition-shadow"
                                  style={{
                                    left: `${logoPosition.x}%`,
                                    top: `${logoPosition.y}%`,
                                    width: `${logoScale}%`,
                                    opacity: logoOpacity / 100,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        )}

                        {/* AI Mode: Controls */}
                        {editSubMode === "ai" && (
                          <>
                            {/* Background color picker */}
                            <div className="border border-border/50 rounded-xl bg-card/50 p-4">
                              <div className="flex items-center gap-3">
                                <Palette className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm font-medium text-foreground flex-shrink-0">배경색</span>
                                <div className="w-8 h-8 rounded-lg border-2 border-gray-600 flex-shrink-0" style={{ backgroundColor: bgColor }} title={bgColor} />
                                <div className="flex gap-1 flex-wrap flex-1">
                                  {PRESET_BG_COLORS.map((c) => (
                                    <button
                                      key={c}
                                      onClick={() => setBgColor(c)}
                                      className={`w-6 h-6 rounded-md border-2 transition-all ${bgColor === c ? "border-primary scale-110" : "border-border hover:border-ring"}`}
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
                                  className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all flex-shrink-0 ${eyedropperMode ? "border-primary bg-primary/20 text-primary" : "border-border hover:border-ring text-muted-foreground hover:text-foreground"}`}
                                  title="스포이드 (이미지에서 색상 추출, ESC: 취소)"
                                >
                                  <Pipette className="w-4 h-4" />
                                </button>
                                <button onClick={applyBgColor} disabled={editProcessing} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0">현재 페이지</button>
                                <button onClick={applyBgColorAll} disabled={editProcessing} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0">전체 적용</button>
                              </div>
                              {eyedropperMode && <p className="text-xs text-indigo-300 mt-2 ml-7">PDF 이미지를 클릭하여 색상을 추출하세요</p>}
                            </div>

                            {/* Prompt panel */}
                            <div className="border border-border rounded-xl bg-card overflow-hidden">
                              <div className="p-4 space-y-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {['제목을 "새로운 제목"으로 변경', "본문 글꼴을 더 크게", "오타 수정"].map((ex) => (
                                    <button key={ex} onClick={() => setEditPrompt(ex)} className="px-2.5 py-1 text-xs text-muted-foreground border border-border hover:border-ring hover:text-foreground rounded-lg transition-colors">{ex}</button>
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
                                    className="flex-1 p-3 bg-input/50 border border-input rounded-xl text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:border-primary/50 transition-colors"
                                  />
                                  <button
                                    onClick={() => submitEditPage()}
                                    disabled={!editPrompt.trim() || editProcessing}
                                    className="flex items-center justify-center gap-2 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-semibold rounded-xl transition-all duration-300 flex-shrink-0"
                                    title="AI 수정 적용 (Enter)"
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
                          <div className="border border-border rounded-xl bg-card p-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              {/* Tool buttons */}
                              {([
                                { tool: "select" as const, icon: MousePointer2, label: "선택" },
                                { tool: "draw" as const, icon: Pencil, label: "그리기" },
                                { tool: "eraser" as const, icon: Eraser, label: "지우개" },
                                { tool: "text" as const, icon: Type, label: "텍스트" },
                                { tool: "rect" as const, icon: Square, label: "사각형" },
                              ] as const).map(({ tool, icon: Icon, label }) => (
                                <button
                                  key={tool}
                                  onClick={() => setDirectTool(tool)}
                                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all ${directTool === tool
                                    ? "bg-emerald-600 text-white"
                                    : "text-muted-foreground hover:text-foreground border border-border hover:border-ring"
                                    }`}
                                  title={label}
                                >
                                  <Icon className="w-4 h-4" />
                                  {label}
                                </button>
                              ))}

                              <div className="w-px h-6 bg-border" />

                              {/* Color picker */}
                              <label className="w-8 h-8 rounded-lg border border-border hover:border-ring cursor-pointer overflow-hidden flex-shrink-0" title="색상">
                                <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-12 h-12 -mt-1 -ml-1 cursor-pointer" />
                              </label>

                              {/* Size slider */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">굵기</span>
                                <input type="range" min="1" max="20" value={drawSize} onChange={(e) => setDrawSize(Number(e.target.value))} className="w-20 accent-emerald-500" />
                                <span className="text-xs text-foreground w-6">{drawSize}</span>
                              </div>

                              {/* Background color picker (for eraser) */}
                              {directTool === "eraser" && (
                                <>
                                  <div className="w-px h-6 bg-border" />
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">배경색</span>
                                    <div className="w-6 h-6 rounded-md border border-border flex-shrink-0" style={{ backgroundColor: bgColor }} />
                                    <label className="w-6 h-6 rounded-md border border-border hover:border-ring cursor-pointer overflow-hidden flex-shrink-0" title="배경색 선택">
                                      <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value.toUpperCase())} className="w-8 h-8 -mt-1 -ml-1 cursor-pointer" />
                                    </label>
                                    <button
                                      onClick={startEyedropper}
                                      className={`w-6 h-6 flex items-center justify-center rounded-md border transition-all flex-shrink-0 ${eyedropperMode ? "border-indigo-500 bg-indigo-500/20 text-indigo-400" : "border-border hover:border-ring text-muted-foreground hover:text-foreground"}`}
                                      title="스포이드"
                                    >
                                      <Pipette className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </>
                              )}

                              {/* Text options (only when text tool) */}
                              {directTool === "text" && (
                                <>
                                  <div className="w-px h-6 bg-border" />
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">크기</span>
                                    <input type="range" min="12" max="72" value={directTextSize} onChange={(e) => setDirectTextSize(Number(e.target.value))} className="w-20 accent-emerald-500" />
                                    <span className="text-xs text-foreground w-6">{directTextSize}</span>
                                  </div>
                                  <div className="w-px h-6 bg-border" />
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">폰트</span>
                                    <select
                                      value={directTextFontFamily}
                                      onChange={(e) => setDirectTextFontFamily(e.target.value)}
                                      className="text-xs bg-secondary border border-border rounded-lg px-2 py-1 text-foreground"
                                    >
                                      {DIRECT_FONTS.map((font) => (
                                        <option key={font.value} value={font.value}>{font.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </>
                              )}

                              {/* Selection actions (only when select tool and selection exists) */}
                              {directTool === "select" && selectionRect && (
                                <>
                                  <div className="w-px h-6 bg-border" />
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={cutDirectSelection}
                                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-all text-muted-foreground hover:text-foreground border border-border hover:border-ring"
                                      title="잘라내기 (배경색으로 채움)"
                                    >
                                      <Scissors className="w-3.5 h-3.5" />
                                      잘라내기
                                    </button>
                                    <button
                                      onClick={copyDirectSelection}
                                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-all text-muted-foreground hover:text-foreground border border-border hover:border-ring"
                                      title="복사"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                      복사
                                    </button>
                                    <button
                                      onClick={deleteDirectSelection}
                                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-all text-red-400 hover:text-red-300 border border-red-500/50 hover:border-red-400"
                                      title="삭제 (배경색으로 채움)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      삭제
                                    </button>
                                    {selectionClipboardRef.current && (
                                      <button
                                        onClick={pasteDirectSelection}
                                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-all text-indigo-400 hover:text-indigo-300 border border-indigo-500/50 hover:border-indigo-400"
                                        title="붙여넣기"
                                      >
                                        <Clipboard className="w-3.5 h-3.5" />
                                        붙여넣기
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}

                              <div className="flex-1" />

                              {/* Undo button */}
                              <button
                                onClick={() => performUndo()}
                                disabled={undoCount >= 0 && !(undoHistoryRef.current.get(editCurrentPage)?.length ?? 0)}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all text-muted-foreground hover:text-foreground border border-border hover:border-ring disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground"
                                title="실행 취소 (Ctrl+Z / Cmd+Z)"
                              >
                                <Undo2 className="w-4 h-4" />
                                실행 취소
                              </button>

                              {/* Redo button */}
                              <button
                                onClick={() => performRedo()}
                                disabled={undoCount >= 0 && !(redoHistoryRef.current.get(editCurrentPage)?.length ?? 0)}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all text-muted-foreground hover:text-foreground border border-border hover:border-ring disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground"
                                title="다시 실행 (Ctrl+Shift+Z / Cmd+Shift+Z)"
                              >
                                <Redo2 className="w-4 h-4" />
                                다시 실행
                              </button>

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

                        {/* Direct Mode: Logo Panel */}
                        {editSubMode === "direct" && (
                          <div className="border border-border rounded-xl bg-card p-3 space-y-3">
                            <div className="flex items-center gap-3">
                              <ImagePlus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium text-foreground flex-shrink-0">로고/이미지</span>
                              {logoImage ? (
                                <>
                                  <img src={`data:image/png;base64,${logoImage}`} alt="logo" className="w-8 h-8 rounded-md border border-border object-contain bg-white flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">{logoFileName}</span>
                                  <button onClick={() => { setLogoImage(null); setLogoFileName("") }} className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                                </>
                              ) : (
                                <div className="flex gap-2">
                                  <button onClick={() => logoInputRef.current?.click()} className="px-3 py-1.5 text-xs text-muted-foreground border border-dashed border-border hover:border-ring hover:text-foreground rounded-lg transition-colors">
                                    파일 업로드
                                  </button>
                                  {authUser && (
                                    <button
                                      onClick={() => { setShowImagePanel(true); imageStorage.fetchImages() }}
                                      className="px-3 py-1.5 text-xs text-indigo-400 border border-indigo-500/50 hover:border-indigo-400 hover:text-indigo-300 rounded-lg transition-colors"
                                    >
                                      보관함
                                    </button>
                                  )}
                                </div>
                              )}
                              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }} />
                            </div>
                            {logoImage && (
                              <>
                                <div className="flex items-center gap-3 ml-7">
                                  <span className="text-xs text-muted-foreground flex-shrink-0 w-8">위치</span>
                                  {([
                                    { label: "↖ 좌상", x: logoMargin, y: logoMargin },
                                    { label: "↗ 우상", x: 100 - logoScale - logoMargin, y: logoMargin },
                                    { label: "↙ 좌하", x: logoMargin, y: 100 - logoScale * logoNaturalRatio * (editPageData ? editPageData.width / editPageData.height : 1) - logoMargin },
                                    { label: "↘ 우하", x: 100 - logoScale - logoMargin, y: 100 - logoScale * logoNaturalRatio * (editPageData ? editPageData.width / editPageData.height : 1) - logoMargin },
                                  ]).map(({ label, x, y }) => (
                                    <button
                                      key={label}
                                      onClick={() => setLogoPosition({ x, y })}
                                      className="px-2 py-1 text-xs rounded-md transition-all text-muted-foreground border border-border hover:border-ring hover:text-foreground"
                                    >
                                      {label}
                                    </button>
                                  ))}
                                  <span className="text-xs text-muted-foreground/60 ml-1">| 드래그로 자유 배치</span>
                                </div>
                                <div className="flex items-center gap-4 ml-7">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">크기</span>
                                    <input type="range" min="3" max="30" value={logoScale} onChange={(e) => setLogoScale(Number(e.target.value))} className="w-16 accent-emerald-500" />
                                    <span className="text-xs text-foreground w-8">{logoScale}%</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">투명도</span>
                                    <input type="range" min="10" max="100" value={logoOpacity} onChange={(e) => setLogoOpacity(Number(e.target.value))} className="w-16 accent-emerald-500" />
                                    <span className="text-xs text-foreground w-8">{logoOpacity}%</span>
                                  </div>
                                  <div className="flex-1" />
                                  <button onClick={applyLogoCurrent} disabled={editProcessing} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0">현재 페이지</button>
                                  <button onClick={applyLogoAll} disabled={editProcessing} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0">전체 적용</button>
                                </div>
                              </>
                            )}
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
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Fullscreen Floating Toolbar - auto-hide */}
      {isFullscreen && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 px-4 py-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-full shadow-2xl transition-all duration-300 ${showFullscreenToolbar ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
          }`}>
          <button
            onClick={() => setIsFullscreen(false)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
            title="전체 화면 종료 (ESC)"
          >
            <Minimize2 className="w-4 h-4" />
            <span className="hidden sm:inline">종료</span>
          </button>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditCurrentPage((p) => Math.max(0, p - 1))}
              disabled={editCurrentPage === 0}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 transition-all"
              title="이전 페이지 (←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium px-2 min-w-[60px] text-center" title="Home: 처음 / End: 마지막">
              {editCurrentPage + 1} / {editPages.length}
            </span>
            <button
              onClick={() => setEditCurrentPage((p) => Math.min(editPages.length - 1, p + 1))}
              disabled={editCurrentPage === editPages.length - 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 transition-all"
              title="다음 페이지 (→)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="w-px h-6 bg-border" />
          <button
            onClick={downloadEditedPdf}
            disabled={!editPages.some((p) => p.editedImageBase64)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all"
            title="PDF 다운로드 (⌘S)"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">다운로드</span>
          </button>
          {/* Temp save status in fullscreen */}
          {tempSaveStatus !== "idle" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
              {tempSaveStatus === "saving" && (
                <>
                  <Circle className="w-2 h-2 fill-yellow-500 text-yellow-500 animate-pulse" />
                  <span>저장 중</span>
                </>
              )}
              {tempSaveStatus === "saved" && (
                <>
                  <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                  <span>저장됨</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save Feedback Animation */}
      {saveAnimation !== "idle" && (
        <div className="fixed inset-0 z-[95] pointer-events-none flex items-center justify-center">
          <div className={`flex flex-col items-center gap-3 px-8 py-6 rounded-2xl backdrop-blur-xl transition-all duration-500 ${saveAnimation === "saving"
            ? "bg-indigo-500/20 border border-indigo-500/30 scale-100 opacity-100"
            : saveAnimation === "success"
              ? "bg-emerald-500/20 border border-emerald-500/30 scale-110 opacity-100"
              : "bg-red-500/20 border border-red-500/30 scale-100 opacity-100"
            }`}>
            {saveAnimation === "saving" && (
              <>
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                <span className="text-lg font-medium text-indigo-300">저장 중...</span>
              </>
            )}
            {saveAnimation === "success" && (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-500/30 flex items-center justify-center animate-bounce">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <span className="text-lg font-medium text-emerald-300">저장 완료!</span>
              </>
            )}
            {saveAnimation === "error" && (
              <>
                <div className="w-12 h-12 rounded-full bg-red-500/30 flex items-center justify-center">
                  <X className="w-8 h-8 text-red-400" />
                </div>
                <span className="text-lg font-medium text-red-300">실패</span>
                {error && <span className="text-sm text-red-400 mt-1 max-w-xs text-center">{error}</span>}
              </>
            )}
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[100] bg-background border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleContextMenuAction("copy")}
            className="w-full px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-secondary transition-colors"
          >
            <span className="flex items-center gap-2">
              <ClipboardCopy className="w-4 h-4" />
              복사
            </span>
            <span className="text-xs text-muted-foreground">⌘C</span>
          </button>
          <button
            onClick={() => handleContextMenuAction("copyStyle")}
            className="w-full px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-secondary transition-colors"
          >
            <span className="flex items-center gap-2">
              <Clipboard className="w-4 h-4" />
              스타일 복사
            </span>
            <span className="text-xs text-muted-foreground">⌥⌘C</span>
          </button>
          <button
            onClick={() => handleContextMenuAction("paste")}
            disabled={!copiedPage}
            className="w-full px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2">
              <Clipboard className="w-4 h-4" />
              붙여넣기
            </span>
            <span className="text-xs text-muted-foreground">⌘V</span>
          </button>
          <div className="h-px bg-border my-1" />
          <button
            onClick={() => handleContextMenuAction("duplicate")}
            className="w-full px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-secondary transition-colors"
          >
            <span className="flex items-center gap-2">
              <Copy className="w-4 h-4" />
              복제
            </span>
            <span className="text-xs text-muted-foreground">⌘D</span>
          </button>
          <button
            onClick={() => handleContextMenuAction("delete")}
            disabled={lockedPages.has(contextMenu.pageIndex)}
            className="w-full px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-secondary transition-colors text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              삭제
            </span>
            <span className="text-xs text-muted-foreground">Delete</span>
          </button>
          <div className="h-px bg-border my-1" />
          <button
            onClick={() => handleContextMenuAction("lock")}
            className="w-full px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-secondary transition-colors"
          >
            <span className="flex items-center gap-2">
              {lockedPages.has(contextMenu.pageIndex) ? (
                <>
                  <Unlock className="w-4 h-4" />
                  잠금 해제
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  잠금
                </>
              )}
            </span>
          </button>
          <button
            onClick={() => { closeContextMenu() }}
            className="w-full px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-secondary transition-colors"
          >
            <span className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              링크
            </span>
            <span className="text-xs text-muted-foreground">⌘K</span>
          </button>
        </div>
      )}

      {/* Context Menu Backdrop */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-[99]"
          onClick={closeContextMenu}
        />
      )}

      {/* Floating Progress Bar */}
      {progressInfo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700/60 rounded-2xl shadow-2xl shadow-black/40 px-5 py-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Loader2 className={`w-4 h-4 text-indigo-400 ${progressInfo.percent < 100 ? "animate-spin" : "hidden"}`} />
                {progressInfo.percent >= 100 && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                <span className="text-sm font-medium text-gray-200">{progressInfo.label}</span>
              </div>
              <span className="text-xs font-mono text-gray-400">{progressInfo.percent}%</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressInfo.percent}%`,
                  background: progressInfo.percent >= 100
                    ? "linear-gradient(90deg, #34d399, #10b981)"
                    : "linear-gradient(90deg, #818cf8, #a78bfa, #818cf8)",
                  backgroundSize: progressInfo.percent < 100 ? "200% 100%" : undefined,
                  animation: progressInfo.percent < 100 ? "shimmer 2s linear infinite" : undefined,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Storage Panel */}
      <ImagePanel
        isOpen={showImagePanel}
        images={imageStorage.images}
        loading={imageStorage.loading}
        uploading={imageStorage.uploading}
        onClose={() => setShowImagePanel(false)}
        onUpload={imageStorage.uploadImage}
        onDelete={imageStorage.deleteImage}
        onSelect={async (url) => {
          // Load image from URL and set as logo
          try {
            const res = await fetch(url)
            const blob = await res.blob()
            const reader = new FileReader()
            reader.onload = (e) => {
              const base64 = (e.target?.result as string)?.split(",")[1]
              if (base64) {
                setLogoImage(base64)
                setLogoFileName(url.split("/").pop() || "image")
              }
            }
            reader.readAsDataURL(blob)
            setShowImagePanel(false)
          } catch {
            // ignore
          }
        }}
      />

      <style jsx>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
    </div>
  )
}
