import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useState, useEffect } from 'react'

const pageTitles: Record<string, string> = {
  '/composti': 'Standard di Riferimento',
  '/metodi': 'Metodi Analitici',
  '/strumenti': 'Strumenti',
  '/consumabili': 'Consumabili',
  '/anagrafiche': 'Anagrafiche',
}

export function AppLayout() {
  const location = useLocation()
  const [dbPath, setDbPath] = useState<string | null>(null)
  const title = pageTitles[location.pathname] || 'LC-MS/MS Suite'

  useEffect(() => {
    window.electronAPI.getConfig().then(cfg => setDbPath(cfg.dbPath))
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} dbPath={dbPath} />
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
