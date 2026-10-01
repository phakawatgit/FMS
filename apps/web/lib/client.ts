export type Account = { id: string; email: string; name: string; role: 'ADMIN' | 'NURSE'; active: boolean };
export type AuthClient = {
  ready: Promise<void>;
  user: Account | null;
  auth: { currentUser: { getIdToken(): Promise<string> } | null };
  me(): Promise<Account | null>;
  request<T = any>(path: string, options?: RequestInit): Promise<T>;
  login(email: string, password: string): Promise<Account>;
  signup(email: string, password: string, name: string): Promise<Account>;
  google(): Promise<Account>;
  logout(): Promise<void>;
};
declare global { interface Window { FMS_API_URL?: string; FMSAuth?: AuthClient } }
let pending: Promise<AuthClient> | undefined;
export function authClient(): Promise<AuthClient> {
  return pending ||= (async () => {
    window.FMS_API_URL = window.FMS_API_URL || process.env.NEXT_PUBLIC_API_URL || `${location.protocol}//${location.hostname}:4000`;
    const path = '/legacy/auth-client.js';
    const module = await import(/* webpackIgnore: true */ path);
    await module.default.ready;
    return module.default;
  })().catch(error => { pending = undefined; throw error; });
}
export async function api<T = any>(path: string, options?: RequestInit): Promise<T> {
  return (await authClient()).request<T>(path, options);
}
const pendingMutations = new Map<string, string>();
export async function mutate<T = any>(path: string, method: string, body: unknown): Promise<T> {
  const signature = `${method}:${path}:${JSON.stringify(body)}`;
  if (!pendingMutations.has(signature)) pendingMutations.set(signature, crypto.randomUUID());
  try {
    const result = await api<T>(path, { method, headers: { 'Idempotency-Key': pendingMutations.get(signature)! }, body: JSON.stringify(body) });
    pendingMutations.delete(signature);
    return result;
  } catch (error) {
    if ((error as { status?: number }).status && (error as { status: number }).status < 500) pendingMutations.delete(signature);
    throw error;
  }
}
