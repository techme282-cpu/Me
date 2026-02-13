
-- Add permission columns to groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS admin_only_edit boolean DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS require_approval boolean DEFAULT false;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS invite_code text UNIQUE DEFAULT NULL;

-- Add status to group_members for pending invites
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Allow group admins to update group settings
DROP POLICY IF EXISTS "Creator updates group" ON public.groups;
CREATE POLICY "Admins update group"
ON public.groups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = groups.id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('owner', 'admin')
  )
);
