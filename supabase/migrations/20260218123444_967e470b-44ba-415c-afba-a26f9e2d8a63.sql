
-- Add certification_type column to profiles (null = no certification, 'verified', 'creator', 'official')
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certification_type text DEFAULT NULL;

-- Set admin account as 'official'
UPDATE public.profiles SET certification_type = 'official' WHERE user_id = '23e3ae81-1eda-4fb1-9e12-6a82aabff93f';
