import type { AssistantTurn } from '@/lib/schemas';
import RoadmapCard from '@/components/cards/RoadmapCard';
import TestInstructionsCard from '@/components/cards/TestInstructionsCard';
import SymptomCheckCard from '@/components/cards/SymptomCheckCard';
import ChecklistCard from '@/components/cards/ChecklistCard';
import CostNavigationCard from '@/components/cards/CostNavigationCard';
import HandoffCard from '@/components/cards/HandoffCard';
import QuestionsToAskCard from '@/components/cards/QuestionsToAskCard';

export default function CardRenderer({
  card,
  onSymptomSubmit,
  onShareSummary,
  selectedSymptoms,
  config
}: {
  card: AssistantTurn['ui_cards'][number];
  onSymptomSubmit?: (symptoms: string[]) => void;
  onShareSummary?: () => void;
  selectedSymptoms?: string[];
  config?: {
    billing_phone?: string | null;
    scheduling_link?: string | null;
    what_to_bring?: string | null;
    emergency_guidance?: string | null;
  };
}) {
  switch (card.type) {
    case 'roadmap':
      return <RoadmapCard summary={card.content.summary} />;
    case 'test_instructions':
      return (
        <TestInstructionsCard
          summary={card.content.summary}
          bullets={card.content.bullets}
          tests={card.content.tests}
        />
      );
    case 'symptom_check':
      return (
        <SymptomCheckCard
          summary={card.content.summary}
          symptoms={card.content.symptoms}
          initialSelected={selectedSymptoms}
          onSubmit={onSymptomSubmit}
        />
      );
    case 'checklist':
      return <ChecklistCard items={card.content.checklist} />;
    case 'cost_navigation':
      return (
        <CostNavigationCard
          costTips={card.content.cost_tips}
          configLinks={{
            billing_phone: config?.billing_phone ?? null,
            scheduling_link: config?.scheduling_link ?? null
          }}
        />
      );
    case 'handoff':
      return (
        <HandoffCard
          message={config?.emergency_guidance ?? card.content.handoff.message}
          contacts={card.content.handoff.contacts}
          questions={card.content.questions}
          whatToBring={config?.what_to_bring ?? null}
          onShare={onShareSummary}
        />
      );
    case 'questions_to_ask':
      return <QuestionsToAskCard questions={card.content.questions} />;
    default:
      return null;
  }
}
