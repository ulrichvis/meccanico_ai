"use client";

import type { ReactNode } from "react";

import { LanguageSelector } from "@/components/i18n/language-selector";
import { useLanguage } from "@/components/i18n/language-provider";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#overview">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span>
            <strong>{t("brand.name")}</strong>
            <small>{t("brand.tagline")}</small>
          </span>
        </a>

        <div className="header-actions">
          <nav aria-label={t("navigation.ariaLabel")} className="primary-nav">
            <a href="#overview">{t("navigation.overview")}</a>
            <a href="#foundation">{t("navigation.foundation")}</a>
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
