import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api } from '../shared/ipc'

// The preload script is the only bridge between the web page (renderer) and Node/Electron.
// contextBridge copies `api` into the page as `window.api`; the page gets these few
// functions and nothing else: no ipcRenderer, no require, no filesystem.
const api: Api = {
  columns: { list: () => ipcRenderer.invoke(IPC.columnsList) },
  articles: {
    list: () => ipcRenderer.invoke(IPC.articlesList),
    update: (id, patch) => ipcRenderer.invoke(IPC.articlesUpdate, { id, patch })
  }
}

contextBridge.exposeInMainWorld('api', api)
