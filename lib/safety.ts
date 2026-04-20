export const BASE_DISCLAIMERS = [
  'This is general information, not a diagnosis.',
  'Do not change or stop any medicine without talking to your doctor first.',
  'This tool does not tell you whether you need a biopsy or any specific treatment.'
];

const RED_FLAG_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /chest pain|pressure|tightness/i, label: 'Chest pain or pressure' },
  { pattern: /shortness of breath|trouble breathing|can\'t breathe/i, label: 'Difficulty breathing' },
  { pattern: /fainting|passed out|syncope/i, label: 'Fainting or loss of consciousness' },
  { pattern: /severe headache|worst headache|sudden headache/i, label: 'Severe or sudden headache' },
  { pattern: /palpitations|racing heart|heart pounding/i, label: 'Palpitations or racing heart' },
  { pattern: /profuse sweating|sweating a lot|drenching sweats/i, label: 'Profuse sweating' },
  { pattern: /confusion|can\'t think straight|disoriented/i, label: 'Sudden confusion' },
  { pattern: /vision loss|double vision|blurry vision/i, label: 'Sudden vision changes' },
  { pattern: /vomiting blood|black stools|blood in stool/i, label: 'Possible internal bleeding' },
  { pattern: /suicid(al|e)|self-harm|hurt myself/i, label: 'Self-harm thoughts' }
];

export type RedFlagResult = {
  hasRedFlags: boolean;
  redFlags: string[];
  escalationAdvice: string | null;
};

export function detectRedFlags(message: string): RedFlagResult {
  const hits = RED_FLAG_PATTERNS.filter((item) => item.pattern.test(message)).map(
    (item) => item.label
  );

  if (hits.length === 0) {
    return { hasRedFlags: false, redFlags: [], escalationAdvice: null };
  }

  return {
    hasRedFlags: true,
    redFlags: hits,
    escalationAdvice:
      'These symptoms could be serious. Please get medical help right away or call 911.'
  };
}
