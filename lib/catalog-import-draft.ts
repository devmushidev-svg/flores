const DB_NAME = "floreria-catalogo-import"
const STORE_NAME = "draft-items"
const DB_VERSION = 1
const FALLBACK_STORAGE_KEY = "floreria-catalogo-import-fallback"

export interface CatalogImportDraftRecord {
  id: string
  file: Blob | null
  fileName: string | null
  codigo: string
  nombre: string
  precio: string
  descripcion: string
  status: "pending" | "uploading" | "done" | "error"
}

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestToPromise<T = void>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Fallo una operacion de IndexedDB"))
  })
}

export async function loadCatalogImportDraft(): Promise<CatalogImportDraftRecord[]> {
  try {
    const db = await openDraftDb()
    const transaction = db.transaction(STORE_NAME, "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const records = (await requestToPromise(store.getAll())) as CatalogImportDraftRecord[]

    if (records.length > 0) {
      localStorage.removeItem(FALLBACK_STORAGE_KEY)
    }

    return records.map((record) => ({
      ...record,
      status: record.status === "uploading" ? "pending" : record.status,
    }))
  } catch {
    const fallback = localStorage.getItem(FALLBACK_STORAGE_KEY)
    if (!fallback) return []

    try {
      const parsed = JSON.parse(fallback) as CatalogImportDraftRecord[]
      return parsed.map((record) => ({
        ...record,
        file: null,
        fileName: null,
        status: record.status === "uploading" ? "pending" : record.status,
      }))
    } catch {
      return []
    }
  }
}

export async function saveCatalogImportDraft(items: CatalogImportDraftRecord[]) {
  try {
    const db = await openDraftDb()

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo guardar el borrador"))
      transaction.onabort = () => reject(transaction.error ?? new Error("La transaccion de borrador fue cancelada"))

      const clearRequest = store.clear()
      clearRequest.onsuccess = () => {
        for (const item of items) {
          store.put(item)
        }
      }
      clearRequest.onerror = () => reject(clearRequest.error ?? new Error("No se pudo limpiar el borrador anterior"))
    })

    localStorage.removeItem(FALLBACK_STORAGE_KEY)
  } catch {
    const lightweightItems = items.map((item) => ({
      ...item,
      file: null,
      fileName: null,
    }))
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(lightweightItems))
  }
}

export async function clearCatalogImportDraft() {
  localStorage.removeItem(FALLBACK_STORAGE_KEY)

  try {
    const db = await openDraftDb()

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo limpiar el borrador"))
      request.onerror = () => reject(request.error ?? new Error("No se pudo limpiar el borrador"))
    })
  } catch {
    return Promise.resolve()
  }
}
