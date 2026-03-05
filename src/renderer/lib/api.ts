const api = window.electronAPI

export const strumentiApi = {
  list: () => api.invoke('strumenti:list') as Promise<any[]>,
  get: (id: string) => api.invoke('strumenti:get', id) as Promise<any>,
  create: (data: Record<string, unknown>) => api.invoke('strumenti:create', data) as Promise<any>,
  update: (id: string, data: Record<string, unknown>) => api.invoke('strumenti:update', id, data) as Promise<any>,
  delete: (id: string) => api.invoke('strumenti:delete', id) as Promise<{ ok: boolean }>,
}

export const metodiApi = {
  list: () => api.invoke('metodi:list') as Promise<any[]>,
  get: (id: string) => api.invoke('metodi:get', id) as Promise<any>,
  create: (data: Record<string, unknown>) => api.invoke('metodi:create', data) as Promise<any>,
  update: (id: string, data: Record<string, unknown>) => api.invoke('metodi:update', id, data) as Promise<any>,
  delete: (id: string) => api.invoke('metodi:delete', id) as Promise<{ ok: boolean }>,
}

export const compostiApi = {
  list: (filters?: Record<string, unknown>) => api.invoke('composti:list', filters) as Promise<any[]>,
  get: (id: number) => api.invoke('composti:get', id) as Promise<any>,
  create: (data: Record<string, unknown>) => api.invoke('composti:create', data) as Promise<any>,
  update: (id: number, data: Record<string, unknown>) => api.invoke('composti:update', id, data) as Promise<any>,
  delete: (id: number) => api.invoke('composti:delete', id) as Promise<{ ok: boolean }>,
  addStoria: (compostoId: number, data: { tipo: string; data: string; note?: string }) =>
    api.invoke('composti:storia-add', compostoId, data) as Promise<{ id: number }>,
}

export const preparazioniApi = {
  list: (compostoId: number) => api.invoke('preparazioni:list', compostoId) as Promise<any[]>,
  create: (data: Record<string, unknown>) => api.invoke('preparazioni:create', data) as Promise<any>,
  update: (id: number, data: Record<string, unknown>) => api.invoke('preparazioni:update', id, data) as Promise<any>,
  delete: (id: number) => api.invoke('preparazioni:delete', id) as Promise<{ ok: boolean }>,
}

export const eluentiApi = {
  list: (strumentoId: string) => api.invoke('eluenti:list', strumentoId) as Promise<any[]>,
  create: (data: Record<string, unknown>) => api.invoke('eluenti:create', data) as Promise<any>,
  update: (id: string, data: Record<string, unknown>) => api.invoke('eluenti:update', id, data) as Promise<any>,
  close: (id: string) => api.invoke('eluenti:close', id) as Promise<{ ok: boolean }>,
  delete: (id: string) => api.invoke('eluenti:delete', id) as Promise<{ ok: boolean }>,
}

export const consumabiliApi = {
  list: (filters?: Record<string, unknown>) => api.invoke('consumabili:list', filters) as Promise<any[]>,
  get: (id: number) => api.invoke('consumabili:get', id) as Promise<any>,
  create: (data: Record<string, unknown>) => api.invoke('consumabili:create', data) as Promise<any>,
  update: (id: number, data: Record<string, unknown>) => api.invoke('consumabili:update', id, data) as Promise<any>,
  close: (id: number) => api.invoke('consumabili:close', id) as Promise<{ ok: boolean }>,
  delete: (id: number) => api.invoke('consumabili:delete', id) as Promise<{ ok: boolean }>,
}

export const diarioApi = {
  list: (strumentoId: string, metodoId?: string) => api.invoke('diario:list', strumentoId, metodoId) as Promise<any[]>,
  create: (data: Record<string, unknown>) => api.invoke('diario:create', data) as Promise<any>,
  update: (id: number, data: Record<string, unknown>) => api.invoke('diario:update', id, data) as Promise<any>,
  delete: (id: number) => api.invoke('diario:delete', id) as Promise<{ ok: boolean }>,
}

export const anagraficheApi = {
  list: () => api.invoke('anagrafiche:list') as Promise<any[]>,
  create: (nome: string) => api.invoke('anagrafiche:create', nome) as Promise<any>,
  rename: (id: number, nome: string) => api.invoke('anagrafiche:rename', id, nome) as Promise<{ ok: boolean }>,
  delete: (id: number) => api.invoke('anagrafiche:delete', id) as Promise<{ ok: boolean }>,
  addVoce: (anagId: number, valore: string) => api.invoke('anagrafiche:add-voce', anagId, valore) as Promise<any>,
  updateVoce: (id: number, valore: string) => api.invoke('anagrafiche:update-voce', id, valore) as Promise<{ ok: boolean }>,
  deleteVoce: (id: number) => api.invoke('anagrafiche:delete-voce', id) as Promise<{ ok: boolean }>,
}

export const queryApi = {
  snapshot: (request: { strumento_id: string; metodo_id?: string; data: string }) =>
    api.invoke('query:snapshot', request) as Promise<any>,
}
