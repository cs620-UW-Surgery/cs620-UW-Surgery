This migration creates the persistence layer tables (Session, Message, ChecklistItem, AppConfig)
and removes the legacy ChatSession/ChatMessage tables.

Regenerate if needed by running:
  pnpm prisma:migrate
