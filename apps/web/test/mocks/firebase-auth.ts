declare global {
  interface Window {
    __FMS_TEST_AUTH_USER__?: unknown;
    __FMS_AUTH_MOCK_OVERRIDES__?: Partial<Record<string, (...args: unknown[]) => unknown>>;
  }
}

export function getAuth(app: unknown) {
  return { app, currentUser: window.__FMS_TEST_AUTH_USER__ };
}

export function onAuthStateChanged(_auth: unknown, callback: (user: unknown) => void) {
  callback(window.__FMS_TEST_AUTH_USER__ ?? null);
  return () => {};
}

export class GoogleAuthProvider {
  setCustomParameters() {}
}

export async function createUserWithEmailAndPassword(...args: unknown[]) {
  const override = window.__FMS_AUTH_MOCK_OVERRIDES__?.createUserWithEmailAndPassword;
  if (override) return override(...args);
  return { user: window.__FMS_TEST_AUTH_USER__ };
}

export async function signInWithEmailAndPassword(...args: unknown[]) {
  const override = window.__FMS_AUTH_MOCK_OVERRIDES__?.signInWithEmailAndPassword;
  if (override) return override(...args);
  return { user: window.__FMS_TEST_AUTH_USER__ };
}

export async function signInWithPopup(...args: unknown[]) {
  const override = window.__FMS_AUTH_MOCK_OVERRIDES__?.signInWithPopup;
  if (override) return override(...args);
  return { user: window.__FMS_TEST_AUTH_USER__ };
}

export async function signOut(...args: unknown[]) {
  const override = window.__FMS_AUTH_MOCK_OVERRIDES__?.signOut;
  if (override) return override(...args);
}

export async function updateProfile(...args: unknown[]) {
  const override = window.__FMS_AUTH_MOCK_OVERRIDES__?.updateProfile;
  if (override) return override(...args);
}
