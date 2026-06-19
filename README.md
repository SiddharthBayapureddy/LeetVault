# LeetVault

LeetVault is a privacy-first, local-only Chrome extension that automatically saves your accepted LeetCode submissions directly to your local file system.

No cloud syncs, no external APIs, no OAuth. Just your code, safely vaulted on your machine exactly the way you want it.

## 🚀 Features

- **True Local Storage:** Leverages the native HTML5 File System Access API to save files directly to a folder on your computer.
- **Zero-Guessing Network Interception:** Silently intercepts LeetCode's `/check/` submission endpoint to guarantee 100% accuracy. It only auto-saves when a submission is explicitly marked as "Accepted".
- **Rich Audit Ledger:** Maintains a persistent local record of your stats, keeping track of every run, attempt, and accepted submission.
- **Context Extraction:** Automatically pulls your code straight out of the Monaco editor, alongside the problem description, difficulty, and tags.
- **Custom Organization:** Save files precisely how you want them:
  - `Flat`: Everything in one folder.
  - `By Difficulty`: Folders for Easy, Medium, Hard.
  - `By Category`: Folders organized by the primary problem tag.
  - `Hybrid`: `Category/Difficulty/problem.ext`
- **Comment Headers:** Optionally inject the full problem description and sample test cases as a formatted comment block at the top of your saved file.
- **Status Tags:** Optionally append the exact execution outcome directly to the filename (e.g. `two-sum_AC.py`, `two-sum_WA.py`).
- **Refined Developer Aesthetic:** A premium, high-density popup UI built for developers, complete with hidden easter eggs.

## 🛠️ Installation

1. Clone or download this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the folder containing this repository.
5. Pin the LeetVault extension to your toolbar.

## ⚙️ How to Use

1. Click the LeetVault extension icon.
2. Click **[ Choose Directory ]** and select the local folder where you want your solutions backed up. Chrome will ask for permission to edit files in this folder.
3. Solve a problem on LeetCode.
4. Once you click **Submit** and your code passes (Accepted), LeetVault will automatically extract the code and save it to your folder.
5. You can also use the **Save Now** button in the popup to manually force a save regardless of the submission outcome.

## 🔐 Permissions Explained

- `activeTab`: Used to trigger manual saves securely on the tab you are currently viewing.
- `storage`: Used to persist your configuration settings and ledger stats across sessions.
- `scripting`: Used to inject the extraction logic directly into the LeetCode environment.

## 🏗️ Architecture

LeetVault uses a three-tier architecture to securely bridge the gap between LeetCode's Single Page Application and your local filesystem:
- **Main World (`page-bridge.js`):** Intercepts network calls to LeetCode's API and safely accesses the `window.monaco` editor instance to pull exact code values without DOM hacking.
- **Isolated World (`main.js`, `observer.js`, `extractor.js`):** Orchestrates saving logic, monitors button clicks, and parses the DOM for problem descriptions and metadata.
- **Service Worker (`service-worker.js`):** Runs persistently in the background to handle file system operations using the File System Access API handle.

## 📝 License
MIT License
