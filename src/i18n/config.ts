export const SUPPORTED_LOCALES = ["en", "it"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LANGUAGE_STORAGE_KEY = "meccanico-ia-language";

export function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function detectBrowserLocale(languages: readonly string[]): Locale {
  const preferredLocale = languages
    .map((language) => language.toLowerCase().split("-")[0])
    .find(isLocale);

  return preferredLocale ?? DEFAULT_LOCALE;
}
