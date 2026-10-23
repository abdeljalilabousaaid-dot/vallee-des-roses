/* Régie (présentateur) */
(function () {
  'use strict';
  const K = window.KMG, $ = K.$, esc = K.esc;
  const app = $('#app');
  let S, KEY = null, G = null, players = [], answers = [], unP = null, unA = null, curSid = null;
  let autoT = 0, tick = 0, busy = false, msg = '', botsOn = false, botT = [];

  const done = () => Object.keys((G && G.hist) || {}).map(Number);
  const nextRound = () => { const d = done(); return K.ROUNDS.findIndex(r => !d.includes(r.i)); };
  const ansFor = q => answers.filter(a => a.q === q);

  async function act(fn) {
    if (busy) return; busy = true; msg = ''; render();
    try { await fn(); } catch (e) { console.error(e); msg = K.errMsg(e); }
    busy = false; render();
  }

  // ─────────────── Actions ───────────────
  function newGame() {
    return act(async () => {
      clearBots();
      const sid = Math.floor(Date.now() / 1000) % 1000000000;
      await S.setGame({ sid, phase: 'lobby', q: 0, dur: 0, amax: 0, openedAt: K.NOW, rv: null, hist: {}, top: [], me: {}, np: 0, hidden: {} });
    });
  }
  function launch(i) {
    const r = K.ROUNDS[i];
    return act(async () => {
      await S.updateGame({ phase: 'question', q: i, dur: r.dur, amax: r.amax, openedAt: K.NOW, rv: null });
      schedule(i, r.dur * 1000);
      if (S.mode === 'demo' && botsOn) runBots(i);
    });
  }
  function schedule(i, remMs) {
    clearTimeout(autoT);
    autoT = setTimeout(() => { if (G && G.phase === 'question' && G.q === i) reveal(); }, remMs + 3500);
  }
  function computeBoard(hist, lastQ) {
    return K.board(players, answers, hist, KEY, (G && G.hidden) || {}, lastQ);
  }
  function reveal() {
    return act(async () => {
      if (!G || G.phase !== 'question') return;
      clearTimeout(autoT); clearBots();
      const i = G.q, r = K.ROUNDS[i];
      const hist = Object.assign({}, G.hist || {}); hist[i] = [G.openedAt, r.dur];
      const st = K.stats(r, KEY[i], ansFor(i));
      const rv = Object.assign({}, KEY[i], { st });
      const b = computeBoard(hist, i);
      await S.updateGame({ phase: 'reveal', rv, hist, top: b.top, me: b.me, np: b.np });
    });
  }
  function podium() {
    return act(async () => {
      const b = computeBoard(G.hist || {}, -1);
      // garder les points de la dernière manche pour les téléphones
      Object.keys(b.me).forEach(u => { if (G.me && G.me[u]) b.me[u][2] = G.me[u][2]; });
      await S.updateGame({ phase: 'end', top: b.top, me: b.me, np: b.np });
    });
  }
  function backToLobby() { return act(() => S.updateGame({ phase: 'lobby' })); }
  function toggleHide(uid) {
    return act(async () => {
      const hidden = Object.assign({}, G.hidden || {});
      if (hidden[uid]) delete hidden[uid]; else hidden[uid] = true;
      const patch = { hidden };
      if (G.phase === 'reveal' || G.phase === 'end') {
        G.hidden = hidden;
        const b = computeBoard(G.hist || {}, G.phase === 'reveal' ? G.q : -1);
        patch.top = b.top;
      }
      await S.updateGame(patch);
    });
  }

  // ─────────────── Joueurs fictifs (mode démo) ───────────────
  const PRENOMS = ['Yasmine', 'Omar', 'Salma', 'Mehdi', 'Imane', 'Youssef', 'Aya', 'Hamza', 'Kenza', 'Anas', 'Nour', 'Ilyas', 'Hiba', 'Amine', 'Rania', 'Zakaria', 'Malak', 'Ayoub', 'Lina', 'Othmane', 'Chaimae', 'Reda', 'Ghita', 'Adam', 'Meryem', 'Badr', 'Soukaina', 'Taha', 'Douae', 'Ismail'];
  function addBots(n) {
    const list = [];
    for (let k = 0; k < n; k++) list.push({ uid: 'bot_' + Math.random().toString(36).slice(2, 9), n: PRENOMS[Math.floor(Math.random() * PRENOMS.length)] + ' ' + (10 + Math.floor(Math.random() * 89)) });
    S.botJoinMany(G.sid, list); botsOn = true;
  }
  function clearBots() { botT.forEach(clearTimeout); botT = []; }
  function runBots(i) {
    clearBots();
    const r = K.ROUNDS[i], key = KEY[i];
    const bots = players.filter(p => p.uid.indexOf('bot_') === 0);
    const due = {};
    bots.forEach(b => {
      if (Math.random() < 0.06) return; // quelques absents
      let a, at;
      if (r.type === 'tap') { a = 10 + Math.floor(Math.random() * 30); at = 18500 + Math.random() * 1500; }
      else if (r.type === 'est') { a = Math.max(r.min, Math.min(r.max, Math.round(37 + (Math.random() + Math.random() + Math.random() - 1.5) * 30))); at = 3000 + Math.random() * (r.dur * 1000 - 5000); }
      else {
        const good = key.c != null && Math.random() < 0.62;
        a = good ? key.c : Math.floor(Math.random() * r.opts.length);
        at = 1500 + Math.random() * (r.dur * 1000 - 3500);
      }
      const slot = Math.round(at / 400) * 400;
      (due[slot] = due[slot] || []).push({ uid: b.uid, a });
    });
    Object.keys(due).forEach(t => botT.push(setTimeout(() => S.botAnswerMany(G.sid, i, due[t]), +t)));
  }

  // ─────────────── QR code téléchargeable ───────────────
  function downloadQR() {
    const url = K.joinUrl();
    const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
    const n = qr.getModuleCount(), cell = 24, m = 4, size = (n + m * 2) * cell;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#2E0F18';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
    const a = document.createElement('a'); a.download = 'qr-vallee-des-roses.png'; a.href = c.toDataURL('image/png'); a.click();
  }

  // ─────────────── Rendu ───────────────
  function nowPanel() {
    if (!G || G.phase === 'off') {
      return `<div class="now"><div class="big">Aucune partie en cours.</div>
        <div class="row"><button class="btn" data-a="new">Créer la partie</button></div>
        <div class="small" style="opacity:.75">Fais-le avant l’exposé : l’écran affichera le QR code et les joueurs pourront rejoindre.</div></div>`;
    }
    const nx = nextRound();
    const nxBtn = nx >= 0
      ? `<button class="btn" data-a="launch" data-i="${nx}">Lancer la manche ${nx + 1} · ${esc(K.ROUNDS[nx].tag)}</button>`
      : `<button class="btn" data-a="podium">Afficher le podium final</button>`;
    if (G.phase === 'lobby') {
      return `<div class="now"><div class="kicker" style="color:var(--rose-pale)">Salle d’attente</div>
        <div class="big"><b style="font-size:30px">${players.length}</b> joueurs connectés</div>
        <div class="row">${nxBtn}</div>
        ${nx >= 0 ? `<div class="small" style="opacity:.75">Moment prévu : ${esc(K.ROUNDS[nx].slide)}</div>` : ''}</div>`;
    }
    if (G.phase === 'question') {
      const r = K.ROUNDS[G.q];
      return `<div class="now"><div class="kicker" style="color:var(--rose-pale)">Manche ${G.q + 1} en cours · ${esc(r.tag)}</div>
        <div class="big">${esc(r.q)}</div>
        <div class="row"><span class="t" id="cd">–</span><span><b id="na">${ansFor(G.q).length}</b> / ${players.length} réponses</span></div>
        <div class="row"><button class="btn" data-a="reveal">Révéler maintenant</button></div>
        <div class="small" style="opacity:.75">La correction s’affiche automatiquement à la fin du temps.</div></div>`;
    }
    if (G.phase === 'reveal') {
      const r = K.ROUNDS[G.q], st = (G.rv && G.rv.st) || { n: 0 };
      return `<div class="now"><div class="kicker" style="color:var(--rose-pale)">Correction affichée · manche ${G.q + 1}</div>
        <div class="big">${st.n} réponses · en tête : ${esc(((G.top || [])[0] || {}).n || '–')}</div>
        <div class="row">${nxBtn}${nx >= 0 ? `<button class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" data-a="podium">Podium</button>` : ''}</div>
        ${nx >= 0 ? `<div class="small" style="opacity:.75">Prochaine : ${esc(K.ROUNDS[nx].slide)}</div>` : ''}</div>`;
    }
    return `<div class="now"><div class="kicker" style="color:var(--rose-pale)">Podium affiché</div>
      <div class="big">Vainqueur : ${esc(((G.top || [])[0] || {}).n || '–')}</div>
      <div class="row"><button class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" data-a="lobby">Revenir à la salle d’attente</button></div></div>`;
  }

  function render() {
    if (!KEY) return;
    const openDet = [...app.querySelectorAll('details')].map(x => x.open);
    renderInner();
    app.querySelectorAll('details').forEach((x, i) => { if (openDet[i]) x.open = true; });
    onTick();
  }
  function renderInner() {
    const d = done();
    const live = G && (G.phase === 'lobby' || G.phase === 'reveal');
    app.innerHTML = `<div class="regie">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <h1 class="serif">${K.roseSvg(26)} Régie</h1>
        <div class="status"><span class="tagm ${S.mode === 'demo' ? 'demo' : 'live'}">${S.mode === 'demo' ? 'MODE DÉMO' : 'EN DIRECT'}</span>
        <span class="tagm">${players.length} joueurs</span>${busy ? '<span class="tagm">…</span>' : ''}</div></div>
      ${msg ? `<p class="err" style="font-weight:700">${esc(msg)}</p>` : ''}
      ${nowPanel()}
      <div class="kicker">Les ${K.ROUNDS.length} manches, calées sur tes slides</div>
      <div class="rounds">${K.ROUNDS.map(r => {
        const isDone = d.includes(r.i), isCur = G && G.q === r.i && G.phase !== 'lobby' && G.phase !== 'end';
        return `<div class="rd ${isDone ? 'done' : ''} ${isCur ? 'cur' : ''}"><span class="n">${isDone ? '✓' : r.i + 1}</span>
          <span class="tx"><b>${esc(r.tag)} — ${esc(r.q)}</b><small>${esc(r.slide)} · ${r.dur} s</small></span>
          ${!isDone && live ? `<button class="btn ghost" data-a="launch" data-i="${r.i}">Lancer</button>` : ''}</div>`;
      }).join('')}</div>
      <details class="tools"><summary>Joueurs (${players.length}) · toucher un pseudo pour le masquer</summary>
        <div class="plist">${players.map(p => `<button class="${G.hidden && G.hidden[p.uid] ? 'hid' : ''}" data-a="hide" data-u="${esc(p.uid)}">${esc(p.n)}</button>`).join('') || '<span class="muted small">Personne pour l’instant.</span>'}</div></details>
      <details class="tools"><summary>Outils</summary>
        <div style="display:flex;flex-direction:column;gap:10px;padding-top:6px">
          <a class="btn dark" href="ecran.html" target="_blank" rel="noopener">Ouvrir l’écran de projection</a>
          <button class="btn ghost" data-a="qr">Télécharger le QR code (PNG pour tes slides)</button>
          <div class="small muted">Lien joueurs : <b>${esc(K.joinUrl())}</b></div>
          ${S.mode === 'demo' && G && G.sid ? `<div class="card small"><b>Répétition (mode démo)</b><br>Ajoute des joueurs fictifs : ils répondent tout seuls à chaque manche.
            <div class="row" style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn ghost" data-a="bots" data-n="30">+30 joueurs</button><button class="btn ghost" data-a="bots" data-n="120">+120 joueurs</button><button class="btn ghost" data-a="wipe">Tout effacer</button></div></div>` : ''}
          <button class="btn ghost" data-a="new">Nouvelle partie (remet les scores à zéro)</button>
        </div></details>
    </div>`;
  }

  app.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || busy) return;
    const a = b.dataset.a;
    if (a === 'new') { if (!G || G.phase === 'off' || confirm('Créer une nouvelle partie ? Les scores actuels seront remis à zéro.')) newGame(); }
    else if (a === 'launch') launch(+b.dataset.i);
    else if (a === 'reveal') reveal();
    else if (a === 'podium') { if (G.phase !== 'question') podium(); }
    else if (a === 'lobby') backToLobby();
    else if (a === 'hide') toggleHide(b.dataset.u);
    else if (a === 'qr') downloadQR();
    else if (a === 'bots') addBots(+b.dataset.n);
    else if (a === 'wipe') { if (confirm('Effacer toutes les données de démo ?')) { clearBots(); botsOn = false; S.wipe(); } }
  });

  // Compte à rebours + révélation anticipée si tout le monde a répondu
  function onTick() {
    if (!G || G.phase !== 'question') return;
    const r = K.ROUNDS[G.q];
    const now = Date.now();
    let start = G.openedAt; if (!start || Math.abs(now - start) > r.dur * 1000 + 8000) start = G._recv || now;
    const rem = Math.max(0, r.dur * 1000 - (now - start));
    const cd = $('#cd'); if (cd) cd.textContent = Math.ceil(rem / 1000) + ' s';
    const na = $('#na'); const n = ansFor(G.q).length; if (na) na.textContent = n;
    if (players.length > 0 && n >= players.length && !busy && rem > 1000 && r.type !== 'tap') { reveal(); }
  }

  function lock(m) {
    app.innerHTML = `<div class="lock">${K.roseSvg(60)}<div class="kicker">Régie · Le voyage d’une rose</div><h1 class="serif" style="margin:0">Code de la régie</h1>
      <form id="lf" style="display:flex;flex-direction:column;gap:12px"><div class="field"><input id="pin" placeholder="ROSE-XXXX-XXXX" autocomplete="off" autocapitalize="characters"></div>
      <p class="err" id="er">${esc(m || '')}</p><button class="btn block" id="ok">Déverrouiller</button></form>
      <p class="small muted">Le code déchiffre les bonnes réponses. Ne le partage pas.</p></div>`;
    $('#lf').onsubmit = e => { e.preventDefault(); $('#ok').disabled = true; $('#ok').textContent = 'Vérification…'; unlock($('#pin').value); };
  }
  async function unlock(pin) {
    try { KEY = await K.decryptKey(pin); } catch (e) { sessionStorage.removeItem('kmg_pin'); return lock('Code incorrect.'); }
    try { await S.adminLogin(pin); } catch (e) { KEY = null; return lock('Code accepté localement mais refusé par Firebase : vérifie les règles (' + K.errMsg(e) + ')'); }
    sessionStorage.setItem('kmg_pin', pin);
    let lastPhase = '';
    S.watchGame(g => {
      if (g && (g.phase + g.q) !== lastPhase) {
        g._recv = Date.now(); lastPhase = g.phase + g.q;
        if (g.phase === 'question' && !autoT) { // reprise après rechargement
          const r = K.ROUNDS[g.q]; const el = Math.max(0, Date.now() - (g.openedAt || Date.now()));
          schedule(g.q, Math.max(0, r.dur * 1000 - el));
        }
      } else if (g && G) g._recv = G._recv;
      G = g;
      if (g && g.sid !== curSid) {
        curSid = g.sid; unP && unP(); unA && unA(); players = []; answers = [];
        unP = S.watchPlayers(g.sid, l => { players = l; render(); }, e => { msg = K.errMsg(e); render(); });
        unA = S.watchAnswers(g.sid, l => { answers = l; onTick(); }, e => { msg = K.errMsg(e); render(); });
      }
      render();
    }, e => { msg = K.errMsg(e); render(); });
    clearInterval(tick); tick = setInterval(onTick, 250);
  }

  (async function () {
    try { S = await K.store(); } catch (e) { app.innerHTML = `<div class="lock"><h1 class="serif">Connexion impossible</h1><p>${esc(K.errMsg(e))}</p><p class="small">Vérifie config.js et que la connexion anonyme est activée dans Firebase.</p></div>`; return; }
    const saved = sessionStorage.getItem('kmg_pin');
    if (saved) unlock(saved); else lock();
  })();
})();
