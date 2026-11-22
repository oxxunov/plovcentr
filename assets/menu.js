// ═══ ПЛОВ ЦЕНТР — меню · v17 ═══
// Временная версия для GitHub Pages: меню берётся из файла menu.json рядом со страницей.

const $ = (id) => document.getElementById(id);
const CACHE_KEY = 'menu_srv_v1';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let categories = [];
let dishes = [];
let sectionEls = [];   // [{ id, el }]
let tabEls = new Map(); // catId → button
let cardEls = [];      // [{ el, hay, catId }]
let activeId = null;
let rendered = false;
let info = null;      // settings/contacts
let style = 'cards';  // cards — карточки блюд; pages — меню-картинки
let pcats = [];
let pages = [];
const tabCats = () => (style === 'pages' ? pcats : categories);

/* ═════════ Розетка с ляганa ═════════ */
function rosette() {
  const P = 'pathLength="1"';
  let petals = '', dots = '';
  for (let k = 0; k < 12; k++) {
    petals += `<path ${P} transform="rotate(${k * 30})" d="M0-82C14-66 14-46 0-34C-14-46-14-66 0-82Z"/>`;
    dots += `<circle class="r-dot" r="2.6" cx="0" cy="-74" transform="rotate(${k * 30 + 15})"/>`;
  }
  return `<svg class="rosette" viewBox="-100 -100 200 200" aria-hidden="true">
    <circle ${P} r="95"/><circle ${P} r="86"/>${petals}
    <path ${P} d="M0-30L30 0 0 30-30 0Z"/><path ${P} transform="rotate(45)" d="M0-30L30 0 0 30-30 0Z"/>
    <circle class="r-core" ${P} r="12"/>${dots}</svg>`;
}
const ROSETTE = rosette();
document.querySelectorAll('[data-rosette]').forEach((n) => { n.innerHTML = ROSETTE; });

/* ═════════ Приветствие ═════════ */
(function welcome() {
  const box = $('welcome');
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    box.classList.add('out');
    document.body.classList.remove('is-locked');
    setTimeout(() => box.remove(), 750);
  };
  const timer = setTimeout(close, 4200);
  box.addEventListener('click', close);
})();

/* ═════════ Вход в админку: 3 нажатия по логотипу ═════════ */
(function adminEntry() {
  let n = 0, t = 0;
  $('logo').addEventListener('click', (e) => {
    e.preventDefault();
    n++;
    clearTimeout(t);
    t = setTimeout(() => (n = 0), 600);
    if (n >= 3) { n = 0; location.href = 'admin.html'; }
  });
})();

/* ═════════ Высота липкой шапки ═════════ */
let stickyH = 104;
function measureSticky() {
  const h = $('header').offsetHeight;
  if (h && h !== stickyH) {
    stickyH = h;
    document.documentElement.style.setProperty('--sticky-h', h + 'px');
    if (rendered) watchSections();
  }
}
new ResizeObserver(measureSticky).observe($('header'));
measureSticky();

/* ═════════ Утилиты ═════════ */
const norm = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е');
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
const fmtPrice = (n) => Number(n || 0).toLocaleString('ru-RU');

/* ═════════ Фото: base64 → Blob-URL, лениво, с декодированием вне кадра ═════════
   Раньше все base64-фото (мегабайты) вставлялись строкой в HTML и браузер разбирал их
   разом. Теперь картинка получает адрес только когда подъезжает к экрану. */
const blobUrls = new Map(); // строка фото → Promise<objectURL>
function photoSrc(photo) {
  if (!photo.startsWith('data:')) return Promise.resolve(photo);
  let p = blobUrls.get(photo);
  if (!p) {
    // fetch(data:) раскодирует картинку вне главного потока — прокрутка не дёргается
    p = fetch(photo).then((r) => r.blob()).then((b) => URL.createObjectURL(b)).catch(() => photo);
    blobUrls.set(photo, p);
  }
  return p;
}

const imgIO = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const img = en.target;
    imgIO.unobserve(img);
    const src = img._photo;
    img._photo = null;
    photoSrc(src).then((u) => {
      img.src = u;
      const show = () => img.classList.add('ready');
      if (img.decode) img.decode().then(show, () => { img.complete && img.naturalWidth ? show() : fail(img); });
      else { img.onload = show; img.onerror = () => fail(img); }
    });
  }
}, { rootMargin: '700px 0px' });

function fail(img) {
  const wrap = img.parentNode;
  img.remove();
  if (wrap && !wrap.querySelector('.ph')) { const ph = el('div', 'ph'); ph.innerHTML = ROSETTE; wrap.prepend(ph); }
}

/* ═════════ Карточка ═════════ */
function buildCard(d, catName, animate, idx) {
  const off = !!d.unavailable;
  const card = el('article', 'card' + (off ? ' off' : ''));
  if (animate && idx < 12 && !reduceMotion) {
    card.classList.add('enter');
    card.style.animationDelay = (idx * 0.04).toFixed(2) + 's';
  }

  const photo = el('div', 'card-photo');
  if (d.photo) {
    const img = new Image();
    img.alt = d.name || '';
    img.decoding = 'async';
    img._photo = d.photo;
    photo.append(img);
    imgIO.observe(img);
  } else {
    { const ph = el('div', 'ph'); ph.innerHTML = ROSETTE; photo.append(ph); }
  }

  if (d.isHit || off) {
    card.classList.add('has-badge');
    const b = el('div', 'badges');
    if (d.isHit) { const hb = el('span', 'b-hit'); hb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>Хит'; b.append(hb); }
    if (off) b.append(el('span', 'b-off', 'Нет в наличии'));
    photo.append(b);
  }

  const ingredients = Array.isArray(d.ingredients) ? d.ingredients.filter(Boolean) : [];
  card.append(photo);

  const body = el('div', 'card-body');
  body.append(el('h3', 'card-name', d.name || ''));
  body.append(el('p', 'card-desc', d.description || ''));
  const foot = el('div', 'card-foot');
  const price = el('div', 'price', fmtPrice(d.price) + ' ');
  price.append(el('small', null, '₽'));
  foot.append(price);
  if (d.weight != null && d.weight !== '') foot.append(el('span', 'weight', d.weight + ' г'));
  body.append(foot);
  if (ingredients.length) {
    const ing = el('div', 'ingr');
    ingredients.forEach((n) => ing.append(el('span', null, n)));
    body.append(ing);
  }
  card.append(body);

  return { el: card, hay: norm([d.name, d.description, catName, ingredients.join(' ')].join(' ')) };
}

const sortDishes = (arr) => arr
  .map((d, i) => [d, i])
  .sort((a, b) => (!!a[0].unavailable - !!b[0].unavailable) || (a[1] - b[1]))
  .map((x) => x[0]);

/* ═════════ Меню-картинки: одна готовая картинка на позицию ═════════ */
const pageAlt = (p) => [p.title, p.weight, p.price].filter(Boolean).join(', ');
function buildPage(p, list, i) {
  const b = el('button', 'pg');
  b.type = 'button';
  b.setAttribute('aria-label', p.title ? p.title + ' — открыть' : 'Открыть картинку');
  if (p.w && p.h) b.style.aspectRatio = `${p.w} / ${p.h}`;
  const img = new Image();
  img.alt = pageAlt(p);
  img.decoding = 'async';
  if (p.w && p.h) { img.width = p.w; img.height = p.h; }
  img._photo = p.photo;
  b.append(img);
  imgIO.observe(img);
  b.addEventListener('click', () => openViewer(list, i));
  return b;
}

/* ═════════ Отрисовка ═════════ */
function render() {
  document.body.classList.toggle('pages-mode', style === 'pages');
  if (style === 'pages') { renderPages(); return; }
  const animate = !rendered;
  const wrap = $('sections');
  const used = new Set();
  imgIO.disconnect();
  cardEls = [];
  sectionEls = [];

  const frag = document.createDocumentFragment();
  let idx = 0;
  const groups = categories.length
    ? categories.map((c) => ({ id: c.id, name: c.name, items: sortDishes(dishes.filter((d) => d.category === c.id)) }))
    : [{ id: 'all', name: '', items: sortDishes(dishes) }];

  groups.forEach((g, gi) => {
    const sec = el('section', 'cat-section');
    sec.id = 'section-' + g.id;
    sec.dataset.cat = g.id;
    if (gi === groups.length - 1) sec.classList.add('is-last');
    if (g.name) sec.append(el('h2', 'cat-title', g.name));
    const grid = el('div', 'cat-grid');
    if (!g.items.length) grid.append(el('p', 'cat-empty', 'Нет блюд в этой категории'));
    g.items.forEach((d) => {
      if (d.photo) used.add(d.photo);
      const c = buildCard(d, g.name, animate, idx++);
      c.catId = g.id;
      cardEls.push(c);
      grid.append(c.el);
    });
    sec.append(grid);
    frag.append(sec);
    sectionEls.push({ id: g.id, el: sec });
  });

  wrap.replaceChildren(frag);
  // освобождаем фото, которых больше нет в меню
  for (const [k, p] of blobUrls) if (!used.has(k)) { p.then((url) => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); }); blobUrls.delete(k); }

  renderTabs();
  rendered = true;
  $('load-error').hidden = true;
  watchSections();
  if ($('search').value.trim()) applySearch();
}

function renderPages() {
  if (searchInp.value) { searchInp.value = ''; $('search-clear').classList.remove('on'); applySearch(); }
  const wrap = $('sections');
  imgIO.disconnect();
  cardEls = [];
  sectionEls = [];
  const frag = document.createDocumentFragment();
  pcats.forEach((c, gi) => {
    const list = pages.filter((p) => p.pcat === c.id);
    const sec = el('section', 'cat-section');
    sec.id = 'section-' + c.id;
    sec.dataset.cat = c.id;
    if (gi === pcats.length - 1) sec.classList.add('is-last');
    sec.append(el('h2', 'cat-title', c.name));
    const grid = el('div', 'pg-grid');
    if (!list.length) grid.append(el('p', 'cat-empty', 'Скоро здесь появится меню'));
    list.forEach((p, i) => grid.append(buildPage(p, list, i)));
    sec.append(grid);
    frag.append(sec);
    sectionEls.push({ id: c.id, el: sec });
  });
  wrap.replaceChildren(frag);
  renderTabs();
  rendered = true;
  $('load-error').hidden = true;
  watchSections();
}

/* ═════════ Просмотр картинки на весь экран ═════════ */
let vList = [], vI = 0, vOpen = false;
const viewer = $('viewer');
function vShow() {
  const p = vList[vI];
  const img = $('v-img');
  img.src = p.photo;
  img.alt = pageAlt(p);
  // текст блюда под фото: название, вес, цена, состав
  $('v-name').textContent = p.title || '';
  const chips = $('v-chips');
  chips.replaceChildren();
  if (p.weight) chips.append(el('span', 'v-chip', p.weight));
  if (p.price) chips.append(el('span', 'v-chip v-price', p.price));
  chips.hidden = !chips.children.length;
  const d = $('v-desc');
  d.replaceChildren();
  if (p.desc) { const b = el('b', '', 'Состав: '); d.append(b, p.desc); }
  d.hidden = !p.desc;
  $('v-info').hidden = !p.title;
  viewer.scrollTop = 0;
  $('v-count').textContent = `${vI + 1} из ${vList.length}`;
  $('v-prev').hidden = $('v-next').hidden = vList.length < 2;
  // соседние картинки — заранее, чтобы листалось без ожидания
  for (const d of [1, -1]) { const n = vList[(vI + d + vList.length) % vList.length]; if (n) { const im = new Image(); im.src = n.photo; } }
}
function openViewer(list, i) {
  vList = list; vI = i; vOpen = true;
  vShow();
  viewer.hidden = false;
  document.body.classList.add('is-locked');
  requestAnimationFrame(() => viewer.classList.add('on'));
  history.pushState({ pcViewer: 1 }, '');
}
function closeViewer(fromHistory) {
  if (!vOpen) return;
  vOpen = false;
  viewer.classList.remove('on');
  document.body.classList.remove('is-locked');
  setTimeout(() => { viewer.hidden = true; $('v-img').removeAttribute('src'); }, reduceMotion ? 0 : 220);
  if (!fromHistory && history.state && history.state.pcViewer) history.back();
}
const vStep = (d) => { vI = (vI + d + vList.length) % vList.length; vShow(); };
// кнопка «Назад» на телефоне закрывает картинку, а не уходит с сайта
window.addEventListener('popstate', () => closeViewer(true));
$('v-close').addEventListener('click', () => closeViewer());
$('v-prev').addEventListener('click', () => vStep(-1));
$('v-next').addEventListener('click', () => vStep(1));
$('v-stage').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeViewer(); });
document.addEventListener('keydown', (e) => {
  if (!vOpen) return;
  if (e.key === 'Escape') closeViewer();
  else if (e.key === 'ArrowLeft') vStep(-1);
  else if (e.key === 'ArrowRight') vStep(1);
});
let vX = null, vY = null;
$('v-stage').addEventListener('touchstart', (e) => { if (e.touches.length === 1) { vX = e.touches[0].clientX; vY = e.touches[0].clientY; } else vX = null; }, { passive: true });
$('v-stage').addEventListener('touchend', (e) => {
  if (vX === null) return;
  const dx = e.changedTouches[0].clientX - vX, dy = e.changedTouches[0].clientY - vY;
  vX = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) vStep(dx < 0 ? 1 : -1);
  else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) closeViewer(); // смахнуть вниз — закрыть
}, { passive: true });

/* ═════════ Вкладки ═════════ */
function renderTabs() {
  const inner = $('tabs-inner');
  const ink = $('tab-ink');
  tabEls = new Map();
  const frag = document.createDocumentFragment();
  const cats = tabCats();
  cats.forEach((c) => {
    const b = el('button', 'tab', c.name);
    b.type = 'button';
    b.dataset.cat = c.id;
    b.addEventListener('click', () => goTo(c.id));
    tabEls.set(c.id, b);
    frag.append(b);
  });
  inner.replaceChildren(ink, frag);
  $('tabs').hidden = !cats.length;
  activeId = null;
  if (cats.length) setActive(cats[0].id, false);
}

/* ═════════ Своя плавная прокрутка ═════════
   Встроенная smooth-прокрутка Chrome на телефоне обрывается, когда одновременно
   крутится полоса вкладок или прячется адресная строка. Поэтому и страницу,
   и полосу вкладок анимируем сами через requestAnimationFrame. */
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

let tabsAnim = 0;
function scrollTabsTo(left, animate) {
  const sc = $('tabs-scroll');
  cancelAnimationFrame(tabsAnim);
  tabsAnim = 0;
  const to = Math.max(0, Math.min(sc.scrollWidth - sc.clientWidth, left));
  const from = sc.scrollLeft;
  if (!animate || reduceMotion || Math.abs(to - from) < 2) { sc.scrollLeft = to; return; }
  const t0 = performance.now(), dur = 380;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    sc.scrollLeft = from + (to - from) * easeOut(t);
    tabsAnim = t < 1 ? requestAnimationFrame(step) : 0;
  };
  tabsAnim = requestAnimationFrame(step);
}
// палец на полосе вкладок — сразу отдаём её пальцу
$('tabs-scroll').addEventListener('touchstart', () => { cancelAnimationFrame(tabsAnim); tabsAnim = 0; }, { passive: true });

let inkFrame = 0;
function setActive(id, animate = true) {
  if (!id || id === activeId) return;
  const prev = tabEls.get(activeId);
  const tab = tabEls.get(id);
  activeId = id;
  if (!tab) return;
  prev && prev.classList.remove('on');
  tab.classList.add('on');
  const ink = $('tab-ink');
  cancelAnimationFrame(inkFrame);
  inkFrame = requestAnimationFrame(() => {
    ink.classList.toggle('no-anim', !animate || !ink.classList.contains('ready'));
    ink.style.transform = `translateX(${tab.offsetLeft}px)`;
    ink.style.width = tab.offsetWidth + 'px';
    ink.classList.add('ready');
    const sc = $('tabs-scroll');
    scrollTabsTo(tab.offsetLeft - (sc.clientWidth - tab.offsetWidth) / 2, animate);
  });
}
// Пересчёт только при смене ширины (поворот экрана). Адресная строка меняет лишь высоту.
let lastW = innerWidth;
window.addEventListener('resize', () => {
  if (innerWidth === lastW) return;
  lastW = innerWidth;
  const id = activeId; activeId = null; setActive(id, false);
}, { passive: true });

/* Активная секция — через IntersectionObserver на тонкой линии под шапкой.
   Никаких замеров при каждом событии скролла. */
let secIO = null;
let lockScroll = false;
let pendingId = null;
function watchSections() {
  secIO && secIO.disconnect();
  if (!sectionEls.length || !tabCats().length) return;
  const below = Math.max(0, innerHeight - stickyH - 2);
  secIO = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        pendingId = en.target.dataset.cat;
        if (!lockScroll) setActive(pendingId);
      }
    }
  }, { rootMargin: `-${stickyH + 1}px 0px -${below}px 0px` });
  sectionEls.forEach((s) => secIO.observe(s.el));
  // Блок контактов/отзывов под меню держит активной последнюю категорию
  const infoEl = $('info');
  if (!infoEl.hidden && sectionEls.length) {
    infoEl.dataset.cat = sectionEls[sectionEls.length - 1].id;
    secIO.observe(infoEl);
  }
}
let lastH = innerHeight;
window.addEventListener('resize', () => {
  if (Math.abs(innerHeight - lastH) > 80) { lastH = innerHeight; watchSections(); }
}, { passive: true });

let pageAnim = 0;
let navTarget = null;
let releaseT = 0;
function finishNav(completed) {
  const id = navTarget;
  navTarget = null;
  if (completed && id) { pendingId = id; setActive(id); }
  // держим блокировку ещё два кадра, чтобы запоздалые сигналы о промежуточных
  // категориях не перехватили подсветку
  cancelAnimationFrame(releaseT);
  releaseT = requestAnimationFrame(() => {
    releaseT = requestAnimationFrame(() => {
      lockScroll = false;
      if (!completed && pendingId) setActive(pendingId);
    });
  });
}
function stopPageAnim() {
  if (!pageAnim) return;
  cancelAnimationFrame(pageAnim);
  pageAnim = 0;
  finishNav(false);
}
// Посетитель сам взялся за экран — сразу отдаём прокрутку ему
for (const ev of ['touchstart', 'wheel', 'keydown']) {
  window.addEventListener(ev, (e) => {
    if (pageAnim && !(e.target && e.target.closest && e.target.closest('#tabs'))) stopPageAnim();
  }, { passive: true });
}

function goTo(id) {
  if (document.body.classList.contains('searching')) clearSearch(false);
  const s = sectionEls.find((x) => x.id === id);
  if (!s) return;
  cancelAnimationFrame(pageAnim);
  cancelAnimationFrame(releaseT);
  pageAnim = 0;
  setActive(id);
  lockScroll = true;
  navTarget = id;
  const maxY = () => document.documentElement.scrollHeight - innerHeight;
  const targetY = () => Math.max(0, Math.min(maxY(), s.el.getBoundingClientRect().top + scrollY - stickyH + 1));
  let to = targetY();
  let from = scrollY;
  if (reduceMotion || Math.abs(to - from) < 2) { window.scrollTo(0, to); finishNav(true); return; }
  // Далеко — мгновенно подходим ближе и плавно доезжаем последние ~1,2 экрана:
  // не нужно на лету рисовать десятки карточек между категориями
  const near = innerHeight * 1.2;
  if (Math.abs(to - from) > near) {
    from = to - Math.sign(to - from) * near;
    window.scrollTo(0, from);
  }
  const dur = Math.min(560, 260 + Math.abs(to - from) * 0.3);
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    to = targetY(); // если высота страницы изменилась по ходу — цель уточняется
    window.scrollTo(0, from + (to - from) * easeInOut(t));
    if (t < 1) pageAnim = requestAnimationFrame(step);
    else { pageAnim = 0; finishNav(true); }
  };
  pageAnim = requestAnimationFrame(step);
}

/* ═════════ Поиск: фильтр на месте ═════════ */
const searchInp = $('search');
let searchT = 0;
searchInp.addEventListener('input', () => {
  $('search-clear').classList.toggle('on', !!searchInp.value);
  clearTimeout(searchT);
  searchT = setTimeout(applySearch, 110);
});
searchInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchInp.blur(); if (e.key === 'Escape') clearSearch(); });
$('search-clear').addEventListener('click', () => {
  if (!searchInp.value && headerEl.classList.contains('search-on')) { headerEl.classList.remove('search-on'); return; }
  clearSearch(true);
});

const headerEl = $('header');
$('search-open').addEventListener('click', () => {
  headerEl.classList.add('search-on');
  searchInp.focus();
});
searchInp.addEventListener('blur', () => {
  setTimeout(() => { if (!searchInp.value && document.activeElement !== searchInp) headerEl.classList.remove('search-on'); }, 120);
});

function applySearch() {
  const raw = searchInp.value.trim();
  const q = norm(raw);
  const body = document.body;
  if (!q) {
    if (body.classList.contains('searching')) {
      body.classList.remove('searching');
      cardEls.forEach((c) => c.el.classList.remove('miss'));
      sectionEls.forEach((s) => s.el.classList.remove('miss'));
      $('search-bar').hidden = true;
      $('search-empty').hidden = true;
    }
    return;
  }
  const wasSearching = body.classList.contains('searching');
  body.classList.add('searching');
  const words = q.split(/\s+/);
  const hitBySec = new Map();
  let total = 0;
  for (const c of cardEls) {
    const ok = words.every((w) => c.hay.includes(w));
    c.el.classList.toggle('miss', !ok);
    if (ok) { total++; hitBySec.set(c.catId, true); }
  }
  sectionEls.forEach((s) => s.el.classList.toggle('miss', !hitBySec.get(s.id)));
  $('search-term').textContent = raw;
  $('search-count').textContent = total ? `${total} ${plural(total, 'блюдо', 'блюда', 'блюд')}` : 'Ничего';
  $('search-bar').hidden = false;
  $('search-empty').hidden = total > 0;
  if (!wasSearching) window.scrollTo({ top: 0 });
}
function clearSearch(focus) {
  searchInp.value = '';
  $('search-clear').classList.remove('on');
  applySearch();
  if (focus) searchInp.focus();
}


/* ═════════ Как нас найти · Отзывы ═════════ */
function yandexSrc(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/src\s*=\s*["']([^"']+)["']/i);
  let u = (m ? m[1] : s).replace(/&amp;/g, '&');
  if (u.startsWith('//')) u = 'https:' + u;
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:' || !/(^|\.)yandex\.(ru|com|by|kz|uz|net)$/.test(url.hostname)) return '';
    return url.href;
  } catch { return ''; }
}
const yaLink = (u) => (/^https:\/\/([a-z0-9-]+\.)*yandex\.(ru|com|by|kz|uz)\//i.test(u || '') ? u : '');

// Карта и отзывы Яндекса грузятся только после нажатия посетителя (условия Яндекс Карт, п. 8.1).
// Согласие запоминается в этом браузере — при следующих заходах виджеты грузятся сами, когда до них долистали.
const YA_OK = 'pc_ya_consent';
let yaConsent = false;
try { yaConsent = localStorage.getItem(YA_OK) === '1'; } catch {}

function loadFrame(box) {
  const src = box.dataset.src;
  if (!src || box.querySelector('iframe')) return;
  const f = document.createElement('iframe');
  f.src = src;
  f.title = box.id === 'map-box' ? 'Плов Центр на карте' : 'Отзывы о Плов Центре';
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  f.allowFullscreen = box.id === 'map-box';
  f.addEventListener('load', () => { f.classList.add('ready'); box.classList.add('loaded'); });
  box.insertBefore(f, box.querySelector('.map-shield'));
}

const frameIO = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting || !yaConsent) continue;
    frameIO.unobserve(en.target);
    loadFrame(en.target);
  }
}, { rootMargin: '600px 0px' });

document.querySelectorAll('[data-ya-load]').forEach((btn) => btn.addEventListener('click', () => {
  yaConsent = true;
  try { localStorage.setItem(YA_OK, '1'); } catch {}
  const box = btn.closest('.map-box, .rev-box');
  btn.disabled = true;
  btn.textContent = 'Загружается…';
  loadFrame(box);
}));

function setFrame(box, src) {
  box.hidden = !src;
  if (!src || box.dataset.src === src) return;
  box.dataset.src = src;
  const old = box.querySelector('iframe');
  if (old) old.remove();
  box.classList.remove('loaded');
  const btn = box.querySelector('[data-ya-load]');
  if (btn) { btn.disabled = false; btn.textContent = box.id === 'map-box' ? 'Показать карту' : 'Показать отзывы'; }
  frameIO.observe(box);
}

function renderInfo() {
  const c = info || {};
  const showC = !!c.showContacts;
  const showR = !!c.showReviews;
  const wasHidden = $('info').hidden;
  $('info').hidden = !(showC || showR);
  document.body.classList.toggle('has-info', showC || showR);
  if (wasHidden !== $('info').hidden && rendered) watchSections();

  // Контакты
  $('info-contacts').hidden = !showC;
  if (showC) {
    const addr = (c.address || '').trim();
    $('i-addr').textContent = addr;
    $('i-addr-row').hidden = !addr;

    const hw = (c.hoursWeek || '').trim(), he = (c.hoursWeekend || '').trim();
    const hrs = $('i-hours');
    hrs.replaceChildren();
    if (hw && he && hw.toLowerCase() !== he.toLowerCase()) {
      hrs.append(`Пн–Пт: ${hw}`, document.createElement('br'), `Сб–Вс: ${he}`);
    } else hrs.textContent = hw || he;
    $('i-hours-row').hidden = !(hw || he);

    const phone = (c.phone || '').trim();
    const digits = phone.replace(/\D/g, '').replace(/^8(?=\d{10}$)/, '7');
    $('i-phone').textContent = phone;
    $('i-phone-row').hidden = !phone;
    $('i-call').hidden = !digits;
    if (digits) $('i-call').href = 'tel:+' + digits;
    $('i-wa').hidden = !(digits && c.whatsapp);
    if (digits) $('i-wa').href = 'https://wa.me/' + digits;

    const yaUrl = yaLink(c.yandexUrl);
    const route = yaUrl || (addr ? 'https://yandex.ru/maps/?text=' + encodeURIComponent('Плов Центр, ' + addr) : '');
    $('i-route').hidden = !route;
    if (route) $('i-route').href = route;

    const mapSrc = yandexSrc(c.mapsEmbed);
    setFrame($('map-box'), mapSrc);
    $('map-box').parentNode.classList.toggle('solo', !mapSrc);
  }

  // Отзывы
  $('info-reviews').hidden = !showR;
  if (showR) {
    const yaUrl = yaLink(c.yandexUrl);
    setFrame($('rev-box'), yandexSrc(c.reviewsEmbed));
    $('i-rev-all').hidden = !yaUrl;
    if (yaUrl) $('i-rev-all').href = yaUrl;
  }
}

// Карта на телефоне: сначала тап, потом можно двигать — иначе палец «застревает» в карте при прокрутке меню
$('map-shield').addEventListener('click', (e) => { e.currentTarget.remove(); });

/* ═════════ Кэш IndexedDB (навсегда) + проверка версии ═════════
   При заходе читается только крошечный документ meta/menu.
   Версия совпала — меню берётся из телефона, сеть не нужна. */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('plovcenter', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  try {
    const d = await idb();
    return await new Promise((res) => {
      const q = d.transaction('kv').objectStore('kv').get(key);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => res(null);
    });
  } catch { return null; }
}
async function idbSet(key, val) {
  try {
    const d = await idb();
    await new Promise((res) => {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(val, key);
      tx.oncomplete = res; tx.onerror = res;
    });
  } catch {}
}

async function getJSON(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal, credentials: 'same-origin' });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  } finally { clearTimeout(t); }
}

/* ═════════ Свежая версия сайта после обновления ═════════
   В menu.json лежит номер сборки сайта (build), в странице — свой.
   Если на сервере сборка новее, чем открытая страница, страница один раз
   перезагружается и берёт новые файлы. */
const PAGE_BUILD = Number((document.querySelector('meta[name="pc-build"]') || {}).content || 0);
function checkBuild(j) {
  const b = Number(j && j.build) || 0;
  if (!b || b <= PAGE_BUILD) return false;
  const key = 'pc_reload_' + b;
  try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, '1'); } catch { return false; }
  const go = () => location.reload();
  if (swReady) swReady.then((r) => (r ? r.update().catch(() => {}) : null)).finally(go);
  else go();
  return true;
}

async function load() {
  try { localStorage.removeItem('plovcenter_menu_cache'); } catch {}
  const cached = await idbGet(CACHE_KEY);
  if (cached && Array.isArray(cached.dishes)) {
    categories = cached.categories || [];
    dishes = cached.dishes;
    info = cached.info || null;
    style = cached.style === 'pages' ? 'pages' : 'cards';
    pcats = cached.pcats || [];
    pages = cached.pages || [];
    render();
    renderInfo();
  }

  try {
    // сначала только номер версии — крошечный ответ
    if (cached) {
      try {
        const chk = await getJSON('menu.json?check=' + Date.now());
        if (checkBuild(chk)) return;
        const v = chk.v;
        if (v && cached.v === v) { keepOffline(); return; } // меню не менялось — всё уже на экране
      } catch {}
    }
    const j = await getJSON('menu.json?t=' + Date.now());
    if (checkBuild(j)) return;
    categories = j.categories || [];
    dishes = (j.dishes || []).sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity));
    info = j.info || null;
    style = j.style === 'pages' ? 'pages' : 'cards';
    pcats = j.pcats || [];
    pages = j.pages || [];
    render();
    renderInfo();
    idbSet(CACHE_KEY, { v: j.v, categories, dishes, info, style, pcats, pages });
    keepOffline();
  } catch (e) {
    console.error(e);
    if (!rendered) {
      $('sections').replaceChildren();
      $('tabs').hidden = true;
      $('load-error').hidden = false;
    }
  }
}
$('retry').addEventListener('click', () => {
  $('load-error').hidden = true;
  load();
});


/* ═════════ Всё меню — в телефон ═════════
   Служебный помощник браузера (sw.js) хранит страницу, шрифты и все картинки меню.
   При первом заходе картинки докачиваются в фоне, понемногу; при следующих
   заходах всё открывается сразу из телефона, даже при плохой связи. */
let swReady = null;
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // если помощник браузера обновился (вышла новая версия сайта) — страница один раз перезагружается
  const hadController = !!navigator.serviceWorker.controller;
  let swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || swReloaded) return;
    swReloaded = true;
    location.reload();
  });
  swReady = navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then(() => navigator.serviceWorker.ready).catch(() => null);
}
let offT = 0;
function keepOffline() {
  if (!swReady) return;
  clearTimeout(offT);
  offT = setTimeout(async () => {
    const reg = await swReady;
    if (!reg || !reg.active) return;
    const list = style === 'pages' ? pages.map((p) => p.photo) : dishes.map((d) => d.photo);
    const urls = [...new Set(list.filter((u) => typeof u === 'string' && u.startsWith('uploads/')))];
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    reg.active.postMessage({ type: 'keep', urls, fetch: !saveData });
  }, 2500); // сначала дорисовываем то, что на экране
}

load();
