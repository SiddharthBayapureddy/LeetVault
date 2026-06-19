/**
 * LeetVault — Content Script: Extractor
 *
 * Reads problem metadata from the LeetCode DOM and retrieves
 * the current code + language from the Monaco editor via the
 * page-bridge (MAIN-world script).
 *
 * All public API lives on `window.LV.extractor`.
 * This file loads before observer.js and main.js (same global scope).
 */
/* global LV */

var LV = window.LV || {};   // eslint-disable-line no-var
window.LV = LV;

LV.extractor = (() => {
  'use strict';

  /* ---------------------------------------------------------------- */
  /*  URL / slug                                                      */
  /* ---------------------------------------------------------------- */

  /**
   * Parse the problem slug from the current URL.
   * URL shape: https://leetcode.com/problems/{slug}/...
   */
  function extractSlug() {
    const m = window.location.pathname.match(/\/problems\/([^/]+)/);
    return m ? m[1] : null;
  }

  /* ---------------------------------------------------------------- */
  /*  Problem number                                                  */
  /* ---------------------------------------------------------------- */

  /** Try a list of CSS selectors looking for "123. Title" text. */
  function extractProblemNumber() {
    // Strategy 1 — common heading selectors
    const selectors = [
      '[data-cy="question-title"]',
      'div[class*="text-title-large"]',
      'span[class*="text-title-large"]',
      'div[class*="title"] a[href*="/problems/"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const m = el.textContent.trim().match(/^(\d+)\./);
        if (m) return m[1];
      }
    }

    // Strategy 2 — document.title  ("1. Two Sum - LeetCode")
    const titleMatch = document.title.match(/^(\d+)\./);
    if (titleMatch) return titleMatch[1];

    // Strategy 3 — any element whose text starts with digits followed by "."
    const headings = document.querySelectorAll('h1, h2, h3, h4, a');
    for (const h of headings) {
      const m = h.textContent.trim().match(/^(\d+)\.\s/);
      if (m) return m[1];
    }

    return '0';   // ultimate fallback
  }

  /* ---------------------------------------------------------------- */
  /*  Difficulty                                                      */
  /* ---------------------------------------------------------------- */

  const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

  function extractDifficulty() {
    // Approach 1 — elements whose class hints at difficulty colouring
    const colourSelectors = [
      'div[class*="text-difficulty"]', 'span[class*="text-difficulty"]',
      'div[class*="text-olive"]',      'span[class*="text-olive"]',
      'div[class*="text-yellow"]',     'span[class*="text-yellow"]',
      'div[class*="text-pink"]',       'span[class*="text-pink"]',
      'div[class*="text-lc-green"]',   'span[class*="text-lc-green"]',
      'div[class*="text-lc-yellow"]',  'span[class*="text-lc-yellow"]',
      'div[class*="text-lc-red"]',     'span[class*="text-lc-red"]',
    ];
    for (const sel of colourSelectors) {
      const el = document.querySelector(sel);
      if (el && DIFFICULTIES.includes(el.textContent.trim())) {
        return el.textContent.trim();
      }
    }

    // Approach 2 — leaf text nodes that match exactly
    const leaves = document.querySelectorAll('span, div');
    for (const el of leaves) {
      if (el.children.length === 0 && DIFFICULTIES.includes(el.textContent.trim())) {
        return el.textContent.trim();
      }
    }

    return 'Unknown';
  }

  /* ---------------------------------------------------------------- */
  /*  Tags                                                            */
  /* ---------------------------------------------------------------- */

  function extractTags() {
    const tags = [];
    const links = document.querySelectorAll('a[href*="/tag/"]');
    for (const a of links) {
      const t = a.textContent.trim();
      if (t && !tags.includes(t)) tags.push(t);
    }
    return tags;
  }

  /* ---------------------------------------------------------------- */
  /*  Status Tag (Run/Submit result)                                  */
  /* ---------------------------------------------------------------- */

  function extractStatusTag() {
    // Known status text from the LeetCode results panel
    const statuses = [
      'Accepted', 'Wrong Answer', 'Runtime Error', 'Time Limit Exceeded',
      'Memory Limit Exceeded', 'Compile Error', 'Output Limit Exceeded'
    ];
    
    // The result is usually in a coloured span/div in the bottom pane.
    // data-e2e-locator is sometimes present, or specific class names.
    const selectors = [
      '[data-e2e-locator="submission-result"]',
      'div[class*="text-green-s"]',   // typically Accepted
      'div[class*="text-red-s"]',     // typically WA/RE/TLE
      'span[class*="text-green-s"]',
      'span[class*="text-red-s"]',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = el.textContent.trim();
        if (statuses.includes(text)) {
          return text;
        }
      }
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /*  Description & Testcases                                         */
  /* ---------------------------------------------------------------- */

  function extractDescription() {
    // Problem description is usually in a specific div
    const selectors = [
      '[data-track-load="description_content"]',
      'div[class*="content__"]',
      'div[class*="question-content"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        // Simple HTML stripping — get text content, collapsing multiple blank lines
        let text = el.innerText || el.textContent;
        text = text.replace(/\n{3,}/g, '\n\n').trim();
        return text;
      }
    }
    return null;
  }

  function extractTestcases() {
    // Sample testcases are usually in pre blocks
    const testcases = [];
    const pres = document.querySelectorAll('pre');
    
    for (let i = 0; i < pres.length; i++) {
      const text = pres[i].textContent.trim();
      // Usually starts with "Input:"
      if (text.toLowerCase().includes('input:')) {
        testcases.push(text);
      }
    }
    return testcases;
  }

  /* ---------------------------------------------------------------- */
  /*  Language (DOM fallback — used alongside Monaco languageId)       */
  /* ---------------------------------------------------------------- */

  function extractLanguageFromDOM() {
    const selectors = [
      'button[class*="lang"] span',
      'button[class*="lang"]',
      'div[class*="lang-select"] button',
      '.ant-select-selection-item',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const txt = el.textContent.trim();
        if (txt) return txt;
      }
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /*  Monaco code via page-bridge                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Ask page-bridge.js (MAIN world) for the editor content.
   * Returns { code, languageId } or throws on timeout / error.
   */
  function requestEditorData() {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).slice(2);
      let settled = false;

      const onResponse = (e) => {
        if (e.detail?.requestId !== requestId) return;
        settled = true;
        document.removeEventListener('leetvault:response', onResponse);
        if (e.detail.error) {
          reject(new Error(e.detail.error));
        } else {
          resolve({
            code:       e.detail.code       ?? null,
            languageId: e.detail.languageId ?? null,
          });
        }
      };

      document.addEventListener('leetvault:response', onResponse);

      document.dispatchEvent(
        new CustomEvent('leetvault:request', {
          detail: { requestId, action: 'getEditorData' },
        }),
      );

      // Timeout — Monaco may not have loaded yet
      setTimeout(() => {
        if (!settled) {
          document.removeEventListener('leetvault:response', onResponse);
          reject(new Error('Page bridge timed out — Monaco may not be loaded.'));
        }
      }, 3000);
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Public: extract everything                                      */
  /* ---------------------------------------------------------------- */

  /**
   * Gather all problem data + code in one call.
   * This is what main.js calls when Run/Submit is clicked.
   *
   * @returns {Promise<{
   *   slug: string,
   *   problemNum: string,
   *   difficulty: string,
   *   tags: string[],
   *   code: string,
   *   languageId: string|null,
   *   languageDisplay: string|null
   * }>}
   */
  async function extractAll() {
    const slug = extractSlug();
    if (!slug) throw new Error('Could not determine problem slug from URL.');

    const editor = await requestEditorData();
    if (!editor.code) throw new Error('Could not read code from editor.');

    // Optional scraping (fail silently)
    let statusTag = null, description = null, testcases = [];
    try { statusTag = extractStatusTag(); } catch (e) {}
    try { description = extractDescription(); } catch (e) {}
    try { testcases = extractTestcases(); } catch (e) {}

    return {
      slug,
      problemNum:      extractProblemNumber(),
      difficulty:      extractDifficulty(),
      tags:            extractTags(),
      code:            editor.code,
      languageId:      editor.languageId,
      languageDisplay: extractLanguageFromDOM(),
      statusTag,
      description,
      testcases,
    };
  }

  // -- Expose API --
  return { extractSlug, extractAll };
})();
