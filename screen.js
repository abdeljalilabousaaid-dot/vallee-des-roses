/* Écran de projection */
(function () {
  'use strict';
  const K = window.KMG, $ = K.$, esc = K.esc;
  const app = $('#app');
  const CFG = window.KMG_CONFIG || {};
  let S, G = null, players = [], answers = [], unP = null, unA = null, curSid = null, viewKey = '', raf = 0;

  function paint(key, html, dark) {
    if (key === viewKey) return false;
    viewKey = key;
    document.body.style.background = dark ? '#1c0a10' : '';
    app.innerHTML = html;
    return true;
  }
  const visibleName = p => (G && G.hidden && G.hidden[p.uid]) ? null : p.n;
  const curAnswers = () => answers.filter(a => a.q === G.q);
  const foot = () => `<div class="foot"><span>${esc(CFG.auteur || '')} · ${esc(CFG.module || '')}</span><span>Kelaât M’Gouna · La Vallée des Roses</span></div>`;

  function vWaiting() {
    paint('wait', `<div class="proj dark" style="justify-content:center;align-items:center;text-align:center">
      ${K.roseSvg(160, 'bloom sway')}<h1>Le voyage d’une rose</h1>
      <p style="font-size:1.6em;opacity:.8">En attente du lancement depuis la régie…</p></div>`, true);
  }

  function vLobby() {
    const url = K.joinUrl();
    paint('lobby:' + G.sid, `<div class="proj dark">
      <div class="row" style="align-items:center">
        <div style="flex:1;display:flex;flex-direction:column;gap:1.6vw">
          <div class="kicker">Quiz en direct · Kelaât M’Gouna</div>
          <h1 style="font-size:3.9em">Le voyage<br>d’une rose</h1>
          <p style="font-size:1.8em;margin:0;opacity:.9">Scannez le QR code et choisissez un pseudo.</p>
          <div class="url">${esc(url.replace(/^https?:\/\//, ''))}</div>
          <div style="display:flex;align-items:baseline;gap:1.4vw"><span class="count" id="np" style="font-size:7em">0</span><span style="font-size:2em;font-weight:700;opacity:.85">joueurs connectés</span></div>
          <div class="names" id="names"></div>
        </div>
        <div class="qrbox">${K.qrSvg(url, 10)}</div>
      </div>${foot()}</div>`, true);
    const vis = players.map(visibleName).filter(Boolean);
    $('#np').textContent = players.length;
    const box = $('#names');
    const shown = new Set([...box.children].map(x => x.textContent));
    vis.slice(-60).forEach(n => { if (!shown.has(n)) { const s = document.createElement('span'); s.textContent = n; box.prepend(s); shown.add(n); } });
    while (box.children.length > 60) box.removeChild(box.lastChild);
  }

  function ring(r) {
    return `<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#EADFCF" stroke-width="9"/>
      <circle id="rg" cx="50" cy="50" r="44" fill="none" stroke="#9B2335" stroke-width="9" stroke-linecap="round" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><b id="rs">${r.dur}</b></div>`;
  }
  function runRing(r) {
    cancelAnimationFrame(raf);
    const loop = () => {
      const now = Date.now();
      let start = G.openedAt; if (!start || Math.abs(now - start) > r.dur * 1000 + 8000) start = G._recv || now;
      const rem = Math.max(0, r.dur * 1000 - (now - start));
      const rg = $('#rg'), rs = $('#rs'); if (!rg) return;
      rg.setAttribute('stroke-dashoffset', String(276.5 * (1 - rem / (r.dur * 1000))));
      rs.textContent = Math.ceil(rem / 1000);
      if (rem > 0) raf = requestAnimationFrame(loop);
    };
    loop();
  }

  function head(r) {
    return `<div style="display:flex;justify-content:space-between;align-items:baseline"><span class="kicker">${esc(r.tag)}</span>
      <span style="font-weight:700;color:var(--muted)">Manche ${r.i + 1} / ${K.ROUNDS.length}</span></div>`;
  }

  function vQuestion(r) {
    let body;
    if (r.opts) {
      const cls = r.type === 'tri' ? 'tri' : '';
      body = `<div class="opts ${cls}">${r.opts.map((o, i) => `<div class="opt c${i}"><span class="sh">${K.SHAPES[i]}</span><span>${esc(o)}</span></div>`).join('')}</div>`;
    } else if (r.type === 'est') {
      body = `<div class="card" style="padding:2vw;display:flex;flex-direction:column;gap:1vw">
        <div style="font-size:1.6em;font-weight:700">Faites glisser le curseur sur votre téléphone</div>
        <div style="height:1vw;border-radius:999px;background:linear-gradient(90deg,#E7B3B8,#9B2335)"></div>
        <div style="display:flex;justify-content:space-between;font-size:1.4em;color:var(--muted);font-weight:700"><span>${K.tonnes(r.min)}</span><span>${K.tonnes(r.max)}</span></div></div>`;
    } else {
      body = `<div style="flex:1;border-radius:1.4vw;background:#3a2a2c url(assets/aube.jpg) center 75%/cover;display:flex;align-items:center;justify-content:center;min-height:22vw">
        <div style="background:rgba(40,16,23,.7);color:#fff;border-radius:1vw;padding:1.4vw 2.4vw;font-size:2.4em;font-weight:800">✿ Cueillez sur vos téléphones !</div></div>`;
    }
    const fresh = paint(`q:${G.sid}:${G.q}`, `<div class="proj">${head(r)}<h2>${esc(r.q)}</h2>${body}
      <div class="meta">${ring(r)}<div class="answered"><b id="na">0</b> / <span id="np">0</span> réponses</div>
      <div style="margin-left:auto;font-size:1.3em;color:var(--muted);font-weight:600">${r.type === 'poll' ? 'Sondage · sans points' : 'Vite et juste = plus de points'}</div></div>${foot()}</div>`);
    if (fresh) runRing(r);
    $('#na').textContent = curAnswers().length; $('#np').textContent = players.length;
  }

  function lb(top, n) {
    return `<ol class="lb">${(top || []).slice(0, n).map((t, i) => `<li style="animation-delay:${i * 80}ms"><span class="rk">${t.r}</span><span class="nm">${esc(t.n)}</span><span class="sc">${K.fmt(t.s)}</span></li>`).join('')}</ol>`;
  }

  function vReveal(r) {
    const rv = G.rv || {}, st = rv.st || { n: 0 };
    let main;
    if (r.opts) {
      const tot = Math.max(1, st.n);
      main = `<div class="opts ${r.type === 'poll' ? '' : 'stack'}">${r.opts.map((o, i) => {
        const v = (st.dist || [])[i] || 0;
        const cls = r.type === 'poll' ? '' : (i === rv.c ? 'win' : 'dim');
        return `<div class="opt c${i} ${cls}"><span class="sh">${K.SHAPES[i]}</span><span>${esc(o)}</span><span class="n">${Math.round(v * 100 / tot)} %</span></div>`;
      }).join('')}</div>`;
    } else if (r.type === 'est') {
      const mx = Math.max(1, ...(st.hist || [1]));
      main = `<div style="display:flex;gap:3vw;align-items:flex-end">
        <div><div class="bignum">${K.tonnes(rv.lo).replace(' t', '')} – ${K.tonnes(rv.hi)}</div>
        <div style="font-size:1.5em;font-weight:700;margin-top:.6vw">${st.inRange || 0} joueur(s) dans la fourchette · médiane de la salle : ${K.tonnes(st.med || 0)}</div></div></div>
        <div class="histo">${(st.hist || []).map((v, i) => `<div><i class="${i >= Math.floor((rv.lo || 0) / 10) && i <= Math.floor(((rv.hi || 1) - 1) / 10) ? 'in' : ''}" style="height:${Math.round(v * 100 / mx)}%"></i><span>${i}–${i + 1} t</span></div>`).join('')}</div>`;
    } else {
      main = `<div style="display:flex;gap:4vw;align-items:baseline">
        <div><div class="bignum">${K.fmt(st.total || 0)}</div><div style="font-size:1.6em;font-weight:700">roses cueillies par la salle en ${r.play} secondes</div></div>
        <div><div class="bignum" style="color:var(--sage)">${st.best || 0}</div><div style="font-size:1.6em;font-weight:700">record individuel</div></div></div>`;
    }
    paint(`rv:${G.sid}:${G.q}:${(G.top || []).length}:${st.n}`, `<div class="proj">${head(r)}
      <div class="row">
        <div style="flex:1;display:flex;flex-direction:column;gap:1.6vw"><h2 style="font-size:2.5em">${esc(r.q)}</h2>${main}
          ${rv.x ? `<div class="card explain">${esc(rv.x)}</div>` : ''}</div>
        ${r.type !== 'poll' ? `<div class="side"><div class="kicker">Classement · ${G.np || 0} joueurs</div>${lb(G.top, 6)}</div>` : ''}
      </div>${foot()}</div>`);
  }

  function vEnd() {
    const t = G.top || [];
    const p = i => t[i] ? `<div class="p p${i + 1}"><div class="nm">${esc(t[i].n)}</div><div class="sc">${K.fmt(t[i].s)} pts</div><div class="blk">${t[i].r}</div></div>` : `<div class="p p${i + 1}"></div>`;
    paint(`end:${G.sid}:${t.length}`, `<div class="proj dark">
      <div style="text-align:center"><div class="kicker">Classement final · ${G.np || 0} joueurs</div><h1 style="font-size:3.6em">Le podium de la Vallée des Roses</h1></div>
      <div class="row" style="align-items:flex-end">
        <div class="podium">${p(1)}${p(0)}${p(2)}</div>
        <div class="side" style="align-self:center">${t.length > 3 ? `<ol class="lb">${t.slice(3, 10).map(x => `<li><span class="rk">${x.r}</span><span class="nm">${esc(x.n)}</span><span class="sc">${K.fmt(x.s)}</span></li>`).join('')}</ol>` : ''}</div>
      </div>
      <p class="quote" style="text-align:center;color:#fff;font-size:1.9em;margin:0">« Une fleur peut devenir bien plus qu’un produit : elle peut être une mémoire, une identité et un avenir. »</p>
      ${foot()}</div>`, true);
  }

  function render() {
    if (!G || G.phase === 'off') return vWaiting();
    const r = K.ROUNDS[G.q];
    if (G.phase === 'lobby') return vLobby();
    if (G.phase === 'question') return vQuestion(r);
    if (G.phase === 'reveal') return vReveal(r);
    if (G.phase === 'end') return vEnd();
  }

  function lock(msg) {
    app.innerHTML = `<div class="lock"><div class="kicker">Écran de projection</div><h1 class="serif" style="margin:0">Code de la régie</h1>
      <form id="lf" style="display:flex;flex-direction:column;gap:12px"><div class="field"><input id="pin" placeholder="ROSE-XXXX-XXXX" autocomplete="off" autocapitalize="characters"></div>
      <p class="err" id="er">${esc(msg || '')}</p><button class="btn block">Ouvrir l’écran</button></form></div>`;
    $('#lf').onsubmit = async e => { e.preventDefault(); unlock($('#pin').value); };
  }
  async function unlock(pin) {
    try { await K.decryptKey(pin); } catch (e) { sessionStorage.removeItem('kmg_pin'); return lock('Code incorrect.'); }
    try { await S.adminLogin(pin); } catch (e) { return lock(K.errMsg(e)); }
    sessionStorage.setItem('kmg_pin', pin);
    app.innerHTML = '';
    let lastPhase = '';
    S.watchGame(g => {
      if (g && (g.phase + g.q) !== lastPhase) { g._recv = Date.now(); lastPhase = g.phase + g.q; } else if (g && G) g._recv = G._recv;
      G = g;
      if (g && g.sid !== curSid) {
        curSid = g.sid; unP && unP(); unA && unA(); players = []; answers = [];
        unP = S.watchPlayers(g.sid, l => { players = l; render(); }, console.error);
        unA = S.watchAnswers(g.sid, l => { answers = l; render(); }, console.error);
      }
      render();
    }, console.error);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }
  });

  (async function () {
    try { S = await K.store(); } catch (e) { app.innerHTML = `<div class="lock"><h1 class="serif">Connexion impossible</h1><p>${esc(K.errMsg(e))}</p></div>`; return; }
    const saved = sessionStorage.getItem('kmg_pin');
    if (saved) unlock(saved); else lock();
  })();
})();
