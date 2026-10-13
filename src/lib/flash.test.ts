import { describe, expect, it } from "vitest";
import { flashForOtpType, isFlashKey, withFlash } from "./flash";

describe("flash messages across a redirect", () => {
  it("accepts only known keys (the param is user-controlled)", () => {
    expect(isFlashKey("passwordUpdated")).toBe(true);
    expect(isFlashKey("emailConfirmed")).toBe(true);
    expect(isFlashKey("<script>")).toBe(false);
    expect(isFlashKey(null)).toBe(false);
  });

  it("welcomes a confirmed sign-up", () => {
    expect(flashForOtpType("signup")).toBe("emailConfirmed");
    expect(flashForOtpType("email")).toBe("emailConfirmed");
  });

  it("does not welcome an email change (half-done until both links are opened)", () => {
    expect(flashForOtpType("email_change")).toBeNull();
  });

  it("says nothing for a recovery link (the reset form confirms the new password)", () => {
    expect(flashForOtpType("recovery")).toBeNull();
    expect(flashForOtpType(null)).toBeNull();
  });

  it("adds the flag without dropping the target's own query", () => {
    const url = withFlash(new URL("https://framly.ch/de/home?tab=1"), "emailConfirmed");
    expect(url.toString()).toBe("https://framly.ch/de/home?tab=1&flash=emailConfirmed");
  });
});
