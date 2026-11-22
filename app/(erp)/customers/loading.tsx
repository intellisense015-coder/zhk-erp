import { StandardTablePageSkeleton } from "../../../components/erp/page-skeletons";

export default function CustomersLoading() {
  return <StandardTablePageSkeleton hasEyebrow={false} hasSubtitle={false} actions={2} kpiCount={4} cols={6} rows={6} />;
}
