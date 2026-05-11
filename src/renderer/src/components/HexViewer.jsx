import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cx, formatRate } from '../lib/utils.js';
import { Badge } from './ui/Badge.jsx';
import { Button } from './ui/Button.jsx';
import { Icon } from './ui/Icon.jsx';

const FIELD_BG = (i) => 'field-bg-' + (((i % 13) + 13) % 13);
const EMPTY_SET = new Set();

export function HexViewer({
  conn, packets, struct, hoveredFieldId, onHoverField,
  cols, mono, follow, setFollow, paused, setPaused,
  rateBps, search, setSearch, showFieldTints, onClear, onReply,
  selectedPktKey, onSelectPacket, pktKey,
}) {
  const [dirFilter, setDirFilter] = useState('all');
  // Cap visible cards to the most recent N to keep DOM size manageable.
  // The full 1000-packet ring lives upstream; we only render a tail window.
  // 80 cards × ~64 spans each ≈ 5k DOM nodes — comfortable for live scroll.
  const VISIBLE_CAP = 80;
  const filteredPackets = useMemo(() => {
    const base = dirFilter === 'all' ? packets : packets.filter((p) => p.dir === dirFilter);
    return base.length > VISIBLE_CAP ? base.slice(-VISIBLE_CAP) : base;
  }, [packets, dirFilter]);
  const scrollRef = useRef(null);

  // Offsets within each packet start at 0 (per-packet, not cumulative across
  // the stream). This keeps memoized PacketCards stable when older packets
  // roll off the front of the buffer.

  // Auto-follow: jump to bottom whenever new packets arrive. We use
  // requestAnimationFrame to coalesce multiple packet arrivals into one
  // scroll within the same paint frame, avoiding sync layout thrashing.
  useLayoutEffect(() => {
    if (!follow || paused) return;
    const el = scrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    return () => cancelAnimationFrame(raf);
  }, [filteredPackets, follow, paused]);

  const searchBytes = useMemo(() => {
    const clean = (search || '').replace(/[^0-9a-f]/gi, '');
    if (clean.length < 2 || clean.length % 2 !== 0) return null;
    const out = [];
    for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.substr(i, 2), 16));
    return out;
  }, [search]);

  // Stable empty Set when no search is active so the memoized PacketCards
  // don't see a fresh reference on every packet arrival.
  const searchHits = useMemo(() => {
    if (!searchBytes) return EMPTY_SET;
    const flat = [];
    for (const p of packets) for (const b of p.bytes) flat.push(b);
    const hits = new Set();
    for (let i = 0; i <= flat.length - searchBytes.length; i++) {
      let ok = true;
      for (let j = 0; j < searchBytes.length; j++) if (flat[i + j] !== searchBytes[j]) { ok = false; break; }
      if (ok) for (let j = 0; j < searchBytes.length; j++) hits.add(i + j);
    }
    return hits;
  }, [searchBytes, packets]);

  const fieldByOffset = useMemo(() => {
    const m = new Array(struct.size).fill(null);
    for (const f of struct.fields) {
      for (let i = 0; i < f.size; i++) m[f.offset + i] = f;
    }
    return m;
  }, [struct]);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-11 px-3 flex items-center gap-2 border-b border-zinc-200 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] font-semibold text-zinc-900 whitespace-nowrap truncate">{conn?.name || '—'}</span>
          <Badge tone="zinc" className="!h-[16px]">{conn?.proto}</Badge>
          <span className="mono text-[11px] text-zinc-500 ml-1">{conn?.endpoint}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <span className="mono text-[11px] tabular text-zinc-500">{packets.length} / 1000 pkt</span>
          <span className="text-zinc-300">·</span>
          <span className="mono text-[11px] tabular text-zinc-500">{formatRate(rateBps)}</span>
        </div>
      </div>

      <div className="h-9 px-3 flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60">
        <div className="relative flex-1 max-w-[280px]">
          <Icon name="search" size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find hex pattern  e.g.  FE CA"
            className="mono w-full h-7 pl-7 pr-2 text-[11.5px] rounded-md bg-white border border-zinc-200 placeholder:text-zinc-400 ring-accent"
          />
        </div>
        <div className="flex items-center text-[10px] text-zinc-500 mr-1">
          {searchBytes && <span className="mono">{searchHits.size ? 'hits ' + (searchHits.size / searchBytes.length).toFixed(0) : 'no match'}</span>}
        </div>
        <div className="h-5 w-px bg-zinc-200 mx-1" />
        <div className="inline-flex rounded-md border border-zinc-200 p-0.5 h-7 mr-1">
          {[{ k: 'all', label: 'All' }, { k: 'rx', label: 'RX' }, { k: 'tx', label: 'TX' }].map((o) => (
            <button
              key={o.k}
              onClick={() => setDirFilter(o.k)}
              className={cx(
                'px-2 text-[11px] rounded mono',
                dirFilter === o.k ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-800',
              )}
            >{o.label}</button>
          ))}
        </div>
        <Button size="xs" variant={paused ? 'primary' : 'ghost'} onClick={() => setPaused(!paused)}>
          <Icon name={paused ? 'play' : 'pause'} size={11} />
          {paused ? 'Resume' : 'Pause'}
        </Button>
        {paused && (
          <>
            <Button size="xs" variant="ghost" title="Scroll to top" onClick={() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }}>
              <Icon name="chevron" size={11} className="-rotate-90" /> Top
            </Button>
            <Button size="xs" variant="ghost" title="Scroll to bottom" onClick={() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }}>
              <Icon name="chevron" size={11} className="rotate-90" /> Bottom
            </Button>
          </>
        )}
        <Button size="xs" variant="ghost" onClick={() => setFollow(!follow)}>
          <span className={cx('inline-block w-1.5 h-1.5 rounded-full', follow ? 'bg-emerald-500' : 'bg-zinc-300')} />
          Follow
        </Button>
        <Button size="xs" variant="ghost" title="Clear" onClick={onClear}>
          <Icon name="trash" size={11} />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto scroll-thin bg-zinc-50/40 px-3 py-2 space-y-1.5">
        {filteredPackets.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-[12px]">
            <div className="mono">no packets yet</div>
            <div className="text-[11px] mt-1">start the connection or send a packet</div>
          </div>
        )}
        {filteredPackets.map((pkt) => {
          const key = `${pkt.tms}-${pkt.seq}-${pkt.dir}`;
          return (
            <PacketCard
              key={key}
              pkt={pkt}
              cols={cols}
              fieldByOffset={fieldByOffset}
              hoveredFieldId={hoveredFieldId}
              onHoverField={onHoverField}
              searchHits={searchHits}
              showFieldTints={showFieldTints}
              onReply={onReply}
              paused={paused}
              isSelected={pktKey && selectedPktKey && pktKey(pkt) === selectedPktKey}
              onSelectPacket={onSelectPacket}
            />
          );
        })}
        <div className="h-2" />
      </div>

      <div className="h-7 px-3 flex items-center gap-3 text-[11px] text-zinc-500 border-t border-zinc-200 bg-zinc-50">
        <span className="mono">cols: <b className="text-zinc-700">{cols}</b></span>
        <span className="mono">font: <b className="text-zinc-700">{mono}</b></span>
        <span className="mono">struct: <b className="text-zinc-700">{struct.name}</b> · {struct.size} B · {struct.endian}</span>
        <div className="flex-1" />
        {paused
          ? (selectedPktKey
            ? <span className="text-zinc-900 mono font-medium">◉ inspecting selected packet</span>
            : <span className="text-amber-600 mono">⏸ frozen — click any packet to inspect; otherwise showing latest</span>)
          : <span className="text-emerald-600 mono">● live</span>}
      </div>
    </div>
  );
}

const PacketCard = memo(function PacketCard({
  pkt, cols, fieldByOffset, hoveredFieldId, onHoverField, searchHits, showFieldTints,
  onReply, paused, isSelected, onSelectPacket,
}) {
  const dir = pkt.dir || 'rx';
  const rows = useMemo(() => {
    const out = [];
    for (let r = 0; r < pkt.bytes.length; r += cols) {
      out.push({
        base: r,
        localBase: r,
        bytes: Array.from(pkt.bytes.slice(r, r + cols)),
        isFirst: r === 0,
      });
    }
    return out;
  }, [pkt.bytes, cols]);

  return (
    <div
      onClick={() => paused && onSelectPacket && onSelectPacket(pkt)}
      className={cx(
        'group rounded-md border bg-white shadow-[0_1px_0_rgba(0,0,0,.02)] transition-all',
        paused ? 'cursor-pointer' : '',
        isSelected
          ? 'border-zinc-900 ring-2 ring-zinc-900/15 shadow-[0_4px_12px_-4px_rgba(0,0,0,.18)]'
          : (dir === 'tx' ? 'border-blue-200/70 hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,.08)]' : 'border-zinc-200 hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,.08)]'),
      )}
    >
      <table className="w-max mono text-[12px] leading-[18px]">
        <tbody>
          {rows.map((row, ri) => (
            <HexRow
              key={ri}
              row={row}
              pkt={pkt}
              cols={cols}
              fieldByOffset={fieldByOffset}
              hoveredFieldId={hoveredFieldId}
              onHoverField={onHoverField}
              searchHits={searchHits}
              showFieldTints={showFieldTints}
              onReply={onReply}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});

function HexRow({ row, pkt, cols, fieldByOffset, hoveredFieldId, onHoverField, searchHits, showFieldTints, onReply }) {
  const { base, bytes, isFirst, localBase } = row;
  const dir = pkt.dir || 'rx';
  return (
    <tr className={cx('group', isFirst && '[&>td]:pt-1.5')}>
      <td className="pl-2 pr-1 select-none w-0">
        {isFirst && (
          <span
            className={cx(
              'inline-flex items-center justify-center w-4 h-4 rounded mono text-[9px] font-bold',
              dir === 'tx' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700',
            )}
            title={dir.toUpperCase()}
          >{dir === 'tx' ? '↑' : '↓'}</span>
        )}
      </td>
      <td className="px-3 text-zinc-400 select-none">
        {base.toString(16).toUpperCase().padStart(6, '0')}
      </td>
      <td className="px-1">
        <div className="flex gap-[2px]">
          {bytes.map((b, i) => {
            const absInPkt = localBase + i;
            const f = fieldByOffset[absInPkt];
            const hovered = f && f.id === hoveredFieldId;
            const hit = searchHits.has(base + i);
            return (
              <span
                key={i}
                onMouseEnter={() => f && onHoverField(f.id)}
                onMouseLeave={() => f && onHoverField(null)}
                className={cx(
                  'px-[3px] rounded-[3px] tabular cursor-default',
                  showFieldTints && f && FIELD_BG(f.colorIdx),
                  hovered && 'field-hover',
                  hit && 'ring-1 ring-amber-400',
                )}
                title={f ? `${f.name} (${f.type})` : ''}
              >
                {b.toString(16).toUpperCase().padStart(2, '0')}
              </span>
            );
          })}
          {Array.from({ length: cols - bytes.length }).map((_, i) => (
            <span key={'pad' + i} className="px-[3px] text-zinc-300">··</span>
          ))}
        </div>
      </td>
      <td className="px-2 text-zinc-300 select-none">│</td>
      <td className="pr-3">
        <div className="flex">
          {bytes.map((b, i) => {
            const absInPkt = localBase + i;
            const f = fieldByOffset[absInPkt];
            const hovered = f && f.id === hoveredFieldId;
            const c = (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '·';
            return (
              <span
                key={i}
                onMouseEnter={() => f && onHoverField(f.id)}
                onMouseLeave={() => f && onHoverField(null)}
                className={cx(
                  'w-[8px] text-center rounded-[2px]',
                  showFieldTints && f && FIELD_BG(f.colorIdx),
                  hovered && 'field-hover',
                  (b < 0x20 || b >= 0x7f) && 'text-zinc-400',
                )}
              >{c}</span>
            );
          })}
        </div>
      </td>
      <td className="pl-4 pr-4 whitespace-nowrap">
        {isFirst && (
          <span className="text-[10.5px] text-zinc-400 inline-flex items-center gap-1.5">
            #{pkt.seq.toString().padStart(5, '0')} · {pkt.tms}ms
            {dir === 'rx' && onReply && (
              <button
                onClick={(e) => { e.stopPropagation(); onReply(pkt); }}
                className="opacity-0 group-hover:opacity-100 hover:bg-zinc-100 px-1.5 h-4 rounded text-[10px] border border-zinc-200 text-zinc-600 inline-flex items-center gap-0.5"
                title="Reply with hex or binary"
              >
                <Icon name="send" size={9} /> reply
              </button>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}
