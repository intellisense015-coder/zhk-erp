import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
  return <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("solexa-theme");if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.setAttribute("data-theme","dark");}}catch(e){}})();` }} /></head><body>{children}</body></html>;
}
