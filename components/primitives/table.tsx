"use client";

import { useMemo, useState, type ReactNode } from "react";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { TableSkeletonRows } from "./skeleton";
import { useErpStore } from "../../lib/erp-store";

export type SortDirection = "asc" | "desc" | null;
export type TableColumn<T> = { key: string; header: string; accessor?: (row: T) => ReactNode; sortable?: boolean; align?: "left" | "center" | "right"; className?: string; width?: string };
type DataTableProps<T extends object> = { columns: TableColumn<T>[]; data: T[]; keyExtractor: (row: T) => string; searchable?: boolean; searchPlaceholder?: string; searchKeys?: (keyof T)[]; onRowClick?: (row: T) => void; rowClassName?: (row: T) => string; loading?: boolean; emptyText?: string; actions?: ReactNode; initialPageSize?: number; pageSizeOptions?: number[]; paginationOnly?: boolean; className?: string };
type ServerPagination = { page: number; pageSize: number; total: number; pageSizeOptions?: number[]; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void };
type TableColumnMeta<T extends object> = { source: TableColumn<T> };
const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");
const numericColumnKeys = new Set(["amount", "costPrice", "inStockQuantity", "outstanding", "profit", "purchased", "purchaseCount", "quantity", "salesCount", "sellingPrice", "sold", "totalPurchased", "totalSoldCost", "totalSpent", "unitsSold"]);
const getColumnAlign = <T extends object>(column: TableColumn<T>) => column.align ?? (numericColumnKeys.has(column.key) ? "right" : "left");

export function DataTable<T extends object>({ columns, data, keyExtractor, searchable = true, searchPlaceholder = "Search records...", searchKeys, onRowClick, rowClassName, loading = false, emptyText = "No records found.", actions, initialPageSize = 10, pageSizeOptions = [5, 10, 20, 50], paginationOnly = false, className, serverPagination }: DataTableProps<T> & { serverPagination?: ServerPagination }) {
  const { hydrated } = useErpStore();
  const tableLoading = loading || !hydrated;
  const [searchQuery, setSearchQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.trim().toLowerCase();
    return data.filter((row) => searchKeys?.length ? searchKeys.some((key) => String((row as Record<keyof T, unknown>)[key] ?? "").toLowerCase().includes(query)) : Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [data, searchQuery, searchKeys]);
  const tableColumns = useMemo<ColumnDef<T, unknown>[]>(() => columns.map((column) => ({
    id: column.key,
    accessorFn: (row) => (row as Record<string, unknown>)[column.key],
    enableSorting: Boolean(column.sortable && !serverPagination),
    meta: { source: column } satisfies TableColumnMeta<T>,
    cell: ({ row }) => column.accessor ? column.accessor(row.original) : String((row.original as Record<string, unknown>)[column.key] ?? "—"),
  })), [columns, serverPagination]);
  const table = useReactTable({
    data: filteredData,
    columns: tableColumns,
    getRowId: keyExtractor,
    state: {
      sorting,
      pagination: { pageIndex: currentPage - 1, pageSize: serverPagination?.pageSize ?? pageSize },
    },
    onSortingChange: setSorting,
    manualPagination: Boolean(serverPagination),
    pageCount: serverPagination ? Math.ceil(serverPagination.total / serverPagination.pageSize) || 1 : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const displayedPage = serverPagination?.page ?? currentPage;
  const displayedPageSize = serverPagination?.pageSize ?? pageSize;
  const displayedTotal = serverPagination?.total ?? table.getPrePaginationRowModel().rows.length;
  const displayedTotalPages = Math.ceil(displayedTotal / displayedPageSize) || 1;
  const displayedPageSizeOptions = serverPagination?.pageSizeOptions ?? pageSizeOptions;

  return <div className={cx("w-full soft-card solexa-table-root", className)}>
    {(searchable || actions) && <div className="solexa-table-toolbar">{searchable && <label className="solexa-table-search"><Search size={15} className="pointer-events-none text-[var(--text-muted)]" /><input type="text" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />{searchQuery && <button type="button" onClick={() => { setSearchQuery(""); setCurrentPage(1); }} aria-label="Clear search"><X size={13} /></button>}</label>}{actions && <div className="solexa-table-actions">{actions}</div>}</div>}
    <div className="solexa-table-frame mt-4"><div className="hide-scrollbar overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left"><colgroup>{columns.map((column) => <col key={column.key} style={{ width: column.width ?? `${100 / columns.length}%` }} />)}</colgroup><thead><tr className="solexa-table-head">{table.getHeaderGroups().flatMap((headerGroup) => headerGroup.headers).map((header) => { const column = (header.column.columnDef.meta as TableColumnMeta<T> | undefined)?.source; if (!column) return null; const align = getColumnAlign(column); return <th key={header.id} onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined} style={{ width: column.width }} aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : "none"} className={cx("select-none px-4 py-3", header.column.getCanSort() && "cursor-pointer", align === "center" && "text-center", align === "right" && "text-right", column.className)}><span className={cx("inline-flex items-center gap-1.5", align === "center" && "justify-center", align === "right" && "justify-end")}>{column.header}</span></th>; })}</tr></thead><tbody>{tableLoading ? <TableSkeletonRows rows={displayedPageSize} cols={columns.length} /> : table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map((row) => <tr key={row.id} onClick={() => onRowClick?.(row.original)} className={cx("solexa-table-row", onRowClick && "cursor-pointer", rowClassName?.(row.original))}>{row.getVisibleCells().map((cell) => { const column = (cell.column.columnDef.meta as TableColumnMeta<T> | undefined)?.source; if (!column) return null; const align = getColumnAlign(column); return <td key={cell.id} className={cx("px-4 py-3", align === "center" && "text-center", align === "right" && "text-right", column.className)}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>; })}</tr>) : <tr><td colSpan={table.getAllLeafColumns().length} className="solexa-table-empty">{emptyText}</td></tr>}</tbody></table></div><div className={cx("solexa-table-pagination", paginationOnly && "pagination-only")}><div className={cx("flex items-center gap-3", paginationOnly && "hidden")}><span>Showing <b>{displayedTotal === 0 ? 0 : (displayedPage - 1) * displayedPageSize + 1}</b> to <b>{Math.min(displayedPage * displayedPageSize, displayedTotal)}</b> of <b>{displayedTotal}</b> entries</span><label className="flex items-center gap-1.5">Rows:<select value={displayedPageSize} onChange={(event) => { const nextPageSize = Number(event.target.value); if (serverPagination) serverPagination.onPageSizeChange(nextPageSize); else { setPageSize(nextPageSize); setCurrentPage(1); } }} aria-label="Rows per page">{displayedPageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div><div className={cx("flex items-center gap-1", paginationOnly && "pagination-controls")}><button type="button" onClick={() => serverPagination ? serverPagination.onPageChange(Math.max(1, displayedPage - 1)) : setCurrentPage((page) => Math.max(1, page - 1))} disabled={displayedPage === 1} aria-label="Previous page"><ChevronLeft size={14} /></button><span>Page {displayedPage} of {displayedTotalPages}</span><button type="button" onClick={() => serverPagination ? serverPagination.onPageChange(Math.min(displayedTotalPages, displayedPage + 1)) : setCurrentPage((page) => Math.min(displayedTotalPages, page + 1))} disabled={displayedPage === displayedTotalPages} aria-label="Next page"><ChevronRight size={14} /></button></div></div></div>
  </div>;
}

export type StatusTone = "success" | "warning" | "danger" | "brand" | "neutral";
export function TableBadge({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) { const styles: Record<StatusTone, string> = { success: "bg-[var(--success-glow)] text-[var(--success)]", warning: "bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]", danger: "bg-[var(--error-glow)] text-[var(--error)]", brand: "bg-[var(--primary-soft)] text-[var(--primary)]", neutral: "bg-[var(--surface-soft)] text-[var(--text-muted)]" }; return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-tight", styles[tone])}>{children}</span>; }
export function AvatarCell({ name, subtitle, initials }: { name: string; subtitle?: string; initials?: string }) { const avatarText = initials || name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(); return <div className="flex items-center gap-2.5"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[10px] font-bold text-[var(--primary)]">{avatarText}</div><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-primary)]">{name}</p>{subtitle && <p className="truncate text-[10px] text-[var(--text-muted)]">{subtitle}</p>}</div></div>; }
