# Codebase Overview

This document provides a concise, file-by-file map of the Adrenal Nodule Clinic Navigator codebase.

**Architecture Summary**
The app is a Next.js App Router frontend with API routes that call a multi-step dialogue pipeline. The pipeline runs safety gatekeeping, intent extraction, scope validation, context planning, routing, retrieval, and final answer generation with strict JSON schema validation.

**Request Flow (Chat)**
1. `app/api/chat/route.ts` receives a user message.
2. `lib/dialogueEngine.ts` orchestrates gatekeeper → intent → scope → context → router → answer.
3. `lib/knowledge.ts` retrieves relevant chunks for citations.
4. The API persists session/messages/checklist items via Prisma.
5. The UI renders `assistant_message` plus structured `ui_cards`.

**Core Libraries**
- `lib/dialogueEngine.ts`: Primary orchestration logic, model calls, safety gating, routing, and response normalization.
- `lib/schemas.ts`: Zod + JSON schema definitions for structured outputs and agent steps.
- `lib/safety.ts`: Red-flag detection and base disclaimers.
- `lib/knowledge.ts`: Knowledge retrieval (keyword/embedding) and citation keys.
- `lib/appConfig.ts`: AppConfig storage and public config selection.
- `lib/config.ts`: Public config defaults.
- `lib/prisma.ts`: Prisma client singleton.
- `lib/ingest/chunking.ts`: Token-based chunking utilities for ingestion.

**API Routes**
- `app/api/chat/route.ts`: Main chat API, calls dialogue engine, persists messages.
- `app/api/chat/history/route.ts`: Returns session transcript for the UI.
- `app/api/chat/summary/route.ts`: Placeholder summary endpoint.
- `app/api/config/route.ts`: Returns public clinic config for UI cards.
- `app/api/admin/chunks/route.ts`: Admin list of knowledge chunks.
- `app/api/admin/config/route.ts`: Admin get/update AppConfig (token guarded).
- `app/api/session/export/route.ts`: Export a session transcript.
- `app/api/session/delete/route.ts`: Delete a session (and clear cookie).

**Pages**
- `app/page.tsx`: Landing page.
- `app/onboarding/page.tsx`: Onboarding questions stored locally.
- `app/chat/page.tsx`: Chat UI with card rendering and transcript.
- `app/checklist/page.tsx`: Printable summary derived from last response.
- `app/admin/content/page.tsx`: Admin viewer for knowledge chunks.
- `app/admin/config/page.tsx`: Admin editor for AppConfig.
- `app/layout.tsx`: Global layout, sticky nav, and disclaimer footer.
- `app/globals.css`: Global styles and theme tokens.

**UI Components**
- `components/Nav.tsx`: Top navigation links.
- `components/AccessibilityToggles.tsx`: High contrast / large text toggles.
- `components/cards/CardRenderer.tsx`: Switches card type → card component.
- `components/cards/CardFrame.tsx`: Visual wrapper for cards.
- `components/cards/RoadmapCard.tsx`: Timeline/roadmap display.
- `components/cards/TestInstructionsCard.tsx`: DST/ARR/metanephrine prep layout.
- `components/cards/ChecklistCard.tsx`: Checklist with completion state.
- `components/cards/CostNavigationCard.tsx`: Billing/scheduling guidance.
- `components/cards/QuestionsToAskCard.tsx`: Questions list.
- `components/cards/HandoffCard.tsx`: Triage handoff/urgent guidance card.

**Persistence & Schema**
- `prisma/schema.prisma`: Prisma data model (Session, Message, ChecklistItem, KnowledgeChunk, etc.).
- `prisma/migrations/20260210000001_persistence_layer/migration.sql`: Session/app config tables.
- `prisma/migrations/20260210021834_init/migration.sql`: Knowledge tables and constraints.
- `prisma/migrations/migration_lock.toml`: Prisma migration provider lock.

**Scripts**
- `scripts/ingest.ts`: PDF ingestion → chunking → DB insert + embeddings.
- `scripts/demo.ts`: One-command demo (DB + migrate + optional ingest + dev server).
- `scripts/docker-start.sh`: Container start (migrate + optional ingest + start).
- `scripts/dev-share.mjs`: Dev share helper (if used).

**Configuration**
- `package.json`: Scripts and dependencies.
- `pnpm-lock.yaml`: Dependency lockfile.
- `pnpm-workspace.yaml`: Workspace config.
- `next.config.mjs`: Next config.
- `tailwind.config.ts`: Theme tokens and Tailwind setup.
- `postcss.config.cjs`: PostCSS configuration.
- `tsconfig.json`: TypeScript compiler settings.
- `vitest.config.ts`: Test runner config.
- `.env.example`: Example environment variables.
- `.dockerignore`: Docker build exclusions.
- `Dockerfile`: Container build instructions.
- `docker-compose.yml`: Postgres service.
- `docker-compose.demo.yml`: App + Postgres demo stack.

**Tests**
- `tests/agent-pipeline.test.ts`: Agent pipeline mocks (gatekeeper/intent/scope/context).
- `tests/e2e-dialogue-engine.test.ts`: End-to-end guardrails and schema checks.
- `tests/dialogueEngine.test.ts`: Fallback behavior tests.
- `tests/retrieval.test.ts`: Retrieval ranking behavior.
- `tests/chunking.test.ts`: Chunking/deduping tests.
- `tests/__snapshots__/e2e-dialogue-engine.test.ts.snap`: Snapshot output.

**Middleware**
- `middleware.ts`: Session cookie creation.

**Static Assets**
- `public/`: Static assets (if any).
- `Reference documents/*.pdf`: Source PDFs for ingestion.
