# Native Gallery Management Workspace Design

Date: 2026-09-22
Status: Chat design approved; written spec pending user review

## 1. Goal

Replace the current Gallery management experience built from a Blog-owned full-screen overlay plus a cross-origin Airi Gallery Cloud iframe with a native Blog management workspace at `/gallery/manage`.

The new management workspace must:

- look and behave like part of the Blog rather than a second embedded application;
- remove the nested overlay / iframe / Cloud modal architecture that currently creates visual clutter and z-index conflicts;
- manage only the fixed repository `Lidure/airi-gallery-images`, branch `main`;
- preserve the existing Gallery write capabilities that matter in daily use: connect with a GitHub token, upload one or many images, select or create a category, duplicate checking, browse categories, preview images, delete images, refresh/synchronize remote state, and report progress/errors;
- keep the GitHub token ephemeral and never persist it;
- retain the existing Cloud Worker only where it provides unique value for stable large-file blob uploads;
- keep the public `/gallery` page focused on browsing.

This is a management-architecture replacement, not a visual reskin of the old Airi Gallery Cloud UI.

## 2. Current problem

The existing Blog management flow uses `GalleryManager.astro` and `gallery-manager-controller.mjs` to create a fixed full-screen Blog overlay. When opened, that overlay inserts an iframe pointing at `https://airigallery.lidure22.xyz/`.

The iframe contains the complete legacy Cloud application, which has its own fixed image modal, confirmation overlay, toast layer, settings panel, upload interface, and browsing UI. Therefore management currently has two independent presentation stacks:

1. Blog overlay and Blog close/loading/error controls.
2. Cloud application overlays, dialogs, toasts, and page layout inside the iframe.

This produces unnecessary duplicated chrome, visual inconsistency, and confusing overlay behavior. The correct fix is to remove the iframe-management composition rather than continue tuning z-index values.

## 3. Selected architecture

### 3.1 Route model

Create a native Blog route:

`/gallery/manage`

The route is a standalone management workspace rendered through the normal Blog layout. It is not a modal, drawer, iframe, or overlay placed above `/gallery`.

Compatibility behavior:

- `/gallery?manage=1` navigates to `/gallery/manage`.
- `Ctrl+Alt+G` from `/gallery` navigates to `/gallery/manage`.
- Closing or leaving the management workspace navigates back to `/gallery`.
- The old iframe manager is removed from the public Gallery page.

### 3.2 Repository scope

The management workspace is intentionally fixed to:

- platform: GitHub
- owner: `Lidure`
- repository: `airi-gallery-images`
- branch: `main`
- image root: `gallery/`

The new UI must not expose platform, owner, repository, or branch fields. Supporting arbitrary GitHub/Gitee repositories is out of scope for the Blog-native manager.

The legacy Airi Gallery Cloud may remain available as an independent tool, but the Blog no longer embeds or depends on its UI.

### 3.3 Data-access model

Use a hybrid client architecture:

- public reads use the existing public manifest and image proxy where possible;
- authenticated GitHub reads/writes use the GitHub REST/Git Data APIs directly from the browser;
- the GitHub token exists only in the current JavaScript page runtime;
- large-file blob creation uses the existing Airi Gallery Cloud Worker streaming upload route because it already solves the browser-memory/base64 problem;
- the Cloud Worker does not become a general-purpose Gallery backend.

This preserves proven upload primitives while eliminating the old Cloud presentation layer.

## 4. Security model

### 4.1 Token lifecycle

The token is entered in the native management page through a Blog-owned connection dialog/panel.

The token must:

- live only in JavaScript memory for the current page lifecycle;
- never be written to `localStorage`;
- never be written to `sessionStorage`;
- never be written to cookies;
- never appear in a URL or query parameter;
- never be logged to the console or rendered back into the DOM after connection;
- be cleared when the page unloads, the controller is disposed, or the user explicitly disconnects.

Refreshing or reopening `/gallery/manage` returns the user to read-only mode.

### 4.2 Read-only mode

The page is useful without a token:

- categories and images can be viewed from the public manifest;
- image preview works;
- pagination and category filtering work;
- refresh re-fetches the public manifest.

Upload and delete actions are disabled or trigger the connection flow until a valid token is supplied.

### 4.3 GitHub connection validation

After token entry, validate access against the fixed repository before displaying `已连接 GitHub`.

Validation must distinguish at least:

- missing token;
- invalid/expired token;
- token accepted but repository write permission unavailable;
- network failure;
- GitHub rate limiting.

The UI must not persist the token after validation.

### 4.4 Browser connection policy

The native manager requires browser connections to:

- `https://api.github.com` for authenticated GitHub repository operations;
- `https://raw.githubusercontent.com` for public manifest fallback where already used;
- `https://airigallery.lidure22.xyz` for image proxying and the large-upload Worker route.

The Blog repository currently has no explicit `connect-src` rule that blocks these destinations, but implementation and deployment verification must still check the effective production CSP/Cloudflare policy. If a CSP is introduced or tightened, it must explicitly permit only the required connection origins rather than falling back to a broad wildcard.

The large-upload Worker must return CORS headers only for the allowed Blog origin and must not become a generic cross-origin GitHub proxy.

## 5. Page information architecture

### 5.1 Header / workspace bar

The top of `/gallery/manage` contains:

- title: `图库管理`;
- short description indicating the fixed `airi-gallery-images` repository;
- connection state: `只读` / `已连接 GitHub` / `同步中` / error state;
- `连接 GitHub` or `断开` action;
- `同步` action;
- `返回画廊` action.

This header is part of the page flow. It is not a fixed overlay.

### 5.2 Upload workspace

The upload area supports:

- drag and drop;
- file picker;
- multiple files;
- selecting an existing category;
- typing a new category;
- local previews;
- removing a pending file before upload;
- batch progress;
- per-file progress and retry.

The upload section should feel like a task workspace rather than the old Cloud settings/upload card stack.

Desktop layout may use a secondary column for upload controls while the Gallery manager occupies the main column. Mobile collapses to one column.

### 5.3 Gallery management area

The management browser contains:

- wrapped multi-row category filters;
- image count information;
- responsive thumbnail grid;
- pagination;
- image preview action;
- delete action;
- clear loading/error states.

The category treatment should visually align with the redesigned public Gallery rather than the legacy Cloud pink-pill interface.

### 5.4 Image cards

Each management image tile contains the image as the visual focus. Management actions appear without permanently covering the image:

- desktop: reveal `预览` and `删除` controls on hover/focus;
- touch: controls remain directly accessible without relying on hover;
- file/category metadata remains secondary.

A failed thumbnail shows a scoped retry state instead of breaking the grid.

## 6. Dialog system

Create one Blog-owned dialog foundation for Gallery management.

Supported dialog modes:

1. Token connection.
2. Image preview.
3. Delete confirmation.
4. Duplicate/similar-image comparison.

There must be no iframe-hosted dialogs and no nested modal-mask architecture.

Dialog requirements:

- one active dialog layer at a time;
- accessible `role="dialog"` and `aria-modal="true"`;
- Escape closes when safe;
- keyboard focus is trapped while open;
- focus returns to the invoking control after close;
- body/page scrolling is controlled by one mechanism;
- mobile viewport remains usable;
- reduced-motion preference is respected.

Delete confirmation must show the actual thumbnail, category, and filename.

Duplicate comparison must show the pending upload beside the matching/similar library image and include similarity metadata when available.

## 7. Read and synchronization flow

### 7.1 Initial read

On first load:

1. fetch the public Gallery manifest;
2. parse only safe `gallery/<category>/<filename>` image paths;
3. continue filtering internal staging names such as `.airi-renumber-*`;
4. populate categories and paginated cards;
5. remain in read-only state unless the user connects.

### 7.2 Public refresh

When disconnected, `同步` performs a forced no-cache manifest refresh and replaces the local read model only after successful parsing.

If refresh fails, retain the current usable state and show a recoverable error.

### 7.3 Authenticated synchronization

When connected, `同步` queries GitHub remote state for the fixed repository/branch and uses that result as the authoritative write-management view.

It must:

- reject stale completion if a newer sync has started;
- filter internal staging paths;
- reconcile pending upload/delete UI state with actual remote state;
- avoid replacing a newer successful state with an older request result.

After write operations, synchronization is used as verification rather than assuming a successful HTTP request means the Gallery is already in the expected final state.

## 8. Upload flow

### 8.1 File preparation

For each selected file:

1. validate supported image type;
2. validate file size against configured supported limits;
3. build local preview URL;
4. assign a stable pending-upload identity;
5. determine target category;
6. run exact/similar duplicate checks before committing.

The UI tracks per-file states:

- `等待`;
- `查重`;
- `待确认` when duplicate/similar candidates exist;
- `上传`;
- `提交`;
- `成功`;
- `失败`.

A failed file can be retried independently where transaction semantics permit.

### 8.2 Duplicate checking

Reuse the proven duplicate-checking behavior from the existing Cloud implementation rather than inventing a different policy.

Exact and similarity matches are presented through the native comparison dialog.

The user decides whether a non-blocking similar match should proceed. Existing hard duplicate rules remain authoritative where the current Gallery transaction layer defines them.

### 8.3 GitHub transaction model

Reuse/refactor the existing `upload_transaction.mjs` transaction concepts for:

- destination numbering/path selection;
- blob/tree/commit/ref update ordering;
- exact remote match checks;
- similar remote match checks;
- conflict/error reporting.

The Blog implementation should consume focused modules rather than copy the 69 KB legacy Cloud `app.js` wholesale.

### 8.4 Small/normal files

For files that can be uploaded safely through normal GitHub API requests, the browser performs authenticated GitHub API operations directly.

### 8.5 Large files

For files above the normal browser/GitHub JSON threshold, use the existing Cloud Worker streaming blob route.

The Worker must be changed so that:

- same-origin Cloud requests continue to work;
- `Origin: https://lidure22.xyz` is explicitly allowed;
- arbitrary origins remain rejected;
- Authorization is still mandatory;
- only the fixed repository target `Lidure/airi-gallery-images` is accepted for the Blog cross-origin path;
- upload encoding and size checks remain enforced;
- CORS response headers are returned only for the allowed Blog origin;
- preflight behavior is explicitly handled where needed.

The token is forwarded for the one upload request but is not stored by the Worker.

### 8.6 Completion verification

Do not mark a Gallery item fully successful merely because a blob was created.

A file is considered complete only after the transaction has updated the repository reference successfully and a subsequent remote synchronization confirms the final Gallery path.

If blob creation succeeds but commit/ref update fails, report the transaction failure without showing the image as live Gallery content.

## 9. Delete flow

Delete is available only in connected mode.

Flow:

1. user invokes `删除` on an image;
2. open native confirmation dialog with thumbnail, category, filename;
3. user confirms;
4. execute authenticated GitHub delete/commit transaction for the exact path;
5. temporarily mark the card as deleting rather than immediately pretending the operation is final;
6. synchronize remote state;
7. remove the card permanently only after the remote tree confirms absence.

If the delete fails or synchronization still shows the file, restore normal card state and present a retryable error.

Deletion must never be triggered by clicking the image itself.

## 10. Error handling

### 10.1 Global state

A lightweight workspace status component communicates:

- read-only mode;
- connected state;
- synchronization progress;
- repository/API connection problems.

It should not cover page content.

### 10.2 Local errors

Errors specific to an upload, thumbnail, delete, or retry remain next to the affected item.

Examples:

- thumbnail failed: card-level retry;
- one upload failed: file-row retry;
- delete conflict: card restored with error action;
- duplicate check failed: upload item remains pending rather than silently bypassing the check.

### 10.3 GitHub errors

Surface useful categories rather than generic `Request failed`:

- authentication failure;
- permission failure;
- rate limit;
- branch/ref conflict;
- transient network failure;
- Cloud Worker large-upload failure;
- synchronization mismatch.

Do not expose raw token-bearing request headers in user-facing or console errors.

## 11. Public Gallery integration

The public `/gallery` page remains read-oriented.

Remove the old iframe manager component from its rendered structure.

Management entry behavior:

- hidden query compatibility: `/gallery?manage=1` redirects/navigates to `/gallery/manage`;
- hidden keyboard compatibility: exact `Ctrl+Alt+G` navigates to `/gallery/manage`;
- normal visitors do not receive a prominent public admin button unless a later request adds one.

The public Gallery lightbox remains independent from management dialogs.

## 12. Legacy Cloud UI

The existing `https://airigallery.lidure22.xyz/` UI is not deleted as part of this project.

It may continue to exist as a standalone fallback/maintenance tool.

However:

- Blog must not iframe it;
- Blog must not depend on its DOM;
- Blog must not depend on its settings panel or modal behavior;
- its `app.js` is treated as a source of proven domain logic to extract/reuse, not as the new UI controller.

Future removal of the legacy Cloud UI is a separate task.

## 13. Module boundaries

The implementation should prefer focused modules with explicit responsibilities.

Suggested Blog-side boundaries:

- `GalleryManagePage.astro` or route composition: static page structure only;
- management controller: page lifecycle and high-level orchestration;
- GitHub client: authenticated repository/tree/blob/commit/ref/delete API calls for the fixed repository;
- management data model: normalize remote paths/categories/pages;
- upload queue/state module: per-file state transitions and retry rules;
- duplicate-check adapter: exact/similar match orchestration using extracted existing logic;
- dialog controller: one active Blog-native dialog system;
- large-upload client: calls the Cloud Worker streaming route;
- management styles: isolated Blog-native workspace styles.

Avoid one new monolithic `app.js` equivalent.

Cloud-side changes should remain narrowly scoped to the Worker and tests needed for the allowed Blog large-upload origin.

## 14. Responsive behavior

Desktop:

- management workspace may use a main Gallery region with a narrower upload/task region;
- category filters wrap across multiple rows;
- image grid uses available width without page overflow.

Tablet:

- reduce column count and allow upload controls to stack above Gallery management as needed.

Mobile:

- single-column workspace;
- two-column image grid where practical;
- upload drop zone remains touch friendly;
- management actions do not require hover;
- dialogs fit within viewport and scroll internally when content is tall.

No management layout may create horizontal document overflow.

## 15. Accessibility

Minimum requirements:

- all icon-only controls have accessible names;
- keyboard navigation reaches upload, category, image actions, pagination, connection, and sync controls;
- dialog focus is trapped and restored;
- status updates that materially affect an operation use appropriate live/status semantics without excessive announcements;
- drag/drop has an equivalent file-picker path;
- destructive action confirmation is keyboard usable;
- visible focus treatment matches Blog design tokens;
- reduced-motion preference disables nonessential animation.

## 16. Testing strategy

### 16.1 Unit tests

Cover pure logic including:

- safe Gallery path validation;
- `.airi-renumber-*` filtering;
- category grouping and pagination;
- fixed repository endpoint generation;
- token state never serialized/persisted;
- upload state transitions;
- retry eligibility;
- delete reconciliation;
- stale-sync rejection;
- duplicate-check mapping.

### 16.2 Controller/DOM tests

Cover:

- initial read-only mode;
- token connection and disconnect;
- no token persistence calls;
- write actions gated behind connection;
- drag/drop and file picker produce equivalent queue entries;
- category selection/new-category input;
- duplicate comparison flow;
- delete confirmation flow;
- scoped failure/retry UI;
- compatibility navigation for `?manage=1` and `Ctrl+Alt+G`;
- no iframe manager is created.

### 16.3 Worker tests

Cover:

- existing same-origin large upload still works;
- `Origin: https://lidure22.xyz` is permitted for the designated large-upload route;
- preflight returns the correct restricted CORS headers;
- other origins are rejected;
- missing/invalid Authorization is rejected;
- wrong repository target is rejected for Blog cross-origin requests;
- oversized/invalid streams remain rejected;
- token is only forwarded upstream and is never persisted.

### 16.4 Browser regression

Build the Blog and run a real browser against `/gallery/manage` at desktop and mobile-sized viewports.

Verify at minimum:

- route loads without iframe;
- old `.gallery-manager-overlay` structure is absent;
- page has no horizontal overflow;
- category filters wrap normally;
- read-only Gallery content loads;
- connection dialog is a single Blog-owned layer;
- preview/delete/duplicate dialogs do not stack incompatible masks;
- keyboard Escape/focus restoration works;
- mobile controls are reachable without hover;
- effective production connection policy allows the required GitHub and Cloud origins without broadening unrelated CSP destinations.

Where safe test credentials are unavailable, authenticated GitHub mutation behavior is validated with unit/integration mocks and existing Cloud transaction tests rather than embedding real secrets into CI.

## 17. Migration sequence

Implementation should be staged so the public Gallery remains usable throughout:

1. extract/refactor reusable upload/duplicate primitives as needed without changing legacy Cloud behavior;
2. extend the Cloud Worker large-upload route with tightly scoped Blog-origin support and tests;
3. build native `/gallery/manage` in the Blog with read-only browsing first;
4. add ephemeral token connection and authenticated sync;
5. add native upload queue and duplicate flow;
6. add native delete flow;
7. switch `?manage=1` and `Ctrl+Alt+G` to the new route;
8. remove old Blog iframe manager component/controller/styles and related tests;
9. run full Blog and Cloud regression plus browser layout verification.

## 18. Non-goals

This project does not:

- add user accounts or server-side Blog authentication;
- persist GitHub tokens;
- support arbitrary GitHub/Gitee repositories in the native Blog manager;
- migrate the entire legacy Cloud application into the Blog;
- delete the standalone Airi Gallery Cloud UI;
- redesign the public Gallery again beyond management-entry compatibility;
- change the underlying image repository structure outside what existing upload/delete transactions require.

## 19. Acceptance criteria

The design is complete when the implementation satisfies all of the following:

1. `/gallery/manage` exists as a native Blog page.
2. No iframe is used for management.
3. No Blog full-screen manager overlay is used.
4. The fixed repository is `Lidure/airi-gallery-images/main` with no generic repository configuration UI.
5. Anonymous users can browse the management page in read-only mode.
6. GitHub Token exists only in current-page memory and disappears on refresh/leave/disconnect.
7. Connected users can upload multiple images, select/create categories, receive duplicate checks, see per-file progress, and retry eligible failures.
8. Connected users can delete images through a native confirmation dialog and remote-state verification.
9. Large uploads retain the existing Cloud Worker streaming mechanism with narrowly scoped `https://lidure22.xyz` cross-origin support.
10. Public `/gallery?manage=1` and `Ctrl+Alt+G` navigate to `/gallery/manage`.
11. The old Blog iframe manager code is removed.
12. Management dialogs use a single Blog-owned dialog layer with no nested Cloud modal system.
13. Desktop and mobile management layouts have no document-level horizontal overflow.
14. Blog and Cloud automated tests pass, including new security and regression coverage.
15. Browser verification confirms the production-shaped build has no iframe/old manager overlay and that the native management workspace is usable at desktop and mobile widths.
16. Production connection policy permits only the required GitHub/Cloud origins needed by the native manager and does not rely on a wildcard CSP allowance.
