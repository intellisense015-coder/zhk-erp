import type { ReactNode } from "react";
import { ErpShell } from "../../components/erp/erp-shell";

// The ERP shell verifies the Supabase session/workspace and hydrates data on
// the client before rendering route content, so this section is not an
// instant-navigation segment under Next.js Cache Components.
export const instant = false;

export default function ErpLayout({ children }: { children: ReactNode }) {
  return <ErpShell>{children}</ErpShell>;
}
