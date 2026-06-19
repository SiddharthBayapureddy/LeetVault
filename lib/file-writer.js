/**
 * LeetVault — File Writer  (ES module)
 *
 * Builds filenames and subdirectory paths, then writes solution files
 * to the user's local directory via the File System Access API.
 */

import { LANG_EXT_MAP, STATUS_TAGS, ORG_MODES, COMMENT_SYNTAX } from './constants.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Resolve a language identifier to a file extension.
 * Tries the Monaco language ID first, then the display name from the DOM.
 *
 * @param {string|null} languageId    — Monaco model language ID (e.g. "cpp")
 * @param {string|null} languageDisplay — UI dropdown label (e.g. "C++")
 * @returns {string} file extension without the dot
 */
export function resolveExtension(languageId, languageDisplay) {
  if (languageId) {
    const ext = LANG_EXT_MAP[languageId.toLowerCase()];
    if (ext) return ext;
  }
  if (languageDisplay) {
    const ext = LANG_EXT_MAP[languageDisplay.toLowerCase()];
    if (ext) return ext;
  }
  // Last resort — use the raw identifier lowercased, or "txt"
  return (languageId || languageDisplay || 'txt').toLowerCase();
}

/**
 * Build the filename for a solution.
 *
 * Pattern:  {number}-{slug}[_{STATUS}].{ext}
 * Example:  1-two-sum.cpp  or  1-two-sum_AC.cpp
 */
export function buildFilename(problemNum, slug, ext, statusTag, includeStatus) {
  let base = `${problemNum}-${slug}`;
  if (includeStatus && statusTag) {
    const short = STATUS_TAGS[statusTag];
    if (short) base += `_${short}`;
  }
  return `${base}.${ext}`;
}

/**
 * Compute subdirectory segments for the chosen organisation mode.
 *
 * @returns {string[]} e.g. [] | ["Easy"] | ["Array"] | ["Array","Easy"]
 */
export function getSubdirSegments(orgMode, difficulty, tags) {
  const sanitise = (s) => (s || '').replace(/\s+/g, '-') || 'Uncategorized';

  switch (orgMode) {
    case ORG_MODES.DIFFICULTY:
      return [difficulty || 'Unknown'];

    case ORG_MODES.CATEGORY:
      return [sanitise(tags?.[0])];

    case ORG_MODES.HYBRID:
      return [sanitise(tags?.[0]), difficulty || 'Unknown'];

    case ORG_MODES.FLAT:
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Core writer                                                       */
/* ------------------------------------------------------------------ */

/**
 * Build a language-specific comment header containing the description and testcases.
 */
function buildCommentHeader(ext, description, testcases) {
  if (!description && (!testcases || testcases.length === 0)) return '';
  
  const syntax = COMMENT_SYNTAX[ext];
  if (!syntax) return ''; // Unknown comment syntax

  let header = '';

  if (syntax.blockStart && syntax.blockEnd) {
    header += `${syntax.blockStart}\n`;
    if (description) {
      header += `${description}\n`;
    }
    if (testcases && testcases.length > 0) {
      if (description) header += '\n';
      header += testcases.join('\n\n') + '\n';
    }
    header += `${syntax.blockEnd}\n\n`;
  } else {
    // Fallback to line comments
    const lines = [];
    if (description) lines.push(...description.split('\n'));
    if (testcases && testcases.length > 0) {
      if (description) lines.push('');
      for (const tc of testcases) {
        lines.push(...tc.split('\n'));
      }
    }
    header = lines.map(line => `${syntax.line} ${line}`).join('\n') + '\n\n';
  }

  return header;
}

/**
 * Ensure all subdirectories in `segments` exist under `rootHandle`.
 * @returns {FileSystemDirectoryHandle} deepest directory handle
 */
async function ensureSubdirs(rootHandle, segments) {
  let dir = rootHandle;
  for (const name of segments) {
    dir = await dir.getDirectoryHandle(name, { create: true });
  }
  return dir;
}

/**
 * Write a solution file to the user's chosen local directory.
 *
 * @param {FileSystemDirectoryHandle} rootHandle
 * @param {object} data      — problem data forwarded by the content-script
 * @param {object} settings  — user settings from chrome.storage.local
 * @returns {Promise<{filename: string, fullPath: string}>}
 */
export async function writeSolutionFile(rootHandle, data, settings) {
  const ext      = resolveExtension(data.languageId, data.languageDisplay);
  const filename = buildFilename(
    data.problemNum,
    data.slug,
    ext,
    data.statusTag ?? null,
    settings.includeStatusTag,
  );

  const segments  = getSubdirSegments(settings.orgMode, data.difficulty, data.tags);
  const dirHandle = await ensureSubdirs(rootHandle, segments);

  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable   = await fileHandle.createWritable();
  
  let finalCode = data.code;
  if (settings.includeDescription) {
    const header = buildCommentHeader(ext, data.description, data.testcases);
    finalCode = header + finalCode;
  }
  
  await writable.write(finalCode);
  await writable.close();

  const fullPath = [...segments, filename].join('/') || filename;
  return { filename, fullPath };
}
