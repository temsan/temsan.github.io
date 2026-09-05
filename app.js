/* ==========================================================
   Слепок мышления — живопись, которая складывается в смысл
   Мазки подчиняются силуэту: из хаоса проступает профиль
   ========================================================== */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Перлин-шум ---------- */

function makePerlin() {
  const p = new Uint8Array(512);
  const src = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [src[i], src[j]] = [src[j], src[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = src[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const grad = (hash, x, y) => {
    switch (hash & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  };

  return function noise(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
  };
}

/* ---------- Палитра ---------- */

const DEEP = [
  { h: 220, s: 74, l: 30, w: 28 },  // ультрамарин, небесно-голубой
  { h: 198, s: 60, l: 20, w: 22 },  // глубокая вода
  { h: 205, s: 68, l: 42, w: 22 },  // кобальт морской
  { h: 178, s: 46, l: 34, w: 14 },  // цвет моря — тёмная бирюза
  { h: 196, s: 62, l: 54, w: 8 },   // церулеум
  { h: 38,  s: 62, l: 52, w: 6 },   // солнечный блик на воде
];

const AIR = [
  { h: 198, s: 42, l: 78, w: 32 },  // разбел, небо
  { h: 210, s: 34, l: 70, w: 24 },  // холодный воздух
  { h: 192, s: 48, l: 62, w: 20 },  // церулеум разбавленный
  { h: 172, s: 34, l: 66, w: 10 },  // цвет моря, разбавленный
  { h: 42,  s: 52, l: 72, w: 12 },  // тёплый просвет облаков
];

function weightedPick(list) {
  const total = list.reduce((s, c) => s + c.w, 0);
  let r = Math.random() * total;
  for (const c of list) { r -= c.w; if (r <= 0) return c; }
  return list[0];
}

function jitter(c, amount = 1) {
  return {
    h: c.h + (Math.random() - 0.5) * 14 * amount,
    s: Math.min(95, Math.max(16, c.s + (Math.random() - 0.5) * 18 * amount)),
    l: Math.min(94, Math.max(8, c.l + (Math.random() - 0.5) * 16 * amount)),
  };
}

const hsla = (c, a) => `hsla(${c.h.toFixed(1)}, ${c.s.toFixed(1)}%, ${c.l.toFixed(1)}%, ${a})`;

/* ---------- Детерминированный ГСЧ ---------- */

function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Акварельная заливка ---------- */

/* Форма лепестков — не Math.random() внутри, а либо разовая генерация
   (одиночная заливка), либо переданная извне фиксированная форма.
   Разводу, который перерисовывается 60 раз в секунду, нельзя каждый
   кадр менять контур заново — иначе он не дрейфует, а трясётся.       */
function randomWashShape() {
  // больше лепестков и мягче разброс радиуса — контур ближе к овалу,
  // без острых граней, которые вылезали при крупном размере пятна
  const lobes = 12 + ((Math.random() * 6) | 0);
  const ratios = Array.from({ length: lobes }, () => 0.82 + Math.random() * 0.34);
  return { lobes, ratios };
}

function paintWash(ctx, x, y, radius, color, alpha, blend = 'multiply', shape = null) {
  const s = shape || randomWashShape();
  const pts = s.ratios.map((ratio, i) => {
    const a = (i / s.lobes) * Math.PI * 2;
    const r = radius * ratio;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });

  /* Лепестки сужаются вплоть до 0.82 радиуса — если краска доходит
     до самого radius, путь заливки обрежет её ненулевой, и получится
     чёткий векторный край вместо мягкого. Поэтому градиент гаснет
     в ноль на 0.7, с запасом раньше любого лепестка.                */
  const grad = ctx.createRadialGradient(x, y, radius * 0.05, x, y, radius);
  grad.addColorStop(0, hsla(color, alpha));
  grad.addColorStop(0.32, hsla(color, alpha * 0.62));
  grad.addColorStop(0.55, hsla(color, alpha * 0.24));
  grad.addColorStop(0.7, hsla(color, 0));

  ctx.save();
  ctx.globalCompositeOperation = blend;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[s.lobes - 1][0]) / 2, (pts[0][1] + pts[s.lobes - 1][1]) / 2);
  for (let i = 0; i < s.lobes; i++) {
    const cur = pts[i], next = pts[(i + 1) % s.lobes];
    ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
  }
  ctx.closePath();
  ctx.fill();
  /* Обводки нет: край и так тает до нуля в градиенте, а тонкая линия
     поверх десятков накладывающихся пятен читалась не мягким краем,
     а сеткой чётких окружностей — прямая противоположность акварели. */
  ctx.restore();
}

/* ---------- Течения: curl-шум поверх Перлина ----------
   Скалярный шум трактуется как функция тока: перпендикулярный градиент
   даёт бездивергентное векторное поле — течения закручиваются сами
   на себя, а не утекают в никуда, как обычный шумовой дрейф.          */
function curl(noise, x, y, eps = 0.6) {
  const n1 = noise(x, y + eps), n2 = noise(x, y - eps);
  const n3 = noise(x + eps, y), n4 = noise(x - eps, y);
  const dy = (n1 - n2) / (2 * eps);
  const dx = (n3 - n4) / (2 * eps);
  return [dy, -dx];
}

/* ---------- Полотно: акварельные разводы и течения ----------
   Не сетка мазков, а живые пятна: каждое дрейфует по curl-полю шума,
   растёт, живёт и медленно тает обратно в бумагу. Курсор не рисует —
   он тревожит воду: рождает свежие разводы и толкает соседние прочь. */
function createWatercolor(canvas, options = {}) {
  const {
    // бюджет разводов считаем от площади холста, а не фиксированным числом:
    // hero на весь экран и невысокая полоса CTA иначе получали одинаковую
    // плотность — на CTA вода превращалась в сплошное бликующее пятно
    areaPerBloom = 42000,
    minCount = 14,
    maxCount = 52,
    driftSpeed = 14,       // масштаб скорости течения
    scale = 0.0016,        // крупный, медленный узор завихрений
    fadeAlpha = 0.035,     // как быстро прежний кадр тает в бумагу
    paper = { h: 228, s: 62, l: 17 },   // тон бумаги/глубокой воды
    interactive = false,
    onPaint = null,
  } = options;

  const ctx = canvas.getContext('2d');
  const noise = makePerlin();
  let w, h, dpr, raf = null, blooms = [], lastFrame = 0, frameTick = 0;

  function resize() {
    // 1.5 хватает живописи и вдвое дешевле по заливке, чем 2
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const rect = canvas.getBoundingClientRect();
    w = rect.width; h = rect.height;
    if (!w || !h) return false;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function budget() {
    // на телефоне холст физически меньше, площадь уже сама снижает число —
    // дополнительно ужимаем зону на бloom, там курсора нет и глаз ближе к экрану
    const per = window.innerWidth < 760 ? areaPerBloom * 1.5 : areaPerBloom;
    return Math.max(minCount, Math.min(maxCount, Math.round((w * h) / per)));
  }

  function spawnBloom(x, y) {
    const dark = Math.random() > 0.45;
    return {
      x: x ?? Math.random() * w,
      y: y ?? Math.random() * h,
      vx: 0, vy: 0,
      r: 0,
      rMax: Math.min(w, h) * (0.14 + Math.random() * 0.3),
      color: jitter(weightedPick(dark ? DEEP : AIR), 1),
      shape: randomWashShape(),
      age: 0,
      life: 14000 + Math.random() * 16000,
      alpha: 0,
    };
  }

  function ensurePopulation() {
    const n = budget();
    while (blooms.length < n) blooms.push(spawnBloom());
    // лишнее срезаем с начала: в хвосте — свежие разводы от курсора,
    // их терять нельзя, иначе взаимодействие с водой не будет заметно
    if (blooms.length > n) blooms.splice(0, blooms.length - n);
  }

  function updateBloom(b, dt) {
    b.age += dt;
    if (b.age > b.life) { Object.assign(b, spawnBloom()); return; }

    const [cx, cy] = curl(noise, b.x * scale, b.y * scale);
    // тяжёлое сглаживание скорости: течения поворачивают, а не дёргаются
    b.vx += (cx * driftSpeed - b.vx) * 0.02;
    b.vy += (cy * driftSpeed - b.vy) * 0.02;
    b.x += (b.vx * dt) / 1000;
    b.y += (b.vy * dt) / 1000;

    // вода не убегает с холста — заворачивает через край
    if (b.x < -b.rMax) b.x = w + b.rMax;
    if (b.x > w + b.rMax) b.x = -b.rMax;
    if (b.y < -b.rMax) b.y = h + b.rMax;
    if (b.y > h + b.rMax) b.y = -b.rMax;

    const t = b.age / b.life;
    b.r = b.rMax * Math.min(1, t / 0.12);
    // разгорается, живёт, тает — как настоящий развод, а не мигающая точка
    b.alpha = t < 0.12 ? t / 0.12 : t > 0.75 ? Math.max(0, 1 - (t - 0.75) / 0.25) : 1;
  }

  function drawBloom(b) {
    if (b.r < 1) return;
    /* Обычная прозрачность, не screen/multiply: каждый живой развод
       перерисовывается заново каждый кадр (дрейф), а у screen поверх
       той же самой точки нет устойчивой точки, кроме белого — за
       несколько секунд любой светлый развод накопительно выбеливается
       в сплошное пятно. source-over такого не делает: устойчивая точка —
       собственный цвет мазка, поэтому холст не «выгорает» со временем.  */
    paintWash(ctx, b.x, b.y, b.r, b.color, b.alpha * 0.32, 'source-over', b.shape);
  }

  function drawFrame(dt) {
    ctx.fillStyle = hsla(paper, fadeAlpha);
    ctx.fillRect(0, 0, w, h);
    ensurePopulation();
    for (const b of blooms) { updateBloom(b, dt); drawBloom(b); }
  }

  function frame(now) {
    drawFrame(Math.min(48, now - (lastFrame || now)));
    lastFrame = now;

    // буквы заголовка не должны отставать от плывущего фона, но и не нужно
    // синхронизировать каждый кадр — это лишний getImageData на каждый тик
    frameTick = (frameTick + 1) % 6;
    if (frameTick === 0 && onPaint) onPaint();

    raf = requestAnimationFrame(frame);
  }

  // reduceMotion: без цикла — один взрослый, устоявшийся кадр
  function settle() {
    blooms = Array.from({ length: budget() }, () => {
      const b = spawnBloom();
      b.age = b.life * (0.3 + Math.random() * 0.4);
      b.r = b.rMax;
      b.alpha = 0.4 + Math.random() * 0.45;
      return b;
    });
    ctx.fillStyle = hsla(paper, 1);
    ctx.fillRect(0, 0, w, h);
    for (const b of blooms) drawBloom(b);
    if (onPaint) onPaint();
  }

  function start() {
    if (!resize()) return;
    /* Без рассинхронизации все разводы рождаются в один и тот же кадр
       и растут строго синхронно — читается как общий пульс, а не как
       вода. Стартовый возраст берём случайным по всей длине жизни. */
    blooms = Array.from({ length: budget() }, () => {
      const b = spawnBloom();
      b.age = Math.random() * b.life;
      return b;
    });
    ctx.fillStyle = hsla(paper, 1);
    ctx.fillRect(0, 0, w, h);
    cancelAnimationFrame(raf);
    if (reduceMotion) {
      settle();
    } else {
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  /* Курсор и палец тревожат воду: рождают свежие разводы и толкают
     ближайшие прочь, как капля, упавшая в лужу.                     */
  if (interactive && !reduceMotion) {
    let last = 0;

    const disturb = (clientX, clientY, strong) => {
      const now = performance.now();
      if (!strong && now - last < 40) return;
      last = now;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left, y = clientY - rect.top;
      if (x < 0 || y < 0 || x > w || y > h) return;

      const fresh = strong ? 4 + ((Math.random() * 3) | 0) : 1 + ((Math.random() * 2) | 0);
      for (let i = 0; i < fresh; i++) {
        blooms.push(spawnBloom(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30));
      }

      const near = [...blooms]
        .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
        .slice(0, strong ? 8 : 4);
      for (const b of near) {
        const dx = b.x - x, dy = b.y - y, dist = Math.hypot(dx, dy) || 1;
        const push = (strong ? 90 : 40) / dist;
        b.vx += (dx / dist) * push;
        b.vy += (dy / dist) * push;
      }
    };

    const host = canvas.parentElement;
    host.addEventListener('pointerdown', (e) => disturb(e.clientX, e.clientY, true));
    host.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' && e.buttons === 0 && e.pressure === 0) return;
      disturb(e.clientX, e.clientY, false);
    });
  }

  /* Мобильные браузеры шлют resize, когда прячется адресная строка.
     Перерисовывать по этому поводу нельзя — иначе течение дёргается
     прямо во время прокрутки.                                       */
  let resizeTimer, lastW = 0, lastH = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const rect = canvas.getBoundingClientRect();
      const bigChange = Math.abs(rect.width - lastW) > 24 || Math.abs(rect.height - lastH) > 180;
      lastW = rect.width; lastH = rect.height;
      if (!bigChange) return;
      start();
    }, 260);
  });

  return { start };
}

/* ---------- Запуск ---------- */

function initScenes() {
  const hero = document.getElementById('paint-hero');
  if (hero) {
    createWatercolor(hero, {
      interactive: true,
      paper: { h: 230, s: 64, l: 16 },   // тон, что и фон .hero в CSS
      onPaint: () => window.__retintHeadline?.(),
    }).start();
  }

  const cta = document.getElementById('paint-cta');
  if (cta) {
    createWatercolor(cta, {
      paper: { h: 224, s: 68, l: 13 },   // тон, что и var(--ultra-ink)
    }).start();
  }
}

/* Живопись тяжёлая: если запустить её сразу, она соперничает с первой
   отрисовкой страницы и портит мобильные метрики. Ждём, пока браузер
   покажет разметку, и запускаем в простое — с потолком по времени,
   чтобы на занятом устройстве течения всё равно появились. */
if ('requestIdleCallback' in window) {
  requestIdleCallback(initScenes, { timeout: 1200 });
} else {
  setTimeout(initScenes, 200);
}

/* ---------- Вкладки кейсов ----------
   Скрытая панель невидима для наблюдателя появления, поэтому её содержимое
   так и осталось бы прозрачным. При открытии показываем всё сразу. */

(function caseTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  if (!tabs.length) return;

  const show = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (!panel) return;
      panel.hidden = !on;
      if (on) panel.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
    });
  };

  // ссылки подменю ведут в секцию и сразу открывают свой кейс
  document.querySelectorAll('.nav-sub a[data-tab]').forEach((link) => {
    link.addEventListener('click', () => {
      const tab = document.getElementById(link.dataset.tab);
      if (tab) show(tab);
    });
  });

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => show(tab));
    tab.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus();
      show(next);
    });
  });
})();

/* ---------- Уход на самый верх ----------
   Якорь #top упирается в липкую шапку и не докручивает страницу до конца,
   поэтому имя и ссылка «Наверх» скроллят к нулю напрямую и без анимации. */

(function scrollToTop() {
  document.querySelectorAll('a[href="#top"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'auto' });
      if (history.replaceState) history.replaceState(null, '', location.pathname);
    });
  });
})();

/* ---------- Появление секций ---------- */

(function revealOnScroll() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  if (reduceMotion) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  items.forEach((el) => io.observe(el));
})();

/* ---------- Прогресс чтения ---------- */

(function readingProgress() {
  const bar = document.querySelector('.progress-bar');
  if (!bar) return;
  let ticking = false;

  function update() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
})();

/* ---------- Буквы, залитые живописью ----------
   Вычитание (difference) работает попиксельно — потому в буквах и жила
   фактура мазка. Но вычитание жёстко задаёт пол-круга по тону: над
   ультрамарином буквы неизбежно охристые, повлиять на это нельзя.

   Здесь то же самое, но управляемо: берётся копия холста, у неё
   поворачивается тон на заданную долю круга и правится светлота, а затем
   всё это обрезается по контуру букв. Фактура остаётся, тон — на выбор.

   HUE_SHIFT — доля круга (1/2 — та же инверсия, 1/6 — родственный тон).
   INK_MODE  — как краска ложится на холст:
     'invert'   — светлота вывернута, буквы светятся (ближе к прежнему);
     'multiply' — умножение, буквы уходят в глубокий тон холста;
     'screen'   — осветление, буквы дымчатые.
   Оба параметра меняются вживую: data-hue-shift и data-ink-mode на <html>. */

const HUE_SHIFT = 0;          // подобрано вживую: тон холста без поворота
const INK_MODE = 'screen';

(function inkHeadline() {
  const hero = document.querySelector('.hero');
  const paint = document.getElementById('paint-hero');
  const title = document.querySelector('.hero-title');
  const lines = [...document.querySelectorAll('.hero-title .line')];
  if (!hero || !paint || !title || !lines.length) return;

  const ink = document.createElement('canvas');
  const ictx = ink.getContext('2d', { willReadFrequently: true });
  // без canvas-фильтров затея не работает — остаёмся на вычитании
  if (!ictx || typeof ictx.filter !== 'string') return;

  ink.className = 'hero-ink';
  ink.setAttribute('aria-hidden', 'true');
  hero.appendChild(ink);
  hero.classList.add('ink-canvas');

  const mask = document.createElement('canvas');
  const mctx = mask.getContext('2d');

  // светлота решает читаемость, поэтому у каждого режима она своя
  const MODES = {
    invert: { lum: (l) => 1 - l, sat: 1.0, blend: 'normal' },
    multiply: { lum: (l) => 0.5 + (1 - l) * 0.55, sat: 1.15, blend: 'multiply' },
    screen: { lum: (l) => (1 - l) * 0.55, sat: 1.1, blend: 'screen' },
  };

  // живые параметры: ими правит панель настройки (?tune)
  const settings = {
    shift: parseFloat(document.documentElement.dataset.hueShift) || HUE_SHIFT,
    mode: document.documentElement.dataset.inkMode || INK_MODE,
    sat: 0.95,     // множитель насыщенности
    lift: -0.1,    // сдвиг светлоты
    contrast: 0.2, // растяжка светлоты вокруг середины: почти ровный тон
    alpha: 1,      // прозрачность слоя
  };

  function hslToRgb(h, s, l) {
    if (!s) { const v = l * 255; return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const k = (t) => {
      if (t < 0) t += 1; else if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [k(h + 1 / 3) * 255, k(h) * 255, k(h - 1 / 3) * 255];
  }

  /* Честный поворот по цветовому кругу: canvas-фильтр hue-rotate —
     линейная матрица, на насыщенных цветах она уводит тон и гасит цвет. */
  function shiftPixels(img, turn, mode) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const delta = max - min;

      let h = 0, s = 0;
      if (delta) {
        s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
        if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / delta + 2) / 6;
        else h = ((r - g) / delta + 4) / 6;
      }

      let v = mode.lum(l);
      v = 0.5 + (v - 0.5) * settings.contrast + settings.lift;

      const [nr, ng, nb] = hslToRgb(
        (h + turn + 1) % 1,
        Math.min(1, s * mode.sat * settings.sat),
        Math.min(1, Math.max(0, v)),
      );
      d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
    }
  }

  function draw() {
    const box = hero.getBoundingClientRect();
    if (!box.width || !box.height) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = Math.round(box.width * dpr);
    const H = Math.round(box.height * dpr);
    if (ink.width !== W || ink.height !== H) { ink.width = W; ink.height = H; }

    const shift = settings.shift;
    const mode = MODES[settings.mode] || MODES.invert;

    ictx.setTransform(1, 0, 0, 1, 0, 0);
    ictx.clearRect(0, 0, W, H);

    // 1. копия живописи
    ictx.drawImage(paint, 0, 0, W, H);

    // 2. поворот тона — только там, где стоят буквы: считать весь экран незачем
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    lines.forEach((line) => {
      const r = line.getBoundingClientRect();
      x0 = Math.min(x0, r.left - box.left); x1 = Math.max(x1, r.right - box.left);
      y0 = Math.min(y0, r.top - box.top);   y1 = Math.max(y1, r.bottom - box.top);
    });
    const bx = Math.max(0, Math.floor(x0 * dpr) - 2);
    const by = Math.max(0, Math.floor(y0 * dpr) - 2);
    const bw = Math.min(W - bx, Math.ceil((x1 - x0) * dpr) + 4);
    const bh = Math.min(H - by, Math.ceil((y1 - y0) * dpr) + 4);
    if (bw > 1 && bh > 1) {
      const img = ictx.getImageData(bx, by, bw, bh);
      shiftPixels(img, shift, mode);
      ictx.putImageData(img, bx, by);
    }

    // 3. маска из букв — все строки разом: destination-in режет на каждый
    //    вызов, и последовательные строки дали бы пустое пересечение
    if (mask.width !== W || mask.height !== H) { mask.width = W; mask.height = H; }
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, W, H);
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.fillStyle = '#000';
    mctx.textAlign = 'right';
    mctx.textBaseline = 'middle';

    const cs = getComputedStyle(title);
    mctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ('letterSpacing' in mctx) mctx.letterSpacing = cs.letterSpacing;

    lines.forEach((line) => {
      const r = line.getBoundingClientRect();
      mctx.fillText(
        line.textContent.toUpperCase(),
        r.right - box.left,
        r.top - box.top + r.height / 2,
      );
    });

    // 4. обрезаем живопись по маске
    ictx.setTransform(1, 0, 0, 1, 0, 0);
    ictx.globalCompositeOperation = 'destination-in';
    ictx.drawImage(mask, 0, 0);
    ictx.globalCompositeOperation = 'source-over';
    ink.style.mixBlendMode = mode.blend;
    ink.style.opacity = settings.alpha;
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; draw(); });
  }

  window.__retintHeadline = schedule;   // холст зовёт сюда, когда дописан
  window.__ink = { settings, modes: Object.keys(MODES), redraw: schedule };
  window.addEventListener('resize', schedule);
  if (document.fonts) document.fonts.ready.then(schedule);

  // кисть переписывает холст под курсором — заливка догоняет
  let last = 0;
  paint.addEventListener('pointermove', () => {
    const now = performance.now();
    if (now - last < 120) return;
    last = now;
    schedule();
  }, { passive: true });

  schedule();
})();

/* ---------- ВРЕМЕННОЕ: панель настройки заголовка ----------
   Включается только адресом ?tune — на обычной странице её нет.
   Когда значения устроят, панель удаляется целиком, а числа
   переносятся в HUE_SHIFT / INK_MODE и в settings выше.        */

(function tunePanel() {
  if (!/[?&]tune\b/.test(location.search)) return;
  const ink = window.__ink;
  if (!ink) return;

  const FIELDS = [
    // крутим в градусах: доля круга дробная, ползунок на ней врёт шагом
    {
      key: 'shift', label: 'Сдвиг тона', min: 0, max: 180, step: 1,
      get: (v) => v * 360, set: (deg) => deg / 360,
      fmt: (v) => (v > 0.001 ? `${Math.round(v * 360)}°  ·  1/${(1 / v).toFixed(1)}` : '0°  ·  в тон'),
    },
    { key: 'sat', label: 'Насыщенность', min: 0, max: 2, step: 0.05 },
    { key: 'lift', label: 'Светлота', min: -0.4, max: 0.4, step: 0.02 },
    { key: 'contrast', label: 'Контраст', min: 0.2, max: 2.2, step: 0.05 },
    { key: 'alpha', label: 'Прозрачность', min: 0.2, max: 1, step: 0.02 },
  ];

  const box = document.createElement('div');
  box.style.cssText = `
    position: fixed; right: 18px; bottom: 18px; z-index: 999;
    width: 260px; padding: 16px 16px 14px;
    background: rgba(13, 20, 64, 0.92); color: #eee9dc;
    font: 12px/1.4 system-ui, sans-serif; border-radius: 10px;
    box-shadow: 0 18px 40px -18px rgba(0,0,0,0.8); backdrop-filter: blur(8px);
  `;

  const head = document.createElement('div');
  head.textContent = 'Заголовок над холстом';
  head.style.cssText = 'font-weight:600;margin-bottom:12px;letter-spacing:.04em;text-transform:uppercase;font-size:10.5px;opacity:.75';
  box.appendChild(head);

  // режим наложения
  const modeRow = document.createElement('div');
  modeRow.style.cssText = 'display:flex;gap:6px;margin-bottom:14px';
  ink.modes.forEach((m) => {
    const b = document.createElement('button');
    b.textContent = m;
    b.style.cssText = 'flex:1;padding:6px 4px;border:1px solid rgba(238,233,220,.25);background:none;color:inherit;border-radius:6px;cursor:pointer;font:inherit';
    b.onclick = () => {
      ink.settings.mode = m;
      [...modeRow.children].forEach((c) => { c.style.background = 'none'; });
      b.style.background = 'rgba(217,164,65,.35)';
      ink.redraw(); dump();
    };
    if (m === ink.settings.mode) b.style.background = 'rgba(217,164,65,.35)';
    modeRow.appendChild(b);
  });
  box.appendChild(modeRow);

  const out = document.createElement('code');
  out.style.cssText = 'display:block;margin-top:12px;padding-top:10px;border-top:1px solid rgba(238,233,220,.18);font-size:10.5px;line-height:1.6;opacity:.8;word-break:break-all';

  function dump() {
    const s = ink.settings;
    out.textContent = `mode:'${s.mode}' shift:${s.shift.toFixed(4)} sat:${s.sat.toFixed(2)} lift:${s.lift.toFixed(2)} contrast:${s.contrast.toFixed(2)} alpha:${s.alpha.toFixed(2)}`;
  }

  FIELDS.forEach((f) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin-bottom:10px';
    const cap = document.createElement('span');
    cap.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:3px;opacity:.8';
    const val = document.createElement('b');
    const set = () => {
      val.textContent = f.fmt ? f.fmt(ink.settings[f.key]) : ink.settings[f.key].toFixed(2);
    };
    cap.append(Object.assign(document.createElement('span'), { textContent: f.label }), val);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = f.min; input.max = f.max; input.step = f.step;
    input.value = f.get ? f.get(ink.settings[f.key]) : ink.settings[f.key];
    input.style.cssText = 'width:100%;accent-color:#d9a441';
    input.oninput = () => {
      const raw = parseFloat(input.value);
      ink.settings[f.key] = f.set ? f.set(raw) : raw;
      set(); ink.redraw(); dump();
    };

    set();
    row.append(cap, input);
    box.appendChild(row);
  });

  box.appendChild(out);
  dump();
  document.body.appendChild(box);
})();

/* ---------- Активный раздел ---------- */

(function navHighlight() {
  const links = [...document.querySelectorAll('.main-nav > a, .main-nav > .nav-item > a')];
  const targets = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  if (!targets.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((l) => l.classList.remove('is-active'));
      const active = links.find((l) => l.getAttribute('href') === `#${entry.target.id}`);
      if (active) active.classList.add('is-active');
    });
    // узкая полоса по центру экрана: активна секция, которая её пересекает.
    // порог по доле высоты не годится — высокие секции его не набирают
  }, { threshold: 0, rootMargin: '-49% 0px -49% 0px' });

  targets.forEach((t) => io.observe(t));
})();

/* ---------- Линия процесса ---------- */

(function processLine() {
  const list = document.querySelector('.process-list');
  if (!list || reduceMotion) return;
  let ticking = false;

  function update() {
    const rect = list.getBoundingClientRect();
    const start = window.innerHeight * 0.8;
    const total = rect.height + start - window.innerHeight * 0.3;
    const passed = Math.min(Math.max(start - rect.top, 0), total);
    list.style.setProperty('--line-progress', `${(passed / total) * 100}%`);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
})();
