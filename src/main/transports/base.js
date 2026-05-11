import { EventEmitter } from 'node:events';

export class BaseTransport extends EventEmitter {
  _setStatus(s, err) { this.emit('status', s, err); }
  _emitBytes(bytes, dir = 'rx') {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    this.emit('packet', bytes, dir);
  }
}

export function parseAddr(addr) {
  const m = (addr || '').match(/^\[?([^\]]+?)\]?:(\d+)$/);
  if (!m) return { host: '0.0.0.0', port: 0 };
  return { host: m[1] || '0.0.0.0', port: parseInt(m[2], 10) || 0 };
}
