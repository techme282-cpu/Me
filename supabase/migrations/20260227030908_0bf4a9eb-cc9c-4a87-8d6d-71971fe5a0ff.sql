
CREATE OR REPLACE FUNCTION public.get_ranked_posts(requesting_user_id uuid, feed_limit integer DEFAULT 50)
 RETURNS SETOF posts
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT p.*
  FROM public.posts p
  LEFT JOIN public.follows f ON f.follower_id = requesting_user_id AND f.following_id = p.user_id AND f.status = 'accepted'
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE (pr.is_banned IS NULL OR pr.is_banned = false)
  ORDER BY
    p.is_boosted DESC,
    (
      COALESCE(p.like_count, 0) * 3.0
      + COALESCE(p.comment_count, 0) * 5.0
      + COALESCE(p.view_count, 0) * 0.1
      + COALESCE(p.share_count, 0) * 4.0
      + CASE WHEN f.id IS NOT NULL THEN 15.0 ELSE 0.0 END
      + GREATEST(0, 50.0 - EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600.0)
      + (random() * 30.0)
    ) DESC,
    p.created_at DESC
  LIMIT feed_limit;
$$;
