# BU Degree Tracker

A web app for tracking academic progress toward a **CAS BA in Computer Science** at Boston University. Tracks credits, GPA, BU Hub requirements, CS degree requirements, semester planning, course prerequisites, and RateMyProfessors ratings.

<!-- Add your own screenshots here:
![Dashboard](docs/screenshots/dashboard.png)
![Planner](docs/screenshots/planner.png)
-->

## Features

- **Dashboard** — Progress rings for credits (128 total), GPA, and Hub completion at a glance
- **BU Hub Tracker** — All 21 Hub areas across 6 capacities, color-coded, with satisfaction status and suggested courses
- **CS Degree Requirements** — Groups A/B/C/D with per-course completion tracking
- **Semester Planner** — Drag-and-drop course scheduling (Fall 2024 - Summer 2028) with prerequisite violation warnings
- **Course Browser** — Filter by department, Hub area, or semester; full-text search across 1000+ courses
- **RateMyProfessors Integration** — Star ratings and difficulty scores shown on course detail pages
- **Multiple Programs** — Track major, minors, and joint majors simultaneously
- **Multi-user Auth** — Supabase authentication for per-user progress tracking
- **PDF Export** — Export your degree plan as a PDF
- **Manual Hub Overrides** — Mark Hub areas as satisfied for courses not in the database

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Frontend | React 19, Tailwind CSS 4 |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 6 |
| Auth | Supabase Auth |
| Scraping | Cheerio |
| Deployment | Vercel |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- A [Supabase](https://supabase.com/) project (free tier works)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/BU_suggestor.git
cd BU_suggestor
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env` with your values from the [Supabase dashboard](https://supabase.com/dashboard) (Settings > API):

```env
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 3. Set up the database

```bash
npx prisma db push      # Push schema to Supabase
npx prisma generate     # Generate Prisma client
```

### 4. Seed data (optional)

```bash
npx tsx prisma/seed.ts           # Base course data
npx tsx scripts/seed-programs.ts # CS BA / minor program requirements
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run scrape` | Scrape BU course catalog |
| `npm run scrape:rmp` | Fetch RateMyProfessors ratings for all instructors |
| `npm run seed:programs` | Seed CS BA and minor program requirements |
| `npm run tag:labs` | Tag courses that include a lab component |
| `npm run refresh` | Full data refresh (scrape + seed) |
| `npm run screenshot` | Take screenshots of the app (requires Playwright) |

> **Windows note:** Stop the dev server before running `prisma generate` or `prisma db push`. Node locks `query_engine-windows.dll.node` while the server is running.

## Project Structure

```
BU_suggestor/
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── seed.ts                   # Initial data seeder
├── scripts/                      # Scraping and data management
│   ├── scrape.ts                 # BU course catalog scraper
│   ├── scrape-rmp.ts             # RateMyProfessors scraper
│   └── seed-programs.ts          # Program requirements seeder
├── src/
│   ├── app/
│   │   ├── page.tsx              # Dashboard with progress rings
│   │   ├── courses/              # Course browser + detail pages
│   │   ├── hub/                  # BU Hub requirements tracker
│   │   ├── degree/               # CS BA degree requirements
│   │   ├── planner/              # Drag-and-drop semester planner
│   │   ├── programs/             # Major/minor program tracking
│   │   └── api/                  # API routes for mutations
│   ├── components/               # Shared UI components
│   └── lib/                      # Utilities, scrapers, DB logic
│       ├── progress.ts           # Central data function (getOverallProgress)
│       ├── prerequisites.ts      # Prerequisite checking + tree building
│       └── scraper/              # Course catalog parsing pipeline
├── data/                         # Static data files
├── public/                       # Static assets
└── vercel.json                   # Vercel deployment config + cron jobs
```

## Deployment

The app is configured for [Vercel](https://vercel.com/):

1. Connect your GitHub repo to Vercel
2. Add all environment variables from `.env.example` in the Vercel dashboard
3. Deploy — Vercel runs `prisma generate && next build` automatically

A weekly cron job (`vercel.json`) refreshes RateMyProfessors ratings every Monday at 6 AM UTC.

## Adding Screenshots

To add screenshots to this README:

1. Create a `docs/screenshots/` directory
2. Run the app and take screenshots, or use the built-in script:
   ```bash
   npm run screenshot
   ```
3. Uncomment the image tags at the top of this README and update the paths

## License

This is a personal academic project. Not affiliated with Boston University.
