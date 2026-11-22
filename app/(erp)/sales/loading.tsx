import { StandardTablePageSkeleton } from "../../../components/erp/page-skeletons";

export default function SalesLoading() {
  return <StandardTablePageSkeleton hasEyebrow={false} hasSubtitle={false} actions={1} kpiCount={4} cols={7} rows={6} />;
}
