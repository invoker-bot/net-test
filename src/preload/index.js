import { contextBridge, ipcRenderer } from 'electron';

const api = {
  listConnections: () => ipcRenderer.invoke('conn:list'),
  createConnection: (spec) => ipcRenderer.invoke('conn:create', spec),
  updateConnection: (id, patch) => ipcRenderer.invoke('conn:update', id, patch),
  removeConnection: (id) => ipcRenderer.invoke('conn:remove', id),
  startConnection: (id) => ipcRenderer.invoke('conn:start', id),
  stopConnection: (id) => ipcRenderer.invoke('conn:stop', id),
  sendBytes: (id, bytes) => ipcRenderer.invoke('conn:send', id, Array.from(bytes)),
  clearBuffer: (id) => ipcRenderer.invoke('conn:clear', id),
  startRecording: (id) => ipcRenderer.invoke('conn:startRecording', id),
  stopRecording: (id) => ipcRenderer.invoke('conn:stopRecording', id),
  listSerialPorts: () => ipcRenderer.invoke('serial:listPorts'),

  getRecordingsDir: () => ipcRenderer.invoke('app:getRecordingsDir'),
  setRecordingsDir: (p) => ipcRenderer.invoke('app:setRecordingsDir', p),
  pickRecordingsDir: () => ipcRenderer.invoke('app:pickRecordingsDir'),
  openRecordingsDir: () => ipcRenderer.invoke('app:openRecordingsDir'),

  onPacket: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('conn:packet', listener);
    return () => ipcRenderer.removeListener('conn:packet', listener);
  },
  onState: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('conn:state', listener);
    return () => ipcRenderer.removeListener('conn:state', listener);
  },
  onRemoved: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('conn:removed', listener);
    return () => ipcRenderer.removeListener('conn:removed', listener);
  },
  onClear: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('conn:clear', listener);
    return () => ipcRenderer.removeListener('conn:clear', listener);
  },

  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development' || !!process.env.ELECTRON_RENDERER_URL,
};

contextBridge.exposeInMainWorld('nettest', api);
