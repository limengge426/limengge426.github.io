/* Limeng Ge — site interactions. No dependencies. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');

  /* ---------- Toast ---------- */
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 1800);
  }
  window.siteToast = toast;

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  /* ---------- Theme: the lamp cord ---------- */
  const currentTheme = () => root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');

  let switching = false;
  function switchTheme(x, y) {
    if (switching) return;              // ignore a second tug while the reveal is still running
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    const apply = () => {
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    };
    if (!document.startViewTransition || reduceMotion) { apply(); return; }
    switching = true;
    const t = document.startViewTransition(apply);
    t.finished.finally(() => { switching = false; });
    t.ready.then(() => {
      // Origin as a percentage of the viewport, so it lands on the click point even if the
      // browser sizes the snapshot differently from innerWidth/innerHeight (zoom, scrollbars).
      const px = (x / innerWidth) * 100, py = (y / innerHeight) * 100;
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
      root.animate(
        { clipPath: [`circle(0px at ${px}% ${py}%)`, `circle(${r}px at ${px}% ${py}%)`] },
        { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  }

  const lamp = $('.lamp');
  if (lamp) {
    const bead = $('.lamp__bead', lamp);
    let startY = null, pull = 0;
    const beadCenter = () => {
      const r = bead.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    const tug = () => {
      lamp.classList.remove('tug');
      void lamp.offsetWidth;
      lamp.classList.add('tug');
    };
    lamp.addEventListener('pointerdown', (e) => {
      startY = e.clientY;
      pull = 0;
      lamp.setPointerCapture(e.pointerId);
      lamp.classList.add('dragging');
    });
    lamp.addEventListener('pointermove', (e) => {
      if (startY === null) return;
      pull = Math.max(0, Math.min(44, e.clientY - startY));
      lamp.style.setProperty('--pull', pull + 'px');
    });
    const release = (e) => {
      if (startY === null) return;
      startY = null;
      lamp.classList.remove('dragging');
      const wasPull = pull;
      lamp.style.setProperty('--pull', '0px');
      if (wasPull > 14 || wasPull < 4) {
        if (wasPull < 4) tug();
        // Grow the circle from where the pointer actually was, like a light switch under your finger
        const [x, y] = Number.isFinite(e.clientX) && (e.clientX || e.clientY) ? [e.clientX, e.clientY] : beadCenter();
        switchTheme(x, y);
      }
    };
    lamp.addEventListener('pointerup', release);
    lamp.addEventListener('pointercancel', () => {
      startY = null;
      lamp.classList.remove('dragging');
      lamp.style.setProperty('--pull', '0px');
    });
    // Keyboard (Enter / Space) arrives as a click with detail 0
    lamp.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      tug();
      const [x, y] = beadCenter();
      switchTheme(x, y);
    });
  }

  /* ---------- Mobile menu ---------- */
  const nav = $('.nav');
  const navToggle = $('.nav__toggle');
  if (nav && navToggle) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  /* ---------- Typewriter ---------- */
  const tw = $('[data-typewriter]');
  if (tw && !reduceMotion) {
    const line = tw.closest('.typing');
    const steps = [
      ['type', 'Do LLMs reason, or do they only sound like they do?'], ['pause', 2200], ['clear'],
      ['type', 'What happens to our own voice when we write next to AI?'], ['pause', 2200], ['clear'],
      ['type', 'How do we audit what a model wrote, and where each claim came from?'], ['pause', 2200], ['clear'],
      ['type', 'All philosophers ask questions. All chatbots ask questions. ∴ All chatbots are philosophers.'], ['pause', 1100],
      ['back', 'All chatbots are philosophers.'.length], ['pause', 300],
      ['type', 'wait, that doesn’t follow.'], ['pause', 2600], ['clear'],
    ];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let visible = true;
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
    (async function run() {
      tw.textContent = '';
      for (;;) {
        for (const [op, arg] of steps) {
          while (!visible) await sleep(400);
          if (op === 'type') {
            line.classList.add('is-typing');
            for (const ch of arg) {
              tw.textContent += ch;
              await sleep(ch === ' ' ? 30 : 34 + Math.random() * 40);
            }
            line.classList.remove('is-typing');
          } else if (op === 'pause') {
            await sleep(arg);
          } else {
            line.classList.add('is-typing');
            const n = op === 'clear' ? tw.textContent.length : arg;
            for (let i = 0; i < n; i++) {
              tw.textContent = tw.textContent.slice(0, -1);
              await sleep(op === 'clear' ? 12 : 28);
            }
            line.classList.remove('is-typing');
            await sleep(250);
          }
        }
      }
    })();
  }

  /* ---------- Highlighter marks sweep in ---------- */
  const markers = $$('.marker');
  if (markers.length) {
    setTimeout(() => markers.forEach((m, i) => setTimeout(() => m.classList.add('is-on'), i * 350)), 600);
  }

  /* ---------- News: show more ---------- */
  const newsToggle = $('#news-toggle');
  if (newsToggle) {
    newsToggle.addEventListener('click', () => {
      const list = $('#news');
      const open = list.classList.toggle('is-open');
      newsToggle.setAttribute('aria-expanded', String(open));
      newsToggle.firstChild.textContent = open ? 'Show less ' : 'Show more ';
    });
  }

  /* ---------- Flip logos (FacePhys -> Tsinghua); the back image loads on first hover ---------- */
  $$('.logo-flip').forEach((btn) => {
    const lazy = $('img[data-src]', btn);
    const load = () => { if (lazy && !lazy.getAttribute('src')) lazy.src = lazy.dataset.src; };
    btn.addEventListener('pointerenter', load);
    btn.addEventListener('focus', load);
    btn.addEventListener('click', () => {
      load();
      const on = btn.classList.toggle('is-flipped');
      btn.setAttribute('aria-pressed', String(on));
    });
  });

  /* ---------- Publication covers: click to enlarge ---------- */
  const thumbs = $$('.pub__thumb[data-full]');
  if (thumbs.length && 'HTMLDialogElement' in window) {
    const box = document.createElement('dialog');
    box.className = 'lightbox';
    box.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure><button class="lightbox__close" type="button" aria-label="Close">×</button>';
    document.body.appendChild(box);
    const img = $('img', box), cap = $('figcaption', box);
    const close = () => box.close();
    $('.lightbox__close', box).addEventListener('click', close);
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    thumbs.forEach((t) => t.addEventListener('click', () => {
      const pub = t.closest('.pub');
      img.src = t.dataset.full;
      img.alt = $('img', t).alt;
      cap.textContent = $('.pub__title', pub).textContent.trim();
      box.showModal();
    }));
  }

  /* ---------- Copy buttons ---------- */
  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (await copyText(btn.dataset.copy)) toast('Email copied ∴');
    });
  });
  $$('[data-bib]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (await copyText(btn.dataset.bib)) toast('BibTeX copied ∴');
    });
  });

  /* ---------- TL;DR toggles ---------- */
  $$('[data-tldr]').forEach((btn) => {
    const box = $('.pub__tldr', btn.closest('.pub'));
    if (!box) return;
    btn.addEventListener('click', () => {
      box.hidden = !box.hidden;
      btn.setAttribute('aria-expanded', String(!box.hidden));
    });
  });

  /* ---------- Local time in Chicago ---------- */
  const clock = $('[data-localtime]');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
    const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false });
    const mood = (h) =>
      h < 7 ? 'probably asleep' :
      h < 9 ? 'probably making coffee' :
      h < 18 ? 'probably in class or coding' :
      h < 23 ? 'probably debugging something' : 'should be asleep';
    const tick = () => {
      const now = new Date();
      const h = Number(hourFmt.format(now)) % 24;
      clock.dataset.tip = `${fmt.format(now)} in Chicago · ${mood(h)}`;
    };
    tick();
    setInterval(tick, 30000);
  }

  /* ---------- GitHub stars (live, fails quietly) ---------- */
  $$('[data-stars]').forEach(async (el) => {
    try {
      const res = await fetch(`https://api.github.com/repos/${el.dataset.stars}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.stargazers_count >= 10) el.textContent = `★ ${data.stargazers_count}`;
    } catch (e) { /* offline or rate-limited */ }
  });

  /* ---------- Hero logo (research page) ---------- */
  const heroLogo = $('.logo--hero');
  if (heroLogo) {
    setTimeout(() => heroLogo.classList.add('is-venn'), reduceMotion ? 0 : 700);
    const toggle = () => heroLogo.classList.toggle('is-venn');
    heroLogo.addEventListener('click', toggle);
    heroLogo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }

  /* ---------- Publication filters (research page) ---------- */
  const filters = $('.filters');
  if (filters) {
    const state = { topic: 'all', type: 'all' };
    const pubs = $$('.pub[data-topic]');
    const count = $('.filters__count');
    const apply = () => {
      let shown = 0;
      pubs.forEach((p) => {
        const ok = (state.topic === 'all' || p.dataset.topic.split(' ').includes(state.topic)) &&
                   (state.type === 'all' || p.dataset.type === state.type);
        p.classList.toggle('is-hidden', !ok);
        if (ok) { shown++; if (!reduceMotion) p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 }); }
      });
      $$('.year-group').forEach((g) => g.classList.toggle('is-hidden', !$('.pub:not(.is-hidden)', g)));
      if (count) count.textContent = `Showing ${shown} of ${pubs.length}`;
    };
    $$('.chip', filters).forEach((chip) => {
      chip.addEventListener('click', () => {
        const group = chip.dataset.group;
        state[group] = chip.dataset.value;
        $$(`.chip[data-group="${group}"]`, filters).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        apply();
      });
    });
    apply();
  }

  /* ---------- Count-up numbers (internships page) ---------- */
  const counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    const render = (el, v) => {
      const d = el.dataset;
      el.textContent = `${d.prefix || ''}${v}${d.suffix || ''}`;
    };
    counters.forEach((el) => render(el, 0));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target;
        const target = Number(el.dataset.count);
        const t0 = performance.now();
        const step = (t) => {
          const p = Math.min(1, (t - t0) / 1100);
          render(el, Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => io.observe(el));
  }

  /* ---------- "Now" marker on the internships timeline ---------- */
  const nowMark = $('[data-now]');
  if (nowMark) {
    const d = new Date();
    const span = Number(getComputedStyle(nowMark.parentElement).getPropertyValue('--span')) || 33;
    const months = (d.getFullYear() - 2025) * 12 + d.getMonth() + d.getDate() / 31;
    if (months >= 0 && months <= span) {
      nowMark.style.setProperty('--now', (months / span * 100).toFixed(2) + '%');
      nowMark.hidden = false;
    }
  }

  /* ---------- Reveal on scroll ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Click anywhere: logic symbols float up ---------- */
  const SYMBOLS = ['∴', '∵', '∀', '∃', '¬', '∧', '∨', '→', '⊢', '≡', '⊨'];
  const COLORS = ['var(--venn-m)', 'var(--venn-s)', 'var(--venn-p)'];
  function spawn(x, y, opts = {}) {
    const el = document.createElement('span');
    el.className = 'sym';
    el.textContent = opts.symbol || SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    el.style.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    const dx = (Math.random() - 0.5) * (opts.spread || 50);
    const dy = -(opts.rise || 60) - Math.random() * 30;
    const rot = (Math.random() - 0.5) * 50;
    el.animate([
      { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 1, offset: 0.18 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg) scale(0.9)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => el.remove();
  }
  window.siteSpawn = spawn;

  if (!reduceMotion) {
    document.addEventListener('click', (e) => {
      if (e.detail === 0 || e.button !== 0) return;
      if (e.target.closest('a, button, input, textarea, select, label, summary, [role="button"], .no-sym')) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      spawn(e.clientX, e.clientY);
    });

    // Easter egg: type "therefore" anywhere
    let buf = '';
    document.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea') || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-9);
      if (buf === 'therefore') {
        buf = '';
        for (let i = 0; i < 18; i++) {
          setTimeout(() => spawn(
            innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.6,
            innerHeight * 0.55 + (Math.random() - 0.5) * 120,
            { symbol: '∴', rise: 160, spread: 120 }
          ), i * 45);
        }
        toast('∴ Q.E.D.');
      }
    });
  }

  /* ---------- Hello, curious person ---------- */
  console.log(
    '%c∴ %cHi! Thanks for opening the console.%c\nThis site is hand-written HTML/CSS/JS. Try typing "therefore" on the page.\n— Limeng · limengge@uchicago.edu',
    'color:#800000;font-size:20px;font-weight:bold', 'font-size:13px;font-weight:600', 'font-size:12px;color:#777'
  );
})();
