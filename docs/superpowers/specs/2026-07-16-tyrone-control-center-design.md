# Tyrone Control Center – Design Specification

**Status:** Approved design  
**Date:** 2026-07-16  
**Target repository:** `TyroneHP/tyrone-control-center`  
**Deployment target:** GitHub Pages + Supabase  
**Primary client:** Responsive web app / installable PWA for desktop and iPhone

## 1. Product goal

Tyrone Control Center is a private, Slate-style personal organization platform for up to ten accounts: one administrator and up to nine invited users. It combines calendar, tasks, school, technician project work, training, nutrition, files, collaboration, notifications, and a provider-independent AI chat.

The product should feel like a polished native app while remaining deployable as a static React application on GitHub Pages. User data, authentication, storage, server-side logic, notifications, and AI orchestration are handled through Supabase.

The defining principles are:

1. **One source of truth:** An item created in one area appears automatically in every relevant view.
2. **Private by default:** Data is visible only to its owner unless explicitly shared.
3. **No silent AI writes:** AI-generated changes are shown as a preview and require confirmation.
4. **Bring your own AI key:** Each user uses and pays for their own provider account.
5. **Slate experience everywhere:** Desktop and mobile use one coherent dark Navy/Slate visual language.
6. **Recoverability:** Important data and file versions are traceable and restorable.

## 2. Scope decomposition

The complete Version 1 is large and will be delivered as five deployable milestones. Each milestone must leave the application in a working state.

### Milestone 1 – Foundation

- React, TypeScript, Vite project
- Slate design system and responsive shell
- GitHub Pages deployment workflow
- Supabase project configuration
- E-mail/password login
- Administrator-controlled invitations
- Maximum of ten occupied or reserved accounts
- User profiles, settings, RLS baseline, audit baseline
- PWA shell and offline application loading

### Milestone 2 – Core productivity

- Unified item model
- Overview dashboard
- Week, day, month, and year calendar views
- Tasks in list, Kanban, and calendar views
- School, technician project, training, and nutrition modules
- Drag-and-drop and calendar resize
- Recurrence, reminders, subtasks, progress, filters
- Search and activity history

### Milestone 3 – Collaboration and notifications

- Private-by-default sharing
- View/edit permissions per item, project, calendar, and file
- Main responsible user and contributors
- Per-share notification settings
- Supabase Realtime updates
- Browser push on desktop and installed iPhone PWA
- Offline mutation queue and conflict handling

### Milestone 4 – AI chat and memory

- Separate AI chat area
- Per-user provider credentials
- OpenAI, Anthropic, Google Gemini, DeepSeek, and OpenRouter adapters
- User-selected default model and optional performance model
- Complexity warning before switching models
- Read tools and confirmation-gated write proposals
- Chat history
- Suggested long-term memories requiring confirmation
- Memory management and stale/conflicting memory handling
- Usage and cost estimates

### Milestone 5 – Files and versioning

- Personal and shared file library
- Temporary or permanent upload choice
- Folders, tags, links to items/projects/school subjects
- Content extraction and search
- AI analysis and supported file transformations
- Preview-first editing workflow
- File versions, pinned versions, restore, compare
- Maximum 20 unpinned versions per file
- User-configurable temporary-file retention

## 3. Technology architecture

### 3.1 Frontend

- React with TypeScript
- Vite build system
- React Router for application navigation
- TanStack Query for server state and caching
- Supabase JavaScript client for Auth, Database, Storage, Realtime, and Functions
- FullCalendar React for day/week/month/year calendar views, drag-and-drop, and resizing
- dnd-kit for Kanban and non-calendar drag-and-drop
- React Hook Form and Zod for forms and validation
- IndexedDB through a small repository abstraction for offline cache and queued mutations
- `vite-plugin-pwa` or an equivalent standards-based PWA setup
- Vitest, React Testing Library, and Playwright

The frontend is static and must not contain service-role credentials, AI provider keys, encryption keys, or VAPID private keys.

### 3.2 Backend

Supabase provides:

- Auth for e-mail/password login and password reset
- Postgres database
- Row Level Security
- Storage buckets
- Realtime subscriptions
- Edge Functions for privileged logic and external API calls
- Scheduled jobs for reminder delivery and cleanup

Edge Functions authenticate user requests and perform privileged work only after authorization checks. Long-running or unsupported binary conversions must fail safely with a clear capability message rather than timing out silently.

### 3.3 Deployment

- Source repository: public GitHub repository because personal data and secrets are never committed
- SPA routing: React Router with the GitHub Pages project base path and a committed `404.html` redirect fallback
- CI: GitHub Actions
- Static app: GitHub Pages
- Backend/migrations/functions: Supabase
- Environment-specific public configuration supplied during build through GitHub Actions variables/secrets
- Secret values are stored only in GitHub Actions secrets where required for deployment or in Supabase function secrets for runtime use

### 3.4 Architectural boundaries

The implementation is divided into isolated modules:

- `auth`: login, session, invitations, account capacity
- `items`: unified item CRUD and subtype details
- `calendar`: views, recurrence, drag/resize
- `tasks`: list, Kanban, subtasks, progress
- `collaboration`: sharing, assignments, permissions
- `notifications`: reminders, push subscriptions, delivery
- `ai`: chats, providers, tools, proposals, memories, usage
- `files`: upload, metadata, extraction, versions, compare
- `offline`: cache, queue, reconciliation, conflicts
- `audit`: activity events and user-visible history

No feature module may bypass the central authorization and audit services.

## 4. Visual design

### 4.1 Direction

The complete application follows the accepted Slate-inspired mockup:

- Dark Navy background
- Slightly lighter blue than the original Slate concept
- Glass-like cards with restrained transparency
- Rounded corners
- Low-contrast borders
- Soft shadows
- Clear white typography
- Bright blue primary controls
- Compact but readable information density
- Subtle motion rather than gaming/cyberpunk effects

### 4.2 Initial design tokens

These tokens are implementation defaults and may be fine-tuned while preserving the approved visual direction:

```css
--color-bg: #071526;
--color-bg-elevated: #0c2545;
--color-surface: #122d4f;
--color-surface-soft: #193458;
--color-primary: #326ac1;
--color-primary-hover: #3f7bd6;
--color-text: #f4f7fb;
--color-text-muted: #a9b6c6;
--color-border: rgba(169, 182, 198, 0.16);
--radius-card: 18px;
--radius-control: 12px;
```

Category colors must remain distinguishable in dark mode and pass accessible contrast checks. Color is never the only indicator; icons or labels accompany it.

### 4.3 Navigation

Desktop:

- Persistent left sidebar
- Main content area
- Optional right-side contextual panel for overview/day status

Mobile:

- Bottom navigation for the most-used destinations
- Additional destinations in a “More” menu
- Safe-area support for iPhone

Primary destinations:

- Overview
- Calendar
- Tasks
- Technician project
- School
- Training
- Nutrition
- Files
- AI chat
- Settings

### 4.4 Overview page

Desktop layout:

- Large week calendar on the left
- Compact daily status panel on the right

Daily status includes:

- next appointment
- open and overdue tasks
- planned training
- nutrition summary
- technician project progress
- relevant reminders

Mobile layout stacks the daily status above or below a compact week agenda without horizontal page overflow.

## 5. Identity and account rules

### 5.1 Account limit

- Maximum ten occupied or reserved account slots
- First account becomes administrator
- No public registration
- Additional users join only through invitation
- Removing a profile frees one account slot
- Account-capacity enforcement occurs server-side in a transaction

### 5.2 Authentication

- E-mail and password
- E-mail verification
- Password reset
- Persistent trusted-device sessions
- User can sign out current session or all sessions

Initial bootstrap is explicit: the deployment defines one `BOOTSTRAP_ADMIN_EMAIL`. Before an administrator profile exists, only that exact verified address may complete registration. After the administrator profile is created, bootstrap registration closes permanently and all further accounts require invitations.

### 5.3 Account removal

Removing an account is a server-side deactivation workflow, not an immediate uncontrolled delete:

- access and active sessions are revoked immediately
- the active-account slot is freed immediately
- shared items owned by the removed user must be transferred to an eligible collaborator or archived before final deletion
- private data enters a 30-day deletion grace period
- the removed user may be restored during the grace period by the administrator
- after the grace period, private database records and storage objects are deleted by an audited scheduled job

The administrator can see counts and transfer requirements but does not receive automatic access to private content.

### 5.4 Roles

- `admin`: invitations, user removal, account limit, global app settings
- `member`: own data and explicitly shared data

Admin status does not automatically grant access to another user’s private content. Administrative access to private data is not exposed through the application UI.

## 6. Unified data model

### 6.1 Core item

All date-bearing and task-like records use a shared `items` base table.

Common fields:

- `id`
- `owner_id`
- `kind`: appointment, task, school, technician, training, nutrition
- `title`
- `description`
- `start_at`
- `end_at`
- `all_day`
- `timezone`
- `status`: open, in_progress, blocked, completed
- `progress_percent`
- `priority`
- `category_color`
- `recurrence_rule`
- `project_id`
- `visibility`
- `version`
- `created_at`, `updated_at`, `completed_at`

Subtype tables contain fields that do not belong in the common model, for example training metrics or nutrition targets.

### 6.2 Related structures

- `subtasks`
- `item_assignees`
- `item_contributors`
- `reminders`
- `projects`
- `project_members`
- `shares`
- `comments`
- `attachments`
- `activity_log`

### 6.3 One-record behavior

A school task with a due date is one item that appears in:

- School
- Task list
- Kanban
- Calendar
- Overview
- Notifications

Edits in any view update the same record.

## 7. Calendar and tasks

### 7.1 Calendar views

- Day
- Week
- Month
- Year

Filters:

- appointment
- task
- school
- technician project
- training
- nutrition
- owner/shared scope
- status

### 7.2 Interaction

Users can create an entry through:

- global plus button
- clicking/dragging an empty calendar range
- AI chat proposal

Users can:

- open details by clicking an entry
- drag to a new time/date
- resize timed entries
- edit recurrence
- duplicate
- share
- attach files
- configure reminders

### 7.3 Tasks

Views:

- List
- Kanban
- Calendar

Task fields include:

- status
- progress percent
- subtasks
- due date/time
- priority
- responsible user
- contributors
- reminders
- project link
- files

Project progress is calculated from weighted task/subtask completion. A manual override is allowed and must be clearly marked.

## 8. Module behavior

### 8.1 Technician project

- Target hours and logged hours
- Milestones
- Work packages
- Linked tasks/files/notes
- Progress chart
- Weekly time log
- Due dates in the global calendar

### 8.2 School

- Subjects
- Assignments
- Exams
- Learning goals
- Files and notes
- Due dates in the global calendar

### 8.3 Training

- Planned sessions
- Session templates
- Completion status
- Notes and optional performance values
- Calendar integration

### 8.4 Nutrition

The first release is organizational, not a full meal-tracking replacement:

- Daily target summary
- Planned entries
- Notes
- Optional calories and macronutrients
- Calendar visibility

The architecture allows later connection to Mahlora without making that integration part of Version 1.

## 9. Sharing and collaboration

### 9.1 Default behavior

All content is private unless explicitly shared.

### 9.2 Permissions

When sharing, the owner selects:

- viewer
- editor

The owner can revoke or change access at any time.

### 9.3 Responsibility

A shared task may have:

- one main responsible user
- zero or more contributors

### 9.4 Notification settings

Per shared area or item:

- all changes
- important changes only
- none

Important changes include deletion, reassignment, due-date movement, status change, and access changes.

### 9.5 Audit

The activity log records:

- actor
- action
- object
- timestamp
- before/after summary where appropriate
- source: UI, offline synchronization, AI-confirmed action, scheduled process

## 10. Notifications and PWA

### 10.1 Reminder options

Each item supports zero or more reminders:

- 15 minutes before
- one hour before
- previous evening
- same morning
- custom timestamp

### 10.2 Push delivery

- Standard Web Push
- Service worker receives and displays notifications
- iPhone users install the app to the Home Screen and grant permission through an explicit button action
- Subscriptions are stored per user and device
- Users can disable individual devices

### 10.3 Scheduling

A scheduled backend job finds due notifications and queues deliveries. Delivery must be idempotent to avoid duplicate pushes.

### 10.4 PWA behavior

- Installable manifest
- App icon and splash metadata
- Full-screen standalone mode
- Cached application shell
- Read-only access to recently loaded data while offline
- Offline writes queued in IndexedDB
- Background or next-launch synchronization

## 11. Offline and conflict handling

Every mutable record has a numeric version.

An offline mutation includes:

- record ID
- expected version
- patch
- local timestamp
- client mutation ID

On synchronization:

- matching version: apply once and increment version
- mismatched version: create conflict record
- duplicate mutation ID: return previous result without repeating the action

Conflict UI shows both variants and allows:

- keep server version
- apply local version
- manually merge

No variant is silently discarded.

## 12. AI provider system

### 12.1 Supported providers

- OpenAI
- Anthropic
- Google Gemini
- DeepSeek
- OpenRouter

Each provider is implemented behind a common adapter interface:

```ts
interface AiProviderAdapter {
  testConnection(config: ProviderConfig): Promise<ConnectionResult>;
  listModels(config: ProviderConfig): Promise<ModelInfo[]>;
  createResponse(request: UnifiedAiRequest): Promise<UnifiedAiResponse>;
  supports(capability: AiCapability, model: string): boolean;
}
```

Model lists are fetched from provider APIs when supported and cached. The UI filters models by required capabilities such as tools, vision, files, or structured output.

### 12.2 User configuration

Each user chooses:

- provider
- API key
- default model
- optional performance model

The selected default model remains active until changed.

### 12.3 Complexity warning

The application performs a local/server-side complexity check based on prompt length, requested operation, file size/type, number of records, and reasoning indicators.

When the request appears complex:

> This request is more demanding. The performance model may produce a better result and may cost more.

Actions:

- use performance model
- stay with default model

The application never changes to a more expensive model without user confirmation.

### 12.4 Provider credentials

Provider keys are:

- submitted only over HTTPS to an authenticated Edge Function
- encrypted server-side using an application encryption key stored as a Supabase function secret
- stored as ciphertext with nonce and authentication tag
- inaccessible to normal client database roles
- decrypted only for the requesting user’s provider call
- never returned in full after saving
- redacted from logs and errors

Each request uses the currently authenticated user’s own credential. No user can consume another user’s key.

## 13. AI chat and tool execution

### 13.1 Chat behavior

The AI chat can:

- answer general questions
- query the user’s accessible dashboard data
- summarize projects and schedules
- analyze files
- propose tasks, appointments, notes, progress changes, and reminders
- suggest memories

### 13.2 Tool classes

Read-only tools may execute immediately after authorization:

- list/search items
- retrieve project progress
- retrieve schedule
- retrieve accessible file metadata/content extracts
- retrieve memories

Mutation tools never write immediately. They return a structured proposal:

- create item
- update item
- complete item
- move item
- share item
- add project hours
- create memory
- delete/archive item
- create file version

### 13.3 Confirmation workflow

1. Model requests a mutation tool.
2. Backend validates schema and permissions.
3. Backend creates an expiring proposal without applying it.
4. UI renders human-readable before/after preview.
5. User confirms, edits, or cancels.
6. Confirmation endpoint revalidates current permissions and versions.
7. Mutation is applied transactionally.
8. Activity event is written.
9. AI receives the result and replies.

Destructive operations use an additional warning and explicit action label.

### 13.4 Cost awareness

Store per-request usage when returned by providers:

- provider
- model
- input/output tokens or units
- estimated cost using a dated pricing snapshot
- file-processing estimate

Users may set warning and stop thresholds. Dashboard limits are best-effort safeguards and do not replace provider billing limits.

## 14. Chat history and long-term memory

### 14.1 Chat history

- Multiple named conversations
- Search
- Archive/delete
- Optional project association
- Messages scoped to the owning user unless chat is explicitly shared

### 14.2 Memory proposal

The AI never silently creates long-term memory.

It may show:

> Suggested memory: “The user prefers code explanations with the relevant code snippet directly beside the explanation.”

Actions:

- save
- edit
- reject

### 14.3 Memory fields

- statement
- category
- scope
- source chat/message
- created/confirmed date
- last used date
- freshness type: stable or time-sensitive
- status: active, superseded, deleted

### 14.4 Conflicts and staleness

- New information that conflicts with active memory triggers a clarification/proposal.
- Time-sensitive memories may be flagged for reconfirmation.
- Users can inspect, edit, export, and delete memories.

## 15. Files and document processing

### 15.1 Upload modes

At upload time:

- temporary for this chat
- permanent library file

Temporary retention is user-configurable:

- 24 hours
- 7 days default
- 30 days
- custom duration

Options:

- delete immediately when chat is deleted
- warn before expiry
- convert temporary file to permanent

### 15.2 Library organization

- folders and subfolders
- tags
- categories
- links to project, task, school subject, technician project, or chat
- personal/shared filters
- search by filename, metadata, extracted text, tags, and generated summary

### 15.3 Storage model

- Private Supabase Storage buckets
- Object paths include owner ID and immutable version ID
- Signed URLs with short expiration
- File metadata in Postgres
- RLS and backend checks for shares

### 15.4 Supported analysis

Initial file types:

- PDF
- PNG/JPEG/WebP
- DOCX
- XLSX
- CSV
- TXT/Markdown

The system detects the selected model’s capabilities before sending content. Unsupported combinations produce a model-change suggestion before incurring a provider request.

### 15.5 Supported editing semantics

“Edit” means producing a new version, never silently changing the stored original.

Capability matrix for Version 1:

- TXT/Markdown: full text replacement and diff
- CSV: structured row/column changes and diff
- XLSX: supported cell, formula, sheet, and formatting operations through a spreadsheet adapter
- DOCX: supported paragraph, heading, table, and basic formatting operations through a document adapter
- PDF: merge, split, reorder, annotate, redact, fill, and regenerated-document workflows; arbitrary pixel-perfect editing of every PDF object is not guaranteed
- Images: provider-supported generation/editing produces a new image version

Before processing, the UI states the exact operation that will be performed.

### 15.6 Versioning

Each file has:

- immutable original version
- immutable confirmed versions
- creator/editor
- timestamp
- change description
- source: manual, AI-assisted, restored
- optional pin

Retention:

- maximum 20 unpinned versions per file
- pinned versions do not count toward automatic removal
- restoring creates a new head version
- old unpinned versions are removed oldest-first after a successful new version write

### 15.7 Comparison

- Text/DOCX: semantic text diff plus structure summary
- CSV/XLSX: cell-level comparison
- PDF/image: side-by-side versions and metadata summary

## 16. Security model

### 16.1 Database

- RLS enabled for every client-accessible table
- Deny by default
- Ownership and share policies
- Service-role operations limited to audited Edge Functions
- Explicit grants rather than relying only on RLS

### 16.2 Storage

- Private buckets
- Signed URLs
- Path and ownership validation
- Content type and size allowlist
- Malware scanning hook reserved in architecture; until implemented, downloaded user files are treated as untrusted

### 16.3 Edge Functions

- User JWT required for user actions
- Request schema validation
- Per-user rate limiting
- Permission revalidation before writes
- Idempotency for confirmations, notifications, and offline sync
- Secret redaction
- Strict CORS allowlist for production origin

### 16.4 AI safety boundary

- Models never receive service-role keys or raw database credentials
- Models suggest tools; application code executes them
- Tools are allowlisted and schema-validated
- Read results are minimized to the current request
- Mutations require confirmation
- File and data access respects the same permissions as the user

## 17. Error handling

User-facing errors must state:

- what failed
- whether data was changed
- what the user can do next

Required error cases:

- expired session
- account capacity reached
- invitation invalid/expired
- permission revoked during edit
- offline queue conflict
- provider key invalid
- provider rate limit or insufficient balance
- model missing required capability
- file too large or unsupported
- notification permission denied
- push subscription expired
- deployment/configuration missing

Sensitive internal details are logged only in redacted form.

## 18. Testing strategy

### 18.1 Unit tests

- validation schemas
- recurrence calculations
- progress calculations
- permission decisions
- complexity warnings
- provider response normalization
- cost estimates
- version retention
- offline conflict detection

### 18.2 Component tests

- navigation/responsive behavior
- calendar filters
- task forms
- confirmation previews
- memory proposals
- provider settings
- file version UI

### 18.3 Integration tests

Using a test Supabase project/local stack:

- RLS isolation between users
- invitation and ten-account limit
- share permissions
- Edge Function authentication
- encrypted provider-key lifecycle
- AI proposal then confirm
- notification scheduling idempotency
- temporary file cleanup

### 18.4 End-to-end tests

- first admin signup
- fill ten occupied or reserved slots and reject the eleventh slot
- create school task and observe all synchronized views
- drag calendar item and verify audit
- share item as viewer/editor
- offline edit and conflict resolution
- configure provider, chat, propose mutation, confirm
- upload temporary/permanent files
- create and restore versions
- install PWA and enable push where browser automation supports it

### 18.5 Security tests

- attempt cross-user reads/writes
- attempt direct access to credential ciphertext
- tampered proposal confirmation
- expired signed URL
- service-role key absent from production bundle
- secret-pattern scan on repository and build artifact

## 19. Acceptance criteria for Version 1

Version 1 is complete when:

1. Ten-account invitation limit is enforced server-side.
2. Users can only access their private and explicitly shared data.
3. The overview, calendar, task views, and four domain modules use the unified item source.
4. Calendar day/week/month/year views support create, edit, drag, and resize.
5. Tasks support list, Kanban, calendar, status, percentage, subtasks, responsible user, and contributors.
6. Browser push reminders work on supported desktop browsers and installed supported iPhone PWAs.
7. Offline cached viewing and queued edits work, with visible conflict resolution.
8. Each user can configure one of the supported AI providers with their own encrypted credential.
9. The AI can read permitted data and produce mutation proposals, but cannot write before confirmation.
10. Chat history and confirmation-based memories work.
11. Files can be temporary or permanent, private or shared, organized and searched.
12. Supported file transformations create new versions with comparison and restore.
13. Twenty-version retention and pinning are enforced safely.
14. The app deploys automatically to GitHub Pages and functions correctly at the repository subpath.
15. Automated tests and security checks pass.

## 20. Explicitly out of scope for Version 1

- Google Calendar synchronization
- Apple Calendar synchronization
- Native iOS application
- Public registration
- More than ten occupied or reserved accounts
- Shared use of another user’s AI key
- Automatic AI writes without confirmation
- Arbitrary unrestricted code execution by the AI
- Guaranteed pixel-perfect editing of every possible PDF or Office document
- Full Mahlora data integration

## 21. Initial repository structure

```text
/
├─ .github/workflows/
│  ├─ ci.yml
│  └─ deploy-pages.yml
├─ docs/
│  └─ superpowers/specs/
│     └─ 2026-07-16-tyrone-control-center-design.md
├─ public/
│  ├─ icons/
│  └─ manifest assets
├─ src/
│  ├─ app/
│  ├─ components/
│  ├─ design-system/
│  ├─ features/
│  │  ├─ auth/
│  │  ├─ overview/
│  │  ├─ calendar/
│  │  ├─ tasks/
│  │  ├─ technician/
│  │  ├─ school/
│  │  ├─ training/
│  │  ├─ nutrition/
│  │  ├─ collaboration/
│  │  ├─ notifications/
│  │  ├─ ai/
│  │  ├─ files/
│  │  └─ settings/
│  ├─ lib/
│  ├─ offline/
│  ├─ routes/
│  └─ test/
├─ supabase/
│  ├─ functions/
│  ├─ migrations/
│  ├─ seed.sql
│  └─ config.toml
├─ .env.example
├─ .gitignore
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ README.md
```

## 22. Design validation summary

- No public registration: confirmed.
- Maximum accounts: ten including the administrator, confirmed.
- Data-sharing default: private, confirmed.
- Share permission chosen per share: confirmed.
- AI writes: preview and confirmation, confirmed.
- AI memory: suggested and confirmation-based, confirmed.
- AI key ownership: separate per user, confirmed.
- Providers: OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter, confirmed.
- Calendar synchronization with Google/Apple: excluded, confirmed.
- Entire interface: lighter-blue Slate design, confirmed.
- Navigation: desktop left sidebar, mobile bottom navigation, confirmed.
- Overview: large week calendar left, daily status right, confirmed.
- Notifications: all categories configurable, confirmed.
- File retention and version rules: confirmed.

The design is internally consistent and implementation must proceed milestone by milestone while preserving the final Version 1 acceptance criteria.
