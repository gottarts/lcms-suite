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
      <SheetContent side="right" className={width ? `sm:max-w-[${width}]` : 'sm:max-w-lg'} style={width ? { maxWidth: width } : undefined}>
        <SheetHeader>
          <SheetTitle className="font-heading">{title}</SheetTitle>
          {subtitle && <SheetDescription>{subtitle}</SheetDescription>}
        </SheetHeader>
        <div className="mt-4 flex-1 overflow-y-auto">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
