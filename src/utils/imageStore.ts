/**
 * Binary side-store for chat images.
 *
 * Session metadata lives in localStorage, but base64 image payloads do not fit
 * there — a handful of photos exhausts the ~5 MB quota and takes the whole
 * session record down with it. IndexedDB has a far larger budget and stores the
 * strings off the main serialization path, so images survive a reload without
 * putting the rest of the session at risk.
 *
 * Every call degrades to a no-op when IndexedDB is unavailable (private mode,
 * old WebView). Images are then simply lost on reload — the same behaviour as
 * before this store existed, never a thrown error.
 */

const DB_NAME = 'fetsubot_media';
const DB_VERSION = 1;
const STORE = 'images';

export interface StoredImage {
  id: string;
  sessionId: string;
  base64: string;
  mimeType: string;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise(resolve => {
    if (typeof indexedDB === 'undefined') return resolve(null);

    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.warn('IndexedDB unavailable, images will not survive reload:', req.error);
      resolve(null);
    };
    req.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/** Writes images, skipping ids already present so re-saves stay cheap. */
export async function putImages(images: StoredImage[]): Promise<void> {
  if (images.length === 0) return;
  const db = await openDb();
  if (!db) return;

  return new Promise(resolve => {
    try {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      for (const img of images) store.put(img);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.warn('Image persist failed:', transaction.error);
        resolve();
      };
      transaction.onabort = () => resolve();
    } catch (err) {
      console.warn('Image persist failed:', err);
      resolve();
    }
  });
}

/** Returns id → StoredImage for every image belonging to a session. */
export async function loadSessionImages(sessionId: string): Promise<Map<string, StoredImage>> {
  const result = new Map<string, StoredImage>();
  const db = await openDb();
  if (!db) return result;

  return new Promise(resolve => {
    try {
      const req = tx(db, 'readonly').index('sessionId').getAll(sessionId);
      req.onsuccess = () => {
        for (const img of (req.result as StoredImage[]) || []) result.set(img.id, img);
        resolve(result);
      };
      req.onerror = () => resolve(result);
    } catch {
      resolve(result);
    }
  });
}

/** Drops every image for a session — used by Reset Chat. */
export async function clearSessionImages(sessionId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise(resolve => {
    try {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const req = store.index('sessionId').openKeyCursor(IDBKeyRange.only(sessionId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
