import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BackButtonProps {
  label?: string
  className?: string
}

export function BackButton({ label = 'Indietro', className }: BackButtonProps) {
  const navigate = useNavigate()
  const location = useLocation()

  if (location.pathname === '/dashboard') return null
  if (typeof window !== 'undefined' && window.history.length <= 1) return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => navigate(-1)}
      className={cn('gap-1', className)}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  )
}
