import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { SetupPage } from './pages/setup/SetupPage'
import { AnagrafichePage } from './pages/anagrafiche/AnagrafichePage'
import { MetodiPage } from './pages/metodi/MetodiPage'
import { StrumentiPage } from './pages/strumenti/StrumentiPage'
import { ConsumabiliPage } from './pages/consumabili/ConsumabiliPage'
import { useState, useEffect } from 'react'

export function App() {
  const [dbReady, setDbReady] = useState<boolean | null>(null)

  useEffect(() => {
    window.electronAPI.getConfig().then(cfg => {
      setDbReady(cfg.dbPath !== null && cfg.dbExists)
    })
  }, [])

  if (dbReady === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">Caricamento...</p>
      </div>
    )
  }

  if (!dbReady) {
    return <SetupPage onComplete={() => setDbReady(true)} />
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/composti" element={<div className="text-muted-foreground">Composti — TODO</div>} />
          <Route path="/metodi" element={<MetodiPage />} />
          <Route path="/strumenti" element={<StrumentiPage />} />
          <Route path="/consumabili" element={<ConsumabiliPage />} />
          <Route path="/anagrafiche" element={<AnagrafichePage />} />
          <Route path="*" element={<Navigate to="/composti" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
