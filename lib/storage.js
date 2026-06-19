/**
 * LeetVault — Storage Utilities  (ES module)
 *
 * Thin IndexedDB wrapper that persists a single FileSystemDirectoryHandle
 * across browser sessions.  Used by the service-worker and the popup.
 */

const DB_NAME    = 'LeetVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'rootDirectory';

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                  */
/* ------------------------------------------------------------------ */

/** Open (or create) the LeetVault IndexedDB database. */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/** Persist a FileSystemDirectoryHandle. */
export async function saveDirectoryHandle(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/** Retrieve the stored FileSystemDirectoryHandle, or null if none. */
export async function getDirectoryHandle() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

/** Delete the stored handle (e.g. user wants to pick a new folder). */
export async function clearDirectoryHandle() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
