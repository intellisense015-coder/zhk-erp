import { StandardTablePageSkeleton } from "../../../components/erp/page-skeletons";

export default function LowStockLoading() {
  return <StandardTablePageSkeleton hasEyebrow={false} hasSubtitle={false} actions={1} kpiCount={4} cols={6} rows={6} />;
}
