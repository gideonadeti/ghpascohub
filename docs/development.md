# Development Guide

Step-by-step instructions for running Uni Pasco Hub locally.

## Prerequisites

- **Node.js 24** (matches CI — see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml))
- **pnpm 11** (`corepack enable && corepack prepare pnpm@11.4.0 --activate`)
- **Docker** (for local PostgreSQL)
- Accounts for **Clerk** and **Cloudinary** (free tiers are sufficient for development)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/weamp-org/unipascohub.git
cd unipascohub
pnpm install
```

### 2. PostgreSQL + Redis via Docker Compose

The project uses two Compose files, invoked together:

- [`compose.yaml`](../compose.yaml) — Postgres 18 (no ports published by itself)
- [`compose.local.yaml`](../compose.local.yaml) — publishes Postgres on `127.0.0.1:5432` and adds a local Redis 8 on `127.0.0.1:6379`

Create the password secret file before starting:

```bash
mkdir -p secrets
echo "your-local-password" > secrets/postgres_password.txt
```

Start the stack (always pass both files — without `compose.local.yaml`, Postgres has no published port):

```bash
docker compose -f compose.yaml -f compose.local.yaml up -d
```

Create `.env` from [`.env.example`](../.env.example) before editing it:

```bash
cp .env.example .env
```

Then set `DATABASE_URL` in `.env`:

```text
DATABASE_URL="postgresql://postgres:your-local-password@localhost:5432/unipascohub"
```

Machine-specific values may instead live in `.env.local` (create it with `cp .env.example .env.local` and keep only your overrides there). Prisma CLI commands (`prisma migrate`, `generate`, `studio`) and the `pnpm seed-*` scripts load both files with the same precedence Next.js uses at runtime: real environment > `.env.local` > `.env` (see `prisma/lib/load-cli-env.ts`).

Rate limiting uses Upstash's HTTP/REST Redis client: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (from the "REST API" section of your database in the [Upstash console](https://console.upstash.com/redis)) to enable distributed rate limiting. Without them the app uses an in-memory store, which is fine for development. (The Redis container in `compose.local.yaml` is not used by the app.)

### 3. Environment variables

Fill in all required values in the `.env` created above. See [`.env.example`](../.env.example) for the full list and where to obtain each value.

### 4. Prisma migrations

```bash
pnpm prisma migrate dev
pnpm prisma generate
```

- Migrations live in [`prisma/migrations/`](../prisma/migrations/)
- Generated client output: `generated/prisma/`
- Config: [`prisma.config.ts`](../prisma.config.ts)
- Search requires the `pg_trgm` extension (applied by migration `20260618100000_add_pg_trgm_course_search_indexes`). Most managed Postgres providers support `CREATE EXTENSION pg_trgm`; confirm before production deploy.
- The trigram search indexes (`course_code_trgm_idx`, `course_title_trgm_idx`, `institution_name_trgm_idx`) are **migration-managed, not schema-managed** — Prisma cannot express them in `schema.prisma`. They were once dropped by a later generated migration (`20260618132845`) and re-added by `20260829000000_recreate_pg_trgm_search_indexes`. When running `prisma migrate dev`, prefer `--create-only`, review the generated SQL, and remove any spurious `DROP INDEX *_trgm_idx` lines before applying. Verify after deploys with:
  ```sql
  SELECT indexname FROM pg_indexes WHERE indexdef LIKE '%gin_trgm_ops%'; -- expect 3 rows
  ```

### 5. Clerk configuration

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Copy the publishable and secret keys into `.env`.
3. Add a webhook endpoint pointing to `https://<your-dev-url>/api/webhooks` (use [ngrok](https://ngrok.com/) or Clerk's dev tunnel for local testing).
4. Subscribe to `user.created`, `user.updated`, and `user.deleted` events.
5. Copy the webhook signing secret to `CLERK_WEBHOOK_SIGNING_SECRET`.

The app also syncs users on page load via [`src/components/ensure-user-synced.tsx`](../src/components/ensure-user-synced.tsx) as a fallback when webhooks are delayed.

### 6. Cloudinary configuration

1. Create a Cloudinary account at [cloudinary.com](https://cloudinary.com/).
2. Add API credentials to `.env`.
3. Create a **signed upload preset** (Settings → Upload → Upload presets) — every upload is signed server-side via [`POST /api/cloudinary/sign`](api/pascos.md).
4. Set `CLOUDINARY_UPLOAD_PRESET` to the preset name.

Allowed file types are defined in [`src/lib/pasco-file-types.ts`](../src/lib/pasco-file-types.ts): PDF, images, and documents (not spreadsheets).

### 7. PostHog (optional)

Client-side product analytics only. Leave `NEXT_PUBLIC_POSTHOG_KEY` and
`NEXT_PUBLIC_POSTHOG_HOST` unset to run completely without it (the default).
To enable locally, copy the values from [`.env.example`](../.env.example) into
`.env`. Events, privacy rules, and Vercel setup are documented in
[`docs/analytics.md`](analytics.md).

### 8. Seed catalog data

Seed scripts live in [`prisma/seed-*.ts`](../prisma/) and are registered in [`prisma/seeds.config.ts`](../prisma/seeds.config.ts), each exposed as a `pnpm seed-<name>` script in [`package.json`](../package.json) (not `prisma db seed` — Prisma only supports one built-in seed command):

```bash
pnpm seed-institutions      # ~90 Ghanaian institutions from Wikipedia
pnpm seed-atu-programs      # ATU programs
pnpm seed-atu-eee-courses   # ATU EEE Level 100 Semester 1 courses
```

All three seeds upsert, so they are safe to re-run. Institutions come from [Wikipedia's list of universities in Ghana](https://en.wikipedia.org/wiki/List_of_universities_in_Ghana), parsed by [`prisma/data/parse-wikipedia-institutions.ts`](../prisma/data/parse-wikipedia-institutions.ts). Programs are added via contributor submission (moderator review) or admin API; courses with a linked program are added automatically when contributors submit from the upload form.

To add another seed: create `prisma/seed-<name>.ts`, register it in `prisma/seeds.config.ts`, and add `"seed-<name>": "tsx prisma/seed-<name>.ts"` to `package.json`.

For local moderator testing, set a user's `role` to `MODERATOR` or `ADMIN` in Prisma Studio. Catalog mutations via admin API still require `ADMIN`.

### 9. Run the dev server

```bash
pnpm dev
```

Smoke-check:

- `/` — API smoke test (institution and pasco counts)
- `/pascos/new` — upload form (requires sign-in + contributor role)

## CI expectations

Pull requests to `main` run:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Run these locally before pushing. Husky pre-commit hooks run lint-staged when not in CI.

## Troubleshooting

### Prisma: connection refused

- Confirm Docker is running: `docker compose ps`
- Check `DATABASE_URL` host, port, password, and database name (`unipascohub`)

### Clerk: Unauthorized on protected routes

- Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` match the same Clerk application
- Ensure you are signed in for routes that require authentication

### Clerk webhook: user not in database

- Confirm webhook URL is reachable and signing secret is correct
- Check server logs for verification errors in [`src/app/api/webhooks/route.ts`](../src/app/api/webhooks/route.ts)
- `EnsureUserSynced` should create the user on first page load as a fallback

### Cloudinary: upload fails

- Verify signed upload preset name matches `CLOUDINARY_UPLOAD_PRESET`
- Check file type is allowed (no spreadsheets)
- Confirm file size is under `PASCO_MAX_FILE_SIZE_BYTES` (default 5 MB)

### Pasco create: course not found

- Run `pnpm seed-institutions` for institutions, or add a course from `/pascos/new` (auto-added when a program is selected)
- Program requests still require moderator approval before they appear in the upload form

### Rate limiting in development

Without Upstash credentials, rate limits use an in-memory store (single process only). This is fine for local dev. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to test distributed rate limiting.

## When you change things, update docs

| Change        | Update                                                  |
| ------------- | ------------------------------------------------------- |
| New env var   | [`.env.example`](../.env.example), this file            |
| New migration | [`docs/data-model.md`](data-model.md) if schema changes |
| New API route | [`docs/api/`](api/)                                     |
