"use client";

import { Check, Moon, Pencil, Sun, Store } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../../../components/primitives/button";
import { Field, Modal, SelectField } from "../../../components/primitives/primitives";
import { Notification, type NotificationVariant } from "../../../components/primitives/notification";
import { BUSINESS_PROFILE_STORAGE_KEY, defaultBusinessProfile, type BusinessProfile } from "../../../lib/business-profile";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { isSupabaseConfigured } from "../../../lib/supabase/config";

type ThemeMode = "light" | "dark";
const defaultProfile = defaultBusinessProfile;

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile>(defaultProfile);
  const [draft, setDraft] = useState<BusinessProfile>(defaultProfile);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; variant: NotificationVariant } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedProfile = window.localStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY);
      if (storedProfile) {
        try {
          const next = { ...defaultProfile, ...JSON.parse(storedProfile) } as BusinessProfile;
          setProfile(next);
          setDraft(next);
        } catch {
          window.localStorage.removeItem(BUSINESS_PROFILE_STORAGE_KEY);
        }
      }
      const storedTheme = window.localStorage.getItem("solexa-theme");
      const nextTheme: ThemeMode = storedTheme === "dark" ? "dark" : "light";
      setTheme(nextTheme);
      applyTheme(nextTheme);
      if (isSupabaseConfigured()) {
        void loadRemoteProfile().then((next) => {
          if (!next) return;
          setProfile(next);
          setDraft(next);
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const openEditor = () => { setDraft(profile); setProfileError(null); setEditOpen(true); };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.businessName.trim()) { setProfileError("Business name is required."); return; }
    if (!draft.ownerFirstName.trim() || !draft.ownerSecondName.trim()) { setProfileError("Owner first and second names are required."); return; }
    if (!draft.email.trim() || !/^\S+@\S+\.\S+$/.test(draft.email.trim())) { setProfileError("Enter a valid business email."); return; }
    if (!draft.contactNumber.trim()) { setProfileError("Contact number is required."); return; }
    if (!draft.gender) { setProfileError("Gender is required."); return; }

    const next: BusinessProfile = { ...draft, name: draft.businessName.trim(), businessName: draft.businessName.trim(), ownerFirstName: draft.ownerFirstName.trim(), ownerSecondName: draft.ownerSecondName.trim(), email: draft.email.trim(), contactNumber: draft.contactNumber.trim() };
    setSaving(true);
    setProfileError(null);
    if (isSupabaseConfigured()) {
      const workspaceId = window.localStorage.getItem("solexa-workspace-id");
      const supabase = createSupabaseBrowserClient();
      if (!workspaceId || !supabase) {
        setSaving(false);
        setProfileError("Your workspace session is missing. Please sign in again.");
        return;
      }
      const { error } = await supabase.rpc("update_workspace_profile", {
        target_workspace_id: workspaceId,
        profile_payload: {
          business_name: next.businessName,
          owner_first_name: next.ownerFirstName,
          owner_second_name: next.ownerSecondName,
          owner_email: next.email,
          owner_contact_number: next.contactNumber,
          owner_gender: next.gender,
        },
      });
      if (error) {
        setSaving(false);
        setProfileError(error.message.replace(/^.*?ERROR:\s*/i, "").trim() || "We could not save the business profile.");
        return;
      }
    }
    setSaving(false);
    setProfile(next);
    window.localStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(next));
    setSaved(true);
    setEditOpen(false);
    setNotification({ variant: "success", message: "Business profile saved securely." });
  };

  const toggleTheme = () => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); applyTheme(next); window.localStorage.setItem("solexa-theme", next); };

  return <div className="erp-content"><div className="erp-page-heading"><div><p className="erp-eyebrow">Workspace configuration</p><h1 className="erp-page-title">Settings</h1><p className="erp-page-subtitle">Keep your workspace identity and appearance up to date.</p></div></div><section className="erp-card settings-profile-card settings-minimal-card"><div className="settings-card-heading"><div className="settings-card-icon"><Store size={17} /></div><div><h2 className="erp-card-title">Business profile</h2><p className="erp-card-subtitle">These details are used across your internal workspace.</p></div><Button variant="secondary" className="settings-edit-button" onClick={openEditor}><Pencil size={14} />Edit profile</Button></div><div className="settings-profile-summary settings-profile-summary-clean"><ProfileRow icon={<Store size={15} />} label="Business name" value={profile.businessName || profile.name} /><ProfileRow icon={<span className="settings-row-symbol">◉</span>} label="Owner" value={`${profile.ownerFirstName} ${profile.ownerSecondName}`} /><ProfileRow icon={<span className="settings-row-symbol">@</span>} label="Business email" value={profile.email || "Not set"} /><ProfileRow icon={<span className="settings-row-symbol">#</span>} label="Contact number" value={profile.contactNumber || "Not set"} /><ProfileRow icon={<span className="settings-row-symbol">G</span>} label="Gender" value={profile.gender || "Not set"} /></div><div className="settings-theme-row"><div className="settings-theme-copy"><span className="settings-row-icon">{theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}</span><div><p>Appearance</p><strong>{theme === "dark" ? "Dark mode" : "Light mode"}</strong></div></div><button type="button" className={`settings-theme-toggle ${theme === "dark" ? "is-dark" : ""}`} aria-pressed={theme === "dark"} onClick={toggleTheme}><span>{theme === "dark" ? "Dark" : "Light"}</span><span className="settings-theme-knob" /></button></div>{saved && <p className="settings-success"><Check size={15} />Settings saved to Supabase.</p>}</section><Modal open={editOpen} title="Edit business profile" description="Update the details shown across your Solexa workspace." onClose={() => setEditOpen(false)}><form onSubmit={saveProfile} className="settings-edit-form"><Field label="Business name" value={draft.businessName} onChange={(event) => setDraft((current) => ({ ...current, businessName: event.target.value }))} autoFocus /><div className="grid grid-cols-2 gap-3"><Field label="Owner first name" value={draft.ownerFirstName} onChange={(event) => setDraft((current) => ({ ...current, ownerFirstName: event.target.value }))} textOnly /><Field label="Owner second name" value={draft.ownerSecondName} onChange={(event) => setDraft((current) => ({ ...current, ownerSecondName: event.target.value }))} textOnly /></div><Field label="Business email" type="email" placeholder="name@business.com" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /><Field label="Business contact number" type="tel" placeholder="0300 1234567" value={draft.contactNumber} onChange={(event) => setDraft((current) => ({ ...current, contactNumber: event.target.value }))} /><SelectField label="Gender" value={draft.gender} onChange={(event) => setDraft((current) => ({ ...current, gender: event.target.value }))}><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></SelectField>{profileError && <p className="rounded-xl bg-[var(--error-glow)] px-3 py-2 text-[10px] font-bold text-[var(--error)]">{profileError}</p>}<div className="primitive-dialog-actions px-0 pb-0"><Button type="button" variant="secondary" className="cancel-button" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" variant="brand" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button></div></form></Modal><Notification message={notification?.message} variant={notification?.variant ?? "success"} onDismiss={() => setNotification(null)} /></div>;
}

function applyTheme(theme: ThemeMode) { document.documentElement.classList.toggle("dark", theme === "dark"); document.documentElement.setAttribute("data-theme", theme); window.dispatchEvent(new CustomEvent("solexa-theme-change", { detail: theme })); }
function ProfileRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="settings-profile-row"><span className="settings-row-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong></div></div>; }

async function loadRemoteProfile(): Promise<BusinessProfile | null> {
  const workspaceId = window.localStorage.getItem("solexa-workspace-id");
  const supabase = createSupabaseBrowserClient();
  if (!workspaceId || !supabase) return null;
  const { data, error } = await supabase.from("workspaces").select("business_name,owner_first_name,owner_second_name,owner_email,owner_contact_number,owner_gender").eq("id", workspaceId).maybeSingle();
  if (error || !data) return null;
  const next: BusinessProfile = { name: data.business_name, businessName: data.business_name, ownerFirstName: data.owner_first_name, ownerSecondName: data.owner_second_name, email: data.owner_email, contactNumber: data.owner_contact_number, gender: data.owner_gender };
  window.localStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(next));
  return next;
}
