# Shopify Quiz Builder

A full-featured product recommendation quiz app for Shopify stores. Create quizzes with 6 logic types, embed as storefront widgets, and let customers add recommended products directly to cart.

Built with Next.js 15, TypeScript, Prisma, shadcn/ui, Tailwind CSS.

---

## Table of Contents

1. [Local Development](#local-development)
2. [Production Deployment](#production-deployment)
   - [Step 1: Fork & Clone](#step-1-fork--clone-the-repo)
   - [Step 2: Create PostgreSQL Database (Neon)](#step-2-create-postgresql-database-neon)
   - [Step 3: Create Shopify App](#step-3-create-shopify-app-partnersshopifycom)
   - [Step 4: Deploy to Netlify](#step-4-deploy-to-netlify)
   - [Step 5: Switch to PostgreSQL](#step-5-switch-to-postgresql)
   - [Step 6: Push Tables to Database](#step-6-push-tables-to-database)
   - [Step 7: Install App on Your Store](#step-7-install-app-on-your-store)
3. [Running Tests](#running-tests)
4. [Creating Your First Quiz](#creating-your-first-quiz)
5. [Project Structure](#project-structure)
6. [Features](#key-features)

---

## Local Development

Quick setup for running on your own machine with SQLite (no external database needed):

```bash
git clone https://github.com/davidkogit/shopify-quiz-builder.git
cd shopify-quiz-builder
npm install
cp .env.example .env
```

Edit `.env` with your Shopify test app credentials (see Step 3 below for how to get them):

```env
DATABASE_URL="file:./prisma/dev.db"

SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_SCOPES=write_products,read_products,write_orders,read_orders,read_customers

SESSION_SECRET=  # generate: openssl rand -hex 32
HOST=http://localhost:3000
```

Then:
```bash
npx prisma db push
npm run dev
```

Open `http://localhost:3000` — you'll be redirected to Shopify OAuth.

---

## Production Deployment

This guide takes you from zero → working live app in about 20 minutes.

---

### Step 1: Fork & Clone the Repo

1. Go to https://github.com/davidkogit/shopify-quiz-builder
2. Click **Fork** (top right) → **Create fork**
3. Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/shopify-quiz-builder.git
cd shopify-quiz-builder
npm install
```

---

### Step 2: Create PostgreSQL Database (Neon)

We need a database before we can deploy. Neon has a generous free tier.

1. Go to https://neon.tech
2. Click **Sign Up** → sign up with GitHub or email
3. After logging in, click **Create project**
4. Fill in:
   - **Project name**: `quiz-builder-db`
   - **Region**: Choose the one closest to you (e.g., `US East (Ohio)`)
   - **Postgres version**: `16` (default is fine)
5. Click **Create project**
6. After creation, you'll see a **Connection string** box. It looks like:
   ```
   postgresql://neondb_owner:npg_xxxxxxxxxxxx@ep-cool-darkness-a1b2c3d4-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
7. **Copy this entire URL** — you'll need it in Step 4 and Step 5

> **Keep this browser tab open.** You'll come back to it.

---

### Step 3: Create Shopify App (partners.shopify.com)

You need a Shopify Partner account (free) and a development store.

**If you don't have a Partner account:**
- Go to https://partners.shopify.com
- Click **Join now** → fill out the form → submit

**If you don't have a development store:**
- In your Partner dashboard, click **Stores** → **Add store** → **Create development store**
- Give it a name and create it

**Create the app:**

1. In your Partner dashboard, click **Apps** (left sidebar)
2. Click **Create app** (green button, top right)
3. Select **Custom app** (not "Public app")
4. Fill in:
   - **App name**: `Quiz Builder` (or any name)
   - **App type**: Custom app
5. Click **Create app**

**Configure the app:**

You'll now see the app configuration page. Fill in each section exactly:

#### URLs section

| Field | Value |
|-------|-------|
| **App URL** | Your Netlify URL (you'll get this in Step 4 — come back here after deploying) |
| **Embed app in Shopify admin** | Leave **unchecked** |
| **Preferences URL (optional)** | Leave empty |

> **Temporary for testing:** You can put `https://example.com` here for now, then update it after Step 4.

#### Webhooks section

| Field | Value |
|-------|-------|
| **Webhooks API version** | `2024-10` |

#### Access > Scopes section

**Required scopes:** Enter exactly this (copy and paste):

```
write_products,read_products,write_orders,read_orders,read_customers
```

**Optional scopes:** Leave empty.

**Use legacy install flow:** Leave **unchecked**.

#### Redirect URLs section

| Field | Value |
|-------|-------|
| **Redirect URLs** | `https://YOUR_NETLIFY_URL.netlify.app/api/auth/callback` |

For local testing also add: `http://localhost:3000/api/auth/callback`

#### Everything else

| Field | Value |
|-------|-------|
| **POS** | Leave unchecked |
| **App proxy** | Leave empty |

7. Click **Save** (green button, top right)

**Get your API credentials:**

8. After saving, click the **API credentials** tab
9. You'll see:
   - **API key**: A long string (e.g., `a1b2c3d4e5f6...`)
   - **API secret**: Hidden behind a "Reveal" button → click to reveal
10. **Copy both** and save them somewhere safe. You'll need them in Step 4.

---

### Step 4: Deploy to Netlify

1. Go to https://app.netlify.com
2. Click **Log in** → sign in with GitHub
3. Click **Add new site** → **Import an existing project**
4. Click **GitHub** → find your forked repo (`YOUR_USERNAME/shopify-quiz-builder`) → select it
5. Netlify auto-detects the build settings from `netlify.toml`. You'll see:
   - **Build command**: `npx prisma generate && next build && npm run widget:build` (pre-filled)
   - **Publish directory**: `.next` (pre-filled)
6. Click **Show advanced** → **Add environment variables**:

Add these 6 variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string from Step 2 (the full `postgresql://...` URL) |
| `SHOPIFY_API_KEY` | Your Shopify API key from Step 3 |
| `SHOPIFY_API_SECRET` | Your Shopify API secret from Step 3 |
| `SHOPIFY_SCOPES` | `write_products,read_products,write_orders,read_orders,read_customers` |
| `SESSION_SECRET` | Generate: run `openssl rand -hex 32` in your terminal, paste the output |
| `HOST` | `https://YOUR-SITE-NAME.netlify.app` |

> **How to get HOST:** Netlify gives you a URL like `random-name-123456.netlify.app`. If you want a custom one, click **Site configuration** after creating the site → **Change site name**. Use that as HOST.

7. Click **Deploy site**

Wait 2-3 minutes for the first build. You'll see build logs. It should say:

```
✔ Generated Prisma Client
✓ Compiled successfully
✓ Generating static pages
```

**Once deployed, copy your Netlify URL** (e.g., `https://quiz-builder-abc123.netlify.app`).

### Update Shopify App URL

8. Go back to your Shopify Partners tab (Step 3)
9. Edit the app configuration:
   - **App URL**: `https://YOUR_NETLIFY_URL.netlify.app`
   - **Redirect URLs**: `https://YOUR_NETLIFY_URL.netlify.app/api/auth/callback`
10. Click **Save**

---

### Step 5: Switch to PostgreSQL

The repo currently uses SQLite (for local dev). You need to tell it to use PostgreSQL for production.

```bash
# In your cloned repo, edit this file:
# prisma/schema.prisma

# Find this line (around line 12):
#   provider = "sqlite"

# Change it to:
#   provider = "postgresql"
```

Or use this command:
```bash
cd shopify-quiz-builder
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
```

Then commit and push:
```bash
git add prisma/schema.prisma
git commit -m "Switch to PostgreSQL for production"
git push
```

Netlify auto-rebuilds when you push. This time, it will compile against PostgreSQL.

---

### Step 6: Push Tables to Database

Your database exists (from Step 2) but has no tables yet. Push the schema:

```bash
# Use the same connection string from Step 2
DATABASE_URL="postgresql://neondb_owner:npg_xxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require" npx prisma db push
```

You'll see output like:
```
✔ Generated Prisma Client
Your database is now in sync with your schema.
```

Now also add `prisma db push` to the build command so tables stay in sync:
```bash
# Edit netlify.toml, change the build command to:
# command = "npx prisma generate && npx prisma db push --skip-generate && next build && npm run widget:build"

git add netlify.toml
git commit -m "Add prisma db push to build command"
git push
```

---

### Step 7: Install App on Your Store

1. Open a new browser tab and go to:
   ```
   https://YOUR_NETLIFY_URL.netlify.app?shop=YOUR-STORE.myshopify.com
   ```
   Replace `YOUR_STORE` with your development store's handle.

2. You'll be redirected to Shopify OAuth:
   - You'll see "Quiz Builder wants to access your store"
   - Review the permissions (products, orders, customers)
   - Click **Install app**

3. After authorization, you'll land on the admin dashboard

4. **Create your first quiz** (see Creating Your First Quiz below)

---

## Running Tests

```bash
npm test
```

Runs 43 logic engine tests covering all 6 recommendation types, edge cases, and logic jumps.

---

## Creating Your First Quiz

1. On the admin dashboard, click **Create Quiz**
2. Enter a name (e.g. "Skincare Finder")
3. Select a logic type:
   - **Single** if you want to link specific products to answers
   - **Points** if you want to score answers and match score ranges to results
   - **Basic** if you want specific answer combinations to map to results
4. Add questions and answers in the editor
5. Link products to answers using the product picker (searches your Shopify store)
6. Go to the **Publish** tab → toggle **Published**
7. Copy the embed code (script snippet)
8. Paste into your Shopify theme's `theme.liquid` before `</body>`

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
<link rel="stylesheet" href="/widget/bundle.css" />
<script src="/widget/bundle.js"></script>
<div data-quiz-key="your-quiz-key"></div>
```

### Admin Dashboard

- **Quiz Editor**: 3-column layout (sidebar, preview, settings)
- **Path Builder**: Visual AND/OR logic path builder
- **Style Editor**: Font, colors, button style customization
- **Publish Engine**: 4 embed methods with copyable code snippets
- **Analytics**: Aggregate dashboard + per-quiz breakdowns
- **Submissions**: Filterable list, detail view, .xlsx export
- **A/B Testing**: Variant creation with split-test embed

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
