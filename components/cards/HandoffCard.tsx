import CardFrame from '@/components/cards/CardFrame';

export default function HandoffCard({
  message,
  contacts,
  questions,
  whatToBring,
  onShare
}: {
  message: string;
  contacts: string[];
  questions: string[];
  whatToBring?: string | null;
  onShare?: () => void;
}) {
  return (
    <CardFrame title="When to seek care" typeLabel="Handoff">
      {message && <p className="mb-3">{message}</p>}
      {contacts.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">
            Contact options
          </div>
          <ul className="mt-2 list-disc pl-5">
            {contacts.map((contact) => (
              <li key={contact}>{contact}</li>
            ))}
          </ul>
        </div>
      )}
      {questions.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">
            What to ask your clinic
          </div>
          <ul className="mt-2 list-disc pl-5">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}
      {whatToBring && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">
            What to bring
          </div>
          <p className="mt-2">{whatToBring}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onShare}
          className="rounded-full bg-moss px-4 py-2 text-xs font-semibold text-white"
        >
          Print / share summary
        </button>
      </div>
    </CardFrame>
  );
}
