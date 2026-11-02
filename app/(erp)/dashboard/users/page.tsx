"use client";

import { CheckCircle2, MailPlus, Plus, RefreshCw, ShieldCheck, UserRound, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components/primitives/button";
import { Notification, type NotificationVariant } from "../../../../components/primitives/notification";
import { SelectField } from "../../../../components/primitives/primitives";
import { createSupabaseBrowserClient } from "../../../../lib/supabase/browser";
import { isSupabaseConfigured } from "../../../../lib/supabase/config";
import styles from "./users.module.css";

type MemberRole = "owner" | "manager" | "staff";
type MemberStatus = "active" | "deactivated";
type ManagedRole = Exclude<MemberRole, "owner">;
type PermissionValue = { can_view?: boolean; can_edit?: boolean };
type PermissionMap = Record<string, PermissionValue>;
type PermissionDefinition = { permission_key: string; label: string; description: string };
type WorkspaceMember = {
  user_id: string;
  email: string;
  member_name: string;
  contact_number: string;
  role: MemberRole;
  status: MemberStatus;
  permissions: PermissionMap;
};
type Invitation = {
  invitation_id: string;
  email: string;
  member_name: string;
  contact_number: string;
  role: ManagedRole;
  status: "pending" | "accepted" | "expired" | "revoked";
  permission_snapshot: PermissionMap;
  expires_at: string;
};
type Notice = { message: string; variant: NotificationVariant } | null;
type EditorState = { userId: string; role: ManagedRole; status: MemberStatus; permissions: PermissionMap };

function cleanError(message: string) {
  return message.replace(/^.*?ERROR:\s*/i, "").trim() || "The request could not be completed.";
}

function permissionMap(catalog: PermissionDefinition[], source?: PermissionMap): PermissionMap {
  return Object.fromEntries(catalog.map((permission) => [
    permission.permission_key,
    {
      can_view: Boolean(source?.[permission.permission_key]?.can_view),
      can_edit: Boolean(source?.[permission.permission_key]?.can_edit),
    },
  ]));
}

function countAccess(permissions: PermissionMap) {
  return Object.values(permissions).filter((permission) => permission.can_view || permission.can_edit).length;
}

function togglePermission(current: PermissionMap, key: string, field: "can_view" | "can_edit", checked: boolean): PermissionMap {
  const previous = current[key] || {};
  return {
    ...current,
    [key]: {
      can_view: field === "can_view" ? checked : Boolean(previous.can_view) || checked,
      can_edit: field === "can_view" && !checked ? false : field === "can_edit" ? checked : Boolean(previous.can_edit),
    },
  };
}

export default function UsersPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [catalog, setCatalog] = useState<PermissionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState<ManagedRole>("staff");
  const [invitePermissions, setInvitePermissions] = useState<PermissionMap>({});
  const [editor, setEditor] = useState<EditorState | null>(null);

  const owner = useMemo(() => members.find((member) => member.role === "owner"), [members]);
  const pendingInvitations = useMemo(() => invitations.filter((invitation) => invitation.status === "pending"), [invitations]);

  const loadAccess = async () => {
    const supabase = createSupabaseBrowserClient();
    const storedWorkspaceId = window.localStorage.getItem("solexa-workspace-id");
    setWorkspaceId(storedWorkspaceId);
    if (!isSupabaseConfigured() || !supabase || !storedWorkspaceId) {
      setLoading(false);
      setNotice({ variant: "error", message: "A secure Supabase workspace is required." });
      return;
    }

    const [memberResult, invitationResult, catalogResult] = await Promise.all([
      supabase.rpc("list_workspace_access_with_profile", { target_workspace_id: storedWorkspaceId }),
      supabase.rpc("list_workspace_invitations_with_profile", { target_workspace_id: storedWorkspaceId }),
      supabase.from("permission_catalog").select("permission_key,label,description").order("sort_order"),
    ]);
    const firstError = memberResult.error || invitationResult.error || catalogResult.error;
    if (firstError) {
      setLoading(false);
      setNotice({ variant: "error", message: cleanError(firstError.message) });
      return;
    }
    const nextCatalog = (catalogResult.data ?? []) as PermissionDefinition[];
    setCatalog(nextCatalog);
    setMembers((memberResult.data ?? []) as WorkspaceMember[]);
    setInvitations((invitationResult.data ?? []) as Invitation[]);
    setInvitePermissions((current) => permissionMap(nextCatalog, current));
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAccess(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const resetInvite = () => {
    setName("");
    setEmail("");
    setContact("");
    setRole("staff");
    setInvitePermissions(permissionMap(catalog));
  };

  const sendInvitation = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const response = await fetch("/api/workspace/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, name: name.trim(), email: email.trim(), contact: contact.trim(), role, permissions: invitePermissions }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "The invitation could not be sent.");
      setInviteOpen(false);
      resetInvite();
      setNotice({ variant: "success", message: result.message || "Invitation email sent securely." });
      await loadAccess();
    } catch (error) {
      setNotice({ variant: "error", message: error instanceof Error ? error.message : "The invitation could not be sent." });
    } finally {
      setSaving(false);
    }
  };

  const saveMemberAccess = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !workspaceId || !editor) return;
    setSaving(true);
    const { error } = await supabase.rpc("update_workspace_member_access", {
      target_workspace_id: workspaceId,
      member_user_id: editor.userId,
      new_role: editor.role,
      new_designation_id: null,
      new_status: editor.status,
      new_permissions: editor.permissions,
    });
    setSaving(false);
    if (error) {
      setNotice({ variant: "error", message: cleanError(error.message) });
      return;
    }
    setEditor(null);
    setNotice({ variant: "success", message: "Member access updated securely." });
    await loadAccess();
  };

  const revokeInvitation = async (invitation: Invitation) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !window.confirm(`Revoke the invitation for ${invitation.email}?`)) return;
    setSaving(true);
    const { error } = await supabase.rpc("revoke_workspace_invitation", { target_invitation_id: invitation.invitation_id });
    setSaving(false);
    if (error) {
      setNotice({ variant: "error", message: cleanError(error.message) });
      return;
    }
    setNotice({ variant: "success", message: "Invitation revoked securely." });
    await loadAccess();
  };

  if (loading) return <div className="erp-content"><div className="erp-page-heading"><div><p className="erp-eyebrow">Workspace access</p><h1 className="erp-page-title">Users & permissions</h1><p className="erp-page-subtitle">Checking owner authorization…</p></div></div><section className={`erp-card ${styles.loadingCard}`} aria-live="polite">Loading secure access controls…</section></div>;

  return <div className="erp-content">
    <div className="erp-page-heading">
      <div><p className="erp-eyebrow">Workspace access</p><h1 className="erp-page-title">Users & permissions</h1><p className="erp-page-subtitle">Invite team members and control each feature from one owner-only workspace.</p></div>
      <div className={styles.securityBadge}><ShieldCheck size={15} /><span>MFA protected</span></div>
    </div>

    <section className={styles.summaryGrid} aria-label="Workspace access summary">
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><UsersRound size={16} /></span><div><p>Active members</p><strong>{members.filter((member) => member.status === "active").length}</strong></div></div>
      <div className={styles.summaryCard}><span className={`${styles.summaryIcon} ${styles.managerIcon}`}><MailPlus size={16} /></span><div><p>Pending invites</p><strong>{pendingInvitations.length}</strong></div></div>
      <div className={styles.summaryCard}><span className={`${styles.summaryIcon} ${styles.staffIcon}`}><ShieldCheck size={16} /></span><div><p>Available features</p><strong>{catalog.length}</strong></div></div>
    </section>

    <section className={`erp-card ${styles.managementCard}`}>
      <div className={styles.cardHeading}><div><h2>Workspace members</h2><p>Only the owner can invite, edit, or deactivate members.</p></div>{owner && <span className={styles.ownerPill}>Owner protected</span>}</div>
      <div className={styles.tableWrap}><table className={styles.accessTable}><thead><tr><th>Member</th><th>Contact</th><th>Role</th><th>Status</th><th>Access</th><th /></tr></thead><tbody>
        {members.map((member) => <tr key={member.user_id}>
          <td><div className={styles.memberIdentity}><span className={styles.memberAvatar}><UserRound size={16} /></span><div><strong>{member.member_name || member.email || "Workspace owner"}</strong><span>{member.email || "No email available"}</span></div></div></td>
          <td>{member.contact_number || "—"}</td>
          <td><span className={`${styles.rolePill} ${member.role === "owner" ? styles.ownerRole : ""}`}>{member.role}</span></td>
          <td><span className={`${styles.statusPill} ${member.status === "active" ? styles.activeStatus : styles.inactiveStatus}`}>{member.status}</span></td>
          <td>{member.role === "owner" ? "All features" : `${countAccess(member.permissions)} feature${countAccess(member.permissions) === 1 ? "" : "s"}`}</td>
          <td>{member.role !== "owner" && <button type="button" className={styles.textButton} disabled={saving} onClick={() => setEditor({ userId: member.user_id, role: member.role as ManagedRole, status: member.status, permissions: permissionMap(catalog, member.permissions) })}>Manage</button>}</td>
        </tr>)}
      </tbody></table></div>
    </section>

    <button type="button" className={styles.addMemberCard} onClick={() => setInviteOpen(true)}>
      <span className={styles.addMemberIcon}><Plus size={22} /></span><span><strong>Add team member</strong><small>Invite by email and set feature access</small></span><MailPlus size={20} />
    </button>

    {pendingInvitations.length > 0 && <section className={`erp-card ${styles.managementCard}`}><div className={styles.cardHeading}><div><h2>Pending invitations</h2><p>Invitations expire automatically after seven days.</p></div></div><div className={styles.invitationList}>{pendingInvitations.map((invitation) => <div className={styles.invitationRow} key={invitation.invitation_id}><div><strong>{invitation.member_name || invitation.email}</strong><span>{invitation.email} · {invitation.role} · {countAccess(invitation.permission_snapshot)} features</span></div><button type="button" className={styles.textButton} disabled={saving} onClick={() => void revokeInvitation(invitation)}>Revoke</button></div>)}</div></section>}

    {inviteOpen && <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="invite-member-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteOpen(false); }}><div className={styles.modalCard}><div className={styles.modalHeading}><div><p className="erp-eyebrow">Owner control</p><h2 id="invite-member-title">Add team member</h2><p>They will receive a secure Supabase invitation email. Access starts only after they accept and complete Microsoft Authenticator MFA.</p></div><button type="button" className={styles.closeButton} onClick={() => setInviteOpen(false)} aria-label="Close invite dialog"><X size={18} /></button></div><div className={styles.formGrid}><label className={styles.inputLabel}><span>Full name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ali Asgher" autoComplete="name" maxLength={120} /></label><label className={styles.inputLabel}><span>Work email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="team.member@company.com" autoComplete="email" maxLength={320} /></label><label className={styles.inputLabel}><span>Contact number</span><input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="0300 1234567" autoComplete="tel" maxLength={32} /></label><SelectField label="Role" value={role} onChange={(event) => setRole(event.target.value as ManagedRole)}><option value="staff">Staff</option><option value="manager">Manager</option></SelectField></div><PermissionMatrix catalog={catalog} value={invitePermissions} onChange={setInvitePermissions} /><div className={styles.formActions}><Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button><Button variant="brand" loading={saving} onClick={() => void sendInvitation()}><MailPlus size={15} />Send invitation</Button></div></div></div>}

    {editor && <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="member-access-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}><div className={styles.modalCard}><div className={styles.modalHeading}><div><p className="erp-eyebrow">Owner control</p><h2 id="member-access-title">Manage member access</h2><p>Changes are audited and take effect immediately after saving.</p></div><button type="button" className={styles.closeButton} onClick={() => setEditor(null)} aria-label="Close access dialog"><X size={18} /></button></div><div className={styles.editorGrid}><SelectField label="Role" value={editor.role} onChange={(event) => setEditor({ ...editor, role: event.target.value as ManagedRole })}><option value="staff">Staff</option><option value="manager">Manager</option></SelectField><SelectField label="Account status" value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value as MemberStatus })}><option value="active">Active</option><option value="deactivated">Deactivated</option></SelectField></div><PermissionMatrix catalog={catalog} value={editor.permissions} onChange={(permissions) => setEditor({ ...editor, permissions })} /><div className={styles.formActions}><Button variant="secondary" onClick={() => setEditor(null)}>Cancel</Button><Button variant="brand" loading={saving} onClick={() => void saveMemberAccess()}><CheckCircle2 size={15} />Save access</Button></div></div></div>}

  <div className={styles.protectionNote}><CheckCircle2 size={15} /><button type="button" className={styles.refreshButton} onClick={() => void loadAccess()} aria-label="Refresh access data"><RefreshCw size={14} /></button></div>
    <Notification message={notice?.message} variant={notice?.variant ?? "success"} onDismiss={() => setNotice(null)} />
  </div>;
}

function PermissionMatrix({ catalog, value, onChange }: { catalog: PermissionDefinition[]; value: PermissionMap; onChange: (value: PermissionMap) => void }) {
  const allViewed = catalog.length > 0 && catalog.every((permission) => Boolean(value[permission.permission_key]?.can_view));
  const setAllViewed = (checked: boolean) => onChange(permissionMap(catalog, checked
    ? Object.fromEntries(catalog.map((permission) => [permission.permission_key, { can_view: true, can_edit: false }]))
    : {}));

  return <div className={styles.permissionBox}><div className={styles.permissionHeader}><div><strong>Feature permissions</strong><span>Choose none, view only, or view plus edit for each feature.</span></div><div className={styles.permissionTools}><button type="button" className={styles.selectAllButton} onClick={() => setAllViewed(!allViewed)} disabled={catalog.length === 0}>{allViewed ? "Clear all" : "Select all"}</button><div className={styles.permissionLegend}><span>View</span><span>Edit</span></div></div></div><div className={styles.permissionList}>{catalog.map((permission) => { const current = value[permission.permission_key] || {}; const accessLabel = current.can_edit ? "Edit" : current.can_view ? "View" : "None"; return <div className={styles.permissionRow} key={permission.permission_key}><div><strong>{permission.label}</strong><span>{permission.description} · {accessLabel}</span></div><label className={styles.checkLabel}><input type="checkbox" checked={Boolean(current.can_view)} onChange={(event) => onChange(togglePermission(value, permission.permission_key, "can_view", event.target.checked))} /><span>View</span></label><label className={styles.checkLabel}><input type="checkbox" checked={Boolean(current.can_edit)} disabled={!current.can_view} onChange={(event) => onChange(togglePermission(value, permission.permission_key, "can_edit", event.target.checked))} /><span>Edit</span></label></div>; })}</div></div>;
}
