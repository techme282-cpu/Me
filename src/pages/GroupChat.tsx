import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, MoreVertical, Reply, Trash2, Eye, Pencil, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import StickerPicker from "@/components/StickerPicker";
import MessageContent from "@/components/MessageContent";

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
  const [editMsg, setEditMsg] = useState<any>(null);
  const [selectedMsg, setSelectedMsg] = useState<string | null>(null);
  const [viewOnce, setViewOnce] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

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
    const active = (data || []).filter((m) => m.status !== "pending");
    setMembers(active);
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
    if (isInitialLoad.current) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
        isInitialLoad.current = false;
      }, 100);
    }
  };

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`group-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setMessages((prev) => [...prev, payload.new as any]);
          if ((payload.new as any).sender_id === user?.id) {
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          }
        } else if (payload.eventType === "UPDATE") {
          setMessages((prev) => prev.map((m) => (m.id === (payload.new as any).id ? (payload.new as any) : m)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, user?.id]);

  const sendMessage = async (contentOverride?: string) => {
    const text = (contentOverride || input).trim();
    if (!text || !user || !groupId) return;

    if (editMsg && !contentOverride) {
      await supabase.from("messages").update({ content: text }).eq("id", editMsg.id);
      setMessages((prev) => prev.map((m) => m.id === editMsg.id ? { ...m, content: text } : m));
      setEditMsg(null);
      setInput("");
      return;
    }

    if (!contentOverride) setInput("");
    const insertData: any = { sender_id: user.id, group_id: groupId, content: text, is_view_once: !contentOverride && viewOnce };
    if (!contentOverride && replyTo) insertData.reply_to = replyTo.id;
    if (!contentOverride) { setReplyTo(null); setViewOnce(false); }
    await supabase.from("messages").insert(insertData);
    if (!contentOverride) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendSticker = (stickerContent: string) => sendMessage(stickerContent);

  const deleteMessage = async (msgId: string) => {
    await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setSelectedMsg(null);
    toast.success("Message supprimé");
  };

  const startEdit = (msg: any) => {
    setEditMsg(msg);
    setInput(msg.content);
    setSelectedMsg(null);
  };

  const startReply = (msg: any) => {
    setReplyTo(msg);
    setSelectedMsg(null);
  };

  const isMember = members.some((m) => m.user_id === user?.id);
  const myMembership = members.find((m) => m.user_id === user?.id);
  const isAdmin = myMembership?.role === "admin" || myMembership?.role === "owner";
  const canSend = isMember && (group?.is_open || isAdmin);

  const isSystemMessage = (msg: any) => typeof msg.content === "string" && msg.content.startsWith("[SYSTEM]");
  const getSystemText = (msg: any) => msg.content.replace("[SYSTEM] ", "");
  const isSticker = (content: string) => content?.startsWith("[STICKER:");

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="z-40 bg-background border-b border-border shrink-0">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate("/chat")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground font-bold text-sm overflow-hidden">
            {group?.avatar_url ? (
              <img src={group.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              group?.name?.[0]?.toUpperCase() || "G"
            )}
          </div>
          <div className="flex-1 min-w-0" onClick={() => navigate(`/group/${groupId}/settings`)} role="button">
            <p className="font-semibold text-foreground text-sm truncate">{group?.name || "Groupe"}</p>
            <p className="text-xs text-muted-foreground">{members.length} membre{members.length > 1 ? "s" : ""}</p>
          </div>
          <button onClick={() => navigate(`/group/${groupId}/settings`)} className="text-muted-foreground hover:text-foreground">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Messages - WhatsApp-style wallpaper */}
      <main className="flex-1 overflow-y-auto px-3 py-3 max-w-lg mx-auto w-full space-y-1 chat-wallpaper">
        {messages.map((msg) => {
          if (isSystemMessage(msg)) {
            return (
              <div key={msg.id} className="flex justify-center py-1">
                <p className="text-[11px] text-muted-foreground bg-card/80 px-3 py-1 rounded-full shadow-sm">{getSystemText(msg)}</p>
              </div>
            );
          }

          const mine = msg.sender_id === user?.id;
          const sender = profiles[msg.sender_id];
          const senderMembership = members.find((m) => m.user_id === msg.sender_id);
          const replied = msg.reply_to ? messages.find((m) => m.id === msg.reply_to) : null;
          const stickerMsg = isSticker(msg.content);
          const isViewOnce = msg.is_view_once;
          const viewOnceHidden = isViewOnce && !mine && msg.is_viewed;

          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className="relative max-w-[80%]"
                onClick={() => setSelectedMsg(selectedMsg === msg.id ? null : msg.id)}
              >
                {/* Reply preview */}
                {replied && (
                  <div className={`text-[11px] px-3 py-1.5 rounded-t-xl border-l-2 border-primary mb-0.5 ${mine ? "bg-primary/20 text-primary-foreground/70" : "bg-muted text-muted-foreground"}`}>
                    <span className="font-semibold">{profiles[replied.sender_id]?.username || "?"}</span>
                    <p className="truncate opacity-80">{replied.content?.startsWith("[STICKER:") ? "🎭 Sticker" : replied.content}</p>
                  </div>
                )}

                {stickerMsg ? (
                  <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                    {!mine && <p className="text-xs font-semibold text-primary px-1">{sender?.display_name || sender?.username || "?"}</p>}
                    <MessageContent content={msg.content} />
                    <p className="text-[10px] text-muted-foreground px-1">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                ) : viewOnceHidden ? (
                  <div className={`px-4 py-2.5 rounded-2xl text-sm bg-muted/50 text-muted-foreground italic ${mine ? "rounded-br-sm" : "rounded-bl-sm"}`}>
                    <Eye size={14} className="inline mr-1" /> Message éphémère ouvert
                  </div>
                ) : (
                  <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card text-foreground border border-border/50 rounded-bl-sm"}`}>
                    {!mine && (
                      <p className="text-xs font-semibold text-primary/80 mb-0.5 flex items-center gap-1">
                        {sender?.display_name || sender?.username || "?"}
                        {senderMembership?.role === "owner" && <span className="text-amber-500 text-[10px]">👑</span>}
                        {senderMembership?.role === "admin" && <span className="text-[10px] opacity-70">Admin</span>}
                      </p>
                    )}
                    {isViewOnce && <Eye size={12} className="inline mr-1 opacity-60" />}
                    <MessageContent content={msg.content} isMine={mine} />
                    <div className={`flex items-center gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                      <span className={`text-[10px] ${mine ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: fr })}
                      </span>
                      {mine && <span className={`text-[10px] ${msg.is_read ? "text-blue-300" : "text-primary-foreground/40"}`}>{msg.is_read ? "✓✓" : "✓"}</span>}
                    </div>
                  </div>
                )}

                {/* Context menu on tap */}
                {selectedMsg === msg.id && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setSelectedMsg(null); }} />
                    <div className={`absolute z-40 ${mine ? "right-0" : "left-0"} top-full mt-1 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]`}>
                      <button onClick={(e) => { e.stopPropagation(); startReply(msg); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors">
                        <Reply size={13} /> Répondre
                      </button>
                      {mine && !stickerMsg && (
                        <button onClick={(e) => { e.stopPropagation(); startEdit(msg); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors">
                          <Pencil size={13} /> Modifier
                        </button>
                      )}
                      {(mine || isAdmin) && (
                        <button onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 size={13} /> Supprimer
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* Reply / Edit bar */}
      {(replyTo || editMsg) && (
        <div className="bg-card border-t border-border px-4 py-2 max-w-lg mx-auto w-full flex items-center gap-2">
          <div className="flex-1 text-xs text-muted-foreground truncate border-l-2 border-primary pl-2">
            {editMsg ? (
              <><Pencil size={11} className="inline mr-1" /> Modification</>
            ) : (
              <><Reply size={11} className="inline mr-1" /> {profiles[replyTo.sender_id]?.username || "?"}: {replyTo.content?.startsWith("[STICKER:") ? "🎭 Sticker" : replyTo.content}</>
            )}
          </div>
          <button onClick={() => { setReplyTo(null); setEditMsg(null); setInput(""); }} className="text-muted-foreground"><X size={16} /></button>
        </div>
      )}

      {/* Input */}
      {isMember ? (
        canSend ? (
          <div className="bg-background border-t border-border p-3 shrink-0">
            <div className="flex gap-2 max-w-lg mx-auto items-center">
              <StickerPicker onSendSticker={sendSticker} />
              <button
                onClick={() => setViewOnce(!viewOnce)}
                className={`p-2 rounded-full transition-colors ${viewOnce ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title="Message éphémère"
              >
                <Eye size={18} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                className="flex-1 bg-secondary border border-border rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder={editMsg ? "Modifier le message..." : "Écrire un message..."}
              />
              <button onClick={() => sendMessage()} disabled={!input.trim()} className="bg-primary text-primary-foreground p-2.5 rounded-full disabled:opacity-50">
                <Send size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-background border-t border-border p-4 text-center shrink-0">
            <p className="text-sm text-muted-foreground">Seuls les admins peuvent envoyer des messages</p>
          </div>
        )
      ) : (
        <div className="bg-background border-t border-border p-4 text-center shrink-0">
          <p className="text-sm text-muted-foreground">Tu n'es pas membre de ce groupe</p>
        </div>
      )}
    </div>
  );
}
