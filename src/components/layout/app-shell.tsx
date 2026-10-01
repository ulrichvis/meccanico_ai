"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { LanguageSelector } from "@/components/i18n/language-selector";
import { useLanguage } from "@/components/i18n/language-provider";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-actions">
          <nav aria-label={t("navigation.ariaLabel")} className="primary-nav">
            <Link href="/sources">{t("navigation.sources")}</Link>
            <Link href="/cases">{t("navigation.cases")}</Link>
            <Link href="/upload">{t("navigation.upload")}</Link>
          </nav>
          <LanguageSelector />
        </div>
      </header>

      {children}
    </div>
  );
}
