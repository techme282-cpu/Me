import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import PostCard from "@/components/PostCard";
import { ArrowLeft } from "lucide-react";

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (postId) fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    const { data } = await supabase.from("posts").select("*").eq("id", postId!).single();
    if (!data) return;

    const { data: prof } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").eq("user_id", data.user_id).single();
    setPost({ ...data, profiles: prof });

    if (user) {
      const [{ data: like }, { data: fav }] = await Promise.all([
        supabase.from("post_likes").select("id").eq("user_id", user.id).eq("post_id", postId!).single(),
        supabase.from("post_favorites").select("id").eq("user_id", user.id).eq("post_id", postId!).single(),
      ]);
      setIsLiked(!!like);
      setIsSaved(!!fav);
    }

    // Increment view count
    await supabase.from("posts").update({ view_count: (data.view_count || 0) + 1 }).eq("id", postId!);
  };

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <h2 className="font-display font-bold text-foreground">Publication</h2>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">
        <PostCard post={post} isLiked={isLiked} isSaved={isSaved} />
      </main>
    </div>
  );
}
