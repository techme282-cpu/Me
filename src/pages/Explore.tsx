import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Search, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Explore() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("like_count", { ascending: false })
      .limit(20);
    setTrending(data || []);
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
                  <div className="text-left">
                    <p className="font-medium text-sm text-foreground">{p.display_name || p.username}</p>
                    <p className="text-xs text-muted-foreground">@{p.username}</p>
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
                  <div key={post.id} className="aspect-square bg-secondary flex items-center justify-center text-xs text-muted-foreground p-2 text-center">
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
