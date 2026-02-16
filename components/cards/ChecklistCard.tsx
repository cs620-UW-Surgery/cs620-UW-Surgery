'use client';

import { useEffect, useState } from 'react';
import CardFrame from '@/components/cards/CardFrame';

type ChecklistItem = {
  id: string;
  label: string;
  status: 'todo' | 'in_progress' | 'done';
  due_date?: string | null;
};

const STORAGE_KEY = 'navigator_checklist_state';

function loadStoredState(): Record<string, ChecklistItem['status']> {
  if (typeof window === 'undefined') return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, ChecklistItem['status']>;
  } catch {
    return {};
  }
}

export default function ChecklistCard({ items }: { items: ChecklistItem[] }) {
  const [statusMap, setStatusMap] = useState<Record<string, ChecklistItem['status']>>({});

  useEffect(() => {
    setStatusMap(loadStoredState());
  }, []);

  const updateStatus = (item: ChecklistItem) => {
    const nextStatus = item.status === 'done' ? 'todo' : 'done';
    setStatusMap((prev) => {
      const updated = { ...prev, [item.id]: nextStatus };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <CardFrame title="Checklist" typeLabel="Checklist">
      <div className="grid gap-2">
        {items.map((item) => {
          const currentStatus = statusMap[item.id] ?? item.status;
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-clay/60 bg-white/70 px-3 py-2"
            >
              <div>
                <div className="font-semibold text-ink">{item.label}</div>
                {item.due_date && (
                  <div className="text-xs text-muted">Due: {item.due_date}</div>
                )}
              </div>
              <button
                onClick={() => updateStatus(item)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  currentStatus === 'done'
                    ? 'bg-moss text-white'
                    : 'border border-moss text-moss'
                }`}
              >
                {currentStatus === 'done' ? 'Completed' : 'Mark done'}
              </button>
            </div>
          );
        })}
        {items.length === 0 && <p>No checklist items yet.</p>}
      </div>
    </CardFrame>
  );
}
