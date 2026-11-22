import { StandardTablePageSkeleton } from "../../../components/erp/page-skeletons";

export default function PurchasesLoading() {
  return <StandardTablePageSkeleton hasEyebrow={false} hasSubtitle actions={2} kpiCount={4} kpiGridClass="erp-grid-4 mb-[18px]" cols={6} rows={6} />;
}
