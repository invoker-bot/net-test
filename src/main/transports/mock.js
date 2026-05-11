import { BaseTransport } from './base.js';

// CRC-16/IBM
function crc16(bytes, len) {
  let crc = 0xFFFF;
  for (let i = 0; i < len; i++) {
    crc ^= bytes[i];
    for (let b = 0; b < 8; b++) crc = (crc & 1) ? ((crc >>> 1) ^ 0xA001) : (crc >>> 1);
  }
  return crc & 0xFFFF;
}

function buildSensorPacket(state) {
  const buf = new ArrayBuffer(32);
  const view = new DataView(buf);
  view.setUint16(0, 0xCAFE, true);
  view.setUint8(2, 0x01);
  view.setUint8(3, state.seq % 37 === 0 ? 0x11 : 0x10);
  view.setUint16(4, state.seq & 0xFFFF, true);
  view.setUint32(6, state.t & 0xFFFFFFFF, true);

  const temp = 22.5 + 3.2 * Math.sin(state.t / 4500) + (Math.random() - 0.5) * 0.18;
  const hum = 55 + 12 * Math.sin(state.t / 8000 + 1) + (Math.random() - 0.5) * 0.6;
  const pres = 1013.25 + 2.4 * Math.sin(state.t / 15000) + (Math.random() - 0.5) * 0.15;
  view.setFloat32(10, temp, true);
  view.setFloat32(14, hum, true);
  view.setFloat32(18, pres, true);

  let flags = 0;
  if (temp > 25.2) flags |= 1;
  if (state.battery < 22) flags |= 2;
  if (state.charging) flags |= 4;
  if (state.seq % 113 === 0) flags |= 8;
  flags |= 16; flags |= 32;
  view.setUint16(22, flags, true);
  view.setUint8(24, state.battery);
  view.setInt8(25, state.rssi);
  const node = 'S001';
  for (let i = 0; i < 4; i++) view.setUint8(26 + i, node.charCodeAt(i));
  const u8 = new Uint8Array(buf);
  view.setUint16(30, crc16(u8, 30), true);
  return u8;
}

export class MockTransport extends BaseTransport {
  constructor() {
    super();
    this.timer = null;
    this.state = {
      seq: Math.floor(Math.random() * 1000),
      t: 0,
      battery: 30 + Math.floor(Math.random() * 70),
      charging: Math.random() < 0.3,
      rssi: -45 - Math.floor(Math.random() * 30),
    };
    this.rateHz = 10;
  }

  async start() {
    this._setStatus('listening');
    const period = Math.max(16, 1000 / this.rateHz);
    this.timer = setInterval(() => {
      const s = this.state;
      s.t += period;
      s.seq = (s.seq + 1) & 0xFFFF;
      s.battery = Math.max(3, Math.min(100, s.battery + (s.charging ? 0.04 : -0.012)));
      if (s.battery >= 100) s.charging = false;
      if (s.battery <= 8) s.charging = true;
      s.rssi = Math.max(-95, Math.min(-30, s.rssi + (Math.random() - 0.5) * 1.4));
      const bytes = buildSensorPacket({
        seq: s.seq, t: Math.round(s.t),
        battery: Math.round(s.battery), charging: s.charging, rssi: Math.round(s.rssi),
      });
      this._emitBytes(bytes, 'rx');
    }, period);
  }

  async send(bytes) {
    // Mock echo back as RX after a tick — useful for testing send flow.
    setTimeout(() => this._emitBytes(bytes, 'rx'), 30);
  }

  async stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this._setStatus('idle');
  }
}
