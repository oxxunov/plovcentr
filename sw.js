// ═══ ПЛОВ ЦЕНТР — помощник браузера: меню хранится в телефоне ═══
// Страница, шрифты, стили — сначала из телефона, свежая версия подтягивается в фоне.
// Картинки меню (uploads/…) — навсегда из телефона: у каждой картинки своё имя,
// новая картинка = новое имя, поэтому устареть они не могут.
// Админка и данные меню (api/…) сюда не попадают — они всегда с сервера.
const SHELL = 'pc-shell-gh3';
const IMGS = 'pc-img-v1';
const SHELL_FILES = ['./', 'assets/menu.css?v=24', 'assets/menu.js?v=24', 'assets/fonts/onest.woff', 'assets/fonts/unbounded.woff'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('pc-') && k !== SHELL && k !== IMGS) await caches.delete(k);
    await self.clients.claim();
  })());
});

const scopePath = new URL(self.registration.scope).pathname;
function kind(url) {
  if (url.origin !== location.origin) return null;
  const p = url.pathname.slice(scopePath.length);
  if (p.startsWith('uploads/')) return 'img';
  if (p === '' || p === 'index.html' || p.startsWith('assets/menu.') || p.startsWith('assets/fonts/')) return 'shell';
  return null; // api, admin.html, migrate.html и всё остальное — как обычно, через сеть
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const k = kind(url);
  if (k === 'img') e.respondWith(fromImages(req));
  else if (k === 'shell') e.respondWith(req.mode === 'navigate' ? page(req, e) : shell(req, e));
});

async function fromImages(req) {
  const c = await caches.open(IMGS);
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone()).catch(() => {});
  return res;
}

// Ресурсы оформления: сразу из телефона, в фоне — сверка с сервером
async function shell(req, e) {
  const c = await caches.open(SHELL);
  const hit = await c.match(req);
  const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()).catch(() => {}); return res; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

// Сама страница: свежая с сервера, но если связь медленная (дольше 2,5 с) или её нет — из телефона
async function page(req, e) {
  const c = await caches.open(SHELL);
  const key = './';
  // страницу всегда сверяем с сервером, мимо кэша браузера — иначе после обновления видна старая версия
  const net = fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then((res) => { if (res.ok) c.put(key, res.clone()).catch(() => {}); return res; });
  e.waitUntil(net.catch(() => {}));
  const hit = await c.match(key);
  if (!hit) return net;
  const slow = new Promise((r) => setTimeout(() => r(hit), 2500));
  try { return await Promise.race([net.then((r) => (r.ok ? r : hit)), slow]); }
  catch { return hit; }
}

// Страница присылает список всех картинок меню: недостающие докачиваем понемногу,
// а те, что из меню убрали, удаляем из телефона.
let running = null;
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type !== 'keep' || !Array.isArray(d.urls)) return;
  const job = (running || Promise.resolve()).then(() => keep(d.urls, d.fetch !== false)).catch(() => {});
  running = job;
  e.waitUntil(job);
});
async function keep(list, doFetch) {
  const c = await caches.open(IMGS);
  const want = new Set(list.map((u) => new URL(u, self.registration.scope).href));
  for (const r of await c.keys()) if (!want.has(r.url.split('?')[0])) await c.delete(r);
  if (!doFetch) return;
  const have = new Set((await c.keys()).map((r) => r.url.split('?')[0]));
  const todo = [...want].filter((u) => !have.has(u));
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const u = todo[i++];
      try { const res = await fetch(u, { credentials: 'same-origin' }); if (res.ok) await c.put(u, res); } catch {}
    }
  };
  await Promise.all([worker(), worker(), worker()]); // три картинки одновременно — не забивать связь
}
