import { StandardTablePageSkeleton } from "../../../components/erp/page-skeletons";

export default function CapitalLoading() {
  return <StandardTablePageSkeleton hasEyebrow hasSubtitle actions={2} kpiCount={4} hasSearch={false} cols={5} rows={6} />;
}
