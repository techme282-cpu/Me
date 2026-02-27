import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Star } from "lucide-react";
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

  const stickerMatch = content.match(/^\[STICKER:(.*?)\]$/);
  
  if (stickerMatch) {
    const url = stickerMatch[1];

    const handleStickerClick = async () => {
      if (!user) return;
      setShowFavOption(true);
      if (!checking) {
        setChecking(true);
        const { data } = await supabase
          .from("favorite_stickers")
          .select("id")
          .eq("user_id", user.id)
          .eq("sticker_url", url)
          .maybeSingle();
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
        await supabase.from("favorite_stickers").insert({
          user_id: user.id,
          sticker_url: url,
        });
        setIsFav(true);
        toast.success("Ajouté aux favoris ⭐");
      }
      setShowFavOption(false);
    };

    return (
      <div className="relative inline-block" onClick={handleStickerClick}>
        <img
          src={url}
          alt="sticker"
          className="w-24 h-24 object-contain cursor-pointer"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        {showFavOption && (
          <>
            <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setShowFavOption(false); }} />
            <button
              onClick={toggleFav}
              className="absolute -top-2 -right-2 z-40 bg-card border border-border rounded-full p-1.5 shadow-lg flex items-center gap-1 text-[11px] font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <Star size={12} className={isFav ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"} />
              {isFav ? "Retirer" : "Favori"}
            </button>
          </>
        )}
      </div>
    );
  }
  
  return <LinkifyText text={content} className={className} />;
}
