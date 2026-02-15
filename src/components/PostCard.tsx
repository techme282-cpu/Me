import { useState } from "react";
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Flag, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import CommentsSheet from "@/components/CommentsSheet";
import LinkifyText from "@/components/LinkifyText";

interface PostCardProps {
  post: {
    id: string;
    content: string;
    media_url: string | null;
    media_type: string | null;
    like_count: number;
    comment_count: number;
    share_count: number;
    hashtags: string[];
    created_at: string;
    user_id: string;
    profiles?: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
  isLiked?: boolean;
  isSaved?: boolean;
  onDelete?: () => void;
}

export default function PostCard({ post, isLiked = false, isSaved = false, onDelete }: PostCardProps) {
  const [liked, setLiked] = useState(isLiked);
  const [saved, setSaved] = useState(isSaved);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [animateLike, setAnimateLike] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const isOwner = user?.id === post.user_id;

  const handleLike = async () => {
    if (!user) return;
    setAnimateLike(true);
    setTimeout(() => setAnimateLike(false), 300);

    if (liked) {
      setLiked(false);
      setLikeCount((c) => c - 1);
      await supabase.from("post_likes").delete().eq("user_id", user.id).eq("post_id", post.id);
      await supabase.from("posts").update({ like_count: likeCount - 1 }).eq("id", post.id);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      await supabase.from("post_likes").insert({ user_id: user.id, post_id: post.id });
      await supabase.from("posts").update({ like_count: likeCount + 1 }).eq("id", post.id);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (saved) {
      setSaved(false);
      await supabase.from("post_favorites").delete().eq("user_id", user.id).eq("post_id", post.id);
    } else {
      setSaved(true);
      await supabase.from("post_favorites").insert({ user_id: user.id, post_id: post.id });
      toast.success("Ajouté aux favoris");
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "PURGE HUB", text: post.content || "", url });
      } catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Lien copié !");
    }
    await supabase.from("posts").update({ share_count: (post.share_count || 0) + 1 }).eq("id", post.id);
  };

  const handleDelete = async () => {
    if (!user || !isOwner) return;
    await supabase.from("posts").delete().eq("id", post.id);
    toast.success("Publication supprimée");
    setShowMenu(false);
    onDelete?.();
  };

  const handleReport = async () => {
    if (!user) return;
    await supabase.from("reports").insert({ reporter_id: user.id, reported_post_id: post.id, reason: "Contenu inapproprié" });
    toast.success("Signalement envoyé");
    setShowMenu(false);
  };

  const profile = post.profiles;

  return (
    <>
      <div className="bg-card rounded-2xl border border-border overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <button onClick={() => navigate(`/user/${post.user_id}`)} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
              ) : (
                profile?.username?.[0]?.toUpperCase() || "?"
              )}
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm text-foreground">{profile?.display_name || profile?.username}</p>
              <p className="text-xs text-muted-foreground">@{profile?.username}</p>
            </div>
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="text-muted-foreground hover:text-foreground p-1">
              <MoreHorizontal size={18} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-xl shadow-lg py-1 w-48">
                  {isOwner && (
                    <button onClick={handleDelete} className="w-full px-4 py-2.5 text-sm text-left hover:bg-secondary flex items-center gap-2 text-destructive">
                      <Trash2 size={14} /> Supprimer
                    </button>
                  )}
                  {!isOwner && (
                    <button onClick={handleReport} className="w-full px-4 py-2.5 text-sm text-left hover:bg-secondary flex items-center gap-2 text-foreground">
                      <Flag size={14} /> Signaler
                    </button>
                  )}
                  <button onClick={() => { handleShare(); setShowMenu(false); }} className="w-full px-4 py-2.5 text-sm text-left hover:bg-secondary flex items-center gap-2 text-foreground">
                    <Share2 size={14} /> Partager
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Media */}
        {post.media_url && post.media_type === "image" && (
          <div className="w-full bg-secondary">
            <img src={post.media_url} alt="" className="w-full max-h-[600px] object-contain" loading="lazy" />
          </div>
        )}
        {post.media_url && post.media_type === "video" && (
          <div className="w-full bg-secondary">
            <video src={post.media_url} className="w-full max-h-[600px] object-contain" controls playsInline />
          </div>
        )}

        {/* Content */}
        {post.content && (
          <div className="px-4 pt-3">
            <LinkifyText text={post.content} className="text-sm text-foreground leading-relaxed" />
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="px-4 pt-2 flex flex-wrap gap-1">
            {post.hashtags.map((tag) => (
              <span key={tag} className="text-xs text-primary font-medium">#{tag}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-5">
            <button onClick={handleLike} className="flex items-center gap-1.5 group">
              <Heart
                size={22}
                className={`transition-all ${animateLike ? "animate-like-pop" : ""} ${
                  liked ? "fill-accent text-accent" : "text-muted-foreground group-hover:text-accent"
                }`}
              />
              <span className="text-xs text-muted-foreground">{likeCount}</span>
            </button>
            <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 group">
              <MessageCircle size={22} className="text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-xs text-muted-foreground">{commentCount}</span>
            </button>
            <button onClick={handleShare} className="group">
              <Share2 size={22} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </div>
          <button onClick={handleSave}>
            <Bookmark
              size={22}
              className={`transition-all ${saved ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"}`}
            />
          </button>
        </div>
      </div>

      {showComments && (
        <CommentsSheet
          postId={post.id}
          onClose={() => setShowComments(false)}
          onCountChange={(count) => setCommentCount(count)}
        />
      )}
    </>
  );
}
