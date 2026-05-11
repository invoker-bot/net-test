import { WebSocketServer, WebSocket } from 'ws';
import { BaseTransport, parseAddr } from './base.js';

function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return Buffer.concat(data.map((d) => Buffer.from(d)));
  if (typeof data === 'string') return new TextEncoder().encode(data);
  return new Uint8Array(data);
}

export class WsClientTransport extends BaseTransport {
  constructor(remote) {
    super();
    this.remote = remote;
    this.ws = null;
    this._stopping = false;
    this._reconnect = null;
  }

  async start() {
    this._stopping = false;
    return this._connect();
  }

  _connect() {
    return new Promise((resolve, reject) => {
      const url = this.remote.startsWith('ws') ? this.remote : 'ws://' + this.remote;
      this._setStatus('connecting');
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        this._setStatus('error', e.message);
        reject(e);
        return;
      }
      ws.binaryType = 'arraybuffer';
      ws.on('open', () => { this._setStatus('connected'); resolve(); });
      ws.on('message', (data) => this._emitBytes(toBytes(data), 'rx'));
      ws.on('error', (err) => {
        this._setStatus('error', err.message);
        if (!this.ws) reject(err);
      });
      ws.on('close', () => {
        if (this._stopping) { this._setStatus('idle'); return; }
        this._setStatus('reconnect');
        this._reconnect = setTimeout(() => this._connect().catch(() => {}), 2000);
      });
      this.ws = ws;
    });
  }

  async send(bytes) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('WS not open');
    return new Promise((res, rej) => {
      this.ws.send(Buffer.from(bytes), { binary: true }, (err) => err ? rej(err) : res());
    });
  }

  async stop() {
    this._stopping = true;
    if (this._reconnect) clearTimeout(this._reconnect);
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }
}

export class WsServerTransport extends BaseTransport {
  constructor(bind) {
    super();
    this.bind = bind;
    this.server = null;
    this.clients = new Set();
  }

  async start() {
    const { host, port } = parseAddr(this.bind);
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({ host, port }, () => {
        this._setStatus('listening');
        resolve();
      });
      wss.on('connection', (ws) => {
        ws.binaryType = 'arraybuffer';
        this.clients.add(ws);
        this._setStatus('connected');
        ws.on('message', (data) => this._emitBytes(toBytes(data), 'rx'));
        ws.on('close', () => {
          this.clients.delete(ws);
          if (this.clients.size === 0) this._setStatus('listening');
        });
        ws.on('error', () => this.clients.delete(ws));
      });
      wss.on('error', (err) => { this._setStatus('error', err.message); reject(err); });
      this.server = wss;
    });
  }

  async send(bytes) {
    if (!this.server) throw new Error('WS server not started');
    if (this.clients.size === 0) throw new Error('no WS clients connected');
    for (const c of this.clients) {
      if (c.readyState === WebSocket.OPEN) {
        try { c.send(Buffer.from(bytes), { binary: true }); } catch {}
      }
    }
  }

  async stop() {
    for (const c of this.clients) { try { c.close(); } catch {} }
    this.clients.clear();
    if (this.server) {
      await new Promise((res) => this.server.close(() => res()));
      this.server = null;
    }
  }
}
