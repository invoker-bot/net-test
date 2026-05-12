import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx, bytesToHexSpaced, bytesToStr, hexToBytes, strToBytes } from '../lib/utils.js';
import { defaultGen, generateBytes, resetCfg, typeMax, typeMin } from '../lib/parser.js';
import { Badge } from './ui/Badge.jsx';
import { Button } from './ui/Button.jsx';
import { Icon } from './ui/Icon.jsx';

const TEMPLATES = [
  { id: 'heartbeat', label: 'Heartbeat', hex: 'FE CA 01 11 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 64 D6 53 30 30 31 00 00' },
  { id: 'command',   label: 'Command',   hex: 'FE CA 01 20 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00' },
  { id: 'ack',       label: 'Ack',       hex: 'FE CA 01 21 00 02 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00' },
];

export function SendPanel({ open, onClose, struct, onSend, conn, lastInbound, conns, structsByConn, getLatestValue }) {
  const isListener = conn?.role === 'server';
  const [mode, setMode] = useState('raw');
  const [hexText, setHexText] = useState('48 65 6C 6C 6F 2C 20 77 6F 72 6C 64 21 0A');
  const [strText, setStrText] = useState('Hello, world!\n');
  const [encoding, setEncoding] = useState('utf-8');
  const [jsonText, setJsonText] = useState('{\n  "type": "telemetry",\n  "seq": 0,\n  "temp": 23.4,\n  "ok": true\n}');
  const [jsonFraming, setJsonFraming] = useState('ndjson');
  const [jsonAutoInc, setJsonAutoInc] = useState(true);
  const [tpl, setTpl] = useState('heartbeat');
  const jsonSeqRef = useRef(0);

  const [gen, setGen] = useState({});
  const fieldGen = (f) => gen[f.id] || defaultGen(f);

  const [autoSend, setAutoSend] = useState(false);
  const [autoHz, setAutoHz] = useState(2);
  const [autoReply, setAutoReply] = useState(false);
  const lastReplyRef = useRef(0);
  const [sendError, setSendError] = useState(null);

  useEffect(() => {
    if (open && window.__replyPrefill) {
      setMode('raw');
      setHexText(window.__replyPrefill.hex);
      try {
        const bytes = hexToBytes(window.__replyPrefill.hex);
        setStrText(bytesToStr(bytes, encoding));
      } catch {}
      window.__replyPrefill = null;
    }
  }, [open, encoding]);

  const bytesFromHex = useCallback(() => hexToBytes(hexText), [hexText]);
  const bytesFromGen = useCallback(
    () => generateBytes(struct, gen, { getLatestValue }),
    [struct, gen, getLatestValue],
  );

  const bytesFromJson = useCallback(() => {
    let obj;
    try { obj = JSON.parse(jsonText); } catch { return new TextEncoder().encode(jsonText); }
    if (jsonAutoInc && obj && typeof obj === 'object' && !Array.isArray(obj)) {
      if ('seq' in obj && typeof obj.seq === 'number') obj.seq = jsonSeqRef.current++;
      if ('ts' in obj && typeof obj.ts === 'number') obj.ts = Date.now();
    }
    const body = JSON.stringify(obj);
    if (jsonFraming === 'raw') return new TextEncoder().encode(body);
    if (jsonFraming === 'ndjson') return new TextEncoder().encode(body + '\n');
    const enc = new TextEncoder().encode(body);
    const out = new Uint8Array(4 + enc.length);
    new DataView(out.buffer).setUint32(0, enc.length, false);
    out.set(enc, 4);
    return out;
  }, [jsonText, jsonAutoInc, jsonFraming]);

  const currentBytes = useCallback(() => {
    if (mode === 'raw') return bytesFromHex();
    if (mode === 'json') return bytesFromJson();
    if (mode === 'generated') return bytesFromGen();
    return bytesFromHex();
  }, [mode, bytesFromHex, bytesFromJson, bytesFromGen]);

  const onStrChange = (v) => {
    setStrText(v);
    const bytes = strToBytes(v, encoding);
    setHexText(bytesToHexSpaced(bytes));
  };
  const onHexChange = (v) => {
    setHexText(v);
    const bytes = hexToBytes(v);
    setStrText(bytesToStr(bytes, encoding));
  };
  const onEncodingChange = (e) => {
    setEncoding(e);
    const bytes = strToBytes(strText, e);
    setHexText(bytesToHexSpaced(bytes));
  };

  const jsonValid = useMemo(() => {
    try { JSON.parse(jsonText); return true; } catch { return false; }
  }, [jsonText]);

  const doSend = useCallback(async () => {
    setSendError(null);
    try {
      const b = currentBytes();
      await onSend(b);
    } catch (e) {
      setSendError(e?.message || String(e));
    }
  }, [currentBytes, onSend]);

  useEffect(() => {
    if (!autoSend) return;
    const id = setInterval(() => doSend(), Math.max(20, 1000 / autoHz));
    return () => clearInterval(id);
  }, [autoSend, autoHz, doSend]);

  useEffect(() => {
    if (!autoReply || !lastInbound) return;
    if (lastInbound.tms === lastReplyRef.current) return;
    lastReplyRef.current = lastInbound.tms;
    const id = setTimeout(() => doSend(), 30);
    return () => clearTimeout(id);
  }, [autoReply, lastInbound, doSend]);

  useEffect(() => {
    const onKey = (e) => {
      if (!open) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); doSend(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, doSend]);

  const pickTpl = (id) => {
    setTpl(id);
    const t = TEMPLATES.find((x) => x.id === id);
    if (t) {
      setHexText(t.hex);
      setStrText(bytesToStr(hexToBytes(t.hex), encoding));
      setMode('raw');
    }
  };

  if (!open) return null;
  const allModes = ['raw', 'json', 'generated', 'template'];
  const preview = (() => { try { return currentBytes(); } catch { return new Uint8Array(); } })();

  return (
    <div className="absolute left-0 right-0 bottom-0 border-t border-zinc-200 bg-white shadow-[0_-8px_24px_-12px_rgba(0,0,0,.08)]" style={{ maxHeight: '60%' }}>
      <div className="h-9 px-3 flex items-center gap-2 border-b border-zinc-100">
        <span className="text-[12px] font-semibold text-zinc-800">{isListener ? 'Reply on' : 'Send to'}</span>
        <Badge tone="zinc">{conn?.proto}</Badge>
        <Badge tone={isListener ? 'green' : 'blue'} className="!text-[9.5px]">{isListener ? 'LISTEN' : 'DIAL'}</Badge>
        <span className="mono text-[11px] text-zinc-500 truncate max-w-[260px]">{conn?.endpoint}</span>
        <div className="flex-1" />
        <div className="inline-flex rounded-md border border-zinc-200 p-0.5 h-7">
          {allModes.map((k) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={cx('px-2 text-[11px] rounded capitalize',
                mode === k ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-800')}
            >{k}</button>
          ))}
        </div>
        <Button size="xs" variant="ghost" onClick={onClose} title="Close"><Icon name="x" size={12} /></Button>
      </div>

      <div className="grid grid-cols-[1fr_240px] gap-0" style={{ maxHeight: 'calc(60vh - 36px)' }}>
        <div className="p-3 overflow-auto scroll-thin">
          {mode === 'raw' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 w-12">string</span>
                <span className="text-[10.5px] text-zinc-500">encoding</span>
                <select value={encoding} onChange={(e) => onEncodingChange(e.target.value)} className="text-[11px] border border-zinc-200 rounded bg-white">
                  <option value="utf-8">UTF-8</option>
                  <option value="ascii">ASCII</option>
                  <option value="latin1">Latin-1</option>
                  <option value="utf-16le">UTF-16 LE</option>
                  <option value="utf-16be">UTF-16 BE</option>
                </select>
                <div className="flex-1" />
                <span className="mono text-[10px] text-zinc-400 tabular">{strText.length} chars</span>
              </div>
              <textarea
                value={strText}
                onChange={(e) => onStrChange(e.target.value)}
                spellCheck={false}
                placeholder="Type text — hex side updates live"
                className="mono w-full h-[110px] text-[12px] resize-none rounded-md border border-zinc-200 bg-zinc-50 p-2 ring-accent"
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 w-12">hex</span>
                <span className="text-[10.5px] text-zinc-400">space / newline separated; non-hex chars ignored</span>
                <div className="flex-1" />
                <button onClick={() => setHexText(bytesToHexSpaced(hexToBytes(hexText)))} className="text-[10.5px] text-zinc-500 hover:text-zinc-800 underline-offset-2 hover:underline">format</button>
                <span className="mono text-[10px] text-zinc-400 tabular">{hexToBytes(hexText).length} B</span>
              </div>
              <textarea
                value={hexText}
                onChange={(e) => onHexChange(e.target.value)}
                spellCheck={false}
                placeholder="FE CA 01 10 …"
                className="mono w-full h-[110px] text-[12px] resize-none rounded-md border border-zinc-200 bg-zinc-50 p-2 ring-accent tabular"
              />
            </div>
          )}
          {mode === 'json' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lab>framing</Lab>
                <div className="inline-flex rounded-md border border-zinc-200 p-0.5 h-6">
                  {[['raw', 'raw'], ['ndjson', 'ndjson \\n'], ['length32', 'len32+body']].map(([v, l]) => (
                    <button key={v} onClick={() => setJsonFraming(v)}
                      className={cx('px-1.5 text-[10.5px] rounded mono',
                        jsonFraming === v ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-800')}
                    >{l}</button>
                  ))}
                </div>
                <label className="flex items-center gap-1 text-[10.5px] text-zinc-600 ml-2">
                  <input type="checkbox" checked={jsonAutoInc} onChange={(e) => setJsonAutoInc(e.target.checked)} />
                  auto-increment <span className="mono">seq</span> / <span className="mono">ts</span>
                </label>
                <div className="flex-1" />
                <button onClick={() => { try { setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2)); } catch {} }}
                  className="text-[10.5px] text-zinc-500 hover:text-zinc-800 underline-offset-2 hover:underline">format</button>
              </div>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                spellCheck={false}
                className={cx('mono w-full h-[140px] text-[12px] resize-none rounded-md border bg-zinc-50 p-2 ring-accent', jsonValid ? 'border-zinc-200' : 'border-rose-300')}
              />
              {!jsonValid && <div className="text-[10.5px] text-rose-600">invalid JSON — will be sent as raw text</div>}
            </div>
          )}
          {mode === 'template' && (
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickTpl(t.id)}
                  className={cx('text-left rounded-md border p-2 hover:bg-zinc-50',
                    tpl === t.id ? 'border-zinc-400 bg-zinc-50' : 'border-zinc-200')}
                >
                  <div className="text-[12px] font-medium text-zinc-800">{t.label}</div>
                  <div className="mono text-[10px] text-zinc-400 truncate">{t.hex.slice(0, 32)}…</div>
                </button>
              ))}
            </div>
          )}
          {mode === 'generated' && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-zinc-500">struct</span>
                <span className="mono text-[11.5px] text-zinc-800">{struct.name}</span>
                <Badge tone="zinc" className="!text-[9.5px]">{struct.size} B</Badge>
                <Badge tone="zinc" className="!text-[9.5px]">{struct.endian}</Badge>
                <div className="flex-1" />
                <button onClick={() => setGen({})} className="text-[10.5px] text-zinc-500 hover:text-zinc-800 underline-offset-2 hover:underline">Reset all</button>
              </div>
              <div className="border border-zinc-200 rounded-md divide-y divide-zinc-100 overflow-hidden">
                {struct.fields.map((f) => (
                  <GenRow
                    key={f.id}
                    field={f}
                    cfg={fieldGen(f)}
                    onChange={(patch) => setGen((g) => ({ ...g, [f.id]: { ...fieldGen(f), ...patch } }))}
                    conns={conns}
                    structsByConn={structsByConn}
                    getLatestValue={getLatestValue}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-l border-zinc-100 p-3 flex flex-col gap-2 overflow-auto scroll-thin">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Preview</div>
          <PreviewBytes bytes={preview} />

          <div className="rounded-md border border-zinc-200 p-2 space-y-1.5">
            <label className="flex items-center gap-2 text-[11.5px] text-zinc-700">
              <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />
              Auto-send
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] text-zinc-500">rate</span>
              <input
                type="number" min={1} max={200} value={autoHz}
                onChange={(e) => setAutoHz(Math.max(1, Math.min(200, parseInt(e.target.value) || 1)))}
                className="mono text-[11px] w-12 h-6 px-1 border border-zinc-200 rounded ring-accent tabular"
              />
              <span className="text-[10.5px] text-zinc-500">Hz</span>
            </div>
          </div>

          {isListener && (
            <div className="rounded-md border border-zinc-200 p-2 space-y-1">
              <label className="flex items-center gap-2 text-[11.5px] text-zinc-700">
                <input type="checkbox" checked={autoReply} onChange={(e) => setAutoReply(e.target.checked)} />
                Auto-reply on RX
              </label>
              <div className="text-[10px] text-zinc-400">Sends this payload whenever an inbound packet arrives.</div>
            </div>
          )}

          {sendError && <div className="text-[10.5px] text-rose-600">⚠ {sendError}</div>}

          <div className="flex-1" />
          <Button variant="primary" size="md" onClick={doSend}>
            <Icon name="send" size={12} /> Send now
          </Button>
          <div className="text-[10px] text-zinc-400">⌘↵ to send</div>
        </div>
      </div>
    </div>
  );
}

function PreviewBytes({ bytes }) {
  const max = 32;
  const hex = Array.from(bytes.slice(0, max)).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  return (
    <div>
      <div className="mono text-[11px] tabular text-zinc-600">{bytes.length} bytes</div>
      <div className="mono text-[10px] tabular text-zinc-400 break-all leading-relaxed mt-1">{hex}{bytes.length > max ? ' …' : ''}</div>
    </div>
  );
}

function Lab({ children }) {
  return <span className="text-[10px] text-zinc-500">{children}</span>;
}

function NumIn({ value, onChange, w = 56, step }) {
  return (
    <input
      type="number" step={step ?? 'any'} value={value ?? 0}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="mono text-[11px] h-6 px-1 border border-zinc-200 rounded ring-accent tabular"
      style={{ width: w }}
    />
  );
}

function StrIn({ value, onChange, w = 120 }) {
  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="mono text-[11px] h-6 px-1.5 border border-zinc-200 rounded ring-accent"
      style={{ width: w }}
    />
  );
}

function GenRow({ field, cfg, onChange, conns, structsByConn, getLatestValue }) {
  const num = !['string', 'padding', 'bitfield', 'enum:u8'].includes(field.type);
  const kinds = num
    ? [['const', 'fixed'], ['uniform', 'uniform'], ['gauss', 'gaussian'], ['walk', 'walk'], ['sine', 'sine'], ['counter', 'counter'], ['ramp', 'ramp'], ['bound', 'bound (live)']]
    : field.type === 'string' ? [['const', 'fixed']]
    : [['const', 'fixed']];

  return (
    <div className="px-2.5 py-1.5 grid grid-cols-[16px_120px_92px_1fr] items-center gap-2 hover:bg-zinc-50/60">
      <span className={cx('inline-block w-1.5 h-3.5 rounded-sm', 'field-dot-' + field.colorIdx)} />
      <div className="min-w-0">
        <div className="mono text-[11.5px] text-zinc-800 truncate">{field.name}</div>
        <div className="mono text-[9.5px] text-zinc-400 tabular">{field.type} · {field.size}B · 0x{field.offset.toString(16).padStart(2, '0').toUpperCase()}</div>
      </div>
      <select
        value={cfg.kind}
        onChange={(e) => onChange(resetCfg(field, e.target.value))}
        className="text-[11px] h-6 px-1 border border-zinc-200 rounded bg-white ring-accent"
      >
        {kinds.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <GenParams
        field={field}
        cfg={cfg}
        onChange={onChange}
        conns={conns}
        structsByConn={structsByConn}
        getLatestValue={getLatestValue}
      />
    </div>
  );
}

function GenParams({ field, cfg, onChange, conns, structsByConn, getLatestValue }) {
  if (field.type === 'string') {
    return <div className="flex items-center gap-1.5"><Lab>str</Lab><StrIn value={cfg.str} onChange={(v) => onChange({ str: v })} w={140} /></div>;
  }
  switch (cfg.kind) {
    case 'const':
      return <div className="flex items-center gap-1.5"><Lab>value</Lab><NumIn value={cfg.num} onChange={(v) => onChange({ num: v })} /></div>;
    case 'uniform':
      return (
        <div className="flex items-center gap-1.5">
          <Lab>min</Lab><NumIn value={cfg.min} onChange={(v) => onChange({ min: v })} />
          <Lab>max</Lab><NumIn value={cfg.max} onChange={(v) => onChange({ max: v })} />
        </div>
      );
    case 'gauss':
      return (
        <div className="flex items-center gap-1.5">
          <Lab>μ</Lab><NumIn value={cfg.mean} onChange={(v) => onChange({ mean: v })} />
          <Lab>σ</Lab><NumIn value={cfg.sigma} onChange={(v) => onChange({ sigma: v })} />
        </div>
      );
    case 'walk':
      return (
        <div className="flex items-center gap-1.5">
          <Lab>start</Lab><NumIn value={cfg.value} onChange={(v) => onChange({ value: v })} />
          <Lab>σ</Lab><NumIn value={cfg.sigma} onChange={(v) => onChange({ sigma: v })} />
        </div>
      );
    case 'sine':
      return (
        <div className="flex items-center gap-1.5">
          <Lab>center</Lab><NumIn value={cfg.center} onChange={(v) => onChange({ center: v })} />
          <Lab>amp</Lab><NumIn value={cfg.amp} onChange={(v) => onChange({ amp: v })} />
          <Lab>T</Lab><NumIn value={cfg.period} onChange={(v) => onChange({ period: v })} w={48} />
        </div>
      );
    case 'counter':
      return (
        <div className="flex items-center gap-1.5">
          <Lab>start</Lab><NumIn value={cfg.start} onChange={(v) => onChange({ start: v })} />
          <Lab>step</Lab><NumIn value={cfg.step} onChange={(v) => onChange({ step: v })} />
        </div>
      );
    case 'ramp':
      return (
        <div className="flex items-center gap-1.5">
          <Lab>min</Lab><NumIn value={cfg.min} onChange={(v) => onChange({ min: v })} />
          <Lab>max</Lab><NumIn value={cfg.max} onChange={(v) => onChange({ max: v })} />
          <Lab>step</Lab><NumIn value={cfg.step} onChange={(v) => onChange({ step: v })} />
        </div>
      );
    case 'bound':
      return (
        <BoundParams
          cfg={cfg} onChange={onChange}
          conns={conns} structsByConn={structsByConn} getLatestValue={getLatestValue}
        />
      );
    default: return null;
  }
}

function BoundParams({ cfg, onChange, conns, structsByConn, getLatestValue }) {
  // Source-field options come from whichever connection the user picked.
  // Restrict to fields whose decoded value `getLatestValue` can return as a
  // number — numeric primitives + bitfield/enum (those decode to objects but
  // surface a `.raw` integer).
  const srcStruct = structsByConn?.[cfg.sourceConnId];
  const fieldOpts = (srcStruct?.fields || []).filter(
    (f) => /^(uint|int|float)/.test(f.type) || f.type === 'bitfield' || f.type === 'enum:u8',
  );
  // Re-render at ~10Hz so the live preview reflects incoming traffic. Cheap:
  // a single getLatestValue call per row per tick.
  const [, force] = useState(0);
  useEffect(() => {
    if (cfg.kind !== 'bound' || !cfg.sourceConnId || !cfg.sourceField) return;
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [cfg.kind, cfg.sourceConnId, cfg.sourceField]);
  const live = getLatestValue?.(cfg.sourceConnId, cfg.sourceField);
  const resolved = (typeof live === 'number' && Number.isFinite(live))
    ? live * (cfg.scale ?? 1) + (cfg.offset ?? 0)
    : null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select
        value={cfg.sourceConnId || ''}
        onChange={(e) => onChange({ sourceConnId: e.target.value, sourceField: '' })}
        className="text-[11px] h-6 px-1 border border-zinc-200 rounded bg-white ring-accent max-w-[120px]"
        title="Source connection"
      >
        <option value="">(connection)</option>
        {(conns || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select
        value={cfg.sourceField || ''}
        onChange={(e) => onChange({ sourceField: e.target.value })}
        disabled={!cfg.sourceConnId}
        className="text-[11px] h-6 px-1 border border-zinc-200 rounded bg-white ring-accent max-w-[130px] disabled:opacity-50"
        title="Source field"
      >
        <option value="">(field)</option>
        {fieldOpts.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
      </select>
      <Lab>×</Lab><NumIn value={cfg.scale ?? 1} onChange={(v) => onChange({ scale: v })} w={48} />
      <Lab>+</Lab><NumIn value={cfg.offset ?? 0} onChange={(v) => onChange({ offset: v })} w={48} />
      <span className="mono text-[10px] text-zinc-400 tabular min-w-[40px]" title="Current resolved value">
        = {resolved == null ? '—' : (Number.isInteger(resolved) ? resolved : resolved.toFixed(2))}
      </span>
    </div>
  );
}
