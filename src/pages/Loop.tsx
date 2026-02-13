import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import { Heart, MessageCircle, Share2, User, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Loop() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("media_type", "video")
      .not("media_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data?.length) {
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const { data: profs } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds);
      const profileMap = new Map((profs || []).map((p) => [p.user_id, p]));
      setVideos(data.map((v) => ({ ...v, profiles: profileMap.get(v.user_id) })));
    }

    if (user) {
      const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", user.id);
      setLikedIds(new Set((likes || []).map((l) => l.post_id)));
    }
  };

  const handleLike = async (postId: string, likeCount: number) => {
    if (!user) return;
    if (likedIds.has(postId)) {
      setLikedIds((prev) => { const s = new Set(prev); s.delete(postId); return s; });
      await supabase.from("post_likes").delete().eq("user_id", user.id).eq("post_id", postId);
      await supabase.from("posts").update({ like_count: likeCount - 1 }).eq("id", postId);
    } else {
      setLikedIds((prev) => new Set(prev).add(postId));
      await supabase.from("post_likes").insert({ user_id: user.id, post_id: postId });
      await supabase.from("posts").update({ like_count: likeCount + 1 }).eq("id", postId);
    }
  };

  const handleShare = (postId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
    toast.success("Lien copié !");
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const index = Math.round(scrollTop / height);
    setCurrentIndex(index);
  };

  if (videos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Aucune vidéo pour le moment</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="h-screen relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {videos.map((video, index) => {
          const profile = video.profiles;
          const isLiked = likedIds.has(video.id);
          return (
            <div
              key={video.id}
              className="h-screen w-full snap-start relative flex items-center justify-center bg-background"
              style={{ scrollSnapAlign: "start" }}
            >
              <video
                src={video.media_url}
                className="h-full w-full object-cover"
                loop
                muted={muted}
                autoPlay={index === currentIndex}
                playsInline
                onClick={() => setMuted(!muted)}
              />

              {/* Overlay bottom */}
              <div className="absolute bottom-20 left-0 right-0 px-4 pb-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <button onClick={() => navigate(`/user/${video.user_id}`)} className="flex items-center gap-2 mb-2">
                      <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                        ) : (
                          profile?.username?.[0]?.toUpperCase() || "?"
                        )}
                      </div>
                      <span className="text-sm font-semibold text-foreground drop-shadow-lg">@{profile?.username}</span>
                    </button>
                    {video.content && (
                      <p className="text-sm text-foreground drop-shadow-lg line-clamp-2">{video.content}</p>
                    )}
                  </div>

                  {/* Side actions */}
                  <div className="flex flex-col items-center gap-5">
                    <button onClick={() => handleLike(video.id, video.like_count)} className="flex flex-col items-center gap-1">
                      <Heart size={28} className={`drop-shadow-lg ${isLiked ? "fill-accent text-accent" : "text-foreground"}`} />
                      <span className="text-xs text-foreground drop-shadow-lg">{video.like_count}</span>
                    </button>
                    <button className="flex flex-col items-center gap-1">
                      <MessageCircle size={28} className="text-foreground drop-shadow-lg" />
                      <span className="text-xs text-foreground drop-shadow-lg">{video.comment_count}</span>
                    </button>
                    <button onClick={() => handleShare(video.id)} className="flex flex-col items-center gap-1">
                      <Share2 size={28} className="text-foreground drop-shadow-lg" />
                    </button>
                    <button onClick={() => setMuted(!muted)}>
                      {muted ? <VolumeX size={24} className="text-foreground drop-shadow-lg" /> : <Volume2 size={24} className="text-foreground drop-shadow-lg" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
