import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
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

  useEffect(() => {
    if (user) {
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
        // fetch partner profile
        const { data: prof } = await supabase.from("profiles").select("username, display_name, avatar_url").eq("user_id", partnerId).single();
        convos.push({ ...msg, partnerId, profile: prof });
      }
    }
    setConversations(convos);
  };

  const fetchGroups = async () => {
    if (!user) return;
    // Get groups the user is member of
    const { data: memberships } = await supabase.from("group_members").select("group_id").eq("user_id", user.id);
    if (!memberships?.length) { setGroups([]); return; }
    const groupIds = memberships.map((m) => m.group_id);
    const { data: groupsData } = await supabase.from("groups").select("*").in("id", groupIds).eq("status", "active").order("created_at", { ascending: false });

    // Get last message for each group
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
        return { ...g, lastMessage: lastMsg?.[0] || null, memberCount: count || 0 };
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

  const filteredConvos = conversations.filter((c) =>
    !search || (c.profile?.username?.toLowerCase().includes(search.toLowerCase()) || c.profile?.display_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredGroups = groups.filter((g) =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <h2 className="font-display font-bold text-foreground text-lg">Messages</h2>
          <button onClick={() => navigate("/create-group")} className="p-2 text-primary"><Plus size={22} /></button>
        </div>
        {/* Tabs */}
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

      <main className="max-w-lg mx-auto">
        {tab === "dms" ? (
          filteredConvos.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <MessageCircle size={48} className="mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Aucun message</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConvos.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/chat/${conv.partnerId}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
                    {conv.profile?.username?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="font-medium text-foreground text-sm truncate">{conv.profile?.display_name || conv.profile?.username}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{conv.content}</p>
                  </div>
                  {!conv.is_read && conv.receiver_id === user?.id && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
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
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold shrink-0">
                    {g.name?.[0]?.toUpperCase() || "G"}
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
                      {g.lastMessage ? g.lastMessage.content : `${g.memberCount} membre${g.memberCount > 1 ? "s" : ""}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </main>

      <BottomNav />
    </div>
  );
}
