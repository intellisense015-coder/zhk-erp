import React from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <span aria-hidden="true" className={cn("soft-skeleton block rounded-[10px]", className)} {...props} />;
}

export function PinPageSkeleton() {
  return <div className="w-full max-w-[360px] animate-fade-in"><Skeleton className="h-8 w-48 rounded-xl" /><Skeleton className="mt-2 h-4 w-60 rounded-md" /><div className="mt-8 grid grid-cols-6 gap-2.5">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full rounded-2xl" />)}</div><div className="mt-6 flex justify-center"><Skeleton className="h-4 w-32 rounded-md" /></div></div>;
}

export function StatCardSkeleton() {
  return <div className="rounded-[24px] border border-white/5 bg-[#1e1e1e] p-4 sm:p-5"><div className="flex items-center justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-8 rounded-[12px]" /></div><Skeleton className="mt-4 h-6 w-28" /><Skeleton className="mt-2 h-2.5 w-36" /></div>;
}

export function TableSkeletonRows({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return <>{Array.from({ length: rows }).map((_, rowIndex) => <tr key={rowIndex} className="border-b border-white/5"><>{Array.from({ length: cols }).map((_, columnIndex) => <td key={columnIndex} className="px-4 py-3.5"><Skeleton className={columnIndex === 0 ? "h-3.5 w-28" : columnIndex === cols - 1 ? "h-6 w-14 rounded-full" : "h-3 w-16"} /></td>)}</></tr>)}</>;
}

export function ModalSkeleton() {
  return <div className="grid gap-3 p-5 sm:grid-cols-2"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-10 w-32 sm:col-span-2" /></div>;
}
