/* Le voyage d'une rose — noyau commun (questions, données, score) */
(function () {
  'use strict';
  const K = (window.KMG = {});
  K.GAME = 'live';
  K.NOW = { __now: true }; // horodatage serveur

  // ─────────────────── Manches (texte public, sans les réponses) ───────────────────
  K.ROUNDS = [
    { id: 'adn', type: 'qcm', dur: 20, slide: 'Après la slide 2 · Une rose venue d’Orient',
      tag: 'L’origine', q: 'Selon l’ADN, la rose de Damas est…',
      opts: ['Une espèce sauvage née en Syrie', 'Un croisement de deux espèces', 'Un hybride de trois espèces de rosiers', 'Une variété créée au Maroc'] },
    { id: 'pelerins', type: 'qcm', dur: 20, slide: 'Après la slide 3 · De Damas aux montagnes marocaines',
      tag: 'Le voyage', q: 'Des pèlerins de retour de La Mecque auraient rapporté la rose dans la vallée. C’est…',
      opts: ['Un récit local transmis oralement', 'Un fait prouvé par des archives', 'Une conclusion tirée de l’ADN', 'Une hypothèse de botanistes européens'] },
    { id: 'avicenne', type: 'tri', dur: 20, slide: 'Après la slide 7 · Une plante au croisement des civilisations',
      tag: 'Avicenne', q: '« Avicenne a inventé l’eau de rose. » Dans l’exposé, cette affirmation est classée…',
      opts: ['Établi', 'Tradition', 'Hypothèse'] },
    { id: 'haies', type: 'qcm', dur: 20, slide: 'Après la slide 8 · Pourquoi Kelaât M’Gouna ?',
      tag: 'Le terroir', q: 'Comment sont plantés la plupart des rosiers de la vallée ?',
      opts: ['En grands champs uniformes', 'Sous serre', 'En terrasses sur les versants', 'En haies, en bordure des parcelles'] },
    { id: 'festival', type: 'qcm', dur: 15, slide: 'Après la slide 11 · Le Festival des Roses',
      tag: 'La fête', q: 'En mai 2026, le Salon international de la rose à parfum fêtait sa…',
      opts: ['11e édition', '31e édition', '61e édition', '101e édition'] },
    { id: 'cueillette', type: 'tap', dur: 23, play: 15, amax: 60, slide: 'Slide 12 · La récolte, un travail collectif',
      tag: 'Défi cueillette', q: 'Cueille un maximum de roses avant que le soleil ne monte !' },
    { id: 'tonnes', type: 'est', dur: 25, min: 5, max: 100, slide: 'Slide 13, AVANT le dernier clic (le chiffre)',
      tag: 'Estimation', q: 'Combien de tonnes de roses faut-il pour obtenir 1 litre d’huile essentielle ?' },
    { id: 'marche', type: 'qcm', dur: 20, slide: 'Après la slide 17 · Les défis d’une filière fragile',
      tag: 'Le marché', q: 'Quels pays dominent le marché mondial de la rose à parfum ?',
      opts: ['Turquie et Bulgarie', 'Maroc et Iran', 'France et Italie', 'Syrie et Égypte'] },
    { id: 'todra', type: 'vf', dur: 15, slide: 'Après la slide 18 · Un territoire à découvrir',
      tag: 'Vrai ou faux', q: 'Les gorges du Todra se trouvent dans la Vallée des Roses.',
      opts: ['Vrai', 'Faux'] },
    { id: 'cap2030', type: 'qcm', dur: 20, slide: 'Après la slide 20 · Préserver une richesse vivante',
      tag: 'Cap 2030', q: 'Objectif Génération Green 2030 : quelle part de la production faut-il valoriser ?',
      opts: ['30 %', '50 %', '70 %', '100 %'] },
    { id: 'priorite', type: 'poll', dur: 25, slide: 'Slide 21 · Conclusion (sondage, sans points)',
      tag: 'Sondage', q: 'Selon vous, quelle est LA priorité pour l’avenir de la vallée ?',
      opts: ['L’eau d’abord', 'Transformer sur place', 'Des coopératives fortes', 'Un tourisme responsable'] }
  ];
  K.ROUNDS.forEach((r, i) => {
    r.i = i;
    if (r.opts) r.amax = r.opts.length - 1;
    if (r.type === 'est') r.amax = r.max;
  });
  K.SHAPES = ['✿', '◆', '●', '▲'];
  K.SCORED = K.ROUNDS.filter(r => r.type !== 'poll').length;

  // ─────────────────── Utilitaires ───────────────────
  K.$ = (s, r) => (r || document).querySelector(s);
  K.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  K.fmt = n => Math.round(n).toLocaleString('fr-FR');
  K.tonnes = v => (v / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' t';
  K.ord = n => n === 1 ? '1er' : n + 'e';
  K.joinUrl = () => new URL('./', location.href).href;
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  K.ls = ls;

  // Filtre de pseudos (la régie peut aussi masquer un pseudo)
  const BAD = ['merde', 'putain', 'pute', 'connard', 'conne', 'salope', 'encul', 'nique', 'batard', 'bâtard', 'fdp', 'pd', 'zebi', 'zeb', 'qahba', 'kahba', '9ahba', 'qhba', 'zamel', 'zaml', 'tabon', 'tbon', 'nayek', 'fuck', 'shit', 'bitch', 'dick', 'nazi', 'hitler', 'sex'];
  K.cleanName = raw => {
    const n = String(raw || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
    if (n.length < 2) return { ok: false, msg: 'Au moins 2 caractères.' };
    const flat = n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    if (BAD.some(b => flat.includes(b.normalize('NFD').replace(/[̀-ͯ]/g, ''))))
      return { ok: false, msg: 'Choisis un autre pseudo.' };
    return { ok: true, name: n };
  };

  // ─────────────────── Score ───────────────────
  // QCM / tri / vrai-faux : 500 pts si juste + jusqu'à 500 pts de rapidité
  // Estimation : 1000 pts dans la fourchette, puis -1 pt par 3 kg d'écart
  // Cueillette : 25 pts par rose (max 1000)
  K.points = (round, key, ans, openedAt, dur) => {
    if (!ans || !key) return 0;
    const el = Math.min(Math.max((ans.t - openedAt) / 1000, 0), dur);
    switch (round.type) {
      case 'qcm': case 'tri': case 'vf':
        return ans.a === key.c ? Math.round(500 + 500 * (1 - el / dur)) : 0;
      case 'est': {
        if (ans.a >= key.lo && ans.a <= key.hi) return 1000;
        const d = ans.a < key.lo ? key.lo - ans.a : ans.a - key.hi; // en dixièmes de tonne
        return Math.max(0, Math.round(1000 * (1 - d / 30)));
      }
      case 'tap': return Math.min(1000, Math.max(0, Math.round(ans.a)) * 25);
      default: return 0;
    }
  };

  // Classement complet à partir des joueurs, réponses et manches révélées
  K.board = (players, answers, hist, keyArr, hidden, lastRound) => {
    hidden = hidden || {};
    const byUid = {};
    players.forEach(p => { byUid[p.uid] = { uid: p.uid, n: p.n, s: 0, last: 0 }; });
    answers.forEach(a => {
      const h = hist[a.q]; const pl = byUid[a.uid];
      if (!h || !pl) return;
      const pts = K.points(K.ROUNDS[a.q], keyArr[a.q], a, h[0], h[1]);
      pl.s += pts;
      if (a.q === lastRound) pl.last = pts;
    });
    const list = Object.values(byUid).sort((x, y) => y.s - x.s || x.n.localeCompare(y.n));
    let rank = 0, prev = null;
    list.forEach((p, i) => { if (p.s !== prev) { rank = i + 1; prev = p.s; } p.rank = rank; });
    let anon = 0;
    const label = p => hidden[p.uid] ? 'Rose n°' + (++anon) : p.n;
    const top = list.slice(0, 10).map(p => ({ n: label(p), s: p.s, r: p.rank })); // pas de tableaux imbriqués dans Firestore
    const me = {};
    list.forEach(p => { me[p.uid] = [p.s, p.rank, p.last]; });
    return { top, me, np: list.length };
  };

  // Statistiques d'une manche (pour l'écran et les téléphones)
  K.stats = (round, key, ans) => {
    const n = ans.length;
    if (round.opts) {
      const dist = round.opts.map(() => 0);
      ans.forEach(a => { if (dist[a.a] !== undefined) dist[a.a]++; });
      return { n, dist };
    }
    if (round.type === 'est') {
      const vals = ans.map(a => a.a).sort((x, y) => x - y);
      const inRange = key ? vals.filter(v => v >= key.lo && v <= key.hi).length : 0;
      const med = n ? vals[Math.floor(n / 2)] : 0;
      // histogramme par tonne (0-1, 1-2, … 9-10)
      const hist = Array.from({ length: 10 }, () => 0);
      vals.forEach(v => { hist[Math.min(9, Math.floor(v / 10))]++; });
      return { n, med, inRange, hist };
    }
    if (round.type === 'tap') {
      const vals = ans.map(a => a.a);
      const total = vals.reduce((s, v) => s + v, 0);
      return { n, total, best: n ? Math.max.apply(null, vals) : 0, avg: n ? Math.round(total / n) : 0 };
    }
    return { n };
  };

  // ─────────────────── Clé chiffrée (régie) ───────────────────
  K.decryptKey = async pin => {
    const k = window.KMG_KEY;
    const b = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(pin.trim().toUpperCase()), 'PBKDF2', false, ['deriveKey']);
    const aes = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b(k.s), iterations: k.it, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(k.i) }, aes, b(k.c));
    return JSON.parse(new TextDecoder().decode(pt));
  };

  // ─────────────────── Données : mode démo (localStorage) ───────────────────
  function DemoStore() {
    const P = 'kmg_demo:';
    const read = k => ls.get(P + k);
    const subs = {};
    const emit = k => (subs[k] || []).forEach(f => f());
    const write = (k, v) => { ls.set(P + k, v); emit(k); };
    window.addEventListener('storage', e => { if (e.key && e.key.indexOf(P) === 0) emit(e.key.slice(P.length)); });
    const on = (k, f) => { (subs[k] = subs[k] || new Set()).add(f); setTimeout(f, 0); return () => subs[k].delete(f); };
    const stamp = o => { const r = {}; for (const x in o) r[x] = o[x] === K.NOW ? Date.now() : o[x]; return r; };
    let uid = null;
    try { uid = sessionStorage.getItem('kmg_uid'); } catch (e) {}
    if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 11); try { sessionStorage.setItem('kmg_uid', uid); } catch (e) {} }
    const fail = code => { const e = new Error(code); e.code = code; throw e; };

    const api = {
      mode: 'demo',
      uid: () => uid,
      async init() { return uid; },
      watchGame(cb) { return on('game', () => cb(read('game'))); },
      async join(sid, name) {
        const g = read('game'); if (!g || g.sid !== sid) fail('permission-denied');
        const pl = read('players') || {}; pl[sid + '_' + uid] = { s: sid, uid, n: name }; write('players', pl);
      },
      async myPlayer(sid) { const pl = read('players') || {}; return pl[sid + '_' + uid] || null; },
      async answer(sid, q, a, asUid) {
        const u = asUid || uid;
        const g = read('game');
        if (!g || g.phase !== 'question' || g.sid !== sid || g.q !== q) fail('permission-denied');
        if (Date.now() > g.openedAt + (g.dur + 3) * 1000) fail('permission-denied');
        if (!(typeof a === 'number' && a >= 0 && a <= g.amax)) fail('permission-denied');
        const an = read('answers') || {}; const id = sid + '_' + q + '_' + u;
        if (an[id]) fail('permission-denied');
        an[id] = { s: sid, q, sq: sid + '_' + q, uid: u, a, t: Date.now() }; write('answers', an);
      },
      async adminLogin() { return true; },
      async setGame(obj) { write('game', stamp(obj)); },
      async updateGame(patch) { write('game', Object.assign(read('game') || {}, stamp(patch))); },
      watchPlayers(sid, cb) { return on('players', () => cb(Object.values(read('players') || {}).filter(p => p.s === sid))); },
      watchAnswers(sid, cb) { return on('answers', () => cb(Object.values(read('answers') || {}).filter(a => a.s === sid))); },
      // Joueurs fictifs (répétition)
      botJoinMany(sid, list) {
        const pl = read('players') || {};
        list.forEach(b => { pl[sid + '_' + b.uid] = { s: sid, uid: b.uid, n: b.n }; });
        write('players', pl);
      },
      botAnswerMany(sid, q, items) {
        const g = read('game'); if (!g || g.phase !== 'question' || g.q !== q) return;
        const an = read('answers') || {};
        items.forEach(it => { const id = sid + '_' + q + '_' + it.uid; if (!an[id]) an[id] = { s: sid, q, sq: sid + '_' + q, uid: it.uid, a: it.a, t: Date.now() }; });
        write('answers', an);
      },
      wipe() { ['game', 'players', 'answers'].forEach(k => ls.del(P + k)); emit('game'); emit('players'); emit('answers'); }
    };
    return api;
  }

  // ─────────────────── Données : mode en direct (Firebase) ───────────────────
  async function FirebaseStore(cfg) {
    const V = 'https://www.gstatic.com/firebasejs/10.12.2/';
    const [appM, authM, fs] = await Promise.all([
      import(V + 'firebase-app.js'), import(V + 'firebase-auth.js'), import(V + 'firebase-firestore.js')]);
    const app = appM.initializeApp(cfg);
    const auth = authM.getAuth(app);
    const db = fs.getFirestore(app);
    let uid = null;
    const ms = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : v;
    const norm = d => { if (!d) return d; for (const k of ['openedAt', 't']) if (k in d) d[k] = ms(d[k]); return d; };
    const conv = o => { const r = {}; for (const x in o) r[x] = o[x] === K.NOW ? fs.serverTimestamp() : o[x]; return r; };
    const gref = () => fs.doc(db, 'games', K.GAME);

    return {
      mode: 'firebase',
      uid: () => uid,
      async init() {
        await new Promise(res => { const un = authM.onAuthStateChanged(auth, () => { un(); res(); }); });
        if (!auth.currentUser) await authM.signInAnonymously(auth);
        uid = auth.currentUser.uid;
        return uid;
      },
      watchGame(cb, onErr) {
        return fs.onSnapshot(gref(), s => cb(s.exists() ? norm(s.data({ serverTimestamps: 'estimate' })) : null), onErr);
      },
      async join(sid, name) { await fs.setDoc(fs.doc(db, 'players', sid + '_' + uid), { s: sid, uid, n: name }); },
      async myPlayer(sid) {
        try { const s = await fs.getDoc(fs.doc(db, 'players', sid + '_' + uid)); return s.exists() ? s.data() : null; }
        catch (e) { return null; }
      },
      async answer(sid, q, a) {
        await fs.setDoc(fs.doc(db, 'answers', sid + '_' + q + '_' + uid),
          { s: sid, q, sq: sid + '_' + q, uid, a, t: fs.serverTimestamp() });
      },
      async adminLogin(pin) {
        const ref = fs.doc(db, 'admins', uid);
        const s = await fs.getDoc(ref);
        if (!s.exists()) await fs.setDoc(ref, { pin: pin.trim().toUpperCase() });
        return true;
      },
      async setGame(obj) { await fs.setDoc(gref(), conv(obj)); },
      async updateGame(patch) { await fs.updateDoc(gref(), conv(patch)); },
      watchPlayers(sid, cb, onErr) {
        return fs.onSnapshot(fs.query(fs.collection(db, 'players'), fs.where('s', '==', sid)),
          qs => cb(qs.docs.map(d => d.data())), onErr);
      },
      watchAnswers(sid, cb, onErr) {
        return fs.onSnapshot(fs.query(fs.collection(db, 'answers'), fs.where('s', '==', sid)),
          qs => cb(qs.docs.map(d => norm(d.data({ serverTimestamps: 'estimate' })))), onErr);
      }
    };
  }

  K.store = async () => {
    const cfg = (window.KMG_CONFIG || {}).firebase;
    const s = cfg ? await FirebaseStore(cfg) : DemoStore();
    await s.init();
    return s;
  };

  K.errMsg = e => {
    const c = (e && (e.code || e.message)) || '';
    if (/permission/.test(c)) return 'Refusé par le serveur.';
    if (/unavailable|network|offline/.test(c)) return 'Connexion perdue. Vérifie ton réseau.';
    if (/admin-restricted|operation-not-allowed/.test(c)) return 'Connexion anonyme désactivée dans Firebase (Authentication → Anonyme).';
    return 'Erreur : ' + c;
  };

  // Rose stylisée (vue de dessus)
  K.roseSvg = (size, cls) => {
    let outer = '', mid = '';
    for (let i = 0; i < 5; i++) {
      outer += `<ellipse cx="0" cy="-20" rx="19" ry="23" transform="rotate(${i * 72})"/>`;
      mid += `<ellipse cx="0" cy="-11" rx="13" ry="15" transform="rotate(${i * 72 + 36})"/>`;
    }
    return `<svg class="rose-ico ${cls || ''}" width="${size}" height="${size}" viewBox="-50 -50 100 100" aria-hidden="true">
      <g fill="#4E6B47"><ellipse cx="-30" cy="30" rx="16" ry="8" transform="rotate(-35 -30 30)"/><ellipse cx="32" cy="28" rx="15" ry="7" transform="rotate(35 32 28)"/></g>
      <g fill="#C2465A" stroke="#8a1e2f" stroke-width="1.2">${outer}</g>
      <g fill="#A82A3E" stroke="#7a1828" stroke-width="1.2">${mid}</g>
      <circle r="10" fill="#8C1F31"/>
      <path d="M-4 1a4 4 0 1 1 5 4a7 7 0 1 1-8-9" fill="none" stroke="#E7B3B8" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  };

  // QR code (bibliothèque qrcode-generator, MIT)
  K.qrSvg = (text, cell) => {
    const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
    return qr.createSvgTag({ cellSize: cell || 8, margin: 2, scalable: true });
  };
})();
