export const SOLVENT_DENSITIES: Record<string, number> = {
  'Acetonitrile (MeCN)': 0.786,
  'Metanolo (MeOH)': 0.791,
  'DMSO': 1.100,
  'Acqua': 1.000,
  'Etanolo (EtOH)': 0.789,
  'Acetone': 0.791,
  'Etil acetato': 0.902,
  'Diclorometano': 1.325,
  'Formiato di metile': 0.974,
}

export const SOLVENT_LIST: { nome: string; densita: number }[] = Object.entries(
  SOLVENT_DENSITIES
)
  .map(([nome, densita]) => ({ nome, densita }))
  .sort((a, b) => a.nome.localeCompare(b.nome))
