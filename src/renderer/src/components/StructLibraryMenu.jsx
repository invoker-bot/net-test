import { useState } from 'react';
import { Button } from './ui/Button.jsx';
import { Icon } from './ui/Icon.jsx';

export function StructLibraryMenu({ library, struct, onLoad, onEmbed, onSave, onDelete, onClose }) {
  const [name, setName] = useState(struct.name || 'Untitled');
  return (
    <div
      role="dialog"
      className="absolute right-2 top-9 z-30 w-[300px] rounded-lg border border-zinc-200 bg-white shadow-[0_12px_32px_-12px_rgba(0,0,0,.18)] overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-zinc-100 flex items-center gap-2">
        <Icon name="doc" size={12} className="text-zinc-500" />
        <span className="text-[12px] font-semibold text-zinc-800">Struct library</span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-800 p-0.5" title="Close">
          <Icon name="x" size={11} />
        </button>
      </div>

      <div className="p-3 border-b border-zinc-100 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">Save current as</div>
        <div className="flex items-center gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name"
            className="flex-1 h-7 text-[12px] px-2 border border-zinc-200 rounded ring-accent"
          />
          <Button size="xs" variant="primary" onClick={() => onSave(name.trim() || 'Untitled')}>Save</Button>
        </div>
      </div>

      <div className="max-h-[260px] overflow-auto scroll-thin">
        {library.map((p) => (
          <div key={p.name + (p.builtin ? '#b' : '')} className="group px-3 py-2 hover:bg-zinc-50 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-medium text-zinc-900 truncate">{p.name}</span>
                {p.builtin && <span className="text-[9px] uppercase tracking-wider text-zinc-400">builtin</span>}
              </div>
              <div className="mono text-[10px] text-zinc-400 tabular">
                {p.fields.length} fields · {p.size}B · {p.endian}
              </div>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEmbed(p)}
                title="Append fields to current struct"
                className="text-[10px] px-1.5 h-5 rounded border border-zinc-200 hover:bg-white text-zinc-600"
              >embed</button>
              <button
                onClick={() => onLoad(p)}
                title="Replace current struct"
                className="text-[10px] px-1.5 h-5 rounded border border-zinc-200 hover:bg-white text-zinc-600"
              >load</button>
              {!p.builtin && (
                <button
                  onClick={() => onDelete(p.name)}
                  title="Delete preset"
                  className="text-[10px] px-1 h-5 rounded text-rose-600 hover:bg-rose-50"
                ><Icon name="trash" size={10} /></button>
              )}
            </div>
          </div>
        ))}
        {!library.length && (
          <div className="px-3 py-6 text-center text-[11px] text-zinc-400">No saved structs yet</div>
        )}
      </div>
    </div>
  );
}
