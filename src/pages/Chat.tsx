import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import PullToRefresh from "@/components/PullToRefresh";
import CertificationBadge from "@/components/CertificationBadge";
import { MessageCircle, Search, Plus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"dms" | "groups">("dms");
  const hasFetched = useRef(false);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchConversations(), fetchGroups()]);
  }, [user]);

  useEffect(() => {
    if (user && !hasFetched.current) {
      hasFetched.current = true;
      fetchConversations();
      fetchGroups();
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .is("group_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    const seen = new Set<string>();
    const convos: any[] = [];
    for (const msg of data || []) {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (partnerId && !seen.has(partnerId)) {
        seen.add(partnerId);
        const { data: prof } = await supabase.from("profiles").select("username, display_name, avatar_url, certification_type, is_verified, last_seen").eq("user_id", partnerId).maybeSingle();
        // Count unread from this partner
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("sender_id", partnerId)
          .eq("receiver_id", user.id)
          .eq("is_read", false)
          .is("group_id", null)
          .is("deleted_at", null);
        convos.push({ ...msg, partnerId, profile: prof, unreadCount: count || 0 });
      }
    }
    setConversations(convos);
  };

  const fetchGroups = async () => {
    if (!user) return;
    const { data: memberships } = await supabase.from("group_members").select("group_id").eq("user_id", user.id);
    if (!memberships?.length) { setGroups([]); return; }
    const groupIds = memberships.map((m) => m.group_id);
    const { data: groupsData } = await supabase.from("groups").select("*").in("id", groupIds).eq("status", "active").order("created_at", { ascending: false });

    // Fetch group_reads for all groups
    const { data: reads } = await supabase.from("group_reads").select("group_id, last_read_at").eq("user_id", user.id).in("group_id", groupIds);
    const readsMap: Record<string, string> = {};
    (reads || []).forEach((r: any) => { readsMap[r.group_id] = r.last_read_at; });

    const enriched = await Promise.all(
      (groupsData || []).map(async (g) => {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, created_at, sender_id")
          .eq("group_id", g.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1);
        const { count } = await supabase.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", g.id);
        
        // Count unread messages
        const lastRead = readsMap[g.id];
        let unreadCount = 0;
        if (lastRead) {
          const { count: uc } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("group_id", g.id)
            .is("deleted_at", null)
            .gt("created_at", lastRead)
            .neq("sender_id", user.id);
          unreadCount = uc || 0;
        } else {
          // Never read - count all messages not from self
          const { count: uc } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("group_id", g.id)
            .is("deleted_at", null)
            .neq("sender_id", user.id);
          unreadCount = uc || 0;
        }

        // Check for @mentions in unread messages
        let hasMention = false;
        if (unreadCount > 0) {
          const myProfile = await supabase.from("profiles").select("username").eq("user_id", user.id).maybeSingle();
          if (myProfile.data?.username) {
            const mentionQuery = lastRead
              ? supabase.from("messages").select("id", { count: "exact", head: true }).eq("group_id", g.id).is("deleted_at", null).gt("created_at", lastRead).neq("sender_id", user.id).ilike("content", `%@${myProfile.data.username}%`)
              : supabase.from("messages").select("id", { count: "exact", head: true }).eq("group_id", g.id).is("deleted_at", null).neq("sender_id", user.id).ilike("content", `%@${myProfile.data.username}%`);
            const { count: mc } = await mentionQuery;
            hasMention = (mc || 0) > 0;
          }
        }

        // Get last message sender profile
        let lastSenderName: string | null = null;
        if (lastMsg?.[0]?.sender_id) {
          const { data: senderProf } = await supabase.from("profiles").select("username, display_name").eq("user_id", lastMsg[0].sender_id).maybeSingle();
          lastSenderName = senderProf?.display_name || senderProf?.username || null;
        }
        
        return { ...g, lastMessage: lastMsg?.[0] || null, memberCount: count || 0, lastSenderName, unreadCount, hasMention };
      })
    );
    setGroups(enriched);
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchConversations();
        fetchGroups();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Listen for nav-refresh (tap chat icon while on chat)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.path === "/chat") {
        hasFetched.current = false;
        fetchConversations();
        fetchGroups();
      }
    };
    window.addEventListener("nav-refresh", handler);
    return () => window.removeEventListener("nav-refresh", handler);
  }, [user]);

  const filteredConvos = conversations.filter((c) =>
    !search || (c.profile?.username?.toLowerCase().includes(search.toLowerCase()) || c.profile?.display_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredGroups = groups.filter((g) =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase())
  );

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000; // 2 minutes
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <h2 className="font-display font-bold text-foreground text-lg">Messages</h2>
          <button onClick={() => navigate("/create-group")} className="p-2 text-primary"><Plus size={22} /></button>
        </div>
        <div className="flex max-w-lg mx-auto px-4 gap-1">
          {(["dms", "groups"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium transition-colors border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              {t === "dms" ? "Messages" : "Groupes"}
            </button>
          ))}
        </div>
        <div className="px-4 pb-3 pt-2 max-w-lg mx-auto">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="Rechercher..."
            />
          </div>
        </div>
      </header>

      <PullToRefresh onRefresh={refreshAll} className="max-w-lg mx-auto">
        <main>
        {tab === "dms" ? (
          filteredConvos.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <MessageCircle size={48} className="mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Aucun message</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConvos.map((conv) => {
                const online = isOnline(conv.profile?.last_seen);
                return (
                  <button
                    key={conv.id}
                    onClick={() => navigate(`/chat/${conv.partnerId}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div className="relative shrink-0">
                      <div
                        className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold overflow-hidden cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); navigate(`/user/${conv.partnerId}`); }}
                      >
                        {conv.profile?.avatar_url ? (
                          <img src={conv.profile.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          conv.profile?.username?.[0]?.toUpperCase() || "?"
                        )}
                      </div>
                      {online && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{conv.profile?.display_name || conv.profile?.username}</p>
                          <CertificationBadge type={conv.profile?.certification_type} size={14} />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.content?.startsWith("[STICKER:") ? "🎭 Sticker" :
                         conv.content?.startsWith("[IMAGE:") ? "📷 Photo" :
                         conv.content?.startsWith("[VIDEO:") ? "🎥 Vidéo" :
                         conv.content?.startsWith("[VOICE:") ? "🎤 Vocal" :
                         conv.content}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1 shrink-0">
                        {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )
        ) : (
          filteredGroups.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Users size={48} className="mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Aucun groupe</p>
              <button onClick={() => navigate("/create-group")} className="gradient-primary text-primary-foreground px-5 py-2 rounded-full text-sm font-medium">
                Créer un groupe
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/group/${g.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold shrink-0 overflow-hidden">
                    {g.avatar_url ? (
                      <img src={g.avatar_url} className="w-full h-full object-cover" alt={g.name} />
                    ) : (
                      g.name?.[0]?.toUpperCase() || "G"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="font-medium text-foreground text-sm truncate">{g.name}</p>
                      {g.lastMessage && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(g.lastMessage.created_at), { addSuffix: true, locale: fr })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {g.lastMessage ? (
                        <>
                          {g.lastSenderName && <span className="font-medium text-foreground/70">{g.lastSenderName}: </span>}
                          {g.lastMessage.content?.startsWith("[STICKER:") ? "🎭 Sticker" :
                           g.lastMessage.content?.startsWith("[IMAGE:") ? "📷 Photo" :
                           g.lastMessage.content?.startsWith("[VIDEO:") ? "🎥 Vidéo" :
                           g.lastMessage.content?.startsWith("[VOICE:") ? "🎤 Vocal" :
                           g.lastMessage.content}
                        </>
                      ) : (
                        `${g.memberCount} membre${g.memberCount > 1 ? "s" : ""}`
                      )}
                    </p>
                  </div>
                  {g.unreadCount > 0 && (
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <span className="min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                        {g.unreadCount > 99 ? "99+" : g.unreadCount}
                      </span>
                      {g.hasMention && (
                        <span className="text-[9px] text-primary font-bold">@</span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )
        )}
      </main>
      </PullToRefresh>

      <BottomNav />
    </div>
  );
}
