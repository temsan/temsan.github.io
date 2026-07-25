/* ============================================
   Слепок мышления — интерактивные слои
   ============================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1. Карта смыслов: живой граф в hero ---------- */

(function mindMap() {
  const canvas = document.getElementById('mindmap');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let w, h, dpr, nodes = [], raf;
  const pointer = { x: -9999, y: -9999, active: false };

  const NODE_COUNT = window.innerWidth < 720 ? 34 : 62;
  const LINK_DIST = 132;
  const POINTER_RADIUS = 170;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.6 + 0.9,
      // часть узлов — "ядра смыслов", крупнее и ярче
      core: Math.random() > 0.86,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);

    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;

      // мягкое отражение от границ
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;

      // притяжение к курсору — "мысль тянется к вниманию"
      if (pointer.active) {
        const dx = pointer.x - n.x;
        const dy = pointer.y - n.y;
        const d = Math.hypot(dx, dy);
        if (d < POINTER_RADIUS && d > 1) {
          const pull = (1 - d / POINTER_RADIUS) * 0.5;
          n.x += (dx / d) * pull;
          n.y += (dy / d) * pull;
        }
      }
    }

    // связи
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > LINK_DIST) continue;

        let alpha = (1 - d / LINK_DIST) * 0.34;

        // связи рядом с курсором разгораются янтарём
        let warm = 0;
        if (pointer.active) {
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const pd = Math.hypot(pointer.x - mx, pointer.y - my);
          if (pd < POINTER_RADIUS) warm = 1 - pd / POINTER_RADIUS;
        }

        ctx.strokeStyle = warm > 0.02
          ? `rgba(224, 166, 60, ${alpha + warm * 0.5})`
          : `rgba(150, 176, 168, ${alpha * 0.55})`;
        ctx.lineWidth = warm > 0.4 ? 1 : 0.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // узлы
    for (const n of nodes) {
      const pulse = n.core ? 0.5 + Math.sin(t / 900 + n.phase) * 0.32 : 0.42;
      const radius = n.core ? n.r * 2.1 : n.r;

      if (n.core) {
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 6);
        glow.addColorStop(0, `rgba(224, 166, 60, ${pulse * 0.45})`);
        glow.addColorStop(1, 'rgba(224, 166, 60, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = n.core
        ? `rgba(240, 200, 120, ${0.65 + pulse * 0.35})`
        : `rgba(207, 198, 180, ${pulse})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = requestAnimationFrame(draw);
  }

  resize();
  seed();

  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    resize();
    seed();
    if (!reduceMotion) raf = requestAnimationFrame(draw);
    else drawStatic();
  });

  const host = canvas.parentElement;
  host.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.active = true;
  });
  host.addEventListener('pointerleave', () => { pointer.active = false; });

  function drawStatic() {
    draw(0);
    cancelAnimationFrame(raf);
  }

  if (reduceMotion) drawStatic();
  else raf = requestAnimationFrame(draw);
})();

/* ---------- 2. Появление секций при скролле ---------- */

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
  }, { threshold: 0.16, rootMargin: '0px 0px -60px 0px' });

  items.forEach((el) => io.observe(el));
})();

/* ---------- 3. Прогресс чтения ---------- */

(function readingProgress() {
  const bar = document.querySelector('.progress-bar');
  if (!bar) return;

  let ticking = false;
  function update() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    bar.style.transform = `scaleX(${pct / 100})`;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();
})();

/* ---------- 4. Свет, следящий за курсором на карточках ---------- */

(function spotlightCards() {
  if (reduceMotion) return;
  const cards = document.querySelectorAll('[data-spotlight]');

  cards.forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });
})();

/* ---------- 5. Активный раздел в навигации ---------- */

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
  }, { threshold: 0.35, rootMargin: '-80px 0px -40% 0px' });

  targets.forEach((t) => io.observe(t));
})();

/* ---------- 6. Счётчик шагов процесса: линия заполняется ---------- */

(function processLine() {
  const list = document.querySelector('.process-list');
  if (!list || reduceMotion) return;

  let ticking = false;
  function update() {
    const rect = list.getBoundingClientRect();
    const start = window.innerHeight * 0.78;
    const total = rect.height + start - window.innerHeight * 0.3;
    const passed = Math.min(Math.max(start - rect.top, 0), total);
    list.style.setProperty('--line-progress', `${(passed / total) * 100}%`);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();
})();
