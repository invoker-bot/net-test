import { BaseTransport } from './base.js';

// Koffi exposes `koffi.view()` for zero-copy Buffer-over-pointer, but its docs
// explicitly call out that Electron forbids external buffers. So we go the
// memcpy route instead: declare RtlMoveMemory from kernel32, reuse a single
// Node Buffer across polls, and copy each tick. No per-tick allocations.

let _koffi = null;
let _OpenFileMappingW = null;
let _MapViewOfFile = null;
let _UnmapViewOfFile = null;
let _CloseHandle = null;
let _RtlMoveMemory = null;

const FILE_MAP_READ = 0x0004;

async function ensureKoffi() {
  if (_RtlMoveMemory) return;
  const mod = await import('koffi');
  const koffi = mod.default || mod;
  const kernel32 = koffi.load('kernel32.dll');
  _OpenFileMappingW = kernel32.func('void *OpenFileMappingW(uint32_t, bool, const char16_t *)');
  _MapViewOfFile    = kernel32.func('void *MapViewOfFile(void *, uint32_t, uint32_t, uint32_t, size_t)');
  _UnmapViewOfFile  = kernel32.func('bool UnmapViewOfFile(void *)');
  _CloseHandle      = kernel32.func('bool CloseHandle(void *)');
  _RtlMoveMemory    = kernel32.func('void RtlMoveMemory(void *dest, const void *src, size_t length)');
  _koffi = koffi;
}

export class MmapTransport extends BaseTransport {
  constructor(conn) {
    super();
    this.conn = conn;
    this.name = conn.remote || conn.bind || '';
    const sz = Number(conn.mmapSize);
    this.size = Number.isFinite(sz) && sz > 0 ? Math.floor(sz) : 1024;
    const hz = Number(conn.mmapPollHz);
    this.hz = Number.isFinite(hz) && hz > 0 ? Math.min(1000, Math.floor(hz)) : 50;
    this.hMap = null;
    this.viewPtr = null;
    this.timer = null;
    this._readBuf = null;
    this._lastBuf = null;
  }

  async start() {
    if (process.platform !== 'win32') {
      throw new Error('MMAP transport requires Windows (named shared memory like Local\\acpmf_physics)');
    }
    if (!this.name) {
      throw new Error('MMAP requires a shared-memory name (e.g. Local\\acpmf_physics)');
    }
    await ensureKoffi();

    const hMap = _OpenFileMappingW(FILE_MAP_READ, false, this.name);
    if (!hMap) {
      throw new Error(`OpenFileMappingW("${this.name}") failed — is the source process running?`);
    }
    const viewPtr = _MapViewOfFile(hMap, FILE_MAP_READ, 0, 0, this.size);
    if (!viewPtr) {
      _CloseHandle(hMap);
      throw new Error(`MapViewOfFile failed — region "${this.name}" may be smaller than ${this.size}B`);
    }
    this.hMap = hMap;
    this.viewPtr = viewPtr;
    this._readBuf = Buffer.allocUnsafe(this.size);
    this._setStatus('connected');

    const period = Math.max(2, Math.round(1000 / this.hz));
    this.timer = setInterval(() => this._poll(), period);
  }

  _poll() {
    if (!this.viewPtr || !this._readBuf) return;
    try {
      _RtlMoveMemory(this._readBuf, this.viewPtr, this.size);
    } catch (e) {
      this._setStatus('error', e.message);
      return;
    }
    // Suppress emits when the source isn't writing (game paused, between
    // ticks). The diff is cheap — for ACC's 800-byte physics region this is
    // a couple hundred nanoseconds.
    if (this._lastBuf && this._lastBuf.equals(this._readBuf)) return;
    this._lastBuf = Buffer.from(this._readBuf);
    // Hand out a fresh Uint8Array view so downstream consumers can hold on to
    // it independently — the next poll will overwrite this._readBuf.
    this._emitBytes(new Uint8Array(this._readBuf), 'rx');
  }

  async send() {
    throw new Error('MMAP is a read-only transport');
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    try { if (this.viewPtr && _UnmapViewOfFile) _UnmapViewOfFile(this.viewPtr); } catch {}
    try { if (this.hMap && _CloseHandle) _CloseHandle(this.hMap); } catch {}
    this.viewPtr = null;
    this.hMap = null;
    this._readBuf = null;
    this._lastBuf = null;
  }
}
