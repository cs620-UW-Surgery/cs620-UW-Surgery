import CardFrame from '@/components/cards/CardFrame';

export default function QuestionsToAskCard({ questions }: { questions: string[] }) {
  return (
    <CardFrame title="Questions to ask" typeLabel="Questions">
      {questions.length > 0 ? (
        <ul className="list-disc pl-5">
          {questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      ) : (
        <p>No questions generated yet.</p>
      )}
    </CardFrame>
  );
}
