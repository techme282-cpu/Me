import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Smile, Search, X, Loader2, Star, Download, Link2 } from "lucide-react";
import { toast } from "sonner";

interface StickerPickerProps {
  onSendSticker: (stickerUrl: string) => void;
}

type Tab = "favorites" | "search" | "download";

export default function StickerPicker({ onSendSticker }: StickerPickerProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("favorites");
  const [query, setQuery] = useState("");
  const [packLink, setPackLink] = useState("");
  const [stickers, setStickers] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [stickerUrls, setStickerUrls] = useState<Record<string, string>>({});
  const timeoutRef = useRef<any>(null);

  // Load favorites when picker opens
  useEffect(() => {
    if (open && user) fetchFavorites();
  }, [open, user]);

  const fetchFavorites = async () => {
    if (!user) return;
    setLoadingFavs(true);
    const { data } = await supabase
      .from("favorite_stickers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setFavorites(data || []);
    setLoadingFavs(false);
  };

  const searchStickers = async (q: string) => {
    if (!q.trim()) { setStickers([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-stickers", {
        body: { action: "search", query: q.trim() },
      });
      if (!error && data?.stickers) {
        setStickers(data.stickers.slice(0, 30));
        data.stickers.slice(0, 10).forEach((s: any) => getFileUrl(s.file_id));
      } else {
        setStickers([]);
      }
    } catch { setStickers([]); }
    setLoading(false);
  };

  const loadPackFromLink = async () => {
    const link = packLink.trim();
    if (!link) return;
    // Extract pack name from t.me/addstickers/PACKNAME or just pack name
    let packName = link;
    const match = link.match(/(?:t\.me\/addstickers\/|stickers\/)([a-zA-Z0-9_]+)/);
    if (match) packName = match[1];

    setLoading(true);
    setTab("search");
    setQuery(packName);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-stickers", {
        body: { action: "search", query: packName },
      });
      if (!error && data?.stickers) {
        setStickers(data.stickers.slice(0, 30));
        data.stickers.slice(0, 10).forEach((s: any) => getFileUrl(s.file_id));
        toast.success(`Pack "${data.title || packName}" chargé !`);
      } else {
        toast.error("Pack introuvable");
        setStickers([]);
      }
    } catch { toast.error("Erreur de chargement"); setStickers([]); }
    setLoading(false);
    setPackLink("");
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
    if (!url) url = await getFileUrl(fileId) || "";
    if (url) {
      onSendSticker(`[STICKER:${url}]`);
      setOpen(false);
      setStickers([]);
      setQuery("");
    }
  };

  const handleSendFav = (stickerUrl: string) => {
    onSendSticker(`[STICKER:${stickerUrl}]`);
    setOpen(false);
  };

  const toggleFavorite = async (stickerUrl: string, emoji?: string, setName?: string) => {
    if (!user) return;
    const existing = favorites.find((f) => f.sticker_url === stickerUrl);
    if (existing) {
      await supabase.from("favorite_stickers").delete().eq("id", existing.id);
      setFavorites((prev) => prev.filter((f) => f.id !== existing.id));
      toast.success("Retiré des favoris");
    } else {
      const { data } = await supabase.from("favorite_stickers").insert({
        user_id: user.id,
        sticker_url: stickerUrl,
        emoji: emoji || null,
        sticker_set_name: setName || null,
      }).select().single();
      if (data) {
        setFavorites((prev) => [data, ...prev]);
        toast.success("Ajouté aux favoris ⭐");
      }
    }
  };

  const isFavorite = (url: string) => favorites.some((f) => f.sticker_url === url);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => searchStickers(val), 500);
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "favorites", label: "⭐ Favoris", icon: Star },
    { key: "search", label: "Recherche", icon: Search },
    { key: "download", label: "Lien", icon: Download },
  ];

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
        <div className="absolute bottom-14 left-0 w-80 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-foreground">Stickers</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 text-[11px] font-medium py-2 transition-colors ${
                  tab === t.key
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "search" && (
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
          )}

          {tab === "download" && (
            <div className="p-3 space-y-2">
              <p className="text-[11px] text-muted-foreground">Colle un lien de pack Telegram pour le charger :</p>
              <div className="relative">
                <Link2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={packLink}
                  onChange={(e) => setPackLink(e.target.value)}
                  placeholder="https://t.me/addstickers/NomDuPack"
                  className="w-full bg-secondary rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  onKeyDown={(e) => { if (e.key === "Enter") loadPackFromLink(); }}
                />
              </div>
              <button
                onClick={loadPackFromLink}
                disabled={!packLink.trim() || loading}
                className="w-full bg-primary text-primary-foreground text-xs py-2 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Charger le pack
              </button>
            </div>
          )}

          <div className="h-52 overflow-y-auto p-2">
            {tab === "favorites" && (
              loadingFavs ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <Star size={24} />
                  <p className="text-xs text-center">Aucun sticker favori<br/>Clique sur un sticker dans le chat pour l'ajouter ⭐</p>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {favorites.map((fav) => (
                    <button
                      key={fav.id}
                      onClick={() => handleSendFav(fav.sticker_url)}
                      className="relative w-full aspect-square flex items-center justify-center rounded-lg hover:bg-secondary transition-colors group"
                    >
                      <img
                        src={fav.sticker_url}
                        alt={fav.emoji || "sticker"}
                        className="w-12 h-12 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(fav.sticker_url, fav.emoji, fav.sticker_set_name); }}
                        className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Star size={10} className="text-yellow-500 fill-yellow-500" />
                      </button>
                    </button>
                  ))}
                </div>
              )
            )}

            {tab === "search" && (
              loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : stickers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <Search size={24} />
                  <p className="text-xs text-center">Recherche un pack Telegram<br/>(ex: HotCherry, Animals)</p>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {stickers.map((s) => {
                    const url = stickerUrls[s.file_id];
                    return (
                      <div key={s.file_unique_id} className="relative group">
                        <button
                          onClick={() => handleSend(s.file_id)}
                          className="w-full aspect-square flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
                          title={s.emoji}
                          onMouseEnter={() => getFileUrl(s.file_id)}
                        >
                          {url ? (
                            <img src={url} alt={s.emoji} className="w-12 h-12 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <span className="text-base">{s.emoji || "🎭"}</span>
                          )}
                        </button>
                        {url && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(url, s.emoji, s.set_name); }}
                            className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Star size={10} className={isFavorite(url) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {tab === "download" && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <Link2 size={24} />
                <p className="text-xs text-center">Colle un lien t.me/addstickers/<br/>pour télécharger un pack</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
