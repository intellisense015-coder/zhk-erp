"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { TableSkeletonRows } from "./skeleton";
import { useErpStore } from "../../lib/erp-store";

export type SortDirection = "asc" | "desc" | null;
export type TableColumn<T> = { key: string; header: string; accessor?: (row: T) => ReactNode; sortable?: boolean; align?: "left" | "center" | "right"; className?: string; width?: string };
type DataTableProps<T extends object> = { columns: TableColumn<T>[]; data: T[]; keyExtractor: (row: T) => string; searchable?: boolean; searchPlaceholder?: string; searchKeys?: (keyof T)[]; onRowClick?: (row: T) => void; rowClassName?: (row: T) => string; loading?: boolean; emptyText?: string; actions?: ReactNode; initialPageSize?: number; pageSizeOptions?: number[]; paginationOnly?: boolean; className?: string };
type ServerPagination = { page: number; pageSize: number; total: number; pageSizeOptions?: number[]; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void };
const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");
const numericColumnKeys = new Set(["amount", "costPrice", "inStockQuantity", "outstanding", "profit", "purchased", "purchaseCount", "quantity", "salesCount", "sellingPrice", "sold", "totalPurchased", "totalSoldCost", "totalSpent", "unitsSold"]);
const getColumnAlign = <T extends object>(column: TableColumn<T>) => column.align ?? (numericColumnKeys.has(column.key) ? "right" : "left");

export function DataTable<T extends object>({ columns, data, keyExtractor, searchable = true, searchPlaceholder = "Search records...", searchKeys, onRowClick, rowClassName, loading = false, emptyText = "No records found.", actions, initialPageSize = 10, pageSizeOptions = [5, 10, 20, 50], paginationOnly = false, className, serverPagination }: DataTableProps<T> & { serverPagination?: ServerPagination }) {
  const { hydrated } = useErpStore();
  const tableLoading = loading || !hydrated;
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.trim().toLowerCase();
    return data.filter((row) => searchKeys?.length ? searchKeys.some((key) => String((row as Record<keyof T, unknown>)[key] ?? "").toLowerCase().includes(query)) : Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [data, searchQuery, searchKeys]);
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aValue = (a as Record<string, unknown>)[sortKey];
      const bValue = (b as Record<string, unknown>)[sortKey];
      if (aValue === bValue) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      if (typeof aValue === "number" && typeof bValue === "number") return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();
      return sortDirection === "asc" ? aString.localeCompare(bString) : bString.localeCompare(aString);
    });
  }, [filteredData, sortKey, sortDirection]);
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [sortedData, currentPage, pageSize]);
  const displayedData = serverPagination ? data : paginatedData;
  const displayedPage = serverPagination?.page ?? currentPage;
  const displayedPageSize = serverPagination?.pageSize ?? pageSize;
  const displayedTotal = serverPagination?.total ?? sortedData.length;
  const displayedTotalPages = Math.ceil(displayedTotal / displayedPageSize) || 1;
  const displayedPageSizeOptions = serverPagination?.pageSizeOptions ?? pageSizeOptions;
  const handleSort = (key: string) => { if (sortKey !== key) { setSortKey(key); setSortDirection("asc"); } else if (sortDirection === "asc") setSortDirection("desc"); else { setSortKey(null); setSortDirection(null); } };

  return <div className={cx("w-full soft-card solexa-table-root", className)}>
    {(searchable || actions) && <div className="solexa-table-toolbar">{searchable && <label className="solexa-table-search"><Search size={15} className="pointer-events-none text-[var(--text-muted)]" /><input type="text" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />{searchQuery && <button type="button" onClick={() => { setSearchQuery(""); setCurrentPage(1); }} aria-label="Clear search"><X size={13} /></button>}</label>}{actions && <div className="solexa-table-actions">{actions}</div>}</div>}
    <div className="solexa-table-frame mt-4"><div className="hide-scrollbar overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left"><colgroup>{columns.map((column) => <col key={column.key} style={{ width: column.width ?? `${100 / columns.length}%` }} />)}</colgroup><thead><tr className="solexa-table-head">{columns.map((column) => { const align = getColumnAlign(column); return <th key={column.key} onClick={() => column.sortable && !serverPagination && handleSort(column.key)} style={{ width: column.width }} className={cx("select-none px-4 py-3", column.sortable && !serverPagination && "cursor-pointer", align === "center" && "text-center", align === "right" && "text-right", column.className)}><span className={cx("inline-flex items-center gap-1.5", align === "center" && "justify-center", align === "right" && "justify-end")}>{column.header}</span></th>; })}</tr></thead><tbody>{tableLoading ? <TableSkeletonRows rows={displayedPageSize} cols={columns.length} /> : displayedData.length > 0 ? displayedData.map((row) => <tr key={keyExtractor(row)} onClick={() => onRowClick?.(row)} className={cx("solexa-table-row", onRowClick && "cursor-pointer", rowClassName?.(row))}>{columns.map((column) => { const align = getColumnAlign(column); return <td key={column.key} className={cx("px-4 py-3", align === "center" && "text-center", align === "right" && "text-right", column.className)}>{column.accessor ? column.accessor(row) : String((row as Record<string, unknown>)[column.key] ?? "—")}</td>; })}</tr>) : <tr><td colSpan={columns.length} className="solexa-table-empty">{emptyText}</td></tr>}</tbody></table></div><div className={cx("solexa-table-pagination", paginationOnly && "pagination-only")}><div className={cx("flex items-center gap-3", paginationOnly && "hidden")}><span>Showing <b>{displayedTotal === 0 ? 0 : (displayedPage - 1) * displayedPageSize + 1}</b> to <b>{Math.min(displayedPage * displayedPageSize, displayedTotal)}</b> of <b>{displayedTotal}</b> entries</span><label className="flex items-center gap-1.5">Rows:<select value={displayedPageSize} onChange={(event) => { const nextPageSize = Number(event.target.value); if (serverPagination) serverPagination.onPageSizeChange(nextPageSize); else { setPageSize(nextPageSize); setCurrentPage(1); } }} aria-label="Rows per page">{displayedPageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div><div className={cx("flex items-center gap-1", paginationOnly && "pagination-controls")}><button type="button" onClick={() => serverPagination ? serverPagination.onPageChange(Math.max(1, displayedPage - 1)) : setCurrentPage((page) => Math.max(1, page - 1))} disabled={displayedPage === 1} aria-label="Previous page"><ChevronLeft size={14} /></button><span>Page {displayedPage} of {displayedTotalPages}</span><button type="button" onClick={() => serverPagination ? serverPagination.onPageChange(Math.min(displayedTotalPages, displayedPage + 1)) : setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={displayedPage === displayedTotalPages} aria-label="Next page"><ChevronRight size={14} /></button></div></div></div>
  </div>;
}

export type StatusTone = "success" | "warning" | "danger" | "brand" | "neutral";
export function TableBadge({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) { const styles: Record<StatusTone, string> = { success: "bg-[var(--success-glow)] text-[var(--success)]", warning: "bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]", danger: "bg-[var(--error-glow)] text-[var(--error)]", brand: "bg-[var(--primary-soft)] text-[var(--primary)]", neutral: "bg-[var(--surface-soft)] text-[var(--text-muted)]" }; return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-tight", styles[tone])}>{children}</span>; }
export function AvatarCell({ name, subtitle, initials }: { name: string; subtitle?: string; initials?: string }) { const avatarText = initials || name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(); return <div className="flex items-center gap-2.5"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[10px] font-bold text-[var(--primary)]">{avatarText}</div><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-primary)]">{name}</p>{subtitle && <p className="truncate text-[10px] text-[var(--text-muted)]">{subtitle}</p>}</div></div>; }
