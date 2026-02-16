import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Trash2, Heart } from "lucide-react";
import { toast } from "sonner";

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  expires_at: string;
  profile?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export default function StoriesBar() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showBigHeart, setShowBigHeart] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef(0);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("stories")
      .select("*")
      .gt("expires_at", now)
      .order("created_at", { ascending: false });

    if (!data?.length) { setStories([]); return; }

    const userIds = [...new Set(data.map((s: any) => s.user_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", userIds);

    const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
    const seen = new Set<string>();
    const unique: Story[] = [];
    for (const s of data) {
      if (!seen.has(s.user_id)) {
        seen.add(s.user_id);
        unique.push({ ...s, profile: profMap.get(s.user_id) || undefined });
      }
    }
    setStories(unique);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) { toast.error("Image ou vidéo uniquement"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 10MB)"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/story_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("media").upload(path, file);
    if (uploadError) { toast.error("Erreur upload"); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);

    await supabase.from("stories").insert({
      user_id: user.id,
      media_url: urlData.publicUrl,
      media_type: isImage ? "image" : "video",
    });

    toast.success("Story publiée !");
    setUploading(false);
    fetchStories();
    if (fileRef.current) fileRef.current.value = "";
  };

  const deleteStory = async (storyId: string) => {
    await supabase.from("stories").delete().eq("id", storyId);
    toast.success("Story supprimée");
    setViewingStory(null);
    fetchStories();
  };

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setShowBigHeart(true);
      setTimeout(() => setShowBigHeart(false), 800);
    }
    lastTapRef.current = now;
  }, []);

  const myStory = stories.find((s) => s.user_id === user?.id);
  const otherStories = stories.filter((s) => s.user_id !== user?.id);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-hide">
        {/* My story / Add */}
        <button
          onClick={() => myStory ? setViewingStory(myStory) : fileRef.current?.click()}
          className="flex flex-col items-center gap-1 shrink-0"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center relative ${myStory ? "ring-2 ring-primary p-0.5" : "bg-secondary border-2 border-dashed border-border"}`}>
            {myStory ? (
              <img src={myStory.profile?.avatar_url || ""} className="w-full h-full rounded-full object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <Plus size={20} className="text-muted-foreground" />
            )}
            {!myStory && (
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full gradient-primary flex items-center justify-center">
                <Plus size={10} className="text-primary-foreground" />
              </div>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">{myStory ? "Ma story" : "Ajouter"}</span>
        </button>

        {otherStories.map((story) => (
          <button
            key={story.id}
            onClick={() => setViewingStory(story)}
            className="flex flex-col items-center gap-1 shrink-0"
          >
            <div className="w-16 h-16 rounded-full ring-2 ring-primary p-0.5">
              <div className="w-full h-full rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm overflow-hidden">
                {story.profile?.avatar_url ? (
                  <img src={story.profile.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                ) : (
                  story.profile?.username?.[0]?.toUpperCase() || "?"
                )}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground truncate max-w-[64px]">
              {story.profile?.username || "?"}
            </span>
          </button>
        ))}

        {uploading && (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <span className="text-[10px] text-muted-foreground">Upload...</span>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />

      {/* Story Viewer */}
      {viewingStory && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                {viewingStory.profile?.username?.[0]?.toUpperCase() || "?"}
              </div>
              <span className="text-sm font-medium text-foreground">{viewingStory.profile?.display_name || viewingStory.profile?.username}</span>
            </div>
            <div className="flex items-center gap-2">
              {viewingStory.user_id === user?.id && (
                <button onClick={() => deleteStory(viewingStory.id)} className="p-2 text-destructive">
                  <Trash2 size={20} />
                </button>
              )}
              <button onClick={() => setViewingStory(null)} className="p-2 text-muted-foreground">
                <X size={22} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 relative select-none" onClick={handleDoubleTap}>
            {viewingStory.media_type === "video" ? (
              <video src={viewingStory.media_url} className="max-w-full max-h-full rounded-xl object-contain" autoPlay controls playsInline />
            ) : (
              <img src={viewingStory.media_url} className="max-w-full max-h-full rounded-xl object-contain" alt="" draggable={false} />
            )}
            {showBigHeart && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Heart size={80} className="fill-accent text-accent animate-like-pop drop-shadow-lg" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
