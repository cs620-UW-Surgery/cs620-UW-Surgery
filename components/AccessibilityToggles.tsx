'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'navigator_accessibility';

type AccessibilityState = {
  highContrast: boolean;
  largeText: boolean;
};

export default function AccessibilityToggles() {
  const [state, setState] = useState<AccessibilityState>({
    highContrast: false,
    largeText: false
  });

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AccessibilityState;
        setState(parsed);
      } catch {
        setState({ highContrast: false, largeText: false });
      }
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('high-contrast', state.highContrast);
    root.classList.toggle('large-text', state.largeText);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        onClick={() => setState((prev) => ({ ...prev, highContrast: !prev.highContrast }))}
        className={`rounded-full border px-3 py-1 ${
          state.highContrast ? 'border-moss bg-moss text-white' : 'border-clay text-ink'
        }`}
      >
        High contrast
      </button>
      <button
        onClick={() => setState((prev) => ({ ...prev, largeText: !prev.largeText }))}
        className={`rounded-full border px-3 py-1 ${
          state.largeText ? 'border-moss bg-moss text-white' : 'border-clay text-ink'
        }`}
      >
        Large text
      </button>
    </div>
  );
}
