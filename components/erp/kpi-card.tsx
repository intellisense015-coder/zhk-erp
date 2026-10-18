"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "../primitives/skeleton";
import { useErpStore } from "../../lib/erp-store";

export type KpiTone = "default" | "success" | "error";
export type KpiCardSize = "dashboard" | "module";

export interface KpiCardProps {
  label: string;
  value: string;
  note?: string;
  icon?: ReactNode;
  tone?: KpiTone;
  trend?: number;
  loading?: boolean;
  size?: KpiCardSize;
  onClick?: () => void;
}

export function KpiCard({
  label,
  value,
  note,
  icon,
  tone = "default",
  trend,
  loading = false,
  size = "module",
}: KpiCardProps) {
  const { hydrated } = useErpStore();
  const cardLoading = loading || !hydrated;
  const content = (
    <>
      <div className="kpi-card-top">
        {cardLoading ? <Skeleton className="h-3 w-20" /> : <p className="kpi-card-label">{label}</p>}
        {cardLoading ? <Skeleton className="h-8 w-8 rounded-[12px]" /> : icon && <span className="kpi-card-icon">{icon}</span>}
      </div>
      {cardLoading ? (
        <>
          <Skeleton className="mt-4 h-6 w-28" />
          <Skeleton className="mt-2 h-2.5 w-36" />
        </>
      ) : (
        <div className="kpi-card-value-row">
          <p className="kpi-card-value">{value}</p>
          {trend !== undefined && (
            <span className="kpi-card-trend">
              {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      )}
      {!cardLoading && note && <p className="kpi-card-note">{note}</p>}
    </>
  );

  const className = `kpi-card kpi-card-${size} kpi-card-${tone}`;
  return <div className={className}>{content}</div>;
}
