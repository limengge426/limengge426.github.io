/* Syllogism Lab: judge eight arguments, see the Venn diagram, compare with five LLMs. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));

  /* ---------- Data ---------- */
  // Premise order per figure: [major (involves P), minor (involves S)]
  const FIG = { 1: [['M', 'P'], ['S', 'M']], 2: [['P', 'M'], ['S', 'M']], 3: [['M', 'P'], ['M', 'S']], 4: [['P', 'M'], ['M', 'S']] };
  // From the paper (AAAI 2026 Bridge): mean accuracy per figure and per-model valid / invalid accuracy.
  const FIG_ACC = { 1: 72.7, 2: 70.2, 3: 83.0, 4: 80.6 };
  const MODELS = [
    { name: 'DeepSeek-Chat', v: 92.5, i: 58.6 },
    { name: 'Qwen3-Max', v: 89.2, i: 63.1 },
    { name: 'GPT-4o', v: 88.6, i: 62.3 },
    { name: 'LLaMA-3.3-70B', v: 85.3, i: 56.2 },
    { name: 'Gemini-2.0-Flash', v: 83.4, i: 48.7 },
  ];

  // {T:word} marks a term. Answers were checked by brute force over all non-empty S/M/P overlaps.
  const ITEMS = [
    {
      mood: 'AAA', fig: 1, valid: true,
      lines: ['All {M:bovids} are {P:ruminants}.', 'All {S:sheep} are {M:bovids}.', 'All {S:sheep} are {P:ruminants}.'],
      explain: 'Every sheep is a bovid and every bovid is a ruminant, so every sheep is a ruminant. In the diagram, the part of <i>sheep</i> outside <i>ruminants</i> is fully shaded: nothing can be there.',
    },
    {
      mood: 'IAI', fig: 1, valid: false,
      lines: ['Some {M:animals} are {P:mammals}.', 'All {S:dogs} are {M:animals}.', 'Some {S:dogs} are {P:mammals}.'],
      explain: 'True in real life, but it doesn’t follow. The first premise only says <i>some</i> animals are mammals, and those could all be non-dogs. The × sits on the edge of <i>dogs</i>: the premises don’t decide which side it’s on.',
      note: 'This exact form (IAI-1) was the worst case in the paper: <b>all five models accepted it more than 84% of the time.</b>',
    },
    {
      mood: 'AII', fig: 3, valid: true,
      lines: ['All {M:poets} are {P:writers}.', 'Some {M:poets} are {S:philosophers}.', 'Some {S:philosophers} are {P:writers}.'],
      explain: 'Take a poet who is also a philosopher. Every poet is a writer, so that philosopher is a writer. The × is forced into <i>philosophers</i> ∩ <i>writers</i>.',
    },
    {
      mood: 'AAA', fig: 2, valid: false,
      lines: ['All {P:trees} are {M:plants}.', 'All {S:oaks} are {M:plants}.', 'All {S:oaks} are {P:trees}.'],
      explain: 'True in the world, but not from these premises. Oaks and trees both sit inside <i>plants</i>, and nothing says how they relate to each other. Logicians call this an undistributed middle. The part of <i>oaks</i> outside <i>trees</i> stays open.',
    },
    {
      mood: 'EAE', fig: 1, valid: true,
      lines: ['No {M:mammals} are {P:egg-layers}.', 'All {S:platypuses} are {M:mammals}.', 'No {S:platypuses} are {P:egg-layers}.'],
      explain: 'Platypuses do lay eggs, so the conclusion is false. The argument is still valid: if both premises were true, the conclusion would have to be. The false first premise is the problem, not the logic.',
    },
    {
      mood: 'AAA', fig: 3, valid: false,
      lines: ['All {M:sparrows} are {P:birds}.', 'All {M:sparrows} are {S:songbirds}.', 'All {S:songbirds} are {P:birds}.'],
      explain: 'Both premises only talk about sparrows. As far as they go, songbirds that aren’t sparrows could be anything, so part of <i>songbirds</i> outside <i>birds</i> stays open.',
    },
    {
      mood: 'EIO', fig: 4, valid: true,
      lines: ['No {P:chatbots} are {M:philosophers}.', 'Some {M:philosophers} are {S:logicians}.', 'Some {S:logicians} are not {P:chatbots}.'],
      explain: 'Pick a logician who is a philosopher. No philosopher is a chatbot, so that logician isn’t one. The × lands in <i>logicians</i> outside <i>chatbots</i>. (Some chatbots may disagree.)',
    },
    {
      mood: 'EEE', fig: 4, valid: false,
      lines: ['No {P:birds} are {M:fish}.', 'No {M:fish} are {S:snakes}.', 'No {S:snakes} are {P:birds}.'],
      explain: 'True, but two negative premises never prove anything. Knowing that birds and snakes are both outside <i>fish</i> says nothing about how birds and snakes relate: <i>snakes</i> ∩ <i>birds</i> is not shaded.',
    },
  ];

  const TERM_COLOR = { S: 'var(--venn-s)', M: 'var(--venn-m)', P: 'var(--venn-p)' };
  const renderLine = (s) => s.replace(/\{([SMP]):([^}]+)\}/g, (_, t, w) => `<span class="term" style="--k:${TERM_COLOR[t]}">${w}</span>`);
  const plain = (s) => s.replace(/\{[SMP]:([^}]+)\}/g, '$1');
  const termsOf = (item) => {
    const out = {};
    item.lines.join(' ').replace(/\{([SMP]):([^}]+)\}/g, (_, t, w) => { out[t] ??= w; });
    return out;
  };

  /* ---------- Venn geometry ---------- */
  const W = 260, H = 232, R = 58;
  const C = { M: { x: 130, y: 84 }, S: { x: 100, y: 136 }, P: { x: 160, y: 136 } };
  const TERMS = ['S', 'M', 'P'];
  const code = (k) => `${k.S}${k.M}${k.P}`;
  const REGIONS = [];
  for (const S of [0, 1]) for (const M of [0, 1]) for (const P of [0, 1]) if (S || M || P) REGIONS.push({ S, M, P });
  const inside = (t, x, y) => (x - C[t].x) ** 2 + (y - C[t].y) ** 2 <= R * R;

  // Centroids and boundary points, found by sampling the plane
  const centroid = {};
  const samples = [];
  for (let x = 30; x <= 230; x += 2) {
    for (let y = 20; y <= 200; y += 2) {
      const k = { S: +inside('S', x, y), M: +inside('M', x, y), P: +inside('P', x, y) };
      if (!(k.S || k.M || k.P)) continue;
      samples.push({ x, y, k });
      const c = (centroid[code(k)] ??= { x: 0, y: 0, n: 0 });
      c.x += x; c.y += y; c.n++;
    }
  }
  Object.values(centroid).forEach((c) => { c.x /= c.n; c.y /= c.n; });

  function boundaryPoint(a, b, Z) {
    // a, b differ only in term Z: average the samples near Z's circle that match on the other two terms, then project onto the circle
    const others = TERMS.filter((t) => t !== Z);
    const near = samples.filter((s) => others.every((t) => s.k[t] === a[t]) && Math.abs(Math.hypot(s.x - C[Z].x, s.y - C[Z].y) - R) < 2.5);
    const mx = near.reduce((u, s) => u + s.x, 0) / near.length;
    const my = near.reduce((u, s) => u + s.y, 0) / near.length;
    const d = Math.hypot(mx - C[Z].x, my - C[Z].y) || 1;
    return { x: C[Z].x + ((mx - C[Z].x) / d) * R, y: C[Z].y + ((my - C[Z].y) / d) * R };
  }

  /* ---------- Venn method ---------- */
  function analyze(item) {
    const [maj, min] = FIG[item.fig];
    const premises = [
      { t: item.mood[0], X: maj[0], Y: maj[1], text: plain(item.lines[0]) },
      { t: item.mood[1], X: min[0], Y: min[1], text: plain(item.lines[1]) },
    ];
    const shaded = new Set();
    const xs = [];
    const steps = [];
    // Universal premises first, then particular ones
    const ordered = [...premises.filter((p) => 'AE'.includes(p.t)), ...premises.filter((p) => 'IO'.includes(p.t))];
    for (const p of ordered) {
      const yVal = p.t === 'A' || p.t === 'O' ? 0 : 1;
      const regs = REGIONS.filter((k) => k[p.X] === 1 && k[p.Y] === yVal);
      if (p.t === 'A' || p.t === 'E') {
        regs.forEach((k) => shaded.add(code(k)));
        steps.push({ kind: 'shade', keys: regs.map(code), text: p.text });
      } else {
        const open = regs.filter((k) => !shaded.has(code(k)));
        if (open.length === 1) {
          xs.push({ keys: [code(open[0])] });
          steps.push({ kind: 'x', at: centroid[code(open[0])], text: p.text });
        } else {
          const Z = TERMS.find((t) => t !== p.X && t !== p.Y);
          xs.push({ keys: open.map(code) });
          steps.push({ kind: 'x', border: true, at: boundaryPoint(open[0], open[1], Z), text: p.text });
        }
      }
    }
    const c = item.mood[2];
    const goal = REGIONS.filter((k) => k.S === 1 && k.P === (c === 'A' || c === 'O' ? 0 : 1)).map(code);
    const valid = 'AE'.includes(c)
      ? goal.every((g) => shaded.has(g))
      : xs.some((x) => x.keys.every((k) => goal.includes(k)));
    return { steps, goal, valid };
  }

  function regionShape(key, cls, extra = '') {
    const k = { S: +key[0], M: +key[1], P: +key[2] };
    let el = `<rect x="0" y="0" width="${W}" height="${H}" class="${cls}" data-key="${key}" ${extra}/>`;
    for (const t of TERMS) el = k[t] ? `<g clip-path="url(#vc-${t})">${el}</g>` : `<g mask="url(#vn-${t})">${el}</g>`;
    return el;
  }

  function vennSVG(item) {
    const terms = termsOf(item);
    const defs = TERMS.map((t) => `
      <clipPath id="vc-${t}"><circle cx="${C[t].x}" cy="${C[t].y}" r="${R}"/></clipPath>
      <mask id="vn-${t}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
        <rect x="0" y="0" width="${W}" height="${H}" fill="white"/><circle cx="${C[t].x}" cy="${C[t].y}" r="${R}" fill="black"/>
      </mask>`).join('');
    const hatch = `<pattern id="hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
        <rect width="7" height="7" style="fill:var(--text);fill-opacity:.06"/><line x1="0" y1="0" x2="0" y2="7" style="stroke:var(--text-2);stroke-width:2;stroke-opacity:.5"/></pattern>`;
    const regions = REGIONS.map((k) => regionShape(code(k), 'venn__shade', 'fill="url(#hatch)"')).join('') +
                    REGIONS.map((k) => regionShape(code(k), 'venn__goal')).join('');
    const circles = TERMS.map((t) => `<circle class="venn__circle" cx="${C[t].x}" cy="${C[t].y}" r="${R}" style="stroke:${TERM_COLOR[t]}"/>`).join('');
    const label = (t, x, y) => `<text class="venn__label" x="${x}" y="${y}" text-anchor="middle"><tspan class="k" style="fill:${TERM_COLOR[t]}">${t}</tspan> · ${terms[t]}</text>`;
    return `<svg class="venn" viewBox="0 0 ${W} ${H}" role="img" aria-label="Venn diagram of ${terms.S}, ${terms.M} and ${terms.P}">
      <defs>${defs}${hatch}</defs>
      ${regions}${circles}
      ${label('M', 130, 16)}${label('S', 62, 220)}${label('P', 198, 220)}
      <g class="venn__marks"></g>
    </svg>`;
  }

  async function playVenn(wrap, item) {
    const svg = $('svg', wrap);
    const caption = $('.venn__caption', wrap);
    const { steps, goal } = analyze(item);
    const marks = $('.venn__marks', svg);
    await sleep(250);
    for (const [i, s] of steps.entries()) {
      if (s.kind === 'shade') {
        s.keys.forEach((k) => $(`.venn__shade[data-key="${k}"]`, svg).classList.add('is-on'));
        caption.innerHTML = `${i + 1}. Shade what “${s.text}” rules out.`;
      } else {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'venn__x' + (s.border ? ' is-border' : ''));
        g.setAttribute('transform', `translate(${s.at.x.toFixed(1)} ${s.at.y.toFixed(1)})`);
        g.innerHTML = '<line x1="-5" y1="-5" x2="5" y2="5"/><line x1="-5" y1="5" x2="5" y2="-5"/>';
        marks.appendChild(g);
        requestAnimationFrame(() => g.classList.add('is-on'));
        caption.innerHTML = `${i + 1}. Put × where “${s.text}” says something exists${s.border ? ', on the line because either side is possible' : ''}.`;
      }
      await sleep(1100);
    }
    goal.forEach((k) => $(`.venn__goal[data-key="${k}"]`, svg).classList.add('is-on'));
    caption.innerHTML = `${steps.length + 1}. Now check the conclusion’s region (pulsing).`;
  }

  /* ---------- Game ---------- */
  const stage = $('#stage');
  const progress = $('#progress');
  const count = $('#game-count');
  let order = ITEMS.map((_, i) => i);
  let idx = 0;
  let answers = [];
  let phase = 'ask';

  // Sanity check: the Venn method must agree with the answer key
  ITEMS.forEach((it) => {
    if (analyze(it).valid !== it.valid) console.warn('Venn check disagrees with answer key:', it.mood + '-' + it.fig);
  });

  function drawProgress() {
    progress.innerHTML = order.map((_, i) => {
      const a = answers[i];
      const cls = a ? (a.right ? 'is-right' : 'is-wrong') : i === idx ? 'is-current' : '';
      return `<i class="${cls}"></i>`;
    }).join('');
  }

  function ask() {
    phase = 'ask';
    const item = ITEMS[order[idx]];
    count.textContent = `Argument ${idx + 1} of ${order.length}`;
    $('.keys-hint').style.visibility = '';
    drawProgress();
    stage.innerHTML = `
      <div class="game__stage">
        <div class="argument">
          <div class="argument__line"><span>1</span><span>${renderLine(item.lines[0])}</span></div>
          <div class="argument__line"><span>2</span><span>${renderLine(item.lines[1])}</span></div>
          <div class="argument__line argument__line--c"><span>∴</span><span>${renderLine(item.lines[2])}</span></div>
        </div>
        <div class="answers">
          <button class="answer" type="button" data-answer="yes"><i class="fa-solid fa-check"></i> It follows <kbd>Y</kbd></button>
          <button class="answer" type="button" data-answer="no"><i class="fa-solid fa-xmark"></i> It doesn’t follow <kbd>N</kbd></button>
        </div>
        <div class="reveal-panel">
          <div class="venn-wrap">${vennSVG(item)}<p class="venn__caption">&nbsp;</p></div>
          <div>
            <p class="verdict"></p>
            <p class="game__meta"></p>
            <p class="explain">${item.explain}</p>
            <p class="model-note"></p>
            <div class="next-row"><button class="btn-solid" type="button" data-next>${idx + 1 === order.length ? 'See how you compare' : 'Next argument'} <i class="fa-solid fa-arrow-right"></i></button></div>
          </div>
        </div>
      </div>`;
    $$('.answer', stage).forEach((b) => b.addEventListener('click', () => answer(b.dataset.answer === 'yes')));
    $('[data-next]', stage).addEventListener('click', next);
  }

  function answer(saidYes) {
    if (phase !== 'ask') return;
    phase = 'reveal';
    const item = ITEMS[order[idx]];
    const right = saidYes === item.valid;
    answers[idx] = { right, valid: item.valid };
    drawProgress();

    const picked = $(`.answer[data-answer="${saidYes ? 'yes' : 'no'}"]`, stage);
    picked.classList.add('is-picked', right ? 'is-right' : 'is-wrong');
    $$('.answer', stage).forEach((b) => { b.disabled = true; });
    if (right && window.siteSpawn && !reduceMotion) {
      const r = picked.getBoundingClientRect();
      for (let i = 0; i < 5; i++) setTimeout(() => window.siteSpawn(r.left + r.width / 2 + (Math.random() - 0.5) * 80, r.top, { symbol: '∴', rise: 70 }), i * 70);
    }

    const verdict = $('.verdict', stage);
    verdict.classList.add(right ? 'is-right' : 'is-wrong');
    verdict.textContent = `${right ? '✓ Right.' : '✗ Not quite.'} This one ${item.valid ? 'is valid: it follows.' : 'is invalid: it doesn’t follow.'}`;
    $('.game__meta', stage).innerHTML = `<span>Form <code>${item.mood}-${item.fig}</code></span><span>Figure ${item.fig}</span>`;

    const vf = MODELS.map((m) => m.v), inv = MODELS.map((m) => m.i);
    let note = item.note || (item.valid
      ? `On valid forms, the models in the paper were right <b>${Math.min(...vf)}–${Math.max(...vf)}%</b> of the time.`
      : `Invalid forms are where models struggle: only <b>${Math.min(...inv)}–${Math.max(...inv)}%</b> correct in the paper.`);
    note += ` Across all Figure ${item.fig} forms, the five models averaged <b>${FIG_ACC[item.fig]}%</b>.`;
    $('.model-note', stage).innerHTML = note;

    const panel = $('.reveal-panel', stage);
    panel.classList.add('is-shown');
    playVenn($('.venn-wrap', stage), item);
    $('[data-next]', stage).focus({ preventScroll: true });
    if (innerWidth < 860) panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  function next() {
    if (phase !== 'reveal') return;
    idx++;
    if (idx < order.length) ask(); else results();
  }

  /* ---------- Results ---------- */
  function results() {
    phase = 'done';
    drawProgress();
    count.textContent = 'Results';
    $('.keys-hint').style.visibility = 'hidden';
    const score = answers.filter((a) => a.right).length;
    const pct = (arr) => arr.length ? Math.round((arr.filter((a) => a.right).length / arr.length) * 1000) / 10 : 0;
    const you = { name: 'You', v: pct(answers.filter((a) => a.valid)), i: pct(answers.filter((a) => !a.valid)), you: true };
    const bestInvalid = Math.max(...MODELS.map((m) => m.i));

    let line;
    if (you.i < you.v) line = 'Like every model in the paper, you were better at accepting good arguments than rejecting bad ones.';
    else if (you.i > bestInvalid) line = `You rejected bad arguments better than every model in the paper (the best was Qwen3-Max at ${bestInvalid}%).`;
    else line = 'You were at least as good at rejecting bad arguments as at accepting good ones, which is more than any model managed.';

    stage.innerHTML = `
      <div class="results">
        <div class="results__score">
          <div class="big">${score} / ${order.length}</div>
          <p>${line}</p>
        </div>
        <div class="chart">
          <div class="chart__legend">
            <span><i style="background:var(--dv)"></i>Valid arguments (correct answer: follows)</span>
            <span><i style="background:var(--di)"></i>Invalid arguments (correct answer: doesn’t follow)</span>
          </div>
          <div class="chart__plot"></div>
          <details class="chart-table">
            <summary>Show as a table</summary>
            <table>
              <thead><tr><th></th><th>Valid</th><th>Invalid</th><th>Gap</th></tr></thead>
              <tbody>${[you, ...MODELS].map((m) => `<tr><td>${m.name}</td><td>${m.v}%</td><td>${m.i}%</td><td>${(m.v - m.i).toFixed(1)}</td></tr>`).join('')}</tbody>
            </table>
          </details>
          <p class="fineprint">You answered 4 valid and 4 invalid arguments, so your numbers move in steps of 25%. Model accuracies are over 6,000 valid and 5,000 invalid items.</p>
        </div>
        <div class="results__actions">
          <button class="btn-solid" type="button" data-again><i class="fa-solid fa-rotate-right"></i> Play again</button>
          <button class="btn-quiet" type="button" data-share style="margin-top:0"><i class="fa-regular fa-copy"></i> Copy my score</button>
          <a class="btn-quiet" href="https://openreview.net/pdf?id=fMIpSy6NVW" target="_blank" rel="noopener" style="margin-top:0">Read the paper <i class="fa-solid fa-arrow-right"></i></a>
        </div>
      </div>`;

    const plot = $('.chart__plot', stage);
    const rows = [you, ...MODELS];
    const draw = () => drawChart(plot, rows);
    draw();
    let rt;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(draw, 120); };
    addEventListener('resize', onResize);

    $('[data-again]', stage).addEventListener('click', () => {
      removeEventListener('resize', onResize);
      order = shuffle(order.slice());
      idx = 0; answers = [];
      ask();
      $('#game').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
    $('[data-share]', stage).addEventListener('click', async () => {
      const text = `I scored ${score}/${order.length} on Limeng Ge's Syllogism Lab ∴ ${location.href}`;
      try { await navigator.clipboard.writeText(text); window.siteToast?.('Score copied ∴'); } catch (e) { window.siteToast?.(text); }
    });

    if (score === order.length && window.siteSpawn && !reduceMotion) {
      for (let i = 0; i < 24; i++) setTimeout(() => window.siteSpawn(innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.7, innerHeight * 0.6, { symbol: '∴', rise: 200, spread: 160 }), i * 40);
      window.siteToast?.('Perfect score. ∴ Q.E.D.');
    }
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- Dumbbell chart: valid vs invalid accuracy ---------- */
  let tip;
  function drawChart(host, rows) {
    const Wc = Math.max(300, host.clientWidth);
    const narrow = Wc < 480;
    const labelW = narrow ? 104 : 132;
    const gapW = narrow ? 44 : 60;
    const x0 = labelW + 8, x1 = Wc - gapW - 8;
    const rowH = 34, top = 6;
    const Hc = top + rows.length * rowH + 26;
    const X = (p) => x0 + (p / 100) * (x1 - x0);

    let s = `<svg viewBox="0 0 ${Wc} ${Hc}" width="${Wc}" height="${Hc}" role="img" aria-label="Accuracy on valid and invalid arguments: you compared with five language models">`;
    [0, 25, 50, 75, 100].forEach((t) => {
      s += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${top}" y2="${top + rows.length * rowH}"/>`;
      s += `<text class="axis" x="${X(t)}" y="${Hc - 8}" text-anchor="middle">${t}%</text>`;
    });
    s += `<text class="axis" x="${Wc - 4}" y="${Hc - 8}" text-anchor="end">gap</text>`;
    rows.forEach((r, n) => {
      const cy = top + n * rowH + rowH / 2;
      if (r.you) s += `<rect class="you-band" x="0" y="${cy - rowH / 2 + 2}" width="${Wc}" height="${rowH - 4}" rx="6"/>`;
      s += `<text class="row-label${r.you ? ' is-you' : ''}" x="8" y="${cy + 4}">${r.name}</text>`;
      s += `<line class="gap-line" x1="${X(Math.min(r.v, r.i))}" x2="${X(Math.max(r.v, r.i))}" y1="${cy}" y2="${cy}"/>`;
      const both = r.v === r.i;
      s += `<circle class="dot dot--i" cx="${X(r.i)}" cy="${cy + (both ? 4 : 0)}" r="5.5"/>`;
      s += `<circle class="dot dot--v" cx="${X(r.v)}" cy="${cy - (both ? 4 : 0)}" r="5.5"/>`;
      s += `<circle class="hit" cx="${X(r.i)}" cy="${cy}" r="12" data-tip="${r.name} · invalid arguments: ${r.i}% correct"/>`;
      s += `<circle class="hit" cx="${X(r.v)}" cy="${cy}" r="12" data-tip="${r.name} · valid arguments: ${r.v}% correct"/>`;
      const gap = r.v - r.i;
      s += `<text class="gap-label" x="${Wc - 4}" y="${cy + 4}" text-anchor="end">${gap > 0 ? '+' : ''}${gap.toFixed(1)}</text>`;
    });
    s += '</svg>';
    host.innerHTML = s;

    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      document.body.appendChild(tip);
    }
    $$('.hit', host).forEach((h) => {
      h.addEventListener('pointerenter', () => { tip.textContent = h.dataset.tip; tip.classList.add('is-on'); });
      h.addEventListener('pointermove', (e) => { tip.style.left = e.clientX + 12 + 'px'; tip.style.top = e.clientY - 34 + 'px'; });
      h.addEventListener('pointerleave', () => tip.classList.remove('is-on'));
    });
  }

  /* ---------- Keyboard ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (phase === 'ask' && (k === 'y' || k === 'n')) { e.preventDefault(); answer(k === 'y'); }
    else if (phase === 'reveal' && (k === 'enter' || k === 'arrowright') && !e.target.closest?.('button, a')) { e.preventDefault(); next(); }
  });

  ask();
})();
