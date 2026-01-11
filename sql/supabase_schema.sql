-- ============================================
-- StreamGo Profiles - Supabase Schema
-- ============================================
-- Run this entire script in your Supabase SQL Editor
-- to set up the Profiles database tables.
--
-- This creates:
--   - profiles table (user profiles)
--   - profile_watchlist table (per-profile watchlists)
--   - profile_continue_watching table (per-profile watch progress)
--   - Row Level Security policies
--   - Indexes for performance
--   - Triggers for auto-updating timestamps
-- ============================================

-- ============================================
-- TABLES
-- ============================================

-- Profiles table: stores user profiles linked to Stremio accounts
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL,                       -- SHA-256 hash of Stremio auth key
    name TEXT NOT NULL,                             -- Profile display name
    avatar_id TEXT DEFAULT 'gradient-purple',       -- Predefined avatar identifier
    is_active BOOLEAN DEFAULT false,                -- Currently active profile flag
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ                          -- Soft delete timestamp (null = active)
);

-- Watchlist table: stores watchlist items per profile
CREATE TABLE IF NOT EXISTS profile_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,                       -- Stremio content ID (e.g., tt0903747)
    content_type TEXT NOT NULL,                     -- 'movie' or 'series'
    title TEXT,                                     -- Cached title for display
    poster TEXT,                                    -- Cached poster URL
    status TEXT DEFAULT 'watching',                 -- watching, completed, plan_to_watch, dropped
    added_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,                         -- Soft delete timestamp
    UNIQUE(profile_id, content_id)
);

-- Continue watching table: stores playback progress per profile
CREATE TABLE IF NOT EXISTS profile_continue_watching (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,                       -- Stremio content ID
    video_id TEXT,                                  -- Specific video/episode ID
    content_type TEXT NOT NULL,                     -- 'movie' or 'series'
    title TEXT,                                     -- Cached title for display
    poster TEXT,                                    -- Cached poster URL
    progress REAL NOT NULL DEFAULT 0,               -- Playback position in seconds
    duration REAL,                                  -- Total duration in seconds
    season INTEGER,                                 -- Season number (for series)
    episode INTEGER,                                -- Episode number (for series)
    stream_hash TEXT,                               -- Last used stream hash for quick resume
    last_watched_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,                         -- Soft delete timestamp
    UNIQUE(profile_id, content_id, video_id)
);

-- ============================================
-- INDEXES
-- ============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_account_id ON profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
CREATE INDEX IF NOT EXISTS idx_profiles_account_active ON profiles(account_id, is_active) WHERE deleted_at IS NULL;

-- Watchlist indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_profile_id ON profile_watchlist(profile_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_updated_at ON profile_watchlist(updated_at);
CREATE INDEX IF NOT EXISTS idx_watchlist_profile_status ON profile_watchlist(profile_id, status) WHERE deleted_at IS NULL;

-- Continue watching indexes
CREATE INDEX IF NOT EXISTS idx_continue_profile_id ON profile_continue_watching(profile_id);
CREATE INDEX IF NOT EXISTS idx_continue_updated_at ON profile_continue_watching(updated_at);
CREATE INDEX IF NOT EXISTS idx_continue_last_watched ON profile_continue_watching(profile_id, last_watched_at DESC) WHERE deleted_at IS NULL;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_continue_watching ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Access own profiles" ON profiles;
DROP POLICY IF EXISTS "Access own watchlist" ON profile_watchlist;
DROP POLICY IF EXISTS "Access own continue watching" ON profile_continue_watching;

-- Profiles policy: users can only access profiles matching their account_id
-- The account_id is passed via the x-account-id header
CREATE POLICY "Access own profiles" ON profiles FOR ALL
    USING (account_id = current_setting('request.headers', true)::json->>'x-account-id');

-- Watchlist policy: users can only access watchlist items for their profiles
CREATE POLICY "Access own watchlist" ON profile_watchlist FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = profile_watchlist.profile_id
        AND profiles.account_id = current_setting('request.headers', true)::json->>'x-account-id'
    ));

-- Continue watching policy: users can only access continue watching for their profiles
CREATE POLICY "Access own continue watching" ON profile_continue_watching FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = profile_continue_watching.profile_id
        AND profiles.account_id = current_setting('request.headers', true)::json->>'x-account-id'
    ));

-- ============================================
-- TRIGGERS
-- ============================================

-- Function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist (for re-running script)
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS watchlist_updated_at ON profile_watchlist;
DROP TRIGGER IF EXISTS continue_watching_updated_at ON profile_continue_watching;

-- Create triggers for auto-updating timestamps
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER watchlist_updated_at
    BEFORE UPDATE ON profile_watchlist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER continue_watching_updated_at
    BEFORE UPDATE ON profile_continue_watching
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- DONE!
-- ============================================
-- Your StreamGo Profiles database is now ready.
-- You can close this SQL editor and return to StreamGo.
-- ============================================
