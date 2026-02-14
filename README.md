# Coaching Dashboard v1

Personal fat loss coaching dashboard with biometric tracking, meal logging, and trend visualization.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase (free cloud database)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** — pick any name and password
3. Once the project is ready, go to **SQL Editor** (left sidebar)
4. Open the file `supabase-migration.sql` from this project, copy its contents, paste into the SQL editor, and click **Run**
5. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://abc123.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

6. Create a `.env` file in the project root:
```bash
cp .env.example .env
```

7. Paste your values:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

> **Note:** The app works without Supabase (local-only mode), but data won't sync across devices.

### 3. Run locally
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Deploy to Vercel (get a phone-accessible URL)

1. Push this project to a GitHub repo
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click **Import Project** → select your repo
4. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy**

You'll get a URL like `coaching-dashboard.vercel.app` that works on any device.

## Features

- **Daily Dashboard** — Biometrics entry, calorie/protein gauges, deficit alerting, daily checklist
- **Meal Logger** — Preset quick-add (coffee, rice cakes, sardines, etc.) with quantity, custom entry
- **Trend Charts** — Weight, HRV, RHR, sleep score, and deficit tracking over time
- **Smart Checklist** — Sardines, fermented, fiber, resistant starch auto-checked from meal tags
- **Ride Day Support** — Xert burn input auto-adjusts daily calorie budget
- **Cloud Sync** — Supabase backend syncs data across all your devices
- **Day Lock** — End-of-day review locks data and records final deficit

## Protocol Constants

| Parameter | Value |
|-----------|-------|
| Baseline burn | 2180 kcal/day |
| Target deficit | 500 kcal/day |
| Rest day budget | 1680 kcal |
| Protein target | 160g/day |
| Goal weight | 183 lb |
| Goal date | April 1, 2026 |
