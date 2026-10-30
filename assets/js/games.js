/* LUNAR – games, settings, codex, universes, player name and leaderboard */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const S = window.Space;

  /* ---------- settings ---------- */
  const DEF = { sound: true, volume: 70, cpsDefault: 10, chaosAt: 50, chaosEvery: 12, ambient: false, motion: true, quality: 'high' };
  const Set_ = Object.assign({}, DEF, load('lunar-settings', {}));
  const saveSettings = () => save('lunar-settings', Set_);

  /* ---------- sound ---------- */
  const Snd = {
    ctx: null,
    get() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
    vol() { return Set_.sound ? Set_.volume / 70 : 0; },
    tone(f, d = .08, type = 'sine', v = .07, slide) {
      const vv = v * this.vol(); if (vv <= 0) return; const c = this.get(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
      o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
      g.gain.setValueAtTime(vv, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .03);
    },
    boom(d = .45, v = .16) {
      const vv = v * this.vol(); if (vv <= 0) return; const c = this.get(); if (!c) return;
      const len = c.sampleRate * d, b = c.createBuffer(1, len, c.sampleRate), data = b.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
      f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(120, t + d);
      g.gain.value = vv; src.buffer = b; src.connect(f).connect(g).connect(c.destination); src.start(t);
    }
  };

  /* ---------- toast ---------- */
  const toast = $('#toast'); let toastT;
  function say(main, sub) {
    if (!main) return; toast.textContent = '';
    const a = document.createElement('b'); a.textContent = main; toast.appendChild(a);
    if (sub) { const b = document.createElement('span'); b.textContent = sub; toast.appendChild(b); }
    toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  /* ---------- codex: 1,000 events to discover ---------- */
  const Codex = {
    found: new Set(load('lunar-codex', [])), recent: load('lunar-codex-recent', []),
    discover(id) {
      const isNew = !this.found.has(id);
      if (isNew) { this.found.add(id); save('lunar-codex', [...this.found]); }
      this.recent = [id, ...this.recent.filter((x) => x !== id)].slice(0, 8); save('lunar-codex-recent', this.recent);
      return isNew;
    }
  };
  function announce(evs) {
    evs = evs.filter(Boolean); if (!evs.length) return;
    let fresh = 0; evs.forEach((e) => { if (Codex.discover(e.id)) fresh++; });
    const main = evs.map((e) => e.name).join(' + ');
    say(main, `${fresh ? (fresh > 1 ? fresh + ' new discoveries, ' : 'New discovery, ') : ''}${Codex.found.size} of ${S.EVENT_COUNT} found`);
  }
  function chaos() {
    if (Math.random() < .025) { S.zeroG(); say('Zero gravity', 'A rare one'); return; }
    announce([S.randomEvent()]); Snd.tone(110, .7, 'sawtooth', .04, 40);
  }
  function combo(n) { announce(S.combo(n)); Snd.tone(70, 1.2, 'sawtooth', .05, 28); }

  /* ---------- player name ---------- */
  const modal = $('#nameModal'), nameForm = $('#nameForm'), nameInput = $('#nameInput'), nameErr = $('#nameErr'), nameCancel = $('#nameCancel'), playerBtn = $('#playerBtn');
  const Player = {
    name: load('lunar-name', ''),
    set(n) { this.name = n; save('lunar-name', n); playerBtn.textContent = n; $('#set-name-val').textContent = n; },
    ask(first) { modal.hidden = false; nameCancel.hidden = !!first; nameErr.textContent = ''; $('#nm-title').textContent = first ? 'Welcome to LUNAR' : 'Change your name'; nameInput.value = this.name; setTimeout(() => nameInput.focus(), 30); }
  };
  nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = nameInput.value.replace(/\s+/g, ' ').trim();
    if (n.length < 2) { nameErr.textContent = 'Use at least 2 characters.'; return; }
    if (n.length > 16) { nameErr.textContent = 'Keep it to 16 characters or fewer.'; return; }
    Player.set(n); modal.hidden = true; Snd.tone(660, .12, 'sine', .05, 990); renderBoard();
  });
  nameCancel.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape' && Player.name) modal.hidden = true; });
  playerBtn.addEventListener('click', () => Player.ask(false));
  $('#set-name').addEventListener('click', () => Player.ask(false));

  /* ---------- leaderboard (saved on this device) ---------- */
  const GAMES = {
    cps: { high: true, fmt: (v, b) => (b === 'inf' ? v + ' clicks' : v.toFixed(2) + ' clicks/sec') },
    meteors: { high: true, fmt: (v) => v + ' points' },
    reaction: { high: false, fmt: (v) => v + ' ms' },
    aim: { high: false, fmt: (v) => v + ' ms per star' },
    memory: { high: true, fmt: (v) => 'Level ' + v }
  };
  const Board = {
    key: 'lunar-board', all() { return load(this.key, {}); },
    add(game, score, bucket) {
      if (!Player.name) return 0;
      const all = this.all(), k = bucket ? game + ':' + bucket : game, list = all[k] || [], t = Date.now();
      list.push({ n: Player.name, s: score, t });
      const hi = GAMES[game].high; list.sort((a, b) => (hi ? b.s - a.s : a.s - b.s) || a.t - b.t);
      all[k] = list.slice(0, 25); save(this.key, all);
      return all[k].findIndex((r) => r.t === t) + 1;
    },
    top(game, bucket) { return this.all()[bucket ? game + ':' + bucket : game] || []; }
  };
  const lbBody = $('#lb-body'), lbEmpty = $('#lb-empty'), lbDurs = $('#lb-durs');
  let lbGame = 'cps', lbDur = '10';
  function renderBoard() {
    $$('#lb-games .chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.g === lbGame ? 'true' : 'false'));
    $$('#lb-durs .chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.d === lbDur ? 'true' : 'false'));
    lbDurs.hidden = lbGame !== 'cps';
    const bucket = lbGame === 'cps' ? lbDur : '', rows = Board.top(lbGame, bucket);
    lbBody.textContent = '';
    rows.forEach((r, i) => {
      const tr = document.createElement('tr'); if (r.n === Player.name) tr.className = 'me';
      [i + 1, r.n, GAMES[lbGame].fmt(r.s, bucket), new Date(r.t).toLocaleDateString()].forEach((v, j) => { const td = document.createElement('td'); td.textContent = v; if (j === 0) td.className = 'rk'; tr.appendChild(td); });
      lbBody.appendChild(tr);
    });
    lbEmpty.hidden = rows.length > 0; lbEmpty.textContent = 'No scores here yet. Go set the first one.';
  }
  $$('#lb-games .chip').forEach((c) => c.addEventListener('click', () => { lbGame = c.dataset.g; renderBoard(); }));
  $$('#lb-durs .chip').forEach((c) => c.addEventListener('click', () => { lbDur = c.dataset.d; renderBoard(); }));
  const rankNote = (r) => (r === 1 ? ' #1 on the leaderboard!' : r && r <= 10 ? ` #${r} on the leaderboard.` : '');

  /* ---------- routing ---------- */
  const VIEWS = ['solar', 'rover', 'home', 'cps', 'meteors', 'reaction', 'aim', 'memory', 'leaderboard', 'universes', 'codex', 'settings', 'credits'];
  const ALIAS = { '': 'solar', games: 'home' };
  const EX = window.Explore || { supported: false, enterSpace() {}, enterRover() {}, exit() {} };
  function route() {
    let v = location.hash.slice(1); v = ALIAS[v] != null ? ALIAS[v] : v; if (!VIEWS.includes(v)) v = 'solar';
    if ((v === 'solar' || v === 'rover') && !EX.supported) v = 'home';
    $$('.view').forEach((el) => el.classList.toggle('on', el.id === 'view-' + v));
    $$('.nav a').forEach((a) => { const t = a.dataset.v || a.getAttribute('href').slice(1); a.setAttribute('aria-current', t === v || (v === 'rover' && t === 'solar') ? 'page' : 'false'); });
    if (v === 'solar') EX.enterSpace(); else if (v === 'rover') EX.enterRover(); else EX.exit();
    if (v === 'credits') renderCredits();
    document.body.dataset.view = v;
    if (v !== 'meteors') Meteors.pause();
    if (v !== 'reaction') Reaction.reset();
    if (v !== 'aim') Aim.reset();
    if (v !== 'memory') Memory.reset();
    if (v !== 'cps' && cState === 'run') finish();
    S.setCalm(v === 'meteors');
    paintHome();
    if (v === 'leaderboard') renderBoard();
    if (v === 'codex') renderCodex();
    if (v === 'universes') renderUniverses();
    if (v === 'settings') paintSettings();
    window.scrollTo(0, 0);
    const h = $('#view-' + v + ' h2'); if (h && v !== 'home') { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  addEventListener('hashchange', route);

  function paintHome() {
    const c = load('lunar-cps', {}), m = load('lunar-meteors', 0), r = load('lunar-reaction', 0), a = load('lunar-aim', 0), me = load('lunar-memory', 0);
    const rates = Object.keys(c).filter((k) => k !== 'inf').map((k) => c[k]), top = rates.length ? Math.max(...rates) : 0;
    $('#best-cps').textContent = top ? `Best: ${top.toFixed(2)} clicks/sec` : 'No score yet';
    $('#best-meteors').textContent = m ? `Best: ${m} points` : 'No score yet';
    $('#best-reaction').textContent = r ? `Best: ${r} ms average` : 'No score yet';
    $('#best-aim').textContent = a ? `Best: ${a} ms per star` : 'No score yet';
    $('#best-memory').textContent = me ? `Best: level ${me}` : 'No score yet';
    $('#best-codex').textContent = `${Codex.found.size} of ${S.EVENT_COUNT} discovered`;
    $('#best-universes').textContent = `You’re in ${S.current().name}`;
  }

  /* ---------- 1. click speed (with no-limit mode) ---------- */
  const pad = $('#pad'), padNum = $('#padNum'), padLabel = $('#padLabel'), padFx = $('#padFx');
  const elClicks = $('#cps-clicks'), elTime = $('#cps-time'), elTimeL = $('#cps-time-label'), elRate = $('#cps-rate'), bar = $('#cps-bar'), barWrap = $('#cps-barwrap');
  const result = $('#cps-result'), hint = $('#cps-hint'), bestEl = $('#cps-best'), stopBtn = $('#cps-stop');
  const chips = $$('#cps-chips .chip');
  let dur = +Set_.cpsDefault, cState = 'idle', clicks = 0, t0 = 0, lastClick = 0, bests = load('lunar-cps', {});
  const ranks = [[3, 'Snail', 'Slow and steady.'], [5, 'Drifter', 'A gentle orbit. Room to speed up.'], [7, 'Runner', 'Solid pace.'], [9, 'Comet', 'Fast fingers.'], [11, 'Shooting star', 'Seriously quick.'], [13, 'Warp drive', 'That’s elite clicking.'], [Infinity, 'Light speed', 'Are you even human?']];
  const endless = () => dur === 0;
  function showBest() {
    if (endless()) { const b = bests.inf; bestEl.textContent = b ? `Your most clicks with no limit: ${b}` : 'No no-limit run yet'; return; }
    const b = bests[dur]; bestEl.textContent = b ? `Your best at ${dur} s: ${b.toFixed(2)} clicks/sec` : `No best yet for ${dur} s`;
  }
  function resetReadout() {
    elClicks.textContent = '0'; elRate.textContent = '0.0';
    elTime.textContent = endless() ? '0.0' : dur.toFixed(1); elTimeL.textContent = endless() ? 'seconds' : 'seconds left';
    barWrap.hidden = endless(); bar.style.transform = 'scaleX(1)';
    padNum.textContent = '0'; padLabel.textContent = 'Click to start';
  }
  function pickDur(d) {
    if (cState === 'run') return; dur = +d;
    chips.forEach((x) => x.setAttribute('aria-pressed', +x.dataset.d === dur ? 'true' : 'false'));
    resetReadout(); showBest();
  }
  chips.forEach((c) => c.addEventListener('click', () => pickDur(c.dataset.d)));
  function padEffect(x, y) { const r = document.createElement('i'); r.className = 'ring'; r.style.left = x + 'px'; r.style.top = y + 'px'; padFx.appendChild(r); setTimeout(() => r.remove(), 520); }
  function hit(x, y) {
    if (cState === 'locked') return;
    if (cState !== 'run') {
      cState = 'run'; clicks = 0; t0 = performance.now(); chips.forEach((c) => (c.disabled = true)); stopBtn.hidden = !endless();
      padLabel.textContent = 'clicks'; hint.textContent = `Keep going. ${Set_.chaosAt} clicks breaks the universe.`;
      result.innerHTML = '<p class="sub">Go go go…</p>'; requestAnimationFrame(tick);
    }
    clicks++; lastClick = performance.now(); elClicks.textContent = clicks; padNum.textContent = clicks;
    pad.classList.remove('pop'); void pad.offsetWidth; pad.classList.add('pop');
    padEffect(x, y); Snd.tone(520 + Math.min(clicks, 120) * 6, .04, 'triangle', .035);
    const A = Set_.chaosAt, E = Set_.chaosEvery;
    if (clicks === A) { hint.textContent = `Chaos unlocked. Every ${E} more clicks, something new.`; chaos(); }
    else if (clicks === A * 2) { hint.textContent = `${A * 2} clicks. Double trouble.`; combo(2); }
    else if (clicks === A * 3) { hint.textContent = `${A * 3} clicks. Total chaos.`; combo(3); }
    else if (clicks === A * 4) { hint.textContent = `${A * 4} clicks. You broke the universe.`; combo(4); S.zeroG(); Snd.boom(1.4, .3); }
    else if (clicks > A * 4 && clicks % 100 === 0) combo(3);
    else if (clicks > A && (clicks - A) % E === 0) chaos();
  }
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); const r = padFx.getBoundingClientRect(); hit(e.clientX - r.left, e.clientY - r.top); });
  pad.addEventListener('click', (e) => e.preventDefault());
  pad.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); const r = padFx.getBoundingClientRect(); hit(r.width / 2, r.height / 2); } });
  stopBtn.addEventListener('click', () => { if (cState === 'run') finish(); });
  function tick() {
    if (cState !== 'run') return;
    const now = performance.now(), el = (now - t0) / 1000;
    if (endless()) {
      elTime.textContent = el.toFixed(1); elRate.textContent = (clicks / Math.max(el, .15)).toFixed(1);
      if (now - lastClick > 5000) { finish('Stopped after 5 seconds without a click.'); return; }
      requestAnimationFrame(tick); return;
    }
    const left = Math.max(0, dur - el);
    elTime.textContent = left.toFixed(1); elRate.textContent = (clicks / Math.max(el, .15)).toFixed(1); bar.style.transform = `scaleX(${left / dur})`;
    if (left <= 0) finish(); else requestAnimationFrame(tick);
  }
  function finish(note) {
    if (cState !== 'run') return;
    cState = 'locked'; stopBtn.hidden = true;
    const secs = endless() ? Math.max(.5, (lastClick - t0) / 1000) : dur, cps = clicks / secs;
    elRate.textContent = cps.toFixed(2); if (!endless()) elTime.textContent = '0.0';
    padNum.textContent = endless() ? clicks : cps.toFixed(1); padLabel.textContent = endless() ? 'clicks' : 'clicks/sec';
    const [, name, line] = ranks.find((r) => cps < r[0]);
    let nb, lr;
    if (endless()) { nb = clicks > 0 && (!bests.inf || clicks > bests.inf); if (nb) bests.inf = clicks; lr = clicks ? Board.add('cps', clicks, 'inf') : 0; }
    else { nb = clicks > 0 && (!bests[dur] || cps > bests[dur]); if (nb) bests[dur] = cps; lr = clicks ? Board.add('cps', +cps.toFixed(2), String(dur)) : 0; }
    save('lunar-cps', bests);
    result.textContent = '';
    const rk = document.createElement('p'); rk.className = 'rank'; rk.textContent = name;
    const sb = document.createElement('p'); sb.className = 'sub';
    sb.textContent = `${clicks} clicks in ${secs.toFixed(1)} s, ${cps.toFixed(2)} per second. ${line}${nb ? ' New personal best!' : ''}${rankNote(lr)}`;
    result.append(rk, sb); showBest(); Snd.tone(880, .25, 'sine', .06, 1320);
    if (nb) S.shootingStar();
    hint.textContent = note || 'Nice. Hang on…';
    setTimeout(() => { cState = 'done'; chips.forEach((c) => (c.disabled = false)); hint.textContent = (note ? note + ' ' : '') + 'Click the circle to go again.'; }, 1000);
  }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && cState === 'run' && endless()) finish(); });

  /* ---------- 2. meteor defense (3D) ---------- */
  const mOv = $('#m-overlay'), mTitle = $('#m-title'), mText = $('#m-text'), mBtn = $('#m-btn'), mScore = $('#m-score'), mLives = $('#m-lives');
  const Meteors = {
    state: 'idle', prev: 0,
    hearts(l) { l = Math.max(0, l); mLives.textContent = '♥'.repeat(l) + '♡'.repeat(3 - l); },
    start() {
      if (!S.ok) { mText.textContent = 'This game needs WebGL, which your browser has turned off.'; return; }
      this.prev = 0; mScore.textContent = '0'; this.hearts(3);
      S.defense.start({
        onScore: (s, crystal) => { mScore.textContent = s; Snd.boom(crystal ? .6 : .35, crystal ? .2 : .13); if (crystal) Snd.tone(1200, .2, 'sine', .05, 1800); if (Math.floor(s / 50) > Math.floor(this.prev / 50)) chaos(); this.prev = s; },
        onLife: (l) => { this.hearts(l); Snd.tone(90, .5, 'square', .05, 40); },
        onEnd: (s) => {
          this.state = 'over'; const best = load('lunar-meteors', 0), nb = s > best; if (nb) save('lunar-meteors', s);
          const lr = s ? Board.add('meteors', s) : 0;
          mTitle.textContent = nb ? 'New best!' : 'Impact';
          mText.textContent = `You scored ${s}.${nb ? ' That’s your highest yet.' : ' Best so far: ' + best + '.'}${rankNote(lr)}`;
          mBtn.textContent = 'Play again'; mOv.hidden = false; Snd.boom(1, .25);
        }
      });
      this.state = 'run'; mOv.hidden = true; Snd.tone(330, .2, 'sine', .05, 660);
    },
    pause() { if (this.state !== 'run') return; S.defense.pause(); this.state = 'paused'; mTitle.textContent = 'Paused'; mText.textContent = `Score so far: ${mScore.textContent}.`; mBtn.textContent = 'Resume'; mOv.hidden = false; },
    resume() { S.defense.resume(); this.state = 'run'; mOv.hidden = true; }
  };
  mBtn.addEventListener('click', () => (Meteors.state === 'paused' ? Meteors.resume() : Meteors.start()));
  $('#space').addEventListener('pointerdown', (e) => { if (document.body.dataset.view === 'meteors' && Meteors.state === 'run' && !S.defense.click(e.clientX, e.clientY)) Snd.tone(200, .05, 'triangle', .02); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && Meteors.state === 'run') Meteors.pause(); });

  /* ---------- 3. reaction time ---------- */
  const rz = $('#r-zone'), rMain = $('#r-main'), rSub = $('#r-sub'), rList = $('#r-list'), ROUNDS = 5;
  const Reaction = {
    state: 'idle', times: [], timer: 0, go: 0,
    reset() { clearTimeout(this.timer); this.state = 'idle'; this.times = []; this.paint('idle', 'Click to start', `${ROUNDS} rounds. Wait for the flash, then click as fast as you can.`); rList.innerHTML = ''; },
    paint(s, main, sub) { rz.dataset.state = s; rMain.textContent = main; rSub.textContent = sub; },
    arm() { this.state = 'wait'; this.paint('wait', 'Wait for it…', `Round ${this.times.length + 1} of ${ROUNDS}`);
      this.timer = setTimeout(() => { this.state = 'go'; this.go = performance.now(); this.paint('go', 'Click!', ''); Snd.tone(990, .08, 'square', .04); }, 1200 + Math.random() * 2800); },
    press() {
      if (this.state === 'idle' || this.state === 'done' || this.state === 'early') { if (this.state !== 'early') { this.times = []; rList.innerHTML = ''; } this.arm(); return; }
      if (this.state === 'wait') { clearTimeout(this.timer); this.state = 'early'; this.paint('early', 'Too soon', 'Click to retry this round'); Snd.tone(150, .2, 'sawtooth', .04); return; }
      if (this.state === 'go') {
        const ms = Math.round(performance.now() - this.go); this.times.push(ms);
        const li = document.createElement('li'); li.textContent = `${ms} ms`; rList.appendChild(li);
        if (this.times.length >= ROUNDS) {
          const avg = Math.round(this.times.reduce((a, b) => a + b, 0) / ROUNDS), best = load('lunar-reaction', 0), nb = !best || avg < best;
          if (nb) save('lunar-reaction', avg);
          const lr = Board.add('reaction', avg); this.state = 'done';
          const verdict = avg < 200 ? 'Pilot reflexes.' : avg < 260 ? 'Sharp.' : avg < 330 ? 'Solid.' : 'Keep practicing.';
          this.paint('done', `${avg} ms average`, `${verdict}${nb ? ' New personal best!' : ''}${rankNote(lr)} Click to play again.`); Snd.tone(660, .2, 'sine', .05, 990);
        } else { this.state = 'between'; this.paint('between', `${ms} ms`, 'Get ready…'); this.timer = setTimeout(() => this.arm(), 900); }
      }
    }
  };
  rz.addEventListener('pointerdown', (e) => { e.preventDefault(); Reaction.press(); });
  rz.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); Reaction.press(); } });

  /* ---------- 4. star aim ---------- */
  const az = $('#a-zone'), aTarget = $('#a-target'), aStart = $('#a-start'), aInfo = $('#a-info'), aLeft = $('#a-left'), aAcc = $('#a-acc'), aTime = $('#a-time'), TARGETS = 25;
  const Aim = {
    state: 'idle', hits: 0, misses: 0, t0: 0, raf: 0,
    reset() { cancelAnimationFrame(this.raf); this.state = 'idle'; aTarget.hidden = true; aStart.hidden = false; aStart.textContent = 'Start'; aInfo.textContent = `Hit ${TARGETS} stars as fast as you can. Misses count against your accuracy.`; aLeft.textContent = TARGETS; aAcc.textContent = '100%'; aTime.textContent = '0.00'; },
    start() { this.state = 'run'; this.hits = 0; this.misses = 0; this.t0 = performance.now(); aStart.hidden = true; aInfo.textContent = ''; this.place(); this.loop(); },
    loop() { if (this.state !== 'run') return; aTime.textContent = ((performance.now() - this.t0) / 1000).toFixed(2); this.raf = requestAnimationFrame(() => this.loop()); },
    place() { const w = az.clientWidth, h = az.clientHeight, s = 54; aTarget.style.left = (12 + Math.random() * (w - s - 24)) + 'px'; aTarget.style.top = (12 + Math.random() * (h - s - 24)) + 'px'; aTarget.hidden = false; aTarget.classList.remove('in'); void aTarget.offsetWidth; aTarget.classList.add('in'); },
    acc() { return Math.round(this.hits / Math.max(1, this.hits + this.misses) * 100); },
    hit() { this.hits++; Snd.tone(700 + this.hits * 20, .06, 'triangle', .04); aLeft.textContent = TARGETS - this.hits; aAcc.textContent = this.acc() + '%'; if (this.hits >= TARGETS) { this.end(); return; } this.place(); },
    miss() { this.misses++; aAcc.textContent = this.acc() + '%'; Snd.tone(160, .06, 'triangle', .02); },
    end() {
      this.state = 'done'; cancelAnimationFrame(this.raf); aTarget.hidden = true;
      const total = performance.now() - this.t0, per = Math.round(total / TARGETS), acc = this.acc();
      const best = load('lunar-aim', 0), nb = !best || per < best; if (nb) save('lunar-aim', per);
      const lr = Board.add('aim', per); aTime.textContent = (total / 1000).toFixed(2);
      aInfo.textContent = `${per} ms per star with ${acc}% accuracy.${nb ? ' New personal best!' : ''}${rankNote(lr)}`;
      aStart.textContent = 'Play again'; aStart.hidden = false; Snd.tone(660, .2, 'sine', .05, 990);
    }
  };
  aStart.addEventListener('click', (e) => { e.stopPropagation(); Aim.start(); });
  aTarget.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (Aim.state === 'run') Aim.hit(); });
  aTarget.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && Aim.state === 'run') { e.preventDefault(); Aim.hit(); } });
  az.addEventListener('pointerdown', (e) => { if (Aim.state === 'run' && e.target === az) Aim.miss(); });

  /* ---------- 5. constellation memory ---------- */
  const NODES = [[90, 250], [170, 165], [262, 118], [330, 196], [300, 300], [428, 150], [508, 86], [474, 256], [552, 322]];
  const LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [5, 6], [5, 7], [7, 8]];
  const NOTES = [262, 294, 330, 392, 440, 523, 587, 659, 784];
  const svg = $('#mem-svg'), memMain = $('#mem-main'), memSub = $('#mem-sub'), memBtn = $('#mem-btn'), memLevel = $('#mem-level');
  (function build() {
    const ns = 'http://www.w3.org/2000/svg';
    LINKS.forEach(([a, b]) => { const l = document.createElementNS(ns, 'line'); l.setAttribute('x1', NODES[a][0]); l.setAttribute('y1', NODES[a][1]); l.setAttribute('x2', NODES[b][0]); l.setAttribute('y2', NODES[b][1]); l.setAttribute('class', 'link'); svg.appendChild(l); });
    NODES.forEach(([x, y], i) => {
      const g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'node'); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', 'Star ' + (i + 1));
      g.innerHTML = `<circle class="hitc" cx="${x}" cy="${y}" r="32"/><circle class="halo" cx="${x}" cy="${y}" r="22"/><circle class="core" cx="${x}" cy="${y}" r="8"/>`;
      svg.appendChild(g);
    });
  })();
  const nodeEls = $$('.node', svg);
  const Memory = {
    state: 'idle', seq: [], idx: 0, timers: [],
    clear() { this.timers.forEach(clearTimeout); this.timers = []; nodeEls.forEach((n) => n.classList.remove('lit')); },
    reset() { this.clear(); this.state = 'idle'; this.seq = []; memLevel.textContent = '0'; memMain.textContent = 'Watch the stars light up, then repeat the pattern.'; memSub.textContent = 'Each level adds one more star.'; memBtn.hidden = false; memBtn.textContent = 'Start'; },
    light(i, ms) { const n = nodeEls[i]; n.classList.add('lit'); Snd.tone(NOTES[i], Math.min(.35, ms / 1000), 'sine', .06); this.timers.push(setTimeout(() => n.classList.remove('lit'), ms)); },
    next() {
      this.seq.push(Math.random() * NODES.length | 0); this.idx = 0; this.state = 'show'; memLevel.textContent = this.seq.length; memMain.textContent = 'Watch…'; memSub.textContent = '';
      const step = Math.max(320, 640 - this.seq.length * 22);
      this.seq.forEach((n, k) => this.timers.push(setTimeout(() => this.light(n, step * .7), 500 + k * step)));
      this.timers.push(setTimeout(() => { this.state = 'input'; memMain.textContent = 'Your turn'; memSub.textContent = `Repeat ${this.seq.length} star${this.seq.length > 1 ? 's' : ''}`; }, 500 + this.seq.length * step));
    },
    start() { this.clear(); this.seq = []; memBtn.hidden = true; this.next(); },
    press(i) {
      if (this.state !== 'input') return; this.light(i, 220);
      if (i !== this.seq[this.idx]) {
        this.state = 'over'; const lvl = this.seq.length - 1, best = load('lunar-memory', 0), nb = lvl > best; if (nb) save('lunar-memory', lvl);
        const lr = lvl ? Board.add('memory', lvl) : 0;
        memMain.textContent = `Lost in space at level ${this.seq.length}`; memSub.textContent = `You cleared ${lvl}.${nb ? ' New personal best!' : ' Best: ' + best + '.'}${rankNote(lr)}`;
        memBtn.textContent = 'Try again'; memBtn.hidden = false; Snd.tone(140, .5, 'sawtooth', .05, 60); return;
      }
      this.idx++;
      if (this.idx >= this.seq.length) { this.state = 'show'; memMain.textContent = 'Nice'; if (this.seq.length >= 6 && this.seq.length % 3 === 0) chaos(); this.timers.push(setTimeout(() => this.next(), 700)); }
    }
  };
  nodeEls.forEach((n, i) => { n.addEventListener('pointerdown', (e) => { e.preventDefault(); Memory.press(i); }); n.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); Memory.press(i); } }); });
  memBtn.addEventListener('click', () => Memory.start());

  /* ---------- codex view ---------- */
  const cxGroups = $('#cx-groups'), cxCount = $('#cx-count'), cxBar = $('#cx-bar'), cxRecent = $('#cx-recent');
  const tiles = [], secs_ = [];
  (function buildCodex() {
    S.PRIMS.forEach((pname, p) => {
      const sec = document.createElement('section'); sec.className = 'cx-sec';
      const h = document.createElement('h3'), hn = document.createElement('span'), hc = document.createElement('small');
      hn.textContent = pname; h.append(hn, hc); sec.appendChild(h);
      const grid = document.createElement('div'); grid.className = 'cx-grid';
      for (let k = 0; k < 50; k++) {
        const id = p * 50 + k, b = document.createElement('button'); b.className = 'cx-tile'; b.type = 'button'; b.dataset.id = id;
        b.style.setProperty('--c', S.eventColor(id)); grid.appendChild(b); tiles[id] = b;
      }
      sec.appendChild(grid); cxGroups.appendChild(sec); secs_.push({ p, hc });
    });
    cxGroups.addEventListener('click', (e) => {
      const b = e.target.closest('.cx-tile'); if (!b || !b.classList.contains('on')) return;
      const ev = S.runEvent(+b.dataset.id); if (ev) say(ev.name, 'Replay from the codex');
    });
  })();
  function renderCodex() {
    const n = Codex.found.size; cxCount.textContent = n.toLocaleString(); cxBar.style.transform = `scaleX(${n / S.EVENT_COUNT})`;
    tiles.forEach((b, id) => {
      const on = Codex.found.has(id); b.classList.toggle('on', on);
      b.title = on ? S.eventName(id) + ' (click to replay)' : 'Undiscovered';
      b.setAttribute('aria-label', on ? 'Replay ' + S.eventName(id) : 'Undiscovered event');
    });
    secs_.forEach(({ p, hc }) => { let k = 0; for (let i = 0; i < 50; i++) if (Codex.found.has(p * 50 + i)) k++; hc.textContent = `${k} / 50`; });
    cxRecent.textContent = '';
    if (!Codex.recent.length) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = `Nothing discovered yet. Hit ${Set_.chaosAt} clicks in the click speed test to start.`; cxRecent.appendChild(p); }
    Codex.recent.forEach((id) => { const b = document.createElement('button'); b.className = 'chip cx-chip'; b.style.setProperty('--c', S.eventColor(id)); b.textContent = S.eventName(id); b.addEventListener('click', () => { const ev = S.runEvent(id); if (ev) say(ev.name, 'Replay from the codex'); }); cxRecent.appendChild(b); });
  }

  /* ---------- universes view ---------- */
  const uGrid = $('#u-grid'), uHist = $('#u-history'), uSeed = $('#u-seed');
  let uHistory = load('lunar-u-history', []);
  function sameSel(a, b) { return !!(a && b && ((a.preset && a.preset === b.preset) || (a.seed != null && a.seed === b.seed))); }
  function uCard(sel, p, current) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card u-card' + (current ? ' current' : '');
    const sw = document.createElement('div'); sw.className = 'swatches';
    p.swatches.forEach((c) => { const i = document.createElement('i'); i.style.background = c; sw.appendChild(i); });
    const h = document.createElement('h3'); h.textContent = p.name;
    const t = document.createElement('p'); t.textContent = p.traits;
    const s = document.createElement('span'); s.className = 'best'; s.textContent = current ? 'You are here' : 'Travel here';
    b.append(sw, h, t, s); b.addEventListener('click', () => { if (!current) travel(sel); }); return b;
  }
  function renderUniverses() {
    const cur = S.current(); $('#u-current').textContent = cur.name;
    uGrid.textContent = ''; S.presets.forEach((p) => { const sel = { preset: p.key }; uGrid.appendChild(uCard(sel, S.preview(sel), sameSel(sel, cur.sel))); });
    uHist.textContent = '';
    if (uHistory.length) {
      const l = document.createElement('p'); l.className = 'small'; l.textContent = 'Recently visited'; uHist.appendChild(l);
      const row = document.createElement('div'); row.className = 'chips';
      uHistory.forEach((h) => { const c = document.createElement('button'); c.className = 'chip'; c.textContent = `${h.name} · ${h.seed}`; c.addEventListener('click', () => travel({ seed: h.seed })); row.appendChild(c); });
      uHist.appendChild(row);
    }
  }
  function travel(sel) {
    if (!S.goUniverse(sel)) return;
    save('lunar-universe', sel);
    const p = S.preview(sel);
    if (sel.seed != null) { uHistory = [{ seed: sel.seed, name: p.name }, ...uHistory.filter((h) => h.seed !== sel.seed)].slice(0, 8); save('lunar-u-history', uHistory); }
    say('Entering ' + p.name, p.traits); Snd.tone(200, 1.8, 'sawtooth', .04, 1600);
    setTimeout(() => { if (document.body.dataset.view === 'universes') renderUniverses(); paintHome(); }, 1700);
  }
  $('#u-rand').addEventListener('click', () => travel({ seed: Math.floor(Math.random() * 1e6) }));
  $('#u-seed-go').addEventListener('click', () => { const n = parseInt(uSeed.value, 10); if (n >= 0 && n < 1e6) travel({ seed: n }); else { uSeed.focus(); say('Enter a seed from 0 to 999999'); } });
  uSeed.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#u-seed-go').click(); });

  /* ---------- settings view ---------- */
  function parse(k, v) { const t = typeof DEF[k]; return t === 'number' ? +v : t === 'boolean' ? v === 'true' : v; }
  function paintSettings() {
    $$('.chips[data-set]').forEach((g) => { const k = g.dataset.set; $$('.chip', g).forEach((c) => c.setAttribute('aria-pressed', String(parse(k, c.dataset.v) === Set_[k]))); });
    $('#set-vol').value = Set_.volume; $('#set-vol-val').textContent = Set_.volume + '%';
    $('#set-name-val').textContent = Player.name || 'Not set';
  }
  function apply() { S.setMotion(Set_.motion); S.setQuality(Set_.quality); if (cState !== 'run') pickDur(Set_.cpsDefault); }
  $$('.chips[data-set]').forEach((g) => $$('.chip', g).forEach((c) => c.addEventListener('click', () => {
    Set_[g.dataset.set] = parse(g.dataset.set, c.dataset.v); saveSettings(); apply(); paintSettings(); Snd.tone(600, .05, 'triangle', .04);
  })));
  $('#set-vol').addEventListener('input', (e) => { Set_.volume = +e.target.value; $('#set-vol-val').textContent = Set_.volume + '%'; saveSettings(); });
  $('#set-vol').addEventListener('change', () => Snd.tone(660, .1, 'sine', .07));
  function confirmBtn(btn, label, fn) {
    let armed = false, t;
    btn.addEventListener('click', () => {
      if (!armed) { armed = true; btn.textContent = 'Click again to confirm'; t = setTimeout(() => { armed = false; btn.textContent = label; }, 3000); return; }
      clearTimeout(t); armed = false; fn(); btn.textContent = 'Done'; setTimeout(() => { btn.textContent = label; }, 1500);
    });
  }
  confirmBtn($('#set-reset-scores'), 'Reset scores', () => { ['lunar-board', 'lunar-cps', 'lunar-meteors', 'lunar-reaction', 'lunar-aim', 'lunar-memory'].forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} }); bests = {}; showBest(); paintHome(); });
  confirmBtn($('#set-reset-codex'), 'Reset codex', () => { Codex.found.clear(); Codex.recent = []; save('lunar-codex', []); save('lunar-codex-recent', []); paintHome(); });

  /* ---------- credits ---------- */
  function renderCredits() {
    const list = $('#credits-list'); if (list.childElementCount || !window.LUNAR_ASSETS) return;
    window.LUNAR_ASSETS.credits.forEach((c) => {
      const d = document.createElement('div'); d.className = 'panel credit';
      const h = document.createElement('h3'); h.textContent = c.what;
      const who = document.createElement('p'); who.textContent = c.who;
      const lic = document.createElement('p'); lic.className = 'small';
      const a1 = document.createElement('a'); a1.href = c.url; a1.target = '_blank'; a1.rel = 'noopener'; a1.textContent = 'Source';
      const a2 = document.createElement('a'); a2.href = c.licenseUrl; a2.target = '_blank'; a2.rel = 'noopener'; a2.textContent = c.license;
      lic.append(a1, document.createTextNode(' · License: '), a2);
      d.append(h, who, lic);
      if (c.note) { const n = document.createElement('p'); n.className = 'sub small'; n.textContent = c.note; d.appendChild(n); }
      list.appendChild(d);
    });
    if (window.Explore && Explore.missing && Explore.missing().length) {
      const d = document.createElement('div'); d.className = 'panel credit warn';
      d.innerHTML = '<h3>Files not downloaded yet</h3><p class="sub small"></p>';
      d.querySelector('p').textContent = Explore.missing().join(', ') + '. Run scripts/download-assets.sh or deploy with the GitHub Action in .github/workflows.';
      list.appendChild(d);
    }
  }

  /* ---------- random events on their own ---------- */
  let idleT = 0;
  setInterval(() => {
    if (!Set_.ambient || document.hidden || ['meteors', 'solar', 'rover'].includes(document.body.dataset.view) || cState === 'run') { idleT = 0; return; }
    if (++idleT >= 30) { idleT = 0; announce([S.randomEvent()]); }
  }, 1000);

  /* ---------- init ---------- */
  Reaction.reset(); Aim.reset(); Memory.reset();
  pickDur(Set_.cpsDefault); apply(); route();
  if (Player.name) Player.set(Player.name); else Player.ask(true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) Meteors.pause(); });
  $('#year').textContent = new Date().getFullYear();
})();
