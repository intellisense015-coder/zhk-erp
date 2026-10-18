"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Search,
  ChevronRight,
  UserRound,
  Settings2,
  LogOut,
  Sun,
  Moon,
  Menu,
  LayoutDashboard,
  LucideIcon,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  Grid2X2,
  Plus,
} from "lucide-react";
import { formatCurrency, formatTransactionTime } from "../../lib/erp-data";
import { useErpStore } from "../../lib/erp-store";

// ==========================================
// Types
// ==========================================

export interface SearchResultItem {
  label: string;
  href: string;
  category?: string;
  description?: string;
  icon?: LucideIcon;
}

export interface DashboardHeaderProps {
  userName?: string;
  userRole?: string;
  pageTitle?: string;
  onOpenMobileMenu?: () => void;
  onNavigate?: (href: string) => void;
  onSignOut?: () => void;
}

type OpenDropdown = "quick" | "profile" | null;

const DEFAULT_SEARCH_MODULES: SearchResultItem[] = [
  { label: "Dashboard", href: "/dashboard", category: "Dasgboard", icon: LayoutDashboard },
  { label: "POS", href: "/pos", category: "Sales", icon: ShoppingCart },
  { label: "Inventory", href: "/inventory", category: "Inventory", icon: Boxes },
  { label: "Sales", href: "/sales", category: "Sales", icon: ShoppingCart },
  { label: "Reports", href: "/reports", category: "Insights", icon: BarChart3 },
  { label: "Transactions", href: "/transactions", category: "Insights", icon: ClipboardList },
  { label: "Low stock", href: "/low-stock", category: "Operations", icon: Boxes },
  { label: "Customers", href: "/customers", category: "Entities", icon: Users },
  { label: "Suppliers", href: "/suppliers", category: "Entities", icon: Building2 },
  { label: "Settings", href: "/settings", category: "Operations", icon: Settings2 },
];

// Helper: dynamic time greeting
function getGreeting() {
  // Keep the initial render deterministic for Next.js prerendering.
  return "Good morning";
}

// ==========================================
// Main Dashboard Header Component
// ==========================================

export function OsHeader({
  userName = "Sohaib Asgher",
  userRole = "Administrator",
  pageTitle = "Accounts",
  onOpenMobileMenu,
  onNavigate,
  onSignOut,
}: DashboardHeaderProps) {
  const { products, transactions, customers, suppliers } = useErpStore();
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  // Keep the server render and the first client render identical. The saved
  // theme is applied in the effect below after hydration has completed.
  const [isDarkMode, setIsDarkMode] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const applyTheme = (theme: "light" | "dark") => {
    const dark = theme === "dark";
    setIsDarkMode(dark);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("solexa-theme", theme);
    window.dispatchEvent(new CustomEvent("solexa-theme-change", { detail: theme }));
  };

  // Keyboard shortcut: Ctrl + K (or Cmd + K) to search, Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
        setOpenDropdown(null);
      }
      if (e.key === "Escape") {
        setOpenDropdown(null);
        setSearchFocused(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("solexa-theme");
    const dark = storedTheme === "dark" || document.documentElement.classList.contains("dark") || document.documentElement.getAttribute("data-theme") === "dark";
    setIsDarkMode(dark);
  }, []);

  useEffect(() => {
    const handleThemeChange = (event: Event) => setIsDarkMode((event as CustomEvent<string>).detail === "dark");
    window.addEventListener("solexa-theme-change", handleThemeChange);
    return () => window.removeEventListener("solexa-theme-change", handleThemeChange);
  }, []);

  // Click outside header to dismiss dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = (menu: OpenDropdown) => {
    setSearchFocused(false);
    setOpenDropdown((prev) => (prev === menu ? null : menu));
  };

  const handleSearchSelect = (href: string) => {
    setSearchQuery("");
    setSearchFocused(false);
    onNavigate?.(href);
  };

  const searchableRecords: SearchResultItem[] = [
    ...products.map((product) => ({ label: product.name, href: "/inventory", category: `Inventory · ${product.category}`, description: `${product.sku} · ${formatCurrency(product.costPrice)} cost · ${formatCurrency(product.sellingPrice)} sale · ${product.inStockQuantity} in stock`, icon: Boxes })),
    ...customers.map((customer) => ({ label: customer.name, href: "/customers", category: "Customers", description: `${customer.code} · ${customer.contactNumber}`, icon: Users })),
    ...suppliers.map((supplier) => ({ label: supplier.name, href: "/suppliers", category: "Suppliers", description: `${supplier.company || "Supplier"} · ${supplier.contactNumber}`, icon: Building2 })),
    ...transactions.map((transaction) => ({ label: `${transaction.source === "customer-trade-in" ? "Trade-in" : transaction.type === "sale" ? "Sale" : transaction.type === "purchase" ? "Supplier stock" : "Transfer"} · ${transaction.party}`, href: transaction.type === "sale" ? "/sales" : "/transactions", category: "Activity", description: `${transaction.name} · ${formatCurrency(transaction.amount)} · ${formatTransactionTime(transaction)}`, icon: transaction.type === "sale" ? ShoppingCart : transaction.type === "purchase" ? Truck : ClipboardList })),
  ];
  const filteredSearchResults = [...DEFAULT_SEARCH_MODULES, ...searchableRecords].filter((item) =>
    `${item.label} ${item.category ?? ""} ${item.description ?? ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
  ).slice(0, 8);

  const initials = userName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header ref={headerRef} data-page-title={pageTitle} className={`solexa-header ${isScrolled ? "is-scrolled" : ""}`}>
        {/* Left: Mobile Menu Trigger & Page Greeting */}
        <div className="header-left">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="mobile-hamburger-btn"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>

          <div className="greeting-box">
            <span className="greeting-label">{getGreeting()}</span>
            <h1 className="header-page-title">{userName}</h1>
          </div>
        </div>

        {/* Center: Global Search Bar with Ctrl+K */}
        <div className={`header-search-wrap ${searchFocused ? "is-focused" : ""}`}>
          <Search size={14} className="search-leading-icon" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && filteredSearchResults[0]) handleSearchSelect(filteredSearchResults[0].href); }}
            onFocus={() => {
              setSearchFocused(true);
              setOpenDropdown(null);
            }}
            placeholder="Search dashboard"
            className="search-input"
          />
          <div className="search-kbd-pill">
            <span>Ctrl K</span>
          </div>

          {/* Search Results Dropdown */}
          {searchFocused && searchQuery.trim() && (
            <div className="search-dropdown-menu">
              <div className="search-dropdown-header">Matching modules and records</div>
              {filteredSearchResults.length > 0 ? (
                filteredSearchResults.map((result) => {
                  const Icon = result.icon || Search;
                  return (
                    <button
                      key={`${result.href}-${result.label}-${result.category ?? ""}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSearchSelect(result.href)}
                      className="search-dropdown-item"
                    >
                      <span className="search-item-icon">
                        <Icon size={14} />
                      </span>
                      <div className="search-item-info">
                        <span className="search-item-label">{result.label}</span>
                        {result.category && (
                          <span className="search-item-category">{result.category}</span>
                        )}
                        {result.description && <span className="search-item-description">{result.description}</span>}
                      </div>
                      <ChevronRight size={13} className="search-item-chevron" />
                    </button>
                  );
                })
              ) : (
                <div className="search-empty-state">No matching modules or records found.</div>
              )}
            </div>
          )}
        </div>

        {/* Right: Theme, quick actions, and profile */}
        <div className="header-actions">
          {/* Mobile Search Icon Trigger */}
          <button
            type="button"
            onClick={() => {
              setSearchFocused(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="mobile-search-btn"
            aria-label="Open search"
          >
            <Search size={16} />
          </button>

          {/* Theme Light/Dark Mode Switcher */}
          <div className="theme-toggle theme-switch" aria-label="Appearance">
            <button type="button" onClick={() => applyTheme("light")} className={`theme-option ${!isDarkMode ? "is-active" : ""}`} aria-label="Use light theme" aria-pressed={!isDarkMode}><Sun size={13} /><span>Light</span></button>
            <button type="button" onClick={() => applyTheme("dark")} className={`theme-option ${isDarkMode ? "is-active" : ""}`} aria-label="Use dark theme" aria-pressed={isDarkMode}><Moon size={13} /><span>Dark</span></button>
          </div>

          {/* Quick actions */}
          <div className="dropdown-anchor quick-action-wrapper">
            <button type="button" onClick={() => toggleDropdown("quick")} aria-label="Quick actions" aria-expanded={openDropdown === "quick"} className={`quick-action-trigger-btn ${openDropdown === "quick" ? "is-active" : ""}`}><Grid2X2 size={14} /><span className="quick-action-text">Quick actions</span></button>
            {openDropdown === "quick" && <div className="header-dropdown-card quick-popover"><p className="notif-title">Quick actions</p><div className="quick-grid"><button type="button" className="quick-card-btn" onClick={() => { onNavigate?.("/inventory/new"); setOpenDropdown(null); }}><span className="quick-icon-box"><Plus size={15} /></span><span className="quick-card-info"><span className="quick-card-title">Add product</span><span className="quick-card-desc">Create a new inventory item</span></span></button><button type="button" className="quick-card-btn" onClick={() => { onNavigate?.("/sales"); setOpenDropdown(null); }}><span className="quick-icon-box"><ShoppingCart size={15} /></span><span className="quick-card-info"><span className="quick-card-title">New sale</span><span className="quick-card-desc">Record a customer sale</span></span></button></div></div>}
          </div>

          {/* Profile Dropdown */}
          <div className="dropdown-anchor">
            <button
              type="button"
              onClick={() => toggleDropdown("profile")}
              className="user-avatar-btn"
              aria-label="User account menu"
            >
              {initials}
            </button>

            {openDropdown === "profile" && (
              <div className="header-dropdown-card profile-popover">
                <div className="glass-specular-spline" />
                <div className="glass-surface-grain" />

                <div className="glass-interactive-container">
                  <div className="profile-user-summary">
                    <div className="user-big-avatar">{initials}</div>
                    <div className="user-details">
                      <span className="user-full-name">{userName}</span>
                      <span className="user-role-badge">{userRole}</span>
                    </div>
                  </div>

                  <div className="profile-actions-list">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate?.("/dashboard/users");
                        setOpenDropdown(null);
                      }}
                      className="profile-menu-item"
                    >
                      <UserRound size={14} className="menu-icon-layer" />
                      <span>Users & Permissions</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onNavigate?.("/settings");
                        setOpenDropdown(null);
                      }}
                      className="profile-menu-item"
                    >
                      <Settings2 size={14} className="menu-icon-layer" />
                      <span>Settings</span>
                    </button>

                    <div className="profile-divider" />

                    <button
                      type="button"
                      onClick={() => {
                        setOpenDropdown(null);
                        onSignOut?.();
                      }}
                      className="profile-menu-item danger-item"
                    >
                      <LogOut size={14} className="menu-icon-layer" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ==========================================
          INLINE CSS STYLES (Self-Contained)
      ========================================== */}
      <style jsx global>{`
        /* Design Variables */
        :root {
          --hdr-bg: color-mix(in srgb, var(--surface) 85%, transparent);
          --hdr-card: var(--surface-solid);
          --hdr-soft: var(--surface-soft);
          --hdr-soft-hover: var(--primary-soft);
          --hdr-border: var(--border);
          --hdr-text: var(--text-primary);
          --hdr-muted: var(--text-muted);
          --hdr-brand: var(--primary);
          --hdr-brand-soft: var(--primary-soft);
          --hdr-brand-text: var(--primary-foreground);
          --hdr-danger: var(--error);
          --hdr-danger-soft: var(--error-glow);
          --hdr-shadow: var(--shadow-md);
          --hdr-popover-shadow: var(--dialog-shadow);
          --hdr-radius: 18px;
          --hdr-transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dark,
        html[data-theme="dark"] {
          --hdr-bg: color-mix(in srgb, var(--surface) 88%, transparent);
          --hdr-card: var(--surface-solid);
          --hdr-soft: var(--surface-soft);
          --hdr-soft-hover: var(--primary-soft);
          --hdr-border: var(--border);
          --hdr-text: var(--text-primary);
          --hdr-muted: var(--text-muted);
          --hdr-brand: var(--primary);
          --hdr-brand-soft: var(--primary-soft);
          --hdr-brand-text: var(--primary-foreground);
          --hdr-danger: var(--error);
          --hdr-danger-soft: var(--error-glow);
          --hdr-shadow: var(--shadow-md);
          --hdr-popover-shadow: var(--dialog-shadow);
        }

        /* Top Header Container */
        .solexa-header {
          position: sticky;
          top: 0;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 68px;
          padding: 10px 20px;
          background: var(--hdr-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--hdr-border);
          transition: background var(--hdr-transition);
          user-select: none;
          font-family: inherit;
        }

        .solexa-header.is-scrolled {
          background: color-mix(in srgb, var(--surface) 78%, transparent) !important;
          border-bottom-color: color-mix(in srgb, var(--border) 82%, transparent) !important;
          backdrop-filter: blur(14px) saturate(125%);
          -webkit-backdrop-filter: blur(14px) saturate(125%);
          box-shadow: 0 12px 28px color-mix(in srgb, var(--text-primary) 7%, transparent);
        }

        /* Left Side */
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .mobile-hamburger-btn {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: var(--hdr-soft);
          color: var(--hdr-text);
          cursor: pointer;
        }

        @media (min-width: 1024px) {
          .mobile-hamburger-btn {
            display: none;
          }
        }

        .greeting-box {
          display: flex;
          flex-direction: column;
          line-height: 1.15;
        }

        .greeting-label {
          font-size: 10.5px;
          color: var(--hdr-muted);
          font-weight: 500;
        }

        .header-page-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--hdr-text);
          letter-spacing: -0.01em;
          margin: 0;
        }

        /* Center Search */
        .header-search-wrap {
          position: relative;
          display: none;
          align-items: center;
          width: 100%;
          max-width: 360px;
          margin: 0 auto 0 20px;
        }

        @media (min-width: 768px) {
          .header-search-wrap {
            display: flex;
          }
        }

        .search-leading-icon {
          position: absolute;
          left: 12px;
          color: var(--hdr-muted);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          height: 38px;
          padding: 0 48px 0 34px;
          border-radius: 12px;
          border: 0;
          background: var(--surface-soft);
          color: var(--hdr-text);
          font-size: 11.5px;
          outline: none;
          box-shadow: none;
          transition: background-color 0.2s ease, box-shadow 0.2s ease;
        }

        .search-input:focus {
          border-color: transparent;
          background: var(--hdr-card);
          box-shadow: 0 0 0 3px var(--hdr-brand-soft);
        }

        .search-input::placeholder {
          color: var(--hdr-muted);
        }

        /* The light canvas is very pale, so give the header search its own
           readable surface and a clear focus/edge cue. */
        html:not([data-theme="dark"]) .search-input {
          background: var(--surface-soft);
          border: 0;
          box-shadow: none;
        }

        html:not([data-theme="dark"]) .search-leading-icon {
          color: var(--primary);
        }

        html:not([data-theme="dark"]) .search-input::placeholder {
          color: var(--text-muted);
          opacity: 1;
        }

        .search-kbd-pill {
          position: absolute;
          right: 10px;
          display: flex;
          align-items: center;
          padding: 2px 6px;
          border-radius: 6px;
          background: var(--hdr-card);
          border: 1px solid var(--hdr-border);
          color: var(--hdr-muted);
          font-size: 9px;
          font-weight: 600;
          pointer-events: none;
        }

        /* Search Autocomplete Menu */
        .search-dropdown-menu {
          position: absolute;
          top: 46px;
          left: 0;
          right: 0;
          background: var(--hdr-card);
          border: 1px solid var(--hdr-border);
          border-radius: var(--hdr-radius);
          box-shadow: var(--hdr-popover-shadow);
          padding: 8px;
          z-index: 60;
          animation: popDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .search-dropdown-header {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--hdr-muted);
          padding: 6px 8px;
        }

        .search-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 10px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--hdr-text);
          cursor: pointer;
          transition: background 0.15s ease;
          text-align: left;
        }

        .search-dropdown-item:hover {
          background: var(--hdr-brand-soft);
          color: var(--hdr-brand);
        }

        .search-item-icon {
          display: grid;
          place-items: center;
          width: 26px;
          height: 26px;
          border-radius: 8px;
          background: var(--hdr-soft);
          color: inherit;
        }

        .search-item-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .search-item-label {
          font-size: 11.5px;
          font-weight: 600;
        }

        .search-item-category {
          font-size: 9px;
          color: var(--hdr-muted);
        }

        .search-item-description {
          overflow: hidden;
          color: var(--hdr-muted);
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .search-item-chevron {
          color: var(--hdr-muted);
        }

        .search-empty-state {
          padding: 18px;
          text-align: center;
          font-size: 11px;
          color: var(--hdr-muted);
        }

        /* Right Actions */
        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .header-actions > .dropdown-anchor:has(.notif-badge) {
          display: block;
        }

        .mobile-search-btn {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--hdr-text);
          cursor: pointer;
        }

        @media (min-width: 768px) {
          .mobile-search-btn {
            display: none;
          }
        }

        .action-icon-btn {
          position: relative;
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: none;
          background: var(--hdr-soft);
          color: var(--hdr-text);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-icon-btn:hover,
        .action-icon-btn.is-active {
          background: var(--hdr-brand-soft);
          color: var(--hdr-brand);
        }

        .notification-trigger-btn {
          position: relative;
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: var(--text);
          cursor: pointer;
        }

        .notification-trigger-btn:hover {
          background: var(--surface-soft);
        }

        .notif-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          display: grid;
          place-items: center;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 9999px;
          background: var(--hdr-danger);
          color: var(--hdr-brand-text);
          font-size: 9px;
          font-weight: 800;
          box-shadow: 0 2px 6px var(--hdr-danger-soft);
        }

        /* Branch Switcher Button */
        .dropdown-anchor {
          position: relative;
        }

        .branch-trigger-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          min-height: 32px;
          height: 32px;
          padding: 0 8px;
          border-radius: 12px;
          border: 0;
          background: transparent;
          color: var(--text);
          font-size: 9px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .branch-trigger-btn:hover,
        .branch-trigger-btn.is-active {
          background: var(--surface-soft);
        }

        .branch-icon {
          color: var(--hdr-brand);
        }

        .branch-name {
          max-width: 140px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (max-width: 640px) {
          .branch-name {
            display: none;
          }
        }

        .chevron-arrow {
          color: var(--hdr-muted);
          transition: transform 0.25s ease;
        }

        .chevron-arrow.rotate {
          transform: rotate(180deg);
        }

        /* Quick Action Button */
        .quick-action-wrapper {
          display: none;
        }

        @media (min-width: 640px) {
          .quick-action-wrapper {
            display: block;
          }
        }

        .quick-action-trigger-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 36px;
          height: 36px;
          padding: 0 10px;
          border-radius: 12px;
          border: 0;
          background: var(--surface-soft);
          color: var(--text);
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 1400ms ease, color 1400ms ease, transform 1400ms ease;
        }

        .quick-action-trigger-btn:hover,
        .quick-action-trigger-btn.is-active {
          background: var(--primary-soft);
          color: var(--primary);
          transform: translateY(-1px);
        }

        @media (max-width: 1100px) {
          .quick-action-text {
            display: none;
          }
        }

        /* Profile Avatar Button */
        .user-avatar-btn {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: var(--brand);
          color: var(--primary-foreground);
          font-size: 11.5px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 4px 12px var(--primary-glow);
          transition: transform 0.2s ease;
        }

        .user-avatar-btn:hover {
          transform: scale(1.05);
        }

        /* Dropdown Cards Generic */
        .header-dropdown-card {
          position: absolute;
          right: 0;
          top: 46px;
          z-index: 70;
          background: var(--hdr-card);
          border: 1px solid var(--hdr-border);
          border-radius: var(--hdr-radius);
          box-shadow: var(--hdr-popover-shadow);
          animation: popDown 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dropdown-title-row {
          padding: 12px 14px 6px;
        }

        .dropdown-main-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--hdr-text);
          margin: 0;
        }

        .dropdown-desc {
          font-size: 9.5px;
          color: var(--hdr-muted);
          margin: 2px 0 0;
        }

        /* Branch Popover */
        .branch-popover {
          width: 270px;
          padding: 4px;
        }

        .dropdown-search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px;
          padding: 0 10px;
          height: 32px;
          border-radius: 10px;
          background: var(--hdr-soft);
        }

        .dropdown-search-icon {
          color: var(--hdr-muted);
        }

        .dropdown-input {
          flex: 1;
          border: none;
          background: transparent;
          color: var(--hdr-text);
          font-size: 10.5px;
          outline: none;
        }

        .branch-options-list {
          max-height: 200px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 4px 4px;
        }

        .branch-option-item {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: 8px 10px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--hdr-text);
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }

        .branch-option-item:hover {
          background: var(--hdr-soft);
        }

        .branch-option-item.selected {
          background: var(--hdr-brand-soft);
          color: var(--hdr-brand);
        }

        .branch-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .branch-opt-title {
          font-size: 11px;
          font-weight: 600;
        }

        .branch-opt-sub {
          font-size: 8.5px;
          color: var(--hdr-muted);
        }

        .opt-check {
          color: var(--hdr-brand);
        }

        /* Notifications Popover */
        .notif-popover {
          width: 310px;
          padding: 12px;
        }

        .notif-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--hdr-border);
        }

        .notif-title {
          font-size: 12px;
          font-weight: 700;
          margin: 0;
          color: var(--hdr-text);
        }

        .notif-close-btn {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          border: none;
          background: var(--hdr-soft);
          color: var(--hdr-muted);
          cursor: pointer;
        }

        .notif-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 10px;
        }

        .notif-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 12px;
          background: var(--hdr-soft);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .notif-card:hover {
          background: var(--hdr-soft-hover);
          transform: translateX(2px);
        }

        .notif-card-text {
          display: flex;
          flex-direction: column;
        }

        .notif-card-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--hdr-text);
        }

        .notif-card-sub {
          font-size: 9px;
          color: var(--hdr-muted);
        }

        .notif-pill {
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 10px;
          font-weight: 700;
        }

        .pill-danger {
          background: var(--hdr-danger-soft);
          color: var(--hdr-danger);
        }

        .pill-brand {
          background: var(--hdr-brand-soft);
          color: var(--hdr-brand);
        }

        /* Quick Actions Popover */
        .quick-popover {
          width: 320px;
          padding: 12px;
          background: var(--paper);
          border-color: var(--line);
          box-shadow: 0 24px 60px var(--card-shadow);
        }

        .quick-grid {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 8px;
        }

        .quick-card-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px;
          border-radius: 12px;
          border: none;
          background: transparent;
          color: var(--ink);
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .quick-card-btn:hover {
          background: var(--brand-soft);
          transform: translateX(3px);
        }

        .quick-icon-box {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: var(--brand-soft);
          color: var(--brand);
          flex-shrink: 0;
        }

        .quick-card-btn:hover .quick-icon-box {
          background: var(--brand);
          color: var(--primary-foreground);
        }

        .quick-card-info {
          display: flex;
          flex-direction: column;
        }

        .quick-card-title {
          font-size: 11px;
          font-weight: 700;
        }

        .quick-card-desc {
          font-size: 9px;
          color: var(--hdr-muted);
        }

        /* Profile Popover */
        .profile-popover {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 230px;
          padding: 10px;
          border-radius: 20px;
          overflow: hidden;
          box-sizing: border-box;
          background: linear-gradient(135deg, color-mix(in srgb, var(--surface-solid) 64%, transparent) 0%, color-mix(in srgb, var(--surface-solid) 42%, transparent) 100%);
          backdrop-filter: blur(28px) saturate(155%);
          -webkit-backdrop-filter: blur(28px) saturate(155%);
          border: 1px solid color-mix(in srgb, var(--text-primary) 12%, transparent);
          border-top-color: color-mix(in srgb, #fff 45%, transparent);
          border-left-color: color-mix(in srgb, #fff 30%, transparent);
          border-bottom-color: color-mix(in srgb, #000 20%, transparent);
          box-shadow: inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.25), inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.1), 0 24px 60px -10px color-mix(in srgb, var(--text-primary) 22%, transparent);
        }

        .glass-specular-spline {
          position: absolute;
          top: -30px;
          right: -20px;
          width: 140px;
          height: 90px;
          transform: rotate(-10deg);
          background: radial-gradient(ellipse at center, rgba(0, 229, 255, 0.28) 0%, rgba(255, 255, 255, 0.12) 40%, rgba(255, 255, 255, 0) 75%);
          filter: blur(4px);
          pointer-events: none;
          z-index: 1;
        }

        .glass-surface-grain {
          position: absolute;
          inset: 0;
          opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 2;
        }

        .glass-interactive-container {
          position: relative;
          z-index: 5;
        }

        .profile-user-summary {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          box-sizing: border-box;
          border-radius: 12px;
          margin-bottom: 8px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--surface-soft) 55%, transparent), color-mix(in srgb, var(--surface-soft) 30%, transparent));
          border: 1px solid color-mix(in srgb, var(--text-primary) 12%, transparent);
          border-top-color: color-mix(in srgb, #fff 25%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 15%, transparent), 0 4px 12px -2px rgba(0, 0, 0, 0.08);
        }

        .user-big-avatar {
          display: grid;
          width: 36px;
          height: 36px;
          place-items: center;
          border-radius: 10px;
          background: var(--brand);
          color: var(--primary-foreground);
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 2px 8px color-mix(in srgb, var(--brand) 30%, transparent);
        }

        .user-details {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .user-full-name {
          color: var(--ink);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: -0.1px;
        }

        .user-role-badge {
          color: var(--muted);
          font-size: 9.5px;
          font-weight: 500;
        }

        .profile-actions-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .profile-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 12px;
          box-sizing: border-box;
          cursor: pointer;
          font-size: 11.5px;
          font-weight: 500;
          text-align: left;
          border-radius: 10px;
          color: var(--ink);
          border: 1px solid color-mix(in srgb, var(--text-primary) 8%, transparent);
          border-top-color: color-mix(in srgb, #fff 15%, transparent);
          background: color-mix(in srgb, var(--surface-solid) 15%, transparent);
          backdrop-filter: blur(10px) saturate(120%);
          -webkit-backdrop-filter: blur(10px) saturate(120%);
          box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent);
          transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .menu-icon-layer {
          opacity: 0.75;
          transition: opacity 0.25s ease;
        }

        .profile-menu-item:hover {
          background: color-mix(in srgb, var(--primary) 18%, transparent);
          border-color: color-mix(in srgb, var(--primary) 35%, transparent);
          border-top-color: color-mix(in srgb, #fff 30%, transparent);
          transform: translateY(-0.5px);
          box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 20%, transparent), 0 6px 16px -4px color-mix(in srgb, var(--primary) 20%, transparent);
        }

        .profile-menu-item:hover .menu-icon-layer {
          opacity: 1;
        }

        .profile-divider {
          height: 1px;
          margin: 4px 6px;
          background: color-mix(in srgb, var(--text-primary) 8%, transparent);
          box-shadow: 0 0.5px 0 color-mix(in srgb, #fff 10%, transparent);
        }

        .profile-menu-item.danger-item {
          color: var(--danger);
          border-color: color-mix(in srgb, var(--danger) 10%, transparent);
        }

        .profile-menu-item.danger-item:hover {
          background: color-mix(in srgb, var(--danger) 15%, transparent);
          border-color: color-mix(in srgb, var(--danger) 40%, transparent);
          border-top-color: color-mix(in srgb, #fff 25%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 15%, transparent), 0 6px 16px -4px color-mix(in srgb, var(--danger) 20%, transparent);
        }

        /* Animations */
        @keyframes popDown {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (min-width: 1024px) {
          .solexa-header { min-height: 68px; padding: 10px 28px; gap: 18px; background: transparent !important; border-bottom: 0 !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
          .header-left { min-width: 168px; gap: 10px; }
          .greeting-label { font-size: 8.5px; }
          .header-page-title { font-size: 14px; }
          .header-search-wrap { display: flex; flex: 0 0 360px; width: 360px; max-width: 360px; margin: 0 10px 0 auto; }
          .search-input { height: 36px; border-radius: 11px; font-size: 10.5px; }
          .search-leading-icon { left: 12px; width: 14px; height: 14px; }
          .search-kbd-pill { right: 9px; font-size: 8px; }
          .header-actions { gap: 12px; }
          .branch-switcher-wrapper { display: block; }
          .branch-trigger-btn { width: 30px; height: 36px; justify-content: center; padding: 0; border-color: transparent; background: transparent; }
          .branch-name, .branch-trigger-btn .chevron-arrow { display: none; }
          .theme-switch { display: flex !important; align-items: center; justify-content: center; width: 118px; height: 38px; gap: 2px; flex-direction: row; padding: 3px; border: 1px solid var(--line); border-radius: 12px; background: var(--brand-soft); color: var(--ink); }
          .theme-option { display: flex; align-items: center; justify-content: center; gap: 5px; width: 50%; height: 30px; border-radius: 9px; opacity: .62; font-size: 10px; }
          .theme-switch:hover { background: var(--brand-soft); color: var(--brand); }
          .theme-option.is-active { opacity: 1; color: var(--ink); background: var(--paper); box-shadow: 0 1px 3px var(--card-shadow); }
          .quick-action-wrapper { display: block; }
          .quick-action-trigger-btn { width: auto; height: 36px; justify-content: center; padding: 0 12px; border-radius: 11px; background: var(--brand-soft); color: var(--brand); }
          .quick-action-text { display: inline; font-size: 10.5px; }
          .user-avatar-btn { width: 36px; height: 36px; border-radius: 12px; font-size: 11px; }
        }

        /* App-shell specification overrides */
        .solexa-header {
          min-height: 68px;
          padding: 10px 16px;
          background: transparent !important;
          border-bottom: 0 !important;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          transition: background .22s ease, border-color .22s ease, box-shadow .22s ease;
        }
        .greeting-label { font-size: 10px; color: var(--text); }
        .header-page-title { font-size: 12px; letter-spacing: -0.025em; }
        .header-search-wrap { max-width: none; margin-left: auto; }
        .search-input {
          height: 36px;
          border: 0;
          border-radius: 12px;
          background: var(--surface-soft, var(--hdr-soft));
          font-size: 11px;
        }
        .search-kbd-pill { font-size: 6px; }
        .header-actions { gap: 8px; }
        .header-actions > .dropdown-anchor:has(.notif-badge) { display: block; }
        .action-icon-btn { width: 36px; height: 36px; border-radius: 12px; }
        .notif-badge { min-width: 14px; height: 14px; padding: 0 3px; font-size: 6px; }
        .quick-action-trigger-btn { height: 36px; border-radius: 12px; font-size: 10px; }
        .quick-action-text { font-size: 10px; }
        .user-avatar-btn { width: 32px; height: 32px; border-radius: 9999px; font-size: 7px; font-weight: 700; }
        @media (min-width: 768px) {
          .solexa-header { padding-left: 20px; padding-right: 20px; }
          .header-search-wrap { flex: 0 1 260px; width: 260px; }
        }
        @media (min-width: 1024px) {
          .solexa-header { min-height: 74px; padding: 10px 20px; gap: 16px; }
          .header-page-title { font-size: 14px; }
          .header-search-wrap { flex: 0 1 310px; width: 310px; max-width: 310px; margin: 0 auto; }
          .search-input { font-size: 11px; }
          .user-avatar-btn { width: 32px; height: 32px; }
        }
        @media (min-width: 1280px) {
          .header-search-wrap { flex-basis: 360px; width: 360px; max-width: 360px; }
        }
        @media (min-width: 1024px) {
          /* Keep Light/Dark as a real segmented toggle; do not let the icon-button sizing collapse it. */
          .header-actions .theme-switch {
            display: flex !important;
            align-items: center;
            justify-content: center;
            width: 118px !important;
            min-height: 32px;
            height: 32px !important;
            gap: 2px;
            flex-direction: row;
            padding: 2px;
            border: 0;
            border-radius: 12px;
            background: var(--surface-soft);
            color: var(--text);
          }
          .header-actions .theme-switch .theme-option {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            width: 50%;
            height: 28px;
            min-width: 0;
            white-space: nowrap;
            border-radius: 9px;
            border: 0;
            background: transparent;
            color: var(--text-muted);
            cursor: pointer;
            opacity: 1;
            font-size: 9px;
            font-weight: 700;
            transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
          }
          .header-actions .theme-switch .theme-option.is-active {
            color: var(--primary);
            background: var(--surface-solid);
            box-shadow: var(--shadow-tiny);
          }
        }
      `}</style>
    </>
  );
}

export default OsHeader;

