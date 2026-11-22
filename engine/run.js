// Punto de entrada del motor. GitHub Actions lo ejecuta cada ~5 minutos.
//   node engine/run.js
// Lee config/bots.json, descarga velas reales, avanza cada bot por las velas
// nuevas y guarda todo en data/state.json (que la app lee).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COINS, CANDLE_SECONDS, STRATEGIES, RISK } from './config.js';
import { fetchCandles } from './data.js';
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

function syncBots(state, cfg, market, t, events) {
  const wanted = (cfg.bots || []).filter((b) => b && b.id && b.active !== false);
  const byId = new Map(state.bots.map((b) => [b.id, b]));
  const next = [];
  for (const c of wanted) {
    const prev = byId.get(c.id);
    if (!prev || (c.resetToken || null) !== (prev.resetToken || null)) {
      const bot = createBot(c, t, market);
      next.push(bot);
      events.push({ bot: bot.name, botId: bot.id, type: 'info', text: prev ? 'Bot reiniciado' : 'Bot creado', t });
      continue;
    }
    // Cambios que se aplican en caliente
    prev.name = c.name || prev.name;
    prev.coins = c.coins;
    if (RISK[c.risk] && c.risk !== prev.risk) {
      prev.journal.push({ t, type: 'ajuste', text: `Riesgo cambiado de ${prev.risk} a ${c.risk}.` });
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
  const market = buildMarket(candles);
  if (!market.BTC) throw new Error('Sin datos de BTC: no se puede avanzar la simulación');

  const btcTimes = market.BTC.candles.map((k) => k.t);
  const latest = btcTimes[btcTimes.length - 1];
  const events = [];

  if (state.lastCandle == null) state.lastCandle = latest; // primer arranque: empieza "ahora"
  let pending = btcTimes.filter((t) => t > state.lastCandle);
  if (pending.length > MAX_CATCHUP) pending = pending.slice(-MAX_CATCHUP);

  syncBots(state, cfg, market, pending[0] ?? latest, events);

  for (const t of pending) {
    for (const bot of state.bots) {
      if (t <= bot.createdAt) continue;
      stepBot(bot, market, t, events);
    }
    state.lastCandle = t;
  }

  for (const bot of state.bots) {
    bot.stats = computeStats(bot);
    bot.strategyLabel = STRATEGIES[bot.strategy].label;
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
    `[onyx] velas procesadas: ${pending.length} · bots: ${state.bots.length} · eventos: ${events.length} · ` +
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
