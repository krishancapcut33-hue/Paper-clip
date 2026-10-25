// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

async function load(languages: string[], stored?: string) {
  vi.resetModules();
  Object.defineProperty(window.navigator, "languages", { configurable: true, value: languages });
  Object.defineProperty(window.navigator, "language", { configurable: true, value: languages[0] ?? "en" });
  if (stored) window.localStorage.setItem("paperclip.locale", stored);
  return import(".");
}

it("matches a regional browser preference to Russian", async () => {
  expect((await load(["ru-RU"])).i18n.language).toBe("ru");
});
it("uses the saved choice before browser preferences", async () => {
  expect((await load(["ru-RU"], "en")).i18n.language).toBe("en");
});
it("checks later browser preferences when the first is unsupported", async () => {
  expect((await load(["zz-ZZ", "ru-RU"])).i18n.language).toBe("ru");
});
it("ignores unsupported saved choices and defaults unsupported browsers to English", async () => {
  expect((await load(["zz-ZZ"], "unsupported")).i18n.language).toBe("en");
});
it("preserves region-specific supported locales", async () => {
  expect((await load(["pt-BR"])).i18n.language).toBe("pt-BR");
});
it("detects the browser language when persistent storage is blocked", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  expect((await load(["ru-RU"])).i18n.language).toBe("ru");
});
it("persists and restores a user choice", async () => {
  const runtime = await load(["en"]);
  await runtime.setLocale("ru");
  expect(window.localStorage.getItem(runtime.LOCALE_STORAGE_KEY)).toBe("ru");
  expect(document.documentElement.lang).toBe("ru");
  expect(document.documentElement.dir).toBe("ltr");
  vi.resetModules();
  expect((await import(".")).i18n.language).toBe("ru");
});
it("ignores unsupported language changes", async () => {
  const runtime = await load(["en"]);
  await runtime.setLocale("unsupported");
  expect(runtime.i18n.language).toBe("en");
  expect(window.localStorage.getItem(runtime.LOCALE_STORAGE_KEY)).toBeNull();
});
it("still changes language and direction when saving is blocked", async () => {
  const runtime = await load(["en"]);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  await runtime.setLocale("ar");
  expect(runtime.i18n.language).toBe("ar");
  expect(document.documentElement.dir).toBe("rtl");
});
it("uses English for a message missing in a selected locale", async () => {
  const runtime = await load(["fr"]);
  expect(runtime.t("auth.signInHeading")).toBe("Sign in to Paperclip");
});

it.each([
  ["zh-Hans", "zh-CN"],
  ["zh-Hant", "zh-TW"],
  ["zh-Hant-HK", "zh-TW"],
  ["zh-HK", "zh-TW"],
  ["zh", "zh-CN"],
])("matches Chinese preference %s to %s", async (preference, expected) => {
  expect((await load([preference])).i18n.language).toBe(expected);
});
