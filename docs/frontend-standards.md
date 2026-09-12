# Frontend Standards

Authoritative UI/UX conventions for Uni Pasco Hub. All new frontend work must follow this document.

**Related:** [frontend.md](frontend.md) (current implementation inventory) · [src/config/site.ts](../src/config/site.ts) (branding, links, credits)

---

## Stack

| Layer         | Primary                                                                | Fallback / enhancement                                                                        |
| ------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| UI primitives | [shadcn/ui](https://ui.shadcn.com/) (`radix-maia`, stone base)         | [Magic UI](https://magicui.design/docs/components) for marketing accents shadcn does not ship |
| Icons         | `lucide-react`                                                         | `react-icons` only when Lucide lacks the glyph                                                |
| Animation     | [Motion](https://motion.dev/docs/react) (`motion/react`)               | `tw-animate-css` for dialog enter/exit (already in project)                                   |
| Theming       | `next-themes` + CSS variables in [globals.css](../src/app/globals.css) | Default: **system**; user can pick light or dark                                              |
| Data          | TanStack Query hooks in `src/hooks/api/`                               | Never raw `fetch` in components                                                               |

Install new shadcn components via `pnpm dlx shadcn add <name>`.

---

## App shell (Phase 1 target)

Every page shares one shell:

```text
SiteHeader
main (flex-1)
SiteFooter
Toaster
```

### Header

- **Left:** site name (`siteName` from config) linking to `/`
- **Right:** theme toggle, Clerk `UserButton` (or sign-in when signed out)
- **No primary nav links** in the header for v1 — use page CTAs and footer instead
- Sticky optional: `sticky top-0 z-50 border-b bg-background/95 backdrop-blur`
- Use design tokens only — no one-off colors (e.g. remove hardcoded purple Sign Up)

### Footer

- Brand tagline, scalable credit line via `getCreditLine()` from [site.ts](../src/config/site.ts)
- Grouped links from `footerNav` (product, legal, community)
- Social / Buy Me a Coffee links from `siteLinks` — render only when env URLs are set
- Scroll-to-top control (Phase 1)

---

## Component layers

```text
page.tsx (server)
└── *Page / *View (client, optional)
    ├── *Gate (auth only)
    ├── layout sections
    └── ui/* primitives
```

### Naming

| Pattern    | Example                                 | Rules                                               |
| ---------- | --------------------------------------- | --------------------------------------------------- |
| Domain     | `pasco-card.tsx`, `home-hero.tsx`       | May use hooks and API types                         |
| Gates      | `pasco-create-gate.tsx`                 | Auth/role checks only                               |
| Layout     | `site-header.tsx`, `page-container.tsx` | Shell and page wrappers                             |
| Primitives | `ui/button.tsx`                         | **Must not** import from `hooks/api/` or `lib/api/` |

---

## Layout width tiers

| Tier    | Max width   | Use for                    |
| ------- | ----------- | -------------------------- |
| Narrow  | `max-w-2xl` | Forms, detail views, gates |
| Default | `max-w-6xl` | Homepage, browse lists     |
| Wide    | `max-w-7xl` | Admin dashboards (future)  |

**Page wrapper:** `mx-auto w-full flex-1 px-4 py-6 sm:px-6`

**Vertical rhythm:** sections use `space-y-8` or `space-y-12`

---

## Typography

Use Geist (loaded in [layout.tsx](../src/app/layout.tsx)):

| Token   | Classes                                             | Use            |
| ------- | --------------------------------------------------- | -------------- |
| Display | `text-3xl sm:text-4xl font-bold tracking-tight`     | Hero headline  |
| H1      | `text-2xl sm:text-3xl font-semibold tracking-tight` | Page titles    |
| H2      | `text-xl font-semibold`                             | Section titles |
| H3      | `text-lg font-medium`                               | Card titles    |
| Body    | `text-sm sm:text-base`                              | Default copy   |
| Small   | `text-xs sm:text-sm text-muted-foreground`          | Meta, captions |

---

## UI states

Every data-driven section must handle loading, error, and empty.

| State          | Component                                           | When                                           |
| -------------- | --------------------------------------------------- | ---------------------------------------------- |
| Loading        | `Skeleton` (lists/cards), `Spinner` (inline/button) | Skeleton for grids; spinner for submit actions |
| Error          | `Alert variant="destructive"`                       | Section or block failed to load                |
| Mutation error | Sonner toast                                        | Create/update/delete failures                  |
| Empty          | shadcn `Empty` + CTA `Button`                       | No results                                     |

Prefer `PascoCardSkeleton` grid (Phase 2) over spinners for list loading.

---

## List and card standard

`PascoCard` — shared by homepage and browse:

- Entire card is a `Link` to `/pascos/[id]` (large tap target on mobile)
- **Institution eyebrow:** `course.institutionName` above the title when present; hidden on browse when `courseId` filter is active
- **Title:** `course.code — course.title` from list API `course` summary (fallback: `academicYear · level`)
- **Subtitle:** `getPascoDisplayDescription` — muted line with year, level, and semester (exam type lives in the badges)
- **Badges:** max 2 via `getPascoCardBadges` — incomplete upload, non-default content type, partial solutions, exam type; browse passes `hiddenBadgeKeys` for active filters
- **Meta row:** context-aware via `emphasize` (`createdAt`, `views`, `downloads`, `likes`) plus file count
- Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

List responses from `GET /api/pascos` include `course: { code, title, institutionName? }` on each pasco.

---

## Pasco detail file rows

`PascoFileActions` on the pasco detail page:

- Bordered row: file-type icon, truncated name (`title` for full name on hover), size on a muted second line
- View / Download: icon-only on mobile (`size="icon-sm"`); icon + label from `sm` breakpoint up
- Descriptive `aria-label` per file (e.g. `View exam.pdf`, `Download exam.pdf`)

---

## Data fetching

- Use hooks from `src/hooks/api/` with `queryKeys` from [query-keys.ts](../src/lib/api/query-keys.ts)
- Browse page (Phase 5): filters in URL search params for shareable links
- Invalidate queries on mutation success — follow existing patterns in `use-pascos.ts`

---

## Search behavior

Smart search parses free-text queries into structured browse filters and course matches.

| Surface | Behavior |
| ------- | -------- |
| **Hero search** | Debounced autocomplete via `GET /api/search/suggest`; course pick navigates to structured `/pascos?courseId=...` URL; Enter submits `/pascos?q=...` |
| **Browse search** | URL param `q` (max 200 chars); server resolves year, level, type, semester, and course code/title |
| **Explicit filters** | URL params (`institutionId`, `programId`, `courseId`, `academicYear`, etc.) override values parsed from `q` when present |

**Bare shortcuts:** A query that is only a four-digit year (e.g. `2024`) expands to that academic year (`2024/2025`). A query that is only `100`, `200`, `300`, or `400` maps to the matching education level. Leftover tokens after course-code extraction follow the same rules (e.g. `DCIT 101 2024`).

**Institution synonyms:** Course search expands whole-word abbreviations before SQL (e.g. `UG`, `Legon` → University of Ghana; `KNUST` → Kwame Nkrumah University of Science and Technology). See [`institution-synonyms.ts`](../src/lib/search/institution-synonyms.ts).

**Shareable URLs:** `/pascos?q=DCIT+101+2024%2F2025` or `/pascos?courseId=...&academicYear=2024/2025`

**API:** `GET /api/pascos` accepts `q` plus existing filter params; response may include optional `search` metadata (`parsedFilters`, `ambiguous`, `matchedCourses`). Parsed filters from `q` are preserved when URL filter params are omitted (undefined keys do not wipe parsed values).

**Typo-tolerant matching:** Postgres `pg_trgm` GIN indexes on `Course.code`, `Course.title`, and `Institution.name` (migration `20260618100000_add_pg_trgm_course_search_indexes`). Ranking prefers exact code, then prefix, then fuzzy title/code, then institution name, then program name, then pasco description (course search only). Match kinds: `exact`, `prefix`, `title`, `institution`, `program`, `description`, `fuzzy`. Trigram similarity is skipped for queries shorter than 3 characters. Thresholds live in [`search-constants.ts`](../src/lib/search/search-constants.ts).

Hero and browse search inputs use `type="text"` (not `type="search"`) to avoid browser in-page text highlighting. Browse uses `aria-label`; hero autocomplete keeps `role="combobox"`. Hero search input must have a static `aria-label` (e.g. `"Search pascos"`) regardless of animated placeholder.

**Recent searches:** Last 8 queries are stored in `localStorage` (`unipascohub:recent-searches`) and shown in the hero and browse dropdowns when the input is focused and empty. Saved on successful search submit (not on every suggest keystroke). See [`recent-searches.ts`](../src/lib/search/recent-searches.ts).

**Search analytics:** Server stores search queries (2+ chars) from suggest and browse list in Postgres (`SearchQuery` table) for product improvement. See [`record-search-query.ts`](../src/lib/search/record-search-query.ts) and [operations.md](operations.md).

---

## Theming

- Use semantic tokens: `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`
- Buttons: shadcn `Button` variants (`default`, `outline`, `ghost`, `destructive`)
- Cards: `Card` for grouped content
- Badges: `Badge` for metadata chips
- Follow [shadcn theming](https://ui.shadcn.com/docs/theming) and [dark mode (Next.js)](https://ui.shadcn.com/docs/dark-mode/next)

---

## Animation

- **Motion** for hero typing, section reveals, scroll-to-top fade
- Always respect `prefers-reduced-motion` — skip or simplify animations when set
- **Magic UI** sparingly (one accent per page max)
- Do not animate every hover state

---

## Responsiveness

Mobile-first — most users are on phones.

| Breakpoint       | Notes                                           |
| ---------------- | ----------------------------------------------- |
| default (<640px) | Single column, full-width cards, stacked footer |
| `sm`             | 2-column card grid                              |
| `md`             | Footer columns                                  |
| `lg`             | 3-column card grid, wider hero                  |

Minimum tap target: ~44px height for primary actions.

---

## Accessibility

- Interactive elements are `Button` or `Link`, not styled `<div>`
- Focus visible on all controls (shadcn defaults)
- Link cards: entire card is one focusable link with descriptive `aria-label`
- Images and icons decorative unless they convey meaning (`aria-hidden` when decorative)
- Loading: skeleton blocks use `role="status"`, `aria-busy`, and sr-only text; spinners inside labeled buttons use `aria-hidden` on the spinner
- Skip link: [`SkipToContent`](../src/components/skip-to-content.tsx) targets `#main-content` on [`PageContainer`](../src/components/layout/page-container.tsx)
- Landmarks: label footer nav groups and back-navigation `<nav>` elements; native `<header>` / `<footer>` rely on visible branding
- Live regions: browse result summary uses `aria-live="polite"` on [`pasco-browse-page.tsx`](../src/components/pasco-browse-page.tsx)
- Mobile browse: filter panel collapses below `lg` behind a toggle with `aria-expanded` / `aria-controls`
- Destructive confirms: use `AlertDialogAction` (not a plain `Button`) for correct focus semantics

---

## Credits and site config

All branding, footer links, hero copy, and social URLs live in [src/config/site.ts](../src/config/site.ts).

```ts
siteContributors         // { name, github, role?, avatarUrl? }[]
siteSponsors             // { name, url, logoUrl?, tier? }[]
getCreditLine()            // scalable footer string
siteLinks                  // from NEXT_PUBLIC_* env vars
footerNav                  // grouped footer links
heroSearchExamples         // typing animation strings
```

Contributors page (`/contributors`) reads from `siteContributors`. Avatars default to `https://github.com/{username}.png`; set `avatarUrl` to override. GitHub username can be left empty until profiles are ready (initials fallback).

Sponsors page (`/sponsors`) reads from `siteSponsors`. Each card links to `url` with an optional `logoUrl` (falls back to initials) and optional `tier` (`partner` | `supporter`) for badge display. Buy Me a Coffee CTA uses `siteLinks.buyMeACoffee` when set.

Pasco detail **Report** opens the in-app feedback dialog (`FeedbackDialog` + `FeedbackForm`) — no external service. The category is fixed to `CONTENT_ISSUE` (no selector shown); `pascoId` and the current `pageUrl` are captured automatically. Submissions go to `POST /api/feedback` (see [api/feedback.md](api/feedback.md)), stored in the `Feedback` table, and surface in the moderator feedback queue.

---

## Label formatting

Always use `formatEnumLabel` from [catalog-labels.ts](../src/lib/catalog-labels.ts) for enum display. Do not duplicate local formatters (e.g. remove `formatLabel` in `pasco-detail.tsx` in Phase 2).

---

## Phase roadmap

| Phase | Deliverables                                                              | Status  |
| ----- | ------------------------------------------------------------------------- | ------- |
| **0** | Standards doc, `site.ts`, Motion, shadcn `empty`/`skeleton`, env docs     | Done    |
| **1** | ThemeProvider, `SiteHeader`, `SiteFooter`, favicon, remove purple Sign Up | Done    |
| **2** | `PageContainer`, `PascoCard`, skeletons, `formatEnumLabel` fix            | Done    |
| **3** | Stub pages: contributors, sponsors, privacy, terms, feedback              | Done    |
| **4** | Homepage: hero, search UI, recent/popular sections                        | Done    |
| **5** | Browse page with URL filters                                              | Done    |
| **6** | Align existing pasco pages to new shell                                   | Done    |
| **7** | A11y polish, docs update                                                  | Done    |

---

## When you change the UI, update

| Change                 | Update                                                            |
| ---------------------- | ----------------------------------------------------------------- |
| New UI pattern or rule | This file                                                         |
| Site links or copy     | [site.ts](../src/config/site.ts), [.env.example](../.env.example) |
| New page or component  | [frontend.md](frontend.md)                                        |
| Shipped feature        | [CHANGELOG.md](../CHANGELOG.md)                                   |
