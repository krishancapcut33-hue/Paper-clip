// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { readVisualViewportGeometry } from "./useMobileEntityPickerViewportStyle";

function stubVisualViewport(value: { height: number; offsetTop: number } | null) {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  Reflect.deleteProperty(window, "visualViewport");
});

describe("readVisualViewportGeometry", () => {
  it("returns the live height and keyboard pan offset", () => {
    stubVisualViewport({ height: 408, offsetTop: 120 });
    expect(readVisualViewportGeometry()).toEqual({ height: 408, offsetTop: 120 });
  });

  it("rejects the transient zero-height readings Safari emits mid-animation", () => {
    stubVisualViewport({ height: 0, offsetTop: 0 });
    expect(readVisualViewportGeometry()).toBeNull();
  });

  it("rejects an invalid pan offset rather than parking the sheet off-screen", () => {
    stubVisualViewport({ height: 408, offsetTop: Number.NaN });
    expect(readVisualViewportGeometry()).toBeNull();
    stubVisualViewport({ height: 408, offsetTop: -1 });
    expect(readVisualViewportGeometry()).toBeNull();
  });

  it("returns null when the browser has no visual viewport", () => {
    stubVisualViewport(null);
    expect(readVisualViewportGeometry()).toBeNull();
  });
});
