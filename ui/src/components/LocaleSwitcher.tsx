import { setLocale, useTranslation } from "@/i18n";
import { supportedLocales } from "@/i18n/locales";

const localeNames = supportedLocales.map((locale) => ({
  value: locale,
  label: new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale,
}));

export function LocaleSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <label className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-(length:--text-compact) font-medium text-foreground">
      <span className="min-w-0 truncate">{t("localeSwitcher.language")}</span>
      <select
        className="max-w-32 rounded-md border border-border bg-background px-2 py-1 text-xs"
        value={i18n.resolvedLanguage ?? i18n.language}
        onChange={(event) => { void setLocale(event.target.value); }}
      >
        {localeNames.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );
}
