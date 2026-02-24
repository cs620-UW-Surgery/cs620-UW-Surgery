'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function OnboardingPage() {
  const [name, setName] = useState('');
  const [questions, setQuestions] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'saved'>('idle');

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'navigator_onboarding',
        JSON.stringify({ name, questions, updatedAt: new Date().toISOString() })
      );
    }
    setSubmitStatus('saved');
  };

  return (
    <div className="grid gap-8">
      <section className="card fade-in">
        <h1 className="font-serif text-3xl text-ink">Onboarding</h1>
        <p className="mt-2 text-muted">
          Share high-level context so the navigator can personalize the flow. Avoid entering sensitive
          personal identifiers.
        </p>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm">
            Preferred name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alex"
              className="w-full rounded-2xl border border-clay bg-white/80 px-4 py-3"
            />
          </label>
          <label className="grid gap-2 text-sm">
            What questions are on your mind?
            <textarea
              value={questions}
              onChange={(event) => setQuestions(event.target.value)}
              placeholder="I want to know what labs are typical, how to prep, and who to call about costs."
              rows={4}
              className="w-full rounded-2xl border border-clay bg-white/80 px-4 py-3"
            />
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            className="rounded-full bg-moss px-6 py-3 text-sm font-semibold text-white"
          >
            Save onboarding
          </button>
          <Link
            href="/chat"
            className="rounded-full border border-moss px-6 py-3 text-sm font-semibold text-moss"
          >
            Continue to chat
          </Link>
        </div>
        {submitStatus === 'saved' && (
          <p className="mt-3 text-sm text-moss">Saved locally for this browser.</p>
        )}
      </section>
    </div>
  );
}
