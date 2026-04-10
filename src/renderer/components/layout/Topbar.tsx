interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="h-12 border-b border-border flex items-center px-4 bg-card">
      <h2 className="font-heading font-semibold text-base">{title}</h2>
    </header>
  )
}
