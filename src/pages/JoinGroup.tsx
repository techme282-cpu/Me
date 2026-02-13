import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, LogIn } from "lucide-react";

export default function JoinGroup() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (inviteCode) fetchGroup();
  }, [inviteCode]);

  const fetchGroup = async () => {
    const { data } = await supabase.from("groups").select("*").eq("invite_code", inviteCode!).eq("status", "active").single();
    if (!data) { setLoading(false); return; }
    setGroup(data);
    const { count } = await supabase.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", data.id).eq("status", "active");
    setMemberCount(count || 0);
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!user) { navigate("/login"); return; }
    if (!group) return;
    setJoining(true);

    // Check if already a member
    const { data: existing } = await supabase.from("group_members").select("id").eq("group_id", group.id).eq("user_id", user.id).single();
    if (existing) {
      navigate(`/group/${group.id}`);
      return;
    }

    const status = group.require_approval ? "pending" : "active";
    await supabase.from("group_members").insert({ group_id: group.id, user_id: user.id, role: "member", status });

    if (status === "pending") {
      toast.info("Demande envoyée ! En attente d'approbation.");
      navigate("/chat");
    } else {
      toast.success("Tu as rejoint le groupe !");
      navigate(`/group/${group.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Users size={48} className="mx-auto text-muted-foreground" />
          <h2 className="text-lg font-bold text-foreground">Lien invalide</h2>
          <p className="text-sm text-muted-foreground">Ce lien d'invitation n'existe plus ou est expiré.</p>
          <button onClick={() => navigate("/")} className="gradient-primary text-primary-foreground px-6 py-2 rounded-full text-sm font-medium">
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 space-y-6 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-2xl">
          {group.name?.[0]?.toUpperCase() || "G"}
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{group.name}</h2>
          {group.description && <p className="text-sm text-muted-foreground mt-1">{group.description}</p>}
          <p className="text-xs text-muted-foreground mt-2">{memberCount} membre{memberCount > 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full gradient-primary text-primary-foreground py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <LogIn size={18} />
          {joining ? "..." : group.require_approval ? "Demander à rejoindre" : "Rejoindre le groupe"}
        </button>
      </div>
    </div>
  );
}
