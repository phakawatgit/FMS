import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const admin = {
  initializeApp: vi.fn((options) => ({ options })),
  credential: { cert: vi.fn((account) => ({ account })) },
  auth: vi.fn(() => ({ verifyIdToken: vi.fn() })),
};

const modulePath = require.resolve("./firebase-admin.js");
const firebaseAdminPath = require.resolve("firebase-admin");
const originalFirebaseAdminModule = require.cache[firebaseAdminPath];
const originalEnvironment = { ...process.env };

function loadFreshModule() {
  delete require.cache[modulePath];
  return require(modulePath);
}

beforeEach(() => {
  require.cache[firebaseAdminPath] = { id: firebaseAdminPath, filename: firebaseAdminPath, loaded: true, exports: admin };
  process.env = { ...originalEnvironment };
  delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_CLIENT_EMAIL;
  delete process.env.FIREBASE_PRIVATE_KEY;
  admin.initializeApp.mockClear();
  admin.credential.cert.mockClear();
  admin.auth.mockClear();
});

afterEach(() => {
  process.env = { ...originalEnvironment };
  delete require.cache[modulePath];
  if (originalFirebaseAdminModule) require.cache[firebaseAdminPath] = originalFirebaseAdminModule;
  else delete require.cache[firebaseAdminPath];
});

describe("Firebase Admin initialization", () => {
  it.each([resolve(process.cwd(), "../../Back-end/package.json"), "package.json"])("loads a service account from configured path %s", (path) => {
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = path;
    loadFreshModule().getFirebaseAuth();

    expect(admin.credential.cert).toHaveBeenCalledWith(expect.objectContaining({ name: "fms-backend" }));
  });

  it("initializes once from environment credentials and exposes auth", () => {
    process.env.FIREBASE_PROJECT_ID = "fms-test";
    process.env.FIREBASE_CLIENT_EMAIL = "service@example.com";
    process.env.FIREBASE_PRIVATE_KEY = "line-one\\nline-two";
    const firebase = loadFreshModule();

    const auth = firebase.getFirebaseAuth();

    expect(admin.credential.cert).toHaveBeenCalledWith({
      projectId: "fms-test",
      clientEmail: "service@example.com",
      privateKey: "line-one\nline-two",
    });
    expect(admin.initializeApp).toHaveBeenCalledOnce();
    expect(auth).toBeTruthy();
    expect(firebase.getFirebaseAuth()).toBeTruthy();
    expect(admin.initializeApp).toHaveBeenCalledOnce();
    expect(admin.auth).toHaveBeenCalledTimes(2);
  });

  it("requires complete Firebase credentials", () => {
    expect(() => loadFreshModule().getFirebaseAuth()).toThrow("Firebase Admin credentials are not configured");
  });
});
