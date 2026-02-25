import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Shield, Ban, Trash2, AlertTriangle, Check, X, Search,
  Users, FileWarning, Crown, UserCog, Activity,
  ShieldCheck, ShieldOff, BarChart3, BadgeCheck, Clock, CheckCircle2, XCircle, RotateCcw
} from "lucide-react";
import CertificationBadge from "@/components/CertificationBadge";
import { sendNotification } from "@/lib/notifications";

const PRINCIPAL_ADMIN_EMAIL = "inconnuboytech@gmail.com";

interface Report {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_post_id: string | null;
}

interface Profile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_banned: boolean;
  is_verified: boolean;
  certification_type: string | null;
  ban_reason: string | null;
}

interface UserWithRole extends Profile {
  role?: string;
}

export default function Admin() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPrincipal, setIsPrincipal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "reports" | "users" | "banned" | "certifications" | "reviews">("overview");

  const [reports, setReports] = useState<Report[]>([]);
  const [reportProfiles, setReportProfiles] = useState<Map<string, Profile>>(new Map());
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [bannedEmails, setBannedEmails] = useState<any[]>([]);
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());

  const [confirmAction, setConfirmAction] = useState<{ type: string; userId: string; username: string } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [certPickerUserId, setCertPickerUserId] = useState<string | null>(null);

  // Certification & review data
  const [certRequests, setCertRequests] = useState<any[]>([]);
  const [certProfiles, setCertProfiles] = useState<Map<string, Profile>>(new Map());
  const [accountReviews, setAccountReviews] = useState<any[]>([]);
  const [reviewProfiles, setReviewProfiles] = useState<Map<string, Profile>>(new Map());

  const actionInProgress = useRef(false);

  const [stats, setStats] = useState({ users: 0, posts: 0, reports: 0, banned: 0, certPending: 0, reviewPending: 0 });

  useEffect(() => { checkAdmin(); }, [user]);

  const checkAdmin = async () => {
    if (!user) return;
    const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    setIsAdmin(!!data);
    setIsPrincipal(user.email === PRINCIPAL_ADMIN_EMAIL);
    setLoading(false);
    if (data) fetchAll();
  };

  const fetchAll = () => {
    fetchReports();
    fetchUsers();
    fetchBannedEmails();
    fetchStats();
    fetchAdminIds();
    fetchCertRequests();
    fetchAccountReviews();
  };

  const fetchStats = async () => {
    const [u, p, r, b, cp, rp] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("banned_emails").select("id", { count: "exact", head: true }),
      supabase.from("certification_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "analyzing"]),
      supabase.from("account_reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setStats({
      users: u.count || 0,
      posts: p.count || 0,
      reports: r.count || 0,
      banned: b.count || 0,
      certPending: cp.count || 0,
      reviewPending: rp.count || 0,
    });
  };

  const fetchAdminIds = async () => {
    const { data } = await supabase.from("user_roles").select("user_id, role").eq("role", "admin");
    if (data) setAdminUserIds(new Set(data.map(d => d.user_id)));
  };

  const fetchReports = async () => {
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
    if (data) {
      setReports(data);
      const ids = [...new Set(data.flatMap(r => [r.reporter_id, r.reported_user_id].filter(Boolean) as string[]))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", ids);
        setReportProfiles(new Map((profiles || []).map(p => [p.user_id, p as Profile])));
      }
    }
  };

  const fetchUsers = async () => {
    let query = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
    if (userSearch.trim()) {
      query = supabase.from("profiles").select("*").or(`username.ilike.%${userSearch}%,display_name.ilike.%${userSearch}%`).limit(50);
    }
    const { data } = await query;
    if (data) setUsers(data as UserWithRole[]);
  };

  const fetchBannedEmails = async () => {
    const { data } = await supabase.from("banned_emails").select("*").order("created_at", { ascending: false });
    if (data) setBannedEmails(data);
  };

  const fetchCertRequests = async () => {
    const { data } = await supabase.from("certification_requests").select("*").order("created_at", { ascending: false });
    if (data) {
      setCertRequests(data);
      const ids = [...new Set(data.map(r => r.user_id))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", ids);
        setCertProfiles(new Map((profiles || []).map(p => [p.user_id, p as Profile])));
      }
    }
  };

  const fetchAccountReviews = async () => {
    const { data } = await supabase.from("account_reviews").select("*").order("created_at", { ascending: false });
    if (data) {
      setAccountReviews(data);
      const ids = [...new Set(data.map(r => r.user_id))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", ids);
        setReviewProfiles(new Map((profiles || []).map(p => [p.user_id, p as Profile])));
      }
    }
  };

  const isUserAdmin = (userId: string) => adminUserIds.has(userId);

  const canBanUser = (targetUserId: string) => {
    if (isUserAdmin(targetUserId)) return isPrincipal && targetUserId !== user?.id;
    return targetUserId !== user?.id;
  };

  // --- Admin actions (same as before) ---
  const handleBanUser = async (userId: string) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    try {
      if (!canBanUser(userId)) { toast.error("Vous ne pouvez pas bannir cet utilisateur"); return; }
      const { error } = await supabase.from("profiles").update({ is_banned: true, ban_reason: banReason || "Banni par admin" }).eq("user_id", userId);
      if (error) { toast.error("Erreur: " + error.message); return; }
      toast.success("Utilisateur banni");
      setConfirmAction(null);
      setBanReason("");
      fetchUsers(); fetchStats();
    } finally { actionInProgress.current = false; }
  };

  const handleUnbanUser = async (userId: string) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    try {
      const { error } = await supabase.from("profiles").update({ is_banned: false, ban_reason: null }).eq("user_id", userId);
      if (error) { toast.error("Erreur: " + error.message); return; }
      toast.success("Utilisateur débanni");
      fetchUsers();
    } finally { actionInProgress.current = false; }
  };

  const handleDeleteAccount = async (userId: string) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    try {
      if (!canBanUser(userId)) { toast.error("Vous ne pouvez pas supprimer cet utilisateur"); return; }
      const res = await supabase.functions.invoke("admin-delete-account", {
        body: { userId, reason: banReason || "Supprimé par admin" },
      });
      if (res.error) { toast.error("Erreur: " + (res.error.message || "Échec")); }
      else { toast.success("Compte supprimé"); fetchUsers(); fetchBannedEmails(); fetchStats(); }
      setConfirmAction(null); setBanReason("");
    } finally { actionInProgress.current = false; }
  };

  const handlePromote = async (userId: string) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    try {
      if (!isPrincipal) { toast.error("Seul l'admin principal peut promouvoir"); return; }
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" as any });
      if (error) { if (error.code === "23505") toast.info("Déjà admin"); else toast.error("Erreur: " + error.message); }
      else { toast.success("Utilisateur promu admin"); fetchAdminIds(); }
    } finally { actionInProgress.current = false; }
  };

  const handleDemote = async (userId: string) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    try {
      if (!isPrincipal) { toast.error("Seul l'admin principal peut rétrograder"); return; }
      if (userId === user?.id) { toast.error("Vous ne pouvez pas vous rétrograder"); return; }
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) { toast.error("Erreur: " + error.message); }
      else { toast.success("Admin rétrogradé"); fetchAdminIds(); }
    } finally { actionInProgress.current = false; }
  };

  const handleSetCertification = async (userId: string, certType: string | null) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    try {
      const { error } = await supabase.from("profiles").update({ certification_type: certType }).eq("user_id", userId);
      if (error) { toast.error("Erreur: " + error.message); }
      else {
        toast.success(certType ? `Certification "${certType}" attribuée` : "Certification retirée");
        if (certType) {
          sendNotification({ userId, type: "certification", title: `Votre compte a été certifié "${certType}" 🎉`, body: "Félicitations !", relatedUserId: user?.id });
        }
        fetchUsers();
      }
      setCertPickerUserId(null);
    } finally { actionInProgress.current = false; }
  };

  const handleReportAction = async (reportId: string, status: string) => {
    await supabase.from("reports").update({ status }).eq("id", reportId);
    toast.success(status === "resolved" ? "Signalement résolu" : "Signalement rejeté");
    fetchReports(); fetchStats();
  };

  const handleUnbanEmail = async (id: string) => {
    await supabase.from("banned_emails").delete().eq("id", id);
    toast.success("Email débanni");
    fetchBannedEmails(); fetchStats();
  };

  // Manual cert action by admin
  const handleManualCertAction = async (requestId: string, action: "approved" | "rejected", userId: string, certType: string) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    try {
      await supabase.from("certification_requests").update({
        status: action,
        analyzed_at: new Date().toISOString(),
        rejection_reason: action === "rejected" ? "Refusé par l'admin." : null,
      }).eq("id", requestId);

      if (action === "approved") {
        await supabase.from("profiles").update({ certification_type: certType }).eq("user_id", userId);
        await supabase.from("notifications").insert({
          user_id: userId, type: "certification_approved",
          title: "Certification approuvée ! 🎉", body: `Badge "${certType}" activé par l'admin.`,
        });
      } else {
        await supabase.from("notifications").insert({
          user_id: userId, type: "certification_rejected",
          title: "Certification refusée", body: "Votre demande a été refusée par l'admin.",
        });
      }
      toast.success(action === "approved" ? "Certification approuvée" : "Certification refusée");
      fetchCertRequests(); fetchStats();
    } finally { actionInProgress.current = false; }
  };

  // Manual review action
  const handleReviewAction = async (reviewId: string, action: "approved" | "rejected", userId: string) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    try {
      await supabase.from("account_reviews").update({
        status: action,
        reviewed_at: new Date().toISOString(),
      }).eq("id", reviewId);

      if (action === "approved") {
        await supabase.from("profiles").update({ is_banned: false, ban_reason: null }).eq("user_id", userId);
        await supabase.from("notifications").insert({
          user_id: userId, type: "account_restored",
          title: "Compte restauré ✅", body: "Votre compte a été restauré après examen.",
        });
      }
      toast.success(action === "approved" ? "Compte restauré" : "Bannissement maintenu");
      fetchAccountReviews(); fetchStats(); fetchUsers();
    } finally { actionInProgress.current = false; }
  };

  useEffect(() => { if (isAdmin) fetchUsers(); }, [userSearch]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 bg-background">
      <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <Shield size={40} className="text-destructive" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Accès refusé</h2>
      <p className="text-muted-foreground text-center text-sm">Vous n'avez pas les droits d'administration.</p>
      <button onClick={() => navigate("/")} className="bg-primary text-primary-foreground px-8 py-2.5 rounded-xl text-sm font-semibold mt-2">Retour</button>
    </div>
  );

  const tabs = [
    { key: "overview" as const, label: "Aperçu", icon: BarChart3 },
    { key: "certifications" as const, label: "Certif.", icon: BadgeCheck, badge: stats.certPending },
    { key: "reviews" as const, label: "Examens", icon: RotateCcw, badge: stats.reviewPending },
    { key: "reports" as const, label: "Signalements", icon: FileWarning, badge: stats.reports },
    { key: "users" as const, label: "Users", icon: Users },
    { key: "banned" as const, label: "Bannis", icon: Ban },
  ];

  const pendingReports = reports.filter(r => r.status === "pending");

  const certOptions = [
    { value: "verified", label: "Vérifié", color: "text-blue-400 bg-blue-400/10" },
    { value: "creator", label: "Créateur", color: "text-yellow-400 bg-yellow-400/10" },
    { value: "official", label: "Officiel", color: "text-emerald-400 bg-emerald-400/10" },
    { value: null as string | null, label: "Retirer", color: "text-muted-foreground bg-muted/50" },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      pending: { text: "En attente", cls: "bg-amber-500/15 text-amber-400" },
      analyzing: { text: "Analyse", cls: "bg-blue-500/15 text-blue-400" },
      approved: { text: "Approuvé", cls: "bg-green-500/15 text-green-400" },
      rejected: { text: "Refusé", cls: "bg-destructive/15 text-destructive" },
    };
    const s = map[status] || { text: status, cls: "bg-muted text-muted-foreground" };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${s.cls}`}>{s.text}</span>;
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-16 max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="font-display font-bold text-foreground text-sm leading-tight">Admin Panel</h2>
              {isPrincipal && (
                <span className="text-[10px] text-primary font-medium flex items-center gap-0.5">
                  <Crown size={10} /> Principal
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs - scrollable */}
        <div className="flex max-w-3xl mx-auto px-2 gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`shrink-0 py-2.5 px-3 text-[11px] font-semibold flex items-center justify-center gap-1 transition-all relative rounded-t-lg ${
                tab === key ? "text-primary bg-primary/5 border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={13} />
              <span>{label}</span>
              {badge && badge > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Utilisateurs", value: stats.users, icon: Users, color: "text-primary", bg: "bg-primary/10" },
                { label: "Publications", value: stats.posts, icon: Activity, color: "text-accent", bg: "bg-accent/10" },
                { label: "Signalements", value: stats.reports, icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-400/10" },
                { label: "Emails bannis", value: stats.banned, icon: Ban, color: "text-destructive", bg: "bg-destructive/10" },
                { label: "Certif. en cours", value: stats.certPending, icon: BadgeCheck, color: "text-blue-400", bg: "bg-blue-400/10" },
                { label: "Examens", value: stats.reviewPending, icon: RotateCcw, color: "text-amber-400", bg: "bg-amber-400/10" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon size={18} className={color} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Actions rapides</h3>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => setTab("certifications")} className="bg-card border border-border/50 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary/30 transition-colors">
                  <BadgeCheck size={20} className="text-blue-400" />
                  <span className="text-xs font-medium text-foreground">Certifications</span>
                </button>
                <button onClick={() => setTab("reviews")} className="bg-card border border-border/50 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary/30 transition-colors">
                  <RotateCcw size={20} className="text-amber-400" />
                  <span className="text-xs font-medium text-foreground">Examens</span>
                </button>
                <button onClick={() => setTab("users")} className="bg-card border border-border/50 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary/30 transition-colors">
                  <UserCog size={20} className="text-primary" />
                  <span className="text-xs font-medium text-foreground">Utilisateurs</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CERTIFICATIONS TAB */}
        {tab === "certifications" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {certRequests.length} demande{certRequests.length !== 1 ? "s" : ""} de certification
            </h3>
            {certRequests.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <BadgeCheck size={28} className="text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">Aucune demande</p>
              </div>
            ) : certRequests.map((cr) => {
              const profile = certProfiles.get(cr.user_id);
              return (
                <div key={cr.id} className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-foreground font-bold text-sm overflow-hidden">
                        {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" /> : profile?.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">@{profile?.username || "inconnu"}</p>
                        <p className="text-[11px] text-muted-foreground">{cr.full_name} · {cr.clan} ({cr.clan_role})</p>
                      </div>
                    </div>
                    {statusBadge(cr.status)}
                  </div>

                  <div className="bg-secondary/30 rounded-xl p-3 space-y-1">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Type demandé</p>
                    <div className="flex items-center gap-2">
                      <CertificationBadge type={cr.cert_type} size={16} />
                      <span className="text-sm font-medium text-foreground capitalize">{cr.cert_type}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-2">Raison</p>
                    <p className="text-xs text-foreground">{cr.reason}</p>
                  </div>

                  {cr.rejection_reason && (
                    <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-2">
                      <p className="text-[11px] text-destructive">{cr.rejection_reason}</p>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground/60">
                    {new Date(cr.submitted_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>

                  {/* Admin manual actions */}
                  {(cr.status === "pending" || cr.status === "analyzing") && (
                    <div className="flex gap-2 pt-1 border-t border-border/30">
                      <button
                        onClick={() => handleManualCertAction(cr.id, "approved", cr.user_id, cr.cert_type)}
                        className="text-[11px] px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 flex items-center gap-1 font-medium transition-colors"
                      >
                        <CheckCircle2 size={11} /> Approuver
                      </button>
                      <button
                        onClick={() => handleManualCertAction(cr.id, "rejected", cr.user_id, cr.cert_type)}
                        className="text-[11px] px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 flex items-center gap-1 font-medium transition-colors"
                      >
                        <XCircle size={11} /> Refuser
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* REVIEWS TAB */}
        {tab === "reviews" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {accountReviews.length} demande{accountReviews.length !== 1 ? "s" : ""} d'examen
            </h3>
            {accountReviews.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <RotateCcw size={28} className="text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">Aucune demande d'examen</p>
              </div>
            ) : accountReviews.map((ar) => {
              const profile = reviewProfiles.get(ar.user_id);
              return (
                <div key={ar.id} className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-foreground font-bold text-sm overflow-hidden">
                        {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" /> : profile?.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">@{profile?.username || "inconnu"}</p>
                        <p className="text-[11px] text-muted-foreground">Raison ban: {ar.reason || "Non spécifiée"}</p>
                      </div>
                    </div>
                    {statusBadge(ar.status)}
                  </div>

                  <p className="text-[10px] text-muted-foreground/60">
                    Soumis le {new Date(ar.submitted_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>

                  {ar.status === "pending" && (
                    <div className="flex gap-2 pt-1 border-t border-border/30">
                      <button
                        onClick={() => handleReviewAction(ar.id, "approved", ar.user_id)}
                        className="text-[11px] px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 flex items-center gap-1 font-medium transition-colors"
                      >
                        <CheckCircle2 size={11} /> Restaurer
                      </button>
                      <button
                        onClick={() => handleReviewAction(ar.id, "rejected", ar.user_id)}
                        className="text-[11px] px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 flex items-center gap-1 font-medium transition-colors"
                      >
                        <XCircle size={11} /> Maintenir ban
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* REPORTS TAB */}
        {tab === "reports" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{reports.length} signalement{reports.length !== 1 ? "s" : ""}</h3>
            {reports.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <FileWarning size={28} className="text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">Aucun signalement</p>
              </div>
            ) : reports.map((r) => {
              const reporter = reportProfiles.get(r.reporter_id);
              const reported = r.reported_user_id ? reportProfiles.get(r.reported_user_id) : null;
              return (
                <div key={r.id} className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                        r.status === "pending" ? "bg-orange-400/15 text-orange-400" : r.status === "resolved" ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"
                      }`}>
                        {r.status === "pending" ? "En attente" : r.status === "resolved" ? "Résolu" : "Rejeté"}
                      </span>
                      <p className="text-sm text-foreground font-medium">{r.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        Par <span className="text-foreground/70">@{reporter?.username || "inconnu"}</span>
                        {reported && <> → <span className="text-foreground/70">@{reported.username}</span></>}
                      </p>
                    </div>
                    {r.status === "pending" && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleReportAction(r.id, "resolved")} className="w-8 h-8 bg-green-500/10 text-green-400 rounded-lg flex items-center justify-center hover:bg-green-500/20">
                          <Check size={14} />
                        </button>
                        <button onClick={() => handleReportAction(r.id, "dismissed")} className="w-8 h-8 bg-muted/50 text-muted-foreground rounded-lg flex items-center justify-center hover:bg-muted">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="w-full bg-card border border-border/50 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {users.map((u) => {
              const userIsAdmin = isUserAdmin(u.user_id);
              const canAction = canBanUser(u.user_id);
              const isSelf = u.user_id === user?.id;

              return (
                <div key={u.user_id} className={`bg-card border rounded-2xl p-4 transition-all ${userIsAdmin ? "border-primary/20" : "border-border/50"}`}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-foreground font-bold text-sm shrink-0 overflow-hidden">
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" /> : u.username?.[0]?.toUpperCase()}
                      </div>
                      {userIsAdmin && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Shield size={10} className="text-primary-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{u.display_name || u.username}</p>
                        {u.certification_type && <CertificationBadge type={u.certification_type} size={14} />}
                        {userIsAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold uppercase">Admin</span>}
                        {u.is_banned && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive font-bold uppercase">Banni</span>}
                        {isSelf && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/15 text-accent font-bold">Vous</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </div>

                    <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                      {!isSelf && (canAction || !userIsAdmin) && (
                        <div className="relative">
                          <button className="w-8 h-8 bg-accent/10 text-accent rounded-lg flex items-center justify-center hover:bg-accent/20" title="Certification"
                            onClick={() => setCertPickerUserId(certPickerUserId === u.user_id ? null : u.user_id)}>
                            <BadgeCheck size={14} />
                          </button>
                          {certPickerUserId === u.user_id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setCertPickerUserId(null)} />
                              <div className="absolute right-0 top-10 z-50 bg-card border border-border rounded-xl shadow-xl py-1 w-44">
                                <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase">Choisir certification</p>
                                {certOptions.map((opt) => (
                                  <button key={opt.value ?? "remove"} onClick={() => handleSetCertification(u.user_id, opt.value)}
                                    className={`w-full px-3 py-2 text-sm text-left hover:bg-secondary/80 flex items-center gap-2 ${u.certification_type === opt.value ? "bg-secondary/50" : ""}`}>
                                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${opt.color}`}>
                                      {opt.value === "verified" ? "V" : opt.value === "creator" ? "C" : opt.value === "official" ? "O" : "✕"}
                                    </span>
                                    <span className="text-foreground text-xs font-medium">{opt.label}</span>
                                    {u.certification_type === opt.value && <Check size={12} className="text-primary ml-auto" />}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {isPrincipal && !isSelf && (
                        userIsAdmin ? (
                          <button onClick={() => handleDemote(u.user_id)} className="w-8 h-8 bg-orange-400/10 text-orange-400 rounded-lg flex items-center justify-center hover:bg-orange-400/20" title="Rétrograder">
                            <ShieldOff size={14} />
                          </button>
                        ) : (
                          <button onClick={() => handlePromote(u.user_id)} className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center hover:bg-primary/20" title="Promouvoir admin">
                            <ShieldCheck size={14} />
                          </button>
                        )
                      )}

                      {canAction && (
                        u.is_banned ? (
                          <button onClick={() => handleUnbanUser(u.user_id)} className="text-[11px] px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 font-medium">Débannir</button>
                        ) : (
                          <button onClick={() => setConfirmAction({ type: "ban", userId: u.user_id, username: u.username })} className="w-8 h-8 bg-destructive/10 text-destructive rounded-lg flex items-center justify-center hover:bg-destructive/20" title="Bannir">
                            <Ban size={14} />
                          </button>
                        )
                      )}

                      {canAction && (
                        <button onClick={() => setConfirmAction({ type: "delete", userId: u.user_id, username: u.username })} className="w-8 h-8 bg-destructive/5 text-destructive/60 rounded-lg flex items-center justify-center hover:bg-destructive/15 hover:text-destructive" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      )}

                      {!canAction && !isSelf && userIsAdmin && (
                        <span className="text-[10px] text-muted-foreground/50 italic flex items-center gap-1"><Shield size={10} /> Protégé</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BANNED EMAILS TAB */}
        {tab === "banned" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{bannedEmails.length} email{bannedEmails.length !== 1 ? "s" : ""} banni{bannedEmails.length !== 1 ? "s" : ""}</h3>
            {bannedEmails.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Ban size={28} className="text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">Aucun email banni</p>
              </div>
            ) : bannedEmails.map((b) => (
              <div key={b.id} className="bg-card border border-border/50 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{b.email}</p>
                  <p className="text-[11px] text-muted-foreground">{b.reason} · {new Date(b.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
                </div>
                <button onClick={() => handleUnbanEmail(b.id)} className="text-[11px] px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 font-medium shrink-0">Débannir</button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md px-6" onClick={() => setConfirmAction(null)}>
          <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${confirmAction.type === "delete" ? "bg-destructive/10" : "bg-orange-400/10"}`}>
                {confirmAction.type === "delete" ? <Trash2 size={18} className="text-destructive" /> : <Ban size={18} className="text-orange-400" />}
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">{confirmAction.type === "delete" ? "Supprimer définitivement" : "Bannir l'utilisateur"}</h3>
                <p className="text-xs text-muted-foreground">@{confirmAction.username}</p>
              </div>
            </div>
            {confirmAction.type === "delete" && (
              <div className="bg-destructive/5 border border-destructive/10 rounded-lg p-3">
                <p className="text-[11px] text-destructive/80">⚠️ Toutes les données seront supprimées. Action irréversible.</p>
              </div>
            )}
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Raison</label>
              <input value={banReason} onChange={(e) => setBanReason(e.target.value)} className="w-full bg-secondary/50 border border-border/50 rounded-lg px-4 py-2.5 text-sm text-foreground mt-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Raison..." />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => confirmAction.type === "delete" ? handleDeleteAccount(confirmAction.userId) : handleBanUser(confirmAction.userId)} className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-xl text-sm font-semibold hover:bg-destructive/90">Confirmer</button>
              <button onClick={() => { setConfirmAction(null); setBanReason(""); }} className="px-5 py-2.5 bg-secondary/80 rounded-xl text-muted-foreground text-sm font-medium hover:bg-secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
