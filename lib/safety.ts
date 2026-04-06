export const BASE_DISCLAIMERS = [
  'This information is general education and not a diagnosis.',
  'Do not change medications or stop prescribed treatment without your clinician.',
  'This tool does not recommend biopsy or individual treatment decisions.'
];

const PROMPT_INJECTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /ignore (all|previous|above) instructions/i, label: 'ignore instructions' },
  { pattern: /disregard (all|previous|above) instructions/i, label: 'disregard instructions' },
  { pattern: /system prompt/i, label: 'system prompt request' },
  { pattern: /developer message/i, label: 'developer message request' },
  { pattern: /reveal (the )?prompt/i, label: 'prompt reveal request' },
  { pattern: /show (the )?system/i, label: 'system reveal request' },
  { pattern: /jailbreak|do anything now|DAN/i, label: 'jailbreak language' },
  { pattern: /act as (a|an) (system|developer|assistant)/i, label: 'role override' },
  { pattern: /role\s*:\s*(system|developer|assistant)/i, label: 'role tag' },
  { pattern: /<\s*(system|developer|assistant)\s*>/i, label: 'role block' }
];

const ROLE_BLOCKS: RegExp[] = [
  /<\s*system\s*>[\s\S]*?<\s*\/\s*system\s*>/gi,
  /<\s*developer\s*>[\s\S]*?<\s*\/\s*developer\s*>/gi,
  /<\s*assistant\s*>[\s\S]*?<\s*\/\s*assistant\s*>/gi,
  /```(?:system|developer|assistant)[\s\S]*?```/gi
];

export type PromptInjectionResult = {
  isLikely: boolean;
  cleaned: string;
  signals: string[];
};

export function stripPromptInjection(message: string): PromptInjectionResult {
  if (!message) {
    return { isLikely: false, cleaned: '', signals: [] };
  }

  const signals = new Set<string>();
  let cleaned = message;

  for (const { pattern, label } of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      signals.add(label);
    }
  }

  for (const block of ROLE_BLOCKS) {
    if (block.test(cleaned)) {
      cleaned = cleaned.replace(block, ' ');
      signals.add('role_block_removed');
    }
  }

  const lines = cleaned.split(/\r?\n/);
  const filteredLines = lines
    .map((line) => {
      if (/^\s*(system|developer|assistant)\s*:/i.test(line)) {
        signals.add('role_line_removed');
        return '';
      }
      if (/^\s*role\s*:\s*(system|developer|assistant)\b/i.test(line)) {
        signals.add('role_line_removed');
        return '';
      }
      let nextLine = line;
      for (const { pattern } of PROMPT_INJECTION_PATTERNS) {
        if (pattern.test(nextLine)) {
          signals.add('injection_line_removed');
          nextLine = nextLine.replace(pattern, ' ');
        }
      }
      return nextLine;
    })
    .filter((line) => line.trim().length > 0);

  cleaned = filteredLines.join('\n').trim();

  const isLikely = signals.size > 0 || cleaned !== message.trim();

  return { isLikely, cleaned, signals: Array.from(signals) };
}

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
