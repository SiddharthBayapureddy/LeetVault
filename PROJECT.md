# Project: LeetCode Local Backup Extension

## Overview

A Chromium-based (Manifest V3) browser extension that automatically saves a user's LeetCode solution to a local file on their machine whenever they click "Run". No backend, no cloud, no external API calls. All data stays on the user's device.

## Tech Stack

- Manifest V3
- Vanilla JavaScript (no frameworks, no bundler/build step)
- File System Access API (local directory read/write)
- IndexedDB (persist directory handle across sessions)
- chrome.storage.local (user settings/preferences)
- Plain HTML/CSS for popup UI

## Target Site

`leetcode.com/problems/*` — content script injection. Editor is Monaco-based; hook into Monaco's model to read current code content and detected language.

---

## Core Behavior

### Save Trigger

- **Only save on "Run" button click** (not on every keystroke, not on idle/debounce). One save per Run click.
- Do NOT save on Submit separately unless Run wasn't already clicked — Submit should also count as a trigger if Run wasn't pressed first this session. Keep logic simple: any code-execution action (Run or Submit) on the page triggers a save attempt.

### File Naming & Multi-language Support

- Each problem+language combination is a **separate file** — never overwrite across languages.
- Base pattern: `{number}-{title-slug}.{ext}`
- Example: `1-two-sum.cpp`, `1-two-sum.py` (both persist independently if solved in both languages)

### Optional Status Tag in Filename

- Setting: "Include submission status in filename" (on/off, default off)
- When on: detect Run/Submit result (Accepted / Wrong Answer / Runtime Error / etc. — read from LeetCode's result panel DOM) and append short tag.
- Example: `1-two-sum_AC.cpp`, `1-two-sum_WA.cpp`
- If result is ambiguous/not yet available at save time, fall back to no tag rather than guessing.

### Folder Organization (user-selectable in settings)

Provide a dropdown with 4 modes:

1. **By difficulty** → `Easy/`, `Medium/`, `Hard/`
2. **By category/tag** → `Array/`, `Dynamic-Programming/`, `Graph/`, etc. (scrape tags from problem page DOM; if tag is premium-gated/unavailable, fallback to `Uncategorized/`)
3. **Flat** → no subfolders, all files in root
4. **Hybrid** → `{category}/{difficulty}/{file}`

Note: switching modes mid-use does NOT retroactively reorganize existing files. Document this as a known limitation in the README — do not attempt auto-migration.

### Problem Description & Testcases as Comment Header (optional, toggle in settings)

- Setting: "Include problem description + sample testcases as comment header" (on/off, default off)
- When on: scrape problem description text and sample testcases from the DOM, strip HTML, format as a comment block at the top of the saved file using correct comment syntax per language (`//` for cpp/java/js, `#` for python).
- Keep this scrape resilient but accept it may break if LeetCode changes DOM structure — wrap in try/catch, fail silently (skip header, still save code) rather than blocking the save.

### Directory Setup

- On first use, prompt user via `showDirectoryPicker()` to choose a local backup folder.
- Persist the directory handle in IndexedDB so it survives extension reloads/browser restarts.
- Handle permission re-prompts gracefully (File System Access may require re-grant on some browser sessions) — detect and show a clear "Reconnect folder" UI state rather than failing silently.

---

## Settings (Popup UI)

Build a small popup (HTML/CSS, vanilla JS) with:

- Folder picker / reconnect button
- Organization mode dropdown (difficulty / category / flat / hybrid)
- Toggle: include status tag in filename
- Toggle: include problem description + testcases as comment header
- Theme toggle: dark / light mode (persist choice in chrome.storage.local, default to system preference)
- "Export settings" button → downloads current config as `config.json`
- "Import settings" button → file picker to load a `config.json` and apply it
- "Download stats" button (see Stats below)

### Settings Export/Import (config.json)

- Export current settings (organization mode, toggles, theme) as a downloadable JSON file — NOT the directory handle itself (handles can't be serialized; user must re-pick folder after import on a new machine).
- Import should validate the JSON shape before applying; reject malformed files with a clear error, don't crash.

### Stats / Streak Tracking

- Maintain a running stats object in chrome.storage.local, updated on every successful save: total problems solved, breakdown by difficulty, solve dates (for streak calculation).
- Do NOT auto-write a stats file to disk on every save (avoid disk spam).
- Instead, provide a "Download stats" button in the popup that generates and downloads a `stats.json` (or `stats.md`) snapshot on demand, reflecting current totals.

---

## Explicit Out-of-Scope (do not build)

- No cloud sync, no account/login, no external server calls of any kind
- No LLM integration / no auto-generated `main()` functions or test harnesses
- No automatic file reorganization when settings change
- No support for Firefox/Safari (File System Access API is Chromium-only — acceptable limitation, document it)

## Known Limitations to Document in README

- Chromium-only browsers (Chrome, Edge, Brave)
- DOM scraping (tags, description, status) depends on LeetCode's current page structure and may break on site updates
- Changing folder-organization mode does not move previously saved files

## Acceptance Criteria

- [ ] Clicking Run on a problem saves the current code to the chosen local folder
- [ ] Same problem solved in 2 different languages produces 2 separate files
- [ ] Folder structure matches the selected organization mode
- [ ] Status tag appears in filename only when the toggle is enabled
- [ ] Comment header (description + testcases) appears only when the toggle is enabled
- [ ] Settings can be exported and re-imported correctly
- [ ] Stats can be downloaded on demand and reflect accurate counts
- [ ] Popup supports dark and light mode
- [ ] Directory permission loss is detected and surfaced to the user with a clear reconnect action
