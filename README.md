# Debatrix - AI Debate Platform

A modern, full-stack AI-powered debate platform where AI personas engage in structured, turn-based debates on any topic. Watch real-time argumentation, vote on the most compelling points, and explore the future of AI-driven discourse.

## Production posture

- Production requires PostgreSQL, Redis, GitHub OAuth, a session secret, and an OpenAI API key; the service fails fast when any is absent.
- Debate steps use durable, idempotent BullMQ jobs. Exhausted retries leave a recoverable error state rather than an indefinitely active debate.
- Database migrations are ordered, transactional, tracked in `schema_migrations`, and protected by a PostgreSQL advisory lock.
- CI typechecks, runs the test suite, builds the client and server, audits production dependencies, builds the Docker image, and starts it against PostgreSQL and Redis until `/readyz` succeeds.
- Development may use in-memory storage and synchronous debate scheduling when external services are intentionally absent. Those fallbacks are disabled in production.

## Quick start (local)

For the full application experience, run local PostgreSQL and Redis, then configure GitHub OAuth and OpenAI. The following starts disposable local services with development-only credentials:

```bash
docker run -d --name debatrix-postgres \
  -e POSTGRES_DB=debatrix \
  -e POSTGRES_USER=debatrix \
  -e POSTGRES_PASSWORD=debatrix \
  -p 5432:5432 postgres:16-alpine

docker run -d --name debatrix-redis -p 6379:6379 redis:7-alpine

cp .env.example .env
# Edit .env: set NODE_ENV=development, then supply GitHub OAuth and OpenAI credentials.
npm ci
npm run db:migrate
npm run dev
```

Open `http://localhost:5000`. Configure the GitHub OAuth callback URL as `http://localhost:5000/api/auth/github/callback` for local development. Stop and remove the local services when finished with `docker rm -f debatrix-postgres debatrix-redis`.

## Table of Contents

- [Production posture](#production-posture)
- [Quick start (local)](#quick-start-local)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Authentication and authorization](#authentication-and-authorization)
- [API Endpoints](#api-endpoints)
- [GraphQL API](#graphql-api)
- [WebSocket Events](#websocket-events)
- [Testing](#testing)
- [Architecture Overview](#architecture-overview)
- [Production deployment](#production-deployment)
- [Operations and troubleshooting](#operations-and-troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

### Core Features

- **AI-Powered Debates**: Create debates between AI personas powered by OpenAI GPT-4o-mini
- **Real-Time Updates**: Watch debates unfold live with WebSocket-powered streaming
- **Customizable Personas**: Create AI debaters with unique names, tones, and ideological biases
- **Structured Format**: Multi-round debates with turn-based argumentation
- **Voting System**: Vote on individual arguments to surface the most compelling points
- **AI Judgment**: Automatic winner determination with detailed reasoning

### Platform Features

- **Debate Controls**: Play, pause, resume, and skip to judgment
- **Analytics Dashboard**: Platform statistics, trending topics, and activity feeds
- **Persona Management**: Full CRUD operations with performance statistics (win rate, arguments, votes)
- **Search & Filtering**: Find debates by topic, persona, status, or sort by date/activity
- **Dark/Light Mode**: Full theme support with system preference detection

### Technical Features

- **GraphQL API**: Flexible data fetching alongside REST endpoints
- **Redis Caching**: Cache invalidation and distributed rate limiting
- **Background Jobs**: BullMQ-powered job queue for AI generation
- **Rate Limiting**: Protection against API abuse
- **Structured Logging**: Pino-based logging with module-specific loggers
- **OpenTelemetry**: Distributed tracing and observability support

## Tech Stack

| Category      | Technology                     |
| ------------- | ------------------------------ |
| **Runtime**   | Node.js 20+                    |
| **Language**  | TypeScript                     |
| **Frontend**  | React 19 + Vite                |
| **Styling**   | Tailwind CSS + shadcn/ui       |
| **Backend**   | Express.js                     |
| **API**       | REST + GraphQL (Apollo Server) |
| **Database**  | PostgreSQL                     |
| **ORM**       | Drizzle ORM                    |
| **Caching**   | Redis (required in production) |
| **Job Queue** | BullMQ                         |
| **Real-time** | WebSockets (ws)                |
| **AI**        | OpenAI GPT-4o-mini             |
| **Testing**   | Vitest                         |

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (20.19 through 24.x)
- **npm** (v10.0.0 or higher)
- **PostgreSQL** (v14 or higher) - or use a cloud provider like Neon
- **Redis** (required in production for caching, rate limits, and job queues)

You will also need:

- An **OpenAI API Key** and a **GitHub OAuth application** for production

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/raman-gatech/Debatrix.git
cd Debatrix
```

### 2. Install Dependencies

```bash
npm ci
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit the `.env` file with your configuration (see [Environment Variables](#environment-variables) section).

### 4. Set Up the Database

If using a local PostgreSQL database:

```bash
# Create the database
createdb debatrix

# Run database migrations
npm run db:migrate
```

If using Neon or another cloud provider, just set the `DATABASE_URL` and run:

```bash
npm run db:migrate
```

### 5. Start the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Environment Variables

| Variable                      | Required | Default       | Description                                                               |
| ----------------------------- | -------- | ------------- | ------------------------------------------------------------------------- |
| `APP_ORIGIN`                  | **Yes in production** | - | Exact public HTTPS origin, for example `https://debatrix.example`. |
| `SESSION_SECRET`              | **Yes in production** | - | Random secret with at least 32 characters for signed sessions. |
| `GITHUB_CLIENT_ID`            | **Yes in production** | - | GitHub OAuth application client ID. |
| `GITHUB_CLIENT_SECRET`        | **Yes in production** | - | GitHub OAuth application client secret. |
| `DATABASE_URL`                | **Yes in production** | - | PostgreSQL connection string; use `sslmode=require` when required by the provider. |
| `REDIS_URL` or `UPSTASH_REDIS_URL` | **Yes in production** | - | Redis connection string for durable jobs and distributed rate limits. |
| `OPENAI_API_KEY`              | **Yes in production** | - | OpenAI API key for debate generation and judging. |
| `PORT`                        | No | `5000` | HTTP port supplied by the platform or local environment. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | - | OpenTelemetry collector endpoint for tracing. |
| `LOG_LEVEL`                   | No | `info` | Logging level: `debug`, `info`, `warn`, `error`. |
| `NODE_ENV`                    | No | `development` | Environment: `development` or `production`. |

### Example `.env` file

```env
# Required in production
APP_ORIGIN=https://debatrix.example
SESSION_SECRET=replace-with-a-random-secret-of-at-least-32-characters
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
DATABASE_URL=postgresql://user:password@host:5432/debatrix?sslmode=require
REDIS_URL=redis://host:6379
OPENAI_API_KEY=sk-your-openai-api-key-here

# Logging
LOG_LEVEL=info
```

## Production Deployment

The production service requires PostgreSQL, Redis, GitHub OAuth, and an OpenAI API key. It fails fast if any required production configuration is missing. Before deploying, create a GitHub OAuth application and register this callback URL:

```text
https://<your-domain>/api/auth/github/callback
```

Build an immutable image, migrate the target database, and only then start the new revision:

```bash
docker build -t debatrix:<version> .
docker run --rm \
  -e DATABASE_URL='postgresql://…' \
  debatrix:<version> node scripts/migrate.mjs
```

Inject every required environment variable through the hosting platform's secret store—never through the image, repository, or browser bundle. Route HTTPS traffic only after `/readyz` returns HTTP 200. Use `/healthz` for liveness and `/readyz` for PostgreSQL/Redis readiness. The [production runbook](docs/production-runbook.md) covers release checks, rollback constraints, and routine monitoring.

## Running the Application

### Development Mode

```bash
npm run dev
```

This starts both the Express backend and Vite frontend dev server on port 5000.

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Database Commands

```bash
# Apply tracked database migrations
npm run db:migrate
```

### Verification Commands

```bash
# Type checking, unit/integration tests, and production build
npm run check
npm test
npm run build

# Production dependency audit (fails on high/critical findings)
npm run audit:prod
```

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch
```

## Project Structure

```
debatrix/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ui/            # shadcn/ui components
│   │   │   ├── argument-card.tsx
│   │   │   ├── debate-card.tsx
│   │   │   └── typing-indicator.tsx
│   │   ├── pages/             # Route pages
│   │   │   ├── home.tsx       # Debate listing with search/filter
│   │   │   ├── new-debate.tsx # Create new debate form
│   │   │   ├── debate-room.tsx# Live debate viewer
│   │   │   ├── dashboard.tsx  # Analytics dashboard
│   │   │   └── personas.tsx   # Persona management
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities and query client
│   │   ├── App.tsx            # Main app with routing
│   │   └── main.tsx           # Entry point
│   └── index.html
├── server/                    # Backend Express application
│   ├── graphql/               # GraphQL schema and resolvers
│   │   ├── index.ts           # Apollo Server setup
│   │   ├── schema.ts          # Type definitions
│   │   └── resolvers.ts       # Query/mutation resolvers
│   ├── jobs/                  # Background job processing
│   │   ├── queue.ts           # BullMQ queue setup
│   │   └── argumentGenerator.ts
│   ├── lib/                   # Shared utilities
│   │   ├── redis.ts           # Redis client and services
│   │   ├── logger.ts          # Pino logger setup
│   │   └── telemetry.ts       # OpenTelemetry setup
│   ├── middleware/            # Express middleware
│   │   ├── rateLimit.ts       # Rate limiting
│   │   └── errorHandler.ts    # Error handling
│   ├── index.ts               # Server entry point
│   ├── routes.ts              # REST API routes
│   ├── storage.ts             # Data access layer
│   ├── openai.ts              # OpenAI integration
│   ├── db.ts                  # Database connection
│   └── vite.ts                # Vite dev server integration
├── shared/                    # Shared types and schemas
│   └── schema.ts              # Drizzle schema + Zod types
├── tests/                     # Test files
│   └── unit/                  # Unit tests
├── drizzle.config.ts          # Drizzle ORM config
├── vite.config.ts             # Vite config
├── tailwind.config.ts         # Tailwind CSS config
├── tsconfig.json              # TypeScript config
└── package.json
```

## Authentication and authorization

GitHub OAuth identifies users; the application stores only the GitHub identity fields needed for the session and ownership checks. Start sign-in at `GET /api/auth/github`. On success, GitHub redirects to `GET /api/auth/github/callback`, which creates an HTTP-only session cookie. `GET /api/auth/me` returns the signed-in user and `POST /api/auth/logout` ends the session.

Read-only REST and GraphQL queries are public. Creating debates, managing personas, voting, and controlling a debate require a signed-in user. Persona and debate control operations additionally require the resource owner. The application rate-limits all API traffic and applies stricter per-user limits to debate creation and voting.

For browser clients, do not invent or persist an application token: rely on the same-origin session cookie. The frontend already follows that model.

## API Endpoints

Unless marked otherwise, `POST`, `PATCH`, and `DELETE` endpoints require a GitHub-authenticated session. Validate payload fields against the REST errors returned by the server or the GraphQL schema; malformed requests return `400` with a `VALIDATION_ERROR` code.

### Debates

| Method | Endpoint                     | Description                                                    |
| ------ | ---------------------------- | -------------------------------------------------------------- |
| `GET`  | `/api/debates`               | List all debates (supports `?search=`, `?status=`, `?sortBy=`) |
| `GET`  | `/api/debates/:id`           | Get debate details                                             |
| `POST` | `/api/debates`               | Create a new debate                                            |
| `GET`  | `/api/debates/:id/arguments` | Get all arguments for a debate                                 |
| `POST` | `/api/debates/:id/pause`     | Pause an active debate                                         |
| `POST` | `/api/debates/:id/resume`    | Resume a paused debate                                         |
| `POST` | `/api/debates/:id/skip`      | Skip to final judgment                                         |

### Personas

| Method   | Endpoint            | Description                               |
| -------- | ------------------- | ----------------------------------------- |
| `GET`    | `/api/personas`     | List all personas with stats              |
| `GET`    | `/api/personas/:id` | Get persona details                       |
| `POST`   | `/api/personas`     | Create a new persona                      |
| `PATCH`  | `/api/personas/:id` | Update a persona                          |
| `DELETE` | `/api/personas/:id` | Delete a persona (if not used in debates) |

### Voting

| Method | Endpoint     | Description         |
| ------ | ------------ | ------------------- |
| `POST` | `/api/votes` | Vote on an argument |

### Analytics

| Method | Endpoint                  | Description            |
| ------ | ------------------------- | ---------------------- |
| `GET`  | `/api/analytics/stats`    | Platform statistics    |
| `GET`  | `/api/analytics/trending` | Trending debate topics |
| `GET`  | `/api/analytics/activity` | Recent debate activity |

## GraphQL API

The GraphQL endpoint is available at `/graphql`. Access the GraphQL Playground in development mode.

### Example Queries

```graphql
# Get all debates
query {
  debates {
    id
    topic
    status
    currentRound
    totalRounds
    personaA {
      name
      tone
    }
    personaB {
      name
      tone
    }
  }
}

# Get a specific debate with arguments
query {
  debate(id: "debate-id") {
    topic
    arguments {
      content
      persona {
        name
      }
      voteCount
    }
  }
}

# Get all personas
query {
  personas {
    id
    name
    tone
    bias
  }
}
```

### Example Mutations

```graphql
# Create a new persona
mutation {
  createPersona(
    input: {
      name: "Professor Logic"
      tone: "Academic and methodical"
      bias: "Values empirical evidence above all"
    }
  ) {
    id
    name
  }
}
```

## WebSocket Events

Connect to `/ws` for real-time updates. Send a join message after connecting:

```javascript
// Connect to WebSocket
const ws = new WebSocket("ws://localhost:5000/ws");

// Join a debate room
ws.send(JSON.stringify({ type: "join", debateId: "debate-id" }));

// Listen for events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data);
};
```

### Event Types

| Event      | Description                            |
| ---------- | -------------------------------------- |
| `typing`   | A persona is generating an argument    |
| `argument` | New argument posted                    |
| `status`   | Debate status changed (paused/resumed) |
| `judgment` | Debate completed with winner announced |
| `error`    | Error occurred during debate           |

## Testing

The project uses Vitest for testing.

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch
```

### Test Structure

```
tests/
└── unit/
    └── storage.test.ts    # Storage layer tests
```

## Architecture Overview

### Frontend Architecture

- **React 19** with functional components and hooks
- **TanStack Query** for server state management with automatic caching
- **Wouter** for lightweight client-side routing
- **shadcn/ui** components built on Radix UI primitives
- **Tailwind CSS** for utility-first styling

### Backend Architecture

- **Express.js** REST API with GraphQL layer
- **Drizzle ORM** for type-safe database queries
- **WebSocket server** for real-time communication
- **BullMQ** for durable background job processing
- **Development-only fallbacks** - in-memory storage and synchronous scheduling are available only outside production

### Data Flow

1. User creates a debate via REST/GraphQL
2. Server initializes debate and starts orchestration
3. AI arguments generated via OpenAI API through durable Redis-backed jobs
4. WebSocket broadcasts updates to connected clients
5. Frontend updates via React Query invalidation
6. Votes recorded and tallied in real-time
7. AI judge determines winner at debate conclusion

## Operations and troubleshooting

### Health checks and rollout

| Endpoint | Meaning | Use it for |
| -------- | ------- | ---------- |
| `GET /healthz` | The HTTP process is running. | Container or process liveness checks. |
| `GET /readyz` | PostgreSQL and Redis are reachable. | Load-balancer readiness and deployment rollout gates. |

Run database migrations as a release step before starting a new application revision. Migrations are transactional, recorded in `schema_migrations`, and guarded by a PostgreSQL advisory lock, so it is safe for an orchestrator to invoke the command more than once. They are forward-only: roll back application images, not database schema migrations.

### Security and secret handling

- Terminate TLS at the platform or reverse proxy and set `APP_ORIGIN` to the exact HTTPS URL users visit.
- Keep `SESSION_SECRET`, OAuth credentials, database credentials, Redis credentials, and the OpenAI key in the platform secret manager. Rotate a secret if it has ever been committed or exposed.
- Configure the GitHub OAuth callback exactly as `https://<your-domain>/api/auth/github/callback`; a mismatch causes sign-in to fail.
- Do not expose `OPENAI_API_KEY`, `SESSION_SECRET`, or database URLs in any `VITE_*` variable. Vite variables are bundled into browser code.
- The service sends security headers, uses secure HTTP-only cookies in production, and disables GraphQL introspection in production.

### Common failures

| Symptom | Likely cause | Resolution |
| ------- | ------------ | ---------- |
| Server exits during startup | A required production variable is missing or invalid. | Compare the platform configuration against [`.env.example`](.env.example); `APP_ORIGIN` must be HTTPS and `SESSION_SECRET` must be at least 32 characters. |
| `/healthz` works but `/readyz` fails | PostgreSQL or Redis is unavailable or the connection URL is wrong. | Check network access, TLS/`sslmode` requirements, credentials, and provider IP/firewall rules. |
| GitHub sign-in returns to `?authError=github` | OAuth callback URL, client credentials, or session configuration is incorrect. | Verify the callback URL character-for-character and ensure the browser is using the configured `APP_ORIGIN`. |
| A debate is marked `error` | OpenAI generation or a durable job exhausted its retries. | Inspect structured logs and queue failures, correct the underlying key/provider issue, then use the owner-only resume action. |
| WebSocket updates do not arrive | A proxy is not forwarding WebSocket upgrades or the public origin is misconfigured. | Enable WebSocket upgrade support on the proxy and test `wss://<your-domain>/ws` from the deployed frontend. |

### What to monitor

Monitor HTTP error rate and latency, `/readyz`, database pool saturation, Redis connection errors, BullMQ queue latency and failures, OpenAI API failures, and the count of debates in the recoverable `error` state. Back up PostgreSQL and periodically test a restore.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with OpenAI, React, and Express.js
