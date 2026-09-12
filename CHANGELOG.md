# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Pasco detail breadcrumbs for institution, selected program, and course, with catalog crumbs linking directly to filtered pasco browse results
- Institution and program scopes in pasco browse URLs and API filtering

## [1.2.2] - 2026-08-30

### Added

- PostHog URL scrubbing: every outgoing event's `$current_url`/`$referrer` is reduced to origin + pathname before send (a `before_send` hook), and `$pageview` is captured manually on route changes — search-query text carried in `/pascos?q=…` never leaves the browser; gives funnels and retention a traffic baseline

### Changed

- Cloudinary asset folders are namespaced under `unipascohub/pascos/{courseId}` (was `pascos/{courseId}`) — existing assets keep working unchanged, new uploads land in the new root, and orphan cleanup now scans the new root ([#21](https://github.com/weamp-org/unipascohub/pull/21))
- The Open Graph share card uses the brand's green palette instead of the dark stone treatment ([#22](https://github.com/weamp-org/unipascohub/pull/22))

## [1.2.1] - 2026-08-30

### Fixed

- Catalog list endpoints (`/api/courses`, `/api/institutions`, `/api/programs`) no longer serve a 1-hour HTTP cache — approved programs/courses and institution edits appear immediately in the upload form and comboboxes ([#19](https://github.com/weamp-org/unipascohub/pull/19))

## [1.2.0] - 2026-08-30

### Added

- Admin link in the mobile nav sheet (desktop already had it) ([#14](https://github.com/weamp-org/unipascohub/pull/14))
- Operations runbooks: promoting the first admin and fulfilling data-deletion requests ([#17](https://github.com/weamp-org/unipascohub/pull/17))

### Changed

- Upload limits tightened: 5 MB per file (was 10 MB) and 10 files per pasco (was 20), consistent across schema, server enforcement, docs, and the uploading guide ([#15](https://github.com/weamp-org/unipascohub/pull/15))
- Legal pages finalized: draft framing removed, ownership/license grant, copyright & takedown process, IP-address disclosure, governing law (Republic of Ghana), org contact email ([#16](https://github.com/weamp-org/unipascohub/pull/16), [#17](https://github.com/weamp-org/unipascohub/pull/17))
- Contact address switched from personal to organizational email (`admin@weamp.org`) across the Code of Conduct, security policy, and web-push VAPID contact ([#13](https://github.com/weamp-org/unipascohub/pull/13))

## [1.1.0] - 2026-08-30

### Added

- How-to guides: `/guides` index with browsing and uploading walkthroughs, linked from the footer and included in the sitemap ([#12](https://github.com/weamp-org/unipascohub/pull/12))

### Changed

- Production domain and repository moved to `weamp-org` / `unipascohub.weamp.org` — site URLs (metadata, sitemap, robots, JSON-LD) are now driven by a single `siteUrl` constant ([#6](https://github.com/weamp-org/unipascohub/pull/6))
- Rate limiting uses Upstash's HTTP/REST client instead of a TCP socket — **env migration: `REDIS_URL` → `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`** (the app falls back to in-memory limiting without them) ([#10](https://github.com/weamp-org/unipascohub/pull/10))
- Seeds are insert-missing-only: established databases skip re-seeding entirely on deploys, while new seed data still propagates ([#8](https://github.com/weamp-org/unipascohub/pull/8))

### Security

- CSP allowlist extended for the Clerk custom FAPI domain, Cloudflare Turnstile, and Clerk protection hosts, verified against Clerk's CSP guide ([#9](https://github.com/weamp-org/unipascohub/pull/9))
- Seed transactions are no longer capped at the default 5s interactive transaction timeout — fixes cold-start deploy failures (P2028) ([#7](https://github.com/weamp-org/unipascohub/pull/7))

## [1.0.1] - 2026-08-30

### Fixed

- Local setup docs: quick start and development guide used a single-file `docker compose up -d` that never published the Postgres port — replaced with the two-file invocation (`compose.yaml` + `compose.local.yaml`) and documented the included local Redis and optional `REDIS_URL` ([#4](https://github.com/weamp-org/unipascohub/pull/4))
- Local setup docs: added the missing seed scripts to the quick start and scripts table, and fixed duplicated/numbered sections in the development guide ([#4](https://github.com/weamp-org/unipascohub/pull/4))

## [1.0.0] - 2026-08-30

### Added

- Contributor contributions hub at `/contributions` (my uploads + catalog request history)
- Catalog submission queue: contributors request programs/courses; moderators approve into live catalog
- Hybrid catalog: courses with a linked program auto-approve; programs stay in moderation queue
- Institution seed script (`pnpm seed-institutions`) from [Wikipedia's list of universities in Ghana](https://en.wikipedia.org/wiki/List_of_universities_in_Ghana)
- Catalog review page at `/moderation/catalog` with notifications on submit/approve/reject
- Upload form: request program/course dialogs, pending submission alerts, deep-link prefill after approval
- Frontend standards doc, site config module, Motion, shadcn `empty`/`skeleton`
- App shell: `SiteHeader`, `SiteFooter`, `ScrollToTop`, theme toggle (system/light/dark)
- Frontend Phase 2: layout primitives (`PageContainer`, `PageHeader`, `Section`), `PascoCard`, list skeletons, `PascoListSection`, `EmptyState`, `useCourse` hook, homepage recent-pascos preview
- Frontend Phase 3: stub pages for `/contributors`, `/sponsors`, `/privacy`, `/terms`, `/feedback` (footer links + credit link)
- Frontend Phase 4: production homepage with `HomeHero`, `HeroSearch` (v1 decorative), recent + popular `PascoListSection` blocks
- Frontend Phase 5: `/pascos` browse page with URL-driven filters, sort, pagination, and homepage wiring
- Frontend Phase 6: pasco create/detail/edit pages aligned to shell (`PageHeader`, `PascoPageNav`, `PascoDetailPage`, `PascoDetailSkeleton`, `pasco-display` helpers)
- Frontend Phase 7: accessibility and responsive polish (`SkipToContent`, landmark labels, browse live regions, collapsible mobile filters, dialog/skeleton improvements)
- PostHog product analytics (client-side only) with typed event wrapper, provider, and `/ingest` reverse proxy

### Changed

- Pasco uploads are anonymous to the public: detail page no longer shows uploader names; public API responses omit `uploaderId` unless the viewer is the uploader or a moderator/admin
- Contributors page: open-source contribution guidance (GitHub repo, contributing guide, and issue tracker links) replacing the private-repository DM flow

### Security

- Pre-launch security hardening ([#3](https://github.com/weamp-org/unipascohub/pull/3)): escape JSON-LD output in all script sinks (stored-XSS fix), remove permanent Cloudinary URLs from public pasco API responses, enforce allowed file formats server-side (sign, create, file-sync, asset verification), make the Redis rate limiter fail open and reconnect on transient failures, unblock published pasco pages in `robots.txt`, and require `NEXT_PUBLIC_APP_URL` in production

### Planned

- Admin dashboard UI
- Automated tests

## [0.1.0] - 2026-06-17

Initial documented baseline of implemented functionality.

### Added

#### Auth and users

- Clerk authentication (sign-in, sign-up, session management)
- User sync to PostgreSQL via webhooks and SSR fallback
- Role system: `NORMAL_USER`, `CONTRIBUTOR`, `MODERATOR`, `ADMIN`
- Self-service contributor upgrade
- Admin promote-to-moderator endpoint
- User profile (`GET/PATCH /api/users/me`)

#### Academic catalog

- Institutions, programs, and courses with admin CRUD
- Program type enum (`BACHELOR`, `BTECH`, `BTECH_TOP_UP`, `HND`, `DIPLOMA`)
- Course–program many-to-many relationship
- Program label disambiguation for same-name programs

#### Pasco lifecycle

- Create, read, update, delete pascos
- Multi-file uploads per pasco
- List with filters, pagination, and sorting
- Academic year validation (`YYYY/YYYY`)
- Incomplete upload flag (`isComplete`)
- Pasco types: `MID_SEM`, `END_OF_SEM`, `RESIT`

#### File handling

- Cloudinary signed widget upload flow
- Content-hash duplicate detection (SHA-256)
- Allowed types: PDF, images, documents (no spreadsheets)
- In-app PDF viewer and image viewer
- Signed URLs for view and download

#### Engagement

- Like/dislike reactions with toggle
- View counting (deduped per viewer)
- Download counting
- Viewer reaction included in list/detail when signed in

#### Admin and operations

- Cloudinary orphan asset cleanup (API + CLI)
- Storage cleanup run and failure logging
- Rate limiting with Redis support (in-memory fallback)

#### Frontend

- Pasco create, detail, and edit pages
- Contributor and edit permission gates
- TanStack Query data layer
- shadcn/ui component library
- Toast notifications
- API smoke test homepage (placeholder)

#### Infrastructure

- Next.js 16 App Router
- Prisma 7 with PostgreSQL
- Docker Compose for local Postgres
- GitHub Actions CI (lint, typecheck, build)
- Biome for linting and formatting

### Changed

- Renamed `student` role to `NORMAL_USER`
- Renamed `level` field to `educationLevel` on Pasco
- Course model scoped to institution with program M2M (migrated from program-only FK)

### Fixed

- Cloudinary orphan scan `next_cursor` null handling
- Cloudinary widget signing with source and widget timestamp
- Font variable consistency in globals.css

[Unreleased]: https://github.com/weamp-org/unipascohub/compare/v1.2.2...HEAD
[1.2.2]: https://github.com/weamp-org/unipascohub/releases/tag/v1.2.2
[1.2.1]: https://github.com/weamp-org/unipascohub/releases/tag/v1.2.1
[1.2.0]: https://github.com/weamp-org/unipascohub/releases/tag/v1.2.0
[1.1.0]: https://github.com/weamp-org/unipascohub/releases/tag/v1.1.0
[1.0.1]: https://github.com/weamp-org/unipascohub/releases/tag/v1.0.1
[1.0.0]: https://github.com/weamp-org/unipascohub/releases/tag/v1.0.0
[0.1.0]: https://github.com/weamp-org/unipascohub/releases/tag/v0.1.0
