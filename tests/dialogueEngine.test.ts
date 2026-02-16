import { describe, expect, it } from 'vitest';
import { runDialogueEngine } from '@/lib/dialogueEngine';

const baseClientState = { stage: 'intake' };

describe('Dialogue Engine fallback behaviors', () => {
  it('routes surgery question to faq with citations', async () => {
    const result = await runDialogueEngine({
      sessionId: 'test-session',
      userMessage: 'Do I need surgery?',
      clientState: baseClientState
    });

    expect(result.mode).toBe('faq');
    expect(result.triage_level).toBe('none');
    expect(result.assistant_message.toLowerCase()).toContain('depends on imaging');
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it('guards against biopsy requests', async () => {
    const result = await runDialogueEngine({
      sessionId: 'test-session',
      userMessage: 'Can they biopsy it?',
      clientState: null
    });

    expect(result.assistant_message.toLowerCase()).toContain('biopsy');
    expect(result.assistant_message.toLowerCase()).toContain('not usually the first step');
  });

  it('escalates severe symptom report', async () => {
    const result = await runDialogueEngine({
      sessionId: 'test-session',
      userMessage: 'I have severe headache, palpitations, sweating',
      clientState: null
    });

    expect(result.triage_level).toBe('emergency');
    expect(result.mode).toBe('triage');
    expect(result.assistant_message.toLowerCase()).toContain('emergency');
  });

  it('produces test instruction card for DST question', async () => {
    const result = await runDialogueEngine({
      sessionId: 'test-session',
      userMessage: 'How do I do the DST?',
      clientState: null
    });

    const hasTestCard = result.ui_cards.some((card) => card.type === 'test_instructions');
    expect(hasTestCard).toBe(true);
    expect(result.citations.length).toBeGreaterThan(0);
  });
});
