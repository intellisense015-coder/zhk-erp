"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { OsHeader } from "../os/header";
import { OsSidebar } from "../os/sidebar";
import { ErpStoreProvider } from "../../lib/erp-store";
import { getOwnerDisplayName, hasCompletedOnboarding, readBusinessProfile, type BusinessProfile } from "../../lib/business-profile";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { isSupabaseConfigured } from "../../lib/supabase/config";

export function ErpShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/dashboard";
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showRefreshCover, setShowRefreshCover] = useState(true);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [accessChecked, setAccessChecked] = useState(!isSupabaseConfigured());
  useEffect(() => { const timer = window.setTimeout(() => setShowRefreshCover(false), 900); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    let active = true;
    const verifyAccess = async () => {
      const storedProfile = readBusinessProfile();
      const workspaceId = window.localStorage.getItem("solexa-workspace-id");

      if (!hasCompletedOnboarding(storedProfile) || (isSupabaseConfigured() && !workspaceId)) {
        router.replace("/onboarding");
        return;
      }

      if (isSupabaseConfigured()) {
        const supabase = createSupabaseBrowserClient();
        if (!supabase || !workspaceId) {
          router.replace("/login");
          return;
        }

        const { data: membership, error } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("workspace_id", workspaceId)
          .maybeSingle();

        if (!active) return;
        if (error || !membership) {
          window.localStorage.removeItem("solexa-workspace-id");
          router.replace("/onboarding");
          return;
        }
      }

      if (!active) return;
      setProfile(storedProfile);
      setAccessChecked(true);
    };

    void verifyAccess();
    return () => { active = false; };
  }, [router]);
  const signOut = () => {
    void (async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase?.auth.signOut();
      window.localStorage.removeItem("solexa-pin-passed");
      router.replace("/login");
    })();
  };
  const navigate = (href: string) => router.push(href);
  const userName = getOwnerDisplayName(profile);
  if (!accessChecked) return <div className="solexa-refresh-cover" role="status" aria-label="Checking workspace access"><Image src="/solexa-logo.png" alt="Solexa" width={64} height={64} priority className="solexa-refresh-logo" /><strong>solexa</strong><span>checking workspace access</span></div>;
  return <ErpStoreProvider><div className="erp-shell"><OsSidebar currentPath={pathname} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} onCollapsedChange={setSidebarCollapsed} onNavigate={navigate} onSignOut={signOut} userName={userName} userRole="Administrator" appName="Solexa" /><main className={`erp-main ${sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}><OsHeader userName={userName} userRole="Administrator" pageTitle={pathname.slice(1) || "dashboard"} onOpenMobileMenu={() => setMobileOpen(true)} onNavigate={navigate} onSignOut={signOut} /><div key={pathname} className="erp-route-transition">{children}</div></main>{showRefreshCover && <div className="solexa-refresh-cover" role="status" aria-label="Loading Solexa"><Image src="/solexa-logo.png" alt="Solexa" width={64} height={64} priority className="solexa-refresh-logo" /><strong>solexa</strong><span>by intellisense</span></div>}</div></ErpStoreProvider>;
}
