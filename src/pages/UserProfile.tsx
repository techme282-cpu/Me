import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import PostCard from "@/components/PostCard";
import { ArrowLeft, Lock, Flag, UserPlus, UserMinus, Grid3X3, Bookmark, MessageCircle, Ban, X } from "lucide-react";
import { toast } from "sonner";
import CertificationBadge from "@/components/CertificationBadge";
import { sendNotification } from "@/lib/notifications";

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
  const [showFollowersList, setShowFollowersList] = useState<"followers" | "following" | null>(null);
  const [followersList, setFollowersList] = useState<any[]>([]);

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

    // If banned, don't load posts
    if (p?.is_banned) return;

    const canSee = !p?.is_private || (user && (currentFollowStatus === "accepted" || userId === user.id));
    if (canSee) {
      const { data: postsData } = await supabase
        .from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      setPosts((postsData || []).map((post: any) => ({
        ...post,
        profiles: p ? { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, certification_type: p.certification_type } : null,
      })));

      const { data: favData } = await supabase.from("post_favorites").select("post_id").eq("user_id", userId);
      if (favData?.length) {
        const postIds = favData.map((f: any) => f.post_id);
        const { data: favPosts } = await supabase.from("posts").select("*").in("id", postIds).order("created_at", { ascending: false });
        if (favPosts?.length) {
          const uids = [...new Set(favPosts.map((fp: any) => fp.user_id))];
          const { data: profs } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url, certification_type").in("user_id", uids);
          const profMap = new Map((profs || []).map((pr: any) => [pr.user_id, pr]));
          setFavorites(favPosts.map((fp: any) => ({ ...fp, profiles: profMap.get(fp.user_id) || null })));
        }
      }

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

      const { data: myProfile } = await supabase.from("profiles").select("username").eq("user_id", user.id).single();
      sendNotification({
        userId,
        type: status === "pending" ? "follow_request" : "follow",
        title: status === "pending"
          ? `${myProfile?.username || "Quelqu'un"} vous a envoyé une demande d'abonnement`
          : `${myProfile?.username || "Quelqu'un"} a commencé à vous suivre`,
        relatedUserId: user.id,
      });
    }
  };

  const handleReport = async () => {
    const reason = prompt("Raison du signalement:");
    if (!reason || !user || !userId) return;
    await supabase.from("reports").insert({ reporter_id: user.id, reported_user_id: userId, reason });
    toast.success("Signalement envoyé");
  };

  const loadFollowList = async (type: "followers" | "following") => {
    if (!userId) return;
    setShowFollowersList(type);
    setFollowersList([]);
    
    let userIds: string[] = [];
    if (type === "followers") {
      const { data } = await supabase.from("follows").select("follower_id").eq("following_id", userId).eq("status", "accepted");
      userIds = (data || []).map(f => f.follower_id);
    } else {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", userId).eq("status", "accepted");
      userIds = (data || []).map(f => f.following_id);
    }
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url, certification_type, is_banned").in("user_id", userIds);
      setFollowersList(profiles || []);
    }
  };

  if (!profile) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  // Banned profile view
  if (profile.is_banned) {
    return (
      <div className="min-h-screen pb-6">
        <header className="sticky top-0 z-40 glass border-b border-border">
          <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={22} /></button>
            <h2 className="font-display font-bold text-foreground">@{profile.username}</h2>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-20 px-6 space-y-4">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <Ban size={40} className="text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-destructive">Compte banni par Purge Hub 🚫</h2>
          <p className="text-sm text-muted-foreground text-center">Ce compte a été banni et n'est plus accessible.</p>
        </div>
      </div>
    );
  }

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
            <button onClick={() => loadFollowList("followers")}><p className="font-bold text-foreground">{followers}</p><p className="text-xs text-muted-foreground">Followers</p></button>
            <button onClick={() => loadFollowList("following")}><p className="font-bold text-foreground">{following}</p><p className="text-xs text-muted-foreground">Following</p></button>
          </div>
        </div>

        <div>
          <p className="font-semibold text-foreground flex items-center gap-1">{profile.display_name} <CertificationBadge type={profile.certification_type} size={16} /></p>
          {profile.clan && <p className="text-xs text-primary font-medium">Clan: {profile.clan}</p>}
          {profile.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
        </div>

        {user && user.id !== userId && (
          <div className="flex gap-2">
            <button onClick={handleFollow} className={`flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${isFollowing ? "bg-secondary text-foreground" : followStatus === "pending" ? "bg-secondary text-muted-foreground" : "gradient-primary text-primary-foreground glow-primary"}`}>
              {isFollowing ? <><UserMinus size={16} /> Suivi</> : followStatus === "pending" ? "En attente" : <><UserPlus size={16} /> Suivre</>}
            </button>
            <button
              onClick={() => navigate(`/chat/${userId}`)}
              className="px-4 py-2 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 transition-colors flex items-center gap-1.5 text-sm font-semibold"
            >
              <MessageCircle size={16} /> Msg
            </button>
            <button onClick={handleReport} className="px-3 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-destructive transition-colors">
              <Flag size={16} />
            </button>
          </div>
        )}

        {profile.is_private && !isFollowing && user?.id !== userId ? (
          <div className="text-center py-12 space-y-3">
            <Lock size={40} className="mx-auto text-muted-foreground" />
            <p className="text-lg font-semibold text-foreground">Compte Privé 🔒</p>
            <p className="text-sm text-muted-foreground">Seuls les abonnés peuvent voir les publications.</p>
          </div>
        ) : (
          <>
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
                  <PostCard key={post.id} post={post} isLiked={likedIds.has(post.id)} isSaved={savedIds.has(post.id)} />
                ))
              )}
            </div>
          </>
        )}
      </main>

      {/* Followers/Following modal */}
      {showFollowersList && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-end sm:items-center justify-center" onClick={() => setShowFollowersList(null)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-bold text-foreground">{showFollowersList === "followers" ? "Followers" : "Following"}</h3>
              <button onClick={() => setShowFollowersList(null)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] divide-y divide-border/50">
              {followersList.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">Aucun résultat</p>
              ) : (
                followersList.map((p) => (
                  <button
                    key={p.user_id}
                    onClick={() => { setShowFollowersList(null); navigate(`/user/${p.user_id}`); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm overflow-hidden">
                      {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full rounded-full object-cover" alt="" /> : p.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="text-left flex-1">
                      {p.is_banned ? (
                        <p className="text-sm text-destructive font-medium flex items-center gap-1"><Ban size={12} /> Banni</p>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground flex items-center gap-1">
                            {p.display_name || p.username}
                            <CertificationBadge type={p.certification_type} size={12} />
                          </p>
                          <p className="text-xs text-muted-foreground">@{p.username}</p>
                        </>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
