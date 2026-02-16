'use client';

import { useState } from 'react';
import CardFrame from '@/components/cards/CardFrame';

type SymptomCheckCardProps = {
  symptoms: string[];
  summary: string;
  initialSelected?: string[];
  onSubmit?: (selected: string[]) => void;
};

export default function SymptomCheckCard({
  symptoms,
  summary,
  initialSelected = [],
  onSubmit
}: SymptomCheckCardProps) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [saved, setSaved] = useState(false);

  const toggleSymptom = (symptom: string) => {
    setSelected((prev) =>
      prev.includes(symptom) ? prev.filter((item) => item !== symptom) : [...prev, symptom]
    );
    setSaved(false);
  };

  const handleSubmit = () => {
    onSubmit?.(selected);
    setSaved(true);
  };

  return (
    <CardFrame title="Symptom check" typeLabel="Symptom check">
      {summary && <p className="mb-3">{summary}</p>}
      <div className="grid gap-2">
        {symptoms.map((symptom) => (
          <label
            key={symptom}
            className="flex items-start gap-2 rounded-xl border border-clay/60 bg-white/70 px-3 py-2"
          >
            <input
              type="checkbox"
              checked={selected.includes(symptom)}
              onChange={() => toggleSymptom(symptom)}
              className="mt-1"
            />
            <span>{symptom}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={handleSubmit}
          className="rounded-full bg-moss px-4 py-2 text-xs font-semibold text-white"
        >
          Update symptoms
        </button>
        {saved && <span className="text-xs text-moss">Saved to your session.</span>}
      </div>
    </CardFrame>
  );
}
