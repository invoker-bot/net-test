// Schema export/import for the parser struct.
//
// The on-disk format is intentionally close to the in-memory shape so a hand-
// edited file round-trips. A "format" tag lets future versions detect and
// migrate old files without guessing.

export const SCHEMA_FORMAT = 'nettest.schema.v1';

export function serializeSchema(struct) {
  // Strip transient identity bits (the `builtin` library flag, any
  // implementation-only ids) so the file represents only the schema itself.
  return {
    format: SCHEMA_FORMAT,
    name: struct.name || 'Untitled',
    endian: struct.endian === 'BE' ? 'BE' : 'LE',
    size: typeof struct.size === 'number' ? struct.size : 0,
    fields: (struct.fields || []).map((f) => {
      const out = { ...f };
      delete out.builtin;
      return out;
    }),
  };
}

export function deserializeSchema(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('Schema file is empty or not valid JSON.');
  }
  if (json.format !== SCHEMA_FORMAT) {
    throw new Error(`Unknown schema format "${json.format || '(none)'}" — expected "${SCHEMA_FORMAT}".`);
  }
  if (!Array.isArray(json.fields)) {
    throw new Error('Schema file is missing the "fields" array.');
  }
  return {
    name: typeof json.name === 'string' && json.name ? json.name : 'Imported',
    endian: json.endian === 'BE' ? 'BE' : 'LE',
    size: typeof json.size === 'number' ? json.size : 0,
    fields: json.fields,
  };
}

// Browser download. Sanitize the suggested filename so the OS save dialog
// doesn't show garbage when the struct name has spaces / slashes.
function safeFilename(name) {
  return (name || 'schema').replace(/[\/\\:*?"<>|]/g, '_').trim() || 'schema';
}

export function downloadSchemaJson(struct) {
  const text = JSON.stringify(serializeSchema(struct), null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename(struct.name) + '.schema.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revocation so Chrome has time to actually start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickSchemaFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        resolve(deserializeSchema(JSON.parse(text)));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
