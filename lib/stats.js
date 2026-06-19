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
export async function recordAttempt(data, attemptMeta) {
  try {
    const result = await chrome.storage.local.get('stats');
    const stats  = result.stats || { records: {}, solveDates: [] };
    if (!stats.records) stats.records = {};

    const slug = data.slug;
    if (!stats.records[slug]) {
      stats.records[slug] = {
        problemSlug: slug,
        difficulty: data.difficulty || 'Unknown',
        attempts: [],
        firstAcceptedAt: null,
        savedToDisk: false
      };
    }

    const rec = stats.records[slug];
    const action = attemptMeta?.action || 'manual';
    const outcome = attemptMeta?.result || 'Unknown';

    rec.attempts.push({
      timestamp: Date.now(),
      result: outcome,
      action: action
    });

    if (action === 'submit' && outcome === 'Accepted') {
      if (!rec.firstAcceptedAt) {
        rec.firstAcceptedAt = Date.now();
      }
    }
    
    if (attemptMeta?.savedToDisk) {
      rec.savedToDisk = true;
    }

    // Always count activity towards the streak
    if (!stats.solveDates) stats.solveDates = [];
    const today = new Date().toISOString().slice(0, 10);
    if (!stats.solveDates.includes(today)) {
      stats.solveDates.push(today);
    }

    await chrome.storage.local.set({ stats });
  } catch (err) {
    console.warn('[LeetVault] Stats update failed:', err);
  }
}
