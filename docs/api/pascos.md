# Pasco API

Pasco CRUD, file operations, and engagement endpoints.

Types: [`src/types/api/pascos.ts`](../../src/types/api/pascos.ts)

## List and create

### `GET /api/pascos`

List pascos with filters, pagination, and sorting.

**Auth:** None (includes `viewerReaction` when signed in)

**Rate limit:** 120 requests per 15 minutes per IP (configurable via `PASCO_LIST_RATE_LIMIT`, `PASCO_LIST_RATE_WINDOW_MS`). Returns `429` with optional `Retry-After` when exceeded.

**Query parameters:**

| Param            | Type    | Default     | Description                                                                                         |
| ---------------- | ------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `q`              | string  | —           | Search by course code/title and parse supported pasco filters                                       |
| `institutionId`  | string  | —           | Filter by the institution linked to each pasco's course                                             |
| `programId`      | string  | —           | Filter by a program linked to each pasco's course                                                   |
| `courseId`       | string  | —           | Filter by course                                                                                    |
| `educationLevel` | enum    | —           | `LEVEL_100` … `LEVEL_400`                                                                           |
| `academicYear`   | string  | —           | Format `YYYY/YYYY`                                                                                  |
| `semesterType`   | enum    | —           | `FIRST_SEMESTER`, `SECOND_SEMESTER`                                                                 |
| `type`           | enum    | —           | `MID_SEM`, `END_OF_SEM`, `RESIT`                                                                    |
| `contentType`    | enum    | —           | `QUESTIONS_ONLY`, `QUESTIONS_AND_ANSWERS`, `ANSWERS_ONLY`                                           |
| `isComplete`     | boolean | —           | Filter by upload completeness                                                                       |
| `page`           | integer | 1           | Page number (≥ 1)                                                                                   |
| `limit`          | integer | 20          | Page size (1–100)                                                                                   |
| `sortBy`         | enum    | `createdAt` | `createdAt`, `updatedAt`, `academicYear`, `likeCount`, `dislikeCount`, `downloadCount`, `viewCount` |
| `sortOrder`      | enum    | `desc`      | `asc` or `desc`                                                                                     |

**Response `200`:**

```json
{
  "pascos": [ { "...Pasco fields..." } ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

Each pasco includes `viewerReaction` (`LIKE`, `DISLIKE`, or `null`) when the request is authenticated.

List responses also include a nested `course` summary on each pasco:

```json
"course": { "code": "DCIT 101", "title": "Introduction to Computing" }
```

Detail (`GET /api/pascos/[pascoId]`) and mutation responses do not include `course`; fetch the course separately when needed.

When the request includes a `courseId` filter, the response also includes:

```json
"appliedCourse": { "code": "DCIT 101", "title": "Introduction to Computing" }
```

Use `appliedCourse` for filter chip labels without a separate course API call.

---

### `POST /api/pascos`

Create a pasco with files.

**Auth:** Contributor+

**Body:**

```json
{
  "courseId": "clx...",
  "academicYear": "2024/2025",
  "educationLevel": "LEVEL_100",
  "semesterType": "FIRST_SEMESTER",
  "type": "END_OF_SEM",
  "contentType": "QUESTIONS_ONLY",
  "description": "Optional notes",
  "isComplete": true,
  "solutionCompleteness": null,
  "files": [
    {
      "order": 1,
      "publicId": "pascos/clx.../abc123",
      "fileName": "exam.pdf",
      "fileSize": 1048576,
      "fileUrl": "https://res.cloudinary.com/...",
      "resourceType": "IMAGE",
      "contentHash": "sha256hex..."
    }
  ]
}
```

`solutionCompleteness` must be omitted or null when `contentType` is `QUESTIONS_ONLY`.

**Response `201`:** `{ "pasco": { ... } }`

**Errors:**

- `409` `duplicate_file_content` — includes `duplicates` array with `contentHash`, `fileName`, `pascoId`
- `409` duplicate `publicId`
- `404` course not found
- `400` asset verification failures (folder mismatch, size mismatch, etc.)

## Single pasco

### `GET /api/pascos/:pascoId`

Get pasco detail.

**Auth:** None (includes `viewerReaction` when signed in)

**Response `200`:** `{ "pasco": { ... } }`

---

### `PATCH /api/pascos/:pascoId`

Update pasco metadata and/or sync files.

**Auth:** Uploader, moderator, or admin

**Body** (at least one field required):

```json
{
  "courseId": "clx...",
  "academicYear": "2024/2025",
  "description": "Updated notes",
  "educationLevel": "LEVEL_200",
  "semesterType": "SECOND_SEMESTER",
  "type": "MID_SEM",
  "contentType": "QUESTIONS_AND_ANSWERS",
  "solutionCompleteness": "FULLY_SOLVED",
  "isComplete": true,
  "files": [
    { "id": "existing-file-id", "order": 1 },
    {
      "order": 2,
      "publicId": "pascos/clx.../newfile",
      "fileName": "answers.pdf",
      "fileSize": 524288,
      "fileUrl": "https://res.cloudinary.com/...",
      "resourceType": "IMAGE",
      "contentHash": "sha256hex..."
    }
  ]
}
```

File sync: existing files referenced by `id` + `order`; new files use the create shape. Files not included are deleted from storage and database.

**Response `200`:**

```json
{
  "pasco": { "...updated pasco..." },
  "storageCleanupFailures": ["publicId1"]
}
```

`storageCleanupFailures` is present only when Cloudinary deletion failed for some removed files.

---

### `DELETE /api/pascos/:pascoId`

Delete a pasco and all its files.

**Auth:** Uploader, moderator, or admin

**Response `200`:**

```json
{
  "success": true,
  "storageCleanupFailures": []
}
```

## Moderation

Auto-flag when a published pasco's `dislikeCount` reaches the threshold (DB setting `moderation_dislike_threshold`, env `MODERATION_DISLIKE_THRESHOLD`, default **5**) and exceeds `dislikesAtLastApproval`. Re-flag after approve requires dislikes to rise above the last approval baseline. Auto-unflag: `PENDING_REVIEW` + `moderationSource = DISLIKES` + count drops below threshold → `PUBLISHED`. Manual flags (`MANUAL`) stay pending until a moderator acts.

Uploaders can view own `PENDING_REVIEW` and `REJECTED` pascos (with rejection reason). Delete: uploader (own) or admin only.

### `GET /api/moderation/pascos`

List pascos by moderation status.

**Auth:** Moderator or admin

**Query:** `status` (`PENDING_REVIEW` default, also `PUBLISHED` | `REJECTED`), `page`, `limit`

**Response `200`:** `{ pascos: [...], pagination: { ... } }` — includes `moderationSource`, `rejectionReason`, `moderationNote` where applicable.

### `PATCH /api/moderation/pascos/:pascoId`

Moderation action.

**Auth:** Moderator or admin

**Body:**

```json
{ "action": "approve" }
```

| Action    | From                      | To               | Notes                            |
| --------- | ------------------------- | ---------------- | -------------------------------- |
| `approve` | `PENDING_REVIEW`          | `PUBLISHED`      | Sets dislike baseline            |
| `reject`  | `PENDING_REVIEW`          | `REJECTED`       | Requires `reason` (string)       |
| `restore` | `REJECTED`                | `PUBLISHED`      | Clears rejection reason          |
| `flag`    | `PUBLISHED` or `REJECTED` | `PENDING_REVIEW` | Optional `note`; source `MANUAL` |

Returns `400` if `reject` without `reason`; `409` on invalid transition.

**Response `200`:**

```json
{ "moderationStatus": "PUBLISHED" }
```

### `GET /api/admin/settings/moderation`

Read dislike threshold.

**Auth:** Moderator or admin

**Response `200`:** `{ "dislikeThreshold": 5 }`

### `PATCH /api/admin/settings/moderation`

Update dislike threshold.

**Auth:** Admin only

**Body:** `{ "dislikeThreshold": 5 }`

### Notifications

#### `GET /api/notifications`

**Auth:** Signed in

**Query:** `unreadOnly`, `limit`

**Response `200`:** `{ notifications: [...], unreadCount: number }`

#### `PATCH /api/notifications/:notificationId/read`

Mark one notification read.

#### `PATCH /api/notifications/read-all`

Mark all notifications read for current user.

## Engagement

### `PUT /api/pascos/:pascoId/reaction`

Set or clear the current user's reaction.

**Auth:** Signed in

**Rate limit:** 60 requests per 15 minutes per user (configurable)

**Body:**

```json
{ "reactionType": "LIKE" }
```

Set `reactionType` to `null` to remove a reaction. Sending the same type again toggles it off.

**Response `200`:**

```json
{
  "likeCount": 5,
  "dislikeCount": 1,
  "viewerReaction": "LIKE"
}
```

---

### `POST /api/pascos/:pascoId/view`

Record a view (deduped per viewer).

**Auth:** None (uses user ID when signed in, IP address otherwise)

**Rate limit:** Global 300 views per 15 minutes; per-viewer dedupe window 1 hour (configurable)

**Response `200`:**

```json
{
  "viewCount": 42,
  "recorded": true
}
```

`recorded: false` when the view was deduped within the window.

## File access

### `POST /api/pascos/:pascoId/files/:fileId/view`

Get a signed URL for in-app viewing.

**Auth:** Signed in

**Rate limit:** 120 requests per 15 minutes per user (shared with download)

**Response `200`:**

```json
{
  "fileUrl": "https://res.cloudinary.com/.../signed...",
  "fileName": "exam.pdf"
}
```

---

### `POST /api/pascos/:pascoId/files/:fileId/download`

Record a download and get a signed download URL.

**Auth:** Signed in

**Rate limit:** 120 requests per 15 minutes per user

**Response `200`:**

```json
{
  "downloadCount": 10,
  "fileUrl": "https://res.cloudinary.com/.../signed...",
  "fileName": "exam.pdf"
}
```

---

### `POST /api/pascos/:pascoId/download-all`

Record downloads for all files and stream a ZIP archive.

**Auth:** Signed in

**Rate limit:** 120 requests per 15 minutes per user (shared with single-file download and view)

**Requirements:** Pasco must have at least two files.

**Response `200`:** Binary ZIP stream

| Header                   | Description                                                    |
| ------------------------ | -------------------------------------------------------------- |
| `Content-Type`           | `application/zip`                                              |
| `Content-Disposition`    | `attachment; filename="..."`                                   |
| `X-Pasco-Download-Count` | Updated pasco `downloadCount` after incrementing by file count |

Each file in the archive is named with its display order (e.g. `1. exam.pdf`). Download analytics: one `PascoDownload` row per file and `downloadCount` incremented by the number of files (same as downloading each file individually).

**Errors:**

- `400` — fewer than two files
- `401` — not signed in
- `404` — pasco, user, or file not found
- `429` — rate limit exceeded
- `500` — Cloudinary not configured
- `502` — could not prepare download

## Upload helpers

### `POST /api/cloudinary/sign`

Sign Cloudinary upload parameters for the widget.

**Auth:** Contributor+

**Rate limit:** 30 requests per 15 minutes per user

**Body:**

```json
{
  "courseId": "clx...",
  "fileName": "exam.pdf",
  "resourceType": "IMAGE"
}
```

**Response `200`:** Cloudinary signature payload (timestamp, signature, folder, etc.)

Files are uploaded to folder `unipascohub/pascos/{courseId}/`.

---

### `POST /api/pascos/files/compute-hash`

Compute SHA-256 content hash for an uploaded Cloudinary asset.

**Auth:** Contributor+

**Body:**

```json
{
  "courseId": "clx...",
  "publicId": "pascos/clx.../abc123",
  "fileName": "exam.pdf",
  "fileSize": 1048576,
  "fileUrl": "https://res.cloudinary.com/...",
  "resourceType": "IMAGE"
}
```

**Response `200`:** `{ "contentHash": "sha256hex..." }`

---

### `POST /api/pascos/files/check-duplicates`

Check content hashes against existing pasco files.

**Auth:** Contributor+

**Body:**

```json
{
  "courseId": "clx...",
  "contentHashes": ["sha256hex1", "sha256hex2"]
}
```

**Response `200`:**

```json
{
  "duplicates": [
    {
      "contentHash": "sha256hex1",
      "fileName": "exam.pdf",
      "pascoId": "clx..."
    }
  ],
  "message": "Optional human-readable summary"
}
```

## Pasco object shape

```json
{
  "id": "clx...",
  "courseId": "clx...",
  "academicYear": "2024/2025",
  "description": null,
  "educationLevel": "LEVEL_100",
  "semesterType": "FIRST_SEMESTER",
  "type": "END_OF_SEM",
  "contentType": "QUESTIONS_ONLY",
  "solutionCompleteness": null,
  "isComplete": true,
  "likeCount": 0,
  "dislikeCount": 0,
  "downloadCount": 0,
  "viewCount": 0,
  "files": [
    {
      "id": "clx...",
      "pascoId": "clx...",
      "order": 1,
      "fileName": "exam.pdf",
      "fileSize": 1048576,
      "fileUrl": "https://res.cloudinary.com/...",
      "resourceType": "IMAGE",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "createdAt": "...",
  "updatedAt": "...",
  "viewerReaction": null
}
```

Note: `publicId` and `contentHash` are not exposed in API responses.

`uploaderId` is omitted for anonymous viewers and other students. It is included when the authenticated viewer is the pasco uploader or a moderator/admin. Uploader names are never returned on public pasco endpoints; the moderation list (`GET /api/moderation/pascos`) includes `uploader: { id, name }` for staff review.

`uploader` (display name only, no `uploader.id`) is included on detail responses when the uploader account still exists; it is `null` or omitted when the account was removed. List/browse responses do not include `uploader`.
