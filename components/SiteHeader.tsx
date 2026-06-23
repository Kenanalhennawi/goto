import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-panel/60 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center font-display font-bold text-sm text-base">
            FZ
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-semibold text-ink text-[15px] tracking-tight">GO TO</span>
            <span className="text-[10px] text-ink-faint uppercase tracking-wider">Contact Centre Guide</span>
          </div>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-ink-muted hover:text-ink transition-colors">
            Manifest
          </Link>
          <Link href="/login" className="text-ink-muted hover:text-accent transition-colors">
            Quality Team Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
