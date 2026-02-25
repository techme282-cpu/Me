import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get certification requests that are "analyzing" and submitted >= 24h ago
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: requests, error } = await supabase
      .from("certification_requests")
      .select("*")
      .eq("status", "analyzing")
      .lte("submitted_at", cutoff);

    if (error) throw error;
    if (!requests || requests.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let processed = 0;

    for (const request of requests) {
      // Get follower count
      const { count: followerCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", request.user_id)
        .eq("status", "accepted");

      // Get followers' user IDs
      const { data: followers } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", request.user_id)
        .eq("status", "accepted");

      if (!followers || (followerCount || 0) < 30) {
        // Not enough followers - reject
        await supabase.from("certification_requests").update({
          status: "rejected",
          rejection_reason: "Nombre de followers insuffisant (minimum 30 requis).",
          analyzed_at: new Date().toISOString(),
        }).eq("id", request.id);

        await supabase.from("notifications").insert({
          user_id: request.user_id,
          type: "certification_rejected",
          title: "Certification refusée",
          body: "Votre demande a été refusée : nombre de followers insuffisant.",
        });
        processed++;
        continue;
      }

      // Check follower activity - how many have been active in the last 7 days
      const activeThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const followerIds = followers.map(f => f.follower_id);
      
      const { count: activeCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .in("user_id", followerIds)
        .gte("last_seen", activeThreshold);

      const activeRatio = (activeCount || 0) / followerIds.length;

      if (activeRatio < 0.5) {
        // Majority inactive - reject
        await supabase.from("certification_requests").update({
          status: "rejected",
          rejection_reason: "Certification faible : followers majoritairement inactifs.",
          analyzed_at: new Date().toISOString(),
        }).eq("id", request.id);

        await supabase.from("notifications").insert({
          user_id: request.user_id,
          type: "certification_rejected",
          title: "Certification refusée",
          body: "Certification faible : followers majoritairement inactifs.",
        });
      } else {
        // Approve
        await supabase.from("certification_requests").update({
          status: "approved",
          analyzed_at: new Date().toISOString(),
        }).eq("id", request.id);

        // Set certification on profile
        await supabase.from("profiles").update({
          certification_type: request.cert_type,
        }).eq("user_id", request.user_id);

        await supabase.from("notifications").insert({
          user_id: request.user_id,
          type: "certification_approved",
          title: "Certification approuvée ! 🎉",
          body: `Félicitations ! Votre badge "${request.cert_type}" est maintenant actif.`,
        });
      }
      processed++;
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
