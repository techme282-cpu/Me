import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Palette, Shield, Send, MessageCircle, Mail, AlertCircle } from "lucide-react";
import CertificationBadge from "@/components/CertificationBadge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_WHATSAPP = "554488138425";
const ADMIN_EMAIL = "inconnuboytech@gmail.com";
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
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", user.id)
        .eq("status", "accepted")
        .then(({ count }) => setFollowerCount(count || 0));
    }
  }, [user]);

  const eligible = followerCount !== null && followerCount >= MIN_FOLLOWERS;

  const handleWhatsApp = () => {
    if (!selected) { toast.error("Sélectionne un type de badge"); return; }
    if (!eligible) { toast.error(`Tu dois avoir au moins ${MIN_FOLLOWERS} followers`); return; }
    const msg = encodeURIComponent(
      `🔰 Demande de certification PURGE HUB\n\n` +
      `👤 Username: ${user?.user_metadata?.username || "N/A"}\n` +
      `📧 Email: ${user?.email || "N/A"}\n` +
      `🏷️ Type: ${certTypes.find(c => c.key === selected)?.label}\n` +
      `📝 Raison: ${reason || "Non précisée"}`
    );
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${msg}`, "_blank");
  };

  const handleEmail = () => {
    if (!selected) { toast.error("Sélectionne un type de badge"); return; }
    if (!eligible) { toast.error(`Tu dois avoir au moins ${MIN_FOLLOWERS} followers`); return; }
    const subject = encodeURIComponent("Demande de certification PURGE HUB");
    const body = encodeURIComponent(
      `Demande de certification PURGE HUB\n\n` +
      `Username: ${user?.user_metadata?.username || "N/A"}\n` +
      `Email: ${user?.email || "N/A"}\n` +
      `Type demandé: ${certTypes.find(c => c.key === selected)?.label}\n` +
      `Raison: ${reason || "Non précisée"}`
    );
    window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, "_blank");
  };

  const handleInApp = async () => {
    if (!user || !selected) { toast.error("Sélectionne un type de badge"); return; }
    if (!eligible) { toast.error(`Tu dois avoir au moins ${MIN_FOLLOWERS} followers`); return; }
    if (!reason.trim()) { toast.error("Explique pourquoi tu mérites ce badge"); return; }
    setSending(true);
    await supabase.from("notifications").insert({
      user_id: "23e3ae81-1eda-4fb1-9e12-6a82aabff93f",
      type: "certification_request",
      title: "Demande de certification",
      body: `@${user.user_metadata?.username || user.email} demande le badge "${certTypes.find(c => c.key === selected)?.label}". Raison: ${reason.trim().slice(0, 200)}`,
      related_user_id: user.id,
    });
    setSending(false);
    toast.success("Demande envoyée ! L'admin te répondra bientôt.");
    setReason("");
    setSelected(null);
  };

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
          <h3 className="text-lg font-bold text-foreground">Demander la certification</h3>
          <p className="text-sm text-muted-foreground">Obtiens un badge de certification pour ton profil PURGE HUB</p>
        </div>

        {/* Follower requirement */}
        {followerCount !== null && !eligible && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl">
            <AlertCircle size={20} className="text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Conditions non remplies</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tu as {followerCount} follower{followerCount > 1 ? "s" : ""}. Il en faut au moins {MIN_FOLLOWERS} pour demander la certification.
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

        {/* Reason */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Pourquoi tu mérites ce badge ?</h4>
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

        {/* Actions */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Envoyer ta demande</h4>

          <button
            onClick={handleInApp}
            disabled={sending || !selected || !eligible}
            className="w-full flex items-center gap-3 px-4 py-3.5 gradient-primary text-primary-foreground rounded-2xl font-medium text-sm disabled:opacity-50"
          >
            <Send size={18} />
            <span className="flex-1 text-left">{sending ? "Envoi en cours..." : "Envoyer dans l'app"}</span>
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleWhatsApp}
              disabled={!selected || !eligible}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600/20 border border-green-600/30 text-green-500 rounded-2xl text-sm font-medium hover:bg-green-600/30 transition-colors disabled:opacity-50"
            >
              <MessageCircle size={18} />
              WhatsApp
            </button>
            <button
              onClick={handleEmail}
              disabled={!selected || !eligible}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600/20 border border-blue-600/30 text-blue-400 rounded-2xl text-sm font-medium hover:bg-blue-600/30 transition-colors disabled:opacity-50"
            >
              <Mail size={18} />
              Email
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
