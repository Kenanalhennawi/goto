interface ChapterBadgeProps {
  number: number;
  size?: "sm" | "md" | "lg";
}

export function ChapterBadge({ number, size = "md" }: ChapterBadgeProps) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-16 h-16 text-xl",
  };

  return (
    <div
      className={`${sizes[size]} flex-shrink-0 flex items-center justify-center rounded border border-border bg-panel font-mono font-medium text-ink-muted tabular-nums group-hover:border-accent group-hover:text-accent transition-colors`}
    >
      {String(number).padStart(2, "0")}
    </div>
  );
}
