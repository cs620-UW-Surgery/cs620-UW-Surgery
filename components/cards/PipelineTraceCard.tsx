'use client';

import { useState } from 'react';
import type { PipelineTrace } from '@/lib/agents/schemas';

export default function PipelineTraceCard({ trace }: { trace: PipelineTrace }) {
  const [expanded, setExpanded] = useState(false);

  if (!trace.gatekeeper && !trace.analyzer && !trace.scope) return null;

  return (
    <div className="rounded-2xl border border-[var(--accent)]/60 bg-white/70 p-3 mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-semibold text-uwred transition hover:underline"
      >
        {expanded ? 'Hide' : 'Show'} agent pipeline trace
      </button>
      {expanded && (
        <div className="mt-3 grid gap-2 text-xs">
          {trace.gatekeeper && (
            <div
              className={`rounded-xl p-3 ${
                trace.gatekeeper.category === 'safe'
                  ? 'bg-green-50 border border-green-200'
                  : trace.gatekeeper.category === 'medical_emergency'
                  ? 'bg-orange-50 border border-orange-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <span className="font-semibold">Gatekeeper:</span>{' '}
              {trace.gatekeeper.category.toUpperCase()} &mdash; {trace.gatekeeper.reason}
            </div>
          )}
          {trace.analyzer && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
              <span className="font-semibold">Analyzer:</span> type={trace.analyzer.type}
              <br />
              <span className="text-gray-600">Intent:</span> {trace.analyzer.intent}
            </div>
          )}
          {trace.scope && (
            <div
              className={`rounded-xl p-3 ${
                trace.scope.in_scope
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-orange-50 border border-orange-200'
              }`}
            >
              <span className="font-semibold">Scope:</span>{' '}
              {trace.scope.in_scope ? 'IN SCOPE' : 'OUT OF SCOPE'} &mdash; {trace.scope.reason}
              {trace.scope.needs_clarification && trace.scope.clarification_question && (
                <>
                  <br />
                  <span className="text-gray-600">Clarification needed:</span>{' '}
                  {trace.scope.clarification_question}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
