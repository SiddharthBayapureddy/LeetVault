/**
 * LeetVault — Background Service Worker  (ES module)
 *
 * Listens for messages from the content-script, retrieves the persisted
 * directory handle from IndexedDB, writes solution files via the
 * File System Access API, and updates stats.
 */

import { getDirectoryHandle }  from '../lib/storage.js';
import { writeSolutionFile }   from '../lib/file-writer.js';
import { DEFAULT_SETTINGS }    from '../lib/constants.js';
import { recordAttempt }       from '../lib/stats.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Load user settings from chrome.storage.local, merged with defaults.
 */
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('settings', (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...(result.settings || {}) });
    });
  });
}

/**
 * Verify readwrite permission on the stored directory handle.
 * In a service-worker context requestPermission() may silently fail
 * if there is no recent user gesture — that's expected; the popup
 * is responsible for re-granting.
 */
async function verifyPermission(handle) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  // Attempt to request — may succeed if called shortly after user interaction
  try {
    if ((await handle.requestPermission(opts)) === 'granted') return true;
  } catch { /* swallow — expected in SW without gesture */ }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Message handlers                                                  */
/* ------------------------------------------------------------------ */

/**
 * SAVE_SOLUTION — the core save pipeline.
 */
async function handleSaveSolution(data, settings, attemptMeta) {
  // 1. Retrieve stored directory handle
  const handle = await getDirectoryHandle();
  if (!handle) {
    throw new Error('NO_DIRECTORY');
  }

  // 2. Check we still have permission
  if (!(await verifyPermission(handle))) {
    throw new Error('PERMISSION_DENIED');
  }

  // 3. Write the file
  const result = await writeSolutionFile(handle, data, settings);

  // 4. Update stats
  if (attemptMeta) {
    attemptMeta.savedToDisk = true;
    await recordAttempt(data, attemptMeta);
  }

  return { success: true, ...result };
}

/**
 * CHECK_DIRECTORY — lets the popup (or content-script) check readiness.
 */
async function handleCheckDirectory() {
  const handle = await getDirectoryHandle();
  if (!handle) return { configured: false };
  const ok = await verifyPermission(handle);
  return { configured: true, hasPermission: ok };
}

/* ------------------------------------------------------------------ */
/*  Listener                                                          */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SAVE_SOLUTION') {
    handleSaveSolution(message.data, message.settings, message.attemptMeta)
      .then(sendResponse)
      .catch((err) => {
        console.error('[LeetVault] Error handling', message.type, err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  } else if (message.type === 'LOG_ATTEMPT') {
    recordAttempt(message.data, message.attemptMeta)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error('[LeetVault] Error logging attempt', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  } else if (message.type === 'CHECK_DIRECTORY') {
    handleCheckDirectory()
      .then(sendResponse)
      .catch((err) => {
        console.error('[LeetVault] Error checking directory', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});
