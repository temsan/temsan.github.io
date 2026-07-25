/* ==========================================================
   Слепок мышления — масляная живопись в браузере
   Генеративные мазки: щетина, импасто, подмешивание цвета
   ========================================================== */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Перлин-шум для направления мазков ---------- */

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

/* ---------- Палитра: ультрамарин и его семья ---------- */

const PALETTE = [
  { h: 228, s: 74, l: 30, w: 26 },  // ультрамарин, основа
  { h: 232, s: 68, l: 22, w: 20 },  // глубокая тень
  { h: 220, s: 70, l: 42, w: 18 },  // кобальт
  { h: 208, s: 66, l: 55, w: 12 },  // церулеум
  { h: 248, s: 46, l: 36, w: 10 },  // фиолетовый подмес
  { h: 200, s: 40, l: 72, w: 8 },   // разбел, свет
  { h: 30,  s: 58, l: 50, w: 4 },   // сиена — тёплый акцент
  { h: 44,  s: 62, l: 62, w: 2 },   // охра, редкий блик
];

const PALETTE_TOTAL = PALETTE.reduce((s, c) => s + c.w, 0);

function pickColor() {
  let r = Math.random() * PALETTE_TOTAL;
  for (const c of PALETTE) {
    r -= c.w;
    if (r <= 0) return c;
  }
  return PALETTE[0];
}

function jitter(c) {
  return {
    h: c.h + (Math.random() - 0.5) * 14,
    s: Math.min(95, Math.max(18, c.s + (Math.random() - 0.5) * 18)),
    l: Math.min(92, Math.max(10, c.l + (Math.random() - 0.5) * 16)),
  };
}

const hsla = (c, a) => `hsla(${c.h.toFixed(1)}, ${c.s.toFixed(1)}%, ${c.l.toFixed(1)}%, ${a})`;

/* ---------- Один мазок кисти ---------- */

function paintStroke(ctx, noise, x0, y0, cfg) {
  const {
    length = 180,
    width = 26,
    scale = 0.0022,
    bristles = 14,
    alpha = 0.5,
    color = pickColor(),
    curl = 1,
  } = cfg;

  // 1. Центральная линия мазка по полю течения
  const step = 7;
  const pts = [];
  let x = x0, y = y0;
  for (let i = 0; i < length / step; i++) {
    const a = noise(x * scale, y * scale) * Math.PI * 2 * curl;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push([x, y]);
  }
  if (pts.length < 2) return;

  // 2. Корпус мазка — плотная краска под щетиной
  const body = jitter(color);
  ctx.strokeStyle = hsla(body, alpha * 0.62);
  ctx.lineWidth = width * 0.82;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();

  // 3. Волоски щетины — каждый со своим оттенком и нажимом
  for (let b = 0; b < bristles; b++) {
    const t = bristles === 1 ? 0.5 : b / (bristles - 1);
    const offset = (t - 0.5) * width;
    const c = jitter(color);
    // края мазка суше и прозрачнее, середина плотнее
    const edge = 1 - Math.abs(t - 0.5) * 2;
    const a = alpha * (0.25 + edge * 0.85) * (0.55 + Math.random() * 0.65);

    ctx.strokeStyle = hsla(c, Math.min(a, 0.95));
    ctx.lineWidth = (width / bristles) * (0.8 + Math.random() * 1.5);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      const [nx, ny] = pts[Math.min(i + 1, pts.length - 1)];
      const dx = nx - px, dy = ny - py;
      const len = Math.hypot(dx, dy) || 1;
      // нормаль к направлению мазка
      const ox = (-dy / len) * offset;
      const oy = (dx / len) * offset;
      // щетина слегка расходится к концу — кисть «выдыхается»
      const fray = 1 + (i / pts.length) * 0.35;
      const jx = (Math.random() - 0.5) * 1.6;
      const jy = (Math.random() - 0.5) * 1.6;
      const X = px + ox * fray + jx;
      const Y = py + oy * fray + jy;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  }

  // 4. Импасто: блик по одному краю, тень по другому — краска встаёт рельефом
  const relief = (off, stroke, lw) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      const [nx, ny] = pts[Math.min(i + 1, pts.length - 1)];
      const dx = nx - px, dy = ny - py;
      const len = Math.hypot(dx, dy) || 1;
      const X = px + (-dy / len) * off;
      const Y = py + (dx / len) * off;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  };

  relief(-width * 0.34, `hsla(${color.h + 6}, 60%, 88%, ${0.05 + Math.random() * 0.09})`, 1.6);
  relief(width * 0.38, `hsla(${color.h}, 60%, 8%, ${0.05 + Math.random() * 0.08})`, 2);
}

/* ---------- Акварельная заливка: мягкое пятно с рваным краем ---------- */

function paintWash(ctx, x, y, radius, color, alpha) {
  // неровный контур пятна — вода расходится по волокну бумаги
  const lobes = 7 + ((Math.random() * 5) | 0);
  const pts = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const r = radius * (0.62 + Math.random() * 0.62);
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }

  const grad = ctx.createRadialGradient(x, y, radius * 0.05, x, y, radius);
  grad.addColorStop(0, hsla(color, alpha));
  grad.addColorStop(0.55, hsla(color, alpha * 0.55));
  grad.addColorStop(1, hsla(color, 0));

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[lobes - 1][0]) / 2, (pts[0][1] + pts[lobes - 1][1]) / 2);
  for (let i = 0; i < lobes; i++) {
    const cur = pts[i];
    const next = pts[(i + 1) % lobes];
    ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
  }
  ctx.closePath();
  ctx.fill();

  // кромка подсыхающей краски — акварельный ободок
  ctx.strokeStyle = hsla({ ...color, l: color.l * 0.78 }, alpha * 0.5);
  ctx.lineWidth = 1.2 + Math.random() * 1.6;
  ctx.stroke();
  ctx.restore();
}

/* ---------- Полотно: постепенно проявляющаяся живопись ---------- */

function createPainting(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  const noise = makePerlin();
  const {
    density = 0.00028,      // мазков на пиксель площади
    scale = 0.0022,
    minW = 22, maxW = 78,
    minL = 150, maxL = 420,
    alpha = 0.42,
    perFrame = 5,
    washDensity = 0.000035,
    interactive = false,
    bias = null,            // функция веса: где краска ложится плотнее
  } = options;

  let w, h, dpr, budget = 0, painted = 0, raf = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = rect.width; h = rect.height;
    if (!w || !h) return false;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function seedPoint() {
    // rejection sampling по функции плотности
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      if (!bias || Math.random() < bias(x / w, y / h)) return [x, y];
    }
    return [Math.random() * w, Math.random() * h];
  }

  function oneStroke() {
    const [x, y] = seedPoint();
    const big = Math.random() > 0.72;
    paintStroke(ctx, noise, x, y, {
      length: minL + Math.random() * (maxL - minL) * (big ? 1 : 0.6),
      width: minW + Math.random() * (maxW - minW) * (big ? 1 : 0.55),
      scale,
      bristles: 10 + ((Math.random() * 10) | 0),
      alpha,
      curl: 0.85 + Math.random() * 0.5,
    });
  }

  function tick() {
    for (let i = 0; i < perFrame && painted < budget; i++, painted++) oneStroke();
    if (painted < budget) raf = requestAnimationFrame(tick);
    else raf = null;
  }

  // Подмалёвок: широкие акварельные заливки под мазками
  function layWashes() {
    const count = Math.round(w * h * washDensity);
    for (let i = 0; i < count; i++) {
      const [x, y] = seedPoint();
      paintWash(
        ctx, x, y,
        Math.min(w, h) * (0.12 + Math.random() * 0.3),
        jitter(pickColor()),
        0.05 + Math.random() * 0.1
      );
    }
  }

  function start() {
    if (!resize()) return;
    ctx.clearRect(0, 0, w, h);
    layWashes();
    budget = Math.round(w * h * density);
    painted = 0;
    if (reduceMotion) {
      while (painted < budget) { oneStroke(); painted++; }
    } else {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }
  }

  // Кисть под курсором — можно «дописывать» картину
  if (interactive && !reduceMotion) {
    let last = 0;
    canvas.parentElement.addEventListener('pointermove', (e) => {
      const now = performance.now();
      if (now - last < 55) return;
      last = now;
      const rect = canvas.getBoundingClientRect();
      paintStroke(ctx, noise, e.clientX - rect.left, e.clientY - rect.top, {
        length: 90 + Math.random() * 130,
        width: 18 + Math.random() * 34,
        scale,
        bristles: 12,
        alpha: 0.34,
        curl: 1,
      });
    });
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 220);
  });

  return { start };
}

/* ---------- Запуск полотен ---------- */

(function initPaintings() {
  const hero = document.getElementById('paint-hero');
  if (hero) {
    createPainting(hero, {
      density: 0.00030,
      alpha: 0.44,
      interactive: true,
      // краска гуще справа и по нижнему краю — слева остаётся воздух под текст
      bias: (u, v) => Math.min(1, 0.16 + u * 1.15 + v * 0.35),
    }).start();
  }

  const cta = document.getElementById('paint-cta');
  if (cta) {
    createPainting(cta, {
      density: 0.00022,
      alpha: 0.4,
      minW: 30, maxW: 96,
      minL: 200, maxL: 520,
      scale: 0.0018,
      bias: (u, v) => 0.35 + Math.abs(u - 0.5) * 1.3 + (1 - v) * 0.2,
    }).start();
  }
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

/* ---------- Активный раздел в навигации ---------- */

(function navHighlight() {
  const links = [...document.querySelectorAll('.main-nav a')];
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
  }, { threshold: 0.3, rootMargin: '-90px 0px -40% 0px' });

  targets.forEach((t) => io.observe(t));
})();

/* ---------- Линия процесса заполняется по скроллу ---------- */

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
