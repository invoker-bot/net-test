import { BaseTransport } from './base.js';

let serialportModule = null;
async function loadSerialport() {
  if (serialportModule) return serialportModule;
  try {
    serialportModule = await import('serialport');
    return serialportModule;
  } catch (e) {
    throw new Error('serialport module not available: ' + e.message);
  }
}

function parseSerialPath(p) {
  // Accept formats: /dev/cu.usbmodem or /dev/cu.usbmodem:115200
  const m = (p || '').match(/^(.*?)(?::(\d+))?$/);
  return { path: m[1], baudRate: parseInt(m[2], 10) || 115200 };
}

export class SerialTransport extends BaseTransport {
  constructor(spec) {
    super();
    this.spec = spec;
    this.port = null;
  }

  async start() {
    const { SerialPort } = await loadSerialport();
    const { path, baudRate } = parseSerialPath(this.spec);
    if (!path) throw new Error('serial path required');
    return new Promise((resolve, reject) => {
      const port = new SerialPort({ path, baudRate, autoOpen: false });
      port.on('data', (chunk) => this._emitBytes(chunk, 'rx'));
      port.on('error', (err) => this._setStatus('error', err.message));
      port.on('close', () => this._setStatus('idle'));
      port.open((err) => {
        if (err) {
          this._setStatus('error', err.message);
          return reject(err);
        }
        this._setStatus('connected');
        resolve();
      });
      this.port = port;
    });
  }

  async send(bytes) {
    if (!this.port || !this.port.isOpen) throw new Error('Serial port not open');
    return new Promise((res, rej) => {
      this.port.write(Buffer.from(bytes), (err) => err ? rej(err) : this.port.drain(() => res()));
    });
  }

  async stop() {
    if (this.port) {
      await new Promise((res) => this.port.close(() => res()));
      this.port = null;
    }
  }
}

export async function listSerialPorts() {
  const { SerialPort } = await loadSerialport();
  const list = await SerialPort.list();
  return { ports: list.map((p) => ({ path: p.path, manufacturer: p.manufacturer, friendlyName: p.friendlyName || p.path })) };
}
