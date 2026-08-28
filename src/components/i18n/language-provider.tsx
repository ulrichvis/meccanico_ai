"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  LANGUAGE_STORAGE_KEY,
  detectBrowserLocale,
  isLocale,
  type Locale,
} from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";
import { translate, type MessageKey } from "@/i18n/translator";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (
    key: MessageKey,
    values?: Record<string, string | number>,
  ) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const languageListeners = new Set<() => void>();
let volatileLocale: Locale | null = null;

function getClientLocale(): Locale {
  try {
    const storedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (isLocale(storedLocale)) {
      return storedLocale;
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  if (volatileLocale) {
    return volatileLocale;
  }

  return detectBrowserLocale(window.navigator.languages);
}

function subscribeToLanguageChange(listener: () => void) {
  function handleStorageChange(event: StorageEvent) {
    if (event.key === LANGUAGE_STORAGE_KEY) {
      volatileLocale = isLocale(event.newValue) ? event.newValue : null;
      listener();
    }
  }

  languageListeners.add(listener);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    languageListeners.delete(listener);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function updateClientLocale(locale: Locale) {
  volatileLocale = locale;

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  } catch {
    // The current tab can still update even without persistent storage.
  }

  for (const listener of languageListeners) {
    listener();
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLanguageChange,
    getClientLocale,
    () => DEFAULT_LOCALE,
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    updateClientLocale(nextLocale);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, values) => translate(dictionaries[locale], key, values),
    }),
    [locale, setLocale],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }

  return context;
}
