// Connections start with this empty schema — the user adds fields manually
// or loads a preset from the struct library (which still ships SensorPacket
// + CommonHeader + Modbus RTU as builtins).
export const EMPTY_STRUCT = {
  name: 'Untitled',
  endian: 'LE',
  size: 0,
  fields: [],
};

export const DEFAULT_STRUCT = {
  name: 'SensorPacket',
  size: 32,
  endian: 'LE',
  fields: [
    { id: 'magic',     name: 'magic',       type: 'uint16',  offset: 0,  size: 2, endian: 'LE', colorIdx: 0,  fmt: 'hex',  note: 'sync word 0xCAFE' },
    { id: 'version',   name: 'version',     type: 'uint8',   offset: 2,  size: 1,                colorIdx: 1,  fmt: 'dec',  note: 'protocol version' },
    { id: 'msgType',   name: 'msgType',     type: 'enum:u8', offset: 3,  size: 1,                colorIdx: 2,  fmt: 'enum', note: 'message kind',
      enumMap: { 0x10: 'TELEMETRY', 0x11: 'HEARTBEAT', 0x20: 'COMMAND', 0x21: 'ACK' } },
    { id: 'seq',       name: 'seq',         type: 'uint16',  offset: 4,  size: 2, endian: 'LE', colorIdx: 3,  fmt: 'dec',  note: 'rolling sequence' },
    { id: 'timestamp', name: 'timestamp',   type: 'uint32',  offset: 6,  size: 4, endian: 'LE', colorIdx: 4,  fmt: 'time', note: 'ms since boot' },
    { id: 'temp',      name: 'temperature', type: 'float32', offset: 10, size: 4, endian: 'LE', colorIdx: 5,  fmt: 'f2',   unit: '°C' },
    { id: 'hum',       name: 'humidity',    type: 'float32', offset: 14, size: 4, endian: 'LE', colorIdx: 6,  fmt: 'f1',   unit: '%' },
    { id: 'pres',      name: 'pressure',    type: 'float32', offset: 18, size: 4, endian: 'LE', colorIdx: 7,  fmt: 'f2',   unit: 'hPa' },
    { id: 'flags',     name: 'flags',       type: 'bitfield', offset: 22, size: 2, endian: 'LE', colorIdx: 8, fmt: 'bits',
      bits: [
        { name: 'alarm', bit: 0 }, { name: 'lowBatt', bit: 1 }, { name: 'charging', bit: 2 },
        { name: 'fault', bit: 3 }, { name: 'calibrated', bit: 4 }, { name: 'linked', bit: 5 },
      ] },
    { id: 'battery',   name: 'battery',     type: 'uint8',   offset: 24, size: 1,                colorIdx: 9,  fmt: 'dec',  unit: '%' },
    { id: 'rssi',      name: 'rssi',        type: 'int8',    offset: 25, size: 1,                colorIdx: 10, fmt: 'dec',  unit: 'dBm' },
    { id: 'node',      name: 'node',        type: 'string',  offset: 26, size: 4,                colorIdx: 11, fmt: 'str',  note: 'ASCII id' },
    { id: 'crc',       name: 'crc',         type: 'uint16',  offset: 30, size: 2, endian: 'LE', colorIdx: 12, fmt: 'hex' },
  ],
};

export const SUPPORTED_TYPES = [
  'uint8', 'uint16', 'uint32', 'uint64',
  'int8', 'int16', 'int32', 'int64',
  'float32', 'float64',
  'string', 'bitfield', 'enum:u8', 'padding',
];

export const TYPE_SIZE = {
  uint8: 1, int8: 1, uint16: 2, int16: 2, uint32: 4, int32: 4,
  uint64: 8, int64: 8, float32: 4, float64: 8,
};

export function isNumericLike(f) {
  return /^(uint|int|float)/.test(f.type);
}

export function decodeField(bytes, f, structEndian = 'LE') {
  if (!bytes || bytes.length < f.offset + f.size) return { value: null };
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(arr.buffer, arr.byteOffset + f.offset, f.size);
  const le = (f.endian || structEndian) === 'LE';
  let v;
  switch (f.type) {
    case 'uint8':   v = dv.getUint8(0); break;
    case 'int8':    v = dv.getInt8(0); break;
    case 'uint16':  v = dv.getUint16(0, le); break;
    case 'int16':   v = dv.getInt16(0, le); break;
    case 'uint32':  v = dv.getUint32(0, le); break;
    case 'int32':   v = dv.getInt32(0, le); break;
    case 'uint64':  v = dv.getBigUint64(0, le); break;
    case 'int64':   v = dv.getBigInt64(0, le); break;
    case 'float32': v = dv.getFloat32(0, le); break;
    case 'float64': v = dv.getFloat64(0, le); break;
    case 'string': {
      let s = '';
      for (let i = 0; i < f.size; i++) {
        const c = dv.getUint8(i);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      v = s; break;
    }
    case 'enum:u8': {
      const k = dv.getUint8(0);
      v = { key: k, label: (f.enumMap && f.enumMap[k]) || 'UNKNOWN' };
      break;
    }
    case 'bitfield': {
      const raw = f.size === 1 ? dv.getUint8(0) : f.size === 2 ? dv.getUint16(0, le) : dv.getUint32(0, le);
      const bits = (f.bits || []).map((b) => ({ name: b.name, bit: b.bit, on: ((raw >>> b.bit) & 1) === 1 }));
      v = { raw, bits };
      break;
    }
    case 'padding': v = null; break;
    default: v = null;
  }
  return { value: v };
}

export function formatField(f, decoded) {
  if (!decoded || decoded.value == null) return '—';
  const v = decoded.value;
  switch (f.fmt) {
    case 'hex':
      if (f.size === 1) return '0x' + Number(v).toString(16).toUpperCase().padStart(2, '0');
      if (f.size === 2) return '0x' + Number(v).toString(16).toUpperCase().padStart(4, '0');
      if (f.size === 4) return '0x' + Number(v).toString(16).toUpperCase().padStart(8, '0');
      return '0x' + Number(v).toString(16).toUpperCase();
    case 'dec':  return String(typeof v === 'bigint' ? v.toString() : v);
    case 'f1':   return Number(v).toFixed(1);
    case 'f2':   return Number(v).toFixed(2);
    case 'time': return (Number(v) / 1000).toFixed(2) + ' s';
    case 'str':  return JSON.stringify(v);
    case 'enum': return `${v.label} (0x${v.key.toString(16).toUpperCase().padStart(2, '0')})`;
    case 'bits': return '0x' + v.raw.toString(16).toUpperCase().padStart(f.size * 2, '0');
    default:     return String(v);
  }
}

export function isInt(f) {
  return /^(uint|int)(8|16|32|64)$/.test(f.type);
}

export function typeMax(f) {
  const m = {
    uint8: 255, uint16: 65535, uint32: 0xFFFFFFFF, uint64: Number.MAX_SAFE_INTEGER,
    int8: 127, int16: 32767, int32: 0x7FFFFFFF, int64: Number.MAX_SAFE_INTEGER,
    float32: 100, float64: 100,
  };
  return m[f.type] ?? 255;
}

export function typeMin(f) {
  const m = {
    int8: -128, int16: -32768, int32: -0x80000000, int64: -Number.MAX_SAFE_INTEGER,
    float32: -100, float64: -100,
  };
  return m[f.type] ?? 0;
}

// Stateful generator state, keyed by field id (module-level so it persists across renders).
const _genState = {};

// `ctx` lets generators read live state outside their own closure — currently
// only used by `bound`, which pulls its value from another connection's most
// recent decoded packet via ctx.getLatestValue(connId, fieldName).
export function nextValue(field, cfg, ctx) {
  const k = field.id;
  const st = (_genState[k] = _genState[k] || {});
  switch (cfg.kind) {
    case 'const': return cfg.num ?? 0;
    case 'bound': {
      const src = ctx?.getLatestValue?.(cfg.sourceConnId, cfg.sourceField);
      const x = typeof src === 'number' && Number.isFinite(src) ? src : 0;
      return x * (cfg.scale ?? 1) + (cfg.offset ?? 0);
    }
    case 'uniform': {
      const v = cfg.min + Math.random() * (cfg.max - cfg.min);
      return isInt(field) ? Math.round(v) : v;
    }
    case 'gauss': {
      const u1 = Math.random() || 1e-9, u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const v = (cfg.mean ?? 0) + z * (cfg.sigma ?? 1);
      return isInt(field) ? Math.round(v) : v;
    }
    case 'walk': {
      if (st.v === undefined) st.v = cfg.value ?? 0;
      st.v += (Math.random() * 2 - 1) * (cfg.sigma ?? 1);
      if (cfg.min !== undefined) st.v = Math.max(cfg.min, st.v);
      if (cfg.max !== undefined) st.v = Math.min(cfg.max, st.v);
      return isInt(field) ? Math.round(st.v) : st.v;
    }
    case 'sine': {
      if (st.t === undefined) st.t = 0;
      st.t += 1;
      const v = (cfg.center ?? 0) + (cfg.amp ?? 1) * Math.sin(2 * Math.PI * st.t / (cfg.period || 60));
      return isInt(field) ? Math.round(v) : v;
    }
    case 'counter': {
      if (st.n === undefined) st.n = cfg.start ?? 0;
      const v = st.n;
      st.n += (cfg.step ?? 1);
      return v;
    }
    case 'ramp': {
      if (st.n === undefined) st.n = cfg.min ?? 0;
      const v = st.n;
      st.n += (cfg.step ?? 1);
      if (cfg.max !== undefined && st.n > cfg.max) st.n = cfg.min ?? 0;
      return v;
    }
  }
  return 0;
}

export function defaultGen(f) {
  if (f.type === 'string')  return { kind: 'const', str: (f.unit || 'id') };
  if (f.type === 'padding') return { kind: 'const', num: 0 };
  if (f.type === 'bitfield' || f.type === 'enum:u8') return { kind: 'const', num: 0 };
  if (/seq|count|index/i.test(f.name)) return { kind: 'counter', start: 0, step: 1 };
  if (/temp|hum|press|rssi|bat/i.test(f.name)) return { kind: 'sine', center: 25, amp: 5, period: 60 };
  if (/lat|lng|lon/i.test(f.name)) return { kind: 'walk', value: 0, sigma: 0.0001 };
  if (/magic|version|type|msg/i.test(f.name)) return { kind: 'const', num: f.size === 2 ? 0xCAFE : 1 };
  return { kind: 'uniform', min: 0, max: typeMax(f) };
}

export function resetCfg(field, kind) {
  switch (kind) {
    case 'const':   return { kind, num: 0 };
    case 'uniform': return { kind, min: typeMin(field), max: typeMax(field) };
    case 'gauss':   return { kind, mean: 0, sigma: Math.max(1, typeMax(field) * 0.1) };
    case 'walk':    return { kind, value: 0, sigma: Math.max(1, typeMax(field) * 0.01), min: typeMin(field), max: typeMax(field) };
    case 'sine':    return { kind, center: 0, amp: Math.max(1, typeMax(field) * 0.5), period: 60 };
    case 'counter': return { kind, start: 0, step: 1 };
    case 'ramp':    return { kind, min: 0, max: typeMax(field), step: 1 };
    case 'bound':   return { kind, sourceConnId: '', sourceField: '', scale: 1, offset: 0 };
  }
  return { kind: 'const', num: 0 };
}

export function generateBytes(struct, gen, ctx) {
  const total = struct.size || (struct.fields.length ? Math.max(...struct.fields.map((f) => f.offset + f.size)) : 0);
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  for (const f of struct.fields) {
    const cfg = gen[f.id] || defaultGen(f);
    const le = (f.endian || struct.endian) === 'LE';
    if (f.type === 'string') {
      const s = (cfg.kind === 'const' ? (cfg.str || '') : '');
      const enc = new TextEncoder().encode(s);
      for (let i = 0; i < f.size; i++) u8[f.offset + i] = enc[i] || 0;
      continue;
    }
    if (f.type === 'padding') continue;
    if (f.type === 'bitfield' || f.type === 'enum:u8') {
      view.setUint8(f.offset, (cfg.num | 0) & 0xFF);
      continue;
    }
    const v = nextValue(f, cfg, ctx);
    try {
      switch (f.type) {
        case 'uint8':   view.setUint8(f.offset, v & 0xFF); break;
        case 'int8':    view.setInt8(f.offset, v); break;
        case 'uint16':  view.setUint16(f.offset, v & 0xFFFF, le); break;
        case 'int16':   view.setInt16(f.offset, v, le); break;
        case 'uint32':  view.setUint32(f.offset, v >>> 0, le); break;
        case 'int32':   view.setInt32(f.offset, v | 0, le); break;
        case 'float32': view.setFloat32(f.offset, v, le); break;
        case 'float64': view.setFloat64(f.offset, v, le); break;
        case 'uint64':  view.setBigUint64(f.offset, BigInt(Math.max(0, Math.trunc(v))), le); break;
        case 'int64':   view.setBigInt64(f.offset, BigInt(Math.trunc(v)), le); break;
      }
    } catch {}
  }
  return u8;
}
