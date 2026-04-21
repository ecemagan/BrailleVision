"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import en from "@/lib/locales/en.json";
import tr from "@/lib/locales/tr.json";

const LOCALE_STORAGE_KEY = "braillevision-locale";
const DEFAULT_LOCALE = "en";
const messages = { en, tr };

const I18nContext = createContext(null);

function readLocaleFromStorage() {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return storedLocale === "tr" || storedLocale === "en" ? storedLocale : DEFAULT_LOCALE;
}

function lookupMessage(source, path) {
  return path.split(".").reduce((current, segment) => (current && current[segment] !== undefined ? current[segment] : undefined), source);
}

function interpolate(template, values = {}) {
  if (typeof template !== "string") {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    const nextLocale = readLocaleFromStorage();
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }, [locale]);

  const value = useMemo(() => {
    function setLocale(nextLocale) {
      setLocaleState(nextLocale === "tr" ? "tr" : "en");
    }

    function t(key, variables) {
      const fallback = lookupMessage(messages[DEFAULT_LOCALE], key) ?? key;
      const template = lookupMessage(messages[locale], key) ?? fallback;
      return interpolate(template, variables);
    }

    return {
      locale,
      setLocale,
      t,
      isEnglish: locale === "en",
      isTurkish: locale === "tr",
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider.");
  }

  return context;
}
