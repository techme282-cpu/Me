
-- Allow group members to see group messages
CREATE POLICY "Group members see group messages"
ON public.messages
FOR SELECT
USING (
  group_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = messages.group_id AND gm.user_id = auth.uid()
  )
);

-- Allow group members to send group messages
CREATE POLICY "Group members send group messages"
ON public.messages
FOR INSERT
WITH CHECK (
  group_id IS NOT NULL
  AND auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = messages.group_id AND gm.user_id = auth.uid()
  )
);

-- Allow group members to update group messages (for is_read etc)
CREATE POLICY "Group members update group messages"
ON public.messages
FOR UPDATE
USING (
  group_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = messages.group_id AND gm.user_id = auth.uid()
  )
);

-- Add description column to groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description text DEFAULT '';

-- Add status column to groups  
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Allow group members to leave (delete their own membership)
CREATE POLICY "Members leave groups"
ON public.group_members
FOR DELETE
USING (auth.uid() = user_id);

-- Allow admins/owners to update member roles
CREATE POLICY "Admins update member roles"
ON public.group_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('owner', 'admin')
  )
);

-- Allow owners to delete groups
CREATE POLICY "Owners delete groups"
ON public.groups
FOR DELETE
USING (auth.uid() = created_by);

-- Enable realtime for messages and group_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
