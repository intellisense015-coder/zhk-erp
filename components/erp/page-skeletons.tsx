import { Skeleton, TableSkeletonRows } from "../primitives/skeleton";

function PageHeadingSkeleton({
  hasEyebrow = true,
  hasSubtitle = true,
  actions = 0,
}: {
  hasEyebrow?: boolean;
  hasSubtitle?: boolean;
  actions?: number;
}) {
  return (
    <div className="erp-page-heading">
      <div>
        {hasEyebrow && <Skeleton className="mb-2 h-2.5 w-28 rounded-md" />}
        <Skeleton className="h-8 w-44 rounded-xl" />
        {hasSubtitle && <Skeleton className="mt-2 h-3.5 w-64 max-w-full rounded-md" />}
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28 rounded-[15px]" />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCardSkeleton({ dashboard = false }: { dashboard?: boolean }) {
  return (
    <div className={`kpi-card ${dashboard ? "kpi-card-dashboard" : "kpi-card-module"}`}>
      <div className="kpi-card-top">
        <Skeleton className="h-3 w-20" />
        <Skeleton className={`${dashboard ? "h-8 w-8 rounded-[12px]" : "h-9 w-9 rounded-[14px]"}`} />
      </div>
      <Skeleton className="mt-4 h-6 w-24" />
      <Skeleton className="mt-2 h-2.5 w-32" />
    </div>
  );
}

function KpiGridSkeleton({
  count = 4,
  gridClass = "kpi-grid inventory-kpis inventory-kpis-four mb-[18px]",
  dashboard = false,
}: {
  count?: number;
  gridClass?: string;
  dashboard?: boolean;
}) {
  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, index) => (
        <KpiCardSkeleton key={index} dashboard={dashboard} />
      ))}
    </div>
  );
}

function SearchBarSkeleton() {
  return (
    <div className="inventory-search-bar" aria-hidden="true">
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-3.5 w-48 max-w-full rounded-md" />
    </div>
  );
}

function TableCardSkeleton({
  cols = 6,
  rows = 6,
  hasHeader = true,
  hasToolbarSearch = false,
}: {
  cols?: number;
  rows?: number;
  hasHeader?: boolean;
  hasToolbarSearch?: boolean;
}) {
  return (
    <section className="erp-card" aria-busy="true" aria-label="Loading table">
      {hasHeader && (
        <div className="erp-card-header">
          <div>
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="mt-2 h-3 w-56 max-w-full rounded-md" />
          </div>
          <Skeleton className="h-5 w-5 rounded-md" />
        </div>
      )}
      <div className="w-full soft-card solexa-table-root">
        {hasToolbarSearch && (
          <div className="solexa-table-toolbar">
            <div className="solexa-table-search">
              <Skeleton className="h-3.5 w-44 rounded-md" />
            </div>
          </div>
        )}
        <div className="solexa-table-frame mt-4">
          <div className="hide-scrollbar overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="solexa-table-head">
                  {Array.from({ length: cols }).map((_, index) => (
                    <th key={index} className="px-4 py-3">
                      <Skeleton className="h-3 w-16 rounded-md" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <TableSkeletonRows rows={rows} cols={cols} />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="erp-content dashboard-page" aria-busy="true" aria-label="Loading dashboard">
      <div className="dashboard-layout">
        <div className="dashboard-primary">
          <KpiGridSkeleton count={5} gridClass="kpi-grid erp-dashboard-kpis" dashboard />
          <div className="dashboard-main-grid">
            <section className="erp-card dashboard-activity-card">
              <div className="dashboard-activity-table-wrap">
                <table className="dashboard-activity-table dashboard-payment-table">
                  <thead>
                    <tr>
                      <th><Skeleton className="h-3 w-16 rounded-md" /></th>
                      <th><Skeleton className="h-3 w-12 rounded-md" /></th>
                      <th><Skeleton className="h-3 w-20 rounded-md" /></th>
                      <th className="text-right"><Skeleton className="ml-auto h-3 w-14 rounded-md" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    <TableSkeletonRows rows={6} cols={4} />
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
        <aside className="soft-card dashboard-low-stock-card">
          <div className="dashboard-low-stock-header">
            <div>
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="mt-2 h-2.5 w-36 rounded-md" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="dashboard-low-stock-list space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3 w-28 rounded-md" />
                  <Skeleton className="mt-1.5 h-2.5 w-16 rounded-md" />
                </div>
                <Skeleton className="h-3 w-12 rounded-md" />
              </div>
            ))}
          </div>
          <Skeleton className="dashboard-low-stock-action mt-5 h-10 w-full rounded-[15px]" />
        </aside>
      </div>
    </div>
  );
}

export function StandardTablePageSkeleton({
  hasEyebrow = true,
  hasSubtitle = true,
  actions = 1,
  kpiCount = 4,
  kpiGridClass = "kpi-grid inventory-kpis inventory-kpis-four mb-[18px]",
  hasSearch = true,
  cols = 6,
  rows = 6,
}: {
  hasEyebrow?: boolean;
  hasSubtitle?: boolean;
  actions?: number;
  kpiCount?: number;
  kpiGridClass?: string;
  hasSearch?: boolean;
  cols?: number;
  rows?: number;
}) {
  return (
    <div className="erp-content" aria-busy="true" aria-label="Loading page">
      <PageHeadingSkeleton hasEyebrow={hasEyebrow} hasSubtitle={hasSubtitle} actions={actions} />
      {kpiCount > 0 && <KpiGridSkeleton count={kpiCount} gridClass={kpiGridClass} />}
      {hasSearch && <SearchBarSkeleton />}
      <TableCardSkeleton cols={cols} rows={rows} />
    </div>
  );
}

export function PosProductGridSkeleton() {
  return (
    <div className="pos-product-grid" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: 6 }).map((_, index) => (
        <article key={index} className="pos-product-card">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="pos-product-copy mt-2 space-y-2">
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          <Skeleton className="mt-3 h-9 w-full rounded-xl" />
        </article>
      ))}
    </div>
  );
}

export function PosPageSkeleton() {
  return (
    <div className="erp-content pos-page" aria-busy="true" aria-label="Loading Point of Sale">
      <PageHeadingSkeleton hasEyebrow hasSubtitle actions={0} />
      <div className="pos-mode-search-row">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </div>
      <div className="pos-layout">
        <section className="pos-catalog-panel">
          <div className="pos-catalog-toolbar">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-24 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-10 w-60 max-w-full rounded-xl" />
          </div>
          <PosProductGridSkeleton />
        </section>
      </div>
      <aside className="pos-order-panel soft-card dashboard-low-stock-card">
        <div className="pos-order-header">
          <div>
            <Skeleton className="h-2.5 w-24 rounded-md" />
            <Skeleton className="mt-2 h-5 w-28 rounded-md" />
          </div>
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
        <Skeleton className="mt-6 h-11 w-full rounded-2xl" />
      </aside>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="erp-content" aria-busy="true" aria-label="Loading settings">
      <PageHeadingSkeleton hasEyebrow hasSubtitle actions={0} />
      <section className="erp-card settings-profile-card settings-minimal-card">
        <div className="settings-card-heading">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div>
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="mt-2 h-3 w-56 max-w-full rounded-md" />
          </div>
          <Skeleton className="settings-edit-button h-10 w-28 rounded-xl" />
        </div>
        <div className="settings-profile-summary settings-profile-summary-clean">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="settings-profile-row">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-2.5 w-24 rounded-md" />
                <Skeleton className="mt-2 h-3.5 w-40 rounded-md" />
              </div>
            </div>
          ))}
        </div>
        <div className="settings-theme-row">
          <div className="settings-theme-copy">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div>
              <Skeleton className="h-2.5 w-20 rounded-md" />
              <Skeleton className="mt-2 h-3.5 w-24 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      </section>
    </div>
  );
}

export function UsersPageSkeleton() {
  return (
    <div className="erp-content" aria-busy="true" aria-label="Loading users and permissions">
      <PageHeadingSkeleton hasEyebrow hasSubtitle actions={1} />
      <div className="grid grid-cols-1 gap-4 mb-[18px] sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="erp-card flex items-center gap-3 p-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="mt-2 h-5 w-12 rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <TableCardSkeleton cols={5} rows={4} />
    </div>
  );
}
