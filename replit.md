# K-Lingo - Korean Sentence Analyzer

## Overview

K-Lingo is a Korean language learning web application that analyzes Korean sentences, breaking them down into individual words, pronunciations, and grammar points. Users can input Korean sentences, receive AI-powered analysis (word-by-word breakdown with meanings, parts of speech, and grammar explanations), and save analyzed sentences into organized folders for later review.

The app follows a full-stack TypeScript monorepo pattern with a React frontend, Express backend, PostgreSQL database, and OpenAI API integration for sentence analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (client/)
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS v4 with CSS variables for theming (custom "Soft Pop" theme with purple/blue primary colors)
- **UI Components**: shadcn/ui (new-york style) with Radix UI primitives — all components live in `client/src/components/ui/`
- **Fonts**: Nunito (body) and Quicksand (display) via Google Fonts
- **Animations**: Framer Motion for UI transitions
- **Build Tool**: Vite with path aliases (`@/` → `client/src/`, `@shared/` → `shared/`)
- **Entry Point**: `client/src/main.tsx` → `client/src/App.tsx`
- **Pages**: Home page (`client/src/pages/Home.tsx`) is the main interface; includes a 404 page

### Backend (server/)
- **Framework**: Express.js with TypeScript, running on Node.js
- **Entry Point**: `server/index.ts` creates HTTP server, registers routes, serves static files
- **Dev Mode**: Vite dev server middleware (`server/vite.ts`) for HMR during development
- **Production**: Static file serving from `dist/public/` with SPA fallback (`server/static.ts`)
- **API Pattern**: REST API under `/api/` prefix
- **Build**: Custom build script (`script/build.ts`) using esbuild for server bundle + Vite for client

### API Routes (server/routes.ts)
- `POST /api/analyze` — Checks `analysis_cache` table first (by SHA-256 hash of normalized sentence); returns cached result if found, otherwise calls OpenAI (gpt-4o-mini), stores result, then returns it
- `POST /api/pronunciation-score` — Accepts base64 audio + sentence, transcribes via Whisper, scores pronunciation via GPT
- Folder and sentence CRUD operations via the storage layer

### Analysis Caching
- Sentence is normalized (trim + collapse whitespace) before hashing
- Hash: SHA-256 hex of normalized sentence, used as cache key
- `MODEL_VERSION = "gpt-4o-mini-v1"` — bump this constant in `server/routes.ts` to invalidate cache when the prompt changes
- Cache stored in `analysis_cache` table (PostgreSQL/JSONB)

### Database
- **Database**: PostgreSQL (required via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Connection**: `pg` Pool driver (`server/db.ts`)
- **Schema** (`shared/schema.ts`):
  - `folders` — id, name, emoji (for organizing saved sentences)
  - `sentences` — id, korean text, pronunciation, words (JSONB), grammar (JSONB), folderId (FK), createdAt
  - `analysis_cache` — id, hash (unique), sentence, model_version, result (JSONB), createdAt
  - `conversations` — id, title, createdAt (for chat feature)
  - `messages` — id, conversationId (FK), role, content, createdAt
- **Migrations**: Managed via `drizzle-kit push` (schema push approach, not migration files)

### Storage Layer (server/storage.ts)
- `DatabaseStorage` class implements `IStorage` interface
- CRUD operations for folders and sentences using Drizzle query builder
- Clean separation between routes and database access

### Replit Integrations (server/replit_integrations/)
Pre-built integration modules that exist but may not all be actively used:
- **chat/** — Conversation/message CRUD with OpenAI streaming chat
- **audio/** — Voice recording, speech-to-text, text-to-speech with AudioWorklet
- **image/** — Image generation via gpt-image-1
- **batch/** — Batch processing with rate limiting and retries (p-limit, p-retry)

### Key Design Decisions
1. **Monorepo with shared types** — `shared/schema.ts` defines both database schema and TypeScript types used by both client and server, ensuring type safety across the stack
2. **JSONB for flexible data** — Words and grammar arrays stored as JSONB in PostgreSQL, allowing flexible schema without separate tables
3. **AI-powered analysis** — OpenAI gpt-4o-mini with low temperature (0.3) for consistent, structured JSON responses
4. **No authentication** — Currently no user auth; all data is shared/public

## External Dependencies

### Required Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required, app crashes without it)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key for sentence analysis
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Custom OpenAI base URL (Replit AI Integrations proxy)

### Third-Party Services
- **OpenAI API** — Used for Korean sentence analysis (gpt-4o-mini model), accessed through Replit's AI Integrations proxy
- **PostgreSQL** — Primary data store, provisioned via Replit's database feature
- **Google Fonts** — Nunito and Quicksand font families loaded via CDN

### Key npm Packages
- `drizzle-orm` + `drizzle-kit` — Database ORM and schema management
- `openai` — OpenAI API client
- `@tanstack/react-query` — Server state management
- `framer-motion` — Animation library
- `wouter` — Client-side routing
- `zod` + `drizzle-zod` — Runtime type validation
- `connect-pg-simple` — PostgreSQL session store (available but may not be actively used)