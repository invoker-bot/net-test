import { useEffect, useState } from 'react';
import { DEFAULT_STRUCT } from './parser.js';

const LS_KEY = 'nettest.structs.v1';

function loadLibrary() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultLibrary();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return defaultLibrary();
    return arr;
  } catch {
    return defaultLibrary();
  }
}

function saveLibrary(arr) {
  try {
    // Strip transient fields; keep only the schema.
    const clean = arr.map((p) => ({
      name: p.name,
      endian: p.endian,
      size: p.size,
      fields: p.fields,
      builtin: !!p.builtin,
    }));
    localStorage.setItem(LS_KEY, JSON.stringify(clean));
  } catch {}
}

function defaultLibrary() {
  return [
    { ...DEFAULT_STRUCT, builtin: true },
    {
      name: 'CommonHeader', endian: 'LE', size: 8, builtin: true,
      fields: [
        { id: 'h_magic',  name: 'magic',   type: 'uint16',  offset: 0, size: 2, colorIdx: 0, fmt: 'hex' },
        { id: 'h_ver',    name: 'version', type: 'uint8',   offset: 2, size: 1, colorIdx: 1, fmt: 'dec' },
        { id: 'h_type',   name: 'msgType', type: 'enum:u8', offset: 3, size: 1, colorIdx: 2 },
        { id: 'h_seq',    name: 'seq',     type: 'uint16',  offset: 4, size: 2, colorIdx: 3, fmt: 'dec' },
        { id: 'h_len',    name: 'length',  type: 'uint16',  offset: 6, size: 2, colorIdx: 4, fmt: 'dec' },
      ],
    },
    {
      name: 'Modbus RTU', endian: 'BE', size: 8, builtin: true,
      fields: [
        { id: 'm_addr', name: 'slaveAddr', type: 'uint8',  offset: 0, size: 1, colorIdx: 7, fmt: 'dec' },
        { id: 'm_fc',   name: 'funcCode',  type: 'uint8',  offset: 1, size: 1, colorIdx: 8, fmt: 'hex' },
        { id: 'm_data', name: 'data',      type: 'string', offset: 2, size: 4, colorIdx: 9 },
        { id: 'm_crc',  name: 'crc16',     type: 'uint16', offset: 6, size: 2, colorIdx: 0, fmt: 'hex' },
      ],
    },
  ];
}

export function useStructLibrary() {
  const [lib, setLib] = useState(loadLibrary);
  useEffect(() => { saveLibrary(lib); }, [lib]);

  const savePreset = (struct, name) => {
    const clean = {
      name: name || struct.name || 'Untitled',
      endian: struct.endian,
      size: struct.size,
      fields: struct.fields.map((f) => ({ ...f })),
    };
    setLib((arr) => {
      const idx = arr.findIndex((p) => p.name === clean.name && !p.builtin);
      if (idx >= 0) {
        const next = arr.slice();
        next[idx] = clean;
        return next;
      }
      return [...arr, clean];
    });
    return clean;
  };

  const deletePreset = (name) => setLib((arr) => arr.filter((p) => !(p.name === name && !p.builtin)));

  return { lib, savePreset, deletePreset };
}

export function cloneStructForUse(preset) {
  return {
    name: preset.name,
    endian: preset.endian,
    size: preset.size,
    fields: preset.fields.map((f, i) => ({ ...f, id: f.id || ('f' + i + '_' + Date.now().toString(36)) })),
  };
}

export function embedPresetInto(struct, preset) {
  const base = struct.fields.length ? Math.max(...struct.fields.map((f) => f.offset + f.size)) : 0;
  const newFields = preset.fields.map((f, i) => ({
    ...f,
    id: 'e' + Date.now().toString(36) + '_' + i,
    offset: base + f.offset,
    colorIdx: (struct.fields.length + i) % 13,
  }));
  const fields = [...struct.fields, ...newFields];
  const size = Math.max(struct.size || 0, ...fields.map((f) => f.offset + f.size));
  return { ...struct, fields, size };
}
