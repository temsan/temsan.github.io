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
  { h: 228, s: 76, l: 26, w: 30 },  // ультрамарин
  { h: 233, s: 70, l: 18, w: 24 },  // глубокая тень
  { h: 220, s: 72, l: 38, w: 22 },  // кобальт
  { h: 248, s: 48, l: 32, w: 12 },  // фиолетовый подмес
  { h: 208, s: 68, l: 50, w: 8 },   // церулеум
  { h: 28,  s: 60, l: 46, w: 4 },   // сиена — рефлекс
];

const AIR = [
  { h: 210, s: 44, l: 74, w: 34 },  // разбел
  { h: 220, s: 38, l: 66, w: 26 },  // холодный воздух
  { h: 205, s: 52, l: 58, w: 18 },  // церулеум разбавленный
  { h: 44,  s: 54, l: 68, w: 12 },  // охра, тёплый просвет
  { h: 232, s: 40, l: 48, w: 10 },  // тень в воздухе
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

/* ---------- Натура: фотография как поле для кисти ----------
   Яркость снимка решает, где краска ложится густо и какого она тона,
   а градиент яркости задаёт направление мазка — так пишут по форме.  */

/* Общая обвязка над растровым полем: билинейная светлота, многомасштабный
   градиент для направления мазка и мелкая деталь для калибра кисти.       */
function fieldFromPixels(data, mw, mh, drawnWidth) {
  const at = (px, py) => {
    const cx = px < 0 ? 0 : px > mw - 1 ? mw - 1 : px;
    const cy = py < 0 ? 0 : py > mh - 1 ? mh - 1 : py;
    const i = (cy * mw + cx) * 4;
    return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
  };

  const lum = (u, v) => {
    const fx = u * mw - 0.5, fy = v * mh - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const a = at(x0, y0),     b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };

  const gradAtScale = (u, v, px) => {
    const d = px / mw;
    const gx = lum(u + d, v) - lum(u - d, v);
    const gy = lum(u, v + d) - lum(u, v - d);
    return [gx, gy, Math.hypot(gx, gy)];
  };

  const gradientAt = (u, v) => {
    for (const px of [1.4, 4, 9, 18]) {
      const g = gradAtScale(u, v, px);
      if (g[2] > 0.02) return g;
    }
    return gradAtScale(u, v, 18);
  };

  return { lum, gradientAt, detailAt: (u, v) => gradAtScale(u, v, 1.4)[2], drawnWidth };
}

function buildImageField(img, w, h, box) {
  const SCALE = 3;
  const mw = Math.max(2, Math.ceil(w / SCALE));
  const mh = Math.max(2, Math.ceil(h / SCALE));
  const c = document.createElement('canvas');
  c.width = mw; c.height = mh;
  const x = c.getContext('2d');

  // холст вне натуры — чистый: там останется воздух
  x.fillStyle = '#fff';
  x.fillRect(0, 0, mw, mh);

  // вписываем снимок в отведённую область, сохраняя пропорции
  const bx = box.x * mw, by = box.y * mh;
  const bw = box.w * mw, bh = box.h * mh;
  const k = Math.min(bw / img.width, bh / img.height);
  const dw = img.width * k, dh = img.height * k;
  x.drawImage(img, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh);

  // ширина натуры на холсте — по ней масштабируется кисть
  const drawnWidth = dw * SCALE;

  const data = x.getImageData(0, 0, mw, mh).data;
  return fieldFromPixels(data, mw, mh, drawnWidth);
}

/* ---------- Фрактальное поле: луна в узорной ночи ----------
   Основа — фрактальный шум с доменным искажением: он даёт мраморные
   завихрения, по которым кисть идёт сама. Поверх — филигрань множества
   Жюлиа: самоподобные нити, дающие узору упорядоченность.
   Поле считается один раз в мелком разрешении, дальше только выборка.   */

function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* Глубокое поле: далёкие галактики. Каждая — повёрнутый эллипс с ядром
   и намёком на рукава; кисть пишет их так же, как облака ночи.        */
function makeGalaxies(w, h, rnd, count) {
  return Array.from({ length: count }, () => {
    const a = rnd() * Math.PI;
    return {
      x: rnd() * w, y: rnd() * h,
      rx: (0.02 + rnd() * 0.055) * Math.min(w, h),
      ry: 0, rot: a, arms: rnd() > 0.45,
      cos: Math.cos(a), sin: Math.sin(a),
      bright: 0.3 + rnd() * 0.5,
    };
  }).map((g) => (g.ry = g.rx * (0.28 + Math.random() * 0.55), g));
}

function buildFractalField(w, h, { cx, cy, r, reach = 4.2 }) {
  const SCALE = 3;
  const mw = Math.max(2, Math.ceil(w / SCALE));
  const mh = Math.max(2, Math.ceil(h / SCALE));
  const noise = makePerlin();

  const fbm = (x, y, oct = 5) => {
    let a = 0.5, f = 1, sum = 0;
    for (let i = 0; i < oct; i++) { sum += a * noise(x * f, y * f); f *= 2; a *= 0.5; }
    return sum;
  };

  // самоподобная нить: гладкий счётчик убегания для множества Жюлиа
  const julia = (zx, zy) => {
    const cRe = -0.7269, cIm = 0.1889;
    let x = zx, y = zy, i = 0;
    for (; i < 26; i++) {
      const x2 = x * x, y2 = y * y;
      if (x2 + y2 > 16) break;
      const nx = x2 - y2 + cRe;
      y = 2 * x * y + cIm; x = nx;
    }
    if (i >= 26) return 1;
    const sm = i + 1 - Math.log(Math.log(Math.hypot(x, y))) / Math.LN2;
    return sm / 26;
  };

  const smooth = (a, b, t) => {
    const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };

  const c = document.createElement('canvas');
  c.width = mw; c.height = mh;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(mw, mh);
  const px = img.data;

  const S = 0.0016 * SCALE;   // масштаб узора
  const rnd = seededRandom(20260726);
  const galaxies = makeGalaxies(w, h, rnd, 9);

  for (let py = 0; py < mh; py++) {
    for (let pxi = 0; pxi < mw; pxi++) {
      const X = pxi * SCALE, Y = py * SCALE;
      const d = Math.hypot(X - cx, Y - cy) / r;

      // вклад далёких галактик
      let gal = 0;
      for (const g of galaxies) {
        const dx = X - g.x, dy = Y - g.y;
        const ex = (dx * g.cos + dy * g.sin) / g.rx;
        const ey = (-dx * g.sin + dy * g.cos) / g.ry;
        const q = ex * ex + ey * ey;
        if (q > 6) continue;
        let v = Math.exp(-q * 1.15) * g.bright;
        if (g.arms) {
          // намёк на спиральные рукава
          const ang = Math.atan2(ey, ex) + Math.sqrt(q) * 2.4;
          v *= 0.62 + 0.38 * Math.abs(Math.cos(ang));
        }
        gal += v;
      }

      let L;
      if (d < 1) {
        // диск луны: моря и потемнение к лимбу
        const seas = fbm(X * 0.006, Y * 0.006, 4) * 0.28;
        L = Math.min(1, Math.max(0, 0.92 * (1 - Math.pow(d, 3) * 0.3) + seas * 0.16));
      } else {
        // доменное искажение — мраморные завихрения ночи
        const x = X * S, y = Y * S;
        const q1 = fbm(x, y), q2 = fbm(x + 5.2, y + 1.3);
        const r1 = fbm(x + 4 * q1 + 1.7, y + 4 * q2 + 9.2);
        const r2 = fbm(x + 4 * q1 + 8.3, y + 4 * q2 + 2.8);
        const f = (fbm(x + 4 * r1, y + 4 * r2) + 1) / 2;

        // филигрань Жюлиа вокруг луны
        const jz = 2.6 / (r * 3.2);
        const jv = julia((X - cx) * jz, (Y - cy) * jz);
        const thread = Math.pow(1 - Math.abs(((jv * 7) % 1) * 2 - 1), 8) * 0.5;

        const night = 0.12 + 0.86 * smooth(1.0, reach, d);
        L = night + (f - 0.5) * 0.42 * (1 - smooth(1.0, reach, d))
            + thread * (1 - smooth(1.0, reach * 0.8, d))
            + Math.min(0.55, gal);
        L = Math.min(1, Math.max(0, L));
      }

      const v = (L * 255) | 0;
      const i = (py * mw + pxi) * 4;
      px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
    }
  }

  return fieldFromPixels(px, mw, mh, r * 2);
}

/* ---------- Луна: процедурное поле светлоты ----------
   Диск с морями и потемнением к краю, вокруг — ночной ореол,
   который к периферии растворяется в холсте.                 */

function makeMoonField(w, h, { cx, cy, r, reach = 3.0 }) {
  const noise = makePerlin();
  const smooth = (a, b, t) => {
    const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };

  const lum = (u, v) => {
    const x = u * w, y = v * h;
    const d = Math.hypot(x - cx, y - cy) / r;

    if (d < 1) {
      // моря на диске + потемнение к лимбу
      const seas = noise(x * 0.0055, y * 0.0055) * 0.5 + noise(x * 0.019, y * 0.019) * 0.22;
      const limb = 1 - Math.pow(d, 3) * 0.3;
      return Math.min(1, Math.max(0, 0.9 * limb + seas * 0.12));
    }

    // ночное небо: густая синева у диска, к периферии растворяется в холсте
    // только низкая частота: мелкое зерно заставило бы детальные проходы
    // срабатывать по всему небу и раздуло бы объём работы
    const grain = noise(x * 0.0045, y * 0.0045) * 0.16;
    const sky = 0.14 + 0.84 * smooth(1.0, reach, d);
    return Math.min(1, Math.max(0, sky + grain * (1 - smooth(1.0, reach, d))));
  };

  const gradAtScale = (u, v, px) => {
    const d = px / w;
    const gx = lum(u + d, v) - lum(u - d, v);
    const gy = lum(u, v + d) - lum(u, v - d);
    return [gx, gy, Math.hypot(gx, gy)];
  };

  const gradientAt = (u, v) => {
    for (const px of [2, 6, 14]) {
      const g = gradAtScale(u, v, px);
      if (g[2] > 0.02) return g;
    }
    return gradAtScale(u, v, 14);
  };

  return {
    lum,
    gradientAt,
    detailAt: (u, v) => gradAtScale(u, v, 2)[2],
    drawnWidth: r * 2,
  };
}

/* ---------- Жидкое стекло ----------
   Фигура не пишется краской, а становится линзой: изображение под ней
   смещается по градиенту толщины, по кромкам вспыхивают блики.        */

function applyLiquidGlass(ctx, w, h, dpr, thickness, opts = {}) {
  const {
    refraction = 30, tint = [188, 208, 240], rim = 0.85,
    tone = null,        // светлота натуры: даёт стеклу внутренний объём
    ghost = 0.34,       // насколько проступает форма внутри стекла
  } = opts;

  const W = Math.max(1, Math.floor(w * dpr));
  const H = Math.max(1, Math.floor(h * dpr));
  const src = ctx.getImageData(0, 0, W, H);
  const out = ctx.createImageData(W, H);
  out.data.set(src.data);

  const S = src.data, D = out.data;
  const k = refraction * dpr;

  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const t = thickness(u, v);
      if (t < 0.035) continue;                    // вне стекла ничего не трогаем

      // градиент толщины — нормаль поверхности линзы
      const d = 1.5 / W;
      const gx = thickness(u + d, v) - thickness(u - d, v);
      const gy = thickness(u, v + d) - thickness(u, v - d);
      const mag = Math.hypot(gx, gy);

      // преломление: чем толще и круче, тем сильнее сдвиг
      let sx = Math.round(x - gx * k * (0.4 + t));
      let sy = Math.round(y - gy * k * (0.4 + t));
      sx = sx < 0 ? 0 : sx >= W ? W - 1 : sx;
      sy = sy < 0 ? 0 : sy >= H ? H - 1 : sy;

      const si = (sy * W + sx) * 4;
      const di = (y * W + x) * 4;

      // стекло почти прозрачно: лишь холодный отлив, форму выдаёт преломление
      const g = 0.04 + t * 0.13;
      let r0 = S[si]     * (1 - g) + tint[0] * g;
      let g0 = S[si + 1] * (1 - g) + tint[1] * g;
      let b0 = S[si + 2] * (1 - g) + tint[2] * g;

      // толща стекла слегка гасит свет — появляется объём
      const absorb = 1 - t * 0.16;
      r0 *= absorb; g0 *= absorb; b0 *= absorb;

      /* Внутри стекла проступает тональная форма натуры — прямо, не в негативе:
         тени остаются тенями, света — светами.                              */
      if (tone) {
        const L = tone(u, v);
        /* Тональный ряд сдвинут вверх: стекло подсвечено луной, поэтому даже
           тени портрета светлее ночного неба — иначе фигура в нём тонет.   */
        const a = ghost * (0.34 + 0.66 * t);
        r0 = r0 * (1 - a) + (96 + L * 156) * a;
        g0 = g0 * (1 - a) + (112 + L * 146) * a;
        b0 = b0 * (1 - a) + (154 + L * 101) * a;
      }

      // свет скользит по стеклу сверху-слева
      const sheen = Math.max(0, -gx * 0.6 - gy * 0.8) * 1.6;
      // блик по кромке: только там, где поверхность круто заворачивает
      const spec = Math.min(0.55, mag * 26) * rim + Math.min(0.14, sheen);
      if (spec > 0.01) {
        r0 += (255 - r0) * spec;
        g0 += (255 - g0) * spec;
        b0 += (255 - b0) * spec;
      }

      D[di]     = r0;
      D[di + 1] = g0;
      D[di + 2] = b0;
      D[di + 3] = Math.max(S[si + 3], Math.round(t * 255));
    }
  }

  ctx.putImageData(out, 0, 0);
}

/* ---------- Звёздная россыпь поверх живописи ----------
   Точки звёзд мельче любой кисти, поэтому кладутся последними:
   иначе широкий мазок стёр бы их вместе с лучами и хвостами комет.   */

function paintStarfield(ctx, w, h, seed = 7) {
  const rnd = seededRandom(seed);
  const dim = Math.min(w, h);

  const star = (x, y, rad, warm, spikes) => {
    const hue = warm ? 42 : 214;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, rad * 7);
    halo.addColorStop(0, `hsla(${hue}, 70%, 92%, 0.55)`);
    halo.addColorStop(1, `hsla(${hue}, 70%, 92%, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, rad * 7, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = `hsla(${hue}, 60%, 97%, 0.95)`;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();

    if (!spikes) return;
    // дифракционные лучи — подпись телескопа
    ctx.strokeStyle = `hsla(${hue}, 65%, 95%, 0.5)`;
    ctx.lineWidth = Math.max(0.6, rad * 0.35);
    const L = rad * 13;
    ctx.beginPath();
    ctx.moveTo(x - L, y); ctx.lineTo(x + L, y);
    ctx.moveTo(x, y - L); ctx.lineTo(x, y + L);
    ctx.stroke();
  };

  // мелкая пыль далёких светил
  const dust = Math.round(w * h / 5200);
  for (let i = 0; i < dust; i++) {
    const x = rnd() * w, y = rnd() * h;
    const a = 0.12 + rnd() * 0.5;
    ctx.fillStyle = `hsla(${rnd() > 0.88 ? 44 : 212}, 55%, 94%, ${a})`;
    ctx.beginPath(); ctx.arc(x, y, rnd() * 0.9 + 0.35, 0, Math.PI * 2); ctx.fill();
  }

  // заметные звёзды, часть — с лучами
  const bright = Math.round(dim / 42);
  for (let i = 0; i < bright; i++) {
    star(rnd() * w, rnd() * h, 0.9 + rnd() * 1.7, rnd() > 0.82, rnd() > 0.55);
  }

  // кометы: ядро и тающий хвост
  const comets = 2 + ((rnd() * 2) | 0);
  for (let i = 0; i < comets; i++) {
    const x = rnd() * w, y = rnd() * h * 0.75;
    const ang = -0.9 + rnd() * 0.7;
    const len = dim * (0.1 + rnd() * 0.16);
    const ex = x - Math.cos(ang) * len, ey = y - Math.sin(ang) * len;

    const tail = ctx.createLinearGradient(x, y, ex, ey);
    tail.addColorStop(0, 'hsla(206, 80%, 92%, 0.72)');
    tail.addColorStop(0.35, 'hsla(214, 70%, 86%, 0.28)');
    tail.addColorStop(1, 'hsla(220, 60%, 80%, 0)');
    ctx.strokeStyle = tail;
    ctx.lineWidth = 1.6 + rnd() * 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();

    star(x, y, 1.5 + rnd(), false, true);
  }
}

/* ---------- Мазок ---------- */

function paintStroke(ctx, angleAt, x0, y0, cfg) {
  const {
    length = 180, width = 26, bristles = 14,
    alpha = 0.5, color, relief = true,
  } = cfg;

  const step = Math.max(3, Math.min(7, length / 4));
  const pts = [];
  let x = x0, y = y0;
  // мазок начинается чуть раньше точки посева — кисть проходит сквозь неё
  const a0 = angleAt(x0, y0);
  x -= Math.cos(a0) * length * 0.45;
  y -= Math.sin(a0) * length * 0.45;
  for (let i = 0; i < Math.max(2, length / step); i++) {
    const a = angleAt(x, y);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    pts.push([x, y]);
  }
  if (pts.length < 2) return;

  // корпус мазка — плотная краска
  ctx.strokeStyle = hsla(jitter(color), alpha * 0.62);
  ctx.lineWidth = width * 0.82;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();

  // щетина
  for (let b = 0; b < bristles; b++) {
    const t = bristles === 1 ? 0.5 : b / (bristles - 1);
    const offset = (t - 0.5) * width;
    const c = jitter(color);
    const edge = 1 - Math.abs(t - 0.5) * 2;
    const a = alpha * (0.25 + edge * 0.85) * (0.55 + Math.random() * 0.65);

    ctx.strokeStyle = hsla(c, Math.min(a, 0.95));
    ctx.lineWidth = (width / bristles) * (0.8 + Math.random() * 1.5);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      const [nx, ny] = pts[Math.min(i + 1, pts.length - 1)];
      const dx = nx - px, dy = ny - py;
      const len = Math.hypot(dx, dy) || 1;
      const fray = 1 + (i / pts.length) * 0.35;
      const X = px + (-dy / len) * offset * fray + (Math.random() - 0.5) * 1.6;
      const Y = py + (dx / len) * offset * fray + (Math.random() - 0.5) * 1.6;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  }

  if (!relief) return;

  // импасто
  const ridge = (off, stroke, lw) => {
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

  ridge(-width * 0.34, `hsla(${color.h + 6}, 60%, 88%, ${0.05 + Math.random() * 0.09})`, 1.6);
  ridge(width * 0.38, `hsla(${color.h}, 60%, 8%, ${0.05 + Math.random() * 0.08})`, 2);
}

/* ---------- Акварельная заливка ---------- */

function paintWash(ctx, x, y, radius, color, alpha) {
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
    const cur = pts[i], next = pts[(i + 1) % lobes];
    ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hsla({ ...color, l: color.l * 0.78 }, alpha * 0.5);
  ctx.lineWidth = 1.2 + Math.random() * 1.6;
  ctx.stroke();
  ctx.restore();
}

/* ---------- Полотно ---------- */

function createPainting(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  const noise = makePerlin();
  const {
    density = 0.00034,
    scale = 0.0022,
    alpha = 0.44,
    perFrame = 6,
    washDensity = 0.000035,
    interactive = false,
    sourceImage = null,     // натура: по ней собирается изображение
    sourceBox = null,       // куда её вписать (доли холста)
    makeField = null,       // процедурное поле вместо снимка
    ambientBias = null,     // плотность, когда поля нет
    glass = null,           // { image, box, ...opts } — линза поверх живописи
    skipLight = false,      // писать ли светлые участки (для луны — да)
    underpaint = null,      // тонировка холста перед мазками
    sizeAt = () => 1,       // калибр кисти по горизонтали: слева мельче, справа шире
    overlay = null,         // что кладётся последним, поверх готовой живописи
  } = options;

  let w, h, dpr, field = null, glassField = null, budget = 0, painted = 0, raf = null;

  function resize() {
    // 1.5 достаточно для живописи и вдвое дешевле по заливке, чем 2
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const rect = canvas.getBoundingClientRect();
    w = rect.width; h = rect.height;
    if (!w || !h) return false;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (makeField) {
      field = makeField(w, h);
    } else {
      const box = typeof sourceBox === 'function' ? sourceBox(w, h) : sourceBox;
      field = (sourceImage && box) ? buildImageField(sourceImage, w, h, box) : null;
    }

    glassField = null;
    if (glass && glass.image) {
      const gb = typeof glass.box === 'function' ? glass.box(w, h) : glass.box;
      glassField = buildImageField(glass.image, w, h, gb);
    }
    return true;
  }

  // толщина стекла: тёмные места натуры — самые «густые»
  function thicknessAt(u, v) {
    if (!glassField) return 0;
    return Math.max(0, Math.min(1, (1 - glassField.lum(u, v) - 0.04) / 0.96));
  }

  /* Направление мазка: вдоль линий равной светлоты — так кисть идёт по форме.
     Где натура ровная, ведёт поле течения.                                   */
  function angleAt(x, y) {
    const px = noise(x * scale, y * scale) * Math.PI * 2;
    if (!field) return px;

    const [gx, gy, mag] = field.gradientAt(x / w, y / h);
    if (mag < 0.012) return px;

    const tangent = Math.atan2(gy, gx) + Math.PI / 2;
    const k = Math.min(1, mag * 9);
    // смешиваем как векторы, чтобы не было скачка через 2π
    const vx = Math.cos(px) * (1 - k) + Math.cos(tangent) * k;
    const vy = Math.sin(px) * (1 - k) + Math.sin(tangent) * k;
    return Math.atan2(vy, vx);
  }

  function densityAt(u, v) {
    if (field) {
      const ink = 1 - field.lum(u, v);
      return 0.035 + Math.pow(ink, 1.15) * 0.965;
    }
    return ambientBias ? ambientBias(u, v) : 0.6;
  }

  function seedPoint() {
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      if (Math.random() < densityAt(x / w, y / h)) return [x, y];
    }
    return [Math.random() * w, Math.random() * h];
  }

  /* Цвет мазка выводится из светлоты натуры: тени — густой ультрамарин,
     света — разбел. Изредка тёплый рефлекс, чтобы синее звучало.        */
  function colorFor(lum) {
    // редкий тёплый рефлекс — ровно столько, чтобы синее зазвучало
    if (Math.random() < 0.035) {
      return jitter({ h: 34 + Math.random() * 12, s: 46, l: 40 + lum * 34 }, 0.5);
    }
    // узкий диапазон вокруг ультрамарина: мазки читаются как одна семья
    return jitter({
      h: 226 + (Math.random() - 0.5) * 16,
      s: 42 + (1 - lum) * 30,
      l: 8 + lum * 78,
    }, 0.45);
  }

  /* Мазок по натуре идёт прямо, вдоль линии равной светлоты: направление
     берём один раз в точке посева, дальше — лишь лёгкое дыхание кисти.  */
  function directedAngle(x0, y0) {
    const [gx, gy, mag] = field.gradientAt(x0 / w, y0 / h);
    const base = mag > 0.008
      ? Math.atan2(gy, gx) + Math.PI / 2
      // запасной вариант — низкочастотное поле: соседние мазки согласованы,
      // а не смотрят в разные стороны
      : noise(x0 * scale * 0.3, y0 * scale * 0.3) * Math.PI * 2;
    return (x, y) => base + noise(x * 0.004, y * 0.004) * 0.22;
  }

  // Проходы: от крупной кисти к мелкой — как пишут с натуры
  /* Мазок должен быть заметно короче черты лица, иначе он её смазывает.
     Отсюда умеренная длина и три калибра кисти.                        */
  const PASSES = [
    // подмалёвок: закрывает форму целиком
    { spacing: 9.5, len: [26, 54], wid: [10, 17], minDetail: -1,   bristles: 7, relief: true },
    // проработка по краям форм
    { spacing: 6.0, len: [16, 34], wid: [5, 9],   minDetail: 0.09, bristles: 5, relief: false },
    // детали: глаза, оправа, губы
    { spacing: 3.8, len: [8, 18],  wid: [2, 4],   minDetail: 0.24, bristles: 4, relief: false },
  ];

  function buildJobs() {
    const jobs = [];
    // кисть пропорциональна натуре: на телефоне холст меньше — и мазок мельче,
    // иначе портрет рассыпается на редкие пятна
    const k = Math.max(0.34, Math.min(1.5, field.drawnWidth / 640));

    for (const pass of PASSES) {
      const layer = [];
      const spacing = pass.spacing * k;

      for (let y = 0; y < h; y += spacing) {
        for (let x = 0; x < w; x += spacing) {
          /* Кисть растёт вправо, поэтому мазков там нужно во столько же раз
             меньше — иначе и каша, и лишняя работа: площадь растёт как квадрат. */
          const s = sizeAt(x / w);
          if (s > 1 && Math.random() > 1 / (s * s)) continue;

          const jx = x + (Math.random() - 0.5) * spacing * s;
          const jy = y + (Math.random() - 0.5) * spacing * s;
          const u = jx / w, v = jy / h;
          const lum = field.lum(u, v);
          if (!skipLight && lum > 0.93) continue;         // фон остаётся холстом
          if (skipLight && lum > 0.965) continue;         // совсем светлое — тоже холст
          const detail = Math.min(1, field.detailAt(u, v) * 7);
          if (detail < pass.minDetail) continue;
          layer.push({ x: jx, y: jy, pass, lum, detail, k: k * s });
        }
      }
      // внутри слоя порядок случайный — форма проявляется целиком,
      // но слои идут строго друг за другом: сначала подмалёвок, потом детали
      for (let i = layer.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [layer[i], layer[j]] = [layer[j], layer[i]];
      }
      jobs.push(...layer);
    }

    /* Страховка: стекло накладывается только после последнего мазка, поэтому
       живопись обязана завершиться. Лишние детальные мазки отбрасываем.     */
    const CAP = 24000;
    if (jobs.length > CAP) jobs.length = CAP;
    return jobs;
  }

  function runJob(job) {
    const { pass, lum, detail, k } = job;
    const rng = (r) => r[0] + Math.random() * (r[1] - r[0]);
    paintStroke(ctx, directedAngle(job.x, job.y), job.x, job.y, {
      length: rng(pass.len) * k * (1 - detail * 0.3),
      width: rng(pass.wid) * k,
      bristles: pass.bristles,
      alpha: alpha * (0.55 + (1 - lum) * 0.55),
      color: colorFor(lum),
      relief: pass.relief && lum < 0.55,
    });
  }

  // абстрактный мазок — для холстов без натуры
  function ambientStroke() {
    const [x, y] = seedPoint();
    const big = Math.random() > 0.6;
    paintStroke(ctx, angleAt, x, y, {
      length: 150 + Math.random() * (big ? 320 : 140),
      width: 24 + Math.random() * (big ? 62 : 30),
      bristles: 10 + ((Math.random() * 10) | 0),
      alpha,
      color: jitter(weightedPick(Math.random() > 0.45 ? DEEP : AIR), 1.1),
      relief: true,
    });
  }

  let jobs = null;
  let startedAt = 0;
  const PAINT_DEADLINE = 5200;

  // живопись дописана — опускаем стеклянную фигуру поверх неё
  function finish() {
    if (overlay) overlay(ctx, w, h);
    if (!glassField) return;
    applyLiquidGlass(ctx, w, h, dpr, thicknessAt, {
      ...glass,
      tone: (u, v) => glassField.lum(u, v),
    });
  }

  // рисуем столько, сколько успеваем за кадр, — портрет проявляется плавно
  function tick() {
    const t0 = performance.now();
    if (jobs) {
      while (painted < jobs.length && performance.now() - t0 < 12) runJob(jobs[painted++]);
      // стекло ложится только поверх готовой живописи, поэтому у неё есть срок:
      // не уложились — останавливаемся на достигнутом и накрываем линзой
      const overdue = performance.now() - startedAt > PAINT_DEADLINE;
      if (painted < jobs.length && !overdue) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
        finish();
      }
    } else {
      for (let i = 0; i < perFrame && painted < budget; i++, painted++) ambientStroke();
      raf = painted < budget ? requestAnimationFrame(tick) : null;
    }
  }

  function layWashes() {
    const count = Math.round(w * h * washDensity);
    for (let i = 0; i < count; i++) {
      const [x, y] = seedPoint();
      const dark = field ? field.lum(x / w, y / h) < 0.5 : Math.random() > 0.5;
      paintWash(
        ctx, x, y,
        Math.min(w, h) * (0.1 + Math.random() * 0.28),
        jitter(weightedPick(dark ? DEEP : AIR)),
        0.05 + Math.random() * 0.09
      );
    }
  }

  function start() {
    if (!resize()) return;
    ctx.clearRect(0, 0, w, h);
    if (underpaint) underpaint(ctx, w, h);
    layWashes();

    jobs = field ? buildJobs() : null;
    const d = typeof density === 'function' ? density() : density;
    budget = Math.round(w * h * d);
    painted = 0;

    startedAt = performance.now();
    cancelAnimationFrame(raf);
    if (reduceMotion) {
      if (jobs) { jobs.forEach(runJob); finish(); }
      else while (painted < budget) { ambientStroke(); painted++; }
    } else {
      raf = requestAnimationFrame(tick);
    }
  }

  // кисть под курсором — дописывает картину, не ломая форму
  if (interactive && !reduceMotion) {
    let last = 0;
    canvas.parentElement.addEventListener('pointermove', (e) => {
      const now = performance.now();
      if (now - last < 55) return;
      last = now;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      // по стеклу не пишем — иначе линза замажется краской
      if (thicknessAt(x / w, y / h) > 0.07) return;
      const lum = field ? field.lum(x / w, y / h) : 0.6;
      paintStroke(ctx, field ? directedAngle(x, y) : angleAt, x, y, {
        length: 70 + Math.random() * 120,
        width: 12 + Math.random() * 26,
        bristles: 11,
        alpha: 0.2 + (1 - lum) * 0.22,
        color: field ? colorFor(lum) : jitter(weightedPick(AIR)),
        relief: lum < 0.55,
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

/* ---------- Запуск ---------- */

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);   // нет натуры — холст просто останется абстрактным
    img.src = src;
  });
}

(async function initPaintings() {
  const hero = document.getElementById('paint-hero');
  if (hero) {
    // геометрия луны — общая для подмалёвка и для поля мазков
    const moonGeom = (w, h) => {
      const narrow = w / h < 1.05;
      return {
        cx: w * (narrow ? 0.5 : 0.29),
        cy: h * (narrow ? 0.3 : 0.38),
        r: Math.min(w, h) * (narrow ? 0.2 : 0.185),
        reach: 4.2,
      };
    };

    createPainting(hero, {
      alpha: 0.9,
      interactive: true,
      skipLight: true,
      // у луны кисть мельче и точнее, к правому краю — широкая и вольная
      sizeAt: (u) => 0.7 + Math.pow(Math.max(0, u - 0.12) / 0.88, 1.5) * 2.4,

      /* Тонировка холста: ночь и диск луны кладутся сплошным тоном,
         иначе отдельные мазки висят в пустоте и не образуют неба. */
      underpaint: (ctx, w, h) => {
        const { cx, cy, r, reach } = moonGeom(w, h);

        const sky = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * reach);
        sky.addColorStop(0.00, 'rgba(15, 22, 66, 0.96)');
        sky.addColorStop(0.22, 'rgba(20, 32, 94, 0.92)');
        sky.addColorStop(0.55, 'rgba(31, 53, 168, 0.42)');
        sky.addColorStop(1.00, 'rgba(31, 53, 168, 0)');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        const disc = ctx.createRadialGradient(
          cx - r * 0.18, cy - r * 0.2, r * 0.05, cx, cy, r
        );
        disc.addColorStop(0.00, 'rgba(247, 243, 230, 0.97)');
        disc.addColorStop(0.62, 'rgba(226, 231, 240, 0.93)');
        disc.addColorStop(0.93, 'rgba(178, 196, 228, 0.85)');
        disc.addColorStop(1.00, 'rgba(150, 174, 214, 0)');
        ctx.fillStyle = disc;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      },

      makeField: (w, h) => buildFractalField(w, h, moonGeom(w, h)),
      overlay: (ctx, w, h) => paintStarfield(ctx, w, h, 20260726),
    }).start();
  }

  const cta = document.getElementById('paint-cta');
  if (cta) {
    createPainting(cta, {
      density: 0.00022,
      alpha: 0.4,
      scale: 0.0018,
      ambientBias: (u, v) => 0.35 + Math.abs(u - 0.5) * 1.3 + (1 - v) * 0.2,
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

/* ---------- Активный раздел ---------- */

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
