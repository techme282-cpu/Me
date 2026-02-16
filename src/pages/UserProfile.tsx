import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import PostCard from "@/components/PostCard";
import { ArrowLeft, Lock, Flag, UserPlus, UserMinus, Grid3X3, Bookmark, Heart } from "lucide-react";
import { toast } from "sonner";

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followStatus, setFollowStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "favorites">("posts");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userId) fetchData();
  }, [userId]);

  const fetchData = async () => {
    if (!userId) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
    setProfile(p);

    const [{ count: fc }, { count: fgc }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId).eq("status", "accepted"),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId).eq("status", "accepted"),
    ]);
    setFollowers(fc || 0);
    setFollowing(fgc || 0);

    let currentFollowStatus: string | null = null;
    if (user) {
      const { data: f } = await supabase.from("follows").select("status").eq("follower_id", user.id).eq("following_id", userId).single();
      if (f) {
        setIsFollowing(f.status === "accepted");
        setFollowStatus(f.status);
        currentFollowStatus = f.status;
      }
    }

    const canSee = !p?.is_private || (user && (currentFollowStatus === "accepted" || userId === user.id));
    if (canSee) {
      const { data: postsData } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setPosts((postsData || []).map((post: any) => ({
        ...post,
        profiles: p ? { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url } : null,
      })));

      // Fetch favorites
      const { data: favData } = await supabase
        .from("post_favorites")
        .select("post_id")
        .eq("user_id", userId);
      if (favData?.length) {
        const postIds = favData.map((f: any) => f.post_id);
        const { data: favPosts } = await supabase.from("posts").select("*").in("id", postIds).order("created_at", { ascending: false });
        if (favPosts?.length) {
          const uids = [...new Set(favPosts.map((fp: any) => fp.user_id))];
          const { data: profs } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", uids);
          const profMap = new Map((profs || []).map((pr: any) => [pr.user_id, pr]));
          setFavorites(favPosts.map((fp: any) => ({ ...fp, profiles: profMap.get(fp.user_id) || null })));
        }
      }

      // Fetch current user's likes/saves for display
      if (user) {
        const [likes, saves] = await Promise.all([
          supabase.from("post_likes").select("post_id").eq("user_id", user.id),
          supabase.from("post_favorites").select("post_id").eq("user_id", user.id),
        ]);
        setLikedIds(new Set((likes.data || []).map((l: any) => l.post_id)));
        setSavedIds(new Set((saves.data || []).map((s: any) => s.post_id)));
      }
    }
  };

  const handleFollow = async () => {
    if (!user || !userId) return;
    if (isFollowing || followStatus === "pending") {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      setIsFollowing(false);
      setFollowStatus(null);
      setFollowers((c) => c - 1);
    } else {
      const status = profile?.is_private ? "pending" : "accepted";
      await supabase.from("follows").insert({ follower_id: user.id, following_id: userId, status });
      setFollowStatus(status);
      if (status === "accepted") { setIsFollowing(true); setFollowers((c) => c + 1); }
      else toast.info("Demande envoyée");
    }
  };

  const handleReport = async () => {
    const reason = prompt("Raison du signalement:");
    if (!reason || !user || !userId) return;
    await supabase.from("reports").insert({ reporter_id: user.id, reported_user_id: userId, reason });
    toast.success("Signalement envoyé");
  };

  if (!profile) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const displayPosts = activeTab === "posts" ? posts : favorites;

  return (
    <div className="min-h-screen pb-6">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={22} /></button>
          <h2 className="font-display font-bold text-foreground">@{profile.username}</h2>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground shrink-0">
            {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="" /> : profile.username[0]?.toUpperCase()}
          </div>
          <div className="flex gap-6 text-center">
            <div><p className="font-bold text-foreground">{posts.length}</p><p className="text-xs text-muted-foreground">Posts</p></div>
            <div><p className="font-bold text-foreground">{followers}</p><p className="text-xs text-muted-foreground">Followers</p></div>
            <div><p className="font-bold text-foreground">{following}</p><p className="text-xs text-muted-foreground">Following</p></div>
          </div>
        </div>

        <div>
          <p className="font-semibold text-foreground">{profile.display_name}</p>
          {profile.clan && <p className="text-xs text-primary font-medium">Clan: {profile.clan}</p>}
          {profile.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
        </div>

        {user && user.id !== userId && (
          <div className="flex gap-2">
            <button onClick={handleFollow} className={`flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${isFollowing ? "bg-secondary text-foreground" : followStatus === "pending" ? "bg-secondary text-muted-foreground" : "gradient-primary text-primary-foreground glow-primary"}`}>
              {isFollowing ? <><UserMinus size={16} /> Suivi</> : followStatus === "pending" ? "En attente" : <><UserPlus size={16} /> Suivre</>}
            </button>
            <button onClick={handleReport} className="px-4 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-destructive transition-colors">
              <Flag size={16} />
            </button>
          </div>
        )}

        {profile.is_private && !isFollowing && user?.id !== userId ? (
          <div className="text-center py-12 space-y-3">
            <Lock size={40} className="mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Ce compte est privé</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab("posts")}
                className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-all ${activeTab === "posts" ? "text-primary border-primary" : "text-muted-foreground border-transparent"}`}
              >
                <Grid3X3 size={16} /> Posts
              </button>
              <button
                onClick={() => setActiveTab("favorites")}
                className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-all ${activeTab === "favorites" ? "text-primary border-primary" : "text-muted-foreground border-transparent"}`}
              >
                <Bookmark size={16} /> Favoris
              </button>
            </div>

            <div className="space-y-4">
              {displayPosts.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {activeTab === "posts" ? "Aucune publication" : "Aucun favori"}
                </p>
              ) : (
                displayPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isLiked={likedIds.has(post.id)}
                    isSaved={savedIds.has(post.id)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
