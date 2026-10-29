"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  ClipboardList,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PackagePlus,
  Receipt,
  ReceiptText,
  Settings2,
  ShoppingCart,
  Users,
  X,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export interface NavSubItem {
  label: string;
  href: string;
  icon?: LucideIcon;
}

export interface NavGroupItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  items?: NavSubItem[];
}

export interface ResponsiveSidebarProps {
  currentPath?: string;
  onNavigate?: (href: string) => void;
  onSignOut?: () => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  userName?: string;
  userRole?: string;
  appName?: string;
}

// Keep the navigation focused on inventory, sales, insights, operations, and entities.
const DEFAULT_NAV_GROUPS: NavGroupItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "POS", href: "/pos", icon: ShoppingCart },
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Sales", href: "/sales", icon: ShoppingCart },
  {
    label: "Insights",
    icon: BarChart3,
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Transactions", href: "/transactions", icon: ClipboardList },
    ],
  },
  {
    label: "Operations",
    icon: PackagePlus,
    items: [
      { label: "Purchases", href: "/purchases", icon: Receipt },
      { label: "Low stock", href: "/low-stock", icon: Bell },
      { label: "Settings", href: "/settings", icon: Settings2 },
    ],
  },
  {
    label: "Finance",
    icon: CircleDollarSign,
    items: [
      { label: "Expenses", href: "/expenses", icon: ReceiptText },
      { label: "Invoices", href: "/invoices", icon: FileText },
      { label: "Capital", href: "/capital", icon: WalletCards },
    ],
  },
  {
    label: "Entities",
    icon: Users,
    items: [
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Suppliers", href: "/suppliers", icon: Building2 },
    ],
  },
];

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

function isRouteActive(pathname: string, href?: string) {
  return Boolean(href && (pathname === href || pathname.startsWith(`${href}/`)));
}

function Brand({ compact = false, appName }: { compact?: boolean; appName: string }) {
  return (
    <div className="brand-wrapper">
      <div className="brand-logo-gem">
        <Image src="/solexa-logo.png" alt="" width={48} height={48} />
      </div>
      {!compact && (
        <div className="brand-text-container">
          <span className="brand-title">{appName}</span>
          <span className="brand-subtitle">By Intellisense</span>
        </div>
      )}
    </div>
  );
}

function TreeBranch({ last }: { last: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 30" className="tree-branch-svg">
      <path
        d={last ? "M1 0 V9 Q1 15 7 15 H20" : "M1 0 V30 M1 9 Q1 15 7 15 H20"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function OsSidebar({
  currentPath,
  onNavigate,
  onSignOut,
  mobileOpen = false,
  onMobileOpenChange,
  onCollapsedChange,
  appName = "Solexa",
}: ResponsiveSidebarProps) {
  const pathname = usePathname() || currentPath || "/dashboard";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const drawerOpen = mobileOpen || internalMobileOpen;

  const setSidebarCollapsed = (value: boolean) => {
    setCollapsed(value);
    onCollapsedChange?.(value);
  };

  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  const closeMobile = useCallback(() => {
    setInternalMobileOpen(false);
    onMobileOpenChange?.(false);
  }, [onMobileOpenChange]);

  const previousPathRef = useRef(pathname);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [closeMobile, drawerOpen]);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    const timer = window.setTimeout(closeMobile, 0);
    return () => window.clearTimeout(timer);
  }, [closeMobile, pathname]);

  function navigate(href: string) {
    closeMobile();
    if (onNavigate) onNavigate(href);
    else router.push(href);
  }

  function chooseGroup(group: NavGroupItem) {
    if (group.href) {
      navigate(group.href);
      return;
    }
    if (collapsed) {
      setSidebarCollapsed(false);
      setOpenGroup(group.label);
      return;
    }
    setOpenGroup((current) => (current === group.label ? null : group.label));
  }

  const desktopNavigation = (
    <nav className="sidebar-nav custom-scrollbar" aria-label="Workspace navigation">
      <div className={cn("nav-group-list", collapsed && "is-collapsed-list")}>
        {DEFAULT_NAV_GROUPS.map((group) => {
          const GroupIcon = group.icon;
          const groupActive = group.href
            ? isRouteActive(pathname, group.href)
            : Boolean(group.items?.some((item) => isRouteActive(pathname, item.href)));
          const expanded = openGroup === group.label;
          return (
            <div key={group.label} className="nav-group-node">
              <button
                type="button"
                title={collapsed ? group.label : undefined}
                onClick={() => chooseGroup(group)}
                className={cn("nav-parent-btn", groupActive && "active-parent")}
              >
                <span className="nav-icon-box"><GroupIcon size={collapsed ? 15 : 14} /></span>
                {!collapsed && (
                  <>
                    <span className="nav-label-text">{group.label}</span>
                    {group.items && <ChevronDown size={12} className={cn("chevron-indicator", expanded && "rotate-up")} />}
                  </>
                )}
                {groupActive && <span className={cn("active-pill-bar", collapsed && "collapsed-active-pill")} />}
              </button>
              <AnimatePresence initial={false}>
                {!collapsed && group.items && expanded && (
                  <motion.div
                    key={`submenu-${group.label}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="subnav-container"
                  >
                    <div className="subnav-list">
                      {group.items.map((item, index) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.href}
                            type="button"
                            onClick={() => navigate(item.href)}
                            className={cn("subnav-btn", isRouteActive(pathname, item.href) && "active-sub")}
                          >
                            <TreeBranch last={index === group.items!.length - 1} />
                            {Icon && <Icon size={12} />}
                            <span className="subnav-label">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </nav>
  );

  const mobileNavigation = (
    <nav className="mobile-nav custom-scrollbar" aria-label="Workspace navigation">
      <div className="mobile-nav-groups">
        {DEFAULT_NAV_GROUPS.map((group) => (
          <section key={group.label} className="mobile-group-node">
            <p className="mobile-nav-group-label">{group.label}</p>
            {(group.items ?? [{ label: group.label, href: group.href!, icon: group.icon }]).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => navigate(item.href)}
                  className={cn("mobile-sub-btn", isRouteActive(pathname, item.href) && "active-mobile-sub")}
                >
                  {Icon && <Icon size={12} />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </nav>
  );

  return (
    <>
      <aside className={cn("desktop-sidebar", collapsed && "is-collapsed")}>
        <div className={cn("sidebar-header", collapsed && "is-collapsed-header")}>
          <Brand compact={collapsed} appName={appName} />
          {!collapsed && (
            <button type="button" onClick={() => setSidebarCollapsed(true)} className="icon-action-btn" aria-label="Collapse sidebar">
              <PanelLeftClose size={14} />
            </button>
          )}
        </div>
        {collapsed && (
          <button type="button" onClick={() => setSidebarCollapsed(false)} className="collapsed-expand-btn" aria-label="Expand sidebar" title="Expand sidebar">
            <PanelLeftOpen size={15} />
          </button>
        )}
        {desktopNavigation}
        <div className="sidebar-footer">
          <button type="button" onClick={onSignOut} className="signout-btn" title={collapsed ? "Sign out" : undefined}>
            <LogOut size={15} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {drawerOpen && (
        <div className="mobile-overlay">
          <button type="button" className="mobile-backdrop" aria-label="Close navigation" onClick={closeMobile} />
          <aside className="mobile-drawer">
            <div className="mobile-drawer-header">
              <Brand appName={appName} />
              <button type="button" onClick={closeMobile} className="icon-action-btn" aria-label="Close sidebar">
                <X size={14} />
              </button>
            </div>
            {mobileNavigation}
            <div className="mobile-footer">
              <button type="button" onClick={onSignOut} className="signout-btn">
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <style jsx global>{`
        :root {
          --sb-panel: var(--panel-strong, var(--surface));
          --sb-panel-soft: var(--panel-soft, var(--surface-soft));
          --sb-text: var(--text-primary);
          --sb-muted: var(--text-muted);
          --sb-brand: var(--primary);
          --sb-brand-soft: var(--primary-soft);
          --sb-danger: var(--error);
          --sb-danger-soft: var(--error-glow);
          --sb-shadow: var(--shadow-out);
        }
        .desktop-sidebar { position: fixed; inset: 12px auto 12px 12px; z-index: 50; display: none; width: 222px; flex-direction: column; overflow: hidden; border-radius: 30px; background: var(--sb-panel); box-shadow: var(--sb-shadow); padding: 10px; transition: width 500ms cubic-bezier(.16,1,.3,1); }
        .desktop-sidebar.is-collapsed { width: 70px; }
        .sidebar-header { display: flex; height: 56px; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 0 8px; }
        .sidebar-header.is-collapsed-header { justify-content: center; padding: 0; }
        .brand-wrapper { display: flex; min-width: 0; align-items: center; gap: 10px; }
        .brand-logo-gem { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; overflow: hidden; border-radius: 12px; background: var(--sb-panel-soft); }
        .brand-logo-gem img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .brand-text-container { display: flex; min-width: 0; flex-direction: column; line-height: 1.1; }
        .brand-title { overflow: hidden; color: var(--sb-text); font-size: 13px; font-weight: 600; letter-spacing: -.02em; text-overflow: ellipsis; white-space: nowrap; }
        .brand-subtitle { margin-top: 4px; color: var(--sb-muted); font-size: 8px; font-weight: 500; letter-spacing: .08em; white-space: nowrap; }
        .icon-action-btn, .collapsed-expand-btn { display: grid; flex: 0 0 auto; place-items: center; border: 0; color: var(--sb-text); background: var(--sb-panel-soft); cursor: pointer; }
        .icon-action-btn { width: 32px; height: 32px; border-radius: 11px; }
        .collapsed-expand-btn { width: 44px; height: 44px; margin: 8px auto 0; border-radius: 15px; color: var(--sb-text); background: var(--sb-brand-soft); }
        .sidebar-nav, .mobile-nav { min-height: 0; flex: 1; overflow-x: hidden; overflow-y: auto; }
        .sidebar-nav { margin-top: 10px; }
        .nav-group-list { display: flex; flex-direction: column; gap: 4px; }
        .nav-group-node { width: 100%; }
        .nav-parent-btn { position: relative; display: flex; width: 100%; height: 40px; align-items: center; gap: 10px; border: 0; border-radius: 15px; padding: 0 12px; color: var(--sb-text); background: transparent; font-size: 9px; font-weight: 600; text-align: left; cursor: pointer; }
        .nav-parent-btn:hover, .subnav-btn:hover, .mobile-sub-btn:hover { background: var(--sb-panel-soft); }
        .nav-parent-btn.active-parent { background: var(--sb-brand-soft); }
        .is-collapsed-list .nav-parent-btn { width: 44px; height: 44px; justify-content: center; margin: 0 auto; padding: 0; }
        .nav-icon-box { display: grid; width: 20px; height: 20px; flex: 0 0 auto; place-items: center; }
        .nav-label-text, .subnav-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .nav-label-text { flex: 1; }
        .chevron-indicator { color: var(--sb-muted); transition: transform .3s ease-out; }
        .chevron-indicator.rotate-up { transform: rotate(180deg); }
        .active-pill-bar { position: absolute; top: 8px; right: 0; width: 3px; height: 24px; border-radius: 999px; background: var(--sb-brand); }
        .collapsed-active-pill { top: 8px; height: 28px; }
        .subnav-container { position: relative; margin-left: 20px; overflow: hidden; padding-left: 20px; }
        .subnav-container::before { position: absolute; top: 0; bottom: 15px; left: 0; width: 1px; background: color-mix(in srgb, var(--sb-muted) 28%, transparent); content: ""; }
        .subnav-list { display: flex; flex-direction: column; gap: 1px; padding: 4px 0; }
        .subnav-btn { position: relative; display: flex; width: 100%; height: 30px; align-items: center; gap: 8px; border: 0; border-radius: 11px; padding: 0 8px; color: var(--sb-text); background: transparent; font-size: 8px; font-weight: 500; text-align: left; cursor: pointer; }
        .subnav-btn.active-sub, .mobile-sub-btn.active-mobile-sub { background: var(--sb-panel-soft); }
        .tree-branch-svg { position: absolute; top: 0; left: -20px; width: 20px; height: 30px; color: color-mix(in srgb, var(--sb-muted) 28%, transparent); pointer-events: none; }
        .sidebar-footer { margin-top: 8px; flex: 0 0 auto; }
        .signout-btn { display: flex; width: 100%; height: 44px; align-items: center; justify-content: center; gap: 10px; border: 0; border-radius: 15px; padding: 0 16px; color: var(--sb-danger); background: var(--sb-danger-soft); font-size: 9px; font-weight: 600; cursor: pointer; }
        .desktop-sidebar.is-collapsed .signout-btn { width: 44px; padding: 0; margin: 0 auto; }
        .mobile-overlay { position: fixed; inset: 0; z-index: 50; display: flex; }
        .mobile-backdrop { position: fixed; inset: 0; z-index: 50; border: 0; background: var(--dialog-overlay); backdrop-filter: blur(4px); cursor: pointer; }
        .mobile-drawer { position: fixed; inset: 12px auto 12px 12px; z-index: 60; display: flex; width: min(86vw,290px); flex-direction: column; overflow: hidden; border-radius: 30px; padding: 12px; background: var(--sb-panel); box-shadow: var(--sb-shadow); animation: sidebar-drawer-in .42s cubic-bezier(.16,1,.3,1); }
        .mobile-drawer-header { display: flex; height: 56px; flex: 0 0 auto; align-items: center; justify-content: space-between; padding: 0 8px; }
        .mobile-nav { margin-top: 4px; }
        .mobile-nav-groups { display: flex; flex-direction: column; gap: 12px; }
        .mobile-group-node { width: 100%; }
        .mobile-nav-group-label { margin: 0; padding: 0 12px 4px; color: var(--sb-muted); font-size: 7px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; }
        .mobile-sub-btn { display: flex; width: 100%; height: 32px; align-items: center; gap: 10px; border: 0; border-radius: 12px; padding: 0 12px; color: var(--sb-text); background: transparent; font-size: 8px; font-weight: 500; text-align: left; cursor: pointer; }
        .mobile-footer { margin-top: 8px; flex: 0 0 auto; }
        .mobile-footer .signout-btn { height: 48px; justify-content: flex-start; border-radius: 17px; font-size: 10px; }
        @keyframes sidebar-subnav-in { from { opacity: 0; max-height: 0; transform: translateY(-4px); } to { opacity: 1; max-height: 500px; transform: translateY(0); } }
        @keyframes sidebar-drawer-in { from { opacity: 0; transform: translateX(-105%); } to { opacity: 1; transform: translateX(0); } }
        @media (min-width: 1024px) { .desktop-sidebar { display: flex; } }
        @media (max-width: 1023px) { .desktop-sidebar { display: none; } }
      `}</style>
    </>
  );
}

export default OsSidebar;
