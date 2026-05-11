import { useEffect, useRef, useState, useCallback } from 'react';
import { BUFFER_TAIL_CAP, debouncedSaver, loadJSON } from './persist.js';

const MAX_BUFFER = 1000;
const BUFFER_KEY = 'nettest.buffers.v1';

// Hydrate persisted buffers up-front so the hex viewer shows the last session's
// tail immediately on mount. Stored shape: { [connId]: Array<{ bytes: number[], tms, dir, seq }> }
function loadInitialBuffers() {
  const raw = loadJSON(BUFFER_KEY, null);
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const id in raw) {
    const arr = raw[id];
    if (!Array.isArray(arr)) continue;
    out[id] = arr.map((p) => ({
      bytes: Uint8Array.from(p.bytes || []),
      tms: p.tms || 0,
      dir: p.dir || 'rx',
      seq: p.seq || 0,
    }));
  }
  return out;
}

const saveBuffersDebounced = debouncedSaver(BUFFER_KEY, 2000);

function bufferToPersist(buffers) {
  const out = {};
  for (const id in buffers) {
    const tail = buffers[id].slice(-BUFFER_TAIL_CAP);
    out[id] = tail.map((p) => ({
      // Uint8Array → plain array so JSON.stringify works.
      bytes: Array.from(p.bytes),
      tms: p.tms,
      dir: p.dir,
      seq: p.seq,
    }));
  }
  return out;
}

export function useConnections() {
  const [conns, setConns] = useState([]);
  const [buffers, setBuffers] = useState(loadInitialBuffers);
  const [rateByConn, setRateByConn] = useState({});
  const rxRef = useRef({}); // { id: { bytes, lastTs } }

  // Persist whenever buffers change (debounced).
  useEffect(() => { saveBuffersDebounced(bufferToPersist(buffers)); }, [buffers]);

  // Initial load + subscribe to events
  useEffect(() => {
    let cancelled = false;
    window.nettest.listConnections().then((list) => {
      if (cancelled) return;
      setConns(list);
      // Merge: keep persisted buffers for existing connections, drop those
      // whose connection has been deleted, ensure all known connections have
      // a (possibly empty) slot.
      setBuffers((prev) => {
        const next = {};
        for (const c of list) next[c.id] = prev[c.id] || [];
        return next;
      });
    });

    const offPkt = window.nettest.onPacket(({ id, bytes, tms, dir }) => {
      const u8 = Uint8Array.from(bytes);
      setBuffers((prev) => {
        const arr = prev[id] || [];
        const seq = u8.length >= 6 ? (u8[5] << 8) | u8[4] : 0;
        const item = { bytes: u8, tms, dir, seq };
        const next = arr.length >= MAX_BUFFER ? arr.slice(-MAX_BUFFER + 1) : arr.slice();
        next.push(item);
        return { ...prev, [id]: next };
      });
      const r = (rxRef.current[id] = rxRef.current[id] || { bytes: 0, lastTs: performance.now() });
      r.bytes += u8.length;
    });

    const offState = window.nettest.onState((conn) => {
      setConns((prev) => {
        const idx = prev.findIndex((c) => c.id === conn.id);
        if (idx < 0) return [...prev, conn];
        const next = prev.slice();
        next[idx] = { ...next[idx], ...conn };
        return next;
      });
    });

    const offRemoved = window.nettest.onRemoved(({ id }) => {
      setConns((prev) => prev.filter((c) => c.id !== id));
      setBuffers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });

    const offClear = window.nettest.onClear(({ id }) => {
      setBuffers((prev) => ({ ...prev, [id]: [] }));
    });

    return () => {
      cancelled = true;
      offPkt && offPkt();
      offState && offState();
      offRemoved && offRemoved();
      offClear && offClear();
    };
  }, []);

  // Rate ticker — calculates B/s per connection
  useEffect(() => {
    const i = setInterval(() => {
      const now = performance.now();
      const out = {};
      for (const c of conns) {
        const r = rxRef.current[c.id];
        if (!r) { out[c.id] = 0; continue; }
        const dt = (now - r.lastTs) / 1000;
        out[c.id] = dt > 0 ? Math.round(r.bytes / dt) : 0;
        r.bytes = 0;
        r.lastTs = now;
      }
      setRateByConn(out);
    }, 800);
    return () => clearInterval(i);
  }, [conns]);

  const startConn = useCallback(async (id) => {
    try { await window.nettest.startConnection(id); }
    catch (e) { console.error('start failed', e); }
  }, []);

  const stopConn = useCallback(async (id) => {
    try { await window.nettest.stopConnection(id); } catch {}
  }, []);

  const toggleStream = useCallback(async (id) => {
    const c = conns.find((x) => x.id === id);
    if (!c) return;
    if (c.streaming) await stopConn(id);
    else await startConn(id);
  }, [conns, startConn, stopConn]);

  const addConn = useCallback(async () => {
    const created = await window.nettest.createConnection({
      name: 'New connection', proto: 'UDP', role: 'server',
      bind: '0.0.0.0:0', endpoint: 'udp://0.0.0.0:0', color: '#71717a',
    });
    setBuffers((prev) => ({ ...prev, [created.id]: [] }));
    return created;
  }, []);

  const removeConn = useCallback(async (id) => {
    await window.nettest.removeConnection(id);
  }, []);

  const updateConn = useCallback(async (id, patch) => {
    await window.nettest.updateConnection(id, patch);
  }, []);

  const sendBytes = useCallback(async (id, bytes) => {
    try { await window.nettest.sendBytes(id, bytes); }
    catch (e) {
      console.error('send failed:', e.message);
      throw e;
    }
  }, []);

  const clearBuffer = useCallback((id) => {
    setBuffers((prev) => ({ ...prev, [id]: [] }));
  }, []);

  return {
    conns, buffers, rateByConn,
    startConn, stopConn, toggleStream,
    addConn, removeConn, updateConn,
    sendBytes, clearBuffer,
  };
}
