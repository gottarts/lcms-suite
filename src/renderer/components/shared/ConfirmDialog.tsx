import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Conferma',
  variant = 'default',
  onConfirm,
  onCancel,
  secondaryAction,
}: ConfirmDialogProps) {
  return (
    // FIX: Dialog invece di AlertDialog.
    // AlertDialog di Radix chiama onOpenChange(false) su ogni click di
    // AlertDialogAction — questo triggera onCancel() (via !v && onCancel())
    // DOPO il click su "Tutti del mix" o "Solo i selezionati", azzerando
    // pendingBulkOpRef e la coda mix-scope prima che execStoria girasse.
    // Con Dialog standard i bottoni non chiudono il dialog automaticamente:
    // la chiusura è controllata solo da onConfirm/onCancel/secondaryAction.
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={onCancel}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Annulla
          </Button>
          {secondaryAction && (
            <Button
              variant="secondary"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
          <Button
            className={cn(variant === 'danger' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}