import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Reply, Trash2, Eye, Pencil, X, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import StickerPicker from "@/components/StickerPicker";
import MessageContent from "@/components/MessageContent";

export default function ChatRoom() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [partner, setPartner] = useState<any>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editMsg, setEditMsg] = useState<any>(null);
  const [selectedMsg, setSelectedMsg] = useState<string | null>(null);
  const [viewOnce, setViewOnce] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (partnerId) {
      supabase.from("profiles").select("*").eq("user_id", partnerId).single().then(({ data }) => setPartner(data));
      fetchMessages();
    }
  }, [partnerId]);

  const fetchMessages = async () => {
    if (!user || !partnerId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .is("group_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages(data || []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    if (data?.length) {
      await supabase.from("messages").update({ is_read: true }).eq("sender_id", partnerId).eq("receiver_id", user.id).eq("is_read", false);
    }
  };

  useEffect(() => {
    if (!user || !partnerId) return;
    const channel = supabase
      .channel(`chat-${partnerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const msg = payload.new as any;
          if ((msg.sender_id === user.id && msg.receiver_id === partnerId) || (msg.sender_id === partnerId && msg.receiver_id === user.id)) {
            setMessages((prev) => [...prev, msg]);
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }
        } else if (payload.eventType === "UPDATE") {
          setMessages((prev) => prev.map((m) => m.id === (payload.new as any).id ? (payload.new as any) : m));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId]);

  const sendMessage = async (content?: string) => {
    const text = (content || input).trim();
    if (!text || !user || !partnerId) return;

    if (editMsg) {
      await supabase.from("messages").update({ content: text }).eq("id", editMsg.id);
      setMessages((prev) => prev.map((m) => m.id === editMsg.id ? { ...m, content: text } : m));
      setEditMsg(null);
      setInput("");
      return;
    }

    if (!content) setInput("");
    const insertData: any = { sender_id: user.id, receiver_id: partnerId, content: text, is_view_once: viewOnce };
    if (!content && replyTo) insertData.reply_to = replyTo.id;
    if (!content) { setReplyTo(null); setViewOnce(false); }
    await supabase.from("messages").insert(insertData);
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

  const handleViewOnce = async (msg: any) => {
    if (msg.sender_id !== user?.id && !msg.is_viewed) {
      await supabase.from("messages").update({ is_viewed: true }).eq("id", msg.id);
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, is_viewed: true } : m));
    }
  };

  const isSticker = (content: string) => content?.startsWith("[STICKER:");
  const getRepliedMsg = (replyId: string | null) => replyId ? messages.find((m) => m.id === replyId) : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[hsl(var(--secondary))]/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border shrink-0">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate("/chat")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground font-bold text-sm overflow-hidden">
            {partner?.avatar_url ? (
              <img src={partner.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              partner?.username?.[0]?.toUpperCase() || "?"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm">{partner?.display_name || partner?.username}</p>
            <p className="text-xs text-muted-foreground">@{partner?.username}</p>
          </div>
        </div>
      </header>

      {/* Chat wallpaper background */}
      <main className="flex-1 overflow-y-auto px-3 py-3 max-w-lg mx-auto w-full space-y-1 chat-wallpaper">
        {messages.map((msg) => {
          const mine = msg.sender_id === user?.id;
          const sticker = isSticker(msg.content);
          const replied = getRepliedMsg(msg.reply_to);
          const isViewOnce = msg.is_view_once;
          const viewOnceHidden = isViewOnce && !mine && msg.is_viewed;

          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className="relative max-w-[80%]"
                onClick={() => setSelectedMsg(selectedMsg === msg.id ? null : msg.id)}
              >
                {/* Replied message preview */}
                {replied && (
                  <div className={`text-[11px] px-3 py-1.5 rounded-t-xl border-l-2 border-primary mb-0.5 ${mine ? "bg-primary/20 text-primary-foreground/70" : "bg-muted text-muted-foreground"}`}>
                    <span className="font-semibold">{replied.sender_id === user?.id ? "Vous" : partner?.username}</span>
                    <p className="truncate opacity-80">{replied.content?.startsWith("[STICKER:") ? "🎭 Sticker" : replied.content}</p>
                  </div>
                )}

                {sticker ? (
                  <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                    <MessageContent content={msg.content} />
                    <p className="text-[10px] text-muted-foreground px-1">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: fr })}
                      {mine && <span className="ml-1">{msg.is_read ? "✓✓" : "✓"}</span>}
                    </p>
                  </div>
                ) : viewOnceHidden ? (
                  <div className={`px-4 py-2.5 rounded-2xl text-sm bg-muted/50 text-muted-foreground italic ${mine ? "rounded-br-sm" : "rounded-bl-sm"}`}>
                    <Eye size={14} className="inline mr-1" /> Message éphémère ouvert
                  </div>
                ) : (
                  <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card text-foreground border border-border/50 rounded-bl-sm"}`}>
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

                {/* Context menu */}
                {selectedMsg === msg.id && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setSelectedMsg(null); }} />
                    <div className={`absolute z-40 ${mine ? "right-0" : "left-0"} top-full mt-1 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[140px]`}>
                      <button onClick={(e) => { e.stopPropagation(); startReply(msg); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors">
                        <Reply size={13} /> Répondre
                      </button>
                      {mine && !sticker && (
                        <button onClick={(e) => { e.stopPropagation(); startEdit(msg); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors">
                          <Pencil size={13} /> Modifier
                        </button>
                      )}
                      {mine && (
                        <button onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 size={13} /> Supprimer
                        </button>
                      )}
                      {isViewOnce && !mine && !msg.is_viewed && (
                        <button onClick={(e) => { e.stopPropagation(); handleViewOnce(msg); setSelectedMsg(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors">
                          <Eye size={13} /> Voir
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
              <><Reply size={11} className="inline mr-1" /> {replyTo.sender_id === user?.id ? "Vous" : partner?.username}: {replyTo.content?.startsWith("[STICKER:") ? "🎭 Sticker" : replyTo.content}</>
            )}
          </div>
          <button onClick={() => { setReplyTo(null); setEditMsg(null); setInput(""); }} className="text-muted-foreground"><X size={16} /></button>
        </div>
      )}

      {/* Input */}
      <div className="bg-background border-t border-border p-3 shrink-0">
        <div className="flex gap-2 max-w-lg mx-auto items-center">
          <StickerPicker onSendSticker={sendSticker} />
          {/* View once toggle */}
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
    </div>
  );
}
