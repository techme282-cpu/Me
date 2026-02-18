import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Lock, Eye, EyeOff, UserX, Shield, AlertTriangle } from "lucide-react";

export default function Privacy() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("is_private").eq("user_id", user.id).single();
    setIsPrivate(profile?.is_private || false);

    // Fetch users who blocked/reported
    const { data: reports } = await supabase
      .from("reports")
      .select("reported_user_id, reason, created_at")
      .eq("reporter_id", user.id)
      .not("reported_user_id", "is", null);

    if (reports?.length) {
      const uids = [...new Set(reports.map(r => r.reported_user_id).filter(Boolean))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", uids);
      const profMap = new Map((profs || []).map(p => [p.user_id, p]));
      setBlockedUsers(reports.map(r => ({
        ...r,
        profile: profMap.get(r.reported_user_id!) || null,
      })));
    }
    setLoading(false);
  };

  const togglePrivate = async () => {
    if (!user) return;
    const newVal = !isPrivate;
    setIsPrivate(newVal);
    await supabase.from("profiles").update({ is_private: newVal }).eq("user_id", user.id);
    toast.success(newVal ? "Compte privé activé" : "Compte devenu public");
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    // Delete user's posts, comments, likes, favorites, follows, stories, notifications
    await Promise.all([
      supabase.from("posts").delete().eq("user_id", user.id),
      supabase.from("comments").delete().eq("user_id", user.id),
      supabase.from("post_likes").delete().eq("user_id", user.id),
      supabase.from("post_favorites").delete().eq("user_id", user.id),
      supabase.from("follows").delete().eq("follower_id", user.id),
      supabase.from("follows").delete().eq("following_id", user.id),
      supabase.from("stories").delete().eq("user_id", user.id),
      supabase.from("notifications").delete().eq("user_id", user.id),
      supabase.from("profiles").delete().eq("user_id", user.id),
    ]);
    await signOut();
    toast.success("Compte supprimé");
    navigate("/login");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <h2 className="font-display font-bold text-foreground">Confidentialité</h2>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Visibility */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Visibilité du compte</h3>
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <button onClick={togglePrivate} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/50 transition-colors text-left">
              {isPrivate ? <Lock size={20} className="text-primary" /> : <Eye size={20} className="text-muted-foreground" />}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Compte privé</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPrivate ? "Seuls tes abonnés approuvés voient tes posts" : "Tout le monde peut voir tes publications"}
                </p>
              </div>
              <div className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${isPrivate ? "bg-primary" : "bg-muted"}`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isPrivate ? "translate-x-5" : ""}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Privacy info */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Quand ton compte est privé</h3>
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            {[
              { icon: EyeOff, text: "Tes publications ne sont visibles que par tes abonnés approuvés" },
              { icon: UserX, text: "Les nouveaux abonnés doivent attendre ton approbation" },
              { icon: Shield, text: "Ton profil reste visible mais le contenu est masqué" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <item.icon size={16} className="text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Reported users */}
        {blockedUsers.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Utilisateurs signalés ({blockedUsers.length})</h3>
            <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
              {blockedUsers.map((b, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0 overflow-hidden">
                    {b.profile?.avatar_url ? (
                      <img src={b.profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                    ) : (
                      b.profile?.username?.[0]?.toUpperCase() || "?"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">@{b.profile?.username || "inconnu"}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Danger zone */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Zone dangereuse</h3>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-destructive/10 border border-destructive/20 rounded-2xl hover:bg-destructive/20 transition-colors text-left"
            >
              <AlertTriangle size={20} className="text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive">Supprimer mon compte</p>
                <p className="text-xs text-destructive/70">Cette action est irréversible</p>
              </div>
            </button>
          ) : (
            <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 space-y-3">
              <p className="text-sm text-destructive font-medium">⚠️ Es-tu sûr ? Toutes tes données seront supprimées définitivement.</p>
              <div className="flex gap-2">
                <button onClick={handleDeleteAccount} className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-xl text-sm font-medium">
                  Oui, supprimer
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-secondary text-foreground py-2.5 rounded-xl text-sm font-medium">
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
