// Test helper: real emulator tokens, never an authentication bypass in the API.
const originalFetch = global.fetch;
global.fetch = (url, options = {}) => {
  const target = new URL(String(url));
  if (process.env.TEST_AUTH_TOKEN && ['127.0.0.1', 'localhost'].includes(target.hostname) && target.pathname.startsWith('/api/') && !/\/auth\/(config|forgot-password|verify-otp|reset-password)$/.test(target.pathname)) {
    const headers = new Headers(options.headers);
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN}`);
    return originalFetch(url, { ...options, headers });
  }
  return originalFetch(url, options);
};
module.exports = async function browserAuth(context, base) {
  if (!process.env.TEST_AUTH_EMAIL) throw Error('Run tests through test:system with the Auth Emulator');
  await context.addInitScript(base => { window.FMS_API_URL = base; }, base);
  const page = await context.newPage();
  await page.goto((process.env.WEB_URL || 'http://localhost:3000') + '/legacy/index.html');
  await page.waitForFunction(() => !!window.FMSAuth);
  await page.evaluate(async credentials => {
    await window.FMSAuth.login(credentials.email, credentials.password);
  }, { email: process.env.TEST_AUTH_EMAIL, password: process.env.TEST_AUTH_PASSWORD });
  await page.close();
};
