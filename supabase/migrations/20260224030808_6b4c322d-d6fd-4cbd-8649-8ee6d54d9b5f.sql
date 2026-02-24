
-- Add last_seen for online/offline status
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();

-- Add chat_wallpaper for custom chat background
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_wallpaper text DEFAULT NULL;

-- Create index for last_seen queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles (last_seen);
