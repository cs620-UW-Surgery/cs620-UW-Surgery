import CardFrame from '@/components/cards/CardFrame';

const STEPS = ['Referral', 'Testing', 'Consult', 'Decision', 'Follow-up'];

export default function RoadmapCard({ summary }: { summary: string }) {
  return (
    <CardFrame title="Typical care roadmap" typeLabel="Roadmap">
      {summary && <p className="mb-4">{summary}</p>}
      <div className="grid gap-3 md:grid-cols-5">
        {STEPS.map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-3 rounded-xl border border-clay/60 bg-white/70 px-3 py-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-moss text-xs font-semibold text-white">
              {index + 1}
            </div>
            <div className="text-sm font-semibold text-ink">{step}</div>
          </div>
        ))}
      </div>
    </CardFrame>
  );
}
