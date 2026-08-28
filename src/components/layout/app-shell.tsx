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
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>
            <strong>{t("brand.name")}</strong>
            <small>{t("brand.tagline")}</small>
          </span>
        </Link>

        <div className="header-actions">
          <nav aria-label={t("navigation.ariaLabel")} className="primary-nav">
            <Link href="/">{t("navigation.overview")}</Link>
            <Link href="/sources">{t("navigation.sources")}</Link>
            <Link href="/upload">{t("navigation.upload")}</Link>
            <Link href="/#foundation">{t("navigation.foundation")}</Link>
          </nav>
          <LanguageSelector />
        </div>
      </header>

      {children}

      <footer className="site-footer">
        <span>{t("brand.name")}</span>
        <span>{t("footer.status")}</span>
      </footer>
    </div>
  );
}
