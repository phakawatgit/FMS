import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "./firebase-auth";

afterEach(() => vi.unstubAllGlobals());

describe("Firebase Auth test double", () => {
  it("returns the configured fake user across auth methods and handles signed-out state", async () => {
    const user = { uid: "u1", email: "nurse@example.com" };
    vi.stubGlobal("window", { __FMS_TEST_AUTH_USER__: user });
    const auth = getAuth({ name: "test-app" });
    expect(auth.app).toEqual({ name: "test-app" });
    expect(auth.currentUser).toEqual(user);

    const listener = vi.fn();
    const unsubscribe = onAuthStateChanged(auth, listener);
    expect(listener).toHaveBeenCalledWith(user);
    expect(unsubscribe()).toBeUndefined();
    await expect(createUserWithEmailAndPassword()).resolves.toEqual({ user });
    await expect(signInWithEmailAndPassword()).resolves.toEqual({ user });
    await expect(signInWithPopup()).resolves.toEqual({ user });
    await expect(signOut()).resolves.toBeUndefined();
    await expect(updateProfile()).resolves.toBeUndefined();

    vi.stubGlobal("window", {});
    const signedOut = vi.fn();
    onAuthStateChanged(auth, signedOut);
    expect(signedOut).toHaveBeenCalledWith(null);
  });

  it("provides a provider that accepts custom parameters", () => {
    const provider = new GoogleAuthProvider();
    expect(() => provider.setCustomParameters({ prompt: "select_account" })).not.toThrow();
  });

  it("delegates authentication operations to configured overrides", async () => {
    const overrides = {
      createUserWithEmailAndPassword: vi.fn(async () => ({ user: "created" })),
      signInWithEmailAndPassword: vi.fn(async () => ({ user: "email" })),
      signInWithPopup: vi.fn(async () => ({ user: "popup" })),
      signOut: vi.fn(async () => "signed-out"),
      updateProfile: vi.fn(async () => "updated"),
    };
    vi.stubGlobal("window", { __FMS_AUTH_MOCK_OVERRIDES__: overrides });

    await expect(createUserWithEmailAndPassword("a", "b")).resolves.toEqual({ user: "created" });
    await expect(signInWithEmailAndPassword("a", "b")).resolves.toEqual({ user: "email" });
    await expect(signInWithPopup("auth", "provider")).resolves.toEqual({ user: "popup" });
    await expect(signOut("auth")).resolves.toBe("signed-out");
    await expect(updateProfile("user", { displayName: "Ava" })).resolves.toBe("updated");
    for (const override of Object.values(overrides)) expect(override).toHaveBeenCalledOnce();
  });
});
