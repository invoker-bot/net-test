import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from './lib/utils.js';
import { EMPTY_STRUCT, decodeField, isNumericLike } from './lib/parser.js';
import { cloneStructForUse, embedPresetInto, useStructLibrary } from './lib/struct-library.js';
import { useConnections } from './lib/use-connections.js';
import { debouncedSaver, loadJSON } from './lib/persist.js';

const STRUCTS_KEY = 'nettest.structsByConn.v1';
const saveStructsDebounced = debouncedSaver(STRUCTS_KEY, 600);
import { ConnectionsPanel } from './components/ConnectionsPanel.jsx';
import { HexViewer } from './components/HexViewer.jsx';
import { ParserPanel } from './components/ParserPanel.jsx';
import { SendPanel } from './components/SendPanel.jsx';
import { Button } from './components/ui/Button.jsx';
import { Icon } from './components/ui/Icon.jsx';
import {
  TweaksPanel, TweakSection, TweakRadio, TweakSlider, TweakToggle, TweakSelect, TweakColor, TweakPath, useTweaks,
} from './components/TweaksPanel.jsx';

const MONO_FONTS = ['JetBrains Mono', 'IBM Plex Mono', 'Geist Mono', 'SF Mono'];
const ACCENT_OPTIONS = ['#0f172a', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#dc2626'];

const TWEAK_DEFAULTS = {
  accent: '#0f172a',
  parserView: 'tree',
  hexCols: 16,
  monoFont: 'JetBrains Mono',
  showFieldTints: true,
  showSendPanel: true,
};

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  const { conns, buffers, rateByConn, toggleStream, addConn, removeConn, updateConn, sendBytes, clearBuffer, toggleRecording } = useConnections();

  // Recordings folder info — kept in renderer state and synced after every change.
  // Initial fetch happens once on mount; subsequent updates flow through the
  // Change / Reset handlers which return the new info.
  const [recordingsDir, setRecordingsDir] = useState({ path: '', isDefault: true });
  useEffect(() => {
    window.nettest.getRecordingsDir().then(setRecordingsDir).catch(() => {});
  }, []);
  const handlePickRecordingsDir = useCallback(async () => {
    const picked = await window.nettest.pickRecordingsDir();
    if (!picked) return;
    const info = await window.nettest.setRecordingsDir(picked);
    setRecordingsDir(info);
  }, []);
  const handleOpenRecordingsDir = useCallback(() => {
    window.nettest.openRecordingsDir().catch(() => {});
  }, []);
  const handleResetRecordingsDir = useCallback(async () => {
    const info = await window.nettest.setRecordingsDir(null);
    setRecordingsDir(info);
  }, []);

  const [selectedId, setSelectedId] = useState(null);
  // Auto-select first conn once they load
  useEffect(() => {
    if (!selectedId && conns.length > 0) setSelectedId(conns[0].id);
  }, [conns, selectedId]);
  const selectedConn = conns.find((c) => c.id === selectedId);

  // Each connection owns its own parser struct. The active struct is the
  // one for `selectedId`; switching connections swaps which struct the
  // parser panel and hex viewer render against.
  const [structsByConn, setStructsByConn] = useState(() => loadJSON(STRUCTS_KEY, {}));
  useEffect(() => { saveStructsDebounced(structsByConn); }, [structsByConn]);
  const struct = structsByConn[selectedId] || EMPTY_STRUCT;

  // setStruct wraps the per-connection map so all existing callbacks
  // (updateField, addField, …) keep their setState-style API.
  const setStruct = useCallback((updater) => {
    if (!selectedId) return;
    setStructsByConn((prev) => {
      // Fresh connections start with EMPTY_STRUCT; the clone gives this
      // connection its own object identity for subsequent immutable updates.
      const current = prev[selectedId] || { ...EMPTY_STRUCT, fields: [] };
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [selectedId]: next };
    });
  }, [selectedId]);

  const updateField = useCallback((id, patch) => {
    setStruct((s) => {
      const fields = s.fields.map((f) => f.id === id ? { ...f, ...patch } : f);
      const size = fields.length ? Math.max(s.size || 0, ...fields.map((f) => f.offset + f.size)) : 0;
      return { ...s, fields, size };
    });
  }, [setStruct]);
  const removeField = useCallback((id) => {
    setStruct((s) => {
      const fields = s.fields.filter((f) => f.id !== id);
      const size = fields.length ? Math.max(...fields.map((f) => f.offset + f.size)) : 0;
      return { ...s, fields, size };
    });
  }, [setStruct]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const addField = useCallback(() => {
    let newId = null;
    setStruct((s) => {
      const last = s.fields[s.fields.length - 1];
      const off = last ? last.offset + last.size : 0;
      newId = 'f' + Date.now().toString(36);
      const colorIdx = s.fields.length % 13;
      const fields = [...s.fields, { id: newId, name: 'new', type: 'uint8', offset: off, size: 1, colorIdx, fmt: 'dec' }];
      const size = Math.max(s.size || 0, off + 1);
      return { ...s, fields, size };
    });
    setTimeout(() => { if (newId) setSelectedFieldId(newId); }, 0);
  }, [setStruct]);
  const moveField = useCallback((id, dir) => {
    setStruct((s) => {
      const i = s.fields.findIndex((f) => f.id === id);
      if (i < 0) return s;
      const j = dir === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= s.fields.length) return s;
      const arr = s.fields.slice();
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...s, fields: arr };
    });
  }, [setStruct]);
  const setStructEndian = useCallback((e) => setStruct((s) => ({ ...s, endian: e })), [setStruct]);
  const setStructName = useCallback((name) => setStruct((s) => ({ ...s, name })), [setStruct]);

  const [hoveredFieldId, setHoveredFieldId] = useState(null);

  // Reset transient field-pointers when switching connections so a stale
  // ID from the previous struct doesn't linger.
  useEffect(() => {
    setHoveredFieldId(null);
    setSelectedFieldId(null);
  }, [selectedId]);

  const { lib: structLib, savePreset, deletePreset } = useStructLibrary();
  const loadPreset = useCallback((preset) => {
    setStruct(cloneStructForUse(preset));
    setSelectedFieldId(null);
  }, [setStruct]);
  const embedPreset = useCallback((preset) => {
    setStruct((s) => embedPresetInto(s, preset));
  }, [setStruct]);
  const savePresetFromCurrent = useCallback((name) => {
    setStruct((s) => { savePreset(s, name); return { ...s, name }; });
  }, [savePreset, setStruct]);

  const [paused, setPaused] = useState(false);
  const [follow, setFollow] = useState(true);
  const [search, setSearch] = useState('');
  const [sendOpen, setSendOpen] = useState(true);
  const [selectedPktKey, setSelectedPktKey] = useState(null);

  useEffect(() => { if (!paused) setSelectedPktKey(null); }, [paused]);
  useEffect(() => { setSelectedPktKey(null); }, [selectedId]);

  // Sync CSS vars from tweaks
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent);
    r.style.setProperty('--mono', `'${t.monoFont}', ui-monospace, monospace`);
  }, [t.accent, t.monoFont]);

  const selectedBuffer = buffers[selectedId] || [];
  const selectedPkt = paused && selectedPktKey
    ? selectedBuffer.find((p) => (`${p.tms}-${p.seq}-${p.dir}`) === selectedPktKey)
    : null;
  const latestBytes = selectedPkt
    ? selectedPkt.bytes
    : (selectedBuffer.length ? selectedBuffer[selectedBuffer.length - 1].bytes : null);

  // Per-field numeric history — throttled to ~4Hz so sparklines refresh smoothly
  // without re-decoding hundreds of packets on every incoming packet.
  const [history, setHistory] = useState({});
  const historyDepsRef = useRef({ buf: selectedBuffer, struct });
  historyDepsRef.current = { buf: selectedBuffer, struct };
  useEffect(() => {
    const id = setInterval(() => {
      const { buf, struct: s } = historyDepsRef.current;
      if (!buf || !buf.length) {
        setHistory((prev) => (Object.keys(prev).length ? {} : prev));
        return;
      }
      const sample = buf.slice(-120);
      const hist = {};
      for (const f of s.fields) {
        if (!isNumericLike(f)) continue;
        const arr = [];
        for (const p of sample) {
          const d = decodeField(p.bytes, f, s.endian);
          if (typeof d.value === 'number') arr.push(d.value);
        }
        if (arr.length) hist[f.id] = arr;
      }
      setHistory(hist);
    }, 250);
    return () => clearInterval(id);
  }, [selectedId]);
  // Reset history immediately on connection change so old data doesn't linger.
  useEffect(() => { setHistory({}); }, [selectedId]);

  const lastInbound = useMemo(() => {
    for (let i = selectedBuffer.length - 1; i >= 0; i--) {
      if (selectedBuffer[i].dir !== 'tx') return selectedBuffer[i];
    }
    return null;
  }, [selectedBuffer]);

  // Resolve "live" values from any other connection's most recent RX packet,
  // decoded against THAT connection's own struct. Used by the SendPanel's
  // `bound` generator kind to bridge data between connections (e.g., ACC
  // Physics MMAP → motion-platform UDP). Numbers come out as numbers;
  // bitfield/enum yield their `.raw` integer so they still compose with
  // scale + offset.
  const getLatestValue = useCallback((connId, fieldName) => {
    if (!connId || !fieldName) return null;
    const buf = buffers[connId];
    if (!buf || !buf.length) return null;
    const s = structsByConn[connId];
    if (!s || !s.fields) return null;
    let pkt = null;
    for (let i = buf.length - 1; i >= 0; i--) {
      if (buf[i].dir !== 'tx') { pkt = buf[i]; break; }
    }
    if (!pkt) pkt = buf[buf.length - 1];
    const f = s.fields.find((x) => x.name === fieldName);
    if (!f) return null;
    const decoded = decodeField(pkt.bytes, f, s.endian);
    const v = decoded.value;
    if (typeof v === 'number') return v;
    if (typeof v === 'bigint') return Number(v);
    if (v && typeof v === 'object' && typeof v.raw === 'number') return v.raw;
    return null;
  }, [buffers, structsByConn]);

  const handleAddConn = async () => {
    const created = await addConn();
    setSelectedId(created.id);
  };

  const handleClear = useCallback(() => {
    if (!selectedId) return;
    clearBuffer(selectedId);
  }, [selectedId, clearBuffer]);

  // Stable callbacks so HexViewer's memoized PacketCards don't re-render every packet.
  const pktKey = useCallback((p) => (p ? `${p.tms}-${p.seq}-${p.dir}` : null), []);
  const handleReply = useCallback((pkt) => {
    const hexStr = Array.from(pkt.bytes).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    window.__replyPrefill = { hex: hexStr };
    setSendOpen(true);
  }, []);
  const handleSelectPacket = useCallback((pkt) => {
    if (!paused) return;
    const k = pktKey(pkt);
    setSelectedPktKey((cur) => (cur === k ? null : k));
  }, [paused, pktKey]);
  const handleSend = useCallback(async (bytes) => {
    if (!selectedId) return;
    await sendBytes(selectedId, bytes);
  }, [selectedId, sendBytes]);

  return (
    <div className="absolute inset-0 select-none bg-white flex flex-col">

        <div className="h-9 flex items-center bg-[#f6f6f7] border-b border-zinc-200 relative titlebar-drag">
          {/* On macOS hiddenInset, native traffic lights appear at left; pad to clear them. */}
          <div className="w-[78px]" />
          <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
            <div className="text-[12px] font-medium text-zinc-600 tracking-tight flex items-center gap-2">
              <span className="w-[5px] h-[5px] rounded-full bg-emerald-500 pulse-soft" />
              NetTest <span className="text-zinc-400">·</span>
              <span className="mono text-zinc-500">{selectedConn?.endpoint}</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1 pr-2">
            <Button size="xs" variant={sendOpen ? 'primary' : 'default'} onClick={() => setSendOpen(!sendOpen)} title="Toggle send panel">
              <Icon name="send" size={11} /> Send
            </Button>
            <Button size="xs" variant="ghost" title="Settings" onClick={() => setTweaksOpen((v) => !v)}>
              <Icon name="settings" size={11} />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0 relative">
          <div style={{ width: 260 }} className="shrink-0">
            <ConnectionsPanel
              connections={conns}
              selectedId={selectedId}
              onSelect={setSelectedId}
              rateByConn={rateByConn}
              onToggleStream={toggleStream}
              onToggleRecording={toggleRecording}
              onAdd={handleAddConn}
              onRemove={removeConn}
              onUpdate={updateConn}
            />
          </div>
          <div className="flex-1 min-w-0 relative">
            <HexViewer
              conn={selectedConn}
              packets={selectedBuffer}
              struct={struct}
              hoveredFieldId={hoveredFieldId}
              onHoverField={setHoveredFieldId}
              cols={t.hexCols}
              mono={t.monoFont}
              follow={follow}
              setFollow={setFollow}
              paused={paused}
              setPaused={setPaused}
              rateBps={rateByConn[selectedId] || 0}
              search={search}
              setSearch={setSearch}
              showFieldTints={t.showFieldTints}
              onClear={handleClear}
              onReply={handleReply}
              selectedPktKey={selectedPktKey}
              onSelectPacket={handleSelectPacket}
              pktKey={pktKey}
            />
            {t.showSendPanel && (
              <SendPanel
                open={sendOpen}
                onClose={() => setSendOpen(false)}
                onOpen={() => setSendOpen(true)}
                struct={struct}
                conn={selectedConn}
                lastInbound={lastInbound}
                onSend={handleSend}
                conns={conns}
                structsByConn={structsByConn}
                getLatestValue={getLatestValue}
              />
            )}
          </div>
          <div style={{ width: 380 }} className="shrink-0">
            <ParserPanel
              struct={struct}
              setStructEndian={setStructEndian}
              setStructName={setStructName}
              updateField={updateField}
              removeField={removeField}
              addField={addField}
              moveField={moveField}
              latestBytes={latestBytes}
              hoveredFieldId={hoveredFieldId}
              onHoverField={setHoveredFieldId}
              viewMode={t.parserView}
              selectedId={selectedFieldId}
              onSelect={setSelectedFieldId}
              history={history}
              library={structLib}
              onLoadPreset={loadPreset}
              onEmbedPreset={embedPreset}
              onSavePreset={savePresetFromCurrent}
              onDeletePreset={deletePreset}
            />
          </div>
        </div>

        <div className="h-6 px-3 flex items-center gap-3 text-[10.5px] text-zinc-500 border-t border-zinc-200 bg-[#fafafa]">
          <span className="mono">{conns.filter((c) => c.streaming).length}/{conns.length} streaming</span>
          <span className="text-zinc-300">·</span>
          <span className="mono">{selectedConn?.proto} · {selectedConn?.endpoint}</span>
          <div className="flex-1" />
          <span className="mono">struct: {struct.name}</span>
          <span className="text-zinc-300">·</span>
          <span className="mono">cols: {t.hexCols}</span>
        </div>

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)}>
        <TweakSection label="Parser" />
        <TweakRadio label="View" value={t.parserView} options={['tree', 'table', 'cards']} onChange={(v) => setTweak('parserView', v)} />
        <TweakToggle label="Field tints in hex" value={t.showFieldTints} onChange={(v) => setTweak('showFieldTints', v)} />

        <TweakSection label="Hex viewer" />
        <TweakRadio label="Columns" value={String(t.hexCols)} options={['8', '16', '32']} onChange={(v) => setTweak('hexCols', parseInt(v, 10))} />
        <TweakSelect label="Mono font" value={t.monoFont} options={MONO_FONTS} onChange={(v) => setTweak('monoFont', v)} />

        <TweakSection label="Appearance" />
        <TweakColor label="Accent" value={t.accent} options={ACCENT_OPTIONS} onChange={(v) => setTweak('accent', v)} />
        <TweakToggle label="Send panel enabled" value={t.showSendPanel} onChange={(v) => setTweak('showSendPanel', v)} />

        <TweakSection label="Recording" />
        <TweakPath
          label="Recordings folder"
          value={recordingsDir.path}
          isDefault={recordingsDir.isDefault}
          onChange={handlePickRecordingsDir}
          onOpen={handleOpenRecordingsDir}
          onReset={handleResetRecordingsDir}
        />
      </TweaksPanel>
    </div>
  );
}
