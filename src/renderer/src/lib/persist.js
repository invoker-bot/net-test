// Tiny localStorage helpers with versioned keys and debounced writes.

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // QuotaExceededError or similar — best-effort, don't crash the app.
    console.warn('persist: save failed for', key, e?.message);
  }
}

// Debounce a writer so frequent updates don't thrash localStorage.
// The returned function carries a `.flush()` method to force-write any
// pending value synchronously (call this on beforeunload).
export function debouncedSaver(key, delay = 800) {
  let t = null;
  let latest = null;
  let pending = false;
  const write = (value) => {
    latest = value;
    pending = true;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      if (pending) {
        saveJSON(key, latest);
        pending = false;
      }
    }, delay);
  };
  write.flush = () => {
    if (t) { clearTimeout(t); t = null; }
    if (pending) { saveJSON(key, latest); pending = false; }
  };
  _flushers.add(write);
  return write;
}

const _flushers = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const fn of _flushers) {
      try { fn.flush(); } catch {}
    }
  });
}

// Restrict packet buffer persistence to a tail so we don't blow past
// localStorage's ~5 MB quota with binary data encoded as JSON arrays.
export const BUFFER_TAIL_CAP = 200;
