const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  exportOpen: (cfg) => ipcRenderer.invoke('export-open', cfg),
  exportSetup: (cfg) => ipcRenderer.invoke('export-setup', cfg),
  exportPrepare: (rec) => ipcRenderer.invoke('export-prepare', rec),
  exportFrame: (f) => ipcRenderer.invoke('export-frame', f),
  exportClose: () => ipcRenderer.invoke('export-close'),
  exportAbort: () => ipcRenderer.invoke('export-abort'),
});
