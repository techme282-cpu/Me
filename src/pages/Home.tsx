import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import PostCard from "@/components/PostCard";
import BottomNav from "@/components/BottomNav";
import StoriesBar from "@/components/StoriesBar";
import { Bell, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnreadCount(count || 0);
    };
    fetchCount();

    const channel = supabase
      .channel("notif-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => fetchCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    fetchPosts();
  }, [tab, user]);

  const fetchPosts = async () => {
    setLoading(true);

    let postsData: any[] = [];

    if (tab === "foryou") {
      // Use the ranking algorithm
      const { data } = await supabase.rpc("get_ranked_posts", {
        requesting_user_id: user?.id || "00000000-0000-0000-0000-000000000000",
        feed_limit: 50,
      });
      postsData = data || [];
    } else {
      // Following tab: only posts from people I follow
      if (!user) { setLoading(false); return; }
      const { data: followData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .eq("status", "accepted");
      const followingIds = (followData || []).map((f) => f.following_id);
      if (followingIds.length === 0) { setPosts([]); setLoading(false); return; }
      const { data } = await supabase
        .from("posts")
        .select("*")
        .in("user_id", followingIds)
        .order("created_at", { ascending: false })
        .limit(50);
      postsData = data || [];
    }

    

    // Fetch profiles for all posts
    const userIds = [...new Set((postsData || []).map((p: any) => p.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, certification_type")
      .in("user_id", userIds);

    const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
    const enriched = (postsData || []).map((post: any) => ({
      ...post,
      profiles: profileMap.get(post.user_id) || null,
    }));
    setPosts(enriched);

    if (user) {
      const [likes, favs] = await Promise.all([
        supabase.from("post_likes").select("post_id").eq("user_id", user.id),
        supabase.from("post_favorites").select("post_id").eq("user_id", user.id),
      ]);
      setLikedIds(new Set((likes.data || []).map((l) => l.post_id)));
      setSavedIds(new Set((favs.data || []).map((f) => f.post_id)));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <h1 className="text-xl font-display font-bold text-gradient flex items-center gap-1.5">
            <Flame size={22} className="text-accent" />
            PURGE HUB
          </h1>
          <button onClick={() => navigate("/notifications")} className="relative p-2 text-muted-foreground hover:text-foreground">
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex max-w-lg mx-auto">
          {(["foryou", "following"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-all border-b-2 ${
                tab === t ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {t === "foryou" ? "Pour toi" : "Abonnements"}
            </button>
          ))}
        </div>
      </header>

      {/* Stories */}
      <div className="max-w-lg mx-auto border-b border-border">
        <StoriesBar />
      </div>

      {/* Feed */}
      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl border border-border h-80 animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <Flame size={48} className="mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Aucune publication pour le moment</p>
            <button
              onClick={() => navigate("/create")}
              className="gradient-primary text-primary-foreground px-6 py-2 rounded-full font-medium text-sm"
            >
              Créer la première
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isLiked={likedIds.has(post.id)}
              isSaved={savedIds.has(post.id)}
            />
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
