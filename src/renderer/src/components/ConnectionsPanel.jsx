import { useState } from 'react';
import { cx, formatRate } from '../lib/utils.js';
import { Button } from './ui/Button.jsx';
import { Badge } from './ui/Badge.jsx';
import { Icon, ProtoIcon } from './ui/Icon.jsx';

export function ConnectionsPanel({
  connections, selectedId, onSelect, rateByConn,
  onToggleStream, onToggleRecording, onAdd, onRemove, onUpdate,
}) {
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState('');
  const filtered = connections.filter((c) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.endpoint.toLowerCase().includes(q) || c.proto.toLowerCase().includes(q);
  });

  return (
    <div className="h-full flex flex-col bg-white border-r border-zinc-200">
      <div className="h-11 px-3 flex items-center justify-between border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold tracking-tight text-zinc-900">Connections</span>
          <span className="text-[11px] text-zinc-400 tabular">{connections.length}</span>
        </div>
        <Button size="xs" variant="ghost" title="New connection" onClick={onAdd}>
          <Icon name="plus" size={12} />
        </Button>
      </div>

      <div className="px-3 py-2 border-b border-zinc-100">
        <div className="relative">
          <Icon name="search" size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="w-full h-7 pl-7 pr-2 text-[12px] rounded-md bg-zinc-50 border border-zinc-200 placeholder:text-zinc-400 ring-accent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto scroll-thin py-1">
        {filtered.map((c) => {
          const sel = c.id === selectedId;
          const rate = rateByConn[c.id] || 0;
          const editing = editId === c.id;
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cx(
                'group mx-2 my-0.5 px-2.5 py-2 rounded-md cursor-default',
                sel ? 'bg-zinc-100' : 'hover:bg-zinc-50',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cx(
                  'inline-flex w-6 h-6 items-center justify-center rounded-md border',
                  sel ? 'bg-white border-zinc-300' : 'bg-zinc-50 border-zinc-200',
                )} style={{ color: c.color }}>
                  <ProtoIcon proto={c.proto} className="opacity-90" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[12.5px] font-medium text-zinc-900 truncate"
                      onDoubleClick={(e) => { e.stopPropagation(); setEditId(c.id); }}
                    >{c.name}</span>
                    <Badge tone="zinc" className="!h-[15px] !px-1 !text-[9.5px]">{c.proto}</Badge>
                    <Badge tone={c.role === 'server' ? 'green' : 'blue'} className="!h-[15px] !px-1 !text-[9.5px]">
                      {c.role === 'server' ? 'LISTEN' : 'DIAL'}
                    </Badge>
                  </div>
                  <div className="mono text-[10.5px] text-zinc-500 truncate">{c.endpoint}</div>
                  {c.lastError && <div className="text-[10px] text-rose-600 truncate" title={c.lastError}>⚠ {c.lastError}</div>}
                </div>
                <StatusPill status={c.status} />
                <button
                  onClick={(e) => { e.stopPropagation(); setEditId(editing ? null : c.id); }}
                  className="opacity-0 group-hover:opacity-100 transition w-5 h-5 inline-flex items-center justify-center rounded hover:bg-zinc-200 text-zinc-500"
                >
                  <Icon name="settings" size={11} />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 pl-8">
                <span className="mono text-[10px] tabular text-zinc-500">{formatRate(rate)}</span>
                <div className="flex-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleRecording(c.id); }}
                  title={c.recording
                    ? `Recording → ${(c.recordingPath || '').split(/[\\/]/).pop()}`
                    : 'Start recording to JSONL'}
                  className={cx(
                    'h-5 px-1.5 rounded text-[10px] font-medium border inline-flex items-center gap-1',
                    c.recording
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:text-zinc-700',
                  )}
                >
                  <span className={cx(
                    'w-1.5 h-1.5 rounded-full',
                    c.recording ? 'bg-rose-500 pulse-soft' : 'bg-zinc-400',
                  )} />
                  REC
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleStream(c.id); }}
                  className={cx(
                    'h-5 px-1.5 rounded text-[10px] font-medium border',
                    c.streaming
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-500',
                  )}
                >{c.streaming ? 'LIVE' : 'OFF'}</button>
              </div>
              {editing && (
                <ConnEditor
                  c={c}
                  onChange={(patch) => onUpdate(c.id, patch)}
                  onRemove={() => { setEditId(null); onRemove(c.id); }}
                  onClose={() => setEditId(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-zinc-200 p-2">
        <button
          onClick={onAdd}
          className="w-full h-8 rounded-md border border-dashed border-zinc-300 text-[12px] text-zinc-500 hover:bg-zinc-50 flex items-center justify-center gap-1.5"
        >
          <Icon name="plus" size={12} /> Add connection
        </button>
      </div>
    </div>
  );
}

function ConnEditor({ c, onChange, onRemove, onClose }) {
  const isMmap = c.proto === 'MMAP';
  // MMAP and Serial have no server/client distinction — the address is always
  // a resource name ("Local\acpmf_physics" or "COM3"). We pin role to 'client'
  // for those protos and route the address through `remote`.
  const isServer = c.role === 'server' && !isMmap;
  const addrField = (isMmap || c.role !== 'server') ? 'remote' : 'bind';
  const addrVal = c[addrField] || '';
  const updateAddr = (val) => {
    const proto = c.proto.toLowerCase();
    let url;
    if (c.proto === 'SER') url = 'serial://' + val;
    else if (c.proto === 'WS') url = val.startsWith('ws') ? val : 'ws://' + val;
    else if (c.proto === 'MOCK') url = 'mock://' + val;
    else if (c.proto === 'MMAP') url = 'mmap://' + val;
    else url = `${proto}://${val}`;
    onChange({ [addrField]: val, endpoint: url });
  };
  const onProtoChange = (e) => {
    const proto = e.target.value;
    const patch = { proto };
    // MMAP / SER are read-only single-endpoint protos; force role=client so the
    // address routes through `remote` and the LISTEN/DIAL badge isn't misleading.
    if (proto === 'MMAP' || proto === 'SER') patch.role = 'client';
    onChange(patch);
  };
  const addrPlaceholder = isMmap
    ? 'Local\\acpmf_physics'
    : c.proto === 'SER' ? '/dev/cu.usbmodem or COM3:115200'
    : isServer ? '0.0.0.0:5005' : 'host:port';
  return (
    <div onClick={(e) => e.stopPropagation()} className="mt-2 ml-8 rounded-md border border-zinc-200 bg-white p-2 space-y-2">
      <div className="flex items-center gap-1.5">
        <input
          value={c.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="flex-1 text-[12px] h-6 px-1.5 border border-zinc-200 rounded ring-accent"
        />
        <Button size="xs" variant="ghost" onClick={onClose}><Icon name="x" size={11} /></Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <select
          value={c.proto}
          onChange={onProtoChange}
          className="text-[11px] h-6 px-1 border border-zinc-200 rounded bg-white ring-accent"
        >
          {(window.nettest?.isDev
            ? ['TCP', 'UDP', 'WS', 'SER', 'MMAP', 'MOCK']
            : ['TCP', 'UDP', 'WS', 'SER', 'MMAP']
          ).map((p) => <option key={p}>{p}</option>)}
        </select>
        <select
          value={c.role}
          onChange={(e) => onChange({ role: e.target.value })}
          disabled={isMmap || c.proto === 'SER'}
          className="text-[11px] h-6 px-1 border border-zinc-200 rounded bg-white ring-accent disabled:opacity-50"
        >
          <option value="server">LISTEN (0.0.0.0:port)</option>
          <option value="client">DIAL (remote)</option>
        </select>
      </div>
      <input
        value={addrVal}
        onChange={(e) => updateAddr(e.target.value)}
        placeholder={addrPlaceholder}
        className="mono w-full text-[11.5px] h-6 px-1.5 border border-zinc-200 rounded ring-accent"
      />
      {isMmap && (
        <div className="grid grid-cols-2 gap-1.5">
          <label className="text-[10px] text-zinc-500 flex flex-col gap-0.5">
            <span className="uppercase tracking-wider">Size (bytes)</span>
            <input
              type="number"
              min={1}
              value={c.mmapSize ?? 800}
              onChange={(e) => onChange({ mmapSize: Math.max(1, parseInt(e.target.value, 10) || 0) })}
              className="mono text-[11.5px] h-6 px-1.5 border border-zinc-200 rounded ring-accent text-zinc-900"
            />
          </label>
          <label className="text-[10px] text-zinc-500 flex flex-col gap-0.5">
            <span className="uppercase tracking-wider">Poll (Hz)</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={c.mmapPollHz ?? 50}
              onChange={(e) => onChange({ mmapPollHz: Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 0)) })}
              className="mono text-[11.5px] h-6 px-1.5 border border-zinc-200 rounded ring-accent text-zinc-900"
            />
          </label>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onRemove}
          className="h-6 px-2 text-[11px] rounded border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 inline-flex items-center gap-1"
        >
          <Icon name="trash" size={11} /> Delete
        </button>
        <div className="flex-1" />
        <button onClick={onClose} className="h-6 px-2 text-[11px] rounded border border-zinc-200 bg-zinc-900 text-white">Done</button>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    connected:  { dot: '#10b981', label: 'Connected',  pulse: true },
    listening:  { dot: '#3b82f6', label: 'Listening',  pulse: true },
    connecting: { dot: '#f59e0b', label: 'Connecting', pulse: true },
    idle:       { dot: '#a1a1aa', label: 'Idle',       pulse: false },
    reconnect:  { dot: '#f59e0b', label: 'Reconnect',  pulse: true },
    error:      { dot: '#ef4444', label: 'Error',      pulse: false },
  };
  const m = map[status] || map.idle;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500" title={m.label}>
      <span className={cx('w-1.5 h-1.5 rounded-full', m.pulse && 'pulse-soft')} style={{ background: m.dot }} />
    </span>
  );
}
