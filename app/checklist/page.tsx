'use client';

import { useEffect, useState } from 'react';
import type { AssistantTurn } from '@/lib/schemas';

type ChecklistItem = {
  id: string;
  label: string;
  status: 'todo' | 'in_progress' | 'done';
};

export default function ChecklistPage() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [summary, setSummary] = useState('');
  const [assistantTurn, setAssistantTurn] = useState<AssistantTurn | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem('navigator_last_response');
    const loadFromStored = (payload: AssistantTurn) => {
      const checklistCard = payload.ui_cards.find((card) => card.type === 'checklist');
      setChecklist(checklistCard?.content.checklist ?? []);
      setSummary(payload.assistant_message ?? '');
      setAssistantTurn(payload);
    };

    if (stored) {
      try {
        loadFromStored(JSON.parse(stored) as AssistantTurn);
        return;
      } catch (error) {
        console.error('Failed to parse stored response', error);
      }
    }

    const fetchLatest = async () => {
      try {
        const exportResponse = await fetch('/api/session/export');
        if (exportResponse.ok) {
          const exportData = await exportResponse.json();
          const lastAssistant = (exportData?.messages ?? [])
            .filter((msg: any) => msg.role === 'assistant')
            .pop();
          if (lastAssistant?.contentJson) {
            loadFromStored(lastAssistant.contentJson as AssistantTurn);
          }
          if (Array.isArray(exportData?.checklist_items)) {
            const mapped = exportData.checklist_items.map((item: any) => ({
              id: item.id,
              label: item.label,
              status: item.status,
              due_date: item.due_date ?? null
            }));
            setChecklist(mapped);
          }
          return;
        }

        const response = await fetch('/api/chat/summary');
        const data = await response.json();
        if (data?.assistant_turn) {
          loadFromStored(data.assistant_turn as AssistantTurn);
        }
      } catch (error) {
        console.error('Failed to fetch latest summary', error);
      }
    };

    fetchLatest();
  }, []);

  return (
    <div className="grid gap-8">
      <section className="card fade-in">
        <h1 className="font-serif text-3xl text-ink">Visit Checklist</h1>
        <p className="mt-2 text-muted">
          This checklist summarizes the most recent navigator response. Refresh the chat if you need an
          updated plan.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => window.print()}
            className="rounded-full bg-moss px-6 py-2 text-xs font-semibold text-white"
          >
            Print / share
          </button>
          <a
            href="/chat"
            className="rounded-full border border-moss px-6 py-2 text-xs font-semibold text-moss"
          >
            Back to chat
          </a>
        </div>
      </section>

      <section className="card">
        <div className="text-sm uppercase tracking-[0.2em] text-moss">Summary</div>
        <p className="mt-3 text-ink">
          {summary ||
            'No checklist saved yet. Ask the navigator a question to generate a plan.'}
        </p>
      </section>

      <section className="card">
        <div className="text-sm uppercase tracking-[0.2em] text-moss">Tasks</div>
        <ul className="mt-4 grid gap-3">
          {checklist.length === 0 && (
            <li className="text-muted">No tasks yet.</li>
          )}
          {checklist.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-2xl border border-clay bg-white/80 px-4 py-3"
            >
              <div>
                <div>{item.label}</div>
                {item.due_date && <div className="text-xs text-muted">Due: {item.due_date}</div>}
              </div>
              <span className="badge">{item.status.replace('_', ' ')}</span>
            </li>
          ))}
        </ul>
      </section>

      {assistantTurn && (
        <section className="card">
          <div className="text-sm uppercase tracking-[0.2em] text-moss">Questions to ask</div>
          <ul className="mt-4 list-disc pl-5 text-muted">
            {(assistantTurn.ui_cards.find((card) => card.type === 'questions_to_ask')?.content.questions ??
              []).map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
