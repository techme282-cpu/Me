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
    // Find accounts inactive for 2+ days
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    // Get profiles that haven't been seen in 2 days and are not already banned
    const { data: inactiveProfiles, error } = await supabase
      .from("profiles")
      .select("user_id, username, last_seen")
      .eq("is_banned", false)
      .lt("last_seen", cutoff);

    if (error) throw error;
    if (!inactiveProfiles || inactiveProfiles.length === 0) {
      return new Response(JSON.stringify({ banned: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bannedCount = 0;

    for (const profile of inactiveProfiles) {
      // Check if user has any posts
      const { count: postCount } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.user_id);

      // Only ban if truly inactive: no posts AND inactive for 2 days
      if ((postCount || 0) === 0) {
        // Check they're not an admin
        const isAdmin = await supabase.rpc("has_role", {
          _user_id: profile.user_id,
          _role: "admin",
        });

        if (isAdmin.data) continue; // Don't ban admins

        await supabase.from("profiles").update({
          is_banned: true,
          ban_reason: "Compte inactif : aucune activité détectée depuis plus de 2 jours.",
        }).eq("user_id", profile.user_id);

        bannedCount++;
      }
    }

    // Also process account review appeals (24h+ old)
    const reviewCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: pendingReviews } = await supabase
      .from("account_reviews")
      .select("*")
      .eq("status", "pending")
      .lte("submitted_at", reviewCutoff);

    let reviewedCount = 0;

    if (pendingReviews) {
      for (const review of pendingReviews) {
        // Check if user has been active since the review
        const { data: profile } = await supabase
          .from("profiles")
          .select("last_seen")
          .eq("user_id", review.user_id)
          .single();

        if (profile && profile.last_seen && new Date(profile.last_seen) > new Date(review.submitted_at)) {
          // User was active - restore
          await supabase.from("profiles").update({
            is_banned: false,
            ban_reason: null,
          }).eq("user_id", review.user_id);

          await supabase.from("account_reviews").update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
          }).eq("id", review.id);

          await supabase.from("notifications").insert({
            user_id: review.user_id,
            type: "account_restored",
            title: "Compte restauré ✅",
            body: "Votre compte a été restauré après examen.",
          });
        } else {
          // Still inactive - maintain ban
          await supabase.from("account_reviews").update({
            status: "rejected",
            reviewed_at: new Date().toISOString(),
          }).eq("id", review.id);
        }
        reviewedCount++;
      }
    }

    return new Response(JSON.stringify({ banned: bannedCount, reviewed: reviewedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
