
CREATE OR REPLACE FUNCTION public.get_ranked_posts(requesting_user_id uuid, feed_limit integer DEFAULT 50)
 RETURNS SETOF posts
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT p.*
  FROM public.posts p
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE (pr.is_banned IS NULL OR pr.is_banned = false)
  ORDER BY
    p.is_boosted DESC,
    (random()) DESC
  LIMIT feed_limit;
$$;
