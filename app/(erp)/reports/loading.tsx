import { StandardTablePageSkeleton } from "../../../components/erp/page-skeletons";

export default function ReportsLoading() {
  return <StandardTablePageSkeleton hasEyebrow hasSubtitle actions={1} kpiCount={8} kpiGridClass="kpi-grid inventory-kpis reports-kpis mb-[18px]" cols={6} rows={6} />;
}
