# 🧭 Trip Planner Pro — Setup & Deployment Guide

## What You're Deploying

A secure, database-backed web app with:
- **User accounts** with email/password login
- **Family profiles** with members, gear inventory, and car snack preferences
- **Trip planning** with themed interfaces per trip type
- **Full camping system**: attendance, meals, snacks, drinks, inventory bins, car loading, pre-trip checklists, auto-scaled grocery lists
- All data stored securely in a real database (Supabase)

---

## Step 1: Create a Supabase Account (Free)

1. Go to **https://supabase.com** and click "Start your project"
2. Sign up with GitHub (easiest) or email
3. Click **"New Project"**
4. Give it a name like `trip-planner-pro`
5. Set a database password (save this somewhere safe)
6. Choose the region closest to you
7. Click **"Create new project"** — wait ~2 minutes for it to set up

## Step 2: Set Up the Database

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New Query"**
3. Open the file `lib/schema.sql` from this project
4. Copy the ENTIRE contents and paste it into the SQL editor
5. Click **"Run"** (the green play button)
6. You should see "Success" — this creates all your tables

## Step 3: Get Your API Keys

1. In Supabase, go to **Settings** (gear icon) → **API**
2. Copy the **Project URL** (looks like `https://abc123.supabase.co`)
3. Copy the **anon/public key** (the long string under "Project API keys")

## Step 4: Set Up the Code

On your computer:

```bash
# Navigate to the project folder
cd trip-planner-pro

# Create your environment file
cp .env.local.example .env.local
```

Open `.env.local` and paste your Supabase values:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Then install and run:
```bash
npm install
npm run dev
```

Open **http://localhost:3000** — you should see the login page!

## Step 5: Configure Supabase Auth

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to `http://localhost:3000` (for local dev)
3. Add `http://localhost:3000/auth/callback` to **Redirect URLs**

For production, you'll add your Vercel URL here too (step 7).

## Step 6: Deploy to Vercel

1. Push your code to GitHub (see previous guide for git commands)
2. Go to **https://vercel.com** → Sign up with GitHub → Import your repo
3. In the project settings, add your **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy**

Once deployed, go back to Supabase:
- **Authentication** → **URL Configuration**
- Update **Site URL** to your Vercel URL (e.g. `https://trip-planner-pro.vercel.app`)
- Add `https://trip-planner-pro.vercel.app/auth/callback` to Redirect URLs

## Step 7: Invite People

Share your Vercel URL with your camping crew. They can:
1. Click **"Create Account"** on the login page
2. Confirm their email
3. Set up their family profile
4. Get invited to your trips

---

## How It Works

### For you (the organizer):
1. Log in → Set up your family profile (members, gear bins, inventory)
2. Create a new trip → Pick the type (Camping, etc.)
3. Share the URL with your friends so they can create accounts
4. In the trip, set dates, mark attendance, plan meals, assign responsibilities

### For each family:
1. Create their own account at your site URL
2. Set up their family profile with members and gear
3. Open the trip link you share
4. Use the "Viewing as" dropdown to filter to their family
5. Fill in their attendance, claim meals, check their grocery list

---

## Project Structure

```
trip-planner-pro/
├── app/
│   ├── auth/
│   │   ├── login/page.js      ← Login & signup page
│   │   └── callback/route.js  ← Email confirmation handler
│   ├── dashboard/page.js      ← Main hub after login
│   ├── profiles/page.js       ← Family profile management
│   ├── trip/[id]/page.js      ← Full trip interface (all tabs)
│   ├── globals.css             ← Modern dark theme styles
│   ├── layout.js               ← Root layout
│   └── page.js                 ← Redirect to dashboard/login
├── lib/
│   ├── constants.js            ← Themes, trip types, categories
│   ├── utils.js                ← Portion math, date helpers
│   ├── schema.sql              ← Database schema (run once in Supabase)
│   ├── supabase-browser.js     ← Client-side Supabase client
│   └── supabase-server.js      ← Server-side Supabase client
├── middleware.js                ← Auth route protection
├── package.json
└── .env.local.example          ← Template for your API keys
```

## Adding Features Later

The app is structured so each feature is in its own file. To add or modify:
- **New trip type tabs**: Add to `app/trip/[id]/page.js`
- **New profile data**: Add columns in Supabase SQL editor, then update `app/profiles/page.js`
- **New constants**: Add to `lib/constants.js`
- **Visual theme tweaks**: Edit `lib/constants.js` (THEMES object) and `app/globals.css`

## Security

- All data is protected by Supabase Row Level Security (RLS)
- Users can only see and edit their own data
- Passwords are hashed by Supabase Auth (industry standard bcrypt)
- API keys are public-safe (anon key) — the real security is in RLS policies
