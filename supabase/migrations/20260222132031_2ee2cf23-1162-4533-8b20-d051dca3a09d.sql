
-- Auto-update comment_count via trigger (no need for client-side update)
CREATE OR REPLACE FUNCTION public.update_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = (SELECT count(*) FROM comments WHERE post_id = NEW.post_id) WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comment_count = (SELECT count(*) FROM comments WHERE post_id = OLD.post_id) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_comment_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_comment_count();

-- Auto-update like_count via trigger
CREATE OR REPLACE FUNCTION public.update_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET like_count = (SELECT count(*) FROM post_likes WHERE post_id = NEW.post_id) WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET like_count = (SELECT count(*) FROM post_likes WHERE post_id = OLD.post_id) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_like_count
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_like_count();

-- Allow admins to update any post (for moderation)
CREATE POLICY "Admins update any post"
ON public.posts FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
