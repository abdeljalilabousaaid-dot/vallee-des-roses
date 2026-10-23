/* Page joueur (téléphone) */
(function () {
  'use strict';
  const K = window.KMG, $ = K.$, esc = K.esc;
  const app = $('#app');
  const CFG = window.KMG_CONFIG || {};
  let S = null, uid = null, G = null, viewKey = '', timerRAF = 0, tickers = [];

  const jKey = sid => `kmg_join:${sid}:${uid}`;
  const aKey = (sid, q) => `kmg_ans:${sid}:${q}:${uid}`;
  const myAns = (sid, q) => K.ls.get(aKey(sid, q));

  function clearTimers() { cancelAnimationFrame(timerRAF); tickers.forEach(clearInterval); tickers.forEach(clearTimeout); tickers = []; }

  function shell(inner, opts) {
    opts = opts || {};
    const me = G && G.me && G.me[uid];
    const pill = me ? `<span class="pill">${K.fmt(me[0])} pts<small>${K.ord(me[1])}</small></span>` : '';
    return `${opts.noBar ? '' : `<header class="topbar"><span class="brand">${K.roseSvg(24)} Le voyage d’une rose</span>${pill}</header>`}${inner}`;
  }
  function paint(key, html, after) {
    if (key === viewKey) return;
    clearTimers();
    viewKey = key;
    app.innerHTML = html;
    window.scrollTo(0, 0);
    if (after) after();
  }

  // ─────────────── Vues ───────────────
  function vLoading(msg) {
    paint('loading:' + msg, `<main class="screen center">${K.roseSvg(90, 'bloom sway')}<p class="lead">${esc(msg)}</p></main>`);
  }

  function vNoGame() {
    paint('nogame', shell(`<main class="screen center">
      ${K.roseSvg(120, 'bloom sway')}
      <h2 class="serif" style="margin:0">La partie va bientôt commencer</h2>
      <p class="lead">Garde cette page ouverte : elle se mettra à jour toute seule.</p></main>`));
  }

  function vJoin() {
    const g = G;
    paint('join:' + g.sid, `
      <div class="phone">
        <section class="hero"><div><div class="kicker">Kelaât M’Gouna · Quiz en direct</div><h1>Le voyage<br>d’une rose</h1></div></section>
        <form class="join" id="jf" autocomplete="off">
          <p>Réponds aux questions au fil de l’exposé. Plus tu réponds vite et juste, plus tu marques de points.</p>
          <div class="field"><label for="nm">Ton pseudo</label>
            <input id="nm" maxlength="16" placeholder="ex. Yasmine" enterkeyhint="go" autocapitalize="words" required></div>
          <p class="err" id="er"></p>
          <button class="btn block" id="go">Rejoindre la partie</button>
          <p class="credit">${esc(CFG.auteur || '')} · Module « ${esc(CFG.module || '')} »<br>Aucune donnée personnelle collectée : seul ton pseudo est affiché.</p>
        </form>
      </div>`, () => {
      const prev = K.ls.get('kmg_lastname'); if (prev) $('#nm').value = prev;
      $('#jf').addEventListener('submit', async e => {
        e.preventDefault();
        const c = K.cleanName($('#nm').value);
        if (!c.ok) { $('#er').textContent = c.msg; return; }
        $('#go').disabled = true; $('#go').textContent = 'Connexion…';
        try {
          await S.join(g.sid, c.name);
          K.ls.set(jKey(g.sid), c.name); K.ls.set('kmg_lastname', c.name);
          viewKey = ''; render();
        } catch (err) {
          $('#er').textContent = K.errMsg(err);
          $('#go').disabled = false; $('#go').textContent = 'Rejoindre la partie';
        }
      });
    });
  }

  function vLobby() {
    const name = K.ls.get(jKey(G.sid));
    paint('lobby:' + G.sid, shell(`<main class="screen center">
      ${K.roseSvg(120, 'bloom sway')}
      <div class="kicker">Tu es dans la partie</div>
      <h2 class="serif" style="margin:0;font-size:30px">${esc(name)}</h2>
      <p class="lead">Les questions arrivent pendant l’exposé, au bon moment.<br>Garde ton téléphone à portée de main.</p>
      <div class="card" style="text-align:left;width:100%">
        <b>Comment ça marche</b>
        <ul class="explain" style="margin:8px 0 0;padding-left:18px">
          <li>${K.ROUNDS.filter(r => r.opts && r.type !== 'poll' || r.type === 'est').length} questions, un mini-jeu de cueillette et un sondage.</li>
          <li>Bonne réponse : 500 pts, + jusqu’à 500 pts de rapidité.</li>
          <li>Le podium final est projeté à la fin.</li></ul>
      </div></main>`));
  }

  function remainingMs(r) {
    const now = Date.now();
    let start = G.openedAt;
    if (!start || Math.abs(now - start) > r.dur * 1000 + 8000) start = G._recv || now; // horloge du téléphone décalée
    return Math.max(0, r.dur * 1000 - (now - start));
  }
  function runTimer(r, onEnd) {
    const bar = $('#tb');
    const loop = () => {
      const rem = remainingMs(r);
      if (bar) bar.style.transform = `scaleX(${rem / (r.dur * 1000)})`;
      const t = $('#tt'); if (t) t.textContent = Math.ceil(rem / 1000) + ' s';
      if (rem <= 0) { onEnd && onEnd(); return; }
      timerRAF = requestAnimationFrame(loop);
    };
    loop();
  }

  async function submit(r, a) {
    const sid = G.sid, q = G.q;
    vSent(r, 'Envoi…');
    try {
      await S.answer(sid, q, a);
      K.ls.set(aKey(sid, q), { a });
      if (navigator.vibrate) navigator.vibrate(30);
      viewKey = ''; render();
    } catch (e) {
      K.ls.set(aKey(sid, q), { a, fail: 1 });
      viewKey = ''; render();
    }
  }

  function qHead(r) {
    return `<div class="timer"><i id="tb"></i></div>
      <div class="qhead"><span class="kicker">${esc(r.tag)}</span><span class="qnum">Manche ${r.i + 1}/${K.ROUNDS.length} · <span id="tt"></span></span></div>
      <h2 class="qtext">${esc(r.q)}</h2>`;
  }

  function vQuestion(r) {
    const cls = r.type === 'vf' ? 'vf' : r.type === 'tri' ? 'tri' : '';
    paint(`q:${G.sid}:${G.q}`, shell(`<main class="screen">${qHead(r)}
      <div class="opts ${cls}">${r.opts.map((o, i) =>
        `<button class="opt c${i}" data-i="${i}"><span class="sh">${K.SHAPES[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      ${r.type === 'poll' ? '<p class="credit">Sondage : pas de points, juste ton avis.</p>' : ''}</main>`), () => {
      app.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => submit(r, +b.dataset.i), { once: true }));
      runTimer(r, () => { viewKey = ''; render(); });
    });
  }

  function vEstimate(r) {
    paint(`q:${G.sid}:${G.q}`, shell(`<main class="screen">${qHead(r)}
      <div class="card" style="display:flex;flex-direction:column;gap:14px">
        <div class="est-val" id="ev">${K.tonnes(50)}<small>de roses pour 1 litre</small></div>
        <input type="range" class="slider" id="sl" min="${r.min}" max="${r.max}" step="1" value="50" aria-label="Tonnes">
        <div class="scale"><span>${K.tonnes(r.min)}</span><span>${K.tonnes(r.max)}</span></div>
        <div class="steppers"><button id="mn" aria-label="moins">−</button><button id="pl" aria-label="plus">+</button></div>
      </div>
      <button class="btn block" id="ok">Valider mon estimation</button></main>`), () => {
      const sl = $('#sl'), ev = $('#ev');
      const upd = () => { ev.firstChild.nodeValue = K.tonnes(+sl.value); };
      sl.addEventListener('input', upd);
      $('#mn').onclick = () => { sl.value = Math.max(r.min, +sl.value - 1); upd(); };
      $('#pl').onclick = () => { sl.value = Math.min(r.max, +sl.value + 1); upd(); };
      $('#ok').addEventListener('click', () => submit(r, +sl.value), { once: true });
      runTimer(r, () => { viewKey = ''; render(); });
    });
  }

  // Mini-jeu : cueillette à l'aube
  function vTap(r) {
    paint(`q:${G.sid}:${G.q}`, shell(`<main class="screen" style="gap:10px">
      <div class="qhead"><span class="kicker">${esc(r.tag)}</span><span class="qnum">Manche ${r.i + 1}/${K.ROUNDS.length}</span></div>
      <div class="field-game" id="fg">
        <div class="sky" id="sky"></div><div class="sun" id="sun" style="top:105%"></div>
        <div class="hud"><span id="cnt">✿ 0</span><span id="tm">${r.play} s</span></div>
        <div class="big" id="big"><b id="cd">3</b><p>Touche les roses pour les cueillir<br>avant que le soleil ne se lève !</p></div>
      </div></main>`), () => {
      const fg = $('#fg'), big = $('#big'), cd = $('#cd');
      let count = 0, playing = false, done = false;
      // Temps disponible : la manche dure r.dur, le jeu r.play + 3 s de décompte
      const rem0 = remainingMs(r);
      const lead = Math.max(0, Math.min(3000, rem0 - r.play * 1000 - 1500));
      let n = Math.ceil(lead / 1000);
      const startPlay = () => {
        big.classList.add('hidden'); playing = true;
        const playMs = Math.min(r.play * 1000, Math.max(3000, remainingMs(r) - 1500));
        const t0 = performance.now();
        const sky = $('#sky'), sun = $('#sun');
        sky.style.transition = `opacity ${playMs}ms linear`; sun.style.transition = `top ${playMs}ms linear`;
        requestAnimationFrame(() => { sky.style.opacity = '0'; sun.style.top = '6%'; });
        const spawn = () => {
          if (!playing) return;
          const w = fg.clientWidth, h = fg.clientHeight;
          const b = document.createElement('button');
          b.className = 'fg-rose'; b.setAttribute('aria-label', 'rose');
          b.innerHTML = K.roseSvg(64);
          b.style.left = (40 + Math.random() * (w - 80)) + 'px';
          b.style.top = (h * 0.38 + Math.random() * (h * 0.56)) + 'px';
          const life = 900 + Math.random() * 500;
          const kill = setTimeout(() => { b.classList.add('gone'); setTimeout(() => b.remove(), 260); }, life);
          b.addEventListener('pointerdown', ev => {
            ev.preventDefault(); if (!playing) return;
            clearTimeout(kill); b.classList.add('picked'); setTimeout(() => b.remove(), 360);
            count = Math.min(r.amax, count + 1); $('#cnt').textContent = '✿ ' + count;
            const p = document.createElement('span'); p.className = 'plus'; p.textContent = '+1';
            p.style.left = b.style.left; p.style.top = b.style.top; fg.appendChild(p); setTimeout(() => p.remove(), 620);
            if (navigator.vibrate) navigator.vibrate(12);
          }, { once: true });
          fg.appendChild(b);
          tickers.push(setTimeout(spawn, 260 + Math.random() * 170));
        };
        spawn(); if (fg.clientWidth > 380) tickers.push(setTimeout(spawn, 130));
        tickers.push(setInterval(() => {
          const left = Math.max(0, playMs - (performance.now() - t0));
          $('#tm').textContent = Math.ceil(left / 1000) + ' s';
          if (left <= 0 && !done) {
            done = true; playing = false;
            fg.querySelectorAll('.fg-rose').forEach(x => x.remove());
            big.classList.remove('hidden');
            big.innerHTML = `<b>${count}</b><p>roses cueillies !</p>`;
            setTimeout(() => submit(r, count), 900);
          }
        }, 100));
      };
      if (n <= 0) { startPlay(); return; }
      cd.textContent = n;
      tickers.push(setInterval(() => { n--; if (n > 0) cd.textContent = n; else if (!playing && !done) { startPlay(); } }, 1000));
    });
  }

  function vSent(r, msg) {
    paint(`sent:${G.sid}:${G.q}:${msg}`, shell(`<main class="screen center">
      ${K.roseSvg(100, 'bloom sway')}
      <h2 class="serif" style="margin:0">${esc(msg)}</h2>
      <p class="lead">Regarde l’écran : la correction arrive dès la fin du temps.</p></main>`));
  }

  function vTooLate() {
    paint(`late:${G.sid}:${G.q}`, shell(`<main class="screen center">
      <div style="font-size:64px">⏱</div>
      <h2 class="serif" style="margin:0">Temps écoulé</h2>
      <p class="lead">La correction arrive dans un instant.</p></main>`));
  }

  function bars(r, st, win) {
    const tot = Math.max(1, st.n);
    return `<div class="bars">${r.opts.map((o, i) => {
      const v = st.dist[i] || 0, pc = Math.round(v * 100 / tot);
      return `<div class="bar ${win === i ? 'win' : ''}"><i style="width:${pc}%;background:var(--c${i});opacity:.35"></i><span><span>${K.SHAPES[i]} ${esc(o)}</span><span>${pc} %</span></span></div>`;
    }).join('')}</div>`;
  }

  function miniTop() {
    const top = (G.top || []).slice(0, 5);
    const me = G.me && G.me[uid];
    return `<div><div class="kicker" style="margin-bottom:8px">Classement</div><ol class="mini-top">${top.map(t =>
      `<li class="${me && t.r === me[1] && t.n === K.ls.get(jKey(G.sid)) ? 'me' : ''}"><span>${t.r}. ${esc(t.n)}</span><b>${K.fmt(t.s)}</b></li>`).join('')}</ol></div>`;
  }

  function vReveal(r) {
    const rv = G.rv || {}, st = rv.st || { n: 0 };
    const me = (G.me && G.me[uid]) || [0, '–', 0];
    const mine = myAns(G.sid, G.q);
    const has = mine && !mine.fail;
    let cls, title, sub = '';
    if (r.type === 'poll') { cls = 'neutral'; title = has ? 'Merci pour ton vote' : 'Résultats du sondage'; }
    else if (r.type === 'tap') { cls = has ? 'ok' : 'none'; title = has ? `${mine.a} roses cueillies` : 'Pas de cueillette'; sub = st.n ? `Record de la salle : ${st.best} roses · moyenne : ${st.avg}` : ''; }
    else if (r.type === 'est') {
      const inR = has && mine.a >= rv.lo && mine.a <= rv.hi;
      cls = !has ? 'none' : inR ? 'ok' : 'ko';
      title = !has ? 'Pas de réponse' : inR ? 'Dans le mille !' : `Tu as dit ${K.tonnes(mine.a)}`;
      sub = `Réponse : ${K.tonnes(rv.lo)} à ${K.tonnes(rv.hi)}`;
    } else {
      cls = !has ? 'none' : mine.a === rv.c ? 'ok' : 'ko';
      title = !has ? 'Pas de réponse' : mine.a === rv.c ? 'Bonne réponse !' : 'Raté…';
      if (cls !== 'ok') sub = 'Réponse : ' + r.opts[rv.c];
    }
    const pts = r.type === 'poll' ? '' : `<div class="pts">+${K.fmt(has ? me[2] : 0)}</div>`;
    paint(`rv:${G.sid}:${G.q}:${JSON.stringify(me)}`, shell(`<main class="screen">
      <div class="verdict ${cls}"><h2>${esc(title)}</h2>${pts}${sub ? `<p>${esc(sub)}</p>` : ''}</div>
      ${r.opts ? bars(r, st, r.type === 'poll' ? -1 : rv.c) : ''}
      ${rv.x ? `<div class="card explain">${esc(rv.x)}</div>` : ''}
      ${r.type !== 'poll' ? `<div class="stand"><div class="card"><div class="v">${K.fmt(me[0])}</div><div class="l">points au total</div></div>
        <div class="card"><div class="v">${me[1] === '–' ? '–' : K.ord(me[1])}</div><div class="l">sur ${G.np || '–'} joueurs</div></div></div>
      ${miniTop()}` : ''}
      <p class="credit">Prochaine question pendant l’exposé…</p></main>`));
  }

  function vEnd() {
    const me = (G.me && G.me[uid]) || [0, '–', 0];
    const medal = me[1] === 1 ? '🥇' : me[1] === 2 ? '🥈' : me[1] === 3 ? '🥉' : '';
    paint(`end:${G.sid}:${JSON.stringify(me)}`, shell(`<main class="screen center">
      ${K.roseSvg(110, 'bloom')}
      <div class="kicker">Classement final</div>
      <h2 class="serif" style="margin:0;font-size:44px">${medal} ${me[1] === '–' ? '–' : K.ord(me[1])}</h2>
      <p class="lead">${K.fmt(me[0])} points · ${G.np || 0} joueurs</p>
      <p class="quote">« Une fleur peut devenir bien plus qu’un produit : elle peut être une mémoire, une identité et un avenir. »</p>
      ${miniTop()}
      <p class="credit">${esc(CFG.auteur || '')} · Module « ${esc(CFG.module || '')} »<br>
      Sources : Iwata et al. (2000) ; Médias24 (2023) ; TelQuel (2026) ; Hespress FR (2026) ; ORMVA de Ouarzazate.<br>Photo : vallée des roses à l’aube.</p></main>`));
  }

  // ─────────────── Routage ───────────────
  async function render() {
    const g = G;
    if (!g || g.phase === 'off') return vNoGame();
    if (!K.ls.get(jKey(g.sid))) {
      if (vJoin._checking !== g.sid) {
        vJoin._checking = g.sid;
        const p = await S.myPlayer(g.sid);
        if (p) { K.ls.set(jKey(g.sid), p.n); return render(); }
      }
      if (g.phase === 'end') return vEnd();
      return vJoin();
    }
    const r = K.ROUNDS[g.q];
    switch (g.phase) {
      case 'lobby': return vLobby();
      case 'question': {
        const mine = myAns(g.sid, g.q);
        if (mine) return mine.fail ? vTooLate() : vSent(r, 'Réponse envoyée ✓');
        if (remainingMs(r) <= 0) return vTooLate();
        if (r.type === 'tap') return vTap(r);
        if (r.type === 'est') return vEstimate(r);
        return vQuestion(r);
      }
      case 'reveal': return vReveal(r);
      case 'end': return vEnd();
      default: return vNoGame();
    }
  }

  (async function main() {
    vLoading('Connexion…');
    try {
      S = await K.store(); uid = S.uid();
    } catch (e) {
      console.error(e);
      app.innerHTML = `<main class="screen center"><h2 class="serif">Connexion impossible</h2><p class="lead">${esc(K.errMsg(e))}</p><button class="btn" onclick="location.reload()">Réessayer</button></main>`;
      return;
    }
    let lastPhase = '';
    S.watchGame(g => {
      if (g && (g.phase + g.q) !== lastPhase) { g._recv = Date.now(); lastPhase = g.phase + g.q; }
      else if (g && G) g._recv = G._recv;
      G = g; render();
    }, e => { console.error(e); });
  })();
})();
