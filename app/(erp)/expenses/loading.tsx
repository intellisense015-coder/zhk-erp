import { StandardTablePageSkeleton } from "../../../components/erp/page-skeletons";

export default function ExpensesLoading() {
  return <StandardTablePageSkeleton hasEyebrow hasSubtitle actions={3} kpiCount={4} cols={6} rows={6} />;
}
