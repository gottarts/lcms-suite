interface TopbarProps {
  title: string
  dbPath?: string | null
}

export function Topbar({ title, dbPath }: TopbarProps) {
  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-4 bg-card">
      <h2 className="font-heading font-semibold text-base">{title}</h2>
      {dbPath && (
        <span className="text-xs text-muted-foreground font-mono truncate max-w-xs" title={dbPath}>
          {dbPath}
        </span>
      )}
    </header>
  )
}
