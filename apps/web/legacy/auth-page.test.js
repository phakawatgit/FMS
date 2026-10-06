import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/index.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/script.js");

async function load({ verified = true, fetchImpl } = {}) {
  vi.resetModules();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
  const user = {
    uid: "auth-user", email: "user@example.com", displayName: "Ava User", emailVerified: verified,
    getIdToken: vi.fn(async () => "firebase-token"), reload: vi.fn(async () => {}),
  };
  window.__FMS_TEST_AUTH_USER__ = user;
  window.__FMS_AUTH_MOCK_OVERRIDES__ = {};
  const fetchMock = fetchImpl || vi.fn(async (url) => ({
    ok: true,
    json: async () => ({ success: true, data: url.endsWith("/session") ? { user: { id: "auth-user", role: "NURSE" } } : { resetToken: "reset-token" } }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("FMSStorage", { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  vi.spyOn(console, "error").mockImplementation(() => {});
  const originalTimeout = window.setTimeout;
  vi.spyOn(window, "setTimeout").mockImplementation((callback, delay, ...args) => delay > 100 ? 0 : originalTimeout(callback, delay, ...args));
  await Object.values(scripts)[0]();
  return { user, fetchMock };
}

const submit = (id) => document.getElementById(id).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); document.body.replaceChildren(); sessionStorage.clear(); delete window.__FMS_TEST_AUTH_USER__; delete window.__FMS_AUTH_MOCK_OVERRIDES__;
});

describe("Firebase authentication page", () => {
  it("switches login language and modes, toggles password visibility, and establishes a verified session", async () => {
    const { user, fetchMock } = await load();
    document.querySelector("[data-mode='signup']").click();
    expect(document.querySelector(".signup-field").hidden).toBe(false);
    expect(document.getElementById("password").autocomplete).toBe("new-password");
    document.querySelector("[data-mode='login']").click();
    expect(document.querySelector(".signup-field").hidden).toBe(true);
    expect(document.getElementById("password").autocomplete).toBe("current-password");
    document.querySelector(".language-switcher").click();
    expect(document.documentElement.lang).toBe("th");
    const toggle = document.querySelector("[data-password-toggle='password']");
    toggle.click();
    expect(document.getElementById("password").type).toBe("text");
    toggle.click();
    expect(document.getElementById("password").type).toBe("password");
    document.getElementById("email").value = " user@example.com ";
    document.getElementById("password").value = "secret123";
    submit("authForm");
    await vi.waitFor(() => expect(document.getElementById("loginStatus").textContent).toContain("Ava User"));
    expect(document.getElementById("loginStatus").textContent).toContain("เข้าสู่ระบบสำเร็จ");
    document.querySelector(".language-switcher").click();
    expect(document.getElementById("loginStatus").textContent).toBe("Signed in successfully. Welcome, Ava User");
    expect(user.reload).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/auth/session"), expect.objectContaining({ method: "POST" }));
  });

  it("signs up, verifies the email OTP, signs out, and returns to the login tab", async () => {
    const fetchImpl = vi.fn(async (url) => ({ ok: true, json: async () => ({ success: true, data: url.endsWith("/session") ? { user: { id: "auth-user", role: "NURSE" } } : {} }) }));
    await load({ verified: false, fetchImpl });
    const signOut = vi.fn(async () => {});
    window.__FMS_AUTH_MOCK_OVERRIDES__.signOut = signOut;
    document.querySelector("[data-mode='signup']").click();
    document.getElementById("fullName").value = "Ava User";
    document.getElementById("email").value = "user@example.com";
    document.getElementById("password").value = "secret123";
    submit("authForm");
    await vi.waitFor(() => expect(document.getElementById("signupOtpFlow").hidden).toBe(false));
    expect(document.getElementById("signupOtpEmail").textContent).toBe("user@example.com");
    document.getElementById("signupOtpResend").click();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    document.getElementById("signupOtp").value = "123456";
    submit("signupOtpForm");
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/api/auth/signup/otp/verify"), expect.any(Object));
    expect(fetchImpl.mock.calls.some(([url]) => url.endsWith("/session"))).toBe(false);
    expect(document.getElementById("signupOtpFlow").hidden).toBe(true);
    expect(document.getElementById("authForm").hidden).toBe(false);
    expect(document.querySelector("[data-mode='login']").classList.contains("is-active")).toBe(true);
    expect(document.getElementById("email").value).toBe("user@example.com");
    expect(document.getElementById("password").value).toBe("");
    expect(document.getElementById("loginStatus").textContent).toBe("Email verified. Please log in.");
    document.querySelector(".language-switcher").click();
    expect(document.getElementById("loginStatus").textContent).toContain("ยืนยันอีเมลสำเร็จ");
    expect(document.getElementById("signupOtpSubmit").disabled).toBe(false);
  });

  it("completes password recovery, reports validation and API errors, and returns to login", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/otp/verify")) return { ok: true, json: async () => ({ success: true, data: { resetToken: "reset-token" } }) };
      if (url.endsWith("/complete")) return { ok: false, json: async () => ({ success: false, message: "reset rejected" }) };
      return { ok: true, json: async () => ({ success: true, data: {} }) };
    });
    await load({ fetchImpl });
    document.getElementById("email").value = "user@example.com";
    document.querySelector(".forgot-button").click();
    expect(document.getElementById("resetFlow").hidden).toBe(false);
    expect(document.getElementById("resetEmail").value).toBe("user@example.com");
    submit("resetEmailForm");
    await vi.waitFor(() => expect(document.getElementById("resetOtpForm").hidden).toBe(false));
    document.getElementById("resetOtp").value = "123456";
    submit("resetOtpForm");
    await vi.waitFor(() => expect(document.getElementById("newPasswordForm").hidden).toBe(false));
    document.getElementById("newPassword").value = "secret123";
    document.getElementById("confirmPassword").value = "different";
    submit("newPasswordForm");
    expect(document.getElementById("resetStatus").textContent).toBe("Passwords do not match.");
    document.getElementById("confirmPassword").value = "secret123";
    submit("newPasswordForm");
    await vi.waitFor(() => expect(document.getElementById("resetStatus").textContent).toBe("reset rejected"));
    document.getElementById("resetBack").click();
    expect(document.getElementById("authForm").hidden).toBe(false);
    expect(document.getElementById("resetOtpForm").hidden).toBe(true);
  });

  it("supports Google sign-in and shows a clear error when the application session is rejected", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({ success: false, message: "session service unavailable" }) }));
    await load({ fetchImpl });
    document.getElementById("googleLogin").click();
    await vi.waitFor(() => expect(document.getElementById("loginStatus").textContent).toBe("session service unavailable"));
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/api/auth/session"), expect.objectContaining({ method: "POST" }));
  });

  it("reports an invalid reset OTP, accepts a later valid OTP and confirms a password change", async () => {
    let verifyAttempts = 0;
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/otp/verify")) {
        verifyAttempts += 1;
        return verifyAttempts === 1
          ? { ok: false, json: async () => ({ success: false, message: "OTP expired" }) }
          : { ok: true, json: async () => ({ success: true, data: { resetToken: "valid-reset-token" } }) };
      }
      return { ok: true, json: async () => ({ success: true, data: {} }) };
    });
    await load({ fetchImpl });
    document.querySelector(".forgot-button").click();
    document.getElementById("resetEmail").value = "invalid-email";
    submit("resetEmailForm");
    expect(document.getElementById("resetOtpForm").hidden).toBe(true);
    document.getElementById("resetEmail").value = "user@example.com";
    submit("resetEmailForm");
    await vi.waitFor(() => expect(document.getElementById("resetOtpForm").hidden).toBe(false));
    document.getElementById("resetOtp").value = "000000";
    submit("resetOtpForm");
    await vi.waitFor(() => expect(document.getElementById("resetStatus").textContent).toBe("OTP expired"));
    submit("resetOtpForm");
    await vi.waitFor(() => expect(document.getElementById("newPasswordForm").hidden).toBe(false));
    document.getElementById("newPassword").value = "new-secret";
    document.getElementById("confirmPassword").value = "new-secret";
    submit("newPasswordForm");
    await vi.waitFor(() => expect(document.getElementById("resetStatus").textContent).toBe("Password updated successfully."));
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/password-reset/complete"), expect.objectContaining({ method: "POST" }));
  });

  it("shows Firebase errors for email login, signup, and Google sign-in", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    await load();
    window.__FMS_AUTH_MOCK_OVERRIDES__.signInWithEmailAndPassword = async () => { throw { code: "auth/invalid-credential", message: "bad credentials" }; };
    document.getElementById("email").value = "user@example.com";
    document.getElementById("password").value = "wrong";
    submit("authForm");
    await vi.waitFor(() => expect(errorLog).toHaveBeenCalledTimes(1));

    window.__FMS_AUTH_MOCK_OVERRIDES__.signInWithPopup = async () => { throw new Error("popup unavailable"); };
    document.getElementById("googleLogin").click();
    await vi.waitFor(() => expect(errorLog).toHaveBeenCalledTimes(2));
    expect(document.getElementById("loginStatus").textContent).toBe("popup unavailable");

    await load({ verified: false });
    window.__FMS_AUTH_MOCK_OVERRIDES__.createUserWithEmailAndPassword = async () => { throw { code: "auth/weak-password", message: "weak" }; };
    document.querySelector("[data-mode='signup']").click();
    document.getElementById("fullName").value = "Ava";
    document.getElementById("email").value = "user@example.com";
    document.getElementById("password").value = "short";
    submit("authForm");
    await vi.waitFor(() => expect(errorLog).toHaveBeenCalledTimes(3));
    expect(document.getElementById("submitButton").disabled).toBe(false);
  });

  it("localizes the account-linked Firebase error when the language changes", async () => {
    await load();
    window.__FMS_AUTH_MOCK_OVERRIDES__.signInWithEmailAndPassword = async () => {
      throw { code: "auth/account-exists-with-different-credential", message: "This account is already linked to another Firebase identity" };
    };
    document.getElementById("email").value = "user@example.com";
    document.getElementById("password").value = "secret123";
    submit("authForm");
    await vi.waitFor(() => expect(document.getElementById("loginStatus").textContent).toContain("This account is already linked"));
    document.querySelector(".language-switcher").click();
    expect(document.getElementById("loginStatus").textContent).toBe("บัญชีนี้เชื่อมโยงกับบัญชี Firebase อื่นอยู่แล้ว");
  });

  it("recovers from a failed signup OTP request, resends it, and safely backs out", async () => {
    let requests = 0;
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/signup/otp/request")) {
        requests += 1;
        return requests === 1
          ? { ok: false, json: async () => ({ success: false, message: "mail unavailable" }) }
          : { ok: true, json: async () => ({ success: true, data: {} }) };
      }
      return { ok: true, json: async () => ({ success: true, data: { user: { id: "auth-user", role: "NURSE" } } }) };
    });
    await load({ verified: false, fetchImpl });
    document.querySelector("[data-mode='signup']").click();
    document.getElementById("fullName").value = "Ava User";
    document.getElementById("email").value = "user@example.com";
    document.getElementById("password").value = "secret123";
    submit("authForm");
    await vi.waitFor(() => expect(document.getElementById("signupOtpStatus").textContent).toBe("mail unavailable"));
    document.getElementById("signupOtpResend").click();
    await vi.waitFor(() => expect(document.getElementById("signupOtpStatus").textContent).toBe("OTP resent."));
    window.__FMS_AUTH_MOCK_OVERRIDES__.signOut = async () => { throw new Error("sign out failed"); };
    document.getElementById("signupOtpBack").click();
    await vi.waitFor(() => expect(document.getElementById("signupOtpFlow").hidden).toBe(true));
    expect(document.getElementById("signupOtp").value).toBe("");
    expect(document.getElementById("authForm").hidden).toBe(false);
  });
});
