"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { OsHeader } from "../os/header";
import { OsSidebar } from "../os/sidebar";
import { ErpStoreProvider } from "../../lib/erp-store";

export function ErpShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/dashboard";
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showRefreshCover, setShowRefreshCover] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setShowRefreshCover(false), 900); return () => window.clearTimeout(timer); }, []);
  const navigate = (href: string) => router.push(href);
  return <ErpStoreProvider><div className="erp-shell"><OsSidebar currentPath={pathname} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} onCollapsedChange={setSidebarCollapsed} onNavigate={navigate} onSignOut={() => navigate("/login")} userName="Minaal Rizwan" userRole="Administrator" appName="Solexa" /><main className={`erp-main ${sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}><OsHeader userName="Minaal Rizwan" userRole="Administrator" pageTitle={pathname.slice(1) || "dashboard"} onOpenMobileMenu={() => setMobileOpen(true)} onNavigate={navigate} onSignOut={() => navigate("/login")} />{children}</main>{showRefreshCover && <div className="solexa-refresh-cover" role="status" aria-label="Loading Solexa"><Image src="/solexa-logo.jpeg" alt="Solexa" width={64} height={64} priority className="solexa-refresh-logo" /><strong>solexa</strong><span>by intellisense</span></div>}</div></ErpStoreProvider>;
}
