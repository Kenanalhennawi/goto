interface ChapterBadgeProps {
  number: number;
  size?: "sm" | "md" | "lg";
}

export function ChapterBadge({ number, size = "md" }: ChapterBadgeProps) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-16 w-16 text-xl",
  };

  return (
    <div
      className={`${sizes[size]} flex flex-shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 font-mono font-semibold tabular-nums text-accent transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white`}
    >
      {String(number).padStart(2, "0")}
    </div>
  );
}
