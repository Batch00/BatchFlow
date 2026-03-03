# BatchFlow v1.1.0 - Claude Instructions
*Own your flow. Personal zero-based budgeting app backed by Supabase, deployed on Vercel.*

## Tech Stack
- **React 18** - functional components and hooks
- **Tailwind CSS v4** - via `@tailwindcss/vite`; no `tailwind.config.js`
- **Vite** - build tool and dev server
- **vite-plugin-pwa** - PWA manifest, service worker, Workbox caching
- **Supabase** - Postgres database, email/password auth, row-level security, real-time subscriptions
- **Vercel** - hosting; auto-deploys on every push to `main`
- **Recharts** - analytics charts
- **@dnd-kit** - drag-and-drop subcategory reordering
- **Lucide React** - icons

## Commands
```bash
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Project Structure
```
src/
├── context/
│   ├── AppContext.jsx       # All app state + Supabase CRUD; useApp() hook
│   └── AuthContext.jsx      # Supabase auth; useAuth() hook
├── lib/
│   └── supabase.js          # Supabase client (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
├── data/
│   └── defaultCategories.js # Seeded once for new users
├── utils/
│   ├── budgetUtils.js       # getCategorySpent, getSubcategorySpent, getProgressStatus, etc.
│   ├── formatters.js        # formatCurrency, formatDate, formatMonthLabel, getMonthKey
│   ├── recurringUtils.js    # getOccurrencesInMonth for recurring rule generation
│   └── storage.js           # localStorage helpers (currentMonth + preferences)
├── components/
│   ├── budget/              # BudgetEmptyState
│   ├── categories/          # CategoryModal
│   ├── common/              # MonthSelector, ProgressBar
│   ├── layout/              # Layout, Sidebar, Header
│   └── transactions/        # TransactionModal
└── views/
    ├── Auth.jsx              # Sign in / sign up
    ├── Dashboard.jsx         # Category cards, recent activity, FAB
    ├── Budget.jsx            # Inline budget planning + inline rename
    ├── Transactions.jsx      # Transaction list with split-row display, FAB
    ├── Analytics.jsx         # Recharts: pie, bar, line charts (confirmed only)
    ├── Calendar.jsx          # Monthly income and cash flow calendar
    ├── Categories.jsx        # Category + subcategory management
    └── Settings.jsx          # Install prompt, account, preferences, data export/import
```

## Architecture

**`AppContext.jsx`** - single source of truth: `categories`, `transactions`, `budgets`, `currentMonth`. All CRUD talks directly to Supabase. `currentMonth` is persisted to localStorage; all other state comes from Supabase.

**`AuthContext.jsx`** - wraps Supabase auth; exposes `user`, `loading`, `signIn`, `signUp`, `signOut`.

**`budgetUtils.js`** - pure functions for spending totals and progress. `getCategorySpent` / `getSubcategorySpent` handle both flat and split transactions. `getProgressStatus(spent, planned, type)` accepts `'income'|'expense'`; yellow threshold is 50% for both. Expense: green -> yellow (50%) -> red (strictly over). Income: neutral -> yellow (50%) -> green (100%).

**Budget writes** use optimistic updates - local state updates immediately, Supabase write is background. Budget plans use DELETE + INSERT (not upsert) to avoid partial unique-index conflicts.

**Routing** - `App.jsx` -> nested under `<Layout />` -> Dashboard / Budget / Transactions / Analytics / Calendar / Categories / Settings. Auth is a standalone route outside Layout.

**PWA** - configured via `vite-plugin-pwa` in `vite.config.js`. Service worker auto-updates; static assets are precached; Supabase API calls use NetworkFirst with a 10-second timeout.

**Theme** - dark/light only (no system option). Stored in `batchflow:theme` localStorage key. Default is dark. An inline `<script>` in `index.html` applies `.dark` to `<html>` before React mounts to prevent flash on the login screen.

**Real-time** - `AppContext.jsx` maintains a Supabase `postgres_changes` subscription on the `transactions` table. INSERT events deduplicate against optimistic state; UPDATE overwrites with server data; DELETE filters from state. This keeps all open tabs in sync.

**Pending transactions** - transactions have `isPending` and `scheduledDate` fields. Pending recurring instances are hidden until 1 day before `scheduledDate`. `isVisiblePending(t, tomorrowStr)` is a shared helper used in Dashboard and Transactions. Confirming a pending transaction shows a 5-second undo toast.

**Recurring rules** - stored in `recurring_rules` table. `generateRecurringInstances(monthKey)` in AppContext creates pending transaction instances for the current month. `updateRecurringRule` deletes all pending instances for the rule and calls `generateRecurringInstances` to regenerate them (prevents stale scheduled_dates when the rule's frequency or start_date changes).

**Calendar** - `Calendar.jsx` shows all income for the month: recurring instances (`t.recurringRuleId !== null`) and confirmed one-time income (`!t.isPending`). Cash flow projects running daily balance using this same income set plus all confirmed expense transactions.

**Analytics** - all charts and totals use confirmed-only transactions. `Analytics.jsx` derives `confirmedMonthTransactions` and `confirmedAllTransactions` via `useMemo` by filtering `!t.isPending` before passing to chart subcomponents.

**`refreshTransactions`** - a useCallback in AppContext that re-fetches all transactions from Supabase and replaces local state. Called on Dashboard mount to ensure fresh data after recurring rule changes or cross-tab edits.

## Database Schema
Every table has `user_id`; RLS policies enforce per-user isolation server-side. **Schema changes must be done manually in the Supabase SQL editor - never from app code.**

```
categories         - id, user_id, name, type ('income'|'expense'), color, sort_order
subcategories      - id, category_id, user_id, name, sort_order
transactions       - id, user_id, date, amount, type, merchant, notes, is_split,
                     is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id
transaction_splits - id, transaction_id, category_id, subcategory_id, amount
budget_plans       - id, user_id, month_key (YYYY-MM), category_id, subcategory_id, planned_amount
recurring_rules    - id, user_id, name, amount, type, category_id, subcategory_id,
                     frequency, start_date, end_date
```

Cascade deletes: category -> subcategories + budget_plans; transaction -> splits; subcategory -> budget_plans.

## Data Model (app-side camelCase)
```js
// Category
{ id, name, type: 'income'|'expense', color, subcategories: [{ id, name }] }

// Transaction (flat)
{ id, date, amount, type, categoryId, subcategoryId, merchant, notes,
  isPending, scheduledDate, recurringRuleId }

// Transaction (split) - categoryId: null signals split
{ id, date, amount, type, merchant, notes, categoryId: null, subcategoryId: null,
  isPending, scheduledDate, recurringRuleId,
  splits: [{ categoryId, subcategoryId, amount }, ...] }

// Recurring rule
{ id, name, amount, type, categoryId, subcategoryId, frequency, startDate, endDate }

// Budgets map
{ [monthKey]: { planned: { [categoryId]: number }, subcategoryPlanned: { [subcategoryId]: number } } }
```

## Design Guidelines
- Clean and modern, mobile-friendly; sidebar nav, card-based layouts
- Progress bar colors: **Expense** green -> yellow (50%) -> red (strictly over budget); **Income** neutral -> yellow (50%) -> green (100%)
- "received" label for income, "spent" for expense
- Floating-point guard: use `Math.abs(val) < 0.01` for zero checks; use `spent - planned > 0.01` for "over budget" check

## Code Style
- PascalCase components, camelCase functions/variables
- Functional components with hooks only
- No emojis in code or output
- Keep changes minimal - no refactoring beyond what's asked
- Never commit or push; user handles all git operations
