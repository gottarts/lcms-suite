import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { SetupPage } from './pages/setup/SetupPage'
import { AnagrafichePage } from './pages/anagrafiche/AnagrafichePage'
import { MetodiPage } from './pages/metodi/MetodiPage'
import { StrumentiPage } from './pages/strumenti/StrumentiPage'
import { ConsumabiliPage } from './pages/consumabili/ConsumabiliPage'
import { CompostiPage } from './pages/composti/CompostiPage'
import { WorkPage } from './pages/work/WorkPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
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
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/composti" element={<CompostiPage />} />
          <Route path="/metodi" element={<MetodiPage />} />
          <Route path="/strumenti" element={<StrumentiPage />} />
          <Route path="/consumabili" element={<ConsumabiliPage />} />
          <Route path="/anagrafiche" element={<AnagrafichePage />} />
          <Route path="/work" element={<WorkPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}