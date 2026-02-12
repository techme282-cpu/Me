import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Settings, Reply, Trash2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

export default function GroupChat() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [group, setGroup] = useState<any>(null);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (groupId && user) {
      fetchGroup();
      fetchMessages();
      fetchMembers();
    }
  }, [groupId, user]);

  const fetchGroup = async () => {
    const { data } = await supabase.from("groups").select("*").eq("id", groupId!).single();
    setGroup(data);
  };

  const fetchMembers = async () => {
    const { data } = await supabase.from("group_members").select("*").eq("group_id", groupId!);
    setMembers(data || []);
    // fetch profiles for members
    if (data?.length) {
      const userIds = data.map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const map: Record<string, any> = {};
      (profs || []).forEach((p) => (map[p.user_id] = p));
      setProfiles(map);
    }
  };

  const fetchMessages = async () => {
    if (!groupId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(300);
    setMessages(data || []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // Realtime
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`group-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setMessages((prev) => [...prev, payload.new as any]);
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        } else if (payload.eventType === "UPDATE") {
          setMessages((prev) => prev.map((m) => (m.id === (payload.new as any).id ? (payload.new as any) : m)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  const sendMessage = async () => {
    if (!input.trim() || !user || !groupId) return;
    const content = input.trim();
    setInput("");
    const insertData: any = { sender_id: user.id, group_id: groupId, content };
    if (replyTo) insertData.reply_to = replyTo.id;
    setReplyTo(null);
    await supabase.from("messages").insert(insertData);
  };

  const deleteMessage = async (msgId: string) => {
    await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    toast.success("Message supprimé");
  };

  const replyMessage = messages.find((m) => m.id === replyTo?.id);

  const isMember = members.some((m) => m.user_id === user?.id);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate("/chat")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm">
            {group?.name?.[0]?.toUpperCase() || "G"}
          </div>
          <div className="flex-1 min-w-0" onClick={() => navigate(`/group/${groupId}/settings`)} role="button">
            <p className="font-semibold text-foreground text-sm truncate">{group?.name || "Groupe"}</p>
            <p className="text-xs text-muted-foreground">{members.length} membre{members.length > 1 ? "s" : ""}</p>
          </div>
          <button onClick={() => navigate(`/group/${groupId}/settings`)} className="text-muted-foreground hover:text-foreground">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-2">
        {messages.map((msg) => {
          const mine = msg.sender_id === user?.id;
          const sender = profiles[msg.sender_id];
          const replied = msg.reply_to ? messages.find((m) => m.id === msg.reply_to) : null;
          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] group relative`}>
                {/* Reply preview */}
                {replied && (
                  <div className="bg-muted/50 border-l-2 border-primary rounded-t-lg px-3 py-1.5 text-xs text-muted-foreground mb-0.5 truncate">
                    <span className="font-semibold text-primary">{profiles[replied.sender_id]?.username || "?"}</span>: {replied.content}
                  </div>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${mine ? "gradient-primary text-primary-foreground rounded-br-md" : "bg-secondary text-foreground rounded-bl-md"}`}>
                  {!mine && <p className="text-xs font-semibold text-primary mb-0.5">{sender?.display_name || sender?.username || "?"}</p>}
                  <p>{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
                {/* Actions on hover */}
                <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                  <button onClick={() => setReplyTo(msg)} className="p-1 rounded bg-background/80 text-muted-foreground hover:text-foreground">
                    <Reply size={12} />
                  </button>
                  {mine && (
                    <button onClick={() => deleteMessage(msg.id)} className="p-1 rounded bg-background/80 text-destructive hover:text-destructive">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* Reply bar */}
      {replyTo && (
        <div className="glass border-t border-border px-4 py-2 max-w-lg mx-auto w-full flex items-center gap-2">
          <div className="flex-1 text-xs text-muted-foreground truncate">
            <span className="text-primary font-semibold">↩ {profiles[replyTo.sender_id]?.username || "?"}</span>: {replyTo.content}
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground"><X size={16} /></button>
        </div>
      )}

      {/* Input */}
      {isMember ? (
        <div className="sticky bottom-0 glass border-t border-border p-3">
          <div className="flex gap-2 max-w-lg mx-auto">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="Écrire un message..."
            />
            <button onClick={sendMessage} disabled={!input.trim()} className="gradient-primary text-primary-foreground p-2.5 rounded-xl disabled:opacity-50">
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="sticky bottom-0 glass border-t border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">Tu n'es pas membre de ce groupe</p>
        </div>
      )}
    </div>
  );
}
