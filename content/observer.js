/**
 * LeetVault — Content Script: Observer
 *
 * Detects Run / Submit button clicks and fires a callback.
 * Uses a MutationObserver + URL-change polling to handle
 * LeetCode's React SPA re-renders and client-side navigation.
 *
 * Public API: `window.LV.observer.init(callback)`
 */
/* global LV */

LV.observer = (() => {
  'use strict';

  let _lastAction = null;
  let _mo = null;

  /** Track last-known URL so we can detect SPA navigations. */
  let _lastUrl = '';

  /** WeakSet of buttons we have already instrumented. */
  const _attached = new WeakSet();

  /* ---------------------------------------------------------------- */
  /*  Button discovery                                                */
  /* ---------------------------------------------------------------- */

  /** Selectors for the Run button (most-specific first). */
  const RUN_SEL = [
    '[data-e2e-locator="console-run-button"]',
    'button[data-cy="run-code-btn"]',
  ];

  /** Selectors for the Submit button. */
  const SUBMIT_SEL = [
    '[data-e2e-locator="console-submit-button"]',
    'button[data-cy="submit-code-btn"]',
  ];

  /**
   * Find a button by a list of selectors, falling back to text-match.
   */
  function findButton(selectors, labelRe) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    // Fallback — scan all <button> text
    for (const btn of document.querySelectorAll('button')) {
      if (labelRe.test(btn.textContent.trim())) return btn;
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /*  Attach / scan                                                   */
  /* ---------------------------------------------------------------- */

  /** Attach a capture-phase click listener to `btn`, guarded by WeakSet. */
  function attach(btn, type) {
    if (!btn || _attached.has(btn)) return;
    _attached.add(btn);
    btn.addEventListener('click', () => {
      _lastAction = type;
    }, { capture: true });
  }

  /** Scan the DOM for Run/Submit buttons and instrument them. */
  function scan() {
    attach(findButton(RUN_SEL,    /^Run$/i),    'run');
    attach(findButton(SUBMIT_SEL, /^Submit$/i), 'submit');
  }

  /* ---------------------------------------------------------------- */
  /*  MutationObserver — catch React re-renders                       */
  /* ---------------------------------------------------------------- */

  function startMutationObserver() {
    if (_mo) return;
    // Debounce rapid mutations so we don't re-scan on every node change
    let timer = null;
    _mo = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(scan, 250);
    });
    _mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------------------------------------------------------------- */
  /*  URL-change watcher — catch SPA navigation                       */
  /* ---------------------------------------------------------------- */

  function watchUrlChanges() {
    _lastUrl = location.href;
    setInterval(() => {
      if (location.href !== _lastUrl) {
        _lastUrl = location.href;
        // New problem page — give React time to render, then re-scan
        setTimeout(scan, 1500);
      }
    }, 1000);
  }

  /* ---------------------------------------------------------------- */
  /*  Public API                                                      */
  /* ---------------------------------------------------------------- */

  /**
   * Initialise the observer.  Call once from main.js.
   *
   * @param {(type: 'run'|'submit') => void} callback
   */
  function init() {
    scan();
    startMutationObserver();
    watchUrlChanges();
  }

  return { init, getLastAction: () => _lastAction };
})();
