# BatchFlow v1.3.0
*Own your flow*

A personal zero-based budgeting web app. Plan income and expenses by category, log transactions, and track spending in real time. Backed by Supabase with per-user auth and deployed on Vercel. Installable as a PWA on iOS and Android.

---

## What's new in v1.3.0

**Access control**
- Invite-only mode: open signup is disabled; new accounts are created only via email invite sent by the admin from the Settings page
- Admin invite panel in Settings: invite users by email, view all invited accounts with their status (pending or active), and revoke access with a confirmation step
- Password setup screen: users arriving from an invite link are required to set a password before they can access the app

**Bug fixes**
- Default categories no longer appear doubled for newly invited users; a database-level count check prevents the seeding function from running more than once per account
- Recurring transaction merchant names now sync correctly across all months including past confirmed transactions
- The copy-budget empty state displays correctly for future months on both the Budget page and Dashboard
- Pending transactions are excluded from analytics charts consistently across all four tabs
- Over-budget detection enforces a strict 0.01 threshold everywhere; amounts at exactly the budget always show as on-budget
- PWA cache clears faster on new deployments for quicker updates across all devices

---

## Features

- **Zero-based budgeting** - assign every dollar of income to a category; the unbudgeted remainder is always visible
- **Month navigation** - each month has its own independent budget plan and transaction set; navigate freely with a Today button to jump back to the current month
- **New-month copy experience** - arriving at a month with no budget prompts you to copy amounts from an adjacent month or start fresh
- **Budget planning** - set planned amounts at the category or subcategory level with inline editing; category totals roll up automatically from subcategory values
- **Dashboard** - planned vs. actual vs. remaining for every category, color-coded progress bars, and a recent activity panel split into Pending and Completed sections
- **Transaction logging** - record transactions with amount, date, category, subcategory, merchant, and notes
- **Split transactions** - split a single transaction across multiple categories and subcategories (e.g. a shopping trip covering groceries and clothing)
- **Pending transactions** - transactions can be saved as pending and confirmed later; pending items are hidden until 1 day before their scheduled date; confirming shows a 5-second undo toast
- **Recurring transactions** - define recurring rules (weekly, biweekly, monthly, etc.) and have pending instances generated automatically for the current month; editing a rule propagates name and amount changes to all past and future instances
- **Paycheck and calendar planning** - a calendar view shows all income (recurring and one-time confirmed) alongside daily cash flow projections
- **Quick transaction entry** - floating action button on the Dashboard and Transactions pages opens the transaction form without navigating away
- **Category management** - add, rename (inline double-click), reorder (arrow buttons), and delete income and expense categories
- **Subcategory management** - add, rename (inline double-click), drag-and-drop reorder, and delete; renaming from the Budget page syncs everywhere
- **Analytics** - four-tab analytics page with spending breakdowns, subcategory treemap, trend charts, budget efficiency scoring, and activity metrics (see Analytics section below)
- **Persistent filter state** - all analytics filters survive page navigation and are only cleared when the user explicitly clicks Reset Filters; a Reset Filters button appears automatically whenever any filter is non-default
- **Dynamic default date range** - date range defaults are always calculated as 12 months back from the currently selected month, not hardcoded to today
- **Real-time updates** - Supabase real-time subscriptions keep all open tabs in sync when transactions are added, updated, or deleted
- **Dark mode** - defaults to dark; toggle to light in Settings; preference persisted in localStorage and applied before React mounts (no flash)
- **Settings** - install prompt for PWA, account info, preferences (currency, week start, default page), JSON data export and import for full backup and restore, and admin invite management for the admin account
- **PWA** - installable on iOS and Android directly from the browser; app shell and static assets are cached for offline use; Supabase API calls use a network-first strategy; the app automatically applies updates in the background and shows a confirmation toast when a new version is live
- **Invite-only auth** - new accounts are created exclusively via admin email invite sent from the Settings page; invited users set their password on first login; every user's data is isolated at the database level via Postgres row-level security

---

## Analytics

The Analytics page is organized into four tabs. All charts use confirmed-only transactions. Filter state (date ranges, toggles, category filters) persists across page navigation and resets only on explicit user action; the Reset Filters button appears only when at least one filter is non-default.

### This Month

- **Spending donut** - toggle between Actual and Planned views; toggle between dollar amounts and percentages; each slice is color-coded to its category
- **Top categories** - ranked list of your highest-spend categories for the selected month; click any category to see its 6-month spending history
- **Planned vs. Actual bar chart** - side-by-side comparison of budgeted and actual spend for every expense category; click any bar to expand a subcategory breakdown panel below the chart
- **Budget Efficiency Score** - a 0-100 score and SVG gauge that measures how closely your actual spending matched your plan; categories at or under budget contribute positively, over-budget categories score zero; exactly hitting your budget counts as 100% for that category

### Trends

- **Date range selector** - choose any window up to the last 24 months
- **Income vs. Expenses line chart** - monthly income and total expenses plotted side by side
- **Savings Rate bar chart** - monthly savings rate as a percentage of income; bars are color-coded green (positive) or red (negative)
- **Per-category spending line chart** - one line per expense category over the selected range; toggle individual categories on and off using the chip list below the chart
- **Monthly summary table** - month-by-month breakdown of income, expenses, savings, and savings rate in a scrollable table

### Subcategories

- **Date range and view mode filters** - select any multi-month window up to 24 months; toggle between Actual spending and Planned amounts; these filters apply to both the treemap and the breakdown table
- **Spending treemap** - flat category blocks sized by total spending; click any category block to zoom in and see its subcategories as individual blocks with a breadcrumb showing the drill path (e.g. All Categories > Housing); click a subcategory block to open its trend panel
- **Subcategory breakdown table** - every subcategory with Planned, Actual, Remaining (red if over budget), % of total spending, and transaction count columns; sortable by any column; searchable by name; has its own independent category filter that does not affect the treemap
- **12-month trend panel** - clicking any row or treemap subcategory block expands a line chart showing that subcategory's actual vs. planned spending over the last 12 months, useful for tracking recurring items like loan payments or contributions

### Activity

- **Transaction volume** - bar chart of total transactions logged per month
- **Day-of-week frequency** - bar chart showing which days of the week you transact most; the busiest day is highlighted
- **Average transaction size by category** - horizontal bar chart ranking categories by their average individual transaction amount

---

## Tech Stack

| Technology | Role |
|---|---|
| [React 18](https://react.dev/) | UI framework - functional components and hooks throughout |
| [Tailwind CSS v4](https://tailwindcss.com/) | Utility-first styling via the `@tailwindcss/vite` plugin; no `tailwind.config.js` needed |
| [Vite](https://vitejs.dev/) | Build tool and local dev server |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | PWA manifest, service worker generation, and Workbox caching config |
| [Supabase](https://supabase.com/) | Postgres database, email/password authentication, row-level security, real-time subscriptions, and Edge Functions |
| [Vercel](https://vercel.com/) | Hosting - every push to `main` triggers an automatic production deployment |
| [Recharts](https://recharts.org/) | Charts in the Analytics view |
| [React Router v6](https://reactrouter.com/) | Client-side routing |
| [@dnd-kit](https://dndkit.com/) | Drag-and-drop subcategory reordering |
| [Lucide React](https://lucide.dev/) | Icons |

---

## Running Locally

### 1. Clone and install

```bash
git clone https://github.com/your-username/budget-tool.git
cd budget-tool
npm install
```

### 2. Set environment variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ADMIN_EMAIL=your_admin_email_address
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are in your Supabase project under **Settings -> API**. `VITE_ADMIN_EMAIL` is the email address of the account that has access to the admin invite panel in Settings.

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server at http://localhost:5173 |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build locally |

---

## Deploying to Vercel

1. Push the repository to GitHub
2. Import the repo in the [Vercel dashboard](https://vercel.com/new)
3. Add the following under **Settings -> Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_EMAIL`
4. Deploy - Vercel detects Vite automatically; no custom build settings required

Every subsequent push to `main` deploys to production automatically.

The three Supabase Edge Functions (`admin-invite`, `admin-list-users`, `admin-revoke`) are deployed separately via the Supabase CLI and are not part of the Vercel build. See `supabase/functions/` for their source.

---

## Project Structure

```
src/
├── context/
│   ├── AppContext.jsx       # Central app state + all Supabase CRUD operations
│   └── AuthContext.jsx      # Supabase auth state (user, signIn, signOut, invite detection)
├── lib/
│   └── supabase.js          # Supabase client (reads env vars)
├── data/
│   └── defaultCategories.js # Default category set seeded once for new users
├── utils/
│   ├── budgetUtils.js       # Spending totals, progress %, unbudgeted calculation
│   ├── formatters.js        # Currency, date, and month key helpers
│   ├── recurringUtils.js    # Recurring rule occurrence generation
│   └── storage.js           # localStorage helpers (currentMonth + preferences)
├── components/
│   ├── budget/              # BudgetEmptyState
│   ├── categories/          # CategoryModal
│   ├── common/              # MonthSelector, ProgressBar
│   ├── layout/              # Layout, Sidebar, Header
│   ├── transactions/        # TransactionModal
│   └── UpdateNotifier.jsx   # Service worker registration and update toast
└── views/
    ├── Auth.jsx              # Sign in (invite-only; no public signup)
    ├── SetPassword.jsx       # Forced password setup screen shown after invite link
    ├── Dashboard.jsx         # Category cards, recent activity, FAB
    ├── Budget.jsx            # Inline budget planning with inline rename
    ├── Transactions.jsx      # Transaction list with split-row display, FAB
    ├── Analytics.jsx         # Four-tab analytics: This Month, Trends, Subcategories, Activity
    ├── Calendar.jsx          # Monthly income and cash flow calendar
    ├── Categories.jsx        # Category and subcategory management
    └── Settings.jsx          # Install prompt, account, preferences, data tools, admin invite panel

supabase/
└── functions/
    ├── admin-invite/         # Edge Function: send invite email via service role key
    ├── admin-list-users/     # Edge Function: list non-admin users with invite status
    └── admin-revoke/         # Edge Function: delete a user account
```

---

## Database Schema

All data lives in Supabase (Postgres). Every table has a `user_id` column; RLS policies ensure users can only access their own rows.

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

Cascade deletes: removing a category removes its subcategories and budget plans; removing a transaction removes its splits; removing a subcategory removes its budget plans.
