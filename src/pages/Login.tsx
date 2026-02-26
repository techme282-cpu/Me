import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff, AlertTriangle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banInfo, setBanInfo] = useState<{ reason: string; userId: string } | null>(null);
  const [appealSent, setAppealSent] = useState(false);
  const [appealLoading, setAppealLoading] = useState(false);
  const [appealText, setAppealText] = useState("");
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Remplis tous les champs"); return; }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) { toast.error(error.message); return; }

    // Check if user is banned (server-side check)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_banned, ban_reason")
        .eq("user_id", user.id)
        .single();

      if (profile?.is_banned) {
        setBanInfo({ reason: profile.ban_reason || "Compte inactif", userId: user.id });
        await supabase.auth.signOut();
        return;
      }
    }

    navigate("/");
  };

  const handleAppeal = async () => {
    if (!banInfo || !appealText.trim()) {
      toast.error("Écris ta demande de réexamen");
      return;
    }
    setAppealLoading(true);

    // Sign back in temporarily to submit appeal
    const { error: signError } = await signIn(email, password);
    if (signError) {
      toast.error("Impossible de soumettre la demande");
      setAppealLoading(false);
      return;
    }

    const { error } = await supabase.from("account_reviews").insert({
      user_id: banInfo.userId,
      reason: appealText.trim(),
    });

    await supabase.auth.signOut();
    setAppealLoading(false);

    if (error) {
      if (error.message.includes("duplicate") || error.code === "23505") {
        toast.info("Demande déjà envoyée");
        setAppealSent(true);
      } else {
        toast.error("Erreur: " + error.message);
      }
    } else {
      setAppealSent(true);
      toast.success("Demande d'examen envoyée !");
    }
  };

  // Ban screen
  if (banInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle size={40} className="text-destructive" />
          </div>
          <h1 className="text-2xl font-display font-bold text-destructive">Votre compte a été banni</h1>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Raison :</p>
            <p className="text-sm text-muted-foreground">{banInfo.reason}</p>
          </div>

          {appealSent ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
              <p className="text-sm text-green-500 font-medium">
                Votre demande est en cours d'examen. Merci d'attendre 24h.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={appealText}
                onChange={(e) => setAppealText(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                rows={4}
                placeholder="Explique pourquoi ton compte devrait être restauré..."
                maxLength={500}
              />
              <button
                onClick={handleAppeal}
                disabled={appealLoading || !appealText.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 gradient-primary text-primary-foreground rounded-2xl font-medium text-sm disabled:opacity-50"
              >
                <Send size={18} />
                {appealLoading ? "Envoi..." : "Demander un examen"}
              </button>
            </div>
          )}

          <button
            onClick={() => { setBanInfo(null); setAppealSent(false); setAppealText(""); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-display font-bold text-gradient">PURGE HUB</h1>
          <p className="text-muted-foreground text-sm">Connexion à ton univers</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="ton@email.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mot de passe</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pr-12"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 glow-primary"
          >
            <LogIn size={18} />
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
