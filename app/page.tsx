import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="card fade-in">
        <div className="flex flex-col gap-6">
          <div className="badge">Referral Navigator</div>
          <h1 className="font-serif text-4xl text-ink">
            An informed, calm next step after an incidental adrenal nodule.
          </h1>
          <p className="text-lg text-muted">
            This patient-facing guide explains common testing steps, what to expect at the clinic,
            and how to plan for scheduling and costs. It is educational only and does not replace
            your clinician.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="rounded-full bg-moss px-6 py-3 text-sm font-semibold text-white shadow-soft"
            >
              Start onboarding
            </Link>
            <Link
              href="/chat"
              className="rounded-full border border-moss px-6 py-3 text-sm font-semibold text-moss"
            >
              Ask a question
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: 'Typical Workup Roadmap',
            body: 'Get an overview of labs, imaging, and follow-up steps that are commonly discussed after referral.'
          },
          {
            title: 'Prep Instructions',
            body: 'Understand what to expect for common tests like the dexamethasone suppression test, ARR, and metanephrines.'
          },
          {
            title: 'Cost + Scheduling Support',
            body: 'Explore insurance, prior authorization, and scheduling tips to reduce surprises.'
          }
        ].map((item) => (
          <div key={item.title} className="card">
            <h2 className="font-serif text-xl text-ink">{item.title}</h2>
            <p className="mt-3 text-sm text-muted">{item.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
