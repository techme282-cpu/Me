import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, Users, Shield, Crown, UserMinus, UserPlus,
  LogOut, Trash2, Edit2, Check, X, Search
} from "lucide-react";

export default function GroupSettings() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Add member
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const myMembership = members.find((m) => m.user_id === user?.id);
  const isOwner = myMembership?.role === "owner";
  const isAdmin = myMembership?.role === "admin" || isOwner;

  useEffect(() => {
    if (groupId) {
      fetchGroup();
      fetchMembers();
    }
  }, [groupId]);

  const fetchGroup = async () => {
    const { data } = await supabase.from("groups").select("*").eq("id", groupId!).single();
    if (data) {
      setGroup(data);
      setName(data.name);
      setDescription(data.description || "");
    }
  };

  const fetchMembers = async () => {
    const { data } = await supabase.from("group_members").select("*").eq("group_id", groupId!);
    setMembers(data || []);
    if (data?.length) {
      const userIds = data.map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const map: Record<string, any> = {};
      (profs || []).forEach((p) => (map[p.user_id] = p));
      setProfiles(map);
    }
  };

  const saveGroupInfo = async () => {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    await supabase.from("groups").update({ name: name.trim(), description: description.trim() }).eq("id", groupId!);
    toast.success("Groupe mis à jour");
    setEditing(false);
    fetchGroup();
  };

  const promoteToAdmin = async (userId: string) => {
    await supabase.from("group_members").update({ role: "admin" }).eq("group_id", groupId!).eq("user_id", userId);
    toast.success("Promu admin");
    fetchMembers();
  };

  const demoteToMember = async (userId: string) => {
    const target = members.find((m) => m.user_id === userId);
    if (target?.role === "owner") { toast.error("Impossible de rétrograder le créateur"); return; }
    await supabase.from("group_members").update({ role: "member" }).eq("group_id", groupId!).eq("user_id", userId);
    toast.success("Rétrogradé en membre");
    fetchMembers();
  };

  const removeMember = async (userId: string) => {
    const target = members.find((m) => m.user_id === userId);
    if (target?.role === "owner") { toast.error("Impossible de retirer le créateur"); return; }
    await supabase.from("group_members").delete().eq("group_id", groupId!).eq("user_id", userId);
    toast.success("Membre retiré");
    fetchMembers();
  };

  const leaveGroup = async () => {
    if (!user) return;
    if (isOwner) {
      // Transfer ownership to another admin or first member
      const nextOwner = members.find((m) => m.user_id !== user.id && m.role === "admin")
        || members.find((m) => m.user_id !== user.id);
      if (nextOwner) {
        await supabase.from("group_members").update({ role: "owner" }).eq("id", nextOwner.id);
      }
    }
    await supabase.from("group_members").delete().eq("group_id", groupId!).eq("user_id", user.id);
    toast.success("Tu as quitté le groupe");
    navigate("/chat");
  };

  const deleteGroup = async () => {
    await supabase.from("groups").delete().eq("id", groupId!);
    toast.success("Groupe supprimé");
    navigate("/chat");
  };

  // Search users to add
  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", `%${q}%`)
      .limit(10);
    const memberIds = members.map((m) => m.user_id);
    setSearchResults((data || []).filter((p) => !memberIds.includes(p.user_id)));
  };

  const addMember = async (userId: string) => {
    await supabase.from("group_members").insert({ group_id: groupId!, user_id: userId, role: "member" });
    toast.success("Membre ajouté");
    setSearchResults((prev) => prev.filter((p) => p.user_id !== userId));
    fetchMembers();
  };

  const roleLabel = (role: string) => {
    if (role === "owner") return "Créateur";
    if (role === "admin") return "Admin";
    return "Membre";
  };

  const roleIcon = (role: string) => {
    if (role === "owner") return <Crown size={14} className="text-yellow-500" />;
    if (role === "admin") return <Shield size={14} className="text-primary" />;
    return null;
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate(`/group/${groupId}`)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <h2 className="font-display font-bold text-foreground">Paramètres du groupe</h2>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Group Info */}
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-2xl">
              {group?.name?.[0]?.toUpperCase() || "G"}
            </div>
          </div>

          {editing ? (
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Nom du groupe"
                maxLength={50}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                placeholder="Description (optionnel)"
                rows={3}
                maxLength={200}
              />
              <div className="flex gap-2">
                <button onClick={saveGroupInfo} className="flex-1 gradient-primary text-primary-foreground py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1">
                  <Check size={16} /> Sauvegarder
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-secondary rounded-xl text-sm text-muted-foreground">
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-foreground">{group?.name}</h3>
              {group?.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
              <p className="text-xs text-muted-foreground">{group?.is_open ? "Groupe ouvert" : "Groupe fermé"} · {members.length} membre{members.length > 1 ? "s" : ""}</p>
              {isAdmin && (
                <button onClick={() => setEditing(true)} className="text-primary text-xs font-medium flex items-center gap-1 mx-auto mt-2">
                  <Edit2 size={12} /> Modifier
                </button>
              )}
            </div>
          )}
        </div>

        {/* Add Member */}
        {isAdmin && (
          <div className="space-y-2">
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-2xl text-primary font-medium text-sm"
            >
              <UserPlus size={18} /> Ajouter un membre
            </button>
            {showAddMember && (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(e) => searchUsers(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    placeholder="Rechercher par username..."
                  />
                </div>
                {searchResults.map((p) => (
                  <div key={p.user_id} className="flex items-center gap-3 px-3 py-2 bg-card rounded-xl border border-border">
                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                      {p.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.display_name || p.username}</p>
                      <p className="text-xs text-muted-foreground">@{p.username}</p>
                    </div>
                    <button onClick={() => addMember(p.user_id)} className="gradient-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                      Ajouter
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Members List */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
            <Users size={14} /> Membres ({members.length})
          </h3>
          <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
            {members
              .sort((a, b) => {
                const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
                return (order[a.role] ?? 2) - (order[b.role] ?? 2);
              })
              .map((m) => {
                const prof = profiles[m.user_id];
                const isMe = m.user_id === user?.id;
                const canManage = isAdmin && !isMe && m.role !== "owner";
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm cursor-pointer"
                      onClick={() => !isMe && navigate(`/user/${m.user_id}`)}
                    >
                      {prof?.username?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{prof?.display_name || prof?.username || "?"}</p>
                        {roleIcon(m.role)}
                      </div>
                      <p className="text-xs text-muted-foreground">{roleLabel(m.role)}{isMe ? " · Toi" : ""}</p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        {m.role === "member" ? (
                          <button onClick={() => promoteToAdmin(m.user_id)} className="p-1.5 rounded-lg bg-primary/10 text-primary" title="Promouvoir admin">
                            <Shield size={14} />
                          </button>
                        ) : (
                          <button onClick={() => demoteToMember(m.user_id)} className="p-1.5 rounded-lg bg-muted text-muted-foreground" title="Rétrograder">
                            <Shield size={14} />
                          </button>
                        )}
                        <button onClick={() => removeMember(m.user_id)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive" title="Retirer">
                          <UserMinus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={leaveGroup}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-destructive/10 border border-destructive/20 rounded-2xl hover:bg-destructive/20 transition-colors"
          >
            <LogOut size={20} className="text-destructive" />
            <span className="text-sm font-semibold text-destructive">Quitter le groupe</span>
          </button>

          {isOwner && (
            <button
              onClick={deleteGroup}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-destructive/10 border border-destructive/20 rounded-2xl hover:bg-destructive/20 transition-colors"
            >
              <Trash2 size={20} className="text-destructive" />
              <span className="text-sm font-semibold text-destructive">Supprimer le groupe</span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
