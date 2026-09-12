# Features

Retrospective of what has been built, organized by user-facing capability. Cross-links point to implementation files.

## Auth and users

| Capability                                       | Status | Key files                                                                                                                                                                                      |
| ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in / sign up via Clerk                      | Done   | [`src/app/layout.tsx`](../src/app/layout.tsx)                                                                                                                                                  |
| User sync to PostgreSQL (webhook)                | Done   | [`src/app/api/webhooks/route.ts`](../src/app/api/webhooks/route.ts), [`src/lib/user-sync.ts`](../src/lib/user-sync.ts)                                                                         |
| SSR user sync fallback                           | Done   | [`src/components/ensure-user-synced.tsx`](../src/components/ensure-user-synced.tsx)                                                                                                            |
| Current user profile (`GET/PATCH /api/users/me`) | Done   | [`src/app/api/users/me/route.ts`](../src/app/api/users/me/route.ts)                                                                                                                            |
| Self-upgrade to contributor                      | Done   | [`src/app/api/users/upgrade-to-contributor/route.ts`](../src/app/api/users/upgrade-to-contributor/route.ts), [`src/components/pasco-create-gate.tsx`](../src/components/pasco-create-gate.tsx) |
| Admin promote to moderator                       | Done   | [`src/app/api/users/[userId]/promote-to-moderator/route.ts`](../src/app/api/users/[userId]/promote-to-moderator/route.ts)                                                                      |

## Academic catalog

| Capability                                               | Status | Key files                                                                                                                                        |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| List institutions                                        | Done   | [`src/lib/institutions.ts`](../src/lib/institutions.ts)                                                                                          |
| CRUD institutions (admin)                                | Done   | [`src/app/api/institutions/`](../src/app/api/institutions/)                                                                                      |
| List programs (filter by institution)                    | Done   | [`src/lib/programs.ts`](../src/lib/programs.ts)                                                                                                  |
| CRUD programs (admin)                                    | Done   | [`src/app/api/programs/`](../src/app/api/programs/)                                                                                              |
| List courses (filter by institution/program)             | Done   | [`src/lib/courses.ts`](../src/lib/courses.ts)                                                                                                    |
| CRUD courses (admin)                                     | Done   | [`src/app/api/courses/`](../src/app/api/courses/)                                                                                                |
| Program label disambiguation (same name, different type) | Done   | [`src/lib/catalog-labels.ts`](../src/lib/catalog-labels.ts)                                                                                      |
| Institution seed script                                  | Done   | [`prisma/seed-institutions.ts`](../prisma/seed-institutions.ts)                                                                                  |
| Contributor catalog submissions (program/course)         | Done   | [`src/lib/catalog-submissions.ts`](../src/lib/catalog-submissions.ts), [`src/app/api/catalog-submissions/`](../src/app/api/catalog-submissions/) |
| Course auto-approve when linked to a program             | Done   | [`src/lib/catalog-submissions.ts`](../src/lib/catalog-submissions.ts)                                                                            |
| Catalog moderation queue (moderator+)                    | Done   | [`src/app/moderation/catalog/page.tsx`](../src/app/moderation/catalog/page.tsx)                                                                  |
| Request program/course from upload form                  | Done   | [`src/components/pasco-create-form.tsx`](../src/components/pasco-create-form.tsx)                                                                |
| Contributor contributions hub (`/contributions`)         | Done   | [`src/app/contributions/page.tsx`](../src/app/contributions/page.tsx), [`GET /api/users/me/pascos`](../src/app/api/users/me/pascos/route.ts)     |

Catalog mutations require `ADMIN` role. Reads are public.

## Pasco lifecycle

| Capability                              | Status | Key files                                                                                                                      |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Create pasco (multi-file)               | Done   | [`src/components/pasco-create-form.tsx`](../src/components/pasco-create-form.tsx), [`src/lib/pascos.ts`](../src/lib/pascos.ts) |
| List pascos (filters, pagination, sort) | Done   | [`src/lib/pascos.ts`](../src/lib/pascos.ts), [`src/app/api/pascos/route.ts`](../src/app/api/pascos/route.ts)                   |
| Get pasco detail                        | Done   | [`src/app/api/pascos/[pascoId]/route.ts`](../src/app/api/pascos/[pascoId]/route.ts)                                            |
| Edit pasco                              | Done   | [`src/components/pasco-edit-form.tsx`](../src/components/pasco-edit-form.tsx)                                                  |
| Delete pasco                            | Done   | [`src/components/pasco-delete-dialog.tsx`](../src/components/pasco-delete-dialog.tsx)                                          |
| Academic year validation (`YYYY/YYYY`)  | Done   | [`src/lib/academic-year.ts`](../src/lib/academic-year.ts)                                                                      |
| Incomplete upload flag (`isComplete`)   | Done   | Prisma `Pasco.isComplete`                                                                                                      |

### List filters

`q`, `institutionId`, `programId`, `courseId`, `educationLevel`, `academicYear`, `semesterType`, `type`, `contentType`, `isComplete`, `page`, `limit`, `sortBy`, `sortOrder`.

### Sort fields

`createdAt`, `updatedAt`, `academicYear`, `likeCount`, `dislikeCount`, `downloadCount`, `viewCount`.

## File handling

| Capability                     | Status | Key files                                                                                                                                                                                          |
| ------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudinary widget upload       | Done   | [`src/components/pasco-cloudinary-upload.tsx`](../src/components/pasco-cloudinary-upload.tsx)                                                                                                      |
| Upload signing                 | Done   | [`src/app/api/cloudinary/sign/route.ts`](../src/app/api/cloudinary/sign/route.ts)                                                                                                                  |
| Content hash computation       | Done   | [`src/app/api/pascos/files/compute-hash/route.ts`](../src/app/api/pascos/files/compute-hash/route.ts), [`src/lib/content-hash.ts`](../src/lib/content-hash.ts)                                     |
| Duplicate file detection       | Done   | [`src/app/api/pascos/files/check-duplicates/route.ts`](../src/app/api/pascos/files/check-duplicates/route.ts)                                                                                      |
| In-app PDF viewer              | Done   | [`src/components/pasco-embed-pdf-viewer.tsx`](../src/components/pasco-embed-pdf-viewer.tsx)                                                                                                        |
| In-app image viewer            | Done   | [`src/components/pasco-file-view.tsx`](../src/components/pasco-file-view.tsx)                                                                                                                      |
| Signed file download           | Done   | [`src/components/pasco-file-download.tsx`](../src/components/pasco-file-download.tsx)                                                                                                              |
| Download all as ZIP (2+ files) | Done   | [`src/components/pasco-download-all.tsx`](../src/components/pasco-download-all.tsx), [`src/app/api/pascos/[pascoId]/download-all/route.ts`](../src/app/api/pascos/[pascoId]/download-all/route.ts) |
| Allowed file types enforcement | Done   | [`src/lib/pasco-file-types.ts`](../src/lib/pasco-file-types.ts)                                                                                                                                    |

See [file-uploads.md](file-uploads.md) for the end-to-end upload pipeline.

## Engagement

| Capability                                 | Status | Key files                                                                                                                                                                |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Like / dislike (toggle)                    | Done   | [`src/components/pasco-engagement-bar.tsx`](../src/components/pasco-engagement-bar.tsx), [`src/lib/pasco-engagement.ts`](../src/lib/pasco-engagement.ts)                 |
| View counting (deduped per viewer)         | Done   | [`src/app/api/pascos/[pascoId]/view/route.ts`](../src/app/api/pascos/[pascoId]/view/route.ts)                                                                            |
| Download counting                          | Done   | [`src/app/api/pascos/[pascoId]/files/[fileId]/download/route.ts`](../src/app/api/pascos/[pascoId]/files/[fileId]/download/route.ts)                                      |
| Viewer reaction on list/detail (signed-in) | Done   | [`src/lib/pasco-engagement.ts`](../src/lib/pasco-engagement.ts)                                                                                                          |
| Dislike-triggered moderation queue         | Done   | [`src/lib/pasco-moderation.ts`](../src/lib/pasco-moderation.ts), [`src/app/moderation/pascos/page.tsx`](../src/app/moderation/pascos/page.tsx)                           |
| Manual flag, restore, rejection reasons    | Done   | [`src/lib/pasco-moderation.ts`](../src/lib/pasco-moderation.ts), [`src/components/pasco-reject-dialog.tsx`](../src/components/pasco-reject-dialog.tsx)                   |
| Auto-unflag on dislike drop (DISLIKES)     | Done   | [`src/lib/pasco-engagement.ts`](../src/lib/pasco-engagement.ts)                                                                                                          |
| In-app notifications (queue + reject)      | Done   | [`src/lib/notifications.ts`](../src/lib/notifications.ts), [`src/components/notification-bell.tsx`](../src/components/notification-bell.tsx)                             |
| Admin-configurable dislike threshold       | Done   | [`src/lib/moderation-settings.ts`](../src/lib/moderation-settings.ts), [`src/components/admin-moderation-settings.tsx`](../src/components/admin-moderation-settings.tsx) |
| Feedback submission (signed-in users)      | Done   | [`src/app/api/feedback/route.ts`](../src/app/api/feedback/route.ts), [`src/app/feedback/page.tsx`](../src/app/feedback/page.tsx)                                         |
| Feedback management (moderator+)           | Done   | [`src/app/api/feedback/`](../src/app/api/feedback/), [`src/app/moderation/feedback/page.tsx`](../src/app/moderation/feedback/page.tsx)                                   |

## Permissions

| Role          | Capabilities                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `NORMAL_USER` | Browse, react, download (signed-in), view files                                                       |
| `CONTRIBUTOR` | Upload/create pascos; edit/delete own pascos                                                          |
| `MODERATOR`   | Edit any pasco; review queue (approve/reject/restore/flag); review catalog submissions; cannot delete |
| `ADMIN`       | Catalog CRUD, promote moderators, delete any pasco, threshold settings, orphan cleanup                |

Server gates: [`src/lib/require-contributor.ts`](../src/lib/require-contributor.ts), [`src/lib/require-moderator.ts`](../src/lib/require-moderator.ts), [`src/lib/require-admin.ts`](../src/lib/require-admin.ts).

Client gates: [`src/components/pasco-create-gate.tsx`](../src/components/pasco-create-gate.tsx), [`src/components/pasco-edit-gate.tsx`](../src/components/pasco-edit-gate.tsx).

See [authentication.md](authentication.md) for the full matrix.

## Admin and operations

| Capability                      | Status        | Key files                                                                                                           |
| ------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Orphan Cloudinary cleanup (API) | Done          | [`src/app/api/admin/cloudinary/cleanup-orphans/route.ts`](../src/app/api/admin/cloudinary/cleanup-orphans/route.ts) |
| Orphan cleanup CLI              | Done          | [`scripts/cleanup-cloudinary-orphans.ts`](../scripts/cleanup-cloudinary-orphans.ts)                                 |
| Storage cleanup run logs        | Done          | [`src/app/api/admin/storage-cleanup/runs/route.ts`](../src/app/api/admin/storage-cleanup/runs/route.ts)             |
| Storage cleanup failure logs    | Done          | [`src/app/api/admin/storage-cleanup/failures/route.ts`](../src/app/api/admin/storage-cleanup/failures/route.ts)     |
| Admin dashboard UI              | **Not built** | —                                                                                                                   |

See [operations.md](operations.md) for maintenance workflows.

## Frontend (current state)

| Page             | Path                     | Status                                                                |
| ---------------- | ------------------------ | --------------------------------------------------------------------- |
| Home             | `/`                      | Hero, v1 search, recent + popular pasco sections                      |
| Browse pascos    | `/pascos`                | URL filters, sort, pagination                                         |
| Create pasco     | `/pascos/new`            | Functional                                                            |
| Pasco detail     | `/pascos/[pascoId]`      | Functional with institution, selected program, and course breadcrumbs |
| Edit pasco       | `/pascos/[pascoId]/edit` | Functional                                                            |
| My contributions | `/contributions`         | Uploads + catalog request history (contributor gate)                  |
| Catalog review   | `/moderation/catalog`    | Pending/rejected contributor catalog requests                         |
| Contributors     | `/contributors`          | Team cards + open-source contribution guide (`siteContributors`)      |
| Sponsors         | `/sponsors`              | Stub page                                                             |
| Privacy          | `/privacy`               | Draft placeholder                                                     |
| Terms            | `/terms`                 | Draft placeholder                                                     |
| Feedback         | `/feedback`              | Feedback hub with anchor sections                                     |

Infrastructure in place: TanStack Query, shadcn/ui components, toast notifications, basic header with auth.

See [frontend.md](frontend.md) for component structure and planned UI work.

## Not yet built

These are the main gaps before a student-facing product launch:

- **Enriched pasco display** — course code/title on list cards when not filtered by course
- **Admin dashboard UI** — orphan cleanup and failure inspection in the browser
- **Automated tests** — no test suite yet
- **Text search** — list API supports filters only, not free-text search

## When you ship a feature, update this doc

Add a row to the relevant table and move items from "Not yet built" when complete. Also update [CHANGELOG.md](../CHANGELOG.md).
