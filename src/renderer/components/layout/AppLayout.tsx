import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BackButton } from '@/components/shared/BackButton'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4">
        <div className="mb-2">
          <BackButton />
        </div>
        <Outlet />
      </main>
    </div>
  )
}