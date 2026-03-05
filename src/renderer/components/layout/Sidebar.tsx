import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'

const navItems = [
  { to: '/composti', label: 'Composti', icon: '\uD83E\uDDEA' },
  { to: '/metodi', label: 'Metodi', icon: '\uD83D\uDCCB' },
  { to: '/strumenti', label: 'Strumenti', icon: '\uD83D\uDD2C' },
  { to: '/consumabili', label: 'Consumabili', icon: '\uD83D\uDCE6' },
  { to: '/anagrafiche', label: 'Anagrafiche', icon: '\uD83D\uDCD6' },
]

export function Sidebar() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

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

      <div className="p-3 text-xs text-muted-foreground text-center border-t border-sidebar-border">
        {time.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </aside>
  )
}
