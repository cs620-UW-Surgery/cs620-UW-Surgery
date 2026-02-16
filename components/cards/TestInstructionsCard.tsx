import CardFrame from '@/components/cards/CardFrame';

type TestInstruction = {
  name: string;
  instructions: string[];
};

export default function TestInstructionsCard({
  summary,
  bullets,
  tests
}: {
  summary: string;
  bullets: string[];
  tests: TestInstruction[];
}) {
  return (
    <CardFrame title="Test prep instructions" typeLabel="Test instructions">
      {(summary || bullets.length > 0) && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">
            Why these tests
          </div>
          {summary && <p className="mt-2">{summary}</p>}
          {bullets.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {tests.map((test) => (
          <div key={test.name} className="rounded-xl border border-clay/60 bg-white/70 p-3">
            <div className="text-sm font-semibold text-ink">{test.name}</div>
            <div className="mt-2 text-xs uppercase tracking-[0.2em] text-moss">
              How to prepare
            </div>
            <ul className="mt-2 list-disc pl-5">
              {test.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
          </div>
        ))}
        {tests.length === 0 && <p>No test instructions available yet.</p>}
      </div>
    </CardFrame>
  );
}
