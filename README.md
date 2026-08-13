# Household Ledger

A shared expense-and-chore tracker for roommates. Unlike most splitter apps (which only handle money) or chore apps (which only handle chores), this combines both, plus a free-text AI expense entry feature powered by Claude.

Built as a portfolio project to demonstrate full-stack fundamentals: relational data modeling, authentication (including OAuth), a genuine algorithm (not just CRUD), and LLM API integration.

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Fast dev loop, type safety end to end |
| Styling | Tailwind CSS v4 | Utility-first, custom theme (navy palette, motion tokens) defined directly in CSS |
| Backend | Node.js + Express + TypeScript | Simple, huge community support |
| Database | PostgreSQL | Data is inherently relational (groups → members → expenses → splits) |
| ORM | Prisma | Type-safe queries, schema doubles as documentation |
| Auth | JWT + bcrypt, plus Google OAuth 2.0 | Password auth implemented from scratch for the learning value; Google sign-in via the standard authorization-code flow |
| AI integration | Claude API (`@anthropic-ai/sdk`), model `claude-opus-5` | Structured extraction from free text |
| Deployment target | Vercel (frontend) + Render/Railway (backend) + hosted Postgres | Free-tier friendly, standard for portfolio projects |

## 2. What it does

- Users sign up with email/password, or sign in with Google (both methods can resolve to the same account if the email matches)
- Users create or join a household group via a short invite code
- Any member logs an expense (amount, description, category) and it's split evenly among group members
- Members can also log an expense in plain English — e.g. *"paid $85 for groceries and pizza last night"* — and Claude parses it into a structured entry (amount, category, description) for the user to review and confirm before it's saved. The AI endpoint never writes to the database itself.
- Chores are tracked per group with due dates, an assignee, and completion status; a "whose turn" indicator shows the current incomplete assignment for each chore
- A settle-up view shows the **minimum number of payments** needed to clear every debt in the group — not "everyone pays everyone," but the fewest possible transactions

## 3. Database schema

```
User ──< GroupMember >── Group
  │                         │
  ├──< Expense (paidBy) ────┤
  │       │                 │
  │       └──< ExpenseShare │
  │                         │
  └──< ChoreAssignment >── Chore ──┘
```

- Money is stored as integer cents (`amountCents`), never floats — avoids floating-point rounding bugs in financial data
- `ExpenseShare` is a many-to-many join table: one row per (expense, user) pair, recording exactly how much of that expense each person owes
- `User.passwordHash` is nullable (Google-only accounts have no password); `User.googleId` is a unique nullable field used to look up or link a Google identity
- Full schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)

## 4. The debt-simplification algorithm

The technical centerpiece — the thing to walk an interviewer through.

**Problem:** across a group of *N* people with many shared expenses, who should pay whom, and how much, to settle everyone up? The naive answer ("everyone who owes someone pays them directly") can require up to *N×(N−1)* transactions.

**Approach** (implemented in [`backend/src/lib/settleUp.ts`](backend/src/lib/settleUp.ts)):

1. Net every user's balance: `balance = (total they paid) − (total they owe across all shares)`. Positive means they're owed money; negative means they owe money.
2. Greedily match the largest creditor with the largest debtor, settle the smaller of the two amounts between them, and repeat.

This is the same technique used by apps like Splitwise. It's provably optimal in transaction count: each match fully settles at least one person, so *N* people with nonzero balances resolve in at most *N−1* transactions — the theoretical minimum.

```ts
computeBalances(expenses, shares)  // -> [{ userId, amountCents }]
simplifyDebts(balances)            // -> [{ fromUserId, toUserId, amountCents }]
settleGroup(expenses, shares)      // convenience: does both steps
```

## 5. AI expense parsing

`POST /ai/parse-expense` — [`backend/src/routes/ai.ts`](backend/src/routes/ai.ts)

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
- **Google OAuth 2.0** — standard authorization-code flow. `GET /auth/google` redirects to Google's consent screen; `GET /auth/google/callback` exchanges the code, verifies the ID token via `google-auth-library`, and finds-or-creates the user (linking to an existing password account by email if one already exists, rather than creating a duplicate). The callback redirects to the frontend with a short-lived token, which the frontend exchanges for the user's profile via `GET /auth/me`.

## 7. API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | – | Create account (email/password), returns JWT |
| POST | `/auth/login` | – | Returns JWT |
| GET | `/auth/me` | ✓ | Resolve the current JWT into a user profile |
| GET | `/auth/google` | – | Redirects to Google's OAuth consent screen |
| GET | `/auth/google/callback` | – | Google OAuth callback; issues a JWT and redirects to the frontend |
| POST | `/groups` | ✓ | Create a group (creator auto-joins) |
| POST | `/groups/join` | ✓ | Join a group via invite code |
| GET | `/groups` | ✓ | List current user's groups |
| GET | `/groups/:id` | ✓ | Group details + members |
| POST | `/expenses` | ✓ | Create an expense, auto-split evenly |
| GET | `/expenses/group/:groupId` | ✓ | List a group's expenses |
| GET | `/expenses/group/:groupId/settle` | ✓ | Minimal settle-up transaction list |
| POST | `/chores` | ✓ | Create a chore for a group |
| GET | `/chores/group/:groupId` | ✓ | List a group's chores with assignments |
| POST | `/chores/:choreId/assignments` | ✓ | Assign a chore to a member with a due date |
| POST | `/chores/assignments/:assignmentId/complete` | ✓ | Mark a chore assignment complete |
| POST | `/ai/parse-expense` | ✓ | Parse free text into a structured expense |

All authenticated routes expect `Authorization: Bearer <token>`.

## 8. Project structure

```
household-ledger/
├── backend/
│   ├── prisma/schema.prisma       # DB schema
│   ├── prisma/migrations/         # Applied migrations
│   └── src/
│       ├── index.ts               # Express app entry
│       ├── lib/
│       │   ├── settleUp.ts        # debt-simplification algorithm
│       │   ├── auth.ts            # JWT + bcrypt helpers
│       │   └── prisma.ts          # Prisma client singleton
│       ├── middleware/requireAuth.ts
│       └── routes/
│           ├── auth.ts            # signup/login/me + Google OAuth
│           ├── groups.ts
│           ├── expenses.ts
│           ├── chores.ts
│           └── ai.ts              # AI parsing endpoint
└── frontend/
    └── src/
        ├── App.tsx                # Route tree
        ├── components/
        │   ├── AppLayout.tsx      # Persistent nav shell + group switcher
        │   ├── ProtectedRoute.tsx
        │   ├── AuthBackdrop.tsx   # Decorative background for auth pages
        │   └── GoogleIcon.tsx
        ├── lib/
        │   ├── api.ts             # Typed fetch client
        │   ├── AuthContext.tsx    # Auth state provider
        │   └── money.ts           # Cents <-> dollars formatting helpers
        └── pages/
            ├── LandingPage.tsx
            ├── LoginPage.tsx / SignupPage.tsx
            ├── GoogleCallbackPage.tsx
            ├── GroupsPage.tsx / GroupDetailPage.tsx
            ├── ExpensesPage.tsx
            ├── SettleUpPage.tsx
            └── ChoresPage.tsx
```

## 9. Local setup

Prerequisites: Node.js 18+, a PostgreSQL database (local, or free-tier Supabase/Railway), an Anthropic API key, and (optionally) a Google OAuth Client ID/Secret from [Google Cloud Console](https://console.cloud.google.com).

```bash
# Backend
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY,
                             # and GOOGLE_CLIENT_ID/SECRET if you want Google sign-in
npm install
npx prisma migrate deploy
npm run dev                 # runs on http://localhost:4000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # runs on http://localhost:5173
```

### Google OAuth setup (optional)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Configure the OAuth consent screen (External, add your app name)
3. Under **Credentials → Create Credentials → OAuth client ID**, choose "Web application"
4. Add `http://localhost:4000/auth/google/callback` as an authorized redirect URI
5. Copy the Client ID and Client Secret into `backend/.env`

Without these set, the app still works fully via email/password — the Google button simply returns a clear "not configured" error.

## 10. Status

The application is feature-complete for its MVP scope: full auth (password + Google), groups, expenses with even-split, the settle-up algorithm, chores, AI-assisted expense entry, a persistent navigation shell, and a polished, animated UI. Remaining work before a production deployment is primarily environment setup (hosted Postgres, deployed backend/frontend, environment variables in each hosting dashboard) rather than new features.
