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
