import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "Bot token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, sticker_set_name, query } = await req.json();

    if (action === "search") {
      // Search for sticker sets by name
      const url = `https://api.telegram.org/bot${token}/getStickerSet?name=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.ok) {
        return new Response(JSON.stringify({ stickers: [], error: data.description }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stickers = data.result.stickers.map((s: any) => ({
        file_id: s.file_id,
        file_unique_id: s.file_unique_id,
        emoji: s.emoji,
        is_animated: s.is_animated,
        is_video: s.is_video,
        set_name: data.result.name,
        thumb: s.thumbnail
          ? `https://api.telegram.org/file/bot${token}/${s.thumbnail.file_path}`
          : null,
      }));

      return new Response(JSON.stringify({ stickers, set_name: data.result.name, title: data.result.title }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_file") {
      // Get the actual file URL for a sticker
      const fileRes = await fetch(
        `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(query)}`
      );
      const fileData = await fileRes.json();

      if (!fileData.ok) {
        return new Response(JSON.stringify({ error: fileData.description }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const file_url = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
      return new Response(JSON.stringify({ file_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "trending") {
      // Return some popular sticker set names
      const popularSets = [
        "HotCherry", "AnimalMemes", "Pepe", "CatMemes",
        "FunnyAnimals", "MemesMaster", "StickerPacks",
      ];
      const results = [];
      for (const name of popularSets) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/getStickerSet?name=${name}`);
          const data = await res.json();
          if (data.ok) {
            results.push({
              name: data.result.name,
              title: data.result.title,
              count: data.result.stickers.length,
              thumb_file_id: data.result.stickers[0]?.file_id,
            });
          }
        } catch { /* skip */ }
      }
      return new Response(JSON.stringify({ sets: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
