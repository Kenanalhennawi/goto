import type { ChapterImage } from "@/lib/types";

export function ChapterImageGallery({ images }: { images: ChapterImage[] }) {
  if (!images || images.length === 0) return null;

  return (
    <div className="mt-10 pt-8 border-t border-border">
      <h3 className="font-display text-sm font-medium text-ink-muted mb-4 uppercase tracking-wider">
        Reference screenshots ({images.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {images
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((img) => (
            <figure
              key={img.id}
              className="bg-panel border border-border rounded-lg overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.storage_path}
                alt={`Reference figure, page ${img.page ?? "?"}`}
                className="w-full h-auto"
                loading="lazy"
              />
              {img.page && (
                <figcaption className="px-3 py-2 text-xs text-ink-faint font-mono border-t border-border">
                  Source page {img.page}
                </figcaption>
              )}
            </figure>
          ))}
      </div>
    </div>
  );
}
