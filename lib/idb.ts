const DB_NAME = "daker-pdf-parser"
const DB_VERSION = 2
const STORE_NAME = "edit-sessions"
const SESSION_KEY = "current-session"

// Serializable history format (Map can't be stored directly in IndexedDB)
type SerializedHistory = Array<[number, string[]]>

interface EditSessionData {
  editPages: Array<{
    pageNumber: number
    originalImageBase64: string
    editedImageBase64: string | null
    width: number
    height: number
  }>
  editFileName: string
  editCurrentPage: number
  timestamp: number
  // Undo/Redo history per page (optional for backward compatibility)
  undoHistory?: SerializedHistory
  redoHistory?: SerializedHistory
}

// Helper functions to convert Map <-> Array for serialization
export function serializeHistoryMap(map: Map<number, string[]>): SerializedHistory {
  return Array.from(map.entries())
}

export function deserializeHistoryMap(arr: SerializedHistory | undefined): Map<number, string[]> {
  return new Map(arr || [])
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveEditSession(data: EditSessionData): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.put(data, SESSION_KEY)
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // IndexedDB may not be available (e.g. private browsing)
  }
}

export async function loadEditSession(): Promise<EditSessionData | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(SESSION_KEY)
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}

export async function deleteEditSession(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.delete(SESSION_KEY)
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Ignore
  }
}
