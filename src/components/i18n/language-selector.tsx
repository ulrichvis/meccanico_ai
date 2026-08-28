"use client";

import type { ChangeEvent } from "react";

import { isLocale } from "@/i18n/config";

import { useLanguage } from "./language-provider";

export function LanguageSelector() {
  const { locale, setLocale, t } = useLanguage();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;

    if (isLocale(nextLocale)) {
      setLocale(nextLocale);
    }
  }

  return (
    <label className="language-selector">
      <span className="sr-only">{t("language.selectorLabel")}</span>
      <select
        aria-label={t("language.selectorLabel")}
        className="language-select"
        onChange={handleChange}
        value={locale}
      >
        <option value="en">{t("language.english")}</option>
        <option value="it">{t("language.italian")}</option>
      </select>
    </label>
  );
}
