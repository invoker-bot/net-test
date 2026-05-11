import dgram from 'node:dgram';
import { BaseTransport, parseAddr } from './base.js';

function isMulticast(host) {
  const a = parseInt(host.split('.')[0], 10);
  return a >= 224 && a <= 239;
}

export class UdpTransport extends BaseTransport {
  constructor(conn) {
    super();
    this.conn = conn;
    this.socket = null;
    this._lastRemote = null;
  }

  async start() {
    const isServer = this.conn.role === 'server';
    const addr = isServer ? this.conn.bind : this.conn.remote;
    const { host, port } = parseAddr(addr);
    return new Promise((resolve, reject) => {
      const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      sock.on('message', (buf, rinfo) => {
        this._lastRemote = { host: rinfo.address, port: rinfo.port };
        this._emitBytes(buf, 'rx');
      });
      sock.on('error', (err) => {
        this._setStatus('error', err.message);
        try { sock.close(); } catch {}
        reject(err);
      });
      sock.on('listening', () => {
        if (isServer && isMulticast(host)) {
          try { sock.addMembership(host); } catch {}
        }
        if (isServer) sock.setBroadcast(true);
        this._setStatus(isServer ? 'listening' : 'connected');
        resolve();
      });
      sock.bind(isServer ? port : 0, isServer ? host : undefined);
      this.socket = sock;
      if (!isServer) this._lastRemote = { host, port };
    });
  }

  async send(bytes) {
    if (!this.socket) throw new Error('UDP not started');
    const target = this._lastRemote;
    if (!target) throw new Error('no UDP peer known — receive a packet first or set remote');
    return new Promise((res, rej) => {
      this.socket.send(Buffer.from(bytes), target.port, target.host, (err) => err ? rej(err) : res());
    });
  }

  async stop() {
    if (this.socket) {
      try { this.socket.close(); } catch {}
      this.socket = null;
    }
  }
}
