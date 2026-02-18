import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, LogOut, User, Shield, Moon, Bell, Lock, ChevronRight, Camera, Check, X, BadgeCheck } from "lucide-react";
import CertificationBadge from "@/components/CertificationBadge";

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [clan, setClan] = useState("");

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (data) {
      setProfile(data);
      setIsPrivate(data.is_private || false);
      setDisplayName(data.display_name || "");
      setUsername(data.username || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");
      setClan(data.clan || "");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const togglePrivate = async () => {
    if (!user) return;
    const newVal = !isPrivate;
    setIsPrivate(newVal);
    await supabase.from("profiles").update({ is_private: newVal }).eq("user_id", user.id);
    toast.success(newVal ? "Compte privé activé" : "Compte public");
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!username.trim()) { toast.error("Username requis"); return; }
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim(),
      username: username.trim(),
      bio: bio.trim(),
      avatar_url: avatarUrl.trim() || null,
      clan: clan.trim(),
    }).eq("user_id", user.id);
    if (error) {
      if (error.message.includes("unique")) toast.error("Ce username est déjà pris");
      else toast.error("Erreur: " + error.message);
      return;
    }
    toast.success("Profil mis à jour !");
    setEditing(false);
    fetchProfile();
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <h2 className="font-display font-bold text-foreground">Paramètres</h2>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Profile editing */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Mon profil</h3>
          {editing ? (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nom d'affichage</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  maxLength={30} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  maxLength={20} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground mt-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                  rows={3} maxLength={150} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">URL de l'avatar</label>
                <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Clan</label>
                <input value={clan} onChange={(e) => setClan(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground mt-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  maxLength={30} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveProfile} className="flex-1 gradient-primary text-primary-foreground py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1">
                  <Check size={16} /> Sauvegarder
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2.5 bg-secondary rounded-xl text-muted-foreground">
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <button onClick={() => setEditing(true)} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors text-left">
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    profile?.username?.[0]?.toUpperCase() || "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{profile?.display_name || profile?.username}</p>
                  <p className="text-xs text-muted-foreground">@{profile?.username}</p>
                  {profile?.bio && <p className="text-xs text-muted-foreground mt-0.5 truncate">{profile.bio}</p>}
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Account */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Compte</h3>
          <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
            <button onClick={togglePrivate} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors text-left">
              <Lock size={20} className="text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground">{isPrivate ? "Compte privé ✓" : "Passer en privé"}</span>
              <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${isPrivate ? "bg-primary" : "bg-muted"}`}>
                <div className={`w-5 h-5 rounded-full bg-foreground transition-transform ${isPrivate ? "translate-x-4" : ""}`} />
              </div>
            </button>
            <button onClick={() => navigate("/certification")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors text-left">
              <BadgeCheck size={20} className="text-muted-foreground" />
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Demander la certification</span>
                {profile?.certification_type && <CertificationBadge type={profile.certification_type} size={14} />}
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Preferences */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Préférences</h3>
          <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
            <button onClick={() => navigate("/notifications")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors text-left">
              <Bell size={20} className="text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground">Notifications</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Security */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Sécurité</h3>
          <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
            <button onClick={() => navigate("/privacy")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors text-left">
              <Shield size={20} className="text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground">Confidentialité</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Logout */}
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-destructive/10 border border-destructive/20 rounded-2xl hover:bg-destructive/20 transition-colors">
          <LogOut size={20} className="text-destructive" />
          <span className="text-sm font-semibold text-destructive">Se déconnecter</span>
        </button>

        <p className="text-center text-xs text-muted-foreground pt-4">PURGE HUB v1.0</p>
      </main>
    </div>
  );
}
