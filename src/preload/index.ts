import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  getConfig: () => ipcRenderer.invoke('config:get'),
  selectFolder: () => ipcRenderer.invoke('config:select-folder'),
  selectJson: () => ipcRenderer.invoke('config:select-json'),
  importLegacyJson: (jsonPath: string) => ipcRenderer.invoke('config:import-legacy', jsonPath),
})
