/**
 * Dynamic PDF library loader for performance optimization
 * Lazy loads heavy PDF libraries only when needed
 */

let pdfServiceModule: typeof import("./pdfService") | null = null

export async function loadPdfService() {
  if (!pdfServiceModule) {
    pdfServiceModule = await import("./pdfService")
  }
  return pdfServiceModule
}

// Individual function loaders for granular imports
export async function getPdfPageCountAsync(file: Blob): Promise<number> {
  const service = await loadPdfService()
  return service.getPdfPageCount(file)
}

export async function convertPdfToImagesAsync(
  file: Blob,
  onProgress: (page: number, total: number) => void,
  pagesToConvert?: number[]
): Promise<Blob[]> {
  const service = await loadPdfService()
  return service.convertPdfToImages(file, onProgress, pagesToConvert)
}

export async function convertImagesToPdfAsync(
  files: Blob[],
  onProgress: (c: number, t: number) => void
): Promise<Blob> {
  const service = await loadPdfService()
  return service.convertImagesToPdf(files, onProgress)
}

export async function mergePdfsAsync(
  files: Blob[],
  onProgress: (c: number, t: number) => void
): Promise<Blob> {
  const service = await loadPdfService()
  return service.mergePdfs(files, onProgress)
}

export async function splitPdfAsync(
  file: Blob,
  pages: number[],
  onProgress: (c: number, t: number) => void
): Promise<Blob[]> {
  const service = await loadPdfService()
  return service.splitPdf(file, pages, onProgress)
}

export async function flattenPdfsAsync(
  files: Blob[],
  onProgress: (c: number, t: number) => void
): Promise<Blob> {
  const service = await loadPdfService()
  return service.flattenPdfs(files, onProgress)
}
