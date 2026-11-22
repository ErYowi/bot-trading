// ONYX — app del simulador. Vanilla JS, sin compilación.
(function () {
  'use strict';

  // ---------- Ajustes guardados en el móvil ----------
  const ACCENTS = {
    oro: { name: 'Oro', c: '#c9a86a' },
    platino: { name: 'Platino', c: '#d6d9de' },
    esmeralda: { name: 'Esmeralda', c: '#5bc79a' },
    zafiro: { name: 'Zafiro', c: '#7aa2ff' },
    rubi: { name: 'Rubí', c: '#e2596e' },
    amatista: { name: 'Amatista', c: '#a98bff' },
  };
  const BGS = {
    onix: { name: 'Ónix', c: '#000000' },
    grafito: { name: 'Grafito', c: '#101012' },
    medianoche: { name: 'Medianoche', c: '#040712' },
  };
  const STRATS = {
    adaptativo: 'IA adaptativa',
    tendencia: 'Seguidor de tendencia',
    rebote: 'Cazador de rebotes',
    ruptura: 'Rupturas',
  };
  const RISKS = { conservador: 'Conservador', equilibrado: 'Equilibrado', agresivo: 'Agresivo' };
  const SIGNAL_NAMES = {
    tendencia: 'Tendencia (EMA 20/50)', momentum: 'Momentum (4h)', rebote: 'Rebote (RSI)',
    ruptura: 'Ruptura (máximos 5h)', volumen: 'Volumen',
  };
  const COIN_LIST = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA', 'TRX', 'LINK', 'AVAX', 'DOT'];
  const FEE = 0.001;

  const store = {
    get() {
      try { return JSON.parse(localStorage.getItem('onyx') || '{}'); } catch { return {}; }
    },
    set(patch) {
      const next = { ...store.get(), ...patch };
      try { localStorage.setItem('onyx', JSON.stringify(next)); } catch { /* modo privado */ }
      return { ...DEFAULTS, ...next };
    },
  };
  const DEFAULTS = { accent: 'oro', bg: 'onix', font: 'clasica', range: '7d' };
  let S = { ...DEFAULTS, ...store.get() };

  // Repositorio: se detecta solo si la app está en usuario.github.io/repo
  function detectRepo() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (m) {
      const repo = location.pathname.split('/').filter(Boolean)[0];
      return { owner: m[1], repo: repo || `${m[1]}.github.io` };
    }
    return { owner: '', repo: '' };
  }
  const detected = detectRepo();
  const repoCfg = () => ({ owner: S.owner || detected.owner, repo: S.repo || detected.repo, token: S.token || '' });
  const gh = () => GH.create(repoCfg());

  // ---------- Estado ----------
  let STATE = null;
  let LOAD_ERROR = null;
  let DEMO = new URLSearchParams(location.search).has('demo') || S.demo === true;
  const LIVE = {};
  let firstLoad = true;

  // ---------- Utilidades ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eurFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const eur = (v) => eurFmt.format(v || 0);
  const signed = (v, digits = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  const signedEur = (v) => `${v >= 0 ? '+' : '−'}${eurFmt.format(Math.abs(v))}`;
  const pct = (v, digits = 2) => `${signed(v, digits)} %`;
  const cls = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'muted');
  function price(v) {
    if (v == null) return '—';
    const d = v >= 1000 ? 2 : v >= 1 ? 3 : v >= 0.1 ? 4 : 5;
    return `${v.toLocaleString('es-ES', { minimumFractionDigits: Math.min(2, d), maximumFractionDigits: d })} €`;
  }
  function ago(t) {
    const s = Math.max(0, Date.now() / 1000 - t);
    if (s < 60) return 'hace un momento';
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    return `hace ${Math.round(s / 86400)} d`;
  }
  const when = (t) => new Date(t * 1000).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const hhmm = (t) => new Date(t * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const accentColor = () => ACCENTS[S.accent]?.c || ACCENTS.oro.c;
  const livePrice = (sym) => LIVE[sym]?.price ?? STATE?.market?.[sym]?.price ?? null;

  function toast(title, body = '', ms = 4200) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<b>${esc(title)}</b>${esc(body)}`;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // ---------- Tema ----------
  function applyTheme() {
    const root = document.documentElement;
    root.style.setProperty('--accent', accentColor());
    root.style.setProperty('--bg', BGS[S.bg]?.c || '#000');
    root.dataset.bg = S.bg;
    root.dataset.font = S.font;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', BGS[S.bg]?.c || '#000');
  }

  // ---------- Carga de datos ----------
  let lastStamp = null;
  async function load(force = false) {
    try {
      if (DEMO) {
        const r = await fetch('demo-state.json', { cache: 'no-store' });
        STATE = await r.json();
      } else {
        const { owner, repo } = repoCfg();
        if (!owner || !repo) { STATE = null; LOAD_ERROR = 'sin-repo'; render(); return; }
        STATE = await gh().getState();
        LOAD_ERROR = STATE ? null : 'sin-estado';
      }
      if (STATE) LOAD_ERROR = null;
      notifyNewEvents();
      connectLive();
    } catch (e) {
      LOAD_ERROR = e.message;
    }
    renderHeartbeat();
    const stamp = STATE ? `${DEMO}-${STATE.updatedAt}` : `none-${LOAD_ERROR}`;
    if (force || stamp !== lastStamp) { lastStamp = stamp; render(); }
  }

  function notifyNewEvents() {
    const events = STATE?.events || [];
    const lastT = events.length ? events[events.length - 1].t : 0;
    if (firstLoad || DEMO) { firstLoad = false; S = store.set({ lastEventT: Math.max(S.lastEventT || 0, lastT) }); return; }
    const fresh = events.filter((e) => e.t > (S.lastEventT || 0));
    fresh.slice(-3).forEach((e) => {
      if (e.type === 'compra') toast(`${e.bot} compró ${e.coin}`, eur(e.eur));
      else toast(`${e.bot} vendió ${e.coin}`, `${signedEur(e.pnl)} (${pct(e.pnlPct)})`);
    });
    S = store.set({ lastEventT: Math.max(S.lastEventT || 0, lastT) });
  }

  function renderHeartbeat() {
    const hb = $('#heartbeat');
    const txt = $('#heartbeat-text');
    hb.classList.remove('live', 'stale');
    if (DEMO) { txt.textContent = 'Modo demo'; hb.classList.add('stale'); return; }
    if (!STATE) { txt.textContent = LOAD_ERROR === 'sin-estado' ? 'Esperando al motor' : 'Sin conexión'; return; }
    const age = Date.now() / 1000 - STATE.updatedAt;
    hb.classList.add(age < 20 * 60 ? 'live' : 'stale');
    txt.textContent = `Motor ${age < 20 * 60 ? 'activo' : 'parado'}, ${ago(STATE.updatedAt)}`;
  }

  // ---------- Precios en vivo (WebSocket de Kraken) ----------
  let ws = null, wsRetry = 0;
  function connectLive() {
    if (ws || !STATE?.market || !('WebSocket' in window)) return;
    const symbols = Object.values(STATE.market).map((m) => m.ws).filter(Boolean);
    const bySymbol = Object.fromEntries(Object.entries(STATE.market).map(([k, m]) => [m.ws, k]));
    try { ws = new WebSocket('wss://ws.kraken.com/v2'); } catch { ws = null; return; }
    ws.onopen = () => {
      wsRetry = 0;
      ws.send(JSON.stringify({ method: 'subscribe', params: { channel: 'ticker', symbol: symbols } }));
    };
    let pending = false;
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.channel !== 'ticker' || !Array.isArray(msg.data)) return;
      for (const d of msg.data) {
        const sym = bySymbol[d.symbol];
        if (sym && d.last) LIVE[sym] = { price: +d.last, t: Date.now() / 1000 };
      }
      if (!pending) { pending = true; setTimeout(() => { pending = false; updateLive(); }, 1000); }
    };
    ws.onclose = () => {
      ws = null;
      if (document.visibilityState === 'visible') setTimeout(connectLive, Math.min(30000, 2000 * 2 ** wsRetry++));
    };
    ws.onerror = () => { try { ws.close(); } catch { /* nada */ } };
  }

  // Actualiza solo los números en vivo sin redibujar la pantalla
  function updateLive() {
    document.querySelectorAll('[data-live-price]').forEach((n) => {
      const p = livePrice(n.dataset.livePrice);
      if (p != null) n.textContent = price(p);
    });
    document.querySelectorAll('[data-live-chg]').forEach((n) => {
      const sym = n.dataset.liveChg;
      const m = STATE?.market?.[sym];
      const p = livePrice(sym);
      if (!m || p == null) return;
      const ch = (p / (m.spark[0] || p) - 1) * 100;
      n.textContent = pct(ch);
      n.className = `row-sub ${cls(ch)}`;
    });
    document.querySelectorAll('[data-live-pos]').forEach((n) => {
      const [botId, coin] = n.dataset.livePos.split(':');
      const bot = STATE.bots.find((b) => b.id === botId);
      const p = bot?.positions.find((x) => x.coin === coin);
      const lp = livePrice(coin);
      if (!p || lp == null) return;
      const pnl = p.qty * lp * (1 - FEE) - p.cost;
      n.textContent = `${signedEur(pnl)} (${pct((pnl / p.cost) * 100)})`;
      n.className = cls(pnl);
    });
  }

  // ---------- Cálculos ----------
  const RANGES = { '24h': 86400, '7d': 7 * 86400, '30d': 30 * 86400, todo: Infinity };
  function inRange(points, range) {
    if (!points.length) return points;
    const end = points[points.length - 1][0];
    const span = RANGES[range] ?? Infinity;
    const out = points.filter((p) => p[0] >= end - span);
    return out.length >= 2 ? out : points.slice(-2);
  }
  function downsample(points, max = 320) {
    if (points.length <= max) return points;
    const step = points.length / max;
    const out = [];
    for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
    out.push(points[points.length - 1]);
    return out;
  }
  // Suma de todos los bots (y de su referencia BTC) en una sola curva
  function combinedHistory(bots) {
    const times = [...new Set(bots.flatMap((b) => b.equityHistory.map((p) => p[0])))].sort((a, b) => a - b);
    const idx = bots.map(() => 0);
    const eq = [], hodl = [];
    for (const t of times) {
      let se = 0, sh = 0;
      bots.forEach((b, i) => {
        const h = b.equityHistory;
        while (idx[i] + 1 < h.length && h[idx[i] + 1][0] <= t) idx[i]++;
        const p = h[idx[i]];
        if (p[0] <= t) { se += p[1]; sh += p[2]; } else { se += b.capital; sh += b.capital; }
      });
      eq.push([t, se]); hodl.push([t, sh]);
    }
    return { eq, hodl };
  }
  function liveEquity(bot) {
    let eq = bot.cash;
    for (const p of bot.positions) eq += p.qty * (livePrice(p.coin) ?? p.entry) * (1 - FEE);
    return eq;
  }

  // ---------- Router ----------
  const view = () => $('#view');
  function route() {
    const [tab, arg] = (location.hash.replace('#', '') || 'inicio').split('/');
    document.querySelectorAll('.tabbar a').forEach((a) => {
      const on = a.dataset.tab === (tab === 'bot' ? 'bots' : tab);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    return { tab, arg };
  }
  function render() {
    const { tab, arg } = route();
    const v = view();
    if (tab === 'ajustes') return renderSettings(v);
    if (!STATE) return renderEmpty(v);
    if (tab === 'bots') return renderBots(v);
    if (tab === 'bot') return renderBot(v, arg);
    if (tab === 'mercado') return renderMarket(v);
    if (tab === 'diario') return renderJournal(v, arg);
    return renderHome(v);
  }

  function demoBanner() {
    return DEMO ? `<div class="demo-banner"><span>Estás viendo datos de ejemplo.</span><button type="button" data-action="exit-demo">Salir de la demo</button></div>` : '';
  }

  function renderEmpty(v) {
    const { owner, repo } = repoCfg();
    let msg;
    if (LOAD_ERROR === 'sin-repo') msg = 'Indica en Ajustes el usuario y el repositorio de GitHub donde está el motor.';
    else if (LOAD_ERROR === 'sin-estado') msg = `El motor de ${esc(owner)}/${esc(repo)} todavía no ha hecho su primer ciclo. Suele tardar unos 5 minutos desde que se sube el proyecto.`;
    else msg = `No he podido leer los datos: ${esc(LOAD_ERROR || 'error desconocido')}`;
    v.innerHTML = `<div class="empty"><h2>Todo listo para arrancar</h2><p>${msg}</p>
      <button class="btn" type="button" data-action="demo">Ver la demo mientras tanto</button>
      <p><a class="small muted" href="#ajustes">Ir a Ajustes</a></p></div>`;
  }

  // ---------- Inicio ----------
  function renderHome(v) {
    const bots = STATE.bots;
    const capital = bots.reduce((a, b) => a + b.capital, 0);
    const equity = bots.reduce((a, b) => a + liveEquity(b), 0);
    const pnl24 = bots.reduce((a, b) => a + (b.stats?.pnl24h || 0), 0);
    const ret = capital ? (equity / capital - 1) * 100 : 0;
    const { eq, hodl } = combinedHistory(bots);
    const hodlNow = hodl.length ? hodl[hodl.length - 1][1] : capital;
    const hodlRet = capital ? (hodlNow / capital - 1) * 100 : 0;
    const [ent, dec] = eur(equity).split(',');
    const lastTrades = bots.flatMap((b) => b.trades.map((t) => ({ ...t, bot: b }))).sort((a, b) => b.exitTime - a.exitTime).slice(0, 4);
    const winner = ret - hodlRet;

    v.innerHTML = `
      ${demoBanner()}
      <section class="hero" aria-label="Capital total">
        <div class="hero-label">Capital de ${bots.length} ${bots.length === 1 ? 'bot' : 'bots'}, empezaste con ${eur(capital)}</div>
        <div class="hero-value ${firstPaint ? 'reveal' : ''}">${esc(ent)}<span class="cents">,${esc(dec)}</span></div>
        <div class="hero-meta">
          <span class="${cls(equity - capital)}">${signedEur(equity - capital)} (${pct(ret)})</span>
          <span class="${cls(pnl24)}">${signedEur(pnl24)} <span class="muted">en 24 h</span></span>
        </div>
      </section>
      <div id="home-chart"></div>
      <div class="legend"><span><i style="background:var(--accent)"></i>Tus bots</span><span><i style="background:var(--muted)"></i>Mantener BTC</span></div>
      ${rangeButtons()}

      <section class="versus" aria-label="Bots frente a mantener Bitcoin">
        <div class="versus-head">
          <strong>${winner >= 0 ? 'Los bots van ganando' : 'BTC va ganando'}</strong>
          <span class="${cls(winner)}">${pct(winner)}</span>
        </div>
        ${versusBar('Tus bots', ret, Math.max(Math.abs(ret), Math.abs(hodlRet)), 'var(--accent)')}
        ${versusBar('Comprar BTC y no tocarlo', hodlRet, Math.max(Math.abs(ret), Math.abs(hodlRet)), 'var(--muted)')}
      </section>

      <h2 class="section-title">Tus bots <a class="small muted" href="#bots">Ver todos</a></h2>
      <div class="rows">${bots.map(botRow).join('')}</div>

      <h2 class="section-title">Últimas operaciones <a class="small muted" href="#diario">Diario</a></h2>
      ${lastTrades.length ? lastTrades.map((t) => tradeItem(t, true)).join('') : '<p class="muted small">Todavía no ha cerrado ninguna operación. Los bots esperan a que las señales sean claras.</p>'}
    `;
    Charts.lineChart($('#home-chart'), [
      { points: downsample(inRange(eq, S.range)), color: accentColor(), width: 2, fill: true, label: 'Bots' },
      { points: downsample(inRange(hodl, S.range)), color: '#8d8a82', width: 1.2, dash: '3 4', label: 'BTC' },
    ], { height: 190, baseline: capital, format: eur });
    firstPaint = false;
  }
  let firstPaint = true;

  function versusBar(label, value, max, color) {
    const w = max ? Math.min(50, (Math.abs(value) / max) * 50) : 0;
    const left = value >= 0 ? 50 : 50 - w;
    return `<div class="bar"><div class="bar-label"><span>${esc(label)}</span><span class="${cls(value)}">${pct(value)}</span></div>
      <div class="bar-track"><div style="position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--line)"></div>
      <div class="bar-fill" style="left:${left}%;width:${w}%;background:${color}"></div></div></div>`;
  }

  function rangeButtons() {
    return `<div class="ranges" role="group" aria-label="Periodo">${Object.keys(RANGES)
      .map((r) => `<button type="button" data-range="${r}" aria-pressed="${S.range === r}">${r === 'todo' ? 'Todo' : r}</button>`).join('')}</div>`;
  }

  function botRow(b) {
    const eq = liveEquity(b);
    const ret = (eq / b.capital - 1) * 100;
    const spark = b.equityHistory.slice(-96).map((p) => p[1]);
    return `<a class="row" href="#bot/${encodeURIComponent(b.id)}">
      <div class="row-main"><div class="row-title">${esc(b.name)}</div>
      <div class="row-sub">${esc((STRATS[b.strategy] || b.strategy).replace('Seguidor de tendencia','Tendencia').replace('Cazador de rebotes','Rebotes'))}, ${b.positions.length ? b.positions.length + (b.positions.length === 1 ? ' abierta' : ' abiertas') : 'sin posiciones'}</div></div>
      <div class="row-end" style="display:flex;gap:12px;align-items:center">${Charts.sparkline(spark, ret >= 0 ? 'var(--up)' : 'var(--down)')}
      <div><div>${eur(eq)}</div><div class="row-sub ${cls(ret)}">${pct(ret)}</div></div></div></a>`;
  }

  function tradeItem(t, withBot = false) {
    return `<details class="trade">
      <summary style="list-style:none;cursor:pointer">
        <div class="trade-top"><b>${esc(t.coin)} <span class="pill sell">Venta</span></b><b class="${cls(t.pnl)}">${signedEur(t.pnl)}</b></div>
        <div class="trade-top small muted"><span>${withBot ? esc(t.bot.name) + ', ' : ''}${when(t.exitTime)}</span><span class="${cls(t.pnl)}">${pct(t.pnlPct)}</span></div>
      </summary>
      <div class="trade-why">
        <p><span class="tag">Por qué compró:</span> ${esc(t.reasonIn)}</p>
        <p><span class="tag">Por qué vendió:</span> ${esc(t.reasonOut)}</p>
        <p>Entrada ${price(t.entryPrice)}, salida ${price(t.exitPrice)}, invertido ${eur(t.cost)}, comisiones ${eur(t.fees)}, duración ${durationText(t.exitTime - t.entryTime)}.</p>
      </div></details>`;
  }
  function durationText(s) {
    const h = s / 3600;
    return h < 1 ? `${Math.round(s / 60)} min` : h < 48 ? `${h.toFixed(1).replace('.', ',')} h` : `${(h / 24).toFixed(1).replace('.', ',')} días`;
  }

  // ---------- Bots ----------
  function renderBots(v) {
    v.innerHTML = `${demoBanner()}
      <h1 class="title">Bots</h1>
      <p class="muted small">Cada bot es un simulador independiente con su propio dinero, estrategia y aprendizaje. Corren todos a la vez, 24 horas al día.</p>
      <div class="rows">${STATE.bots.map(botRow).join('')}</div>
      <button class="btn block" type="button" data-action="new-bot" style="margin-top:20px">Crear un bot nuevo</button>
      ${S.token || DEMO ? '' : '<p class="muted small" style="text-align:center">Para crear o editar bots desde el móvil, conecta GitHub en Ajustes.</p>'}`;
  }

  function renderBot(v, id) {
    const b = STATE.bots.find((x) => x.id === decodeURIComponent(id || ''));
    if (!b) { location.hash = '#bots'; return; }
    const st = b.stats || {};
    const eq = liveEquity(b);
    const ret = (eq / b.capital - 1) * 100;
    const trades = [...b.trades].reverse();
    v.innerHTML = `${demoBanner()}
      <button class="back" type="button" data-action="back">Volver a bots</button>
      <section class="hero">
        <div class="hero-label">${esc(b.name)}: ${esc(STRATS[b.strategy])}, riesgo ${esc(RISKS[b.risk]?.toLowerCase() || b.risk)}</div>
        <div class="hero-value" style="font-size:clamp(46px,14vw,62px)">${eur(eq)}</div>
        <div class="hero-meta"><span class="${cls(ret)}">${signedEur(eq - b.capital)} (${pct(ret)})</span><span class="muted">empezó con ${eur(b.capital)} ${ago(b.createdAt)}</span></div>
      </section>
      <div id="bot-chart"></div>
      <div class="legend"><span><i style="background:var(--accent)"></i>${esc(b.name)}</span><span><i style="background:var(--muted)"></i>Mantener BTC (${pct(st.hodlPct || 0)})</span></div>
      ${rangeButtons()}

      <h2 class="section-title">Estadísticas</h2>
      <div class="stats">
        ${stat('Operaciones cerradas', st.trades ?? 0)}
        ${stat('Acierto', st.winRate == null ? '—' : `${st.winRate.toFixed(0)} %`)}
        ${stat('Beneficio 24 h', signedEur(st.pnl24h || 0), cls(st.pnl24h))}
        ${stat('Beneficio 7 días', signedEur(st.pnl7d || 0), cls(st.pnl7d))}
        ${stat('Beneficio 30 días', signedEur(st.pnl30d || 0), cls(st.pnl30d))}
        ${stat('Contra mantener BTC', pct(st.vsHodlPct || 0), cls(st.vsHodlPct))}
        ${stat('Mayor caída', `−${(st.maxDrawdownPct || 0).toFixed(1).replace('.', ',')} %`)}
        ${stat('Factor de beneficio', st.profitFactor == null ? '—' : st.profitFactor.toFixed(2).replace('.', ','))}
        ${stat('Ganancia media', signedEur(st.avgWin || 0), 'up')}
        ${stat('Pérdida media', signedEur(st.avgLoss || 0), 'down')}
        ${stat('Mejor operación', st.best == null ? '—' : pct(st.best), 'up')}
        ${stat('Peor operación', st.worst == null ? '—' : pct(st.worst), 'down')}
        ${stat('Duración media', st.avgHoldHours == null ? '—' : durationText(st.avgHoldHours * 3600))}
        ${stat('Comisiones pagadas', eur(st.fees || 0))}
      </div>

      <h2 class="section-title">Posiciones abiertas <small>${eur(b.cash)} en efectivo</small></h2>
      ${b.positions.length ? b.positions.map((p) => positionItem(b, p)).join('') : '<p class="muted small">Sin posiciones ahora mismo. Compra cuando la puntuación supera su umbral.</p>'}

      <h2 class="section-title">Lo que ha aprendido <small>umbral ${b.threshold.toFixed(2)}</small></h2>
      ${weightsBlock(b)}

      <h2 class="section-title">Operaciones <small>${trades.length}</small></h2>
      ${trades.length ? trades.slice(0, 60).map((t) => tradeItem(t)).join('') : '<p class="muted small">Aún no ha cerrado operaciones.</p>'}

      <div class="btn-row"><button class="btn ghost" type="button" data-action="edit-bot" data-id="${esc(b.id)}">Editar bot</button></div>`;
    Charts.lineChart($('#bot-chart'), [
      { points: downsample(inRange(b.equityHistory.map((p) => [p[0], p[1]]), S.range)), color: accentColor(), width: 2, fill: true, label: 'Bot' },
      { points: downsample(inRange(b.equityHistory.map((p) => [p[0], p[2]]), S.range)), color: '#8d8a82', width: 1.2, dash: '3 4', label: 'BTC' },
    ], { height: 180, baseline: b.capital, format: eur });
  }
  const stat = (k, v, c = '') => `<div class="stat"><div class="k">${esc(k)}</div><div class="v ${c}">${esc(v)}</div></div>`;

  function positionItem(b, p) {
    const lp = livePrice(p.coin);
    const pnl = p.qty * (lp ?? p.entry) * (1 - FEE) - p.cost;
    return `<details class="trade" open>
      <summary style="list-style:none;cursor:pointer">
        <div class="trade-top"><b>${esc(p.coin)} <span class="pill buy">Abierta</span></b><b data-live-pos="${esc(b.id)}:${esc(p.coin)}" class="${cls(pnl)}">${signedEur(pnl)} (${pct((pnl / p.cost) * 100)})</b></div>
        <div class="levels"><span>Entrada ${price(p.entry)}</span><span>Ahora <span data-live-price="${esc(p.coin)}">${price(lp)}</span></span></div>
        <div class="levels"><span class="down">Stop ${price(p.stop)}</span><span class="up">Objetivo ${price(p.tp)}</span><span>${eur(p.cost)}</span></div>
      </summary>
      <div class="trade-why"><p><span class="tag">Por qué compró:</span> ${esc(p.reason)}</p><p>Abierta ${ago(p.entryTime)}.</p></div></details>`;
  }

  function weightsBlock(b) {
    const entries = Object.entries(b.weights).sort((a, c) => c[1] - a[1]);
    const max = Math.max(...entries.map((e) => e[1]));
    const trust = Object.entries(b.coinTrust || {}).sort((a, c) => c[1] - a[1]);
    return `<div class="weights">${entries.map(([k, w]) => `<div class="weight-row"><span>${esc(SIGNAL_NAMES[k] || k)}</span>
      <div class="bar-track"><div class="bar-fill" style="left:0;width:${(w / max) * 100}%"></div></div><span>${Math.round(w * 100)} %</span></div>`).join('')}</div>
      ${trust.length ? `<p class="muted small" style="margin-top:14px">Confianza por moneda: ${trust.map(([c, v]) => `<span class="${v > 1 ? 'up' : v < 1 ? 'down' : ''}">${esc(c)} ${v.toFixed(2)}</span>`).join(', ')}</p>` : ''}`;
  }

  // ---------- Mercado ----------
  function renderMarket(v) {
    const m = STATE.market || {};
    const syms = Object.keys(m);
    v.innerHTML = `${demoBanner()}
      <h1 class="title">Mercado</h1>
      <p class="muted small">Las 10 criptos que vigilan los bots. Los precios se actualizan en directo.</p>
      <div class="rows">${syms.map((s) => {
        const d = m[s];
        const ch = d.change24h;
        return `<button class="row three" type="button" data-action="coin" data-sym="${esc(s)}" style="width:100%;background:none;border-left:0;border-right:0;border-top:0;text-align:left">
          <span class="coin-mark">${esc(s)}</span>
          <div class="row-main"><div class="row-title">${esc(d.name)}</div><div class="row-sub">RSI ${d.rsi ? d.rsi.toFixed(0) : '—'}</div></div>
          <div class="row-end" style="display:flex;gap:12px;align-items:center">${Charts.sparkline(d.spark.filter((_, i) => i % 2 === 0), ch >= 0 ? 'var(--up)' : 'var(--down)')}
          <div><div data-live-price="${esc(s)}">${price(livePrice(s))}</div><div class="row-sub ${cls(ch)}" data-live-chg="${esc(s)}">${pct(ch)}</div></div></div>
        </button>`;
      }).join('')}</div>
      <p class="muted small" style="margin-top:14px">Fuente: Kraken${Object.values(STATE.sources || {}).includes('coinbase') ? ' y Coinbase' : ''}. Velas de 15 minutos.</p>`;
  }

  function openCoin(sym) {
    const d = STATE.market[sym];
    const step = STATE.candleSeconds || 900;
    const pts = d.spark.map((c, i) => [d.t - (d.spark.length - 1 - i) * step, c]);
    const lp = livePrice(sym);
    if (lp != null && LIVE[sym]) pts.push([LIVE[sym].t, lp]);
    const holders = STATE.bots.filter((b) => b.positions.some((p) => p.coin === sym)).map((b) => b.name);
    openSheet(`<h2 id="sheet-title">${esc(d.name)}</h2>
      <div class="hero-value" style="font-size:44px" data-live-price="${esc(sym)}">${price(lp)}</div>
      <div class="hero-meta"><span class="${cls(d.change24h)}">${pct(d.change24h)} en 24 h</span></div>
      <div id="coin-chart"></div>
      <div class="stats" style="margin-top:18px">
        ${stat('Máximo 24 h', price(d.high24h))}${stat('Mínimo 24 h', price(d.low24h))}
        ${stat('RSI (14)', d.rsi ? d.rsi.toFixed(0) : '—')}${stat('Bots dentro', holders.length ? holders.join(', ') : 'Ninguno')}
      </div>`);
    Charts.lineChart($('#coin-chart'), [{ points: pts, color: d.change24h >= 0 ? '#63c79b' : '#ee6f7d', width: 1.8, fill: true }], { height: 170, format: price });
  }

  // ---------- Diario ----------
  function renderJournal(v, sub) {
    const mode = sub === 'aprendizaje' ? 'aprendizaje' : 'operaciones';
    const trades = STATE.bots.flatMap((b) => b.trades.map((t) => ({ ...t, bot: b }))).sort((a, b) => b.exitTime - a.exitTime);
    const journal = STATE.bots.flatMap((b) => b.journal.map((j) => ({ ...j, bot: b }))).sort((a, b) => b.t - a.t);
    v.innerHTML = `${demoBanner()}
      <h1 class="title">Diario</h1>
      <div class="seg" role="group" aria-label="Vista del diario">
        <button type="button" data-goto="#diario" aria-pressed="${mode === 'operaciones'}">Operaciones</button>
        <button type="button" data-goto="#diario/aprendizaje" aria-pressed="${mode === 'aprendizaje'}">Aprendizaje</button>
      </div>
      ${mode === 'operaciones'
        ? `<p class="muted small">Toca una operación para ver por qué compró y por qué vendió.</p>${trades.slice(0, 120).map((t) => tradeItem(t, true)).join('') || '<p class="muted">Sin operaciones todavía.</p>'}`
        : `<p class="muted small">Cada vez que cierra una operación, el bot ajusta cuánto se fía de cada señal y de cada moneda.</p>
           ${journal.slice(0, 150).map((j) => `<div class="entry"><time datetime="${new Date(j.t * 1000).toISOString()}">${hhmm(j.t)}<br>${new Date(j.t * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</time>
           <div><span class="who">${esc(j.bot.name)}</span> ${esc(j.text)}</div></div>`).join('')}`}`;
  }

  // ---------- Ajustes ----------
  function renderSettings(v) {
    const { owner, repo } = repoCfg();
    const notif = STATE?.__notifPrefs;
    v.innerHTML = `
      <h1 class="title">Ajustes</h1>

      <section class="group"><h2>Color de la app</h2>
        <div class="swatches with-labels" role="group" aria-label="Color de acento">${Object.entries(ACCENTS).map(([k, a]) =>
          `<button class="swatch" type="button" style="--c:${a.c}" data-accent="${k}" aria-pressed="${S.accent === k}" aria-label="${a.name}"><span>${a.name}</span></button>`).join('')}</div>
      </section>
      <section class="group"><h2>Fondo</h2>
        <div class="seg" role="group" aria-label="Fondo">${Object.entries(BGS).map(([k, b]) => `<button type="button" data-set-bg="${k}" aria-pressed="${S.bg === k}">${b.name}</button>`).join('')}</div>
      </section>
      <section class="group"><h2>Tipografía de los números</h2>
        <div class="seg" role="group" aria-label="Tipografía"><button type="button" data-set-font="clasica" aria-pressed="${S.font === 'clasica'}">Clásica</button><button type="button" data-set-font="moderna" aria-pressed="${S.font === 'moderna'}">Moderna</button></div>
      </section>

      <section class="group"><h2>Conexión con GitHub</h2>
        <div class="field"><label for="f-owner">Usuario de GitHub</label><input class="input" id="f-owner" autocapitalize="off" autocomplete="off" spellcheck="false" value="${esc(owner)}" placeholder="Ingresium" /></div>
        <div class="field"><label for="f-repo">Repositorio</label><input class="input" id="f-repo" autocapitalize="off" autocomplete="off" spellcheck="false" value="${esc(repo)}" placeholder="bot-trading" /></div>
        <div class="field"><label for="f-token">Token de acceso (opcional)</label>
          <input class="input" id="f-token" type="password" autocomplete="off" value="${S.token ? '••••••••••' : ''}" placeholder="github_pat_…" />
          <span class="hint">Solo hace falta para crear o editar bots y activar notificaciones desde el móvil. Se guarda únicamente en este dispositivo.</span></div>
        <div class="btn-row"><button class="btn" type="button" data-action="save-gh">Guardar y probar</button>${S.token ? '<button class="btn ghost" type="button" data-action="forget-token">Quitar token</button>' : ''}</div>
        <details class="note" style="margin-top:14px"><summary style="cursor:pointer"><b>Cómo crear el token</b></summary>
          <ol><li>En GitHub: Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token.</li>
          <li>En "Repository access" elige solo el repositorio del bot.</li>
          <li>En permisos, pon "Contents" en "Read and write". Nada más.</li>
          <li>Cópialo y pégalo aquí.</li></ol></details>
      </section>

      <section class="group"><h2>Notificaciones</h2>
        <div class="setting"><div><b>Avisos en el iPhone</b><p>Cuando un bot compra o vende. Requiere la app añadida a la pantalla de inicio.</p></div>
          <button class="btn ghost" type="button" data-action="enable-push">Activar</button></div>
        <div class="setting"><div><b>Avisar de compras</b></div><label class="switch"><input type="checkbox" data-notif="compras" ${notif?.compras === false ? '' : 'checked'} /><i></i></label></div>
        <div class="setting"><div><b>Avisar de ventas</b></div><label class="switch"><input type="checkbox" data-notif="ventas" ${notif?.ventas === false ? '' : 'checked'} /><i></i></label></div>
      </section>

      <section class="group"><h2>Datos</h2>
        <div class="setting"><div><b>Modo demo</b><p>Muestra datos de ejemplo en lugar de los del motor.</p></div><label class="switch"><input type="checkbox" data-action="toggle-demo" ${DEMO ? 'checked' : ''} /><i></i></label></div>
        <div class="setting"><div><b>Actualizar ahora</b><p>${STATE ? `Último ciclo del motor ${ago(STATE.updatedAt)}, ${STATE.runs || 0} ciclos en total.` : 'Sin datos todavía.'}</p></div><button class="btn ghost" type="button" data-action="reload">Actualizar</button></div>
      </section>

      <section class="group"><h2>Sobre el simulador</h2>
        <div class="note">
          <p><b>Es dinero simulado con precios reales.</b> Cada orden paga un 0,1 % de comisión y un 0,05 % de deslizamiento, como en un exchange de verdad. Los stops se ejecutan con el mínimo real de cada vela.</p>
          <p><b>Aun así, la simulación suele salir algo mejor que la realidad:</b> no hay retrasos de red ni libros de órdenes poco líquidos.</p>
          <p><b>Modo real (a partir de los 18).</b> El motor ya separa la estrategia del exchange, así que más adelante se podrá conectar a una cuenta real cambiando solo el conector. Antes conviene llevar semanas en simulación.</p>
        </div>
      </section>
      <p class="muted small" style="text-align:center;margin-top:24px">ONYX ${STATE?.version ? 'motor ' + esc(STATE.version) : ''}</p>`;
    // preferencias de notificación actuales
    if (S.token && !DEMO && !STATE?.__notifPrefs) {
      gh().getFile('config/bots.json').then(({ data }) => {
        if (!STATE || !data) return;
        STATE.__notifPrefs = data.notifications || {};
        document.querySelectorAll('[data-notif]').forEach((i) => { i.checked = STATE.__notifPrefs[i.dataset.notif] !== false; });
      }).catch(() => {});
    }
  }

  // ---------- Hoja inferior ----------
  function openSheet(html) {
    $('#sheet-body').innerHTML = html;
    $('#sheet').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    document.body.style.overflow = '';
  }

  // ---------- Editor de bots ----------
  function botEditor(bot) {
    const isNew = !bot;
    const b = bot || { name: '', strategy: 'adaptativo', risk: 'equilibrado', capital: 100, coins: [] };
    const coins = Array.isArray(b.coins) && b.coins.length ? b.coins : COIN_LIST;
    openSheet(`<h2 id="sheet-title">${isNew ? 'Nuevo bot' : 'Editar ' + esc(b.name)}</h2>
      <form id="bot-form" novalidate>
        <div class="field"><label for="b-name">Nombre</label><input class="input" id="b-name" maxlength="18" value="${esc(b.name)}" placeholder="Por ejemplo, Halcón" required /></div>
        <div class="field"><label for="b-capital">Dinero inicial (simulado)</label><input class="input" id="b-capital" type="number" inputmode="decimal" min="10" max="1000000" step="1" value="${b.capital}" />
          ${isNew ? '' : '<span class="hint">Si cambias el dinero, el bot se reinicia desde cero.</span>'}</div>
        <div class="field"><label>Estrategia</label><div class="chips" data-group="strategy">${Object.entries(STRATS).map(([k, n]) => `<button type="button" class="chip" data-val="${k}" aria-pressed="${b.strategy === k}">${n}</button>`).join('')}</div>
          ${isNew ? '' : '<span class="hint">Cambiar de estrategia reinicia el bot.</span>'}</div>
        <div class="field"><label>Riesgo</label><div class="seg" data-group="risk">${Object.entries(RISKS).map(([k, n]) => `<button type="button" data-val="${k}" aria-pressed="${b.risk === k}">${n}</button>`).join('')}</div></div>
        <div class="field"><label>Criptos que puede operar</label><div class="chips" data-group="coins" data-multi>${COIN_LIST.map((c) => `<button type="button" class="chip" data-val="${c}" aria-pressed="${coins.includes(c)}">${c}</button>`).join('')}</div></div>
        <button class="btn block" type="submit">${isNew ? 'Crear bot' : 'Guardar cambios'}</button>
        ${isNew ? '' : `<div class="btn-row"><button class="btn ghost" type="button" data-action="reset-bot" data-id="${esc(b.id)}">Reiniciar</button><button class="btn danger" type="button" data-action="delete-bot" data-id="${esc(b.id)}">Borrar</button></div>`}
      </form>`);
    const form = $('#bot-form');
    form.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-val]');
      if (!chip) return;
      const group = chip.parentElement;
      if (group.hasAttribute('data-multi')) chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') !== 'true');
      else group.querySelectorAll('[data-val]').forEach((x) => x.setAttribute('aria-pressed', x === chip));
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#b-name').value.trim() || 'Bot';
      const capital = Math.max(10, Math.round(Number($('#b-capital').value) || 100));
      const strategy = form.querySelector('[data-group="strategy"] [aria-pressed="true"]')?.dataset.val || 'adaptativo';
      const risk = form.querySelector('[data-group="risk"] [aria-pressed="true"]')?.dataset.val || 'equilibrado';
      let coins = [...form.querySelectorAll('[data-group="coins"] [aria-pressed="true"]')].map((x) => x.dataset.val);
      if (!coins.length) { toast('Elige al menos una cripto'); return; }
      if (coins.length === COIN_LIST.length) coins = [];
      await saveConfig((cfg) => {
        cfg.bots ||= [];
        if (isNew) {
          const id = `${name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bot'}-${Math.random().toString(36).slice(2, 6)}`;
          cfg.bots.push({ id, name, strategy, risk, capital, coins, active: true, resetToken: 'v1' });
        } else {
          const c = cfg.bots.find((x) => x.id === b.id);
          if (!c) throw new Error('Ese bot ya no existe en la configuración');
          const needsReset = c.capital !== capital || c.strategy !== strategy;
          Object.assign(c, { name, strategy, risk, capital, coins });
          if (needsReset) c.resetToken = `r${Date.now()}`;
        }
        return cfg;
      }, isNew ? `Crear bot ${name}` : `Editar bot ${name}`, isNew ? 'Bot creado' : 'Cambios guardados');
    });
  }

  async function saveConfig(mutate, message, okText) {
    if (DEMO) { toast('Estás en modo demo', 'Sal de la demo para guardar bots reales.'); return; }
    if (!S.token) { toast('Falta conectar GitHub', 'Añade el token en Ajustes.'); closeSheet(); location.hash = '#ajustes'; return; }
    try {
      await gh().update('config/bots.json', (cfg) => mutate(cfg || { bots: [] }), message);
      closeSheet();
      toast(okText, 'El motor lo aplicará en el próximo ciclo (unos minutos).');
    } catch (e) {
      toast('No se pudo guardar', e.message, 6000);
    }
  }

  // ---------- Notificaciones push ----------
  function urlB64ToUint8Array(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  async function enablePush() {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (!standalone && /iphone|ipad/i.test(navigator.userAgent)) {
      toast('Primero añade ONYX a la pantalla de inicio', 'En Safari: Compartir, Añadir a pantalla de inicio. Luego ábrela desde el icono.', 7000);
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { toast('Este navegador no admite notificaciones push'); return; }
    if (!S.token) { toast('Falta conectar GitHub', 'Las notificaciones necesitan el token para registrarse.'); return; }
    if (!STATE?.vapidPublicKey) { toast('El motor aún no ha publicado su clave', 'Espera a que haga su primer ciclo.'); return; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Permiso denegado', 'Actívalo en Ajustes del iPhone, Notificaciones, ONYX.'); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(STATE.vapidPublicKey) });
      const json = sub.toJSON();
      await gh().update('config/push.json', (d) => {
        const subs = (d?.subscriptions || []).filter((s) => s.endpoint !== json.endpoint);
        subs.push(json);
        return { subscriptions: subs.slice(-5) };
      }, 'Registrar notificaciones');
      toast('Notificaciones activadas', 'Te avisaré cuando los bots operen.');
    } catch (e) {
      toast('No se pudieron activar', e.message, 6000);
    }
  }

  // ---------- Eventos ----------
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-action],[data-range],[data-accent],[data-set-bg],[data-set-font],[data-goto],[data-close]');
    if (!t) return;
    if (t.dataset.close !== undefined) return closeSheet();
    if (t.dataset.goto) { location.hash = t.dataset.goto; return; }
    if (t.dataset.range) { S = store.set({ range: t.dataset.range }); render(); return; }
    if (t.dataset.accent) { S = store.set({ accent: t.dataset.accent }); applyTheme(); render(); return; }
    if (t.dataset.setBg) { S = store.set({ bg: t.dataset.setBg }); applyTheme(); render(); return; }
    if (t.dataset.setFont) { S = store.set({ font: t.dataset.setFont }); applyTheme(); render(); return; }
    const a = t.dataset.action;
    if (a === 'demo') { DEMO = true; S = store.set({ demo: true }); await load(); }
    else if (a === 'exit-demo') { DEMO = false; S = store.set({ demo: false }); STATE = null; await load(); }
    else if (a === 'toggle-demo') { DEMO = t.checked; S = store.set({ demo: DEMO }); STATE = null; await load(); }
    else if (a === 'back') history.length > 1 ? history.back() : (location.hash = '#bots');
    else if (a === 'coin') openCoin(t.dataset.sym);
    else if (a === 'new-bot') botEditor(null);
    else if (a === 'edit-bot') botEditor(STATE.bots.find((b) => b.id === t.dataset.id));
    else if (a === 'reset-bot') {
      if (t.dataset.confirm !== '1') { t.dataset.confirm = '1'; t.textContent = 'Pulsa otra vez para reiniciar'; return; }
      await saveConfig((cfg) => { const c = cfg.bots.find((x) => x.id === t.dataset.id); if (c) c.resetToken = `r${Date.now()}`; return cfg; }, 'Reiniciar bot', 'Bot reiniciado');
    } else if (a === 'delete-bot') {
      if (t.dataset.confirm !== '1') { t.dataset.confirm = '1'; t.textContent = 'Pulsa otra vez para borrar'; return; }
      await saveConfig((cfg) => { cfg.bots = cfg.bots.filter((x) => x.id !== t.dataset.id); return cfg; }, 'Borrar bot', 'Bot borrado');
      location.hash = '#bots';
    } else if (a === 'save-gh') {
      const tokenVal = $('#f-token').value.trim();
      const patch = { owner: $('#f-owner').value.trim(), repo: $('#f-repo').value.trim() };
      if (tokenVal && !tokenVal.startsWith('•')) patch.token = tokenVal;
      S = store.set(patch);
      try {
        await gh().check();
        toast('Conexión correcta', S.token ? 'Ya puedes crear y editar bots desde aquí.' : 'Modo solo lectura (sin token).');
        DEMO = false; S = store.set({ demo: false });
        await load();
      } catch (err) { toast('No se pudo conectar', err.message, 6000); }
    } else if (a === 'forget-token') { S = store.set({ token: '' }); render(); toast('Token eliminado de este dispositivo'); }
    else if (a === 'enable-push') enablePush();
    else if (a === 'reload') { await load(true); toast('Datos actualizados'); }
  });

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.notif) {
      const key = t.dataset.notif;
      const val = t.checked;
      if (DEMO || !S.token) { toast('Conecta GitHub para guardar esta opción'); return; }
      try {
        await gh().update('config/bots.json', (cfg) => { cfg ||= { bots: [] }; cfg.notifications = { compras: true, ventas: true, ...(cfg.notifications || {}), [key]: val }; return cfg; }, 'Preferencias de notificaciones');
        if (STATE) STATE.__notifPrefs = { ...(STATE.__notifPrefs || {}), [key]: val };
        toast('Preferencia guardada');
      } catch (err) { toast('No se pudo guardar', err.message); }
    }
  });

  window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { load(); connectLive(); } });
  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(render, 200); });

  // ---------- Arranque ----------
  applyTheme();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  load();
  setInterval(() => { if (document.visibilityState === 'visible') load(); }, 90 * 1000);
  setInterval(renderHeartbeat, 30 * 1000);
})();
