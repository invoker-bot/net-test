# AGENTS.md

## Project Overview

NetTest is an Electron desktop app for inspecting and sending TCP, UDP, WebSocket, Serial, and mock packet streams. The renderer is a React app, and the main process owns transport lifecycle, persistence of connection definitions, and IPC.

## Useful Commands

- `npm install` - install dependencies.
- `npm run dev` - launch the Electron app in development mode.
- `npm run build:vite` - build main, preload, and renderer output without packaging.
- `npm run build` - build with electron-vite, then package with electron-builder.
- `npm run pack` - build an unpacked app directory with electron-builder.
- `npm run preview` - preview the built app.
- `node scripts/smoke-test.js` - run transport smoke tests without Electron.

## Code Map

- `src/main/index.js` registers Electron windows and IPC handlers.
- `src/main/connection-mgr.js` owns connection state, persistence, transport start/stop, and packet emission.
- `src/main/transports/` contains protocol-specific transport implementations.
- `src/preload/index.js` exposes the renderer API through `window.nettest`.
- `src/renderer/src/App.jsx` coordinates renderer state and top-level layout.
- `src/renderer/src/lib/parser.js` contains binary field decoding and payload generation helpers.
- `src/renderer/src/lib/use-connections.js` wraps renderer-side connection and packet state.
- `src/renderer/src/components/` contains UI panels and shared components.

## Development Notes

- The project uses ESM JavaScript.
- Keep main-process network and filesystem work out of the renderer.
- Add renderer-facing capabilities through `src/preload/index.js` and matching IPC handlers.
- Keep transport behavior in `src/main/transports/`; shared transport contracts should stay simple and event-based.
- Do not edit generated `out/` or `dist/` files for source changes.
- Do not commit `node_modules/`, logs, local env files, or generated build artifacts.

## Verification

- For transport changes, run `node scripts/smoke-test.js`.
- For renderer, IPC, or compile configuration changes, run `npm run build:vite`.
- For packaging changes, run `npm run pack` or `npm run build`.
- For UI changes, run `npm run dev` and manually verify the Electron window.
