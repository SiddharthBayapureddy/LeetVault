/**
 * LeetVault — Popup Script
 */
(() => {
  'use strict';

  /* ================================================================ */
  /*  IndexedDB
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
  /*  Default settings
  /* ================================================================ */

  const DEFAULT_SETTINGS = {
    orgMode:            'flat',
    includeStatusTag:   false,
    includeDescription: false
  };

  /* ================================================================ */
  /*  DOM references
  /* ================================================================ */

  const $  = (sel) => document.querySelector(sel);
  const el = {
    pickFolder:    $('#pick-folder-btn'),
    changeFolder:  $('#change-folder-btn'),
    reconnect:     $('#reconnect-btn'),
    folderEmpty:   $('#folder-empty'),
    folderActive:  $('#folder-active'),
    folderReconn:  $('#folder-reconnect'),
    folderPath:    $('#folder-path'),
    folderStatusBar: $('#folder-status-bar'),
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
    powerToggle:   $('#power-toggle'),
    powerToggleState: $('#power-toggle-state'),
    manualSaveBtn: $('#manual-save-btn'),
    inlineLog:     $('#inline-log'),
    titleEasterEgg: $('#title-easter-egg')
  };

  /* ================================================================ */
  /*  Settings helpers
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

  function applySettingsToUI(s) {
    el.orgMode.value          = s.orgMode;
    el.toggleStatus.checked   = s.includeStatusTag;
    el.toggleDesc.checked     = s.includeDescription;
    
    const isAutoSaveOn = s.autoSave !== false; // defaults to true
    el.powerToggle.setAttribute('aria-pressed', isAutoSaveOn ? 'true' : 'false');
    el.powerToggleState.textContent = isAutoSaveOn ? 'ON' : 'OFF';
  }

  function readSettingsFromUI() {
    return {
      autoSave:           el.powerToggle.getAttribute('aria-pressed') === 'true',
      orgMode:            el.orgMode.value,
      includeStatusTag:   el.toggleStatus.checked,
      includeDescription: el.toggleDesc.checked
    };
  }

  /* ================================================================ */
  /*  Folder picker
  /* ================================================================ */

  async function pickFolder() {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await saveDirectoryHandle(handle);
      showFolderActive(handle.name);
      snackbar('Folder selected');
    } catch (err) {
      if (err.name !== 'AbortError') {
        snackbar('Folder selection failed', true);
      }
    }
  }

  async function reconnectFolder() {
    const handle = await getDirectoryHandle();
    if (!handle) {
      return pickFolder();
    }
    try {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        showFolderActive(handle.name);
        snackbar('Reconnected');
      } else {
        snackbar('Permission denied', true);
      }
    } catch {
      snackbar('Reconnect failed', true);
    }
  }

  /* ================================================================ */
  /*  Folder UI states
  /* ================================================================ */

  function showFolderEmpty() {
    el.folderEmpty.hidden  = false;
    el.folderActive.hidden = true;
    el.folderReconn.hidden = true;
    el.folderStatusBar.textContent = "Not Connected";
    el.folderStatusBar.className = "status-bar__item mono";
  }

  function showFolderActive(name) {
    el.folderEmpty.hidden  = true;
    el.folderActive.hidden = false;
    el.folderReconn.hidden = true;
    el.folderPath.textContent = name;
    el.folderPath.title       = name;
    el.folderStatusBar.textContent = name;
    el.folderStatusBar.className = "status-bar__item mono text-easy";
  }

  function showFolderNeedsReconnect(name) {
    if (name) {
      el.folderEmpty.hidden  = true;
      el.folderActive.hidden = false;
      el.folderReconn.hidden = true;
      el.folderPath.textContent = name;
      el.folderPath.title       = name;
      el.folderStatusBar.textContent = "Access Expired";
      el.folderStatusBar.className = "status-bar__item mono text-error";
    } else {
      el.folderEmpty.hidden  = true;
      el.folderActive.hidden = true;
      el.folderReconn.hidden = false;
      el.folderStatusBar.textContent = "Access Expired";
      el.folderStatusBar.className = "status-bar__item mono text-error";
    }
  }

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
  /*  Manual Save
  /* ================================================================ */

  let activeTabId = null;

  async function checkActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('leetcode.com/problems/')) {
      el.manualSaveBtn.disabled = false;
      activeTabId = tab.id;
    } else {
      el.manualSaveBtn.disabled = true;
      activeTabId = null;
    }
  }

  async function handleManualSave() {
    if (!activeTabId) return;

    el.manualSaveBtn.disabled = true;
    el.manualSaveBtn.textContent = 'Saving...';

    try {
      const res = await chrome.tabs.sendMessage(activeTabId, { type: 'MANUAL_SAVE' });
      if (res && res.success) {
        el.manualSaveBtn.textContent = 'Saved';
      } else {
        const errMsg = res?.error || 'Unknown error';
        el.manualSaveBtn.textContent = 'Error';
        snackbar(`Save failed: ${errMsg}`, true);
      }
    } catch (err) {
      el.manualSaveBtn.textContent = 'Error';
      if (err.message.includes('Receiving end does not exist')) {
        snackbar('Error: refresh tab to update script', true);
      } else {
        snackbar(`Save failed: ${err.message}`, true);
      }
    }

    setTimeout(() => {
      el.manualSaveBtn.textContent = 'Save Now';
      el.manualSaveBtn.disabled = false;
    }, 1500);
  }

  /* ================================================================ */
  /*  Stats Animation
  /* ================================================================ */

  function animateValue(obj, start, end, duration) {
    if (start === end) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      obj.textContent = Math.floor(progress * (end - start) + start);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        obj.textContent = end;
      }
    };
    window.requestAnimationFrame(step);
  }

  /* ================================================================ */
  /*  Stats Logic
  /* ================================================================ */

  let oldStats = null;

  async function refreshStats(animate = false) {
    const result = await chrome.storage.local.get('stats');
    const stats = result.stats || { records: {}, solveDates: [] };
    const records = Object.values(stats.records || {});

    let total = 0, easy = 0, med = 0, hard = 0;
    for (const rec of records) {
      if (rec.firstAcceptedAt) {
        total++;
        if (rec.difficulty === 'Easy') easy++;
        else if (rec.difficulty === 'Medium') med++;
        else if (rec.difficulty === 'Hard') hard++;
      }
    }
    
    const streak = computeStreak(stats.solveDates || []);
    const streakStr = `${streak} Day Streak`;

    if (animate && oldStats) {
      animateValue(el.statTotal, oldStats.total, total, 500);
      animateValue(el.statEasy, oldStats.easy, easy, 500);
      animateValue(el.statMedium, oldStats.med, med, 500);
      animateValue(el.statHard, oldStats.hard, hard, 500);
      el.streakValue.textContent = streakStr;
    } else {
      el.statTotal.textContent  = total;
      el.statEasy.textContent   = easy;
      el.statMedium.textContent = med;
      el.statHard.textContent   = hard;
      el.streakValue.textContent = streakStr;
    }
    
    oldStats = { total, easy, med, hard, streak };
  }

  function computeStreak(dates) {
    if (!dates.length) return 0;
    const sorted = [...new Set(dates)].sort().reverse();
    const today     = isoToday();
    const yesterday = isoDay(-1);

    if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + 'T00:00:00');
      const curr = new Date(sorted[i]     + 'T00:00:00');
      const diffDays = Math.round((prev - curr) / 86400000);
      if (diffDays === 1) streak++;
      else break;
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

  /* ================================================================ */
  /*  Config export / import
  /* ================================================================ */

  async function exportConfig() {
    const settings = await loadSettings();
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'leetvault-config.json';
    a.click();
    URL.revokeObjectURL(url);
    snackbar('Config exported');
  }

  function importConfig() {
    el.importFile.click();
  }

  async function handleImportFile(file) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (typeof json !== 'object' || json === null) throw new Error('Invalid config');
      const merged = { ...DEFAULT_SETTINGS, ...json };
      const validModes = ['flat', 'difficulty', 'category', 'hybrid'];
      if (!validModes.includes(merged.orgMode)) merged.orgMode = 'flat';
      merged.includeStatusTag   = Boolean(merged.includeStatusTag);
      merged.includeDescription = Boolean(merged.includeDescription);
      await saveSettings(merged);
      applySettingsToUI(merged);
      snackbar('Config imported');
    } catch (err) {
      snackbar('Invalid config file', true);
    }
  }

  /* ================================================================ */
  /*  Stats download
  /* ================================================================ */

  async function downloadStats() {
    const result = await chrome.storage.local.get('stats');
    const stats  = result.stats || { records: {}, solveDates: [] };
    stats.exportedAt    = new Date().toISOString();
    stats.currentStreak = computeStreak(stats.solveDates || []);

    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'leetvault-stats.json';
    a.click();
    URL.revokeObjectURL(url);
    snackbar('Stats downloaded');
  }

  /* ================================================================ */
  /*  Snackbar
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
  /*  Event wiring
  /* ================================================================ */

  function bindEvents() {
    el.pickFolder.addEventListener('click',   pickFolder);
    el.changeFolder.addEventListener('click', pickFolder);
    el.reconnect.addEventListener('click',    reconnectFolder);
    el.manualSaveBtn.addEventListener('click', handleManualSave);

    el.powerToggle.addEventListener('click', async () => {
      const isPressed = el.powerToggle.getAttribute('aria-pressed') === 'true';
      el.powerToggle.setAttribute('aria-pressed', isPressed ? 'false' : 'true');
      el.powerToggleState.textContent = isPressed ? 'OFF' : 'ON';
      await persistSettings();
    });

    el.orgMode.addEventListener('change', persistSettings);
    el.toggleStatus.addEventListener('change', persistSettings);
    el.toggleDesc.addEventListener('change', persistSettings);

    el.exportBtn.addEventListener('click', exportConfig);
    el.importBtn.addEventListener('click', importConfig);
    el.importFile.addEventListener('change', (e) => {
      if (e.target.files[0]) handleImportFile(e.target.files[0]);
      e.target.value = '';
    });
    el.statsBtn.addEventListener('click', downloadStats);
    
    // Easter Eggs
    let hardHoverTimer;
    el.statHard.addEventListener('mouseenter', () => {
      hardHoverTimer = setTimeout(() => {
        el.statHard.classList.add('bleed-red');
        el.statHard.textContent = '#FF0000';
      }, 3000);
    });
    el.statHard.addEventListener('mouseleave', () => {
      clearTimeout(hardHoverTimer);
      el.statHard.classList.remove('bleed-red');
      // Only refresh value if it was changed
      if (el.statHard.textContent === '#FF0000') {
        refreshStats(false);
      }
    });

    let titleClicks = 0;
    let titleClickTimer;
    el.titleEasterEgg.addEventListener('click', () => {
      titleClicks++;
      clearTimeout(titleClickTimer);
      if (titleClicks >= 5) {
        document.body.classList.toggle('sudo-mode');
        titleClicks = 0;
      }
      titleClickTimer = setTimeout(() => { titleClicks = 0; }, 1000);
    });
  }

  async function persistSettings() {
    const settings = readSettingsFromUI();
    await saveSettings(settings);
  }

  /* ================================================================ */
  /*  Live Logging
  /* ================================================================ */

  let inlineLogTimer = null;
  function showInlineLog(slug) {
    clearTimeout(inlineLogTimer);
    el.inlineLog.textContent = `Saved ${slug}`;
    el.inlineLog.classList.add('visible');
    inlineLogTimer = setTimeout(() => {
      el.inlineLog.classList.remove('visible');
    }, 2000);
  }

  function handleStorageChange(changes) {
    if (changes.stats) {
      refreshStats(true);
      
      const oldVal = changes.stats.oldValue || { records: {} };
      const newVal = changes.stats.newValue || { records: {} };
      
      for (const slug of Object.keys(newVal.records)) {
        const newRec = newVal.records[slug];
        const oldRec = oldVal.records[slug];
        
        if (!oldRec || newRec.attempts.length > oldRec.attempts.length) {
          const latestAttempt = newRec.attempts[newRec.attempts.length - 1];
          if (latestAttempt.action === 'submit' && latestAttempt.result === 'Accepted') {
            showInlineLog(slug);
            break;
          }
        }
      }
    }
  }

  /* ================================================================ */
  /*  Init
  /* ================================================================ */

  async function init() {
    const settings = await loadSettings();
    applySettingsToUI(settings);
    bindEvents();
    await refreshFolderState();
    await refreshStats(false);
    await checkActiveTab();
    
    chrome.storage.onChanged.addListener(handleStorageChange);
  }

  init().catch((err) => console.error('[LeetVault] Popup init error:', err));
})();
