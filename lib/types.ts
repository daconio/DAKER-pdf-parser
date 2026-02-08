export enum ConversionMode {
  PDF_TO_PNG = "PDF_TO_PNG",
  PNG_TO_PDF = "PNG_TO_PDF",
  MERGE_PDF = "MERGE_PDF",
  FLATTEN_PDF = "FLATTEN_PDF",
  SPLIT_PDF = "SPLIT_PDF",
}

export enum ProcessStatus {
  IDLE = "IDLE",
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
}

export interface FileItem {
  id: string
  file: File
  status: ProcessStatus
  progress: number
}

export interface GeneratedFile {
  id: string
  name: string
  url: string
  blob: Blob
}

export const AI_EDIT = "AI_EDIT" as const
export type AppMode = ConversionMode | typeof AI_EDIT

export const MODE_SLUG_MAP: Record<string, AppMode> = {
  "pdf-to-image": ConversionMode.PDF_TO_PNG,
  "image-to-pdf": ConversionMode.PNG_TO_PDF,
  "merge": ConversionMode.MERGE_PDF,
  "flatten": ConversionMode.FLATTEN_PDF,
  "split": ConversionMode.SPLIT_PDF,
  "ai-edit": AI_EDIT,
}

export const MODE_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(MODE_SLUG_MAP).map(([slug, mode]) => [mode, slug])
)
