export const BASE_DISCLAIMERS = [
  'This information is general education and not a diagnosis.',
  'Do not change medications or stop prescribed treatment without your clinician.',
  'This tool does not recommend biopsy or individual treatment decisions.'
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
      'These symptoms can be urgent. Please seek immediate medical care or call emergency services in your area.'
  };
}

const PROMPT_INJECTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /ignore (all|any|previous|earlier) (instructions|rules|messages)/i, label: 'Ignore prior instructions' },
  { pattern: /disregard (system|developer) (prompt|message|instructions)/i, label: 'Disregard system/developer prompt' },
  { pattern: /you are (now|no longer) (an?|the)?(system|developer|assistant)/i, label: 'Role override attempt' },
  { pattern: /(reveal|show|print|leak).*(system|developer) prompt/i, label: 'Request to reveal prompt' },
  { pattern: /(jailbreak|dan|do anything now|override safety)/i, label: 'Jailbreak attempt' },
  { pattern: /begin (system|developer) prompt/i, label: 'Prompt extraction attempt' },
  { pattern: /(tool|function) (call|use) .*without authorization/i, label: 'Unauthorized tool use' }
];

export type PromptInjectionResult = {
  hasPromptInjection: boolean;
  signals: string[];
};

export function detectPromptInjection(message: string): PromptInjectionResult {
  const hits = PROMPT_INJECTION_PATTERNS.filter((item) => item.pattern.test(message)).map(
    (item) => item.label
  );

  return {
    hasPromptInjection: hits.length > 0,
    signals: hits
  };
}

export function scrubPromptInjection(message: string) {
  const lines = message.split(/\r?\n/);
  const kept = lines.filter(
    (line) => !PROMPT_INJECTION_PATTERNS.some((item) => item.pattern.test(line))
  );
  const scrubbed = kept.join('\n').trim();
  return {
    scrubbed,
    removedLineCount: Math.max(0, lines.length - kept.length)
  };
}
