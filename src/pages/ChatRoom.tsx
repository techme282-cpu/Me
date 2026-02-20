import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import StickerPicker from "@/components/StickerPicker";
import MessageContent from "@/components/MessageContent";

export default function ChatRoom() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [partner, setPartner] = useState<any>(null);
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

    // Mark as read
    if (data?.length) {
      await supabase.from("messages").update({ is_read: true }).eq("sender_id", partnerId).eq("receiver_id", user.id).eq("is_read", false);
    }
  };

  useEffect(() => {
    if (!user || !partnerId) return;
    const channel = supabase
      .channel(`chat-${partnerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as any;
        if ((msg.sender_id === user.id && msg.receiver_id === partnerId) || (msg.sender_id === partnerId && msg.receiver_id === user.id)) {
          setMessages((prev) => [...prev, msg]);
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId]);

  const sendMessage = async (content?: string) => {
    const text = (content || input).trim();
    if (!text || !user || !partnerId) return;
    if (!content) setInput("");
    await supabase.from("messages").insert({ sender_id: user.id, receiver_id: partnerId, content: text });
  };

  const sendSticker = (stickerContent: string) => {
    sendMessage(stickerContent);
  };

  const isSticker = (content: string) => content.startsWith("[STICKER:");

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-40 glass border-b border-border shrink-0">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate("/chat")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm overflow-hidden">
            {partner?.avatar_url ? (
              <img src={partner.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              partner?.username?.[0]?.toUpperCase() || "?"
            )}
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">{partner?.display_name || partner?.username}</p>
            <p className="text-xs text-muted-foreground">@{partner?.username}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full space-y-2">
        {messages.map((msg) => {
          const mine = msg.sender_id === user?.id;
          const sticker = isSticker(msg.content);
          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              {sticker ? (
                <div className={`${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <MessageContent content={msg.content} />
                  <p className="text-[10px] text-muted-foreground px-1">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
              ) : (
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${mine ? "gradient-primary text-primary-foreground rounded-br-md" : "bg-secondary text-foreground rounded-bl-md"}`}>
                  <MessageContent content={msg.content} />
                  <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      <div className="sticky bottom-0 glass border-t border-border p-3 shrink-0">
        <div className="flex gap-2 max-w-lg mx-auto items-center">
          <StickerPicker onSendSticker={sendSticker} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            placeholder="Écrire un message..."
          />
          <button onClick={() => sendMessage()} disabled={!input.trim()} className="gradient-primary text-primary-foreground p-2.5 rounded-xl disabled:opacity-50">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
