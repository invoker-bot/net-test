import net from 'node:net';
import { BaseTransport, parseAddr } from './base.js';

export class TcpClientTransport extends BaseTransport {
  constructor(remote) {
    super();
    this.remote = remote;
    this.socket = null;
    this._stopping = false;
    this._reconnectTimer = null;
  }

  async start() {
    this._stopping = false;
    return this._connect();
  }

  _connect() {
    return new Promise((resolve, reject) => {
      const { host, port } = parseAddr(this.remote);
      this._setStatus('connecting');
      const s = net.createConnection({ host, port }, () => {
        this._setStatus('connected');
        resolve();
      });
      s.on('data', (chunk) => this._emitBytes(chunk, 'rx'));
      s.on('error', (err) => {
        this._setStatus('error', err.message);
        if (!this.socket) reject(err);
      });
      s.on('close', () => {
        if (this._stopping) {
          this._setStatus('idle');
          return;
        }
        this._setStatus('reconnect');
        this._reconnectTimer = setTimeout(() => this._connect().catch(() => {}), 2000);
      });
      this.socket = s;
    });
  }

  async send(bytes) {
    if (!this.socket || this.socket.destroyed) throw new Error('TCP socket not connected');
    return new Promise((res, rej) => {
      this.socket.write(bytes, (err) => err ? rej(err) : res());
    });
  }

  async stop() {
    this._stopping = true;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}

export class TcpServerTransport extends BaseTransport {
  constructor(bind) {
    super();
    this.bind = bind;
    this.server = null;
    this.clients = new Set();
  }

  async start() {
    return new Promise((resolve, reject) => {
      const { host, port } = parseAddr(this.bind);
      const server = net.createServer((sock) => {
        this.clients.add(sock);
        this._setStatus('connected');
        sock.on('data', (chunk) => this._emitBytes(chunk, 'rx'));
        sock.on('close', () => {
          this.clients.delete(sock);
          if (this.clients.size === 0) this._setStatus('listening');
        });
        sock.on('error', () => {
          this.clients.delete(sock);
        });
      });
      server.on('error', (err) => {
        this._setStatus('error', err.message);
        reject(err);
      });
      server.listen(port, host, () => {
        this._setStatus('listening');
        resolve();
      });
      this.server = server;
    });
  }

  async send(bytes) {
    if (!this.server) throw new Error('TCP server not started');
    if (this.clients.size === 0) throw new Error('no clients connected');
    for (const c of this.clients) {
      try { c.write(bytes); } catch {}
    }
  }

  async stop() {
    for (const c of this.clients) {
      try { c.destroy(); } catch {}
    }
    this.clients.clear();
    if (this.server) {
      await new Promise((res) => this.server.close(() => res()));
      this.server = null;
    }
  }
}
