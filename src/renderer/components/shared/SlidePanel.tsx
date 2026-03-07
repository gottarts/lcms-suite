import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'

interface SlidePanelProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  width?: string
  children: React.ReactNode
}

export function SlidePanel({ open, onClose, title, subtitle, width, children }: SlidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex flex-col p-0"
        style={width ? { maxWidth: width } : undefined}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="font-heading">{title}</SheetTitle>
          {subtitle && <SheetDescription>{subtitle}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
