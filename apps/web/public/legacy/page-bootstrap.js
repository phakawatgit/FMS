// Page scripts run in their original order only after authentication and data
// hydration. No synchronous XHR and no browser-to-database storage mirroring.
import Auth from './auth-client.js';
async function start() {
  await Auth.ready;
  const login = /\/index\.html$/.test(location.pathname);
  if (!login && !await Auth.me()) { location.replace('./index.html'); return; }
  const scripts = [...document.querySelectorAll('script[data-fms-src]')];
  for (const source of scripts) {
    const path = source.dataset.fmsSrc;
    if (path.includes('legacy-storage.js')) continue;
    if (path.startsWith('https://cdn.reicon.dev/')) continue;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = path;
      if (source.dataset.fmsType) script.type = source.dataset.fmsType;
      script.onload = resolve;
      script.onerror = () => reject(Error(`โหลดสคริปต์ไม่สำเร็จ: ${path}`));
      document.body.append(script);
    });
    if (path.includes('real-data.js') && !login) {
      await window.FMSData.hydrate();
      window.FMSReference = {
        branches() {
          const faculties = window.FMSReferenceData.faculties.filter(f => f.active);
          const entries = faculties.map(f => [f.code, f.branches.filter(b => b.active).map(b => b.name)]);
          return Object.fromEntries([['all', entries.flatMap(([, names]) => names)], ...entries]);
        },
        fill(select) {
          if (!select) return;
          const previous = select.value;
          select.replaceChildren(new Option('ทั้งหมด', 'all'), ...window.FMSReferenceData.faculties.filter(f => f.active).map(f => new Option(f.name, f.code)));
          select.value = [...select.options].some(o => o.value === previous) ? previous : 'all';
        }
      };
    }
  }
}
start().catch(error => {
  const notice = document.createElement('div'); notice.setAttribute('role', 'alert');
  notice.style.cssText = 'position:fixed;inset:0;z-index:10000;background:white;padding:40px;color:#842';
  const text = document.createElement('p'); text.textContent = error.message;
  const retry = document.createElement('button'); retry.textContent = 'ลองใหม่'; retry.onclick = () => location.reload();
  const login = document.createElement('a'); login.href = './index.html'; login.textContent = ' เข้าสู่ระบบ';
  notice.append(text, retry, login); document.body.append(notice);
});
