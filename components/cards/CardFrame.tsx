import type { ReactNode } from 'react';

export default function CardFrame({
  title,
  typeLabel,
  children
}: {
  title: string;
  typeLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-clay bg-white/80 p-4 shadow-sm">
      {typeLabel && (
        <div className="text-xs uppercase tracking-[0.2em] text-moss">{typeLabel}</div>
      )}
      <div className="mt-2 font-semibold text-ink">{title}</div>
      <div className="mt-3 text-sm text-muted">{children}</div>
    </div>
  );
}
