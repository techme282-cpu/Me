import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Search, TrendingUp, Ban } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CertificationBadge from "@/components/CertificationBadge";

export default function Explore() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    // Exclude posts from banned users
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("like_count", { ascending: false })
      .limit(50);
    
    if (!data || data.length === 0) { setTrending([]); return; }

    // Filter out banned users' posts
    const userIds = [...new Set(data.map(p => p.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, is_banned").in("user_id", userIds);
    const bannedIds = new Set((profiles || []).filter(p => p.is_banned).map(p => p.user_id));
    setTrending(data.filter(p => !bannedIds.has(p.user_id)).slice(0, 20));
  };

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(20);
      setResults(data || []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="px-4 py-3 max-w-lg mx-auto">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Rechercher des utilisateurs..."
            />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {query.trim() ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Résultats</p>
            {results.length === 0 ? (
              <p className="text-muted-foreground text-sm py-6 text-center">Aucun résultat</p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/user/${p.user_id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
                >
                  <div className="w-11 h-11 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                    {p.avatar_url ? <img src={p.avatar_url} className="w-full h-full rounded-full object-cover" alt="" /> : p.username[0]?.toUpperCase()}
                  </div>
                  <div className="text-left flex-1">
                    {p.is_banned ? (
                      <div className="flex items-center gap-1.5">
                        <Ban size={14} className="text-destructive" />
                        <p className="text-sm text-destructive font-medium">Compte banni par Purge Hub 🚫</p>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-sm text-foreground flex items-center gap-1">
                          {p.display_name || p.username}
                          <CertificationBadge type={p.certification_type} size={14} />
                        </p>
                        <p className="text-xs text-muted-foreground">@{p.username}</p>
                      </>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              <p className="text-sm font-semibold text-foreground">Tendances</p>
            </div>
            {trending.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10">Rien pour le moment</p>
            ) : (
              <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden">
                {trending.map((post) => (
                  <div key={post.id} onClick={() => navigate(`/post/${post.id}`)} className="aspect-square bg-secondary flex items-center justify-center text-xs text-muted-foreground p-2 text-center cursor-pointer hover:opacity-80 transition-opacity">
                    {post.media_url ? (
                      <img src={post.media_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="line-clamp-3">{post.content?.slice(0, 60)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
