
-- Table to track last read timestamp per user per group
CREATE TABLE public.group_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own group reads" ON public.group_reads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own group reads" ON public.group_reads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own group reads" ON public.group_reads FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for group_reads
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_reads;
