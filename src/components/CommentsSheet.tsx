import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { X, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { sendNotification } from "@/lib/notifications";

interface CommentsSheetProps {
  postId: string;
  onClose: () => void;
  onCountChange: (count: number) => void;
}

export default function CommentsSheet({ postId, onClose, onCountChange }: CommentsSheetProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchComments();
    // Auto-focus input for keyboard
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [postId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (data?.length) {
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profs } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds);
      const map = new Map((profs || []).map((p) => [p.user_id, p]));
      setComments(data.map((c) => ({ ...c, profile: map.get(c.user_id) })));
    } else {
      setComments([]);
    }
    // Scroll to bottom
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 100);
  };

  const sendComment = async () => {
    if (!input.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: input.trim(),
    });
    if (error) { toast.error("Erreur: " + error.message); setLoading(false); return; }

    const newCount = comments.length + 1;
    onCountChange(newCount);

    const { data: postData } = await supabase.from("posts").select("user_id").eq("id", postId).maybeSingle();
    if (postData && postData.user_id !== user.id) {
      const { data: myProfile } = await supabase.from("profiles").select("username").eq("user_id", user.id).maybeSingle();
      sendNotification({
        userId: postData.user_id,
        type: "comment",
        title: `${myProfile?.username || "Quelqu'un"} a commenté votre publication`,
        body: input.trim().substring(0, 100),
        relatedUserId: user.id,
        relatedPostId: postId,
      });
    }

    setInput("");
    setLoading(false);
    fetchComments();
    inputRef.current?.focus();
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from("comments").delete().eq("id", commentId);
    const newCount = Math.max(0, comments.length - 1);
    onCountChange(newCount);
    fetchComments();
    toast.success("Commentaire supprimé");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg mx-auto bg-background rounded-t-3xl flex flex-col animate-slide-up"
        style={{ maxHeight: "75vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-center px-4 py-2 relative">
          <h3 className="font-bold text-foreground text-sm">
            {comments.length} commentaire{comments.length !== 1 ? "s" : ""}
          </h3>
          <button onClick={onClose} className="absolute right-4 text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="h-px bg-border" />

        {/* Comments list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4 overscroll-contain">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-muted-foreground text-sm">Pas encore de commentaires</p>
              <p className="text-muted-foreground/60 text-xs">Soyez le premier à commenter</p>
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3 group">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground font-bold text-xs shrink-0 overflow-hidden">
                  {c.profile?.avatar_url ? (
                    <img src={c.profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    c.profile?.username?.[0]?.toUpperCase() || "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{c.profile?.username || "?"}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                    </span>
                    {c.user_id === user?.id && (
                      <button onClick={() => deleteComment(c.id)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors p-1">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground/90 mt-0.5 leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input bar - always visible, sticks above keyboard on mobile */}
        {user && (
          <div className="border-t border-border px-4 py-3 bg-background safe-bottom">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground font-bold text-xs shrink-0 overflow-hidden">
                {user ? "Y" : "?"}
              </div>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none py-2"
                placeholder="Ajouter un commentaire..."
                enterKeyHint="send"
                autoComplete="off"
              />
              {input.trim() && (
                <button
                  onClick={sendComment}
                  disabled={loading}
                  className="text-primary font-bold text-sm disabled:opacity-50"
                >
                  Publier
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
