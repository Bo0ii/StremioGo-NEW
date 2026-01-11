# Setting Up Supabase for StreamGo Profiles

This guide walks you through setting up your own Supabase project to enable cloud sync for StreamGo Profiles. The entire process takes about 5 minutes.

## Why Your Own Supabase?

StreamGo Profiles uses a "Bring Your Own Supabase" approach:
- **You control your data** - All profile data is stored in your own Supabase project
- **No shared infrastructure** - Your data is completely separate from other users
- **Free tier friendly** - Supabase's free tier is more than enough for personal use
- **Privacy focused** - Only a hashed version of your Stremio account ID is stored

## Step 1: Create a Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **Start your project** (or sign in if you have an account)
3. Sign up with GitHub, Google, or email

## Step 2: Create a New Project

1. Click **New project**
2. Choose your organization (or create one)
3. Enter project details:
   - **Name**: `streamgo-profiles` (or any name you prefer)
   - **Database Password**: Generate a strong password and save it somewhere safe
   - **Region**: Choose the closest to you for best performance
4. Click **Create new project**
5. Wait for the project to initialize (takes about 2 minutes)

## Step 3: Get Your Project Credentials

Once your project is ready:

1. Go to **Project Settings** (gear icon in the sidebar)
2. Click **API** in the left menu
3. You'll need two values:
   - **Project URL**: Copy the URL under "Project URL" (looks like `https://xxxxx.supabase.co`)
   - **anon public key**: Copy the key under "Project API keys" → "anon" → "public"

> **Note**: The anon key is safe to use in client applications. Security is enforced by Row Level Security (RLS) policies.

## Step 4: Run the Database Setup Script

1. In your Supabase dashboard, click **SQL Editor** in the sidebar
2. Click **New query**
3. Copy the entire contents of [`sql/supabase_schema.sql`](../sql/supabase_schema.sql) from the StreamGo repository
4. Paste it into the SQL Editor
5. Click **Run** (or press Ctrl/Cmd + Enter)
6. You should see "Success. No rows returned" - this means the tables were created

## Step 5: Configure StreamGo

1. Open StreamGo
2. Go to **Settings** → **Enhanced** → **Profiles**
3. Click **Configure Cloud Sync**
4. Paste your **Project URL**
5. Paste your **anon public key**
6. Click **Test Connection** to verify
7. Click **Save**

That's it! Your profiles will now sync across all your devices.

## Troubleshooting

### "Connection failed" error
- Double-check that you copied the full Project URL (including `https://`)
- Make sure you're using the `anon` key, not the `service_role` key
- Verify your Supabase project is active (not paused)

### "Permission denied" error
- Make sure you ran the SQL setup script completely
- Check that RLS policies were created (go to Authentication → Policies in Supabase)

### Profiles not syncing between devices
- Both devices must be logged into the same Stremio account
- Check your internet connection
- Try clicking "Force Sync" in Settings → Profiles

## Managing Your Data

### Viewing your data
1. Go to your Supabase dashboard
2. Click **Table Editor** in the sidebar
3. Select `profiles`, `profile_watchlist`, or `profile_continue_watching`

### Deleting all your data
1. Go to **SQL Editor**
2. Run:
```sql
DELETE FROM profile_continue_watching;
DELETE FROM profile_watchlist;
DELETE FROM profiles;
```

### Pausing your project
Supabase free tier projects pause after 1 week of inactivity. To prevent this:
- Use StreamGo at least once a week, or
- Upgrade to Supabase Pro ($25/month) for always-on

## Security Notes

- Your Stremio account credentials are **never** sent to Supabase
- Only a SHA-256 hash of your Stremio auth key is used as an account identifier
- Row Level Security ensures you can only access your own profiles
- The `anon` key is designed to be public - it cannot bypass RLS
