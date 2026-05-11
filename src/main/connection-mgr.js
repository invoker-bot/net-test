import { promises as fs, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { TcpClientTransport, TcpServerTransport } from './transports/tcp.js';
import { UdpTransport } from './transports/udp.js';
import { WsClientTransport, WsServerTransport } from './transports/ws.js';
import { MockTransport } from './transports/mock.js';
import { SerialTransport, listSerialPorts } from './transports/serial.js';

export const IS_DEV = process.env.NODE_ENV === 'development' || !!process.env.ELECTRON_RENDERER_URL;

function newId(prefix = 'c') {
  return prefix + Math.random().toString(36).slice(2, 9);
}

const MOCK_CONNECTION = { id: 'c1', name: 'Mock Sensor', proto: 'MOCK', role: 'server', bind: 'mock://sensor', endpoint: 'mock://sensor', color: '#10b981' };

const REAL_DEFAULT_CONNECTIONS = [
  { id: 'c2', name: 'UDP Listener', proto: 'UDP', role: 'server', bind: '0.0.0.0:5005', endpoint: 'udp://0.0.0.0:5005', color: '#3b82f6' },
  { id: 'c3', name: 'TCP Server :7100', proto: 'TCP', role: 'server', bind: '0.0.0.0:7100', endpoint: 'tcp://0.0.0.0:7100', color: '#f59e0b' },
  { id: 'c4', name: 'Telemetry Client', proto: 'TCP', role: 'client', remote: '127.0.0.1:7100', endpoint: 'tcp://127.0.0.1:7100', color: '#8b5cf6' },
  { id: 'c5', name: 'WS Echo Client', proto: 'WS', role: 'client', remote: 'ws://echo.websocket.events', endpoint: 'ws://echo.websocket.events', color: '#ef4444' },
];

const DEFAULT_CONNECTIONS = IS_DEV ? [MOCK_CONNECTION, ...REAL_DEFAULT_CONNECTIONS] : REAL_DEFAULT_CONNECTIONS;

const STATE_FILE = path.join(app.getPath('userData'), 'state.json');
const STATE_VERSION = 1;

export class ConnectionManager {
  constructor(emit) {
    this.emit = emit;
    this.conns = new Map();
    this._saveTimer = null;
    this._loadInitial();
  }

  // Sync on purpose: runs at startup before the renderer can call
  // listConnections(), so a tiny blocking read avoids a race.
  _loadInitial() {
    let loaded = null;
    try {
      if (existsSync(STATE_FILE)) {
        const raw = readFileSync(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === STATE_VERSION && Array.isArray(parsed.connections)) {
          loaded = parsed.connections;
        }
      }
    } catch {
      // Corrupt or unreadable — fall back to defaults silently.
    }

    let list;
    if (loaded) {
      // In production, strip any MOCK leftover from a previous dev session.
      list = IS_DEV ? loaded : loaded.filter((c) => c.proto !== 'MOCK');
      // If everything got stripped or removed, reseed defaults so the
      // user isn't faced with an empty list.
      if (list.length === 0) list = DEFAULT_CONNECTIONS;
    } else {
      list = DEFAULT_CONNECTIONS;
    }

    for (const c of list) {
      this.conns.set(c.id, { ...c, status: 'idle', streaming: false });
    }
  }

  _scheduleSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._persist().catch(() => {}), 400);
  }

  async _persist() {
    const payload = {
      version: STATE_VERSION,
      connections: Array.from(this.conns.values()).map((c) => ({
        id: c.id, name: c.name, proto: c.proto, role: c.role,
        bind: c.bind, remote: c.remote, endpoint: c.endpoint, color: c.color,
      })),
    };
    const tmp = STATE_FILE + '.tmp';
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(payload, null, 2));
    await fs.rename(tmp, STATE_FILE);
  }

  list() {
    return Array.from(this.conns.values()).map(this._public);
  }

  _public(c) {
    return {
      id: c.id, name: c.name, proto: c.proto, role: c.role,
      bind: c.bind, remote: c.remote, endpoint: c.endpoint,
      color: c.color, status: c.status, streaming: !!c.streaming,
      lastError: c.lastError,
    };
  }

  _emitState(id) {
    const c = this.conns.get(id);
    if (!c) return;
    this.emit('conn:state', this._public(c));
  }

  _emitPacket(id, bytes, dir) {
    const c = this.conns.get(id);
    if (!c) return;
    this.emit('conn:packet', {
      id,
      bytes: Array.from(bytes),
      tms: Date.now(),
      dir,
    });
  }

  create(spec) {
    const id = spec.id || newId();
    const conn = {
      id,
      name: spec.name || 'New connection',
      proto: spec.proto || 'UDP',
      role: spec.role || 'server',
      bind: spec.bind || '0.0.0.0:0',
      remote: spec.remote || '127.0.0.1:0',
      endpoint: spec.endpoint || this._buildEndpoint(spec),
      color: spec.color || '#71717a',
      status: 'idle',
      streaming: false,
    };
    this.conns.set(id, conn);
    this._emitState(id);
    this._scheduleSave();
    return this._public(conn);
  }

  _buildEndpoint(c) {
    const proto = (c.proto || 'udp').toLowerCase();
    const addr = c.role === 'server' ? (c.bind || '0.0.0.0:0') : (c.remote || '127.0.0.1:0');
    if (proto === 'ser') return 'serial://' + addr;
    if (proto === 'ws') return (c.remote && c.remote.startsWith('ws')) ? c.remote : 'ws://' + addr;
    if (proto === 'mock') return 'mock://' + addr;
    return `${proto}://${addr}`;
  }

  async update(id, patch) {
    const c = this.conns.get(id);
    if (!c) return null;
    const wasStreaming = c.streaming;
    if (wasStreaming) await this._stopTransport(c);
    Object.assign(c, patch);
    c.endpoint = patch.endpoint || this._buildEndpoint(c);
    this._emitState(id);
    if (wasStreaming) await this.start(id).catch((e) => { c.lastError = e.message; this._emitState(id); });
    this._scheduleSave();
    return this._public(c);
  }

  async remove(id) {
    const c = this.conns.get(id);
    if (!c) return;
    await this._stopTransport(c);
    this.conns.delete(id);
    this.emit('conn:removed', { id });
    this._scheduleSave();
  }

  async start(id) {
    const c = this.conns.get(id);
    if (!c) throw new Error('unknown connection ' + id);
    if (c.transport) return;
    let t;
    switch (c.proto) {
      case 'TCP':
        t = c.role === 'server' ? new TcpServerTransport(c.bind) : new TcpClientTransport(c.remote);
        break;
      case 'UDP':
        t = new UdpTransport(c);
        break;
      case 'WS':
        t = c.role === 'server' ? new WsServerTransport(c.bind) : new WsClientTransport(c.remote);
        break;
      case 'SER':
        t = new SerialTransport(c.remote || c.bind);
        break;
      case 'MOCK':
        t = new MockTransport();
        break;
      default:
        throw new Error('unsupported proto ' + c.proto);
    }
    t.on('packet', (bytes, dir) => this._emitPacket(id, bytes, dir || 'rx'));
    t.on('status', (status, err) => {
      c.status = status;
      c.lastError = err || null;
      this._emitState(id);
    });
    c.transport = t;
    c.streaming = true;
    c.status = c.role === 'server' ? 'listening' : 'connecting';
    c.lastError = null;
    this._emitState(id);
    try {
      await t.start();
    } catch (e) {
      c.lastError = e.message;
      c.status = 'error';
      c.streaming = false;
      c.transport = null;
      this._emitState(id);
      throw e;
    }
  }

  async stop(id) {
    const c = this.conns.get(id);
    if (!c) return;
    await this._stopTransport(c);
    this._emitState(id);
  }

  async _stopTransport(c) {
    if (c.transport) {
      try { await c.transport.stop(); } catch {}
      c.transport = null;
    }
    c.streaming = false;
    c.status = 'idle';
  }

  async send(id, bytes) {
    const c = this.conns.get(id);
    if (!c) throw new Error('unknown connection');
    if (!c.transport) throw new Error('connection not started');
    await c.transport.send(bytes);
    this._emitPacket(id, bytes, 'tx');
  }

  clearBuffer(id) {
    this.emit('conn:clear', { id });
  }

  async listSerialPorts() {
    try { return await listSerialPorts(); }
    catch (e) { return { error: e.message, ports: [] }; }
  }

  async shutdown() {
    for (const c of this.conns.values()) {
      await this._stopTransport(c);
    }
    // Final flush so pending changes survive a quit.
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    try { await this._persist(); } catch {}
  }
}
