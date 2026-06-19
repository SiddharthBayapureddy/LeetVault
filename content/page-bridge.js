/**
 * LeetVault — Page Bridge (MAIN world)
 *
 * This script runs in the page's own JS context (world: "MAIN") so it can
 * access globals the isolated content-script world cannot — in particular,
 * the `monaco` editor instance that LeetCode embeds.
 *
 * Communication with the isolated-world content script happens through
 * CustomEvents dispatched on `document`.
 *
 *   content-script  ──►  leetvault:request   ──►  page-bridge
 *   page-bridge     ──►  leetvault:response  ──►  content-script
 */
(() => {
  'use strict';

  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = args[0]?.url || args[0];
      if (typeof url === 'string' && url.includes('/check/')) {
        const cloned = response.clone();
        cloned.json().then(data => {
          if (data && data.state === 'SUCCESS') {
            document.dispatchEvent(new CustomEvent('leetvault:result', { detail: data }));
          }
        }).catch(() => {});
      }
    } catch (e) {}
    return response;
  };

  document.addEventListener('leetvault:request', (e) => {
    const { requestId, action } = e.detail;
    const response = { requestId };

    if (action === 'getEditorData') {
      try {
        let code = null;
        let languageId = null;

        // Approach 1: iterate visible editor instances
        const editors = window.monaco?.editor?.getEditors?.();
        if (editors && editors.length > 0) {
          const model = editors[0].getModel();
          if (model) {
            code = model.getValue();
            languageId = model.getLanguageId?.() ?? null;
          }
        }

        // Approach 2 (fallback): use getModels() — works even when
        // getEditors is unavailable on older Monaco builds
        if (code === null) {
          const models = window.monaco?.editor?.getModels?.();
          if (models && models.length > 0) {
            code = models[0].getValue();
            languageId = models[0].getLanguageId?.() ?? null;
          }
        }

        response.code = code;
        response.languageId = languageId;
      } catch (err) {
        response.error = err.message;
      }
    }

    document.dispatchEvent(
      new CustomEvent('leetvault:response', { detail: response })
    );
  });
})();
