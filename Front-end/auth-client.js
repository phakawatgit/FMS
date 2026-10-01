import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js';
import { getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js';

const base = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;
const response = await fetch(`${base}/api/auth/config`);
if (!response.ok) throw Error('โหลดการตั้งค่าการเข้าสู่ระบบไม่สำเร็จ');
const config = (await response.json()).data;
const app = getApps()[0] || initializeApp(config.firebase);
const auth = getAuth(app);
if (config.emulator && !auth.emulatorConfig) connectAuthEmulator(auth, config.emulator, { disableWarnings: true });
let user = null;
const ready = new Promise(resolve => { const unsubscribe = onAuthStateChanged(auth, () => { unsubscribe(); resolve(); }); });
async function request(path, options = {}) {
  await ready;
  const headers = new Headers(options.headers);
  if (auth.currentUser) headers.set('Authorization', `Bearer ${await auth.currentUser.getIdToken()}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${base}/api/${path}`, { ...options, headers, cache: 'no-store' });
  const result = await res.json();
  if (!res.ok || !result.success) {
    const error = Object.assign(Error(result.message || 'คำขอไม่สำเร็จ'), { status: res.status });
    if (res.status === 401) window.dispatchEvent(new Event('fms:session-expired'));
    throw error;
  }
  return result.data;
}
async function me() { await ready; user = auth.currentUser ? await request('auth/me') : null; return user; }
const api = { auth, app, ready, request, me, get user() { return user; },
  async login(email, password) { await signInWithEmailAndPassword(auth, email, password); return me(); },
  async signup(email, password, name) { const result = await createUserWithEmailAndPassword(auth, email, password); if (name) await updateProfile(result.user, { displayName: name }); return me(); },
  async google() { const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' }); await signInWithPopup(auth, provider); return me(); },
  async logout() { await signOut(auth); user = null; }
};
window.FMSAuth = api;
export default api;
