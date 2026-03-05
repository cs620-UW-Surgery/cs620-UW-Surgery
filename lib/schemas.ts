import { z } from 'zod';

export const ModeEnum = z.enum(['faq', 'guided_intake', 'plan_summary', 'triage']);
export const TriageEnum = z.enum(['none', 'contact_clinic', 'urgent', 'emergency']);
export const CardTypeEnum = z.enum([
  'roadmap',
  'test_instructions',
  'cost_navigation',
  'checklist',
  'questions_to_ask',
  'handoff'
]);
export const ActionTypeEnum = z.enum(['quick_reply', 'navigate', 'share_summary']);

export const ChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['todo', 'in_progress', 'done']),
  due_date: z.string().nullable()
});

export const CardContentSchema = z.object({
  summary: z.string(),
  bullets: z.array(z.string()),
  steps: z.array(
    z.object({
      label: z.string(),
      detail: z.string()
    })
  ),
  checklist: z.array(ChecklistItemSchema),
  questions: z.array(z.string()),
  tests: z.array(
    z.object({
      name: z.string(),
      instructions: z.array(z.string())
    })
  ),
  cost_tips: z.array(z.string()),
  symptoms: z.array(z.string()),
  handoff: z.object({
    message: z.string(),
    contacts: z.array(z.string())
  })
});

export const UiCardSchema = z.object({
  type: CardTypeEnum,
  title: z.string(),
  content: CardContentSchema
});

export const AssistantTurnSchema = z.object({
  mode: ModeEnum,
  assistant_message: z.string(),
  disclaimer: z.string(),
  citations: z.array(
    z.object({
      citation_key: z.string(),
      quote: z.string().nullable()
    })
  ),
  ui_cards: z.array(UiCardSchema),
  suggested_actions: z.array(
    z.object({
      label: z.string(),
      action_type: ActionTypeEnum,
      payload: z.object({
        href: z.string().nullable(),
        value: z.string().nullable()
      })
    })
  ),
  triage_level: TriageEnum
});

export type AssistantTurn = z.infer<typeof AssistantTurnSchema>;

export const RouteDecisionSchema = z.object({
  mode: ModeEnum,
  triage_level: TriageEnum,
  cards: z.array(CardTypeEnum)
});

export type RouteDecision = z.infer<typeof RouteDecisionSchema>;

export const GateDecisionSchema = z.object({
  safe: z.boolean(),
  triage_level: TriageEnum,
  refusal_reason: z.string().nullable(),
  red_flags: z.array(z.string()).nullable()
});

export type GateDecision = z.infer<typeof GateDecisionSchema>;

export const IntentDecisionSchema = z.object({
  primary_question: z.string(),
  secondary_questions: z.array(z.string()),
  topic_tags: z.array(z.string()),
  needs_clarification: z.boolean(),
  clarification_questions: z.array(z.string())
});

export type IntentDecision = z.infer<typeof IntentDecisionSchema>;

export const ScopeDecisionSchema = z.object({
  in_scope: z.boolean(),
  reason: z.string().nullable(),
  redirect_message: z.string().nullable()
});

export type ScopeDecision = z.infer<typeof ScopeDecisionSchema>;

export const ContextPlanSchema = z.object({
  required_context: z.array(z.string()),
  optional_context: z.array(z.string()),
  info_missing: z.boolean(),
  followup_questions: z.array(z.string()),
  retrieval_queries: z.array(z.string())
});

export type ContextPlan = z.infer<typeof ContextPlanSchema>;

export const AssistantTurnJsonSchema = {
  name: 'assistant_turn',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      mode: { type: 'string', enum: ModeEnum.options },
      assistant_message: { type: 'string' },
      disclaimer: { type: 'string' },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            citation_key: { type: 'string' },
            quote: { type: ['string', 'null'] }
          },
          required: ['citation_key', 'quote']
        }
      },
      ui_cards: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: CardTypeEnum.options },
            title: { type: 'string' },
            content: {
              type: 'object',
              additionalProperties: false,
              properties: {
                summary: { type: 'string' },
                bullets: { type: 'array', items: { type: 'string' } },
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      label: { type: 'string' },
                      detail: { type: 'string' }
                    },
                    required: ['label', 'detail']
                  }
                },
                checklist: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      id: { type: 'string' },
                      label: { type: 'string' },
                      status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
                      due_date: { type: ['string', 'null'] }
                    },
                    required: ['id', 'label', 'status', 'due_date']
                  }
                },
                questions: { type: 'array', items: { type: 'string' } },
                tests: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      name: { type: 'string' },
                      instructions: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['name', 'instructions']
                  }
                },
                cost_tips: { type: 'array', items: { type: 'string' } },
                symptoms: { type: 'array', items: { type: 'string' } },
                handoff: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    message: { type: 'string' },
                    contacts: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['message', 'contacts']
                }
              },
              required: [
                'summary',
                'bullets',
                'steps',
                'checklist',
                'questions',
                'tests',
                'cost_tips',
                'symptoms',
                'handoff'
              ]
            }
          },
          required: ['type', 'title', 'content']
        }
      },
      suggested_actions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string' },
            action_type: { type: 'string', enum: ActionTypeEnum.options },
            payload: {
              type: 'object',
              additionalProperties: false,
              properties: {
                href: { type: ['string', 'null'] },
                value: { type: ['string', 'null'] }
              },
              required: ['href', 'value']
            }
          },
          required: ['label', 'action_type', 'payload']
        }
      },
      triage_level: { type: 'string', enum: TriageEnum.options }
    },
    required: [
      'mode',
      'assistant_message',
      'disclaimer',
      'citations',
      'ui_cards',
      'suggested_actions',
      'triage_level'
    ]
  }
} as const;

export const RouteDecisionJsonSchema = {
  name: 'route_decision',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      mode: { type: 'string', enum: ModeEnum.options },
      triage_level: { type: 'string', enum: TriageEnum.options },
      cards: { type: 'array', items: { type: 'string', enum: CardTypeEnum.options } }
    },
    required: ['mode', 'triage_level', 'cards']
  }
} as const;

export const GateDecisionJsonSchema = {
  name: 'gate_decision',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      safe: { type: 'boolean' },
      triage_level: { type: 'string', enum: TriageEnum.options },
      refusal_reason: { type: ['string', 'null'] },
      red_flags: { type: ['array', 'null'], items: { type: 'string' } }
    },
    required: ['safe', 'triage_level', 'refusal_reason', 'red_flags']
  }
} as const;

export const IntentDecisionJsonSchema = {
  name: 'intent_decision',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      primary_question: { type: 'string' },
      secondary_questions: { type: 'array', items: { type: 'string' } },
      topic_tags: { type: 'array', items: { type: 'string' } },
      needs_clarification: { type: 'boolean' },
      clarification_questions: { type: 'array', items: { type: 'string' } }
    },
    required: [
      'primary_question',
      'secondary_questions',
      'topic_tags',
      'needs_clarification',
      'clarification_questions'
    ]
  }
} as const;

export const ScopeDecisionJsonSchema = {
  name: 'scope_decision',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      in_scope: { type: 'boolean' },
      reason: { type: ['string', 'null'] },
      redirect_message: { type: ['string', 'null'] }
    },
    required: ['in_scope', 'reason', 'redirect_message']
  }
} as const;

export const ContextPlanJsonSchema = {
  name: 'context_plan',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      required_context: { type: 'array', items: { type: 'string' } },
      optional_context: { type: 'array', items: { type: 'string' } },
      info_missing: { type: 'boolean' },
      followup_questions: { type: 'array', items: { type: 'string' } },
      retrieval_queries: { type: 'array', items: { type: 'string' } }
    },
    required: [
      'required_context',
      'optional_context',
      'info_missing',
      'followup_questions',
      'retrieval_queries'
    ]
  }
} as const;
