// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { i18n, setLocale, useTranslation } from "@/i18n";
import en from "@/i18n/locales/en.json";
import ru from "@/i18n/locales/ru.json";
import { LocaleSwitcher } from "./LocaleSwitcher";

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => { result = callback(); });
  await result;
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  flushSync(() => {});
}

afterEach(async () => { await setLocale("en"); window.localStorage.clear(); });

it("updates translated content immediately and can return to English", async () => {
  await setLocale("en");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  function Example() {
    const { t } = useTranslation();
    return <><LocaleSwitcher /><h1>{t("auth.signInHeading")}</h1></>;
  }
  try {
    await act(async () => { root.render(<Example />); });
    expect(container.querySelector("h1")?.textContent).toBe(en.auth.signInHeading);
    const select = container.querySelector("select")!;
    expect(select.closest("label")?.textContent).toContain(en.localeSwitcher.language);
    await act(async () => {
      select.value = "ru";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(i18n.language).toBe("ru");
    expect(container.querySelector("h1")?.textContent).toBe(ru.auth.signInHeading);
    expect(select.closest("label")?.textContent).toContain(ru.localeSwitcher.language);
    expect(window.localStorage.getItem("paperclip.locale")).toBe("ru");
    await act(async () => { await setLocale("en"); });
    expect(container.querySelector("h1")?.textContent).toBe(en.auth.signInHeading);
  } finally {
    await act(async () => { root.unmount(); });
    container.remove();
  }
});
