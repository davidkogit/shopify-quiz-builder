# Shopify Quiz Builder

A full-featured product recommendation quiz app for Shopify stores. Create quizzes with 6 logic types, embed as storefront widgets, and let customers add recommended products directly to cart.

Built with Next.js 15, TypeScript, Prisma, shadcn/ui, Tailwind CSS.

---

## Quick Start (Local Development)

### 1. Clone & Install

```bash
git clone https://github.com/davidkogit/shopify-quiz-builder.git
cd shopify-quiz-builder
npm install
```

### 2. Create a Shopify App

You need a Shopify Partner account and a development store.

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Click **Apps** → **Create app** → **Custom app**
3. Name it (e.g. "Quiz Builder Dev")
4. Under **Configuration**, set:
   - **App URL**: `http://localhost:3000`
   - **Allowed redirection URL(s)**: `http://localhost:3000/api/auth/callback`
5. Under **API credentials**, note:
   - `API key`
   - `API secret` (shown once — save it)
6. Under **Configuration** → **Scopes**, give the app these permissions:
   - `write_products`, `read_products`
   - `write_orders`, `read_orders`
   - `read_customers`
   - `write_customers`

### 3. Set Environment Variables

Copy the example file and fill in your Shopify credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database (SQLite for local dev)
DATABASE_URL="file:./prisma/dev.db"

# Shopify App
SHOPIFY_API_KEY=your_api_key_from_step_2
SHOPIFY_API_SECRET=your_api_secret_from_step_2
SHOPIFY_SCOPES=write_products,read_products,write_orders,read_orders,read_customers

# Session Encryption (generate with: openssl rand -hex 32)
SESSION_SECRET=your_random_64_char_hex

# Your app URL
HOST=http://localhost:3000
```

### 4. Set Up the Database

```bash
npx prisma db push
npx prisma generate
```

This creates a local SQLite database at `prisma/dev.db` with all tables.

### 5. Start the Dev Server

```bash
npm run dev
```

### 6. Install the App on Your Dev Store

1. Open `http://localhost:3000`
2. You'll be redirected to Shopify OAuth — enter your dev store's `.myshopify.com` domain
3. Authorize the app
4. You should see the admin dashboard

---

## Running Tests

```bash
npm test
```

Runs 43 logic engine tests covering all 6 recommendation types, edge cases, and logic jumps.

---

## Project Structure

```
├── lib/                        # Service libraries
│   ├── logic-engine.ts         # All 6 recommendation algorithms
│   ├── quiz-service.ts         # Quiz CRUD + duplication
│   ├── quiz-templates.ts       # Pre-built quiz templates
│   ├── session.ts              # AES-256-GCM encrypted sessions
│   ├── shopify.ts              # Shopify REST + GraphQL client
│   ├── rate-limit.ts           # Rate limiter for public API
│   ├── api-auth.ts             # Shared session→store resolver
│   └── ...
│
├── src/
│   ├── app/api/
│   │   ├── admin/              # 20+ admin API routes
│   │   ├── public/             # Storefront quiz API (public)
│   │   ├── auth/               # Shopify OAuth
│   │   └── webhooks/           # Shopify webhook handlers
│   │
│   ├── app/(admin)/            # Admin pages
│   │   ├── page.tsx            # Dashboard
│   │   ├── quiz/[id]/          # Quiz editor (3-column)
│   │   ├── analytics/          # Analytics dashboard + per-quiz detail
│   │   ├── submissions/        # Submission list + detail
│   │   └── widget-demo/        # Widget embed demo
│   │
│   ├── components/
│   │   ├── admin/              # 20+ admin components
│   │   └── widget/             # Storefront widget components
│   │       ├── quiz-widget.tsx # Main quiz state machine
│   │       ├── question-renderers/ # 5 question type renderers
│   │       └── widget-ui/      # Progress bar, navigation, etc.
│   │
│   └── widget/index.ts         # Widget UMD bundle entry point
│
├── prisma/schema.prisma        # 15 models
├── tests/                      # 43 tests
├── public/widget/              # Built widget bundle
└── widget.build.mjs            # esbuild widget bundler
```

---

## Key Features

### 6 Logic Types

| Type | How It Works |
|------|-------------|
| **Basic** | AND/OR path matching — specific answer combinations → result |
| **Single** | Direct answer → product linking |
| **Points** | Sum answer points → match result range |
| **Product Weight** | Accumulate per-product weights → top products win |
| **Result Weight** | Accumulate per-result points → highest result wins |
| **Combination** | Basic path match → Single product collection |

### 5 Question Types

Radio, Image+Text, Text Box, Range Slider, Select Box — each with a dedicated renderer in the storefront widget.

### Storefront Widget

```html
<!-- Embed on any Shopify page -->
<link rel="stylesheet" href="/widget/bundle.css" />
<script src="/widget/bundle.js"></script>
<div data-quiz-key="your-quiz-key"></div>
```

The widget auto-mounts and runs the full quiz flow — intro, questions, email capture, results with add-to-cart buttons.

### Admin Dashboard

- **Quiz Editor**: 3-column layout (sidebar, preview, settings)
- **Path Builder**: Visual AND/OR logic path builder
- **Style Editor**: Font, colors, button style customization
- **Publish Engine**: 4 embed methods with copyable code snippets
- **Analytics**: Aggregate dashboard + per-quiz breakdowns (funnel, top answers, time series)
- **Submissions**: Filterable list, detail view, .xlsx export
- **A/B Testing**: Variant creation with split-test embed

---

## Deploying to Netlify

### Prerequisites
- A **PostgreSQL** database (Supabase, Neon, or Railway free tier)
- Your Shopify app's production credentials

### Steps

1. **Push to GitHub** (already done)

2. **Sign up for PostgreSQL** — e.g., [neon.tech](https://neon.tech) (free) and create a database. Copy the connection string.

3. **Connect to Netlify**:
   - Go to [app.netlify.com](https://app.netlify.com)
   - Click **Add new site** → **Import an existing project** → connect GitHub
   - Select `davidkogit/shopify-quiz-builder`
   - Build settings are already configured in `netlify.toml`

4. **Set environment variables** in Netlify dashboard:
   ```
   DATABASE_URL=postgresql://user:pass@host/db  (your PostgreSQL connection string)
   SHOPIFY_API_KEY=...
   SHOPIFY_API_SECRET=...
   SHOPIFY_SCOPES=write_products,read_products,write_orders,read_orders,read_customers
   SESSION_SECRET=...  (generate: openssl rand -hex 32)
   HOST=https://your-site.netlify.app
   ```

5. **Update Prisma schema** for PostgreSQL:
   - Edit `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`
   - Commit and push — Netlify rebuilds automatically

6. **Update Shopify app URL** in Shopify Partners to point to your Netlify URL

---

## Creating Your First Quiz

1. Open the admin dashboard
2. Click **Create Quiz** → enter a name → select a logic type (e.g. "Single" for product recommendations)
3. Add questions and answers in the editor
4. Link products to answers (via product search)
5. Go to the **Publish** tab → toggle to Published
6. Copy the embed code → paste into your Shopify theme

---

## Technologies

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | Prisma 5 |
| Auth | Shopify OAuth + AES-256-GCM sessions |
| Admin UI | Tailwind CSS + shadcn/ui |
| Widget | React + esbuild (UMD bundle) |
| Testing | Vitest |
| Hosting | Netlify (serverless) |
