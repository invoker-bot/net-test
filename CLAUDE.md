# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NetTest is a desktop packet inspector for **TCP / UDP / WebSocket / Serial** built on Electron 33 + React 18. The whole app is plain JavaScript (ESM, `"type": "module"`) — no TypeScript. Build/dev is driven by `electron-vite`, which keeps separate Vite configs for the `main`, `preload`, and `renderer` roots (see `electron.vite.config.js`).

## Commands

| Task | Command |
|---|---|
| Dev (HMR + Electron) | `npm run dev` |
| Production build → `out/` | `npm run build` |
| Preview built app | `npm run preview` (alias: `npm start`) |
| Transport smoke test | `node scripts/smoke-test.js` |

There is no linter, no test framework, and no e2e harness. `scripts/smoke-test.js` is the only automated check: it imports the four real-protocol transports directly (bypassing Electron entirely) and round-trips bytes through real sockets. Run it after touching anything in `src/main/transports/`.

## Architecture (the parts that span files)

### Three processes, strict boundaries

- **Main** (`src/main/`) — Node side; owns sockets and connection state.
- **Preload** (`src/preload/index.js`) — exposes a single `window.nettest` API via `contextBridge`. `contextIsolation: true`, `sandbox: false`, `nodeIntegration: false`. Nothing else crosses the bridge.
- **Renderer** (`src/renderer/src/`) — React 18 app. Has no direct Node access; reaches main only through `window.nettest`.

The preload path loaded from `out/main/index.js` is `../preload/index.mjs` — electron-vite emits preload output as `.mjs` regardless of the source extension. Don't change this path without checking the actual build output.

### The Connection model

`src/main/connection-mgr.js` is the heart of the app. `ConnectionManager` keeps a `Map<id, conn>` where each `conn` is `{ id, name, proto, role, bind/remote, endpoint, color, status, streaming, transport? }`. Lifecycle methods (`create / update / remove / start / stop / send`) are exposed over IPC in `main/index.js` and mirrored 1:1 in the preload API.

State persists to `state.json` in `app.getPath('userData')`, versioned (`STATE_VERSION = 1`) and written atomically via tmp + rename. Writes are debounced 400 ms; `shutdown()` does a final flush. **Initial load is intentionally synchronous** (`readFileSync` in `_loadInitial`) to beat the renderer's `listConnections()` call — see the comment there before "fixing" it. In dev a Mock connection is seeded; in prod, any persisted `MOCK` entries are stripped on load.

### Transport contract

All transports in `src/main/transports/` extend `BaseTransport extends EventEmitter` and expose:

```js
async start()        // resolve when listening/connected, throw on hard failure
async stop()         // tear down, idempotent
async send(bytes)    // Uint8Array in
// emits: 'packet' (bytes: Uint8Array, dir: 'rx'|'tx'), 'status' (state, err?)
```

Per-transport quirks worth knowing:

- **TCP client / WS client** auto-reconnect 2 s after `close` unless `stop()` set `_stopping`.
- **UDP** caches `_lastRemote` from the first inbound packet — calling `send()` before that throws (`no UDP peer known`). Multicast joins happen on `listening` if the bind host is 224–239.x.
- **TCP / WS server** broadcast `send()` to every connected client.
- **Serial** dynamically imports `serialport` so a missing native module doesn't crash startup; address format is `path[:baud]` (default 115200).
- **Mock** generates 32-byte `SensorPacket`s at 10 Hz with valid CRC-16/IBM — the layout matches the `DEFAULT_STRUCT` preset shipped to the renderer.

Adding a new protocol means: subclass `BaseTransport`, add a `case` in `ConnectionManager.start()`, and add a check in `scripts/smoke-test.js`.

### Packet flow (renderer ↔ main)

```
UI action → window.nettest.<method>            (preload contextBridge)
          → ipcRenderer.invoke('conn:<verb>')
          → ipcMain.handle in main/index.js
          → ConnectionManager method
          → transport.send/start/stop

socket data → transport emits 'packet'/'status'
            → ConnectionManager.emit('conn:packet'|'conn:state', …)
            → mainWindow.webContents.send(channel, payload)
            → preload listener
            → useConnections hook updates React state
```

**Bytes cross IPC as plain `Array<number>`, not `Uint8Array`** — `Uint8Array.from()` is applied on both sides. Don't pass typed arrays across IPC directly.

### Renderer state model

- `lib/use-connections.js` is the single source of truth on the renderer side. It owns `conns`, `buffers` (per-connection 1000-packet ring), and `rateByConn` (B/s ticker, 800 ms). It hydrates buffers from localStorage on mount and persists them debounced. The persisted tail is capped at `BUFFER_TAIL_CAP = 200` per connection (see `lib/persist.js`) to stay under the ~5 MB localStorage quota; the in-memory ring still keeps 1000.
- `App.jsx` holds top-level UI state (selected connection, paused/follow, hover/selection, tweaks) and `structsByConn`. **Each connection has its own parser struct** — switching the connection selector swaps which struct the hex viewer and parser panel render against. The struct map is persisted to `nettest.structsByConn.v1`.
- `lib/parser.js` is pure: `decodeField`, `formatField`, `generateBytes`, plus stateful generators (`const`, `uniform`, `gauss`, `walk`, `sine`, `counter`, `ramp`) keyed by field id at module scope. The generator state survives re-renders but resets on full reload — this is deliberate.
- `lib/struct-library.js` ships three built-in presets (SensorPacket, CommonHeader, Modbus RTU). Saving a user preset writes to `nettest.structs.v1`.

### Persistence keys

| Storage | What |
|---|---|
| `state.json` (in `userData`) | Connection list — main process, atomic rename |
| `nettest.buffers.v1` (localStorage) | Per-conn packet tail (≤ 200 packets each) |
| `nettest.structsByConn.v1` (localStorage) | Active struct per connection |
| `nettest.structs.v1` (localStorage) | Saved struct preset library |

`debouncedSaver` in `lib/persist.js` registers a `beforeunload` flush so pending writes survive close. Three different debounce intervals (main 400 ms, structs 600 ms, buffers 2000 ms) are tuned to write-frequency — don't unify them without a reason.

### Performance-sensitive paths

The hex viewer can be hit by hundreds of packets/sec. Conventions that keep it cheap:

- `HexViewer` renders only the last 80 packets (`VISIBLE_CAP`) of the in-memory 1000-packet ring.
- `App.jsx` defines `pktKey`, `handleReply`, `handleSelectPacket`, `handleSend` via `useCallback` so memoized `PacketCard` children stay stable across packet arrivals. Adding an inline `() => …` to a `PacketCard` prop will tank scroll perf.
- Per-field numeric history for sparklines is rebuilt every 250 ms from the last 120 packets, *not* on every packet — see the interval effect in `App.jsx`.
- Auto-follow scroll is coalesced into a single `requestAnimationFrame` per paint.

### Styling

Tailwind 3 + `@tailwindcss/forms`, scoped to `src/renderer/**`. Two CSS variables drive theming from the tweaks panel: `--accent` and `--mono`. `font-mono` resolves to `var(--mono)`, so changing the mono font in the tweaks panel reflows the entire hex viewer with no React re-render. The window uses macOS `hiddenInset` titlebar; the header has a fixed 78px gutter to clear native traffic lights.
