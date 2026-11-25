import type { Metadata } from "next";
import "./globals.css";
import { NumericInputGuard } from "../components/providers/numeric-input-guard";

export const metadata: Metadata = {
  title: "Solexa by Intellisense | Inventory ERP",
  description: "A modern inventory and sales workspace for gadget resellers.",
  icons: {
    icon: "/solexa-logo.png",
    shortcut: "/solexa-logo.png",
    apple: "/solexa-logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{localStorage.clear();}catch(e){}})();` }} /></head><body><NumericInputGuard />{children}</body></html>;
}
