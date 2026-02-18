import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import PostCard from "@/components/PostCard";
import { Settings, Grid3X3, Bookmark, Lock } from "lucide-react";
import { toast } from "sonner";
import CertificationBadge from "@/components/CertificationBadge";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    setProfile(p);
    setBio(p?.bio || "");

      const [{ count: fc }, { count: fgc }, { data: postsData }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id).eq("status", "accepted"),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id).eq("status", "accepted"),
      supabase.from("posts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setFollowers(fc || 0);
    setFollowing(fgc || 0);
    setPosts(postsData || []);
  };

  const saveBio = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ bio }).eq("user_id", user.id);
    setEditing(false);
    toast.success("Bio mise à jour !");
  };

  

  if (!profile) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <h2 className="font-display font-bold text-foreground">@{profile.username}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/settings")} className="p-2 text-muted-foreground hover:text-foreground"><Settings size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {/* Profile info */}
        <div className="px-4 py-6 space-y-4">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
              ) : (
                profile.username[0]?.toUpperCase()
              )}
            </div>
            <div className="flex gap-6 text-center">
              <div><p className="font-bold text-foreground">{posts.length}</p><p className="text-xs text-muted-foreground">Posts</p></div>
              <div><p className="font-bold text-foreground">{followers}</p><p className="text-xs text-muted-foreground">Followers</p></div>
              <div><p className="font-bold text-foreground">{following}</p><p className="text-xs text-muted-foreground">Following</p></div>
            </div>
          </div>

          <div>
            <p className="font-semibold text-foreground flex items-center gap-1">{profile.display_name} <CertificationBadge type={profile.certification_type} size={16} /></p>
            {profile.clan && <p className="text-xs text-primary font-medium">Clan: {profile.clan}</p>}
            {editing ? (
              <div className="mt-2 flex gap-2">
                <input value={bio} onChange={(e) => setBio(e.target.value)} className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="Ta bio..." maxLength={150} />
                <button onClick={saveBio} className="text-primary text-sm font-medium">OK</button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1 cursor-pointer" onClick={() => setEditing(true)}>
                {profile.bio || "Ajouter une bio..."}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-border">
          <button onClick={() => setTab("posts")} className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-sm border-b-2 transition-all ${tab === "posts" ? "text-foreground border-primary" : "text-muted-foreground border-transparent"}`}>
            <Grid3X3 size={16} /> Posts
          </button>
          <button onClick={() => setTab("saved")} className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-sm border-b-2 transition-all ${tab === "saved" ? "text-foreground border-primary" : "text-muted-foreground border-transparent"}`}>
            <Bookmark size={16} /> Favoris
          </button>
        </div>

        {/* Posts grid */}
        <div className="px-4 py-4 space-y-4">
          {posts.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Aucune publication</p>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
