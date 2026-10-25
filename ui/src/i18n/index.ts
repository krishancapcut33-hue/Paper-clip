import i18n, { type InitOptions, type TOptions } from "i18next";
import { initReactI18next, useTranslation as useReactI18nextTranslation } from "react-i18next";

import { DEFAULT_LOCALE, i18nextResources, supportedLocales } from "./locales";

export const LOCALE_STORAGE_KEY = "paperclip.locale";

function supportedLocale(language: string): string | undefined {
  const normalized = language.toLowerCase().replace(/_/g, "-");
  const exact = supportedLocales.find((locale) => locale.toLowerCase() === normalized);
  if (exact) return exact;
  const languageCode = normalized.split("-")[0];
  if (languageCode === "zh") {
    try {
      const script = new Intl.Locale(normalized).maximize().script;
      return script === "Hant" ? "zh-TW" : "zh-CN";
    } catch {
      return undefined;
    }
  }
  return supportedLocales.find((locale) => locale.toLowerCase() === languageCode);
}

function initialLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) {
      const locale = supportedLocale(stored);
      if (locale) return locale;
    }
  } catch {
  }
  const languages = window.navigator.languages?.length
    ? window.navigator.languages
    : [window.navigator.language];
  for (const language of languages) {
    const locale = supportedLocale(language);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

function syncDocumentLocale(locale: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = i18n.dir(locale);
}

i18n.on("languageChanged", syncDocumentLocale);

const i18nextOptions: InitOptions = {
  resources: i18nextResources,
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  returnObjects: false,
  initAsync: false,
};

void i18n.use(initReactI18next).init(i18nextOptions).catch((error: unknown) => {
  console.error("Failed to initialize i18next", error);
});

export function t(key: string, options: TOptions = {}) {
  return i18n.t(key, options);
}

export async function setLocale(locale: string): Promise<void> {
  if (!supportedLocales.includes(locale)) return;
  await i18n.changeLanguage(locale);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
  }
}

export const useTranslation = useReactI18nextTranslation;
export { i18n };
