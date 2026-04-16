import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  getConfig: () => ipcRenderer.invoke('config:get'),
  selectFolder: () => ipcRenderer.invoke('config:select-folder'),
  selectJson: () => ipcRenderer.invoke('config:select-json'),
  importLegacyJson: (jsonPath: string) => ipcRenderer.invoke('config:import-legacy', jsonPath),
  listSessions: () => ipcRenderer.invoke('sessions:list'),
  onDbChange: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('db:external-change', listener)
    return () => { ipcRenderer.off('db:external-change', listener) }
  },
})
