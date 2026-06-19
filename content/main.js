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
  async function onSaveTrigger(triggerType, force = false) {
    if (saving) return { success: false, error: 'Already saving' };

    try {
      const { settings } = await chrome.storage.local.get('settings');
      if (!force && settings && settings.autoSave === false) {
        return { success: false, error: 'Autosave disabled' };
      }
      
      saving = true;
      const data = await LV.extractor.extractAll();
      
      const attemptMeta = {
        action: triggerType,
        result: data.statusTag || 'Unknown'
      };

      const response = await sendToBackground({
        type: 'SAVE_SOLUTION',
        data,
        settings,
        attemptMeta
      });

      if (response?.success) {
        chrome.storage.local.set({ lastSaveResult: 'success' });
        showToast(`✓ Saved → ${response.fullPath}`, 'success');
        return { success: true };
      } else {
        chrome.storage.local.set({ lastSaveResult: 'error' });
        handleError(response);
        return { success: false, error: response?.error || 'Save failed' };
      }
    } catch (err) {
      console.error('[LeetVault]', err);
      chrome.storage.local.set({ lastSaveResult: 'error' });
      showToast(`Save failed: ${err.message}`, 'error');
      return { success: false, error: err.message };
    } finally {
      saving = false;
    }
  }

  document.addEventListener('leetvault:result', async (e) => {
    const data = e.detail;
    const action = LV.observer.getLastAction() || 'run';
    const result = data.status_msg || 'Unknown';
    
    try {
      const extracted = await LV.extractor.extractAll();
      extracted.statusTag = result; // High fidelity tag from API
      
      const attemptMeta = { action, result };

      if (action === 'submit' && result === 'Accepted') {
        const { settings } = await chrome.storage.local.get('settings');
        if (settings && settings.autoSave !== false) {
          saving = true;
          const res = await sendToBackground({
            type: 'SAVE_SOLUTION',
            data: extracted,
            settings,
            attemptMeta
          });
          saving = false;
          
          if (res?.success) {
            chrome.storage.local.set({ lastSaveResult: 'success' });
            showToast(`✓ Saved → ${res.fullPath}`, 'success');
          } else {
            chrome.storage.local.set({ lastSaveResult: 'error' });
            handleError(res);
          }
          return;
        }
      }

      // If not autosaved, log attempt only
      await sendToBackground({
        type: 'LOG_ATTEMPT',
        data: extracted,
        attemptMeta
      });
    } catch (err) {
      console.error('[LeetVault] Result interception failed:', err);
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'MANUAL_SAVE') {
      onSaveTrigger('manual', true).then(sendResponse);
      return true; // Keeps channel open for async response
    }
  });

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
