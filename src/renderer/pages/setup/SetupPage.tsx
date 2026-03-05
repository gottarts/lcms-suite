import { useState } from 'react'

type Step = 'welcome' | 'choose-import' | 'importing' | 'done' | 'error'

interface SetupPageProps {
  onComplete: () => void
}

export function SetupPage({ onComplete }: SetupPageProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [dbPath, setDbPath] = useState<string>('')
  const [isNew, setIsNew] = useState(false)
  const [importResult, setImportResult] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState<string>('')

  const handleSelectFolder = async () => {
    const result = await window.electronAPI.selectFolder()
    if (!result.ok) return
    setDbPath(result.dbPath || '')
    setIsNew(result.isNew || false)
    if (result.isNew) {
      setStep('choose-import')
    } else {
      setStep('done')
    }
  }

  const handleImport = async () => {
    const fileResult = await window.electronAPI.selectJson()
    if (!fileResult.ok || !fileResult.path) return
    setStep('importing')
    const result = await window.electronAPI.importLegacyJson(fileResult.path)
    if (result.ok) {
      setImportResult(result.counts || null)
      setStep('done')
    } else {
      setError(result.error || 'Errore sconosciuto durante l\'importazione')
      setStep('error')
    }
  }

  const handleSkip = () => {
    setStep('done')
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-lg border border-border">
        <h1 className="font-heading text-2xl font-bold text-center mb-2 text-primary">
          LC-MS/MS Suite
        </h1>

        {step === 'welcome' && (
          <div className="space-y-4 text-center">
            <p className="text-muted-foreground text-sm">
              Benvenuto! Per iniziare, seleziona la cartella dove salvare il database.
              La cartella può essere su una unità di rete condivisa.
            </p>
            <button
              onClick={handleSelectFolder}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Seleziona cartella
            </button>
          </div>
        )}

        {step === 'choose-import' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Nuovo database creato in:
            </p>
            <p className="text-xs font-mono text-foreground bg-muted p-2 rounded truncate" title={dbPath}>
              {dbPath}
            </p>
            <p className="text-sm text-muted-foreground">
              Vuoi importare i dati da un file JSON esistente?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleImport}
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Importa da lcms-data.json
              </button>
              <button
                onClick={handleSkip}
                className="w-full py-2 px-4 bg-secondary text-secondary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Inizia da zero
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Importazione in corso...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-green-600 font-medium">Database pronto!</p>
            {importResult && (
              <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded">
                {Object.entries(importResult).map(([key, count]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={onComplete}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Continua
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-destructive font-medium">Errore nell'importazione</p>
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">{error}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleImport}
                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Riprova
              </button>
              <button
                onClick={handleSkip}
                className="w-full py-2 px-4 bg-secondary text-secondary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Continua senza importare
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
