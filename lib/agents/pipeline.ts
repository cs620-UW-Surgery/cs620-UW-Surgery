import { runGatekeeper, runAnalyzer, runScopeValidator } from './agents';
import type { GatekeeperResult, AnalyzerResult, ScopeResult, PipelineTrace } from './schemas';

export type PipelineOutcome =
  | { action: 'proceed'; trace: PipelineTrace }
  | { action: 'block'; reason: string; trace: PipelineTrace }
  | { action: 'medical_emergency'; reason: string; trace: PipelineTrace }
  | { action: 'clarify'; question: string; trace: PipelineTrace };

function buildTrace(
  gatekeeper: GatekeeperResult | null,
  analyzer: AnalyzerResult | null,
  scope: ScopeResult | null
): PipelineTrace {
  return { gatekeeper, analyzer, scope };
}

export async function runAgentPipeline(rawQuery: string): Promise<PipelineOutcome> {
  // Step 1: Gatekeeper + Analyzer in parallel (both only need rawQuery)
  const [gatekeeper, analyzer] = await Promise.all([
    runGatekeeper(rawQuery).then((result) => {
      console.log(`[pipeline] Gatekeeper: ${result.category}`);
      return result;
    }),
    runAnalyzer(rawQuery).then((result) => {
      console.log(`[pipeline] Analyzer: type=${result.type}`);
      return result;
    })
  ]);

  // Short-circuit on harmful content
  if (gatekeeper.category === 'harmful') {
    return {
      action: 'block',
      reason: gatekeeper.reason,
      trace: buildTrace(gatekeeper, analyzer, null)
    };
  }

  // Short-circuit on medical emergency — skip scope check, go straight to triage
  if (gatekeeper.category === 'medical_emergency') {
    return {
      action: 'medical_emergency',
      reason: gatekeeper.reason,
      trace: buildTrace(gatekeeper, analyzer, null)
    };
  }

  // Step 2: Scope Validator (uses original query + analyzer output)
  const scope = await runScopeValidator(rawQuery, analyzer);
  console.log(`[pipeline] Scope: in_scope=${scope.in_scope}`);

  if (!scope.in_scope) {
    return {
      action: 'block',
      reason: `This question is outside our knowledge base: ${scope.reason}`,
      trace: buildTrace(gatekeeper, analyzer, scope)
    };
  }

  if (scope.needs_clarification && scope.clarification_question) {
    return {
      action: 'clarify',
      question: scope.clarification_question,
      trace: buildTrace(gatekeeper, analyzer, scope)
    };
  }

  return {
    action: 'proceed',
    trace: buildTrace(gatekeeper, analyzer, scope)
  };
}
