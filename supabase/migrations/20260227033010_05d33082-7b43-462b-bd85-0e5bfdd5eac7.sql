
-- Table to store user's favorite stickers
CREATE TABLE public.favorite_stickers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sticker_url TEXT NOT NULL,
  sticker_set_name TEXT,
  emoji TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, sticker_url)
);

-- Enable RLS
ALTER TABLE public.favorite_stickers ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users view own favorite stickers"
ON public.favorite_stickers FOR SELECT
USING (auth.uid() = user_id);

-- Users can add their own favorites
CREATE POLICY "Users add own favorite stickers"
ON public.favorite_stickers FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove their own favorites
CREATE POLICY "Users delete own favorite stickers"
ON public.favorite_stickers FOR DELETE
USING (auth.uid() = user_id);
