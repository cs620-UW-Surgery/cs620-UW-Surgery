'use client';

import { useEffect, useState } from 'react';
import type { AssistantTurn } from '@/lib/schemas';
import CardRenderer from '@/components/cards/CardRenderer';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: AssistantTurn;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clientState, setClientState] = useState<Record<string, unknown>>({});
  const [appConfig, setAppConfig] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedState = localStorage.getItem('navigator_client_state');
    if (storedState) {
      try {
        setClientState(JSON.parse(storedState));
      } catch {
        setClientState({});
      }
    }

    const loadHistory = async () => {
      try {
        const response = await fetch('/api/chat/history');
        const payload = await response.json();
        if (payload?.messages) {
          const history = payload.messages.map((message: any) => ({
            id: message.id ?? crypto.randomUUID(),
            role: message.role,
            content: message.content,
            data: message.assistant_turn ?? undefined
          }));
          setMessages(history);
          const lastAssistant = history.filter((msg: ChatMessage) => msg.role === 'assistant').pop();
          if (lastAssistant?.data) {
            sessionStorage.setItem('navigator_last_response', JSON.stringify(lastAssistant.data));
          }
        }
      } catch (error) {
        console.error('Failed to load history', error);
      }
    };

    loadHistory();

    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        if (data?.config) {
          setAppConfig(data.config);
        }
      } catch (error) {
        console.error('Failed to load config', error);
      }
    };

    loadConfig();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim()
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_message: userMessage.content,
          session_id: null,
          client_state: clientState
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload?.assistant_message) {
        throw new Error('Invalid response');
      }
      const data = payload as AssistantTurn;

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.assistant_message,
        data
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('navigator_last_response', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Chat error', error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, we could not process that message. Please try again.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReply = (value: string) => {
    setInput(value);
  };

  const handleNavigate = (href: string) => {
    window.location.href = href;
  };

  const handleShareSummary = () => {
    const lastAssistant = [...messages].reverse().find((msg) => msg.role === 'assistant' && msg.data);
    if (lastAssistant?.data) {
      sessionStorage.setItem('navigator_last_response', JSON.stringify(lastAssistant.data));
    }
    window.location.href = '/checklist';
  };

  const handleSymptomUpdate = (selected: string[]) => {
    const nextState = { ...clientState, selectedSymptoms: selected };
    setClientState(nextState);
    localStorage.setItem('navigator_client_state', JSON.stringify(nextState));
  };

  const handleClearHistory = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await fetch('/api/session/delete', { method: 'POST' });
      setMessages([]);
      setInput('');
      setClientState({});
      if (typeof window !== 'undefined') {
        localStorage.removeItem('navigator_client_state');
        sessionStorage.removeItem('navigator_last_response');
      }
    } catch (error) {
      console.error('Failed to clear history', error);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="grid gap-8">
      <section className="card fade-in">
        <h1 className="font-serif text-3xl text-ink">Navigator Chat</h1>
        <p className="mt-2 text-muted">
          Ask about typical testing steps, prep instructions, or what to expect after your referral.
        </p>
        {appConfig.clinic_description && (
          <div className="mt-4 rounded-2xl border border-clay bg-white/70 px-4 py-3 text-sm text-muted">
            {appConfig.clinic_description}
          </div>
        )}
      </section>

      <section className="grid gap-4">
        {messages.map((message) => (
          <article key={message.id} className="card">
            <div className="text-xs uppercase tracking-[0.2em] text-moss">
              {message.role === 'user' ? 'You' : 'Navigator'}
            </div>
            <p className="mt-3 text-base text-ink">{message.content}</p>

            {message.role === 'assistant' && message.data && (
              <div className="mt-4 grid gap-4 text-sm text-muted">
                {message.data.triage_level !== 'none' && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
                    <div className="font-semibold">Triage guidance</div>
                    <div>
                      {(() => {
                        const handoffCard = message.data.ui_cards.find((card) => card.type === 'handoff');
                        const handoffMessage = handoffCard?.content?.handoff?.message?.trim();
                        if (handoffMessage) return handoffMessage;
                        if (message.data.triage_level === 'contact_clinic') {
                          return 'Please contact your clinic for timely guidance based on your symptoms.';
                        }
                        if (message.data.triage_level === 'urgent') {
                          return 'Seek urgent evaluation (urgent care or same-day clinical review) for your symptoms.';
                        }
                        return 'Seek emergency evaluation or call emergency services if symptoms are severe.';
                      })()}
                    </div>
                  </div>
                )}

                <div className="text-xs uppercase tracking-[0.2em] text-moss">
                  Mode: {message.data.mode} | Triage: {message.data.triage_level}
                </div>

                <div>
                  <div className="font-semibold text-ink">Disclaimer</div>
                  <p className="mt-2">{message.data.disclaimer}</p>
                </div>

                <div className="grid gap-3">
                  {message.data.ui_cards.map((card, index) => (
                    <CardRenderer
                      key={`${card.type}-${index}`}
                      card={card}
                      selectedSymptoms={
                        Array.isArray(clientState?.selectedSymptoms)
                          ? (clientState.selectedSymptoms as string[])
                          : []
                      }
                      onSymptomSubmit={handleSymptomUpdate}
                      onShareSummary={handleShareSummary}
                      config={{
                        billing_phone: appConfig.billing_phone ?? null,
                        scheduling_link: appConfig.scheduling_link ?? null,
                        what_to_bring: appConfig.what_to_bring ?? null,
                        emergency_guidance: appConfig.emergency_guidance ?? null
                      }}
                    />
                  ))}
                </div>

                {message.data.suggested_actions?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {message.data.suggested_actions.map((action) => (
                      <button
                        key={`${action.label}-${action.action_type}`}
                        onClick={() => {
                          if (action.action_type === 'quick_reply' && action.payload.value) {
                            handleQuickReply(action.payload.value);
                          }
                          if (action.action_type === 'navigate' && action.payload.href) {
                            handleNavigate(action.payload.href);
                          }
                          if (action.action_type === 'share_summary') {
                            handleShareSummary();
                          }
                        }}
                        className="rounded-full border border-moss px-4 py-2 text-xs font-semibold text-moss"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <div className="font-semibold text-ink">Citations</div>
                  <ul className="mt-2 list-disc pl-5">
                    {message.data.citations.map((item) => (
                      <li key={`${item.citation_key}-${item.quote ?? 'none'}`}>
                        {item.citation_key}
                        {item.quote ? ` — "${item.quote}"` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="card">
        <div className="grid gap-4">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            placeholder="What is the usual workup after an incidental adrenal nodule?"
            className="w-full rounded-2xl border border-clay bg-white/80 px-4 py-3"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <span>Please avoid entering sensitive identifiers like DOB, SSN, or insurance numbers.</span>
            <button
              type="button"
              onClick={handleClearHistory}
              className="font-semibold text-moss transition hover:underline"
              disabled={clearing}
            >
              {clearing ? 'Clearing…' : 'Clear chat history'}
            </button>
          </div>
          <button
            onClick={handleSend}
            className="rounded-full bg-moss px-6 py-3 text-sm font-semibold text-white"
            disabled={loading}
          >
            {loading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </section>
    </div>
  );
}
