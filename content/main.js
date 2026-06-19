/**
 * LeetVault — Content Script: Main
 *
 * Entry point that wires observer → extractor → chrome.runtime messaging
 * and shows in-page toast notifications for save feedback.
 *
 * Loaded last (after extractor.js and observer.js).
 */
/* global LV, chrome */

(() => {
  'use strict';

  /** Simple debounce guard — prevents double-fire from rapid clicks. */
  let saving = false;

  /* ---------------------------------------------------------------- */
  /*  Save handler                                                    */
  /* ---------------------------------------------------------------- */

  /**
   * Called by the observer when Run or Submit is clicked.
   *
   * Flow:
   *  1. Extract problem metadata + code (extractor)
   *  2. Send to background service-worker for file write
   *  3. Show success / error toast
   */
  async function onSaveTrigger(triggerType) {
    if (saving) return;
    saving = true;

    try {
      // 1 — Extract
      const data      = await LV.extractor.extractAll();
      data.triggerType = triggerType;

      // 2 — Delegate write to service-worker
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_SOLUTION',
        data,
      });

      // 3 — Surface result
      if (response?.success) {
        showToast(`✓ Saved → ${response.fullPath}`, 'success');
      } else {
        handleError(response);
      }
    } catch (err) {
      console.error('[LeetVault]', err);
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      saving = false;
    }
  }

  /** Map specific service-worker error codes to user-friendly messages. */
  function handleError(response) {
    const code = response?.error;
    switch (code) {
      case 'NO_DIRECTORY':
        showToast('No save folder set — open LeetVault popup to pick one.', 'warn');
        break;
      case 'PERMISSION_DENIED':
        showToast('Folder access lost — open LeetVault popup to reconnect.', 'warn');
        break;
      default:
        showToast(`Save failed: ${code || 'unknown error'}`, 'error');
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Toast notification                                              */
  /* ---------------------------------------------------------------- */

  /**
   * Show a small, auto-dismissing toast in the bottom-right of the page.
   *
   * @param {string} message
   * @param {'success'|'error'|'warn'|'info'} type
   */
  function showToast(message, type = 'info') {
    // Remove any lingering toast
    document.getElementById('leetvault-toast')?.remove();

    const el       = document.createElement('div');
    el.id          = 'leetvault-toast';
    el.className   = `leetvault-toast leetvault-toast--${type}`;
    el.textContent = message;
    document.body.appendChild(el);

    // Trigger CSS enter transition on next frame
    requestAnimationFrame(() => el.classList.add('leetvault-toast--visible'));

    // Auto-dismiss after 4 s
    setTimeout(() => {
      el.classList.remove('leetvault-toast--visible');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
      // Safety net — remove even if transitionend never fires
      setTimeout(() => el.remove(), 600);
    }, 4000);
  }

  /* ---------------------------------------------------------------- */
  /*  Bootstrap                                                       */
  /* ---------------------------------------------------------------- */

  LV.observer.init(onSaveTrigger);
  console.log('[LeetVault] Content script initialised.');
})();
