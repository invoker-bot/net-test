import { promises as fs, createWriteStream } from 'node:fs';
import { EventEmitter } from 'node:events';
import path from 'node:path';

// NTFS reserves /\:*?"<>|; CR/LF would break the per-line file naming on tooling
// that splits by newline. Replace anything risky with '_' and fall back to a
// stable placeholder if the whole name reduces to empty.
function sanitizeName(name) {
  const cleaned = (name || '').replace(/[\/\\:*?"<>|\r\n\t]/g, '_').trim();
  return cleaned || 'unnamed';
}

function timestampForFilename(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
         `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export class Recorder extends EventEmitter {
  constructor({ dir, meta }) {
    super();
    this.dir = dir;
    this.meta = meta;
    this.stream = null;
    this.path = null;
  }

  async start() {
    await fs.mkdir(this.dir, { recursive: true });
    const filename = `${sanitizeName(this.meta.name)}-${timestampForFilename()}.jsonl`;
    this.path = path.join(this.dir, filename);

    // Wait for the stream to either successfully open or fail synchronously so
    // the caller can surface the error before any packets are dropped on the
    // floor.
    await new Promise((resolve, reject) => {
      this.stream = createWriteStream(this.path, { flags: 'a', encoding: 'utf8' });
      const onOpen = () => {
        this.stream.removeListener('error', onError);
        this.stream.on('error', (err) => this.emit('error', err));
        resolve();
      };
      const onError = (err) => {
        this.stream.removeListener('open', onOpen);
        this.stream = null;
        this.path = null;
        reject(err);
      };
      this.stream.once('open', onOpen);
      this.stream.once('error', onError);
    });

    const header = {
      type: 'meta',
      name: this.meta.name,
      proto: this.meta.proto,
      role: this.meta.role,
      endpoint: this.meta.endpoint,
      startedAt: new Date().toISOString(),
    };
    this.stream.write(JSON.stringify(header) + '\n');
    return this.path;
  }

  write({ bytes, tms, dir }) {
    if (!this.stream || !this.stream.writable) return;
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).toUpperCase().padStart(2, '0');
    }
    this.stream.write(JSON.stringify({ tms, dir, hex }) + '\n');
  }

  async stop() {
    if (!this.stream) return;
    const s = this.stream;
    this.stream = null;
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      s.once('finish', finish);
      s.once('error', finish);
      s.end();
    });
  }
}
