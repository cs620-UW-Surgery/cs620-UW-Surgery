import { describe, expect, it } from 'vitest';
import { AssistantTurnSchema } from '@/lib/schemas';
import { runDialogueEngine, decideRouteForMessage } from '@/lib/dialogueEngine';

process.env.DISABLE_OPENAI = 'true';
delete process.env.DATABASE_URL;

const prohibitedPatterns = [
  /you (have|are diagnosed with)/i,
  /diagnos(e|is|ed)/i,
  /you need (surgery|treatment)/i,
  /stop (your|the) (med|medication)/i,
  /increase (your|the) dose/i,
  /decrease (your|the) dose/i
];

const citationKeywords = /(DST|dexamethasone|metanephrines|HU|Hounsfield|biopsy|alpha blockade)/i;

const goldens = [
  {
    prompt: 'What is the usual workup after an incidental adrenal nodule?',
    expected: { mode: 'faq', triage_level: 'none', cards: ['roadmap', 'cost_navigation'] }
  },
  {
    prompt: 'I have severe headache, palpitations, sweating',
    expected: { mode: 'triage', triage_level: 'emergency', cards: ['symptom_check', 'handoff'] }
  },
  {
    prompt: 'Can you help me with intake questions?',
    expected: { mode: 'guided_intake', triage_level: 'none', cards: ['symptom_check', 'checklist', 'questions_to_ask'] }
  }
];

function flattenText(turn: any) {
  const parts: string[] = [turn.assistant_message ?? ''];
  for (const card of turn.ui_cards ?? []) {
    parts.push(card.title ?? '');
    parts.push(card.content?.summary ?? '');
    parts.push(...(card.content?.bullets ?? []));
    parts.push(...(card.content?.questions ?? []));
    parts.push(...(card.content?.cost_tips ?? []));
    parts.push(...(card.content?.symptoms ?? []));
    parts.push(...(card.content?.tests ?? []).flatMap((t: any) => [t.name, ...(t.instructions ?? [])]));
    parts.push(...(card.content?.steps ?? []).flatMap((s: any) => [s.label, s.detail]));
    parts.push(card.content?.handoff?.message ?? '');
  }
  return parts.join(' ');
}

function stripDynamicIds(payload: any) {
  if (Array.isArray(payload)) {
    return payload.map(stripDynamicIds);
  }
  if (payload && typeof payload === 'object') {
    const entries = Object.entries(payload)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, stripDynamicIds(value)]);
    return Object.fromEntries(entries);
  }
  return payload;
}

describe('Dialogue Engine E2E', () => {
  it('matches golden route decisions', () => {
    for (const testCase of goldens) {
      const decision = decideRouteForMessage(testCase.prompt);
      expect(decision.mode).toBe(testCase.expected.mode);
      expect(decision.triage_level).toBe(testCase.expected.triage_level);
      expect(decision.cards).toEqual(testCase.expected.cards);
    }
  });

  it('produces valid AssistantTurn JSON and enforces guardrails', async () => {
    const scripted = [
      'Do I need surgery?',
      'How do I do the DST?',
      'Can they biopsy it?',
      'I have severe headache, palpitations, sweating'
    ];

    for (const prompt of scripted) {
      const turn = await runDialogueEngine({ sessionId: 'e2e-session', userMessage: prompt });
      const validation = AssistantTurnSchema.safeParse(turn);
      expect(validation.success).toBe(true);

      const fullText = flattenText(turn);
      for (const pattern of prohibitedPatterns) {
        expect(pattern.test(fullText)).toBe(false);
      }

      if (prompt.toLowerCase().includes('biopsy')) {
        expect(fullText.toLowerCase()).toContain('biopsy');
        expect(fullText.toLowerCase()).toContain('not');
      }

      if (citationKeywords.test(turn.assistant_message)) {
        expect(turn.citations.length).toBeGreaterThan(0);
      }
    }
  });

  it('captures triage triggers in fallback mode', async () => {
    const turn = await runDialogueEngine({
      sessionId: 'triage-session',
      userMessage: 'Severe headache and chest pain'
    });

    expect(turn.triage_level).toBe('emergency');
    expect(turn.mode).toBe('triage');
  });

  it('snapshot of AssistantTurn (IDs stripped)', async () => {
    const turn = await runDialogueEngine({
      sessionId: 'snapshot-session',
      userMessage: 'Explain the workup after an adrenal nodule referral.'
    });

    expect(stripDynamicIds(turn)).toMatchSnapshot();
  });
});
