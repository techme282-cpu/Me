import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Star, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import LinkifyText from "./LinkifyText";

interface MessageContentProps {
  content: string;
  className?: string;
  isMine?: boolean;
}

export default function MessageContent({ content, className, isMine }: MessageContentProps) {
  const { user } = useAuth();
  const [showFavOption, setShowFavOption] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sticker
  const stickerMatch = content.match(/^\[STICKER:(.*?)\]$/);
  if (stickerMatch) {
    const url = stickerMatch[1];
    const handleStickerClick = async () => {
      if (!user) return;
      setShowFavOption(true);
      if (!checking) {
        setChecking(true);
        const { data } = await supabase.from("favorite_stickers").select("id").eq("user_id", user.id).eq("sticker_url", url).maybeSingle();
        setIsFav(!!data);
        setChecking(false);
      }
    };
    const toggleFav = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user) return;
      if (isFav) {
        await supabase.from("favorite_stickers").delete().eq("user_id", user.id).eq("sticker_url", url);
        setIsFav(false);
        toast.success("Retiré des favoris");
      } else {
        await supabase.from("favorite_stickers").insert({ user_id: user.id, sticker_url: url });
        setIsFav(true);
        toast.success("Ajouté aux favoris ⭐");
      }
      setShowFavOption(false);
    };
    return (
      <div className="relative inline-block" onClick={handleStickerClick}>
        <img src={url} alt="sticker" className="w-24 h-24 object-contain cursor-pointer" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        {showFavOption && (
          <>
            <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setShowFavOption(false); }} />
            <button onClick={toggleFav} className="absolute -top-2 -right-2 z-40 bg-card border border-border rounded-full p-1.5 shadow-lg flex items-center gap-1 text-[11px] font-medium text-foreground hover:bg-secondary transition-colors">
              <Star size={12} className={isFav ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"} />
              {isFav ? "Retirer" : "Favori"}
            </button>
          </>
        )}
      </div>
    );
  }

  // Image
  const imageMatch = content.match(/^\[IMAGE:(.*?)\]$/);
  if (imageMatch) {
    return (
      <img
        src={imageMatch[1]}
        alt="media"
        className="max-w-[240px] max-h-[300px] rounded-xl object-cover cursor-pointer"
        onClick={(e) => { e.stopPropagation(); window.open(imageMatch[1], "_blank"); }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }

  // Video
  const videoMatch = content.match(/^\[VIDEO:(.*?)\]$/);
  if (videoMatch) {
    return (
      <video
        src={videoMatch[1]}
        controls
        className="max-w-[240px] max-h-[300px] rounded-xl"
        preload="metadata"
      />
    );
  }

  // Voice
  const voiceMatch = content.match(/^\[VOICE:(.*?)\]$/);
  if (voiceMatch) {
    return (
      <div className="flex items-center gap-2 min-w-[160px]">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!audioRef.current) {
              audioRef.current = new Audio(voiceMatch[1]);
              audioRef.current.onended = () => setIsPlaying(false);
            }
            if (isPlaying) {
              audioRef.current.pause();
              setIsPlaying(false);
            } else {
              audioRef.current.play();
              setIsPlaying(true);
            }
          }}
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMine ? "bg-white/20" : "bg-primary/20"}`}
        >
          {isPlaying ? <Pause size={14} className={isMine ? "text-white" : "text-primary"} /> : <Play size={14} className={isMine ? "text-white" : "text-primary"} />}
        </button>
        <div className="flex-1 flex items-center gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={`w-1 rounded-full ${isMine ? "bg-white/40" : "bg-primary/40"}`} style={{ height: `${8 + Math.random() * 14}px` }} />
          ))}
        </div>
        <span className={`text-[10px] ${isMine ? "text-white/50" : "text-muted-foreground"}`}>🎤</span>
      </div>
    );
  }

  return <LinkifyText text={content} className={className} />;
}
