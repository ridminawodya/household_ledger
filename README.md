# Household Ledger

A shared expense-and-chore tracker for roommates. Unlike most splitter apps (which only handle money) or chore apps (which only handle chores), this combines both, plus a free-text AI expense entry feature powered by Claude, an admin analytics dashboard, and a mock-then-real premium billing flow via Lemon Squeezy.

Built as a portfolio project to demonstrate full-stack fundamentals: relational data modeling, authentication (including OAuth), a genuine algorithm (not just CRUD), LLM API integration, third-party billing, file storage, and a real deployment.

**Live**: [household-ledger-plum.vercel.app](https://household-ledger-plum.vercel.app) (frontend) · backend on Railway · Postgres on Supabase

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Fast dev loop, type safety end to end |
| Styling | Tailwind CSS v4 | Utility-first, custom theme (navy palette, status colors, motion tokens) defined directly in CSS |
| Charts | Recharts | Admin dashboard trend/category charts |
| PDF export | jsPDF + html2canvas | Client-side monthly report generation, no backend rendering dependency |
| Backend | Node.js + Express + TypeScript | Simple, huge community support |
| Database | PostgreSQL (hosted on Supabase) | Data is inherently relational (groups → members → expenses → splits) |
| ORM | Prisma | Type-safe queries, schema doubles as documentation |
| File storage | Supabase Storage | Receipt photo uploads |
| Auth | JWT + bcrypt, plus Google OAuth 2.0 | Password auth implemented from scratch for the learning value; Google sign-in via the standard authorization-code flow |
| AI integration | Claude API (`@anthropic-ai/sdk`), model `claude-opus-5` | Structured extraction from free text |
| Billing | Lemon Squeezy (hosted checkout + webhooks) | Merchant-of-record subscription billing; chosen over Stripe because Stripe doesn't support account holders in every country this project needed |
| Mobile | Capacitor (Android) | Wraps the deployed web app in a native Android shell; OAuth and checkout are routed through the system browser rather than the in-app WebView, since Google blocks embedded WebViews for its login flow |
| Deployment | Vercel (frontend) + Railway (backend) + Supabase (Postgres + Storage) | Free-tier friendly, standard for portfolio projects |

## 2. What it does

**Core (free tier)**
- Sign up with email/password, or sign in with Google (both resolve to the same account if the email matches)
- Create or join a household group via a short invite code (free tier: 1 group, 4 members per group)
- Log an expense (amount, description, category) and it's split evenly among group members
- Log an expense in plain English — e.g. *"paid $85 for groceries and pizza last night"* — premium-gated; Claude parses it into a structured entry for the user to review and confirm before it's saved
- Recurring expenses (weekly/biweekly/monthly) — the next occurrence materializes automatically the next time any member opens the group, rather than via a background cron job (the free-tier host has no reliable always-on scheduler)
- Attach a receipt photo to any expense
- Edit or delete an expense (payer-only, soft delete so settle-up math and past reports stay consistent)
- Chores with due dates, an assignee, and completion status; a "whose turn" indicator, and optional auto-rotation that reassigns the next member in join order once a cycle completes
- A settle-up view showing the **minimum number of payments** needed to clear every debt, with an in-app "confirm payment" step to record that a payment happened (self-attested — no money actually moves through the app)
- Custom, per-group expense categories
- Group settings: rename, regenerate invite code, leave, remove a member, delete the group — all guarded so a member with an unsettled balance can't disappear from the ledger
- In-app notifications (expense added, chore assigned/completed)
- Downloadable PDF report of a group's full activity for any given month

**Premium**
- Unlimited groups and members
- AI-powered expense parsing

**Admin** (email allowlisted via `ADMIN_EMAILS`)
- Full-system dashboard: signups/expense/chore trend charts, expense breakdown by category, top groups/users by spend, paginated user and group directories, recent activity feed, premium conversion stats
- Read-only drill-through from the dashboard into any group's page, even without being a member

## 3. Database schema

```
User ──< GroupMember >── Group ──< GroupCategory
  │                         │
  ├──< Expense (paidBy) ────┤──< Chore ──< ChoreAssignment
  │       │                 │
  │       └──< ExpenseShare │
  │                         │
  ├──< Settlement (from/to) ┤
  │                         │
  └──< Notification ────────┘
```

- Money is stored as integer cents (`amountCents`), never floats — avoids floating-point rounding bugs in financial data
- `ExpenseShare` is a many-to-many join table: one row per (expense, user) pair, recording exactly how much of that expense each person owes
- `Expense` carries recurrence fields (`recurrenceFrequency`, `nextOccurrenceAt`, `recurrenceSourceId`) so a recurring series is just an expense that points at its own template, plus soft-delete (`deletedAt`) and edit tracking (`updatedAt`)
- `Settlement` records a self-attested payment between two members; the settle-up algorithm nets it against expense shares like a reverse expense
- `User.passwordHash` is nullable (Google-only accounts have no password); `User.googleId` is a unique nullable field; `User.plan`/`premiumSince` track billing state
- Full schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)

## 4. The debt-simplification algorithm

The technical centerpiece — the thing to walk an interviewer through.

**Problem:** across a group of *N* people with many shared expenses (and any payments already made toward settling up), who should pay whom, and how much, to settle everyone up? The naive answer ("everyone who owes someone pays them directly") can require up to *N×(N−1)* transactions.

**Approach** (implemented in [`backend/src/lib/settleUp.ts`](backend/src/lib/settleUp.ts)):

1. Net every user's balance: `balance = (total they paid) − (total they owe across all shares) + (payments they've made) − (payments they've received)`. Positive means they're owed money; negative means they owe money.
2. Greedily match the largest creditor with the largest debtor, settle the smaller of the two amounts between them, and repeat.

This is the same technique used by apps like Splitwise. It's provably optimal in transaction count: each match fully settles at least one person, so *N* people with nonzero balances resolve in at most *N−1* transactions — the theoretical minimum.

```ts
computeBalances(expenses, shares, settlements)  // -> [{ userId, amountCents }]
simplifyDebts(balances)                         // -> [{ fromUserId, toUserId, amountCents }]
settleGroup(expenses, shares, settlements)      // convenience: does both steps
```

## 5. AI expense parsing

`POST /ai/parse-expense` (premium-gated) — [`backend/src/routes/ai.ts`](backend/src/routes/ai.ts)

Sends the user's free-text message plus the group's member names to Claude (`claude-opus-5`) with a system prompt constraining the response to strict JSON:

```json
{ "description": "Groceries and pizza", "amountCents": 8500, "category": "groceries" }
```

Design choices worth mentioning in an interview:

- The endpoint only parses — it never writes to the database directly. The frontend shows the parsed result for the user to confirm/edit first, so a bad AI guess never silently corrupts financial data.
- The model is asked to return JSON only, no prose or markdown fences, to avoid brittle string-stripping.
- Failures (bad JSON, no amount found, model unreachable) return a clear error rather than guessing, since this touches money.

## 6. Authentication

Two independent sign-in paths that converge on the same `User` record and JWT session:

- **Email + password** — `bcrypt` hashing, JWT issued on signup/login, verified via middleware on every protected route.
- **Google OAuth 2.0** — standard authorization-code flow. `GET /auth/google` redirects to Google's consent screen; `GET /auth/google/callback` exchanges the code, verifies the ID token via `google-auth-library`, and finds-or-creates the user (linking to an existing password account by email if one already exists, rather than creating a duplicate). The callback redirects to the frontend with a short-lived token, which the frontend exchanges for the user's profile via `GET /auth/me`. On Android, this flow opens in the system browser rather than the in-app WebView (see §10).

Admin access is not a role on the `User` model — it's derived at request time from `ADMIN_EMAILS`, a comma-separated allowlist in the backend environment (`backend/src/lib/auth.ts`'s `isAdminEmail`). An admin login redirects to `/admin` instead of the regular groups view.

## 7. Billing

`POST /billing/checkout` creates a Lemon Squeezy hosted-checkout session (test mode) and redirects the user there; `POST /billing/webhook` verifies the request's HMAC signature and flips `User.plan` based on the subscription event. Premium status gates group/member limits (checked in `groups.ts`) and AI parsing (checked in `ai.ts`).

Stripe was the original choice but doesn't support account holders in every country this project needed, so billing runs through Lemon Squeezy, a merchant-of-record platform with broader country coverage.

## 8. API reference

All authenticated routes expect `Authorization: Bearer <token>`.

<details>
<summary>Auth — <code>/auth</code></summary>

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/signup` | – | Create account (email/password), returns JWT |
| POST | `/login` | – | Returns JWT |
| GET | `/me` | ✓ | Resolve the current JWT into a user profile |
| GET | `/google` | – | Redirects to Google's OAuth consent screen |
| GET | `/google/callback` | – | Google OAuth callback; issues a JWT and redirects to the frontend |

</details>

<details>
<summary>Groups — <code>/groups</code></summary>

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/` | ✓ | Create a group (creator auto-joins; blocked past the free-tier group limit) |
| POST | `/join` | ✓ | Join a group via invite code (blocked past the free-tier member limit) |
| GET | `/` | ✓ | List current user's groups |
| GET | `/:id` | ✓ | Group details + members (admins may view without membership) |
| PATCH | `/:id` | ✓ | Rename a group (creator only) |
| DELETE | `/:id` | ✓ | Permanently delete a group (creator only) |
| POST | `/:id/leave` | ✓ | Leave a group (blocked for the creator, or while a balance is unsettled) |
| DELETE | `/:id/members/:userId` | ✓ | Remove a member (creator only; same unsettled-balance guard) |
| POST | `/:id/regenerate-invite` | ✓ | Rotate the invite code, invalidating the old one (creator only) |
| GET | `/:id/categories` | ✓ | List a group's custom expense categories |
| POST | `/:id/categories` | ✓ | Add a category |
| DELETE | `/:id/categories/:categoryId` | ✓ | Remove a category |
| GET | `/:id/report?month=YYYY-MM` | ✓ | All expenses, settlements, and completed chores for one month (feeds the PDF export) |

</details>

<details>
<summary>Expenses & settle-up — <code>/expenses</code></summary>

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/` | ✓ | Create an expense, auto-split evenly (optionally recurring) |
| PATCH | `/:id` | ✓ | Edit an expense (payer only), reshares if the amount changes |
| DELETE | `/:id` | ✓ | Soft-delete an expense (payer only) |
| POST | `/:id/receipt` | ✓ | Upload a receipt photo (multipart), stores to Supabase Storage |
| GET | `/group/:groupId` | ✓ | List a group's expenses (materializes any due recurring instances first) |
| GET | `/group/:groupId/settle` | ✓ | Minimal settle-up transaction list |
| POST | `/settlements` | ✓ | Record a self-attested payment |
| GET | `/group/:groupId/settlements` | ✓ | Payment history for a group |

</details>

<details>
<summary>Chores — <code>/chores</code></summary>

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/` | ✓ | Create a chore for a group (optionally auto-rotating) |
| PATCH | `/:choreId` | ✓ | Toggle auto-rotation |
| GET | `/group/:groupId` | ✓ | List a group's chores with assignments (advances any due auto-rotations first) |
| POST | `/:choreId/assignments` | ✓ | Assign a chore to a member with a due date |
| POST | `/assignments/:assignmentId/complete` | ✓ | Mark a chore assignment complete |

</details>

<details>
<summary>AI, billing, notifications, admin</summary>

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/ai/parse-expense` | ✓ (premium) | Parse free text into a structured expense |
| POST | `/billing/checkout` | ✓ | Create a Lemon Squeezy checkout session |
| POST | `/billing/webhook` | – (HMAC-verified) | Lemon Squeezy subscription events |
| GET | `/notifications` | ✓ | List the current user's notifications |
| GET | `/notifications/unread-count` | ✓ | Unread count for the bell badge |
| POST | `/notifications/read-all` | ✓ | Mark all as read |
| POST | `/notifications/:id/read` | ✓ | Mark one as read |
| GET | `/admin/overview` | ✓ (admin) | Headline stats |
| GET | `/admin/trends` | ✓ (admin) | 30-day signup/expense/chore trend series |
| GET | `/admin/expense-categories` | ✓ (admin) | Spend by category, system-wide |
| GET | `/admin/activity` | ✓ (admin) | Recent expense/chore/settlement activity |
| GET | `/admin/top-groups` / `/admin/top-users` | ✓ (admin) | Ranked by spend |
| GET | `/admin/users` / `/admin/groups` | ✓ (admin) | Paginated directories |

</details>

## 9. Project structure

```
household-ledger/
├── backend/
│   ├── prisma/schema.prisma       # DB schema
│   ├── prisma/migrations/         # Applied migrations
│   └── src/
│       ├── index.ts               # Express app entry (billing webhook mounted
│       │                          #   before the JSON body parser — HMAC verification
│       │                          #   needs the raw body)
│       ├── lib/
│       │   ├── settleUp.ts        # debt-simplification algorithm
│       │   ├── recurrence.ts      # shared recurring-expense / chore-rotation math
│       │   ├── notifications.ts   # in-app notification creation helpers
│       │   ├── supabaseStorage.ts # receipt photo uploads
│       │   ├── lemonsqueezy.ts    # checkout session creation
│       │   ├── webhookSignature.ts
│       │   ├── plans.ts           # free/premium limits
│       │   ├── auth.ts            # JWT + bcrypt helpers, admin allowlist
│       │   └── prisma.ts          # Prisma client singleton
│       ├── middleware/
│       │   ├── requireAuth.ts
│       │   └── requireAdmin.ts
│       └── routes/
│           ├── auth.ts            # signup/login/me + Google OAuth
│           ├── groups.ts          # groups, settings, categories, monthly report
│           ├── expenses.ts        # expenses, receipts, settle-up, settlements
│           ├── chores.ts
│           ├── ai.ts              # AI parsing endpoint (premium-gated)
│           ├── billing.ts         # checkout session creation
│           ├── billingWebhook.ts  # Lemon Squeezy webhook receiver
│           ├── notifications.ts
│           └── admin.ts
└── frontend/
    ├── android/                   # Capacitor-generated native Android project
    ├── capacitor.config.json
    └── src/
        ├── App.tsx                # Route tree
        ├── components/
        │   ├── AppLayout.tsx      # Persistent nav shell + group switcher + notification bell
        │   ├── ProtectedRoute.tsx / AdminRoute.tsx
        │   ├── NotificationBell.tsx
        │   ├── NativeDeepLinkHandler.tsx  # routes an OAuth/checkout return back into the app on Android
        │   ├── AuthBackdrop.tsx   # Decorative background for auth pages
        │   └── GoogleIcon.tsx
        ├── lib/
        │   ├── api.ts             # Typed fetch client
        │   ├── AuthContext.tsx    # Auth state provider
        │   ├── money.ts           # Cents <-> dollars formatting helpers
        │   ├── monthlyReportPdf.ts# Client-side PDF generation (jsPDF)
        │   └── nativeBrowser.ts   # Opens OAuth/checkout in the system browser on native
        └── pages/
            ├── LandingPage.tsx
            ├── LoginPage.tsx / SignupPage.tsx
            ├── GoogleCallbackPage.tsx
            ├── GroupsPage.tsx / GroupDetailPage.tsx  # detail page = overview, settings, categories, monthly report
            ├── ExpensesPage.tsx
            ├── SettleUpPage.tsx
            ├── ChoresPage.tsx
            ├── BillingPage.tsx
            └── AdminDashboardPage.tsx
```

## 10. Local setup

Prerequisites: Node.js 18+, a PostgreSQL database (local, or free-tier Supabase), an Anthropic API key (optional — the app runs fully without one, AI parsing just returns a clear "not configured" error), and optionally Google OAuth and Lemon Squeezy credentials.

```bash
# Backend
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, and whichever
                             # optional integrations you want (see below)
npm install
npx prisma migrate deploy
npm run dev                 # runs on http://localhost:4000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # runs on http://localhost:5173
```

### Optional integrations

Each of these degrades gracefully when unset — the app runs fully without any of them, with that one feature returning a clear "not configured" error instead of crashing.

- **Google OAuth** — create a project in [Google Cloud Console](https://console.cloud.google.com), configure the OAuth consent screen, create a Web application OAuth client, add `http://localhost:4000/auth/google/callback` as an authorized redirect URI, and copy the Client ID/Secret into `backend/.env`.
- **Claude API** (`ANTHROPIC_API_KEY`) — powers AI expense parsing.
- **Lemon Squeezy** (`LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_PREMIUM_VARIANT_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`) — powers premium checkout. Test mode works end to end with no real charges.
- **Supabase Storage** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_RECEIPTS_BUCKET`) — powers receipt photo uploads. Needs a public bucket created in the Supabase dashboard.
- **`ADMIN_EMAILS`** — comma-separated list of emails granted access to `/admin`.

## 11. Android app (Capacitor)

The Android app is the same React frontend wrapped in a native shell via [Capacitor](https://capacitorjs.com) — it points at the deployed web app's API, not a separate codebase.

Two things needed native-aware handling:

- **Google OAuth** — Google actively blocks its login flow inside generic embedded WebViews. `frontend/src/lib/nativeBrowser.ts` opens the OAuth URL in the system browser (Chrome Custom Tabs) when running natively, and `NativeDeepLinkHandler.tsx` picks the flow back up when the browser redirects back into the app.
- **Lemon Squeezy checkout** — same treatment, for the same reason (a real browser context, not an embedded WebView).

```bash
cd frontend
npm run build              # produces dist/, which Capacitor packages into the app
npx cap sync android        # copies the fresh build into the native project
npx cap open android        # opens the project in Android Studio
```

From Android Studio, run the app on an emulator or physical device via the ▶ Run button. The Gradle JDK must be set to a JDK in the 8–24 range (Build, Execution, Deployment → Build Tools → Gradle in Settings) — Android Studio's own bundled JBR may be newer than Gradle supports, in which case a system-installed JDK (e.g. Oracle OpenJDK, "Detected SDKs" in that same dropdown) works.

## 12. Status

The application is feature-complete and deployed: full auth (password + Google), groups with settings and custom categories, expenses (even-split, editing, receipts, recurrence), the settle-up algorithm with payment confirmation, chores with auto-rotation, AI-assisted expense entry, premium billing, in-app notifications, monthly PDF reports, an admin analytics dashboard, and an Android app wrapping the deployed frontend. Backend runs on Railway's free tier, which can cold-start under a burst of concurrent requests — the admin dashboard's initial load retries once to absorb this.
