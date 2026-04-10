import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'


const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/composti', label: 'Reference Standards', icon: '🧪' },
  { to: '/metodi', label: 'Metodi', icon: '📋' },
  { to: '/work', label: 'Work Solutions', icon: '⚗️' },
  { to: '/strumenti', label: 'Strumenti', icon: '🔬' },
  { to: '/consumabili', label: 'Consumabili', icon: '📦' },
  { to: '/anagrafiche', label: 'Anagrafiche', icon: '📖' },
]

export function Sidebar() {
  const [time, setTime] = useState(new Date())
  const [dbPath, setDbPath] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    window.electronAPI.getConfig().then((cfg) => setDbPath(cfg.dbPath ?? null))
  }, [])

  async function handleChangeFolder() {
    const result = await window.electronAPI.selectFolder()
    if (result.ok) setDbPath(result.dbPath)
  }

  const shortPath = dbPath
    ? dbPath.split(/[\\/]/).slice(-2).join('/')
    : '—'

  return (
    <aside className="w-56 h-screen bg-sidebar-background border-r border-sidebar-border flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="font-heading font-bold text-lg text-sidebar-primary">
          LC-MS/MS Suite
        </h1>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 text-xs text-muted-foreground border-t border-sidebar-border space-y-1">
        <div className="flex items-center gap-1 font-medium text-foreground">
          <span className="text-green-500">●</span> suite
        </div>
        <div className="truncate" title={dbPath ?? ''}>
          {shortPath}
        </div>
        <button
          onClick={handleChangeFolder}
          className="mt-1 w-full border border-sidebar-border rounded px-2 py-0.5 text-xs hover:bg-muted transition-colors"
        >
          CAMBIA CARTELLA
        </button>
      </div>

      <div className="p-3 text-xs text-muted-foreground text-center border-t border-sidebar-border">
        <div>{today}</div>
        <div>{time.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </aside>
  )
}