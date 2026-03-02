import { useEffect, useState } from "react";
import { Home, Search, PlusSquare, MessageCircle, User, Play } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { icon: Home, path: "/", label: "Home" },
  { icon: Search, path: "/explore", label: "Explore" },
  { icon: PlusSquare, path: "/create", label: "Créer" },
  { icon: Play, path: "/loop", label: "Loop" },
  { icon: MessageCircle, path: "/chat", label: "Chat" },
  { icon: User, path: "/profile", label: "Profil" },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const { count: dmCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false)
        .is("group_id", null)
        .is("deleted_at", null);
      setUnreadMessages(dmCount || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel("unread-nav")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => fetchUnread())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => fetchUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Update last_seen periodically
  useEffect(() => {
    if (!user) return;
    const update = () => {
      supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("user_id", user.id).then(() => {});
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleNavClick = (path: string) => {
    if (location.pathname === path) {
      // Already on this page — force refresh by reloading
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Dispatch a custom event so pages can listen and refresh
      window.dispatchEvent(new CustomEvent("nav-refresh", { detail: { path } }));
    } else {
      navigate(path);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ icon: Icon, path, label }) => {
          const active = location.pathname === path;
          const showBadge = path === "/chat" && unreadMessages > 0;
          return (
            <button
              key={path}
              onClick={() => handleNavClick(path)}
              className={`relative flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all duration-200 ${
                active
                  ? "text-primary scale-110"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={label}
            >
              <Icon size={active ? 26 : 22} strokeWidth={active ? 2.5 : 1.8} />
              {showBadge && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
