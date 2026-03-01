import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, MoreVertical, Reply, Trash2, Eye, Pencil, X, AtSign, Image, Mic, Video, Square } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import StickerPicker from "@/components/StickerPicker";
import MessageContent from "@/components/MessageContent";
import CertificationBadge from "@/components/CertificationBadge";

const WALLPAPER_PRESETS: Record<string, string> = {
  dark: "hsl(220,20%,10%)",
  blue: "hsl(210,60%,20%)",
  green: "hsl(150,40%,15%)",
  purple: "hsl(270,40%,18%)",
  pink: "hsl(340,40%,18%)",
  orange: "hsl(25,50%,18%)",
};

function getWallpaperStyle(wp: string): React.CSSProperties {
  if (wp.startsWith("http")) return { backgroundImage: `url(${wp})`, backgroundSize: "cover", backgroundPosition: "center" };
  if (WALLPAPER_PRESETS[wp]) return { backgroundColor: WALLPAPER_PRESETS[wp] };
  return {};
}

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
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [chatWallpaper, setChatWallpaper] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ file: File; url: string; isVideo: boolean } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (groupId && user) {
      fetchGroup();
      fetchMessages();
      fetchMembers();
      supabase.from("profiles").select("chat_wallpaper").eq("user_id", user.id).single().then(({ data }) => setChatWallpaper(data?.chat_wallpaper || null));
      // Mark group as read
      markGroupRead();
    }
  }, [groupId, user]);

  const markGroupRead = useCallback(async () => {
    if (!user || !groupId) return;
    await supabase.from("group_reads").upsert({ group_id: groupId, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: "group_id,user_id" });
  }, [user, groupId]);

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
          // Mark as read when new messages arrive and user is viewing
          markGroupRead();
        } else if (payload.eventType === "UPDATE") {
          setMessages((prev) => prev.map((m) => (m.id === (payload.new as any).id ? (payload.new as any) : m)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, user?.id, markGroupRead]);

  // Handle @ mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    // Check if user is typing @mention
    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === " ")) {
      const query = val.slice(lastAt + 1);
      if (!query.includes(" ")) {
        setMentionSearch(query.toLowerCase());
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (profile: any) => {
    const lastAt = input.lastIndexOf("@");
    const before = input.slice(0, lastAt);
    const mention = `@${profile.username} `;
    setInput(before + mention);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredMentions = Object.values(profiles).filter(
    (p: any) =>
      p.user_id !== user?.id &&
      (p.username?.toLowerCase().includes(mentionSearch) ||
        p.display_name?.toLowerCase().includes(mentionSearch))
  );

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
    const insertData: any = { sender_id: user.id, group_id: groupId, content: text };
    if (!contentOverride && replyTo) insertData.reply_to = replyTo.id;
    if (!contentOverride) setReplyTo(null);
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

  // Highlight @mentions in message text
  const renderContent = (msg: any, mine: boolean) => {
    const content = msg.content;
    // Check for @username mentions
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    if (parts.length <= 1) {
      return <MessageContent content={content} isMine={mine} />;
    }
    return (
      <span>
        {parts.map((part: string, i: number) => {
          if (i % 2 === 1) {
            // This is a username match
            const mentionedProfile = Object.values(profiles).find((p: any) => p.username === part);
            return (
              <span
                key={i}
                className={`font-semibold cursor-pointer ${mine ? "text-white underline" : "text-primary"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (mentionedProfile) navigate(`/user/${mentionedProfile.user_id}`);
                }}
              >
                @{part}
              </span>
            );
          }
          return <MessageContent key={i} content={part} isMine={mine} />;
        })}
      </span>
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="z-40 bg-background/95 backdrop-blur-lg border-b border-border shrink-0">
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
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/group/${groupId}/settings`)} role="button">
            <p className="font-semibold text-foreground text-sm truncate">{group?.name || "Groupe"}</p>
            <p className="text-xs text-muted-foreground">{members.length} membre{members.length > 1 ? "s" : ""}</p>
          </div>
          <button onClick={() => navigate(`/group/${groupId}/settings`)} className="text-muted-foreground hover:text-foreground">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className={`flex-1 overflow-y-auto px-3 py-3 max-w-lg mx-auto w-full space-y-1 ${!chatWallpaper ? "chat-wallpaper" : ""}`} style={chatWallpaper ? getWallpaperStyle(chatWallpaper) : undefined}>
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
              {/* Avatar for others */}
              {!mine && (
                <div
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold mr-1.5 mt-auto shrink-0 overflow-hidden cursor-pointer"
                  onClick={() => sender && navigate(`/user/${sender.user_id}`)}
                >
                  {sender?.avatar_url ? (
                    <img src={sender.avatar_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    sender?.username?.[0]?.toUpperCase() || "?"
                  )}
                </div>
              )}
              <div
                className="relative max-w-[75%]"
                onClick={() => setSelectedMsg(selectedMsg === msg.id ? null : msg.id)}
              >
                {replied && (
                  <div className={`text-[11px] px-3 py-1.5 rounded-t-xl border-l-2 border-primary mb-0.5 ${mine ? "bg-primary/20 text-primary-foreground/70" : "bg-muted text-muted-foreground"}`}>
                    <span className="font-semibold">{profiles[replied.sender_id]?.username || "?"}</span>
                    <p className="truncate opacity-80">{replied.content?.startsWith("[STICKER:") ? "🎭 Sticker" : replied.content}</p>
                  </div>
                )}

                {stickerMsg ? (
                  <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                    {!mine && (
                      <p className="text-xs font-semibold text-primary px-1 flex items-center gap-1">
                        {sender?.display_name || sender?.username || "?"}
                        <CertificationBadge type={sender?.certification_type} size={12} />
                      </p>
                    )}
                    <MessageContent content={msg.content} />
                    <p className="text-[10px] text-muted-foreground px-1">
                      {format(new Date(msg.created_at), "HH:mm")}
                    </p>
                  </div>
                ) : viewOnceHidden ? (
                  <div className={`px-4 py-2.5 rounded-2xl text-sm bg-muted/50 text-muted-foreground italic ${mine ? "rounded-br-sm" : "rounded-bl-sm"}`}>
                    <Eye size={14} className="inline mr-1" /> Message éphémère ouvert
                  </div>
                ) : (
                  <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${mine ? "bg-[hsl(195,100%,35%)] text-white rounded-br-sm" : "bg-card text-foreground border border-border/50 rounded-bl-sm"}`}>
                    {!mine && (
                      <p className="text-xs font-semibold mb-0.5 flex items-center gap-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); sender && navigate(`/user/${sender.user_id}`); }}>
                        <span className={mine ? "text-white/80" : "text-primary/80"}>{sender?.display_name || sender?.username || "?"}</span>
                        <CertificationBadge type={sender?.certification_type} size={12} />
                        {senderMembership?.role === "owner" && <span className="text-amber-500 text-[10px]">👑</span>}
                        {senderMembership?.role === "admin" && <span className="text-[10px] opacity-70">Admin</span>}
                      </p>
                    )}
                    {isViewOnce && <Eye size={12} className="inline mr-1 opacity-60" />}
                    {renderContent(msg, mine)}
                    <div className={`flex items-center gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                      <span className={`text-[10px] ${mine ? "text-white/50" : "text-muted-foreground"}`}>
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                      {mine && <span className={`text-[10px] ${msg.is_read ? "text-blue-300" : "text-white/40"}`}>{msg.is_read ? "✓✓" : "✓"}</span>}
                    </div>
                  </div>
                )}

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

      {/* @ Mention picker */}
      {showMentions && filteredMentions.length > 0 && (
        <div className="bg-card border-t border-border max-w-lg mx-auto w-full max-h-40 overflow-y-auto">
          {filteredMentions.slice(0, 8).map((p: any) => (
            <button
              key={p.user_id}
              onClick={() => insertMention(p)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-secondary/50 text-left"
            >
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold overflow-hidden">
                {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" alt="" /> : p.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-foreground font-medium">{p.display_name || p.username}</span>
                <CertificationBadge type={p.certification_type} size={12} />
                <span className="text-xs text-muted-foreground">@{p.username}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <input type="file" ref={fileInputRef} accept="image/*,video/*" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file || !user || !groupId) return;
        const isVideo = file.type.startsWith("video/");
        const url = URL.createObjectURL(file);
        setPendingMedia({ file, url, isVideo });
        e.target.value = "";
      }} />

      {/* Media preview with view-once option */}
      {pendingMedia && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
          <div className="max-w-sm w-full bg-card rounded-2xl overflow-hidden shadow-xl">
            <div className="p-3 max-h-[60vh] overflow-hidden flex items-center justify-center bg-black">
              {pendingMedia.isVideo ? (
                <video src={pendingMedia.url} className="max-h-[55vh] rounded-lg" controls />
              ) : (
                <img src={pendingMedia.url} className="max-h-[55vh] object-contain rounded-lg" alt="Aperçu" />
              )}
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const ext = pendingMedia.file.name.split(".").pop();
                    const path = `chat/${groupId}/${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from("media").upload(path, pendingMedia.file);
                    if (error) { toast.error("Erreur upload"); return; }
                    const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
                    const tag = pendingMedia.isVideo ? "VIDEO" : "IMAGE";
                    await supabase.from("messages").insert({ sender_id: user!.id, group_id: groupId, content: `[${tag}:${urlData.publicUrl}]`, is_view_once: false });
                    URL.revokeObjectURL(pendingMedia.url);
                    setPendingMedia(null);
                  }}
                  className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-full text-sm font-medium"
                >
                  <Send size={14} className="inline mr-1.5" /> Envoyer
                </button>
                <button
                  onClick={async () => {
                    const ext = pendingMedia.file.name.split(".").pop();
                    const path = `chat/${groupId}/${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from("media").upload(path, pendingMedia.file);
                    if (error) { toast.error("Erreur upload"); return; }
                    const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
                    const tag = pendingMedia.isVideo ? "VIDEO" : "IMAGE";
                    await supabase.from("messages").insert({ sender_id: user!.id, group_id: groupId, content: `[${tag}:${urlData.publicUrl}]`, is_view_once: true });
                    URL.revokeObjectURL(pendingMedia.url);
                    setPendingMedia(null);
                  }}
                  className="flex-1 bg-secondary text-foreground py-2.5 rounded-full text-sm font-medium border border-border flex items-center justify-center gap-1.5"
                >
                  <Eye size={14} /> Vue unique
                </button>
              </div>
              <button onClick={() => { URL.revokeObjectURL(pendingMedia.url); setPendingMedia(null); }} className="text-muted-foreground text-sm py-1">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      {isMember ? (
        canSend ? (
          <div className="bg-background border-t border-border p-3 shrink-0 safe-bottom">
            <div className="flex gap-2 max-w-lg mx-auto items-center">
              <StickerPicker onSendSticker={sendSticker} />
              <button onClick={() => fileInputRef.current?.click()} className="text-muted-foreground hover:text-foreground p-1">
                <Image size={20} />
              </button>
              <button
                onClick={async () => {
                  if (isRecording) {
                    mediaRecorderRef.current?.stop();
                    setIsRecording(false);
                  } else {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                      const recorder = new MediaRecorder(stream);
                      audioChunksRef.current = [];
                      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
                      recorder.onstop = async () => {
                        stream.getTracks().forEach((t) => t.stop());
                        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                        const path = `chat/${groupId}/${Date.now()}.webm`;
                        const { error } = await supabase.storage.from("media").upload(path, blob);
                        if (error) { toast.error("Erreur upload vocal"); return; }
                        const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
                        await supabase.from("messages").insert({ sender_id: user!.id, group_id: groupId, content: `[VOICE:${urlData.publicUrl}]` });
                      };
                      mediaRecorderRef.current = recorder;
                      recorder.start();
                      setIsRecording(true);
                    } catch { toast.error("Micro non disponible"); }
                  }
                }}
                className={`p-1 ${isRecording ? "text-destructive animate-pulse" : "text-muted-foreground hover:text-foreground"}`}
              >
                {isRecording ? <Square size={20} /> : <Mic size={20} />}
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => { if (e.key === "Enter") { setShowMentions(false); sendMessage(); } }}
                className="flex-1 bg-secondary border border-border rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder={editMsg ? "Modifier le message..." : "Écrire un message..."}
              />
              <button onClick={() => { setShowMentions(false); sendMessage(); }} disabled={!input.trim()} className="bg-primary text-primary-foreground p-2.5 rounded-full disabled:opacity-50">
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
