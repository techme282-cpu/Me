import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import CertificationBadge from "@/components/CertificationBadge";
import { ArrowLeft, Heart, UserPlus, MessageCircle, AtSign, Shield, Bell, Trash2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const typeIcons: Record<string, any> = {
  like: Heart,
  follow: UserPlus,
  follow_request: UserPlus,
  message: MessageCircle,
  mention: AtSign,
  admin: Shield,
  comment: MessageCircle,
  group_add: Users,
  verification: Shield,
  certification_request: Shield,
};

const typeColors: Record<string, string> = {
  like: "text-accent bg-accent/10",
  follow: "text-primary bg-primary/10",
  follow_request: "text-primary bg-primary/10",
  message: "text-foreground bg-muted",
  mention: "text-primary bg-primary/10",
  admin: "text-destructive bg-destructive/10",
  comment: "text-primary bg-primary/10",
  group_add: "text-primary bg-primary/10",
  verification: "text-emerald-500 bg-emerald-500/10",
  certification_request: "text-amber-500 bg-amber-500/10",
};

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications(data || []);

    // Fetch related user profiles
    const relatedUserIds = [...new Set((data || []).filter((n) => n.related_user_id).map((n) => n.related_user_id))];
    if (relatedUserIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url, certification_type").in("user_id", relatedUserIds);
      const map: Record<string, any> = {};
      (profs || []).forEach((p) => (map[p.user_id] = p));
      setUserProfiles(map);
    }

    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        fetchNotifications();
        // Play notification sound
        try {
          const audio = new Audio("/notification.mp3");
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleClick = (n: any) => {
    if (n.related_post_id) {
      navigate(`/post/${n.related_post_id}`);
    } else if (n.related_user_id) {
      navigate(`/user/${n.related_user_id}`);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notification supprimée");
  };

  const handleClearAll = async () => {
    if (!user) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    setNotifications([]);
    toast.success("Toutes les notifications supprimées");
  };

  // Group notifications by time
  const today: any[] = [];
  const thisWeek: any[] = [];
  const older: any[] = [];
  const now = Date.now();

  notifications.forEach((n) => {
    const age = now - new Date(n.created_at).getTime();
    if (age < 24 * 60 * 60 * 1000) today.push(n);
    else if (age < 7 * 24 * 60 * 60 * 1000) thisWeek.push(n);
    else older.push(n);
  });

  const renderSection = (title: string, items: any[]) => {
    if (items.length === 0) return null;
    return (
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2 bg-background/50 sticky top-0">{title}</h3>
        <div className="divide-y divide-border/50">
          {items.map((n) => {
            const Icon = typeIcons[n.type] || Bell;
            const colorClasses = typeColors[n.type] || "text-foreground bg-muted";
            const clickable = !!(n.related_post_id || n.related_user_id);
            const relatedProfile = n.related_user_id ? userProfiles[n.related_user_id] : null;

            return (
              <div
                key={n.id}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${!n.is_read ? "bg-primary/5" : ""} ${clickable ? "cursor-pointer active:bg-secondary/50" : ""}`}
                onClick={() => clickable && handleClick(n)}
              >
                {/* User avatar or icon */}
                {relatedProfile ? (
                  <div
                    className="relative shrink-0 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); navigate(`/user/${n.related_user_id}`); }}
                  >
                    <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {relatedProfile.avatar_url ? (
                        <img src={relatedProfile.avatar_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <span className="text-sm font-bold text-foreground">{relatedProfile.username?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${colorClasses} flex items-center justify-center`}>
                      <Icon size={10} />
                    </div>
                  </div>
                ) : (
                  <div className={`w-11 h-11 rounded-full ${colorClasses} flex items-center justify-center shrink-0`}>
                    <Icon size={20} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">
                    {relatedProfile && (
                      <span className="font-semibold inline-flex items-center gap-1">
                        {relatedProfile.display_name || relatedProfile.username}
                        <CertificationBadge type={relatedProfile.certification_type} size={12} />
                        {" "}
                      </span>
                    )}
                    <span className={!relatedProfile ? "font-medium" : ""}>{n.title}</span>
                  </p>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                  className="text-muted-foreground/50 hover:text-destructive p-1.5 rounded-full hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20 bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft size={22} />
            </button>
            <h2 className="font-display font-bold text-foreground text-lg">Notifications</h2>
          </div>
          {notifications.length > 0 && (
            <button onClick={handleClearAll} className="text-xs text-destructive hover:underline font-medium px-2 py-1 rounded-lg hover:bg-destructive/10 transition-colors">
              Tout effacer
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {notifications.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Bell size={36} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-foreground font-medium">Aucune notification</p>
              <p className="text-sm text-muted-foreground mt-1">Tes notifications apparaîtront ici</p>
            </div>
          </div>
        ) : (
          <div>
            {renderSection("Aujourd'hui", today)}
            {renderSection("Cette semaine", thisWeek)}
            {renderSection("Plus ancien", older)}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
