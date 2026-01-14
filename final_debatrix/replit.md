# Debatrix - AI Debate Platform

## Overview

Debatrix is an AI-powered debate platform where users can create and watch AI personas engage in structured, turn-based debates on various topics. The application orchestrates multi-turn conversations between configurable AI agents, allowing spectators to observe real-time argumentation and vote on the persuasiveness of arguments.

The platform enables users to:
- Configure AI personas with distinct tones and ideological biases
- Launch debates on custom topics with 2 personas
- Watch debates unfold in real-time as AI agents construct arguments
- Vote on individual arguments to surface the most compelling points
- Browse active and completed debates

## Recent Changes

- **2026-01-11**: Added realistic portfolio features
  - Debate controls: Play/pause/resume/skip functionality with proper state transitions
  - Analytics dashboard: Platform stats, trending topics, and recent activity
  - Persona management: Full CRUD operations with performance statistics
  - Debate search & filtering: Search by topic/persona, filter by status, sort by date/arguments
  - Proper cache invalidation across all mutations and control actions
  
- **2026-01-11**: Completed FAANG-valued architecture upgrade
  - Added Redis integration for caching and pub/sub with graceful fallback
  - Added GraphQL API layer with Apollo Server alongside REST endpoints
  - Added BullMQ for background job processing (AI argument generation)
  - Added OpenTelemetry for distributed tracing and observability
  - Added Vitest testing framework with 11 unit tests
  - Added rate limiting middleware (Redis-backed or in-memory)
  - Added structured logging with Pino (module-specific child loggers)
  - Complete cache invalidation across all mutation paths
  - Reorganized codebase with modular architecture (lib, jobs, graphql, middleware)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Technology Stack Overview

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js |
| **Language** | TypeScript |
| **Frontend** | React + Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Backend** | Express.js |
| **API** | REST + GraphQL (Apollo Server) |
| **Database** | PostgreSQL (Neon) + In-memory fallback |
| **ORM** | Drizzle ORM |
| **Caching** | Redis (optional) |
| **Job Queue** | BullMQ (with Redis) |
| **Real-time** | WebSockets + Redis Pub/Sub |
| **AI** | OpenAI GPT-4o-mini |
| **Testing** | Vitest |
| **Observability** | OpenTelemetry + Pino |

### Frontend Architecture

**Technology Stack**: React with TypeScript, using Vite as the build tool and Wouter for client-side routing.

**UI Framework**: Shadcn/UI component library built on Radix UI primitives, styled with Tailwind CSS. The design follows a Material Design-inspired system with Linear typography aesthetics and Discord/Twitter real-time feed patterns for information density and readability.

**State Management**: TanStack Query (React Query) for server state management with optimistic updates and automatic cache invalidation. WebSocket connections for real-time debate updates.

**Key Design Patterns**:
- Component composition with Radix UI primitives for accessibility
- Form validation using React Hook Form with Zod schemas
- Theme switching (light/dark mode) via context provider
- Real-time updates through WebSocket integration

**Layout Strategy**: Responsive grid layouts that collapse from multi-column to single-column on mobile. Debate viewer uses 70/30 split (main feed/sidebar), while forms use centered max-w-2xl containers.

### Backend Architecture

**Runtime**: Node.js with Express.js server framework

**API Design**: 
- RESTful endpoints for CRUD operations on debates, personas, and arguments
- GraphQL endpoint at `/graphql` with Apollo Server for flexible data fetching
- WebSocket server (using `ws` library) for real-time debate streaming

**Middleware Stack**:
- Rate limiting with Redis-backed or in-memory storage
- Structured error handling with custom error classes
- Request logging with Pino

**Orchestration Pattern**: Server-side debate orchestrator manages turn-taking logic, coordinates AI agent invocations, and broadcasts updates to connected clients. The orchestrator:
- Tracks current round and turn state
- Queues AI generation requests (via BullMQ when Redis available)
- Broadcasts typing indicators and new arguments via WebSocket
- Handles debate lifecycle (active → completed)

**AI Integration**: OpenAI GPT-4o-mini API for argument generation. Each persona maintains conversation history, and prompts include tone/bias characteristics plus previous arguments for context-aware responses.

### Data Storage

**Database**: PostgreSQL (via Neon serverless) with Drizzle ORM for type-safe queries. Falls back to in-memory storage when DATABASE_URL is not set.

**Caching Layer**: Redis for:
- API response caching (60s TTL for debate lists)
- Rate limiting counters
- Pub/Sub for real-time updates
- Job queue storage (BullMQ)

**Schema Design**:
- `personas`: Configurable AI agents with name, tone, and bias attributes
- `debates`: Topics, participant references, status tracking, round counters
- `debateArguments`: Individual arguments linked to debates and personas with round numbers
- `votes`: User votes on arguments with fingerprint-based anonymity

**Data Relations**: One-to-many relationships between debates and arguments, many-to-one from arguments to personas. Debates reference two personas (A and B).

**Migration Strategy**: Drizzle Kit for schema migrations with PostgreSQL dialect

### Authentication & Authorization

**Current Implementation**: No authentication system. Voting uses browser fingerprinting stored in localStorage to prevent duplicate votes on the same argument.

**Future Consideration**: System is designed to add user authentication layer without breaking existing functionality.

### Real-time Communication

**WebSocket Architecture**: 
- Client establishes WebSocket connection when entering debate room
- Server maintains map of connected clients per debate
- Broadcasts include: typing indicators, new arguments, debate status changes
- Auto-reconnection handled client-side with useEffect cleanup

**Redis Pub/Sub** (when Redis available):
- Cross-instance event broadcasting
- Scalable to multiple server instances

**Message Types**:
- `typing`: Indicates which persona is currently generating
- `argument`: New argument posted to debate
- `status`: Debate state changes (active/completed)
- `judgment`: Final debate judgment with winner
- `error`: Error notifications

### Background Job Processing

**BullMQ Integration** (requires Redis):
- Argument generation jobs with retry logic
- Exponential backoff on failures
- Job prioritization by round number
- Concurrent worker processing

**Fallback**: Synchronous processing when Redis not available

### Observability

**Structured Logging**: Pino logger with:
- Module-specific child loggers
- Pretty printing in development
- JSON output in production
- Request/response logging

**OpenTelemetry**: 
- Distributed tracing (when OTEL endpoint configured)
- Automatic instrumentation for HTTP, database
- Custom spans for AI operations

## File Structure

```
├── server/
│   ├── index.ts           # Main server entry point
│   ├── routes.ts          # REST API routes
│   ├── storage.ts         # Data access layer
│   ├── openai.ts          # OpenAI integration
│   ├── db.ts              # Database connection
│   ├── vite.ts            # Vite dev server integration
│   ├── graphql/
│   │   ├── index.ts       # Apollo Server setup
│   │   ├── schema.ts      # GraphQL type definitions
│   │   └── resolvers.ts   # GraphQL resolvers
│   ├── lib/
│   │   ├── redis.ts       # Redis client + Cache/PubSub services
│   │   ├── logger.ts      # Pino logger setup
│   │   └── telemetry.ts   # OpenTelemetry setup
│   ├── middleware/
│   │   ├── rateLimit.ts   # Rate limiting middleware
│   │   └── errorHandler.ts # Error handling middleware
│   └── jobs/
│       ├── queue.ts       # BullMQ queue management
│       └── argumentGenerator.ts # AI argument generation jobs
├── client/
│   └── src/
│       ├── pages/         # Route components
│       ├── components/    # UI components
│       └── lib/           # Utilities
├── shared/
│   └── schema.ts          # Database schema + types
├── tests/
│   └── unit/              # Unit tests
└── vitest.config.ts       # Test configuration
```

## External Dependencies

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | PostgreSQL connection string (uses in-memory if not set) |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI debates |
| `REDIS_URL` | No | Redis connection string for caching/queues |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | OpenTelemetry collector endpoint |
| `LOG_LEVEL` | No | Logging level (debug/info/warn/error) |

### Third-Party Services

**OpenAI API**: GPT-4o-mini model for natural language generation. Configured via `OPENAI_API_KEY` environment variable.

**Neon Database**: Serverless PostgreSQL hosting via `@neondatabase/serverless` package.

**Redis**: Optional caching and job queue storage. Can use Upstash or any Redis-compatible service.

### Key Libraries

**Backend**:
- Express.js - Web framework
- Apollo Server - GraphQL server
- Drizzle ORM - Database ORM
- BullMQ - Job queue
- ioredis - Redis client
- Pino - Structured logging
- OpenTelemetry SDK - Observability

**Frontend**:
- React + Vite
- TanStack Query
- Radix UI + shadcn/ui
- Tailwind CSS
- React Hook Form + Zod

**Testing**:
- Vitest - Unit testing

## Running the Application

**Development**:
```bash
npm run dev
```

**Run Tests**:
```bash
npm run test
```

**Database Push**:
```bash
npm run db:push
```
