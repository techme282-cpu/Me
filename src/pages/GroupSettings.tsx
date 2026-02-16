import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, Users, Shield, Crown, UserMinus, UserPlus,
  LogOut, Trash2, Edit2, Check, X, Search, Link2, Copy,
  MoreVertical, MessageCircle, Lock, Unlock, Camera
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

  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showPermissions, setShowPermissions] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [memberMenu, setMemberMenu] = useState<string | null>(null);
  const [bannedIds, setBannedIds] = useState<Set<string>>(new Set());
  const avatarRef = useRef<HTMLInputElement>(null);

  const myMembership = members.find((m) => m.user_id === user?.id);
  const isOwner = myMembership?.role === "owner";
  const isAdmin = myMembership?.role === "admin" || isOwner;

  useEffect(() => {
    if (groupId) {
      fetchGroup();
      fetchMembers();
      fetchBanned();
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
    const active = (data || []).filter((m: any) => m.status !== "pending");
    const pending = (data || []).filter((m: any) => m.status === "pending");
    setMembers(active);
    setPendingMembers(pending);
    if (data?.length) {
      const userIds = data.map((m: any) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => (map[p.user_id] = p));
      setProfiles(map);
    }
  };

  const fetchBanned = async () => {
    const { data } = await supabase.from("banned_group_members").select("user_id").eq("group_id", groupId!);
    setBannedIds(new Set((data || []).map((b: any) => b.user_id)));
  };

  const saveGroupInfo = async () => {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    await supabase.from("groups").update({ name: name.trim(), description: description.trim() }).eq("id", groupId!);
    toast.success("Groupe mis à jour");
    setEditing(false);
    fetchGroup();
  };

  const canEdit = isAdmin || !group?.admin_only_edit;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !groupId) return;
    if (!file.type.startsWith("image/")) { toast.error("Image uniquement"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/group_${groupId}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) { toast.error("Erreur upload"); return; }
    const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
    await supabase.from("groups").update({ avatar_url: urlData.publicUrl }).eq("id", groupId);
    setGroup((g: any) => ({ ...g, avatar_url: urlData.publicUrl }));
    toast.success("Photo du groupe mise à jour");
  };

  const toggleAdminOnlyEdit = async () => {
    const newVal = !group.admin_only_edit;
    await supabase.from("groups").update({ admin_only_edit: newVal }).eq("id", groupId!);
    setGroup((g: any) => ({ ...g, admin_only_edit: newVal }));
    toast.success(newVal ? "Seuls les admins peuvent modifier" : "Tous peuvent modifier");
  };

  const toggleIsOpen = async () => {
    const newVal = !group.is_open;
    await supabase.from("groups").update({ is_open: newVal }).eq("id", groupId!);
    setGroup((g: any) => ({ ...g, is_open: newVal }));
    toast.success(newVal ? "Tout le monde peut envoyer des messages" : "Seuls les admins peuvent envoyer");
  };

  const toggleRequireApproval = async () => {
    const newVal = !group.require_approval;
    await supabase.from("groups").update({ require_approval: newVal }).eq("id", groupId!);
    setGroup((g: any) => ({ ...g, require_approval: newVal }));
    toast.success(newVal ? "Approbation requise" : "Approbation désactivée");
  };

  const generateInviteLink = async () => {
    const code = Math.random().toString(36).substring(2, 10);
    await supabase.from("groups").update({ invite_code: code }).eq("id", groupId!);
    setGroup((g: any) => ({ ...g, invite_code: code }));
    toast.success("Lien d'invitation généré");
  };

  const copyInviteLink = () => {
    if (!group?.invite_code) return;
    const link = `${window.location.origin}/group/join/${group.invite_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Lien copié !");
  };

  const approveMember = async (memberId: string) => {
    await supabase.from("group_members").update({ status: "active" }).eq("id", memberId);
    toast.success("Membre approuvé");
    fetchMembers();
  };

  const rejectMember = async (memberId: string) => {
    await supabase.from("group_members").delete().eq("id", memberId);
    toast.success("Demande rejetée");
    fetchMembers();
  };

  // Send system message to group
  const sendSystemMessage = async (content: string) => {
    if (!groupId || !user) return;
    await supabase.from("messages").insert({
      sender_id: user.id,
      group_id: groupId,
      content: `[SYSTEM] ${content}`,
    });
  };

  const promoteToAdmin = async (userId: string) => {
    const prof = profiles[userId];
    await supabase.from("group_members").update({ role: "admin" }).eq("group_id", groupId!).eq("user_id", userId);
    toast.success("Promu admin");
    // Send system message
    const displayName = prof?.display_name || prof?.username || "Utilisateur";
    await sendSystemMessage(`🛡️ ${displayName} est désormais admin`);
    setMemberMenu(null);
    fetchMembers();
  };

  const demoteToMember = async (userId: string) => {
    const target = members.find((m: any) => m.user_id === userId);
    if (target?.role === "owner") { toast.error("Impossible"); return; }
    const prof = profiles[userId];
    await supabase.from("group_members").update({ role: "member" }).eq("group_id", groupId!).eq("user_id", userId);
    toast.success("Rétrogradé");
    const displayName = prof?.display_name || prof?.username || "Utilisateur";
    await sendSystemMessage(`${displayName} n'est plus admin`);
    setMemberMenu(null);
    fetchMembers();
  };

  const removeMember = async (userId: string, ban: boolean = false) => {
    const target = members.find((m: any) => m.user_id === userId);
    if (target?.role === "owner") { toast.error("Impossible"); return; }
    await supabase.from("group_members").delete().eq("group_id", groupId!).eq("user_id", userId);
    if (ban && user) {
      await supabase.from("banned_group_members").insert({ group_id: groupId!, user_id: userId, banned_by: user.id });
      setBannedIds((prev) => new Set([...prev, userId]));
      toast.success("Membre banni du groupe");
    } else {
      toast.success("Membre retiré");
    }
    setMemberMenu(null);
    fetchMembers();
  };

  const leaveGroup = async () => {
    if (!user) return;
    if (isOwner) {
      const nextOwner = members.find((m: any) => m.user_id !== user.id && m.role === "admin")
        || members.find((m: any) => m.user_id !== user.id);
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

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from("profiles").select("*").ilike("username", `%${q}%`).limit(10);
    const memberIds = members.map((m: any) => m.user_id);
    setSearchResults((data || []).filter((p: any) => !memberIds.includes(p.user_id) && !bannedIds.has(p.user_id)));
  };

  const addMember = async (targetUserId: string) => {
    if (bannedIds.has(targetUserId)) { toast.error("Cet utilisateur est banni de ce groupe"); return; }
    await supabase.from("group_members").insert({ group_id: groupId!, user_id: targetUserId, role: "member", status: "active" });
    toast.success("Membre ajouté");
    // Send system message about who added them
    const adderProfile = user ? profiles[user.id] : null;
    const addedProfile = searchResults.find((p: any) => p.user_id === targetUserId);
    const adderName = adderProfile?.display_name || adderProfile?.username || "Un admin";
    const addedName = addedProfile?.display_name || addedProfile?.username || "Utilisateur";
    await sendSystemMessage(`${adderName} a ajouté ${addedName} au groupe`);
    setSearchResults((prev) => prev.filter((p: any) => p.user_id !== targetUserId));
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
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold text-2xl overflow-hidden">
                {group?.avatar_url ? (
                  <img src={group.avatar_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  group?.name?.[0]?.toUpperCase() || "G"
                )}
              </div>
              {canEdit && (
                <button
                  onClick={() => avatarRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-primary-foreground"
                >
                  <Camera size={14} />
                </button>
              )}
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>

          {editing && canEdit ? (
            <div className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Nom du groupe" maxLength={50} />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                placeholder="Description (optionnel)" rows={3} maxLength={200} />
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
              <p className="text-xs text-muted-foreground">
                {group?.is_open ? "Tout le monde peut écrire" : "Admins uniquement"} · {members.length} membre{members.length > 1 ? "s" : ""}
              </p>
              {canEdit && (
                <button onClick={() => setEditing(true)} className="text-primary text-xs font-medium flex items-center gap-1 mx-auto mt-2">
                  <Edit2 size={12} /> Modifier
                </button>
              )}
            </div>
          )}
        </div>

        {/* Permissions (Admin only) */}
        {isAdmin && (
          <div className="space-y-2">
            <button onClick={() => setShowPermissions(!showPermissions)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-2xl text-foreground font-medium text-sm">
              <Shield size={18} className="text-primary" />
              <span className="flex-1 text-left">Autorisations du groupe</span>
              <span className="text-xs text-muted-foreground">{showPermissions ? "▲" : "▼"}</span>
            </button>

            {showPermissions && (
              <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
                <button onClick={toggleAdminOnlyEdit} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
                  <Lock size={18} className="text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Modifier nom, description & icône</p>
                    <p className="text-xs text-muted-foreground">
                      {group?.admin_only_edit ? "Admins uniquement" : "Tous les membres"}
                    </p>
                  </div>
                  <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${group?.admin_only_edit ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-5 h-5 rounded-full bg-foreground transition-transform ${group?.admin_only_edit ? "translate-x-4" : ""}`} />
                  </div>
                </button>

                <button onClick={toggleIsOpen} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
                  <MessageCircle size={18} className="text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Envoyer des messages</p>
                    <p className="text-xs text-muted-foreground">
                      {group?.is_open ? "Tout le monde" : "Admins uniquement"}
                    </p>
                  </div>
                  <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${group?.is_open ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-5 h-5 rounded-full bg-foreground transition-transform ${group?.is_open ? "translate-x-4" : ""}`} />
                  </div>
                </button>

                <button onClick={toggleRequireApproval} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
                  <Unlock size={18} className="text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Approbation de l'admin</p>
                    <p className="text-xs text-muted-foreground">
                      {group?.require_approval ? "Activée — les nouveaux doivent être approuvés" : "Désactivée — accès libre"}
                    </p>
                  </div>
                  <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${group?.require_approval ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-5 h-5 rounded-full bg-foreground transition-transform ${group?.require_approval ? "translate-x-4" : ""}`} />
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Invite Link */}
        {isAdmin && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
              <Link2 size={14} /> Lien d'invitation
            </h3>
            <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
              {group?.invite_code ? (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-xs text-muted-foreground truncate font-mono">
                    {window.location.origin}/group/join/{group.invite_code}
                  </p>
                  <button onClick={copyInviteLink} className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Copy size={16} />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun lien d'invitation</p>
              )}
              <button onClick={generateInviteLink} className="w-full gradient-primary text-primary-foreground py-2 rounded-xl text-sm font-medium">
                {group?.invite_code ? "Régénérer le lien" : "Générer un lien"}
              </button>
            </div>
          </div>
        )}

        {/* Pending approvals */}
        {isAdmin && pendingMembers.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              En attente ({pendingMembers.length})
            </h3>
            <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
              {pendingMembers.map((m: any) => {
                const prof = profiles[m.user_id];
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {prof?.username?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{prof?.display_name || prof?.username}</p>
                      <p className="text-xs text-muted-foreground">@{prof?.username}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => approveMember(m.id)} className="p-1.5 rounded-lg bg-primary/10 text-primary" title="Accepter">
                        <Check size={14} />
                      </button>
                      <button onClick={() => rejectMember(m.id)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive" title="Refuser">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add Member */}
        {isAdmin && (
          <div className="space-y-2">
            <button onClick={() => setShowAddMember(!showAddMember)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-2xl text-primary font-medium text-sm">
              <UserPlus size={18} /> Ajouter un membre
            </button>
            {showAddMember && (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={searchQuery} onChange={(e) => searchUsers(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    placeholder="Rechercher par username..." />
                </div>
                {searchResults.map((p: any) => (
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
              .sort((a: any, b: any) => {
                const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
                return (order[a.role] ?? 2) - (order[b.role] ?? 2);
              })
              .map((m: any) => {
                const prof = profiles[m.user_id];
                const isMe = m.user_id === user?.id;
                const canManage = isAdmin && !isMe && m.role !== "owner";
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3 relative">
                    <div
                      className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm cursor-pointer overflow-hidden"
                      onClick={() => !isMe && navigate(`/user/${m.user_id}`)}
                    >
                      {prof?.avatar_url ? (
                        <img src={prof.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                      ) : (
                        prof?.username?.[0]?.toUpperCase() || "?"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{prof?.display_name || prof?.username || "?"}</p>
                        {roleIcon(m.role)}
                      </div>
                      <p className="text-xs text-muted-foreground">{roleLabel(m.role)}{isMe ? " · Toi" : ""}</p>
                    </div>
                    {canManage && (
                      <div className="relative">
                        <button onClick={() => setMemberMenu(memberMenu === m.id ? null : m.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                          <MoreVertical size={16} />
                        </button>
                        {memberMenu === m.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMemberMenu(null)} />
                            <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-xl shadow-lg py-1 w-48">
                              {m.role === "member" ? (
                                <button onClick={() => promoteToAdmin(m.user_id)} className="w-full px-4 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 text-foreground">
                                  <Shield size={14} /> Nommer admin
                                </button>
                              ) : (
                                <button onClick={() => demoteToMember(m.user_id)} className="w-full px-4 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 text-foreground">
                                  <Shield size={14} /> Rétrograder
                                </button>
                              )}
                              <button onClick={() => removeMember(m.user_id, true)} className="w-full px-4 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2 text-destructive">
                                <UserMinus size={14} /> Supprimer (bannir)
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button onClick={leaveGroup}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-destructive/10 border border-destructive/20 rounded-2xl hover:bg-destructive/20 transition-colors">
            <LogOut size={20} className="text-destructive" />
            <span className="text-sm font-semibold text-destructive">Quitter le groupe</span>
          </button>

          {isOwner && (
            <button onClick={deleteGroup}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-destructive/10 border border-destructive/20 rounded-2xl hover:bg-destructive/20 transition-colors">
              <Trash2 size={20} className="text-destructive" />
              <span className="text-sm font-semibold text-destructive">Supprimer le groupe</span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
