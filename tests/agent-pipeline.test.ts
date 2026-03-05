import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDialogueEngine } from '@/lib/dialogueEngine';

vi.mock('@/lib/knowledge', () => {
  return {
    retrieveRelevantChunks: vi.fn(async () => ({
      chunks: [
        {
          chunk_id: 'c1',
          source_doc: 'Test Doc',
          page_range: '1-1',
          text_snippet: 'DST instructions snippet.',
          citation_key: 'DOC:Test Doc|CHUNK:c1|P:1-1'
        }
      ]
    }))
  };
});

vi.mock('openai', () => {
  let queue: Array<{ output_text: string }> = [];

  class OpenAI {
    responses = {
      create: vi.fn(async () => {
        if (queue.length === 0) {
          throw new Error('No mock responses queued');
        }
        return queue.shift();
      })
    };
  }

  return {
    default: OpenAI,
    __setMockResponses: (items: Array<{ output_text: string }>) => {
      queue = items.slice();
    }
  };
});

type MockOpenAI = {
  __setMockResponses: (items: Array<{ output_text: string }>) => void;
};

const emptyContent = {
  summary: '',
  bullets: [],
  steps: [],
  checklist: [],
  questions: [],
  tests: [],
  cost_tips: [],
  symptoms: [],
  handoff: { message: '', contacts: [] }
};

function mockResponse(payload: unknown) {
  return { output_text: JSON.stringify(payload) };
}

beforeAll(() => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
  process.env.DISABLE_OPENAI = 'false';
  process.env.NODE_ENV = 'development';
});

beforeEach(async () => {
  const openaiModule = (await import('openai')) as unknown as MockOpenAI;
  openaiModule.__setMockResponses([]);
});

describe('Agent pipeline', () => {
  it('gatekeeper unsafe -> refusal + emergency triage', async () => {
    const openaiModule = (await import('openai')) as unknown as MockOpenAI;
    openaiModule.__setMockResponses([
      mockResponse({
        safe: false,
        triage_level: 'emergency',
        refusal_reason: 'Please seek emergency care now.',
        red_flags: ['Severe headache']
      })
    ]);

    const turn = await runDialogueEngine({
      sessionId: 'gate-test',
      userMessage: 'I feel awful',
      clientState: null
    });

    expect(turn.triage_level).toBe('emergency');
    expect(turn.assistant_message.toLowerCase()).toContain('emergency');
    expect(turn.ui_cards.some((card) => card.type === 'handoff')).toBe(true);
  });

  it('intent extraction -> clarification question returned', async () => {
    const openaiModule = (await import('openai')) as unknown as MockOpenAI;
    openaiModule.__setMockResponses([
      mockResponse({
        safe: true,
        triage_level: 'none',
        refusal_reason: null,
        red_flags: null
      }),
      mockResponse({
        primary_question: 'What labs do I need?',
        secondary_questions: [],
        topic_tags: ['labs'],
        needs_clarification: true,
        clarification_questions: ['Do you have high blood pressure?']
      })
    ]);

    const turn = await runDialogueEngine({
      sessionId: 'intent-test',
      userMessage: 'What labs do I need?',
      clientState: null
    });

    expect(turn.assistant_message.toLowerCase()).toContain('blood pressure');
    expect(turn.ui_cards.some((card) => card.type === 'questions_to_ask')).toBe(true);
  });

  it('out-of-scope -> refusal message', async () => {
    const openaiModule = (await import('openai')) as unknown as MockOpenAI;
    openaiModule.__setMockResponses([
      mockResponse({
        safe: true,
        triage_level: 'none',
        refusal_reason: null,
        red_flags: null
      }),
      mockResponse({
        primary_question: 'Can I stop my medication?',
        secondary_questions: [],
        topic_tags: ['medication'],
        needs_clarification: false,
        clarification_questions: []
      }),
      mockResponse({
        in_scope: false,
        reason: 'Medication changes are out of scope.',
        redirect_message: 'Please discuss medication changes with your clinician.'
      })
    ]);

    const turn = await runDialogueEngine({
      sessionId: 'scope-test',
      userMessage: 'Can I stop my medication?',
      clientState: null
    });

    expect(turn.assistant_message.toLowerCase()).toContain('clinician');
    expect(turn.ui_cards.length).toBe(0);
  });

  it('context plan -> retrieval queries used, citations required', async () => {
    const openaiModule = (await import('openai')) as unknown as MockOpenAI;
    openaiModule.__setMockResponses([
      mockResponse({
        safe: true,
        triage_level: 'none',
        refusal_reason: null,
        red_flags: null
      }),
      mockResponse({
        primary_question: 'How do I prepare for DST?',
        secondary_questions: [],
        topic_tags: ['DST'],
        needs_clarification: false,
        clarification_questions: []
      }),
      mockResponse({
        in_scope: true,
        reason: null,
        redirect_message: null
      }),
      mockResponse({
        required_context: ['DST prep'],
        optional_context: [],
        info_missing: false,
        followup_questions: [],
        retrieval_queries: ['dexamethasone suppression test instructions']
      }),
      mockResponse({
        mode: 'faq',
        triage_level: 'none',
        cards: ['test_instructions']
      }),
      mockResponse({
        mode: 'faq',
        assistant_message: 'DST prep involves a prescribed dexamethasone dose.',
        disclaimer: 'General education only.',
        citations: [{ citation_key: 'DOC:Test Doc|CHUNK:c1|P:1-1', quote: null }],
        ui_cards: [
          {
            type: 'test_instructions',
            title: 'Test prep instructions',
            content: {
              ...emptyContent,
              summary: 'DST prep overview',
              tests: [{ name: 'DST', instructions: ['Take dexamethasone as prescribed.'] }]
            }
          }
        ],
        suggested_actions: [],
        triage_level: 'none'
      })
    ]);

    const { retrieveRelevantChunks } = await import('@/lib/knowledge');

    const turn = await runDialogueEngine({
      sessionId: 'context-test',
      userMessage: 'How do I prepare for DST?',
      clientState: null
    });

    expect(vi.mocked(retrieveRelevantChunks).mock.calls[0][0]).toContain(
      'dexamethasone suppression test instructions'
    );
    expect(turn.assistant_message.toLowerCase()).toContain('dst');
    expect(turn.citations.length).toBeGreaterThan(0);
  });
});
