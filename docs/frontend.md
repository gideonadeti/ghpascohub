# Frontend

Current UI structure, conventions, and planned work.

**Standards:** All new UI work must follow [frontend-standards.md](frontend-standards.md). Site branding, links, and credits live in [`src/config/site.ts`](../src/config/site.ts).

## Phased roadmap

| Phase | Focus                                                   | Status |
| ----- | ------------------------------------------------------- | ------ |
| 0     | Standards, `site.ts`, Motion, shadcn `empty`/`skeleton` | Done   |
| 1     | Theme, header, footer, favicon                          | Done   |
| 2     | Shared primitives, `PascoCard`, skeletons               | Done   |
| 3     | Stub pages (contributors, legal, feedback)              | Done   |
| 4     | Homepage                                                | Done   |
| 5     | Browse with URL filters                                 | Done   |
| 6     | Pasco page shell alignment                              | Done   |
| 7     | A11y polish, docs update                                | Done   |

See [frontend-standards.md](frontend-standards.md) for full conventions.

## Pages

| Route                           | File                                                                                                | Renders                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `/`                             | [`src/app/page.tsx`](../src/app/page.tsx)                                                           | Hero, v1 search, recent + popular pasco sections                  |
| `/pascos`                       | [`src/app/pascos/page.tsx`](../src/app/pascos/page.tsx)                                             | URL-filtered browse grid with pagination                          |
| `/pascos/new`                   | [`src/app/pascos/new/page.tsx`](../src/app/pascos/new/page.tsx)                                     | `PageHeader`, create form behind contributor gate                 |
| `/pascos/[pascoId]`             | [`src/app/pascos/[pascoId]/page.tsx`](../src/app/pascos/[pascoId]/page.tsx)                         | `PascoDetailPage` with enriched title, breadcrumbs                |
| `/pascos/[pascoId]/edit`        | [`src/app/pascos/[pascoId]/edit/page.tsx`](../src/app/pascos/[pascoId]/edit/page.tsx)               | `PageHeader`, cancel/back nav, edit form + gate                   |
| `/contributions`                | [`src/app/contributions/page.tsx`](../src/app/contributions/page.tsx)                               | Contributor hub: uploads + catalog requests (`ContributorGate`)   |
| `/contributors`                 | [`src/app/contributors/page.tsx`](../src/app/contributors/page.tsx)                                 | Team grid from `siteContributors` + open-source contribution CTAs |
| `/sponsors`                     | [`src/app/sponsors/page.tsx`](../src/app/sponsors/page.tsx)                                         | Sponsor cards from `siteSponsors` + optional BMC CTA              |
| `/privacy`                      | [`src/app/privacy/page.tsx`](../src/app/privacy/page.tsx)                                           | Draft privacy policy placeholder                                  |
| `/terms`                        | [`src/app/terms/page.tsx`](../src/app/terms/page.tsx)                                               | Draft terms placeholder                                           |
| `/feedback`                     | [`src/app/feedback/page.tsx`](../src/app/feedback/page.tsx)                                         | Feedback hub + external form CTA                                  |
| `/guides`                       | [`src/app/guides/page.tsx`](../src/app/guides/page.tsx)                                             | Guide index linking the two usage guides                          |
| `/guides/browsing`              | [`src/app/guides/browsing/page.tsx`](../src/app/guides/browsing/page.tsx)                           | Browsing guide rendered from `src/content/guides/browsing.ts`     |
| `/guides/uploading`             | [`src/app/guides/uploading/page.tsx`](../src/app/guides/uploading/page.tsx)                         | Uploading guide rendered from `src/content/guides/uploading.ts`   |
| `/moderation/pascos`            | [`src/app/moderation/pascos/page.tsx`](../src/app/moderation/pascos/page.tsx)                       | Pending pasco review queue (moderator/admin gate)                 |

Root layout: [`src/app/layout.tsx`](../src/app/layout.tsx) — `SiteHeader`, `SiteFooter`, `ScrollToTop`, theme provider, Clerk auth, toast container.

### Shell components

| Component       | File                                                                             | Purpose                                                                                 |
| --------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `SiteHeader`    | [`site-header.tsx`](../src/components/site-header.tsx)                           | Brand link, contributions/moderation links, notification bell, theme toggle, Clerk auth |
| `SkipToContent` | [`skip-to-content.tsx`](../src/components/skip-to-content.tsx)                   | Skip link to main content landmark                                                      |
| `SiteFooter`    | [`site-footer.tsx`](../src/components/site-footer.tsx)                           | Nav groups, credits, social links                                                       |
| `ThemeToggle`   | [`theme-toggle.tsx`](../src/components/theme-toggle.tsx)                         | Light / dark / system picker                                                            |
| `ScrollToTop`   | [`scroll-to-top.tsx`](../src/components/scroll-to-top.tsx)                       | Fixed scroll-to-top button                                                              |
| `ThemeProvider` | [`providers/theme-provider.tsx`](../src/components/providers/theme-provider.tsx) | `next-themes` wrapper                                                                   |

### Layout and list components

| Component             | File                                                                       | Purpose                                                       |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `PageContainer`       | [`layout/page-container.tsx`](../src/components/layout/page-container.tsx) | Width-tiered `<main>` wrapper (`narrow` / `default` / `wide`) |
| `PageHeader`          | [`layout/page-header.tsx`](../src/components/layout/page-header.tsx)       | Page title, description, optional actions                     |
| `Breadcrumbs`         | [`layout/breadcrumbs.tsx`](../src/components/layout/breadcrumbs.tsx)       | Accessible catalog context trail on pasco details             |
| `Section`             | [`layout/section.tsx`](../src/components/layout/section.tsx)               | Titled content section                                        |
| `PascoCard`           | [`pasco-card.tsx`](../src/components/pasco-card.tsx)                       | Linked card with institution eyebrow, course title, badges    |
| `PascoListSection`    | [`pasco-list-section.tsx`](../src/components/pasco-list-section.tsx)       | Async list section with skeleton/error/empty states           |
| `PascoListSkeleton`   | [`pasco-list-skeleton.tsx`](../src/components/pasco-list-skeleton.tsx)     | Grid of card skeletons                                        |
| `EmptyState`          | [`empty-state.tsx`](../src/components/empty-state.tsx)                     | shadcn Empty wrapper with optional CTA                        |
| `ProseContent`        | [`layout/prose-content.tsx`](../src/components/layout/prose-content.tsx)   | Lightweight wrapper for static copy pages                     |
| `GuideContent`        | [`layout/guide-content.tsx`](../src/components/layout/guide-content.tsx)   | Renders structured guide content (paragraphs, bullets, steps) |
| `HomeHero`            | [`home-hero.tsx`](../src/components/home-hero.tsx)                         | Homepage marketing hero with CTAs                             |
| `HeroSearch`          | [`hero-search.tsx`](../src/components/hero-search.tsx)                     | Decorative v1 search with typing placeholder                  |
| `RevealOnScroll`      | [`reveal-on-scroll.tsx`](../src/components/reveal-on-scroll.tsx)           | Motion wrapper for section reveal on scroll                   |
| `PascoBrowsePage`     | [`pasco-browse-page.tsx`](../src/components/pasco-browse-page.tsx)         | Browse orchestrator (URL sync, results, pagination)           |
| `PascoBrowseFilters`  | [`pasco-browse-filters.tsx`](../src/components/pasco-browse-filters.tsx)   | Catalog cascade filter panel for browse                       |
| `PascoPageNav`        | [`pasco-page-nav.tsx`](../src/components/pasco-page-nav.tsx)               | Back link for pasco sub-routes                                |
| `PascoDetailSkeleton` | [`pasco-detail-skeleton.tsx`](../src/components/pasco-detail-skeleton.tsx) | Block skeleton for detail/edit loading                        |

## Component layers

```text
layout.tsx
├── EnsureUserSynced          # SSR user sync fallback
├── QueryProvider             # TanStack Query
├── header                    # Nav + auth
└── page content
    ├── *Gate components      # Auth/role checks
    ├── *Form components      # react-hook-form + Zod
    ├── domain components     # PascoDetail, EngagementBar, etc.
    └── ui/*                  # shadcn primitives
```

### Gate components

| Component         | File                                                               | Checks                       |
| ----------------- | ------------------------------------------------------------------ | ---------------------------- |
| `PascoCreateGate` | [`pasco-create-gate.tsx`](../src/components/pasco-create-gate.tsx) | Signed in + contributor role |
| `PascoEditGate`   | [`pasco-edit-gate.tsx`](../src/components/pasco-edit-gate.tsx)     | Signed in + can modify pasco |
| `ModerationGate`  | [`moderation-gate.tsx`](../src/components/moderation-gate.tsx)     | Signed in + moderator/admin  |

### Domain components

| Component                           | Purpose                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `PascoDetailPage`                   | Detail view with `PageHeader`, sections, files, engagement, delete |
| `PascoDetail`                       | Re-export alias for `PascoDetailPage`                              |
| `PascoCreateForm` / `PascoEditForm` | Full pasco forms with catalog pickers                              |
| `PascoCloudinaryUpload`             | File upload widget and validation                                  |
| `PascoEngagementBar`                | Like/dislike, view/download counts                                 |
| `PascoFileView`                     | Modal viewer for PDFs and images                                   |
| `PascoEmbedPdfViewer`               | PDF embed using `@embedpdf/react-pdf-viewer`                       |
| `PascoFileActions`                  | View/download buttons per file                                     |
| `PascoDownloadAll`                  | Bulk ZIP download for pascos with 2+ files                         |
| `PascoDeleteDialog`                 | Delete confirmation                                                |
| `ModerationPascosPage`              | Pending/rejected tabs, manual flag, admin threshold settings       |
| `PascoModerationActions`            | Approve/reject/restore/flag actions                                |
| `PascoRejectDialog`                 | Required reason dialog for reject                                  |
| `PascoManualFlagForm`               | Send pasco to review by ID                                         |
| `AdminModerationSettings`           | Admin-only dislike threshold editor                                |
| `NotificationBell`                  | Header dropdown for in-app notifications                           |

### UI primitives

shadcn-style components in [`src/components/ui/`](../src/components/ui/): button, card, dialog, select, combobox, field, alert, spinner, empty, skeleton, etc.

## Data fetching

### API client

Axios instance with error handling: [`src/lib/api/client.ts`](../src/lib/api/client.ts)

Domain wrappers: [`src/lib/api/`](../src/lib/api/) — `pascos.ts`, `users.ts`, `institutions.ts`, `programs.ts`, `courses.ts`, `cloudinary.ts`, `pasco-engagement.ts`, `moderation.ts`, `notifications.ts`

### TanStack Query

| Hook file                                                             | Hooks                                                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`use-pascos.ts`](../src/hooks/api/use-pascos.ts)                     | `usePascosList`, `usePasco`, create/update/delete mutations       |
| [`use-pasco-engagement.ts`](../src/hooks/api/use-pasco-engagement.ts) | Reactions, views, file view/download, download all as ZIP         |
| [`use-current-user.ts`](../src/hooks/api/use-current-user.ts)         | Current user profile                                              |
| [`use-institutions.ts`](../src/hooks/api/use-institutions.ts)         | Institution list                                                  |
| [`use-programs.ts`](../src/hooks/api/use-programs.ts)                 | Program list                                                      |
| [`use-courses.ts`](../src/hooks/api/use-courses.ts)                   | Course list and detail (`useCourse`)                              |
| [`use-moderation.ts`](../src/hooks/api/use-moderation.ts)             | Moderation queue, settings, approve/reject/restore/flag mutations |
| [`use-notifications.ts`](../src/hooks/api/use-notifications.ts)       | Notification list, mark read (polls every 60s)                    |

Query keys: [`src/lib/api/query-keys.ts`](../src/lib/api/query-keys.ts)

Provider: [`src/components/providers/query-provider.tsx`](../src/components/providers/query-provider.tsx)

## Form validation

Zod schemas with react-hook-form:

| Schema                  | File                                                                    | Used by           |
| ----------------------- | ----------------------------------------------------------------------- | ----------------- |
| `pascoCreateFormSchema` | [`src/lib/schemas/pasco-create.ts`](../src/lib/schemas/pasco-create.ts) | `PascoCreateForm` |
| `pascoUpdate` parsing   | [`src/lib/schemas/pasco-update.ts`](../src/lib/schemas/pasco-update.ts) | `PascoEditForm`   |

## Styling

- Tailwind CSS 4 — [`src/app/globals.css`](../src/app/globals.css)
- Geist font via `next/font`
- `cn()` utility: [`src/lib/utils.ts`](../src/lib/utils.ts)
- Toast notifications via Sonner

## Known gaps (post-launch)

These items remain after the frontend roadmap (Phases 0–7):

1. **Admin dashboard** — UI for orphan cleanup and storage failure inspection
2. **Automated a11y tests** — no Lighthouse CI or axe suite yet

See [features.md](features.md) for the full implemented vs planned breakdown.

## When you add a page, update this doc

Add a row to the Pages table and note any new components or hooks.
