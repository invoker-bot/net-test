export function cx(...xs) {
  return xs.filter(Boolean).join(' ');
}

export function formatRate(bps) {
  if (!bps || bps < 1) return '0 B/s';
  if (bps < 1024) return Math.round(bps) + ' B/s';
  if (bps < 1024 * 1024) return (bps / 1024).toFixed(1) + ' KB/s';
  return (bps / 1024 / 1024).toFixed(2) + ' MB/s';
}

export function hexToBytes(text) {
  const clean = (text || '').replace(/[^0-9a-fA-F]/g, '');
  const len = Math.floor(clean.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function bytesToHexSpaced(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

export function strToBytes(str, enc) {
  if (enc === 'utf-8') return new TextEncoder().encode(str);
  if (enc === 'ascii') {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      out[i] = c > 0x7f ? 0x3f : c;
    }
    return out;
  }
  if (enc === 'latin1') {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      out[i] = c > 0xff ? 0x3f : c;
    }
    return out;
  }
  if (enc === 'utf-16le' || enc === 'utf-16be') {
    const out = new Uint8Array(str.length * 2);
    const view = new DataView(out.buffer);
    const le = enc === 'utf-16le';
    for (let i = 0; i < str.length; i++) view.setUint16(i * 2, str.charCodeAt(i), le);
    return out;
  }
  return new TextEncoder().encode(str);
}

export function bytesToStr(bytes, enc) {
  try {
    if (enc === 'utf-8') return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (enc === 'ascii') {
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0x7f);
      return s;
    }
    if (enc === 'latin1') {
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return s;
    }
    if (enc === 'utf-16le' || enc === 'utf-16be') {
      const len = Math.floor(bytes.length / 2);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const le = enc === 'utf-16le';
      let s = '';
      for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint16(i * 2, le));
      return s;
    }
  } catch {}
  return '';
}
