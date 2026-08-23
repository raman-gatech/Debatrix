# Production runbook

## Required services

- Node.js 20.19 through 24.x
- PostgreSQL, with TLS enabled (include `?sslmode=require` in `DATABASE_URL` when required by the provider)
- Redis, with TLS enabled when supplied by the provider
- GitHub OAuth application
- OpenAI API account and key

The application will not start in production without PostgreSQL, Redis, GitHub OAuth credentials, a session secret, and an OpenAI API key.

## Required configuration

Use `.env.example` as the template. Set `APP_ORIGIN` to the exact public HTTPS origin, configure the GitHub OAuth callback as:

```text
https://your-domain.example/api/auth/github/callback
```

Generate a `SESSION_SECRET` with at least 32 random bytes. Do not place secrets in Git, Docker images, or client-side configuration.

## Deployment steps

1. Run `npm run db:migrate` against the target database. It serializes deploys with a PostgreSQL advisory lock, records completed migrations, and is safe to rerun. Run it as a release step before starting the new application image.
2. Build an immutable image: `docker build -t debatrix:<version> .`
3. Deploy it with all required environment variables injected by the hosting platform.
4. Wait for `/readyz` to return HTTP 200 before sending traffic to the new instance.
5. Confirm sign-in, a debate creation, WebSocket updates, and the queue worker in staging before production rollout.

## Rollback

Deploy the prior image version. Database migrations are forward-only and backward-compatible; do not roll them back during an application rollback.

## Routine checks

- CI must pass typecheck, tests, build, and `npm audit --omit=dev --audit-level=high`.
- Monitor `/readyz`, application error rate, OpenAI failures, BullMQ failed jobs, Redis connectivity, database connection pool saturation, and queue latency.
- Back up PostgreSQL and periodically rehearse restore procedures.
