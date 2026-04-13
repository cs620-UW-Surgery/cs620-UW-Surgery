import { z } from 'zod';

// --- Gatekeeper Agent ---
export const GatekeeperCategoryEnum = z.enum(['safe', 'harmful', 'medical_emergency']);

export const GatekeeperResultSchema = z.object({
  category: GatekeeperCategoryEnum,
  reason: z.string()
});
export type GatekeeperResult = z.infer<typeof GatekeeperResultSchema>;

// --- Question Analyzer Agent ---
export const QuestionTypeEnum = z.enum([
  'factual',
  'procedural',
  'diagnostic',
  'emotional',
  'comparison'
]);

export const AnalyzerResultSchema = z.object({
  intent: z.string(),
  type: QuestionTypeEnum
});
export type AnalyzerResult = z.infer<typeof AnalyzerResultSchema>;

// --- Scope Validator Agent ---
export const ScopeResultSchema = z.object({
  in_scope: z.boolean(),
  needs_clarification: z.boolean(),
  clarification_question: z.string().nullable(),
  reason: z.string()
});
export type ScopeResult = z.infer<typeof ScopeResultSchema>;

// --- Pipeline Trace (combined output for transparency) ---
export const PipelineTraceSchema = z.object({
  gatekeeper: GatekeeperResultSchema.nullable(),
  analyzer: AnalyzerResultSchema.nullable(),
  scope: ScopeResultSchema.nullable()
});
export type PipelineTrace = z.infer<typeof PipelineTraceSchema>;

// --- JSON Schemas (for OpenAI structured output) ---

export const GatekeeperJsonSchema = {
  name: 'gatekeeper_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      category: { type: 'string', enum: GatekeeperCategoryEnum.options },
      reason: { type: 'string' }
    },
    required: ['category', 'reason']
  }
} as const;

export const AnalyzerJsonSchema = {
  name: 'analyzer_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      intent: { type: 'string' },
      type: { type: 'string', enum: QuestionTypeEnum.options }
    },
    required: ['intent', 'type']
  }
} as const;

export const ScopeJsonSchema = {
  name: 'scope_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      in_scope: { type: 'boolean' },
      needs_clarification: { type: 'boolean' },
      clarification_question: { type: ['string', 'null'] },
      reason: { type: 'string' }
    },
    required: ['in_scope', 'needs_clarification', 'clarification_question', 'reason']
  }
} as const;
