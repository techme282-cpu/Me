import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Smile, Search, X, Loader2 } from "lucide-react";

interface StickerPickerProps {
  onSendSticker: (stickerUrl: string) => void;
}

export default function StickerPicker({ onSendSticker }: StickerPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [stickers, setStickers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stickerUrls, setStickerUrls] = useState<Record<string, string>>({});
  const timeoutRef = useRef<any>(null);

  const searchStickers = async (q: string) => {
    if (!q.trim()) { setStickers([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-stickers", {
        body: { action: "search", query: q.trim() },
      });
      if (!error && data?.stickers) {
        setStickers(data.stickers.slice(0, 24));
        // Pre-fetch URLs for the first stickers
        const firstBatch = data.stickers.slice(0, 8);
        firstBatch.forEach((s: any) => getFileUrl(s.file_id));
      } else {
        setStickers([]);
      }
    } catch { setStickers([]); }
    setLoading(false);
  };

  const getFileUrl = async (fileId: string) => {
    if (stickerUrls[fileId]) return stickerUrls[fileId];
    try {
      const { data } = await supabase.functions.invoke("telegram-stickers", {
        body: { action: "get_file", query: fileId },
      });
      if (data?.file_url) {
        setStickerUrls((prev) => ({ ...prev, [fileId]: data.file_url }));
        return data.file_url;
      }
    } catch {}
    return null;
  };

  const handleSend = async (fileId: string) => {
    let url = stickerUrls[fileId];
    if (!url) {
      url = await getFileUrl(fileId) || "";
    }
    if (url) {
      onSendSticker(`[STICKER:${url}]`);
      setOpen(false);
      setStickers([]);
      setQuery("");
    }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => searchStickers(val), 500);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-2.5 text-muted-foreground hover:text-primary transition-colors rounded-xl hover:bg-secondary"
      >
        <Smile size={20} />
      </button>

      {open && (
        <div className="absolute bottom-14 left-0 w-72 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-foreground">Stickers Telegram</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>

          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Nom du pack (ex: HotCherry)..."
                className="w-full bg-secondary rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                autoFocus
              />
            </div>
          </div>

          <div className="h-48 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : stickers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <Smile size={24} />
                <p className="text-xs text-center">Recherche un pack Telegram<br/>(ex: HotCherry, Animals)</p>
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-1">
                {stickers.map((s) => (
                  <button
                    key={s.file_unique_id}
                    onClick={() => handleSend(s.file_id)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-lg"
                    title={s.emoji}
                    onMouseEnter={() => getFileUrl(s.file_id)}
                  >
                    {stickerUrls[s.file_id] ? (
                      <img
                        src={stickerUrls[s.file_id]}
                        alt={s.emoji}
                        className="w-9 h-9 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span className="text-base">{s.emoji || "🎭"}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
