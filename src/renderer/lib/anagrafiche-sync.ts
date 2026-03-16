// Mappa campo del composto → nome dell'anagrafica corrispondente
const CAMPO_ANAGRAFICA_MAP: Record<string, string> = {
  classe:             'Classi',
  produttore:         'Produttori',
  solvente:           'Solventi',
  stoccaggio:         'Posizioni stoccaggio',
  operatore_apertura: 'Operatori',
  ubicazione:         'Ubicazioni',
}

/**
 * Dopo ogni salvataggio composto (create o update), chiama questo per
 * aggiungere automaticamente i valori inseriti nelle rispettive anagrafiche.
 *
 * Usa Promise.allSettled: se un singolo sync fallisce non blocca il flusso.
 *
 * @param data - oggetto con i campi del form (anche parziale, ignora i null/undefined)
 */
export async function syncAnagrafiche(
  data: Partial<Record<string, string | null | undefined>>
): Promise<void> {
  const promises = Object.entries(CAMPO_ANAGRAFICA_MAP)
    .filter(([campo]) => {
      const val = data[campo]
      return typeof val === 'string' && val.trim().length > 0
    })
    .map(([campo, nomeAnagrafica]) =>
      window.electronAPI.invoke(
        'anagrafiche:sync-voce',
        nomeAnagrafica,
        (data[campo] as string).trim()
      )
    )

  await Promise.allSettled(promises)
}