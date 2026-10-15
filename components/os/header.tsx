"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Search,
  GitBranch,
  ChevronDown,
  ChevronRight,
  UserRound,
  Settings2,
  LogOut,
  Sun,
  Moon,
  Menu,
  Check,
  LayoutDashboard,
  LucideIcon,
  ShoppingCart,
  Truck,
  Users,
  Building2,
} from "lucide-react";
import { formatCurrency, formatTransactionTime } from "../../lib/erp-data";
import { useErpStore } from "../../lib/erp-store";

// ==========================================
// Types
// ==========================================

export interface BranchItem {
  id: string;
  name: string;
  city?: string;
}

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
  branches?: BranchItem[];
  selectedBranchId?: string;
  onBranchChange?: (branchId: string) => void;
  onOpenMobileMenu?: () => void;
  onNavigate?: (href: string) => void;
  onSignOut?: () => void;
}

type OpenDropdown = "branch" | "profile" | null;

// ==========================================
// Default Mock Data
// ==========================================

const DEFAULT_BRANCHES: BranchItem[] = [];

const DEFAULT_SEARCH_MODULES: SearchResultItem[] = [
  { label: "Dashboard", href: "/dashboard", category: "Dasgboard", icon: LayoutDashboard },
  { label: "Inventory", href: "/inventory", category: "Trading", icon: Boxes },
  { label: "Sales", href: "/sales", category: "Trading", icon: ShoppingCart },
  { label: "Purchases", href: "/purchases", category: "Trading", icon: Truck },
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
  branches = DEFAULT_BRANCHES,
  selectedBranchId = "",
  onBranchChange,
  onOpenMobileMenu,
  onNavigate,
  onSignOut,
}: DashboardHeaderProps) {
  const { products, transactions, customers, suppliers } = useErpStore();
  const [activeBranchId, setActiveBranchId] = useState(selectedBranchId);
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => typeof document !== "undefined" && (document.documentElement.classList.contains("dark") || document.documentElement.getAttribute("data-theme") === "dark"));

  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleTheme = () => {
    const nextState = !isDarkMode;
    setIsDarkMode(nextState);
    if (nextState) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      window.localStorage.setItem("solexa-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      window.localStorage.setItem("solexa-theme", "light");
    }
    window.dispatchEvent(new CustomEvent("solexa-theme-change", { detail: nextState ? "dark" : "light" }));
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

  const handleBranchSelect = (id: string) => {
    setActiveBranchId(id);
    setOpenDropdown(null);
    onBranchChange?.(id);
  };

  const searchableRecords: SearchResultItem[] = [
    ...products.map((product) => ({ label: product.name, href: "/inventory", category: `Inventory · ${product.category}`, description: `${product.sku} · ${formatCurrency(product.costPrice)} cost · ${formatCurrency(product.sellingPrice)} sale · ${product.inStockQuantity} in stock`, icon: Boxes })),
    ...customers.map((customer) => ({ label: customer.name, href: "/customers", category: "Customers", description: `${customer.code} · ${customer.contactNumber}`, icon: Users })),
    ...suppliers.map((supplier) => ({ label: supplier.name, href: "/suppliers", category: "Suppliers", description: `${supplier.company || "Supplier"} · ${supplier.contactNumber}`, icon: Building2 })),
    ...transactions.map((transaction) => ({ label: `${transaction.type === "sale" ? "Sale" : transaction.type === "purchase" ? "Purchase" : "Transfer"} · ${transaction.party}`, href: transaction.type === "sale" ? "/sales" : transaction.type === "purchase" ? "/purchases" : "/transactions", category: "Activity", description: `${transaction.name} · ${formatCurrency(transaction.amount)} · ${formatTransactionTime(transaction)}`, icon: transaction.type === "sale" ? ShoppingCart : transaction.type === "purchase" ? Truck : ClipboardList })),
  ];
  const filteredSearchResults = [...DEFAULT_SEARCH_MODULES, ...searchableRecords].filter((item) =>
    `${item.label} ${item.category ?? ""} ${item.description ?? ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
  ).slice(0, 8);

  const filteredBranches = branches.filter((b) =>
    `${b.name} ${b.city || ""}`.toLowerCase().includes(branchSearch.toLowerCase())
  );

  const selectedBranch = branches.find((b) => b.id === activeBranchId);
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

        {/* Right: Theme, branch scope, and profile */}
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
          <button
            type="button"
            onClick={toggleTheme}
            className="action-icon-btn theme-switch"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
          >
            <span className={isDarkMode ? "theme-option" : "theme-option is-active"}><Sun size={13} /><span>Light</span></span>
            <span className={isDarkMode ? "theme-option is-active" : "theme-option"}><Moon size={13} /><span>Dark</span></span>
          </button>

          {/* Branch Switcher Popover */}
          <div className="dropdown-anchor branch-switcher-wrapper">
            <button
              type="button"
              onClick={() => toggleDropdown("branch")}
              className={`branch-trigger-btn ${openDropdown === "branch" ? "is-active" : ""}`}
              aria-label="Select store branch"
            >
              <GitBranch size={14} className="branch-icon" />
              <span className="branch-name">
                {selectedBranch ? selectedBranch.name : "All Branches"}
              </span>
              <ChevronDown
                size={12}
                className={`chevron-arrow ${openDropdown === "branch" ? "rotate" : ""}`}
              />
            </button>

            {openDropdown === "branch" && (
              <div className="header-dropdown-card branch-popover">
                <div className="dropdown-title-row">
                  <p className="dropdown-main-title">Store Branch Scope</p>
                  <p className="dropdown-desc">Filter records by shop or view company-wide.</p>
                </div>

                <div className="dropdown-search-box">
                  <Search size={13} className="dropdown-search-icon" />
                  <input
                    type="text"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder="Search locations..."
                    className="dropdown-input"
                    autoFocus
                  />
                </div>

                <div className="branch-options-list">
                  <button
                    type="button"
                    onClick={() => handleBranchSelect("")}
                    className={`branch-option-item ${!activeBranchId ? "selected" : ""}`}
                  >
                    <GitBranch size={14} />
                    <div className="branch-meta">
                      <span className="branch-opt-title">All Branches (Global)</span>
                      <span className="branch-opt-sub">Consolidated accounting</span>
                    </div>
                    {!activeBranchId && <Check size={14} className="opt-check" />}
                  </button>

                  {filteredBranches.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleBranchSelect(b.id)}
                      className={`branch-option-item ${activeBranchId === b.id ? "selected" : ""}`}
                    >
                      <GitBranch size={14} />
                      <div className="branch-meta">
                        <span className="branch-opt-title">{b.name}</span>
                        {b.city && <span className="branch-opt-sub">{b.city}</span>}
                      </div>
                      {activeBranchId === b.id && <Check size={14} className="opt-check" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                    <UserRound size={14} />
                    <span>Users & Permissions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onNavigate?.("/dashboard/settings");
                      setOpenDropdown(null);
                    }}
                    className="profile-menu-item"
                  >
                    <Settings2 size={14} />
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
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
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
          --hdr-bg: rgba(255, 255, 255, 0.85);
          --hdr-card: #ffffff;
          --hdr-soft: #f5f3ff;
          --hdr-soft-hover: #ede9fe;
          --hdr-border: #e2e8f0;
          --hdr-text: #1e1b4b;
          --hdr-muted: #64748b;
          --hdr-brand: #6657ee;
          --hdr-brand-soft: #eeecff;
          --hdr-brand-text: #ffffff;
          --hdr-danger: #ea6b78;
          --hdr-danger-soft: rgba(234, 107, 120, 0.12);
          --hdr-shadow: 0 16px 45px rgba(62, 54, 122, 0.08);
          --hdr-popover-shadow: 0 24px 60px rgba(45, 42, 78, 0.18);
          --hdr-radius: 18px;
          --hdr-transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .dark,
        html[data-theme="dark"] {
          --hdr-bg: rgba(26, 26, 34, 0.88);
          --hdr-card: #1f1f28;
          --hdr-soft: #272733;
          --hdr-soft-hover: #313140;
          --hdr-border: #2f2f3f;
          --hdr-text: #f8fafc;
          --hdr-muted: #94a3b8;
          --hdr-brand: #9b92ff;
          --hdr-brand-soft: rgba(155, 146, 255, 0.16);
          --hdr-brand-text: #0f0e17;
          --hdr-danger: #f07e89;
          --hdr-danger-soft: rgba(240, 126, 137, 0.16);
          --hdr-shadow: 0 16px 45px rgba(0, 0, 0, 0.4);
          --hdr-popover-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
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
          border: 1px solid var(--hdr-border);
          background: var(--hdr-soft);
          color: var(--hdr-text);
          font-size: 11.5px;
          outline: none;
          transition: all 0.2s ease;
        }

        .search-input:focus {
          border-color: var(--hdr-brand);
          background: var(--hdr-card);
          box-shadow: 0 0 0 3px var(--hdr-brand-soft);
        }

        .search-input::placeholder {
          color: var(--hdr-muted);
        }

        /* The light canvas is very pale, so give the header search its own
           readable surface and a clear focus/edge cue. */
        html:not([data-theme="dark"]) .search-input {
          background: var(--surface-solid);
          border-color: var(--input-border);
          box-shadow: 0 5px 16px rgba(62, 54, 122, 0.09);
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
          display: none;
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
          color: #ffffff;
          font-size: 9px;
          font-weight: 800;
          box-shadow: 0 2px 6px rgba(234, 107, 120, 0.4);
        }

        /* Branch Switcher Button */
        .dropdown-anchor {
          position: relative;
        }

        .branch-trigger-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 10px;
          border-radius: 12px;
          border: 1px solid var(--hdr-border);
          background: var(--hdr-soft);
          color: var(--hdr-text);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .branch-trigger-btn:hover,
        .branch-trigger-btn.is-active {
          background: var(--hdr-card);
          border-color: var(--hdr-brand);
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
          height: 36px;
          padding: 0 16px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: var(--brand-soft);
          color: var(--brand);
          font-size: 11.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .quick-action-trigger-btn:hover,
        .quick-action-trigger-btn.is-active {
          background: var(--brand);
          color: var(--on-brand);
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
          color: var(--on-brand);
          font-size: 11.5px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(102, 87, 238, 0.3);
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
          color: var(--on-brand);
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
          width: 220px;
          padding: 8px;
          background: var(--paper);
          border-color: var(--line);
          box-shadow: 0 24px 60px var(--card-shadow);
        }

        .profile-user-summary {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 12px;
          background: var(--brand-soft);
          margin-bottom: 6px;
        }

        .user-big-avatar {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: var(--brand);
          color: var(--on-brand);
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 500;
        }

        .user-details {
          display: flex;
          flex-direction: column;
        }

        .user-full-name {
          font-size: 11px;
          font-weight: 700;
          color: var(--ink);
        }

        .user-role-badge {
          font-size: 8.5px;
          color: var(--muted);
        }

        .profile-actions-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .profile-menu-item {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: 8px 10px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--ink);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
          text-align: left;
        }

        .profile-menu-item:hover {
          background: var(--brand-soft);
        }

        .profile-divider {
          height: 1px;
          background: var(--line);
          margin: 4px 0;
        }

        .profile-menu-item.danger-item {
          color: var(--danger);
        }

        .profile-menu-item.danger-item:hover {
          background: color-mix(in srgb, var(--danger) 12%, transparent);
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
            height: 38px !important;
            gap: 2px;
            flex-direction: row;
            padding: 3px;
            border: 1px solid var(--line);
            border-radius: 12px;
            background: var(--brand-soft);
            color: var(--ink);
          }
          .header-actions .theme-switch .theme-option {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            width: 50%;
            height: 30px;
            min-width: 0;
            white-space: nowrap;
            border-radius: 9px;
            opacity: .62;
            font-size: 10px;
          }
          .header-actions .theme-switch .theme-option.is-active {
            opacity: 1;
            color: var(--ink);
            background: var(--paper);
            box-shadow: 0 1px 3px var(--card-shadow);
          }
        }
      `}</style>
    </>
  );
}

export default OsHeader;

