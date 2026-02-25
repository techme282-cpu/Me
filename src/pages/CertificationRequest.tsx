import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Palette, Shield, Send, AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import CertificationBadge from "@/components/CertificationBadge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MIN_FOLLOWERS = 30;

const certTypes = [
  {
    key: "verified",
    label: "Vérifié",
    desc: "Pour les comptes authentiques de personnalités publiques, célébrités et marques.",
    icon: BadgeCheck,
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    key: "creator",
    label: "Créateur",
    desc: "Pour les créateurs de contenu actifs avec une audience engagée.",
    icon: Palette,
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    key: "official",
    label: "Officiel",
    desc: "Réservé aux comptes officiels de PURGE HUB et partenaires vérifiés.",
    icon: Shield,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
];

export default function CertificationRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [clan, setClan] = useState("");
  const [clanRole, setClanRole] = useState<"chef" | "membre">("membre");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);

  useEffect(() => {
    if (user) {
      // Load follower count
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", user.id)
        .eq("status", "accepted")
        .then(({ count }) => setFollowerCount(count || 0));

      // Load existing request
      supabase
        .from("certification_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const latest = data[0];
            // Only show active request (pending/analyzing)
            if (latest.status === "pending" || latest.status === "analyzing") {
              setExistingRequest(latest);
            }
          }
          setLoadingRequest(false);
        });
    }
  }, [user]);

  const eligible = followerCount !== null && followerCount >= MIN_FOLLOWERS;

  const handleSubmit = async () => {
    if (!user || !selected) { toast.error("Sélectionne un type de badge"); return; }
    if (!eligible) { toast.error(`Tu dois avoir au moins ${MIN_FOLLOWERS} followers`); return; }
    if (!fullName.trim()) { toast.error("Ton nom est requis"); return; }
    if (!clan.trim()) { toast.error("Ton clan est requis"); return; }
    if (!reason.trim()) { toast.error("Explique pourquoi tu mérites ce badge"); return; }

    setSending(true);
    const { error } = await supabase.from("certification_requests").insert({
      user_id: user.id,
      full_name: fullName.trim(),
      clan: clan.trim(),
      clan_role: clanRole,
      reason: reason.trim(),
      cert_type: selected,
      status: "analyzing", // Goes directly to analysis
    });

    if (error) {
      toast.error("Erreur: " + error.message);
    } else {
      toast.success("Demande envoyée ! Vérification en cours (24h).");
      setExistingRequest({
        status: "analyzing",
        cert_type: selected,
        submitted_at: new Date().toISOString(),
      });
    }
    setSending(false);
  };

  const statusDisplay = (status: string, rejectionReason?: string) => {
    switch (status) {
      case "pending":
      case "analyzing":
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center animate-pulse">
              <Clock size={36} className="text-amber-500" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-foreground">Vérification en cours…</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Le système intelligent analyse ton compte et tes followers. Résultat dans les 24 heures.
              </p>
            </div>
            <div className="w-full max-w-xs space-y-2 mt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 size={14} className="text-green-500" />
                <span>Formulaire soumis</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-500">
                <Clock size={14} />
                <span>Analyse des followers en cours…</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                <CheckCircle2 size={14} />
                <span>Résultat final</span>
              </div>
            </div>
          </div>
        );
      case "approved":
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 size={36} className="text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-green-500">Certification approuvée ! 🎉</h3>
            <p className="text-sm text-muted-foreground">Ton badge est maintenant visible sur ton profil.</p>
          </div>
        );
      case "rejected":
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle size={36} className="text-destructive" />
            </div>
            <h3 className="text-lg font-bold text-destructive">Certification refusée</h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              {rejectionReason || "Ton compte ne remplit pas les critères requis."}
            </p>
            <button
              onClick={() => setExistingRequest(null)}
              className="mt-2 px-6 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              Refaire une demande
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  if (loadingRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
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
          <h2 className="font-display font-bold text-foreground">Certification</h2>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Info */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
              <path d="M9 12.5L11 14.5L15.5 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-foreground">Certification automatique</h3>
          <p className="text-sm text-muted-foreground">Système intelligent — pas besoin d'admin</p>
        </div>

        {/* Show existing request status */}
        {existingRequest && statusDisplay(existingRequest.status, existingRequest.rejection_reason)}

        {/* Only show form if no active request */}
        {!existingRequest && (
          <>
            {/* Follower requirement */}
            {followerCount !== null && !eligible && (
              <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl">
                <AlertCircle size={20} className="text-destructive shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Conditions non remplies</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tu as {followerCount} follower{followerCount !== null && followerCount > 1 ? "s" : ""}. Il en faut au moins {MIN_FOLLOWERS}.
                  </p>
                </div>
              </div>
            )}

            {followerCount !== null && eligible && (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                <BadgeCheck size={20} className="text-green-500 shrink-0" />
                <p className="text-sm text-green-500 font-medium">
                  Tu as {followerCount} followers — tu es éligible ! ✨
                </p>
              </div>
            )}

            {/* Badge types */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Choisis ton badge</h4>
              {certTypes.map((cert) => (
                <button
                  key={cert.key}
                  onClick={() => setSelected(cert.key)}
                  disabled={!eligible}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                    selected === cert.key
                      ? `${cert.bg} ring-1 ring-current ${cert.color}`
                      : "bg-card border-border hover:bg-secondary/50"
                  } ${!eligible ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="shrink-0">
                    <CertificationBadge type={cert.key} size={32} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${selected === cert.key ? cert.color : "text-foreground"}`}>{cert.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cert.desc}</p>
                  </div>
                  {selected === cert.key && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3">
                        <path d="M9 12.5L11 14.5L15.5 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Form fields */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Formulaire de vérification</h4>
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Ton nom</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nom complet"
                  disabled={!eligible}
                  className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Ton clan</label>
                <input
                  value={clan}
                  onChange={(e) => setClan(e.target.value)}
                  placeholder="Nom du clan"
                  disabled={!eligible}
                  className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Chef ou membre du clan ?</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setClanRole("chef")}
                    disabled={!eligible}
                    className={`flex-1 py-3 rounded-2xl text-sm font-medium border transition-all ${
                      clanRole === "chef" ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground"
                    } disabled:opacity-50`}
                  >
                    👑 Chef
                  </button>
                  <button
                    onClick={() => setClanRole("membre")}
                    disabled={!eligible}
                    className={`flex-1 py-3 rounded-2xl text-sm font-medium border transition-all ${
                      clanRole === "membre" ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground"
                    } disabled:opacity-50`}
                  >
                    👤 Membre
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Pourquoi veux-tu être certifié ?</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explique pourquoi tu devrais être certifié..."
                  disabled={!eligible}
                  className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">{reason.length}/500</p>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={sending || !selected || !eligible || !fullName.trim() || !clan.trim() || !reason.trim()}
              className="w-full flex items-center gap-3 px-4 py-3.5 gradient-primary text-primary-foreground rounded-2xl font-medium text-sm disabled:opacity-50"
            >
              <Send size={18} />
              <span className="flex-1 text-left">{sending ? "Envoi en cours..." : "Envoyer la vérification"}</span>
            </button>

            <p className="text-xs text-muted-foreground text-center">
              ⏳ Le système analysera automatiquement ton compte pendant 24h avant de donner une réponse.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
