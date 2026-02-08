import * as pdfjsLib from "pdfjs-dist"
import { jsPDF } from "jspdf"
import { PDFDocument } from "pdf-lib"

const pdfjs: any = (pdfjsLib as any).default || pdfjsLib
const PDFJS_VERSION = "3.11.174"

if (typeof window !== "undefined" && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`
}

export const getPdfPageCount = async (file: Blob): Promise<number> => {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
    cMapPacked: true,
  })
  const pdf = await loadingTask.promise
  return pdf.numPages
}

export const convertPdfToImages = async (
  file: Blob,
  onProgress: (page: number, total: number) => void,
  pagesToConvert?: number[],
): Promise<Blob[]> => {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
    cMapPacked: true,
  })
  const pdf = await loadingTask.promise
  const totalPages = pdf.numPages
  const targetPages = pagesToConvert || Array.from({ length: totalPages }, (_, i) => i + 1)
  const imageBlobs: Blob[] = []

  for (let i = 0; i < targetPages.length; i++) {
    const pageNum = targetPages[i]
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    canvas.height = viewport.height
    canvas.width = viewport.width
    if (context) {
      context.fillStyle = "#FFFFFF"
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: context, viewport }).promise
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png", 0.95))
      if (blob) imageBlobs.push(blob)
    }
    onProgress(i + 1, targetPages.length)
    await new Promise((r) => setTimeout(r, 0))
  }
  return imageBlobs
}

export const convertImagesToPdf = async (
  files: Blob[],
  onProgress: (c: number, t: number) => void,
): Promise<Blob> => {
  const doc = new jsPDF()
  for (let i = 0; i < files.length; i++) {
    const imgData = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(files[i])
    })
    if (i > 0) doc.addPage()
    const pdfW = doc.internal.pageSize.getWidth()
    const pdfH = doc.internal.pageSize.getHeight()
    doc.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH)
    onProgress(i + 1, files.length)
  }
  return doc.output("blob")
}

export const mergePdfs = async (
  files: Blob[],
  onProgress: (c: number, t: number) => void,
): Promise<Blob> => {
  const mergedPdf = await PDFDocument.create()
  for (let i = 0; i < files.length; i++) {
    const pdf = await PDFDocument.load(await files[i].arrayBuffer())
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
    copiedPages.forEach((p) => mergedPdf.addPage(p))
    onProgress(i + 1, files.length)
  }
  const bytes = await mergedPdf.save()
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" })
}

export const splitPdf = async (
  file: Blob,
  pages: number[],
  onProgress: (c: number, t: number) => void,
): Promise<Blob[]> => {
  const srcPdf = await PDFDocument.load(await file.arrayBuffer())
  const results: Blob[] = []
  for (let i = 0; i < pages.length; i++) {
    const newPdf = await PDFDocument.create()
    const [page] = await newPdf.copyPages(srcPdf, [pages[i] - 1])
    newPdf.addPage(page)
    const pdfBytes = await newPdf.save()
    results.push(new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }))
    onProgress(i + 1, pages.length)
  }
  return results
}

export const flattenPdfs = async (
  files: Blob[],
  onProgress: (c: number, t: number) => void,
): Promise<Blob> => {
  const images: Blob[] = []
  for (const f of files) {
    const pageImgs = await convertPdfToImages(f, () => {})
    images.push(...pageImgs)
  }
  return convertImagesToPdf(images, onProgress)
}
