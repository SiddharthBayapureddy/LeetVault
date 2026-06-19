/**
 * LeetVault — Popup Script
 *
 * Handles:
 *  • Folder picker / reconnect (File System Access API + IndexedDB)
 *  • Settings persistence (chrome.storage.local)
 *  • Theme toggle (dark / light / system)
 *  • Stats display
 *  • Config export / import
 *  • Stats download
 *
 * The popup shares the extension's origin so it can access the same
 * IndexedDB that the service-worker uses for the directory handle.
 */
(() => {
  'use strict';

  /* ================================================================ */
  /*  IndexedDB — duplicated from lib/storage.js because the popup    */
  /*  loads as a classic script (not an ES module)                     */
  /* ================================================================ */

  const DB_NAME    = 'LeetVaultDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'handles';
  const HANDLE_KEY = 'rootDirectory';

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

  async function saveDirectoryHandle(handle) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  async function getDirectoryHandle() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  }

  /* ================================================================ */
  /*  Default settings (must match lib/constants.js)                  */
  /* ================================================================ */

  const DEFAULT_SETTINGS = {
    orgMode:            'flat',
    includeStatusTag:   false,
    includeDescription: false,
    theme:              'system',
  };

  /* ================================================================ */
  /*  DOM references                                                  */
  /* ================================================================ */

  const $  = (sel) => document.querySelector(sel);
  const el = {
    themeToggle:   $('#theme-toggle'),
    pickFolder:    $('#pick-folder-btn'),
    changeFolder:  $('#change-folder-btn'),
    reconnect:     $('#reconnect-btn'),
    folderEmpty:   $('#folder-empty'),
    folderActive:  $('#folder-active'),
    folderReconn:  $('#folder-reconnect'),
    folderPath:    $('#folder-path'),
    badgeOk:       $('#folder-badge-ok'),
    badgeWarn:     $('#folder-badge-warn'),
    orgMode:       $('#org-mode'),
    toggleStatus:  $('#toggle-status'),
    toggleDesc:    $('#toggle-desc'),
    exportBtn:     $('#export-btn'),
    importBtn:     $('#import-btn'),
    importFile:    $('#import-file'),
    statsBtn:      $('#stats-btn'),
    statTotal:     $('#stat-total'),
    statEasy:      $('#stat-easy'),
    statMedium:    $('#stat-medium'),
    statHard:      $('#stat-hard'),
    streakValue:   $('#streak-value'),
    snackbar:      $('#snackbar'),
  };

  /* ================================================================ */
  /*  Settings helpers                                                */
  /* ================================================================ */

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('settings', (r) => {
        resolve({ ...DEFAULT_SETTINGS, ...(r.settings || {}) });
      });
    });
  }

  async function saveSettings(settings) {
    return chrome.storage.local.set({ settings });
  }

  /** Apply settings object to the UI controls. */
  function applySettingsToUI(s) {
    el.orgMode.value          = s.orgMode;
    el.toggleStatus.checked   = s.includeStatusTag;
    el.toggleDesc.checked     = s.includeDescription;
    applyTheme(s.theme);
  }

  /** Read current UI control values into a settings object. */
  function readSettingsFromUI() {
    return {
      orgMode:            el.orgMode.value,
      includeStatusTag:   el.toggleStatus.checked,
      includeDescription: el.toggleDesc.checked,
      theme:              document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
    };
  }

  /* ================================================================ */
  /*  Theme                                                           */
  /* ================================================================ */

  function applyTheme(theme) {
    let resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    }
    document.documentElement.dataset.theme = resolved;
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    // Persist
    const settings = readSettingsFromUI();
    settings.theme = next;
    saveSettings(settings);
  }

  /* ================================================================ */
  /*  Folder picker                                                   */
  /* ================================================================ */

  async function pickFolder() {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await saveDirectoryHandle(handle);
      showFolderActive(handle.name);
      snackbar('Folder selected ✓');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[LeetVault] Folder pick failed:', err);
        snackbar('Folder selection failed', true);
      }
    }
  }

  async function reconnectFolder() {
    const handle = await getDirectoryHandle();
    if (!handle) {
      // No handle at all — treat like a fresh pick
      return pickFolder();
    }
    try {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        showFolderActive(handle.name);
        snackbar('Reconnected ✓');
      } else {
        snackbar('Permission denied — try again', true);
      }
    } catch {
      snackbar('Reconnect failed — try choosing a new folder', true);
    }
  }

  /* ================================================================ */
  /*  Folder UI states                                                */
  /* ================================================================ */

  function showFolderEmpty() {
    el.folderEmpty.hidden  = false;
    el.folderActive.hidden = true;
    el.folderReconn.hidden = true;
  }

  function showFolderActive(name) {
    el.folderEmpty.hidden  = true;
    el.folderActive.hidden = false;
    el.folderReconn.hidden = true;
    el.folderPath.textContent = name;
    el.folderPath.title       = name;
    el.badgeOk.hidden   = false;
    el.badgeWarn.hidden  = true;
  }

  function showFolderNeedsReconnect(name) {
    if (name) {
      // Show the active state but with a warning badge
      el.folderEmpty.hidden  = true;
      el.folderActive.hidden = false;
      el.folderReconn.hidden = true;
      el.folderPath.textContent = name;
      el.folderPath.title       = name;
      el.badgeOk.hidden   = true;
      el.badgeWarn.hidden  = false;
    } else {
      el.folderEmpty.hidden  = true;
      el.folderActive.hidden = true;
      el.folderReconn.hidden = false;
    }
  }

  /** Probe the stored handle and set the correct folder UI state. */
  async function refreshFolderState() {
    try {
      const handle = await getDirectoryHandle();
      if (!handle) return showFolderEmpty();

      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        showFolderActive(handle.name);
      } else {
        showFolderNeedsReconnect(handle.name);
      }
    } catch {
      showFolderEmpty();
    }
  }

  /* ================================================================ */
  /*  Stats                                                           */
  /* ================================================================ */

  async function refreshStats() {
    const result = await chrome.storage.local.get('stats');
    const stats  = result.stats || { totalSaved: 0, byDifficulty: {}, solveDates: [] };

    el.statTotal.textContent  = stats.totalSaved;
    el.statEasy.textContent   = stats.byDifficulty.Easy   || 0;
    el.statMedium.textContent = stats.byDifficulty.Medium || 0;
    el.statHard.textContent   = stats.byDifficulty.Hard   || 0;

    const streak = computeStreak(stats.solveDates || []);
    el.streakValue.textContent = `${streak}-day streak`;
  }

  /**
   * Compute the current consecutive-day streak ending today (or yesterday).
   */
  function computeStreak(dates) {
    if (!dates.length) return 0;

    const sorted = [...new Set(dates)].sort().reverse(); // newest first
    const today     = isoToday();
    const yesterday = isoDay(-1);

    // Streak must include today or yesterday to count
    if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const expected = isoDay(-daysBetween(today, sorted[0]) - i);
      // Simpler: check consecutive by diffing adjacent entries
      const prev = new Date(sorted[i - 1] + 'T00:00:00');
      const curr = new Date(sorted[i]     + 'T00:00:00');
      const diffDays = Math.round((prev - curr) / 86400000);
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  function isoToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function isoDay(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  }

  function daysBetween(a, b) {
    return Math.round(
      (new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000,
    );
  }

  /* ================================================================ */
  /*  Config export / import                                          */
  /* ================================================================ */

  async function exportConfig() {
    const settings = await loadSettings();
    // Strip theme resolution — export raw value
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'leetvault-config.json';
    a.click();
    URL.revokeObjectURL(url);
    snackbar('Config exported ✓');
  }

  function importConfig() {
    el.importFile.click();
  }

  async function handleImportFile(file) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Validate shape
      const valid = typeof json === 'object' && json !== null;
      if (!valid) throw new Error('Invalid config file');

      const merged = { ...DEFAULT_SETTINGS, ...json };

      // Validate orgMode
      const validModes = ['flat', 'difficulty', 'category', 'hybrid'];
      if (!validModes.includes(merged.orgMode)) merged.orgMode = 'flat';

      // Coerce booleans
      merged.includeStatusTag   = Boolean(merged.includeStatusTag);
      merged.includeDescription = Boolean(merged.includeDescription);

      await saveSettings(merged);
      applySettingsToUI(merged);
      snackbar('Config imported ✓');
    } catch (err) {
      console.error('[LeetVault] Import error:', err);
      snackbar('Invalid config file', true);
    }
  }

  /* ================================================================ */
  /*  Stats download                                                  */
  /* ================================================================ */

  async function downloadStats() {
    const result = await chrome.storage.local.get('stats');
    const stats  = result.stats || { totalSaved: 0, byDifficulty: {}, solveDates: [] };

    stats.exportedAt    = new Date().toISOString();
    stats.currentStreak = computeStreak(stats.solveDates || []);

    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'leetvault-stats.json';
    a.click();
    URL.revokeObjectURL(url);
    snackbar('Stats downloaded ✓');
  }

  /* ================================================================ */
  /*  Snackbar                                                        */
  /* ================================================================ */

  let snackbarTimer = null;

  function snackbar(msg, isError = false) {
    clearTimeout(snackbarTimer);
    el.snackbar.textContent = msg;
    el.snackbar.className   = isError
      ? 'snackbar snackbar--visible snackbar--error'
      : 'snackbar snackbar--visible';

    snackbarTimer = setTimeout(() => {
      el.snackbar.classList.remove('snackbar--visible');
    }, 2500);
  }

  /* ================================================================ */
  /*  Event wiring                                                    */
  /* ================================================================ */

  function bindEvents() {
    // Theme
    el.themeToggle.addEventListener('click', toggleTheme);

    // Folder
    el.pickFolder.addEventListener('click',   pickFolder);
    el.changeFolder.addEventListener('click', pickFolder);
    el.reconnect.addEventListener('click',    reconnectFolder);

    // Settings — persist on every change
    el.orgMode.addEventListener('change', persistSettings);
    el.toggleStatus.addEventListener('change', persistSettings);
    el.toggleDesc.addEventListener('change', persistSettings);

    // Config
    el.exportBtn.addEventListener('click', exportConfig);
    el.importBtn.addEventListener('click', importConfig);
    el.importFile.addEventListener('change', (e) => {
      if (e.target.files[0]) handleImportFile(e.target.files[0]);
      e.target.value = '';   // reset so the same file can be re-imported
    });

    // Stats download
    el.statsBtn.addEventListener('click', downloadStats);
  }

  async function persistSettings() {
    const settings = readSettingsFromUI();
    await saveSettings(settings);
  }

  /* ================================================================ */
  /*  Init                                                            */
  /* ================================================================ */

  async function init() {
    const settings = await loadSettings();
    applySettingsToUI(settings);
    bindEvents();
    await refreshFolderState();
    await refreshStats();
  }

  init().catch((err) => console.error('[LeetVault] Popup init error:', err));
})();
