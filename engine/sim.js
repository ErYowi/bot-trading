// Núcleo de la simulación: crea bots y los hace avanzar vela a vela.
import {
  RISK, STRATEGIES, CANDLE_SECONDS, MIN_ORDER_EUR,
  MAX_TRADES_KEPT, MAX_JOURNAL, MAX_EQUITY_POINTS, FEE_RATE, SLIPPAGE,
} from './config.js';
import { signalsAt, score, explainEntry, learn } from './strategy.js';
import { paperExchange } from './exchanges/paper.js';

const exchange = paperExchange; // aquí se cambiaría por el exchange real en el futuro

export function createBot(cfg, t, market) {
  const risk = RISK[cfg.risk] ? cfg.risk : 'equilibrado';
  const strat = STRATEGIES[cfg.strategy] ? cfg.strategy : 'adaptativo';
  const capital = Math.max(10, Number(cfg.capital) || 100);
  // Referencia: comprar BTC con todo el capital y no tocarlo
  const btc = market.BTC ? priceAt(market.BTC, t) : null;
  const hodlQty = btc ? (capital * (1 - FEE_RATE)) / (btc * (1 + SLIPPAGE)) : 0;
  return {
    id: cfg.id,
    name: cfg.name || 'Bot',
    strategy: strat,
    risk,
    capital,
    coins: cfg.coins,
    resetToken: cfg.resetToken || null,
    createdAt: t,
    cash: capital,
    positions: [],
    trades: [],
    weights: { ...STRATEGIES[strat].weights },
    coinTrust: {},
    threshold: RISK[risk].threshold,
    baseThreshold: RISK[risk].threshold,
    hodl: { qty: hodlQty, startPrice: btc },
    equityHistory: [[t, capital, capital]],
    journal: [{ t, type: 'inicio', text: `Bot creado con ${capital.toFixed(2)} € · ${STRATEGIES[strat].label} · riesgo ${risk}.` }],
    totalFees: 0,
  };
}

function priceAt(m, t) {
  const i = m.index.get(t);
  if (i != null) return m.candles[i].c;
  // última vela conocida antes de t
  let last = null;
  for (const k of m.candles) { if (k.t <= t) last = k.c; else break; }
  return last;
}

export function equityOf(bot, market, t) {
  let eq = bot.cash;
  for (const p of bot.positions) {
    const px = market[p.coin] ? priceAt(market[p.coin], t) : p.entry;
    eq += p.qty * (px ?? p.entry) * (1 - FEE_RATE);
  }
  return eq;
}

function closePosition(bot, p, rawPrice, t, reason, events) {
  const fill = exchange.sell({ coin: p.coin, qty: p.qty, price: rawPrice });
  bot.cash += fill.eur;
  bot.totalFees += fill.fee;
  const pnl = fill.eur - p.cost;
  const trade = {
    coin: p.coin,
    entryTime: p.entryTime,
    exitTime: t,
    entryPrice: p.entry,
    exitPrice: fill.price,
    qty: p.qty,
    cost: p.cost,
    pnl,
    pnlPct: (pnl / p.cost) * 100,
    fees: p.fee + fill.fee,
    reasonIn: p.reason,
    reasonOut: reason,
    signals: p.signals,
    score: p.score,
  };
  bot.positions = bot.positions.filter((x) => x !== p);
  bot.cooldown = bot.cooldown || {};
  bot.cooldown[p.coin] = t + (RISK[bot.risk].cooldownCandles ?? 8) * (RISK[bot.risk].timeframe || CANDLE_SECONDS); // pausa antes de volver a esa moneda
  bot.trades.push(trade);
  bot.tradeCount = (bot.tradeCount || 0) + 1;
  if (bot.trades.length > MAX_TRADES_KEPT) bot.trades.splice(0, bot.trades.length - MAX_TRADES_KEPT);
  const lesson = learn(bot, trade);
  bot.journal.push({ t, type: 'aprendizaje', text: lesson });
  events.push({ bot: bot.name, botId: bot.id, type: 'venta', coin: p.coin, pnl, pnlPct: trade.pnlPct, text: reason, t });
}

// Avanza un bot una vela (t = inicio de la vela de 15 min que acaba de cerrar).
export function stepBot(bot, market, t, events) {
  const R = RISK[bot.risk];
  const TF = R.timeframe || CANDLE_SECONDS;

  // 1) Gestionar posiciones abiertas con el máximo/mínimo de la vela
  for (const p of [...bot.positions]) {
    const m = market[p.coin];
    const i = m?.index.get(t);
    if (i == null) continue;
    const k = m.candles[i];
    const atr = m.ind.atr14[i] ?? p.atr;
    if (k.l <= p.stop) {
      const px = Math.min(p.stop, k.o); // si abre por debajo del stop, se ejecuta peor (realista)
      const why = p.stop > p.entry ? 'Trailing stop: protegió beneficio' : 'Stop-loss tocado';
      closePosition(bot, p, px, t, `${why} a ${px.toPrecision(6)} €`, events);
      continue;
    }
    if (k.h >= p.tp) {
      const px = Math.max(p.tp, k.o);
      closePosition(bot, p, px, t, `Take-profit alcanzado a ${px.toPrecision(6)} €`, events);
      continue;
    }
    p.peak = Math.max(p.peak, k.h);
    if (p.peak >= p.entry + 1.5 * atr) {
      // Activa trailing: sube el stop para asegurar beneficio
      const trail = p.peak - R.stopATR * 0.75 * atr;
      if (trail > p.stop) p.stop = Math.max(trail, p.entry * (1 + 2 * (FEE_RATE + SLIPPAGE)));
    }
    const sig = (t - p.entryTime) / TF >= (R.minHoldCandles ?? 4) ? signalsAt(m.candles, m.ind, i) : null;
    if (sig) {
      const sc = score(bot.weights, sig);
      if (sc < -bot.threshold) {
        closePosition(bot, p, k.c, t, `Las señales giraron bajistas (${sc.toFixed(2)})`, events);
        continue;
      }
    }
    if ((t - p.entryTime) / TF >= R.maxHoldCandles) {
      closePosition(bot, p, k.c, t, `Tiempo máximo (${((R.maxHoldCandles * TF) / 3600).toFixed(0)} h) sin llegar al objetivo`, events);
    }
  }

  // 2) Buscar nuevas entradas
  const slots = R.maxPositions - bot.positions.length;
  const allowed = Array.isArray(bot.coins) && bot.coins.length ? bot.coins : Object.keys(market);
  const candidates = [];
  const radar = [];
  for (const coin of allowed) {
    if (bot.positions.some((p) => p.coin === coin)) continue;
    const m = market[coin];
    const i = m?.index.get(t);
    if (i == null) continue;
    const sig = signalsAt(m.candles, m.ind, i);
    if (!sig) continue;
    // Filtro de calidad: varias señales tienen que estar de acuerdo
    const agree = Object.values(sig.s).filter((v) => v > 0.2).length;
    const trust = bot.coinTrust[coin] ?? 1;
    const sc = score(bot.weights, sig) * trust;
    const cooling = (bot.cooldown?.[coin] ?? 0) > t;
    radar.push({ coin, score: +sc.toFixed(3), agree, cooling });
    if (cooling || agree < (R.minAgree ?? 2)) continue;
    if (sc > bot.threshold) candidates.push({ coin, sig, sc, trust, price: m.candles[i].c });
  }
  radar.sort((a, b) => b.score - a.score);
  bot.radar = { t, threshold: bot.threshold, minAgree: R.minAgree ?? 2, full: slots <= 0, items: radar.slice(0, 4) };
  if (slots > 0) {
    candidates.sort((a, b) => b.sc - a.sc);
    for (const c of candidates.slice(0, slots)) {
      const equity = equityOf(bot, market, t);
      const eur = Math.min(bot.cash, equity * R.positionPct);
      if (eur < MIN_ORDER_EUR) break;
      const fill = exchange.buy({ coin: c.coin, eur, price: c.price });
      bot.cash -= eur;
      bot.totalFees += fill.fee;
      const reason = explainEntry(c.coin, c.sig, c.sc, bot.threshold, c.trust);
      bot.positions.push({
        coin: c.coin,
        qty: fill.qty,
        entry: fill.price,
        cost: eur,
        fee: fill.fee,
        entryTime: t,
        atr: c.sig.atr,
        stop: fill.price - R.stopATR * c.sig.atr,
        tp: fill.price + R.tpATR * c.sig.atr,
        peak: fill.price,
        signals: { ...c.sig.s },
        score: c.sc,
        reason,
      });
      events.push({ bot: bot.name, botId: bot.id, type: 'compra', coin: c.coin, eur, text: reason, t });
    }
  }

  // 3) Registrar curva de capital (bot vs mantener BTC)
  const eq = equityOf(bot, market, t);
  const btc = market.BTC ? priceAt(market.BTC, t) : null;
  const hodlVal = btc && bot.hodl.qty ? bot.hodl.qty * btc * (1 - FEE_RATE) : bot.capital;
  bot.equityHistory.push([t, +eq.toFixed(4), +hodlVal.toFixed(4)]);
  if (bot.equityHistory.length > MAX_EQUITY_POINTS) {
    // comprime la parte antigua para no crecer sin límite
    const old = bot.equityHistory.slice(0, 800).filter((_, i) => i % 4 === 0);
    bot.equityHistory = old.concat(bot.equityHistory.slice(800));
  }
  if (bot.journal.length > MAX_JOURNAL) bot.journal.splice(0, bot.journal.length - MAX_JOURNAL);
}
