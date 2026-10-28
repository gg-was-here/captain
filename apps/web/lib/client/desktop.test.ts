import { describe, expect, it } from "vitest";
import { desktopErrorText } from "./desktop";

describe("desktopErrorText", () => {
  it("drops the prefix Electron adds to errors from the Mac app", () => {
    expect(desktopErrorText(new Error("Error invoking remote method 'apps:remove': Error: Disk full"))).toBe("Disk full");
    expect(desktopErrorText(new Error("Error invoking remote method 'space:open': TypeError: bad bounds"))).toBe("bad bounds");
    expect(desktopErrorText(new Error("Plain"))).toBe("Plain");
  });
});
