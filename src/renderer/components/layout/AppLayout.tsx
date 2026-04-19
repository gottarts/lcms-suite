import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BackButton } from '@/components/shared/BackButton'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4 flex flex-col">
        <div className="mb-2">
          <BackButton />
        </div>
        <div className="flex-1 min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  )
}