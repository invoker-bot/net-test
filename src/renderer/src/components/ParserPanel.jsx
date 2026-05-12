import { useEffect, useMemo, useState } from 'react';
import { cx } from '../lib/utils.js';
import { decodeField, formatField, isNumericLike, SUPPORTED_TYPES, TYPE_SIZE } from '../lib/parser.js';
import { Badge } from './ui/Badge.jsx';
import { Button } from './ui/Button.jsx';
import { Icon } from './ui/Icon.jsx';
import { Sparkline } from './ui/Sparkline.jsx';
import { StructLibraryMenu } from './StructLibraryMenu.jsx';

export function ParserPanel({
  struct, setStructEndian, setStructName, updateField, removeField, addField, moveField,
  latestBytes, hoveredFieldId, onHoverField, viewMode, selectedId, onSelect, history,
  library, onLoadPreset, onEmbedPreset, onSavePreset, onDeletePreset,
}) {
  const decoded = useMemo(() => {
    if (!latestBytes) return {};
    const d = {};
    for (const f of struct.fields) d[f.id] = decodeField(latestBytes, f, struct.endian);
    return d;
  }, [latestBytes, struct]);

  const selected = struct.fields.find((f) => f.id === selectedId) || struct.fields[0];
  const [libOpen, setLibOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (!libOpen) return;
    const fn = () => setLibOpen(false);
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, [libOpen]);

  return (
    <div className="h-full flex flex-col bg-white border-l border-zinc-200 relative">
      <div className="h-11 px-3 flex items-center justify-between border-b border-zinc-200">
        <div className="flex items-center gap-2 min-w-0">
          {editingName ? (
            <input
              autoFocus
              defaultValue={struct.name}
              onBlur={(e) => { setStructName?.(e.target.value.trim() || 'Untitled'); setEditingName(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingName(false); }}
              className="text-[13px] font-semibold tracking-tight text-zinc-900 px-1 h-6 w-[140px] border border-zinc-200 rounded ring-accent bg-white"
            />
          ) : (
            <span
              className="text-[13px] font-semibold tracking-tight text-zinc-900 cursor-text hover:bg-zinc-50 px-1 -mx-1 rounded truncate"
              title="Click to rename"
              onClick={() => setEditingName(true)}
            >{struct.name}</span>
          )}
          <Badge tone="zinc" className="!h-[16px]">{struct.size}B</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStructEndian(struct.endian === 'LE' ? 'BE' : 'LE')}
            className="badge cursor-pointer hover:bg-zinc-100"
            title="Toggle structure endian"
          >{struct.endian}</button>
          <Button size="xs" variant="ghost" title="Add field" onClick={addField}><Icon name="plus" size={12} /></Button>
          <Button
            size="xs" variant="ghost" title="Struct library"
            onClick={(e) => { e.stopPropagation(); setLibOpen((v) => !v); }}
          ><Icon name="doc" size={12} /></Button>
        </div>
      </div>

      {libOpen && (
        <StructLibraryMenu
          library={library}
          struct={struct}
          onLoad={(p) => { onLoadPreset(p); setLibOpen(false); }}
          onEmbed={(p) => { onEmbedPreset(p); setLibOpen(false); }}
          onSave={(name) => { onSavePreset(name); setLibOpen(false); }}
          onDelete={(name) => { onDeletePreset(name); }}
          onClose={() => setLibOpen(false)}
        />
      )}

      <div className="flex-1 overflow-auto scroll-thin">
        {struct.fields.length === 0 ? (
          <EmptyStructPlaceholder onAdd={addField} onOpenLibrary={() => setLibOpen(true)} />
        ) : viewMode === 'tree' ? (
          <FieldTree struct={struct} decoded={decoded}
            hoveredFieldId={hoveredFieldId} onHoverField={onHoverField}
            selectedId={selected?.id} onSelect={onSelect} history={history} />
        ) : viewMode === 'table' ? (
          <FieldTable struct={struct} decoded={decoded}
            hoveredFieldId={hoveredFieldId} onHoverField={onHoverField}
            selectedId={selected?.id} onSelect={onSelect} />
        ) : (
          <FieldCards struct={struct} decoded={decoded}
            hoveredFieldId={hoveredFieldId} onHoverField={onHoverField}
            selectedId={selected?.id} onSelect={onSelect} history={history} />
        )}
      </div>

      {selected && (
        <PropertyPanel
          field={selected} decoded={decoded[selected.id]} history={history[selected.id]}
          onChange={(patch) => updateField(selected.id, patch)}
          onRemove={() => removeField(selected.id)}
          onMoveUp={() => moveField(selected.id, 'up')}
          onMoveDown={() => moveField(selected.id, 'down')}
        />
      )}
    </div>
  );
}

function ValueChip({ f, decoded }) {
  if (!decoded || decoded.value == null) {
    return <span className="mono text-[12px] text-zinc-300">—</span>;
  }
  if (f.type === 'bitfield') {
    return (
      <div className="flex flex-wrap gap-1 justify-end max-w-[160px]">
        {decoded.value.bits.map((b) => (
          <span
            key={b.name}
            className={cx(
              'text-[9.5px] px-1 h-4 inline-flex items-center rounded border tabular',
              b.on ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400',
            )}
          >{b.name}</span>
        ))}
      </div>
    );
  }
  return (
    <div className="text-right">
      <div className="mono text-[13px] tabular font-semibold text-zinc-900">{formatField(f, decoded)}</div>
      {f.unit && <div className="text-[10px] text-zinc-400 -mt-0.5">{f.unit}</div>}
    </div>
  );
}

function FieldTree({ struct, decoded, hoveredFieldId, onHoverField, selectedId, onSelect, history }) {
  return (
    <div className="divide-y divide-zinc-100">
      {struct.fields.map((f) => {
        const hov = hoveredFieldId === f.id;
        return (
          <div
            key={f.id}
            onMouseEnter={() => onHoverField(f.id)}
            onMouseLeave={() => onHoverField(null)}
            onClick={() => onSelect(f.id)}
            className={cx(
              'px-3 py-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-2 cursor-default',
              hov ? 'bg-zinc-50' : '',
              selectedId === f.id && 'bg-zinc-100',
            )}
          >
            <span className={cx('inline-block w-1.5 h-9 rounded-sm', 'field-dot-' + f.colorIdx)} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-medium text-zinc-900 truncate">{f.name}</span>
                <span className="badge !text-[9.5px] !h-[15px] !px-1 text-zinc-500 bg-zinc-50 border-zinc-200">
                  {f.type}{f.type === 'string' ? `[${f.size}]` : ''}
                </span>
                {f.endian && f.size > 1 && <span className="text-[9.5px] text-zinc-400 mono">{f.endian}</span>}
              </div>
              <div className="mono text-[10px] text-zinc-400 tabular mt-0.5">
                @0x{f.offset.toString(16).toUpperCase().padStart(2, '0')} · {f.size}B
                {f.note && <span className="ml-2 text-zinc-400">· {f.note}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {history?.[f.id] && history[f.id].length > 4 && isNumericLike(f) && (
                <Sparkline values={history[f.id].slice(-32)} width={48} height={16} />
              )}
              <ValueChip f={f} decoded={decoded[f.id]} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FieldTable({ struct, decoded, hoveredFieldId, onHoverField, selectedId, onSelect }) {
  return (
    <table className="w-full text-[12px]">
      <thead className="bg-zinc-50 text-[10px] uppercase text-zinc-500 tracking-wider">
        <tr>
          <th className="text-left px-3 py-2 font-semibold">Field</th>
          <th className="text-left px-2 py-2 font-semibold">Type</th>
          <th className="text-left px-2 py-2 font-semibold">@</th>
          <th className="text-left px-2 py-2 font-semibold">End.</th>
          <th className="text-right px-3 py-2 font-semibold">Value</th>
        </tr>
      </thead>
      <tbody>
        {struct.fields.map((f) => {
          const hov = hoveredFieldId === f.id;
          return (
            <tr
              key={f.id}
              onMouseEnter={() => onHoverField(f.id)}
              onMouseLeave={() => onHoverField(null)}
              onClick={() => onSelect(f.id)}
              title={f.note || undefined}
              className={cx('border-t border-zinc-100', hov && 'bg-zinc-50', selectedId === f.id && 'bg-zinc-100')}
            >
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={cx('inline-block w-1.5 h-4 rounded-sm', 'field-dot-' + f.colorIdx)} />
                  <span className="font-medium text-zinc-900">{f.name}</span>
                </div>
              </td>
              <td className="px-2 py-1.5"><span className="mono text-[11px] text-zinc-600">{f.type}{f.type === 'string' ? `[${f.size}]` : ''}</span></td>
              <td className="px-2 py-1.5 mono text-[11px] text-zinc-500 tabular">0x{f.offset.toString(16).toUpperCase().padStart(2, '0')}</td>
              <td className="px-2 py-1.5 mono text-[11px] text-zinc-500">{f.size > 1 ? (f.endian || 'LE') : '·'}</td>
              <td className="px-3 py-1.5"><ValueChip f={f} decoded={decoded[f.id]} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FieldCards({ struct, decoded, hoveredFieldId, onHoverField, selectedId, onSelect, history }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-2">
      {struct.fields.map((f) => {
        const hov = hoveredFieldId === f.id;
        const d = decoded[f.id];
        return (
          <div
            key={f.id}
            onMouseEnter={() => onHoverField(f.id)}
            onMouseLeave={() => onHoverField(null)}
            onClick={() => onSelect(f.id)}
            title={f.note || undefined}
            className={cx(
              'rounded-lg border bg-white p-2.5 cursor-default',
              hov ? 'border-zinc-300' : 'border-zinc-200',
              selectedId === f.id && 'ring-2 ring-offset-1 ring-zinc-300',
            )}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={cx('w-1.5 h-1.5 rounded-full', 'field-dot-' + f.colorIdx)} />
              <span className="text-[11px] font-medium text-zinc-700 truncate">{f.name}</span>
              <span className="ml-auto text-[9.5px] mono text-zinc-400">{f.type}</span>
            </div>
            {f.type === 'bitfield' ? (
              <ValueChip f={f} decoded={d} />
            ) : (
              <>
                <div className="mono text-[15px] tabular font-semibold text-zinc-900 truncate">{d ? formatField(f, d) : '—'}</div>
                {f.unit && <div className="text-[10px] text-zinc-400">{f.unit}</div>}
                {isNumericLike(f) && history?.[f.id] && history[f.id].length > 4 &&
                  <Sparkline values={history[f.id].slice(-32)} width={120} height={18} />}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PropRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function PropertyPanel({ field, decoded, history, onChange, onRemove, onMoveUp, onMoveDown }) {
  const num = isNumericLike(field);
  return (
    <div className="border-t border-zinc-200 bg-zinc-50/60 max-h-[44%] overflow-auto scroll-thin">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-zinc-200/60">
        <span className={cx('inline-block w-1.5 h-4 rounded-sm', 'field-dot-' + field.colorIdx)} />
        <span className="text-[12px] font-semibold text-zinc-800">{field.name}</span>
        <Badge tone="zinc" className="!h-[16px]">{field.type}</Badge>
        <div className="flex-1" />
        <Button size="xs" variant="ghost" onClick={onMoveUp} title="Move up"><Icon name="chevron" size={11} className="-rotate-90" /></Button>
        <Button size="xs" variant="ghost" onClick={onMoveDown} title="Move down"><Icon name="chevron" size={11} className="rotate-90" /></Button>
        <Button size="xs" variant="ghost" onClick={onRemove} title="Remove"><Icon name="trash" size={11} /></Button>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5">
        <PropRow label="Name" value={
          <input value={field.name} onChange={(e) => onChange({ name: e.target.value })}
            className="mono text-[11.5px] w-full bg-white border border-zinc-200 rounded px-1.5 h-6 ring-accent" />
        } />
        <PropRow label="Type" value={
          <select
            value={field.type}
            onChange={(e) => {
              const t = e.target.value;
              const patch = { type: t };
              if (TYPE_SIZE[t]) patch.size = TYPE_SIZE[t];
              if (/^float/.test(t)) patch.fmt = 'f2';
              onChange(patch);
            }}
            className="text-[11.5px] bg-white border border-zinc-200 rounded h-6 px-1.5 ring-accent"
          >
            {SUPPORTED_TYPES.map((o) => <option key={o}>{o}</option>)}
          </select>
        } />
        <PropRow label="Offset" value={
          <input
            type="number"
            value={field.offset}
            onChange={(e) => onChange({ offset: parseInt(e.target.value) || 0 })}
            className="mono text-[12px] tabular w-full bg-white border border-zinc-200 rounded px-1.5 h-6 ring-accent"
          />
        } />
        <PropRow label="Size" value={
          <input
            type="number" min={1}
            value={field.size}
            onChange={(e) => onChange({ size: Math.max(1, parseInt(e.target.value) || 1) })}
            className="mono text-[12px] tabular w-full bg-white border border-zinc-200 rounded px-1.5 h-6 ring-accent"
          />
        } />
        {field.size > 1 && field.type !== 'string' && (
          <PropRow label="Endian" value={
            <div className="inline-flex rounded-md border border-zinc-200 bg-white p-0.5 h-6">
              {['LE', 'BE'].map((k) => (
                <button
                  key={k}
                  onClick={() => onChange({ endian: k })}
                  className={cx('px-2 text-[10.5px] rounded-[4px] mono',
                    (field.endian || 'LE') === k ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-800')}
                >{k}</button>
              ))}
            </div>
          } />
        )}
        {num && (
          <PropRow label="Format" value={
            <select
              value={field.fmt || 'dec'}
              onChange={(e) => onChange({ fmt: e.target.value })}
              className="text-[11.5px] bg-white border border-zinc-200 rounded h-6 px-1.5 ring-accent"
            >
              <option value="dec">decimal</option>
              <option value="hex">hex</option>
              <option value="f1">float .1</option>
              <option value="f2">float .2</option>
              <option value="time">time (ms)</option>
            </select>
          } />
        )}
        <PropRow label="Unit" value={
          <input
            value={field.unit || ''}
            placeholder="—"
            onChange={(e) => onChange({ unit: e.target.value })}
            className="text-[11.5px] w-full bg-white border border-zinc-200 rounded px-1.5 h-6 ring-accent"
          />
        } />
        <div className="col-span-2">
          <PropRow label="Comment" value={
            <textarea
              value={field.note || ''}
              placeholder="What this field means, its expected range, source / spec reference…"
              onChange={(e) => onChange({ note: e.target.value })}
              rows={2}
              className="text-[11.5px] w-full bg-white border border-zinc-200 rounded px-1.5 py-1 ring-accent resize-y leading-snug"
            />
          } />
        </div>
      </div>
      <div className="px-3 pb-3">
        <div className="rounded-md border border-zinc-200 bg-white p-2.5">
          <div className="flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Current</div>
            <div className="flex-1" />
            <div className="mono text-[10px] text-zinc-400">
              raw {decoded?.value?.raw !== undefined
                ? '0x' + decoded.value.raw.toString(16).toUpperCase().padStart(field.size * 2, '0')
                : (decoded ? '' : '—')}
            </div>
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <div className="mono text-[22px] tabular font-semibold text-zinc-900 leading-none truncate">
              {decoded ? formatField(field, decoded) : '—'}
            </div>
            {field.unit && <div className="text-[12px] text-zinc-500">{field.unit}</div>}
          </div>
          {num && history && history.length > 5 && (
            <div className="mt-2">
              <Sparkline values={history.slice(-80)} width={300} height={32} />
              <div className="flex justify-between text-[10px] text-zinc-400 mono mt-0.5">
                <span>min {Math.min(...history).toFixed(2)}</span>
                <span>avg {(history.reduce((a, b) => a + b, 0) / history.length).toFixed(2)}</span>
                <span>max {Math.max(...history).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyStructPlaceholder({ onAdd, onOpenLibrary }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center">
      <div className="text-[12.5px] font-medium text-zinc-700">No fields defined</div>
      <div className="text-[11px] text-zinc-500 mt-1 mb-4">
        Define how packets on this connection should be parsed.
      </div>
      <div className="flex flex-col items-stretch gap-2 w-[200px]">
        <button
          onClick={onOpenLibrary}
          className="h-8 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-[12px] text-zinc-700 flex items-center justify-center gap-1.5"
        >
          <Icon name="doc" size={12} /> Load from library
        </button>
        <button
          onClick={onAdd}
          className="h-8 rounded-md border border-dashed border-zinc-300 bg-white hover:bg-zinc-50 text-[12px] text-zinc-500 flex items-center justify-center gap-1.5"
        >
          <Icon name="plus" size={12} /> Add first field
        </button>
      </div>
    </div>
  );
}
