/**
 * LeetVault — Stats Tracker  (ES module)
 *
 * Lightweight helpers that maintain running solve statistics in
 * chrome.storage.local.  Updated on every successful save.
 */

/**
 * Increment stats after a successful file write.
 *
 * Stats shape stored in chrome.storage.local under key "stats":
 * {
 *   totalSaved:    number,
 *   byDifficulty:  { Easy: n, Medium: n, Hard: n, Unknown: n },
 *   solveDates:    [ "2026-06-19", ... ]   // unique ISO date strings
 * }
 */
export async function recordSave(data) {
  try {
    const result = await chrome.storage.local.get('stats');
    const stats  = result.stats || {
      totalSaved:   0,
      byDifficulty: {},
      solveDates:   [],
    };

    stats.totalSaved += 1;

    const diff = data.difficulty || 'Unknown';
    stats.byDifficulty[diff] = (stats.byDifficulty[diff] || 0) + 1;

    const today = new Date().toISOString().slice(0, 10);
    if (!stats.solveDates.includes(today)) {
      stats.solveDates.push(today);
    }

    await chrome.storage.local.set({ stats });
  } catch (err) {
    // Stats are non-critical — log and continue
    console.warn('[LeetVault] Stats update failed:', err);
  }
}
