"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { OsHeader } from "../os/header";
import { OsSidebar } from "../os/sidebar";
import { clearLocalErpSnapshots, ErpStoreProvider } from "../../lib/erp-store";
import { getOwnerDisplayName, hasCompletedOnboarding, readBusinessProfile, type BusinessProfile } from "../../lib/business-profile";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { isLocalOnlyMode, isSupabaseConfigured } from "../../lib/supabase/config";
import { canViewPermission, editablePermissionKeys, firstPermittedPath, invitationAcceptPath, loadCurrentWorkspaceAccess, passwordSetupPath, permissionForPath, safeInvitationId, visiblePermissionKeys, type WorkspaceAccess } from "../../lib/supabase/access";

function invitationIdFromUser(user: { user_metadata?: Record<string, unknown> }) {
  return safeInvitationId(user.user_metadata?.workspace_invitation_id);
}

function passwordWasInitialized(user: { user_metadata?: Record<string, unknown> }) {
  return user.user_metadata?.password_initialized === true;
}

function roleLabel(role: WorkspaceAccess["role"] | undefined) {
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Workspace member";
}

export function ErpShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/dashboard";
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showRefreshCover, setShowRefreshCover] = useState(true);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [workspaceAccess, setWorkspaceAccess] = useState<WorkspaceAccess | null>(null);
  const [checkedPath, setCheckedPath] = useState<string | null>(null);
  const [configurationError, setConfigurationError] = useState(!isSupabaseConfigured() && !isLocalOnlyMode());
  const [accessChecked, setAccessChecked] = useState(isLocalOnlyMode());
  useEffect(() => { const timer = window.setTimeout(() => setShowRefreshCover(false), 900); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    let active = true;
    const verifyAccess = async () => {
      const storedProfile = readBusinessProfile();
      const workspaceId = window.localStorage.getItem("solexa-workspace-id");

      if (isSupabaseConfigured()) {
        // Never render ERP content from a legacy implicit-flow invitation.
        // Supabase places bearer tokens in the URL fragment for that flow;
        // the fragment is client-visible and must be rejected even though it
        // is not sent to the server. New invitations must use /auth/confirm
        // with a one-time token_hash instead.
        const currentUrl = new URL(window.location.href);
        const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
        const hasLegacySessionToken = Boolean(hashParams.get("access_token") || hashParams.get("refresh_token"));
        if (hasLegacySessionToken) {
          window.history.replaceState({}, document.title, `${currentUrl.pathname}${currentUrl.search}`);
          const supabase = createSupabaseBrowserClient();
          await supabase?.auth.signOut({ scope: "local" });
          router.replace("/login?error=invitation_link_invalid");
          return;
        }

        const supabase = createSupabaseBrowserClient();
        if (!supabase) {
          router.replace("/login");
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!userData.user || userError) {
          router.replace("/login");
          return;
        }

        const invitationId = invitationIdFromUser(userData.user);
        if (invitationId && !passwordWasInitialized(userData.user)) {
          if (window.location.hash) {
            window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
          }
          router.replace(passwordSetupPath(invitationId));
          return;
        }

        const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceError) {
          router.replace("/login");
          return;
        }

        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) {
          router.replace("/login");
          return;
        }

        const hasVerifiedTotp = factors.totp.some((factor) => factor.status === "verified");
        if (!hasVerifiedTotp || assurance.currentLevel !== "aal2") {
          const next = invitationId ? invitationAcceptPath(invitationId) : pathname;
          router.replace(`/mfa?next=${encodeURIComponent(next)}`);
          return;
        }

        const accessResult = await loadCurrentWorkspaceAccess(supabase, workspaceId);
        if (!active) return;
        if (!accessResult.data) {
          if (invitationId) {
            router.replace(invitationAcceptPath(invitationId));
            return;
          }
          // A self-service account may have a completed local profile but no
          // durable workspace yet (for example after the auth migration or a
          // cleared browser session). Send it through setup so create_workspace
          // can provision the owner membership.
          router.replace("/onboarding");
          return;
        }

        const access = accessResult.data;
        if (access.role === "owner" && !hasCompletedOnboarding(storedProfile)) {
          router.replace("/onboarding");
          return;
        }

        window.localStorage.setItem("solexa-workspace-id", access.workspaceId);
        const requiredPermission = permissionForPath(pathname);
        if (requiredPermission && !canViewPermission(access, requiredPermission)) {
          router.replace(firstPermittedPath(access) ?? "/access-denied");
          return;
        }

        setWorkspaceAccess(access);
      } else if (!isLocalOnlyMode()) {
        setConfigurationError(true);
        setAccessChecked(true);
        return;
      } else if (!hasCompletedOnboarding(storedProfile)) {
        router.replace("/onboarding");
        return;
      }

      if (!active) return;
      setProfile(storedProfile);
      setCheckedPath(pathname);
      setAccessChecked(true);
    };

    void verifyAccess();
    return () => { active = false; };
  }, [pathname, router]);
  const signOut = () => {
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase?.auth.signOut();
      clearLocalErpSnapshots();
      window.localStorage.removeItem("solexa-workspace-id");
      router.replace("/login");
    })();
  };
  const navigate = (href: string) => router.push(href);
  const visibleKeys = useMemo(() => workspaceAccess ? visiblePermissionKeys(workspaceAccess) : undefined, [workspaceAccess]);
  const editableKeys = useMemo(() => workspaceAccess ? editablePermissionKeys(workspaceAccess) : undefined, [workspaceAccess]);
  const userName = workspaceAccess?.memberName || (workspaceAccess?.role === "owner" ? getOwnerDisplayName(profile) : "Workspace member");
  const userRole = roleLabel(workspaceAccess?.role);
  if (configurationError) return <div className="solexa-refresh-cover" role="alert" aria-label="Secure backend configuration required"><Image src="/solexa-logo.png" alt="Solexa" width={64} height={64} priority className="solexa-refresh-logo" /><strong>solexa</strong><span>secure backend configuration required</span></div>;
  if (!accessChecked || (isSupabaseConfigured() && checkedPath !== pathname)) return <div className="solexa-refresh-cover" role="status" aria-label="Checking workspace access"><Image src="/solexa-logo.png" alt="Solexa" width={64} height={64} priority className="solexa-refresh-logo" /><strong>solexa</strong><span>checking workspace access</span></div>;
  return <ErpStoreProvider><div className="erp-shell"><OsSidebar currentPath={pathname} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} onCollapsedChange={setSidebarCollapsed} onNavigate={navigate} onSignOut={signOut} userName={userName} userRole={userRole} appName="Solexa" visiblePermissionKeys={visibleKeys} /><main className={`erp-main ${sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}><OsHeader userName={userName} userRole={userRole} pageTitle={pathname.slice(1) || "dashboard"} onOpenMobileMenu={() => setMobileOpen(true)} onNavigate={navigate} onSignOut={signOut} visiblePermissionKeys={visibleKeys} editablePermissionKeys={editableKeys} /><div key={pathname} className="erp-route-transition">{children}</div></main>{showRefreshCover && <div className="solexa-refresh-cover" role="status" aria-label="Loading Solexa"><Image src="/solexa-logo.png" alt="Solexa" width={64} height={64} priority className="solexa-refresh-logo" /><strong>solexa</strong><span>by intellisense</span></div>}</div></ErpStoreProvider>;
}
