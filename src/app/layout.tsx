import type { Metadata } from "next";
import type { ReactNode } from "react";

import { LanguageProvider } from "@/components/i18n/language-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Meccanico IA",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
