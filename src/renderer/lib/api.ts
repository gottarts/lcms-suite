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
  listForWork: (workId: number) => api.invoke('metodi:list-for-work', workId) as Promise<any[]>,
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
  addStoria: (compostoId: number, data: {
    tipo: string
    data: string
    note?: string
    n_registro_qc?: string
    batch_analitico?: string
    lotto_crm_valido?: string
    nuova_scadenza?: string
    propagate?: boolean
  }) => api.invoke('composti:storia-add', compostoId, data) as Promise<{ id: number }>,
  createMix: (data: Record<string, unknown>) =>
    api.invoke('composti:create-mix', data) as Promise<{ mix_id: string; count: number }>,
  // CRM per SchemaCalibrazione: cerca per nome analita, non per composti_metodi
  listForSchema: (metodoId: string) =>
    api.invoke('composti:list-for-schema', metodoId) as Promise<any[]>,
  // TASK A-1: valori distinti di una colonna (per autocomplete)
  distinctValues: (campo: string) =>
    api.invoke('composti:distinct-values', campo) as Promise<string[]>,
}

export const preparazioniApi = {
  list: (compostoId: number) => api.invoke('preparazioni:list', compostoId) as Promise<any[]>,
  create: (data: Record<string, unknown>) => api.invoke('preparazioni:create', data) as Promise<any>,
  update: (id: number, data: Record<string, unknown>) => api.invoke('preparazioni:update', id, data) as Promise<any>,
  delete: (id: number) => api.invoke('preparazioni:delete', id) as Promise<{ ok: boolean }>,
  dismiss: (id: number, data_dismissione: string) => api.invoke('preparazioni:dismiss', id, data_dismissione) as Promise<any>,
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
  // Handlers esistenti
  list: () => api.invoke('anagrafiche:list') as Promise<any[]>,
  create: (nome: string) => api.invoke('anagrafiche:create', nome) as Promise<any>,
  rename: (id: number, nome: string) => api.invoke('anagrafiche:rename', id, nome) as Promise<{ ok: boolean }>,
  delete: (id: number) => api.invoke('anagrafiche:delete', id) as Promise<{ ok: boolean }>,
  addVoce: (anagId: number, valore: string) => api.invoke('anagrafiche:add-voce', anagId, valore) as Promise<any>,
  updateVoce: (id: number, valore: string) => api.invoke('anagrafiche:update-voce', id, valore) as Promise<{ ok: boolean }>,
  deleteVoce: (id: number) => api.invoke('anagrafiche:delete-voce', id) as Promise<{ ok: boolean }>,
  // TASK B-1: sync voce da salvataggio composto
  syncVoce: (nomeAnagrafica: string, valore: string) =>
    api.invoke('anagrafiche:sync-voce', nomeAnagrafica, valore) as Promise<{ ok: boolean }>,
  // TASK C-1: rename voce con propagazione ai composti
  renameVocePropagate: (voceId: number, nuovoValore: string, campoDB: string) =>
    api.invoke('anagrafiche:rename-voce-propagate', voceId, nuovoValore, campoDB) as Promise<{ ok: boolean }>,
  // TASK C-2: merge due voci con propagazione ai composti
  mergeVoci: (sourceId: number, destId: number, campoDB: string) =>
    api.invoke('anagrafiche:merge-voci', sourceId, destId, campoDB) as Promise<{ ok: boolean }>,
}

export const workApi = {
  list: () =>
    api.invoke('work:list') as Promise<any[]>,
  listArchivio: () =>
    api.invoke('work:list-archivio') as Promise<any[]>,
  get: (id: number) =>
    api.invoke('work:get', id) as Promise<any>,
  create: (data: Record<string, unknown>) =>
    api.invoke('work:create', data) as Promise<any>,
  update: (id: number, data: Record<string, unknown>) =>
    api.invoke('work:update', id, data) as Promise<any>,
  delete: (id: number) =>
    api.invoke('work:delete', id) as Promise<{ ok: boolean }>,
  listByMetodo: (metodoId: string) =>
    api.invoke('work:list-by-metodo', metodoId) as Promise<any[]>,
  prepara: (data: { work_id: number; data_prep: string; note?: string | null; operatore?: string | null }) =>
    api.invoke('work:prepara', data) as Promise<any>,
  preparazioniList: (workId: number) =>
    api.invoke('work:preparazioni-list', workId) as Promise<any[]>,
  archivia: (id: number, motivo: string) =>
    api.invoke('work:archivia', id, motivo) as Promise<{ ok: boolean }>,
  checkLotStatus: (workId: number) =>
    api.invoke('work:check-lot-status', workId) as Promise<any[]>,
  ricarica: (params: { old_work_id: number; nuovi_ingredienti: Array<{ old_source_id: number; new_source_id: number }>; metodi_ids: string[] }) =>
    api.invoke('work:ricarica', params) as Promise<{ ok: boolean; new_work_id: number }>,
  setSostituitoDa: (oldId: number, newId: number) =>
    api.invoke('work:set-sostituito-da', oldId, newId) as Promise<{ ok: boolean }>,
  listForImport: (metodoId: string) =>
    api.invoke('work:list-for-import', metodoId) as Promise<any[]>,
  addToMetodo: (workId: number, metodoId: string) =>
    api.invoke('work:add-to-metodo', workId, metodoId) as Promise<{ ok: boolean }>,
  removeFromMetodo: (workId: number, metodoId: string) =>
    api.invoke('work:remove-from-metodo', workId, metodoId) as Promise<{ ok: boolean }>,
}

export const queryApi = {
  snapshot: (request: { strumento_id: string; metodo_id?: string; data: string }) =>
    api.invoke('query:snapshot', request) as Promise<any>,
}


export const schemaCalApi = {
  get: (metodoId: string) =>
    api.invoke('schema-cal:get', metodoId) as Promise<any | null>,
  save: (metodoId: string, workCols: any[][], removedCon: string[], removedMix: string[], scenarioScelto: boolean) =>
    api.invoke('schema-cal:save', metodoId, JSON.stringify({ workCols, removedCon, removedMix, scenarioScelto })) as Promise<{ ok: boolean }>,
}

export const metodoAnalitiApi = {
  list: (metodoId: string) =>
    api.invoke('metodo-analiti:list', metodoId) as Promise<{ id: number; nome: string; ordine: number | null }[]>,
  add: (metodoId: string, nomi: string[]) =>
    api.invoke('metodo-analiti:add', metodoId, nomi) as Promise<{ ok: boolean }>,
  remove: (metodoId: string, nomi: string[]) =>
    api.invoke('metodo-analiti:remove', metodoId, nomi) as Promise<{ ok: boolean }>,
}

