import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { X, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

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

  useEffect(() => {
    fetchComments();
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
  };

  const sendComment = async () => {
    if (!input.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: input.trim(),
    });
    if (error) { toast.error("Erreur"); setLoading(false); return; }

    // Update comment count
    const newCount = comments.length + 1;
    await supabase.from("posts").update({ comment_count: newCount }).eq("id", postId);
    onCountChange(newCount);
    setInput("");
    setLoading(false);
    fetchComments();
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from("comments").delete().eq("id", commentId);
    const newCount = Math.max(0, comments.length - 1);
    await supabase.from("posts").update({ comment_count: newCount }).eq("id", postId);
    onCountChange(newCount);
    fetchComments();
    toast.success("Commentaire supprimé");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-card border-t border-border rounded-t-2xl max-h-[70vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Commentaires ({comments.length})</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Aucun commentaire</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3 group">
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                  {c.profile?.avatar_url ? (
                    <img src={c.profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                  ) : (
                    c.profile?.username?.[0]?.toUpperCase() || "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{c.profile?.display_name || c.profile?.username}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-0.5">{c.content}</p>
                </div>
                {c.user_id === user?.id && (
                  <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 text-destructive p-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input */}
        {user && (
          <div className="border-t border-border px-4 py-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendComment()}
                className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="Ajouter un commentaire..."
              />
              <button
                onClick={sendComment}
                disabled={!input.trim() || loading}
                className="gradient-primary text-primary-foreground p-2 rounded-xl disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
