'use client';

import { useEffect, useRef, useState } from 'react';
import type { AssistantTurn } from '@/lib/schemas';
import CardRenderer from '@/components/cards/CardRenderer';
import CitationList from '@/components/CitationList';
import PipelineTraceCard from '@/components/cards/PipelineTraceCard';

declare global {
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }
  interface SpeechRecognitionResultList {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
  }
  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
  }
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }
}

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: AssistantTurn;
  pipeline_trace?: any;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clientState, setClientState] = useState<Record<string, unknown>>({});
  const [appConfig, setAppConfig] = useState<Record<string, string | null>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);
  const preRecordInputRef = useRef('');

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
    setTtsSupported(typeof window.speechSynthesis !== 'undefined');
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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

    if (sessionStorage.getItem('navigator_session_active')) {
      const loadHistory = async () => {
        try {
          const response = await fetch('/api/chat/history');
          const payload = await response.json();
          if (payload?.messages) {
            const history = payload.messages.map((message: any) => ({
              id: message.id ?? crypto.randomUUID(),
              role: message.role,
              content: message.content,
              data: message.assistant_turn ?? undefined,
              pipeline_trace: message.assistant_turn?.pipeline_trace ?? null
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
    }
    sessionStorage.setItem('navigator_session_active', '1');

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

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

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
        data,
        pipeline_trace: payload.pipeline_trace ?? null
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

  function createRecognition() {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return null;

    const recognition = new SR() as SpeechRecognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      const prefix = preRecordInputRef.current;
      const separator = prefix && !prefix.endsWith(' ') ? ' ' : '';
      setInput(prefix + separator + finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    return recognition;
  }

  const toggleSpeak = (messageId: string, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingMessageId(messageId);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!speechSupported) return;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }

    const recognition = createRecognition();
    if (!recognition) return;

    preRecordInputRef.current = input;
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  return (
    <div className="grid gap-8">
      <section className="card fade-in overflow-hidden p-0">
        <video
          controls
          playsInline
          preload="metadata"
          className="w-full"
          poster=""
        >
          <source src="https://0qduonpuurottffe.public.blob.vercel-storage.com/Patient%20adrenal%20copy.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </section>

      <section className="card fade-in">
        <h1 className="font-serif text-3xl text-darkgray">Navigator Chat</h1>
        <p className="mt-2 text-muted">
          Ask about typical testing steps, prep instructions, or what to expect after your referral.
        </p>
        {appConfig.clinic_description && (
          <div className="mt-4 rounded-2xl border border-accent bg-white/70 px-4 py-3 text-sm text-muted">
            {appConfig.clinic_description}
          </div>
        )}
      </section>

      <section className="grid gap-4">
        {messages.map((message) => (
          <article key={message.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-[0.2em] text-uwred">
                {message.role === 'user' ? 'You' : 'Navigator'}
              </div>
              {message.role === 'assistant' && ttsSupported && (
                <button
                  type="button"
                  onClick={() => toggleSpeak(message.id, message.content)}
                  aria-label={speakingMessageId === message.id ? 'Stop reading' : 'Read message aloud'}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent text-uwred transition hover:bg-gray-100"
                >
                  {speakingMessageId === message.id ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-4 w-4"
                      aria-hidden
                    >
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            <p className="mt-3 text-base text-darkgray">{message.content}</p>

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

                <div className="text-xs uppercase tracking-[0.2em] text-uwred">
                  Mode: {message.data.mode} | Triage: {message.data.triage_level}
                </div>

                <div>
                  <div className="font-semibold text-darkgray">Disclaimer</div>
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
                        className="rounded-full border border-uwred px-4 py-2 text-xs font-semibold text-uwred"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {message.data.citations.length > 0 && (
                  <CitationList citations={message.data.citations} />
                )}

                {message.pipeline_trace && (
                  <PipelineTraceCard trace={message.pipeline_trace} />
                )}
              </div>
            )}
          </article>
        ))}

        {loading && (
          <article className="card">
            <div className="text-xs uppercase tracking-[0.2em] text-uwred">Navigator</div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="thinking-dot" />
              <span className="thinking-dot thinking-dot-delay-1" />
              <span className="thinking-dot thinking-dot-delay-2" />
            </div>
          </article>
        )}

        <div ref={messagesEndRef} />
      </section>

      <section className="card">
        <div className="grid gap-4">
          <div className="relative">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              rows={3}
              placeholder="Ask any question about adrenal nodules here."
              className="w-full rounded-2xl border border-accent bg-white/80 px-4 py-3 pr-12"
            />
            {speechSupported && (
              <button
                type="button"
                onClick={toggleRecording}
                disabled={loading}
                aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full transition ${isRecording
                  ? 'bg-uwred text-white animate-pulse'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-uwred'
                  } disabled:opacity-50`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="17" x2="12" y2="22" />
                </svg>
              </button>
            )}
          </div>
          {isRecording && (
            <div className="flex items-center gap-2 text-xs font-semibold text-uwred">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-uwred" />
              Listening… speak now
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <span>Please avoid entering sensitive identifiers like DOB, SSN, or insurance numbers.</span>
            <button
              type="button"
              onClick={handleClearHistory}
              className="font-semibold text-uwred transition hover:underline"
              disabled={clearing}
            >
              {clearing ? 'Clearing…' : 'Clear chat history'}
            </button>
          </div>
          <button
            onClick={handleSend}
            className="rounded-full bg-uwred px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={loading}
          >
            Send
          </button>
        </div>
      </section>
    </div>
  );
}
