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
import { recordSave }          from '../lib/stats.js';

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
async function handleSave(data) {
  // 1. Retrieve stored directory handle
  const handle = await getDirectoryHandle();
  if (!handle) {
    return { success: false, error: 'NO_DIRECTORY' };
  }

  // 2. Check we still have permission
  if (!(await verifyPermission(handle))) {
    return { success: false, error: 'PERMISSION_DENIED' };
  }

  // 3. Load user settings
  const settings = await getSettings();

  // 4. Write the file
  const result = await writeSolutionFile(handle, data, settings);

  // 5. Update stats (non-blocking — failures are swallowed inside)
  await recordSave(data);

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
  const route = {
    SAVE_SOLUTION:   () => handleSave(message.data),
    CHECK_DIRECTORY: () => handleCheckDirectory(),
  }[message.type];

  if (route) {
    route()
      .then(sendResponse)
      .catch((err) => {
        console.error('[LeetVault] Error handling', message.type, err);
        sendResponse({ success: false, error: err.message });
      });
    return true;   // keep the message channel open for the async response
  }
});
