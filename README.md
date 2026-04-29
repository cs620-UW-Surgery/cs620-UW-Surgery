# Adrenal Nodule Clinic Navigator

Patient-facing web app that explains typical adrenal nodule workups, testing instructions, and scheduling/cost navigation. It provides general education only and includes safety escalation for red flags.

Website Link: https://cs620-uw-surgery.vercel.app

Repository Link: https://github.com/cs620-UW-Surgery/cs620-UW-Surgery

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- PostgreSQL + Prisma
- OpenAI Responses API (structured outputs)

## How the Code Works
The main chat experience lives in `app/chat/page.tsx`. It sends the user's message to
`app/api/chat/route.ts`, which sanitizes prompt-injection attempts and then runs the
agent pipeline when OpenAI is configured.

The agent pipeline in `lib/agents/pipeline.ts` runs a gatekeeper, question analyzer, and
scope validator from `lib/agents/agents.ts`. These decide whether the app should proceed,
ask a clarification question, block unsafe or out-of-scope content, or show emergency
guidance.

When a message can be answered, `lib/dialogueEngine.ts` retrieves relevant knowledge from
`lib/knowledge.ts`, combines it with clinic configuration, and asks the model to return a
structured JSON response. The frontend renders that response as chat text, citations, and
optional UI cards such as checklists, test instructions, symptom checks, and handoff
guidance.

PDF reference documents are ingested by `scripts/ingest.ts`, chunked by
`lib/ingest/chunking.ts`, and stored in PostgreSQL through Prisma. If the database or
OpenAI key is missing, the app falls back to safer built-in responses and sample knowledge.

## Local Setup
1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file (or run `pnpm demo` once to auto-create from `.env.example`):

```bash
DATABASE_URL="postgresql://navigator:navigator@localhost:5432/adrenal_navigator?schema=public"
OPENAI_API_KEY="sk-your-api-key"
OPENAI_MODEL="gpt-4.1"
OPENAI_ROUTER_MODEL="gpt-4.1"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
ADMIN_TOKEN="set-a-strong-token"
NEXT_PUBLIC_BILLING_URL="https://example.com/billing"
NEXT_PUBLIC_ESTIMATE_URL="https://example.com/estimate"
NEXT_PUBLIC_SCHEDULING_URL="https://example.com/schedule"
```

3. Initialize Prisma:

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

4. Run the app:

```bash
pnpm dev
```

## One-Command Demo
After filling in `.env`, start everything with:

```bash
pnpm demo
```

Optional: ingest PDFs automatically before startup:

```bash
RUN_INGEST=1 pnpm demo
```

The demo script will start a local Postgres container using `docker compose` if available.

## Docker Demo (App + Postgres)
1) Ensure `.env` has your `OPENAI_API_KEY` and any optional config values.

2) Build + run:

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up --build
```

3) Open:

```bash
http://localhost:3000
```

Notes:
- By default, the container runs `pnpm ingest` on startup. To skip ingestion, set `RUN_INGEST=0` in `.env`.
- The PDF reference documents are mounted read-only from `./Reference documents`.

## Knowledge Ingestion
The CLI ingests PDFs into Postgres and optionally generates embeddings.

```bash
pnpm ingest
```

Options:
- `--path \"Reference documents/YourFile.pdf\"` (repeatable)
- `--paths \"Reference documents/A.pdf,Reference documents/B.pdf\"`
- `--version 1`
- `--dry-run`
- `--minTokens 400 --maxTokens 800 --targetTokens 600 --overlapTokens 120`

## Notes
- If `OPENAI_API_KEY` is missing, the API returns a safe fallback response.
- Knowledge chunks are served from the database when available, otherwise sample chunks are used.
- The chat UI stores the most recent structured response in `sessionStorage` for the checklist page.
- Admin config editor requires `ADMIN_TOKEN` and stores clinic-specific copy in the database.
- Data export endpoint: `GET /api/session/export` (uses `session_id` cookie or query param).
- Delete endpoint: `POST /api/session/delete` with `{ \"session_id\": \"...\" }` or cookie.

## Dialogue Engine Evals
Run the automated eval suite (golden prompts + guardrails + snapshot):

```bash
pnpm test:e2e
```

The evals validate JSON schema, triage triggers, prohibited content patterns, biopsy guardrails,
and require citations when clinical keywords appear in the assistant message.

## Key Paths
- Dialogue Engine: `lib/dialogueEngine.ts`
- Safety rules: `lib/safety.ts`
- Knowledge chunks: `lib/knowledge.ts`
- Chat API: `app/api/chat/route.ts`
- AppConfig admin: `app/admin/config/page.tsx`

### What We Would Work on Next
In the next phase, we plan to focus on testing and evaluation.

We will conduct real-world testing by involving both medical professionals and patients. This includes gathering feedback from doctors to ensure the medical accuracy and usefulness of the system, as well as testing with patients to improve usability and clarity.

Based on this feedback, we aim to further refine the system, especially in terms of safety, response quality, and overall user experience.
