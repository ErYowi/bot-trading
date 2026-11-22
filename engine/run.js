// Punto de entrada del motor. GitHub Actions lo ejecuta cada ~5 minutos.
//   node engine/run.js
// Lee config/bots.json, descarga velas reales, avanza cada bot por las velas
// nuevas y guarda todo en data/state.json (que la app lee).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COINS, CANDLE_SECONDS, STRATEGIES, RISK } from './config.js';
import { fetchCandles, aggregate } from './data.js';
import { computeIndicators } from './indicators.js';
import { createBot, stepBot } from './sim.js';
import { computeStats } from './stats.js';
import { getVapid, sendPush } from './notify.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '1.0.0';
const MAX_CATCHUP = 192; // si el motor estuvo parado, recupera como mucho 48 h

const readJSON = (p, fallback) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
};

export function buildMarket(candlesBySym) {
  const market = {};
  for (const [sym, candles] of Object.entries(candlesBySym)) {
    if (candles.length < 60) continue;
    const index = new Map(candles.map((k, i) => [k.t, i]));
    market[sym] = { candles, index, ind: computeIndicators(candles) };
  }
  return market;
}

const tfOf = (risk) => RISK[risk]?.timeframe || CANDLE_SECONDS;

function syncBots(state, cfg, markets, tStart, events) {
  const wanted = (cfg.bots || []).filter((b) => b && b.id && b.active !== false);
  const byId = new Map(state.bots.map((b) => [b.id, b]));
  const next = [];
  for (const c of wanted) {
    const prev = byId.get(c.id);
    if (!prev || (c.resetToken || null) !== (prev.resetToken || null)) {
      const tf = tfOf(c.risk);
      const bot = createBot(c, tStart[tf], markets[tf]);
      next.push(bot);
      events.push({ bot: bot.name, botId: bot.id, type: 'info', text: prev ? 'Bot reiniciado' : 'Bot creado', t: tStart[tf] });
      continue;
    }
    // Cambios que se aplican en caliente
    prev.name = c.name || prev.name;
    prev.coins = c.coins;
    if (RISK[c.risk] && c.risk !== prev.risk) {
      prev.journal.push({ t: tStart[tfOf(prev.risk)], type: 'ajuste', text: `Riesgo cambiado de ${prev.risk} a ${c.risk}.` });
      const delta = prev.threshold - prev.baseThreshold;
      prev.risk = c.risk;
      prev.baseThreshold = RISK[c.risk].threshold;
      prev.threshold = prev.baseThreshold + delta;
    }
    next.push(prev);
  }
  state.bots = next;
}

function marketSnapshot(market) {
  const out = {};
  for (const sym of Object.keys(COINS)) {
    const m = market[sym];
    if (!m) continue;
    const c = m.candles;
    const last = c[c.length - 1];
    const day = c.slice(-96);
    out[sym] = {
      name: COINS[sym].name,
      ws: COINS[sym].ws,
      price: last.c,
      t: last.t,
      change24h: (last.c / day[0].o - 1) * 100,
      high24h: Math.max(...day.map((k) => k.h)),
      low24h: Math.min(...day.map((k) => k.l)),
      spark: day.map((k) => +k.c.toPrecision(7)),
      rsi: m.ind.rsi14[c.length - 1],
    };
  }
  return out;
}

export async function run({ fetcher = fetchCandles, now = Math.floor(Date.now() / 1000), statePath, configPath, pushPath, push = true } = {}) {
  statePath ||= path.join(ROOT, 'data', 'state.json');
  configPath ||= path.join(ROOT, 'config', 'bots.json');
  pushPath ||= path.join(ROOT, 'config', 'push.json');

  const cfg = readJSON(configPath, { bots: [] });
  const state = readJSON(statePath, null) || { version: VERSION, lastCandle: null, bots: [], events: [] };

  const symbols = Object.keys(COINS);
  const { candles, sources } = await fetcher(symbols, now);
  // Dos marcos temporales: 5 min (bots rápidos) y 15 min (el resto)
  const c15 = Object.fromEntries(Object.entries(candles).map(([s, c]) => [s, aggregate(c, 900, now)]));
  const markets = { 300: buildMarket(candles), 900: buildMarket(c15) };
  const market = markets[900];
  if (!market.BTC || !markets[300].BTC) throw new Error('Sin datos de BTC: no se puede avanzar la simulación');
  const events = [];

  // progreso por marco temporal (migra el formato antiguo)
  state.lastCandleByTf ||= {};
  if (state.lastCandle != null && state.lastCandleByTf[900] == null) state.lastCandleByTf[900] = state.lastCandle;
  const pendingByTf = {}, tStart = {};
  let processed = 0;
  for (const tf of [300, 900]) {
    const times = markets[tf].BTC.candles.map((k) => k.t);
    const latest = times[times.length - 1];
    if (state.lastCandleByTf[tf] == null) state.lastCandleByTf[tf] = latest; // primer arranque: empieza "ahora"
    let pending = times.filter((t) => t > state.lastCandleByTf[tf]);
    const cap = (MAX_CATCHUP * 900) / tf;
    if (pending.length > cap) pending = pending.slice(-cap);
    pendingByTf[tf] = pending;
    tStart[tf] = pending[0] ?? latest;
  }

  syncBots(state, cfg, markets, tStart, events);

  for (const tf of [300, 900]) {
    for (const t of pendingByTf[tf]) {
      for (const bot of state.bots) {
        if (tfOf(bot.risk) !== tf || t <= bot.createdAt) continue;
        stepBot(bot, markets[tf], t, events);
      }
      state.lastCandleByTf[tf] = t;
      processed++;
    }
  }
  state.lastCandle = state.lastCandleByTf[900];

  for (const bot of state.bots) {
    bot.stats = computeStats(bot);
    bot.strategyLabel = STRATEGIES[bot.strategy].label;
    bot.timeframe = tfOf(bot.risk);
  }

  state.version = VERSION;
  state.updatedAt = now;
  state.candleSeconds = CANDLE_SECONDS;
  state.sources = sources;
  state.market = marketSnapshot(market);
  state.events = [...(state.events || []), ...events.filter((e) => e.type !== 'info')].slice(-60);
  state.runs = (state.runs || 0) + 1;

  if (push) {
    const vapid = await getVapid();
    if (vapid) state.vapidPublicKey = vapid.publicKey;
    const prefs = cfg.notifications || { compras: true, ventas: true };
    const toSend = events.filter((e) => (e.type === 'compra' && prefs.compras !== false) || (e.type === 'venta' && prefs.ventas !== false));
    const subs = readJSON(pushPath, { subscriptions: [] }).subscriptions || [];
    const sent = await sendPush(vapid, subs, toSend);
    if (sent) console.log(`[push] ${sent} notificación(es) enviada(s)`);
  }

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state));
  console.log(
    `[onyx] velas procesadas: ${processed} · bots: ${state.bots.length} · eventos: ${events.length} · ` +
      state.bots.map((b) => `${b.name} ${b.stats.equity.toFixed(2)}€`).join(' | ')
  );
  return state;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
