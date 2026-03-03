# BatchFlow v1.1.0
*Own your flow*

A personal zero-based budgeting web app. Plan income and expenses by category, log transactions, and track spending in real time. Backed by Supabase with per-user auth and deployed on Vercel. Installable as a PWA on iOS and Android.

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
- **Recurring transactions** - define recurring rules (weekly, biweekly, monthly, etc.) and have pending instances generated automatically for the current month
- **Paycheck and calendar planning** - a calendar view shows all income (recurring and one-time confirmed) alongside daily cash flow projections
- **Quick transaction entry** - floating action button on the Dashboard and Transactions pages opens the transaction form without navigating away
- **Category management** - add, rename (inline double-click), reorder (arrow buttons), and delete income and expense categories
- **Subcategory management** - add, rename (inline double-click), drag-and-drop reorder, and delete; renaming from the Budget page syncs everywhere
- **Analytics** - pie chart category breakdown, monthly spending bar chart, and income vs. expense line chart across recent months; all charts exclude pending transactions
- **Real-time updates** - Supabase real-time subscriptions keep all open tabs in sync when transactions are added, updated, or deleted
- **Dark mode** - defaults to dark; toggle to light in Settings; preference persisted in localStorage and applied before React mounts (no flash)
- **Settings** - install prompt for PWA, account info, preferences (currency, week start, default page), JSON data export and import for full backup and restore
- **PWA** - installable on iOS and Android directly from the browser; app shell and static assets are cached for offline use; Supabase API calls use a network-first strategy
- **Multi-user auth** - email/password sign in and sign up via Supabase; every user's data is isolated at the database level via Postgres row-level security

---

## Tech Stack

| Technology | Role |
|---|---|
| [React 18](https://react.dev/) | UI framework - functional components and hooks throughout |
| [Tailwind CSS v4](https://tailwindcss.com/) | Utility-first styling via the `@tailwindcss/vite` plugin; no `tailwind.config.js` needed |
| [Vite](https://vitejs.dev/) | Build tool and local dev server |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | PWA manifest, service worker generation, and Workbox caching config |
| [Supabase](https://supabase.com/) | Postgres database, email/password authentication, row-level security, and real-time subscriptions |
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
```

Both values are in your Supabase project under **Settings -> API**.

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
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings -> Environment Variables**
4. Deploy - Vercel detects Vite automatically; no custom build settings required

Every subsequent push to `main` deploys to production automatically.

---

## Project Structure

```
src/
├── context/
│   ├── AppContext.jsx       # Central app state + all Supabase CRUD operations
│   └── AuthContext.jsx      # Supabase auth state (user, signIn, signUp, signOut)
├── lib/
│   └── supabase.js          # Supabase client (reads env vars)
├── data/
│   └── defaultCategories.js # Default category set seeded for new users
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
│   └── transactions/        # TransactionModal
└── views/
    ├── Auth.jsx              # Sign in / sign up
    ├── Dashboard.jsx         # Category cards, recent activity, FAB
    ├── Budget.jsx            # Inline budget planning with inline rename
    ├── Transactions.jsx      # Transaction list with split-row display, FAB
    ├── Analytics.jsx         # Recharts: pie, bar, and line charts
    ├── Calendar.jsx          # Monthly income and cash flow calendar
    ├── Categories.jsx        # Category and subcategory management
    └── Settings.jsx          # Install prompt, account, preferences, data tools
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
