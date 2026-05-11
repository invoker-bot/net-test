import { useEffect, useRef, useState } from 'react';
import { cx } from '../lib/utils.js';

const PANEL_STYLE = {
  position: 'fixed', zIndex: 2147483646, width: 280,
  maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
  background: 'rgba(250,249,247,.92)', color: '#29261b',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)', backdropFilter: 'blur(24px) saturate(160%)',
  border: '.5px solid rgba(255,255,255,.6)', borderRadius: 14,
  boxShadow: '0 1px 0 rgba(255,255,255,.5) inset, 0 12px 40px rgba(0,0,0,.18)',
  font: '11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif', overflow: 'hidden',
};

export function TweaksPanel({ title = 'Tweaks', open, onClose, children }) {
  const dragRef = useRef(null);
  const [pos, setPos] = useState({ x: 16, y: 16 });

  if (!open) return null;
  return (
    <div ref={dragRef} style={{ ...PANEL_STYLE, right: pos.x, bottom: pos.y }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px 10px 14px', cursor: 'move', userSelect: 'none' }}
        onMouseDown={(e) => {
          const startX = e.clientX, startY = e.clientY;
          const startPos = { ...pos };
          const onMove = (ev) => setPos({
            x: Math.max(8, startPos.x - (ev.clientX - startX)),
            y: Math.max(8, startPos.y - (ev.clientY - startY)),
          });
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        <b style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.01em' }}>{title}</b>
        <button onClick={onClose} onMouseDown={(e) => e.stopPropagation()} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'rgba(41,38,27,.55)', width: 22, height: 22, borderRadius: 6, fontSize: 13 }}>✕</button>
      </div>
      <div style={{ padding: '2px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

export function TweakSection({ label, children }) {
  return (
    <>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(41,38,27,.45)', paddingTop: 10 }}>{label}</div>
      {children}
    </>
  );
}

function Row({ label, value, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(41,38,27,.72)' }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {value != null && <span style={{ color: 'rgba(41,38,27,.5)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <Row label={label} value={`${value}${unit}`}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%' }} />
    </Row>
  );
}

export function TweakToggle({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontWeight: 500, color: 'rgba(41,38,27,.72)' }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          position: 'relative', width: 32, height: 18, border: 0, borderRadius: 999,
          background: value ? '#34c759' : 'rgba(0,0,0,.15)', cursor: 'pointer', padding: 0,
        }}
      >
        <i style={{ position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.25)', transform: value ? 'translateX(14px)' : 'none', transition: 'transform .15s' }} />
      </button>
    </div>
  );
}

export function TweakRadio({ label, value, options, onChange }) {
  return (
    <Row label={label}>
      <div style={{ display: 'flex', padding: 2, borderRadius: 8, background: 'rgba(0,0,0,.06)' }}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          const on = v === value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              style={{
                appearance: 'none', flex: 1, border: 0,
                background: on ? 'rgba(255,255,255,.9)' : 'transparent',
                color: 'inherit', font: 'inherit', fontWeight: 500, minHeight: 22,
                borderRadius: 6, cursor: 'pointer', padding: '4px 6px',
                boxShadow: on ? '0 1px 2px rgba(0,0,0,.12)' : 'none',
              }}
            >{l}</button>
          );
        })}
      </div>
    </Row>
  );
}

export function TweakSelect({ label, value, options, onChange }) {
  return (
    <Row label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', height: 26, padding: '0 22px 0 8px', border: '.5px solid rgba(0,0,0,.1)', borderRadius: 7, background: 'rgba(255,255,255,.6)', color: 'inherit', font: 'inherit' }}
      >
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </Row>
  );
}

// Truncate paths in the middle: keep head + tail so the user can recognize both
// the drive/volume and the leaf folder, drop the chewy middle.
function truncatePath(p, max = 38) {
  if (!p || p.length <= max) return p || '';
  const keep = Math.floor((max - 1) / 2);
  return p.slice(0, keep) + '…' + p.slice(-keep);
}

const TWEAK_BTN_STYLE = {
  appearance: 'none', border: '.5px solid rgba(0,0,0,.1)',
  background: 'rgba(255,255,255,.6)', color: 'inherit', font: 'inherit',
  height: 24, padding: '0 10px', borderRadius: 6, cursor: 'pointer',
  fontWeight: 500,
};

export function TweakPath({ label, value, isDefault, onChange, onOpen, onReset }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: 'rgba(41,38,27,.72)' }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {isDefault && <span style={{ fontSize: 9.5, color: 'rgba(41,38,27,.4)' }}>default</span>}
      </div>
      <div
        title={value}
        style={{
          fontFamily: 'var(--mono)', fontSize: 10.5,
          color: 'rgba(41,38,27,.6)', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
          background: 'rgba(0,0,0,.04)', border: '.5px solid rgba(0,0,0,.06)',
          borderRadius: 6, padding: '5px 8px',
        }}
      >{truncatePath(value)}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={onChange} style={{ ...TWEAK_BTN_STYLE, flex: 1 }}>Change…</button>
        <button type="button" onClick={onOpen} style={TWEAK_BTN_STYLE}>Open</button>
        {!isDefault && (
          <button type="button" onClick={onReset} style={TWEAK_BTN_STYLE}>Reset</button>
        )}
      </div>
    </div>
  );
}

export function TweakColor({ label, value, options, onChange }) {
  return (
    <Row label={label}>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            style={{
              flex: 1, height: 28, border: 0, borderRadius: 6,
              background: c, cursor: 'pointer',
              boxShadow: value === c
                ? '0 0 0 1.5px rgba(0,0,0,.85), 0 2px 6px rgba(0,0,0,.15)'
                : '0 0 0 .5px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.06)',
            }}
            title={c}
          />
        ))}
      </div>
    </Row>
  );
}

export function useTweaks(defaults) {
  const key = 'nettest.tweaks.v1';
  const [values, setValues] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return { ...defaults, ...JSON.parse(stored) };
    } catch {}
    return defaults;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(values)); } catch {}
  }, [values]);
  const setTweak = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));
  return [values, setTweak];
}
