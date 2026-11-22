// Señales, puntuación y aprendizaje del bot.
import { SIGNALS, LEARNING_RATE, MIN_WEIGHT } from './config.js';

const clamp = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));
const fmt = (x) => (x >= 0 ? '+' : '') + x.toFixed(2);

// Calcula las 5 señales en [-1, 1] para la vela i de una moneda.
export function signalsAt(candles, ind, i) {
  if (i < 50 || ind.ema50[i] == null || ind.atr14[i] == null) return null;
  const k = candles[i];
  const s = {};
  // Tendencia: separación entre EMA20 y EMA50 (1 % = señal máxima)
  s.tendencia = clamp(((ind.ema20[i] / ind.ema50[i]) - 1) * 100);
  // Momentum: variación de las últimas 4 horas (16 velas). 3 % = máxima
  const past = candles[i - 16].c;
  s.momentum = clamp(((k.c / past) - 1) * 100 / 3);
  // Rebote: RSI sobrevendido = compra, sobrecomprado = venta
  const r = ind.rsi14[i];
  s.rebote = r < 35 ? clamp((35 - r) / 15) : r > 70 ? -clamp((r - 70) / 15) : 0;
  // Ruptura: cierre por encima/debajo del máximo/mínimo de las últimas 5 h
  const hi = ind.hi20[i], lo = ind.lo20[i];
  if (k.c > hi) s.ruptura = 1;
  else if (k.c < lo) s.ruptura = -1;
  else s.ruptura = clamp(((k.c - (hi + lo) / 2) / ((hi - lo) / 2 || 1)) * 0.4);
  // Volumen: volumen alto confirma la dirección de la vela
  const vr = ind.vol20[i] ? k.v / ind.vol20[i] - 1 : 0;
  s.volumen = clamp(vr / 2) * (k.c >= k.o ? 1 : -1);
  return {
    s,
    rsi: r,
    atr: ind.atr14[i],
    chg4h: ((k.c / past) - 1) * 100,
  };
}

export function score(weights, sig) {
  let total = 0, wsum = 0;
  for (const key of Object.keys(SIGNALS)) {
    total += (weights[key] || 0) * sig.s[key];
    wsum += weights[key] || 0;
  }
  return wsum ? total / wsum : 0;
}

// Explicación en lenguaje normal de por qué compra.
export function explainEntry(coin, sig, sc, threshold, trust) {
  const parts = Object.entries(sig.s)
    .filter(([, v]) => Math.abs(v) >= 0.15)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([k, v]) => `${SIGNALS[k]} ${fmt(v)}`);
  return (
    `Compra ${coin}: ${parts.join(' · ') || 'señales mixtas'}. ` +
    `RSI ${sig.rsi.toFixed(0)}, 4h ${sig.chg4h >= 0 ? '+' : ''}${sig.chg4h.toFixed(2)} %. ` +
    `Puntuación ${sc.toFixed(2)} (umbral ${threshold.toFixed(2)}, confianza en ${coin} ${trust.toFixed(2)}).`
  );
}

// Aprendizaje: tras cerrar una operación ajusta los pesos de cada señal,
// la confianza en la moneda y el umbral de entrada.
export function learn(bot, trade) {
  const notes = [];
  const r = clamp(trade.pnlPct / 2); // ±2 % = recompensa/castigo máximo
  const before = { ...bot.weights };
  for (const key of Object.keys(SIGNALS)) {
    const c = trade.signals?.[key] ?? 0;
    if (Math.abs(c) < 0.05) continue;
    bot.weights[key] = Math.max(MIN_WEIGHT, bot.weights[key] * Math.exp(LEARNING_RATE * r * c));
  }
  const sum = Object.values(bot.weights).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(bot.weights)) bot.weights[key] /= sum;

  const changes = Object.keys(SIGNALS)
    .map((k) => ({ k, d: bot.weights[k] - before[k] }))
    .filter((x) => Math.abs(x.d) >= 0.005)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 2)
    .map((x) => `${x.d > 0 ? 'sube' : 'baja'} ${SIGNALS[x.k]} (${before[x.k].toFixed(2)}→${bot.weights[x.k].toFixed(2)})`);
  if (changes.length) notes.push(changes.join(', '));

  const prevTrust = bot.coinTrust[trade.coin] ?? 1;
  const newTrust = clamp(prevTrust + 0.1 * r, 0.5, 1.5);
  bot.coinTrust[trade.coin] = newTrust;
  if (Math.abs(newTrust - prevTrust) >= 0.01) {
    notes.push(`confianza en ${trade.coin} ${prevTrust.toFixed(2)}→${newTrust.toFixed(2)}`);
  }

  // Cada 10 operaciones revisa el umbral: si falla mucho, se vuelve más exigente.
  const n = bot.tradeCount || bot.trades.length;
  if (n > 0 && n % 10 === 0) {
    const last = bot.trades.slice(-10);
    const wr = last.filter((t) => t.pnl > 0).length / last.length;
    const prevTh = bot.threshold;
    if (wr < 0.4) bot.threshold = Math.min(0.65, bot.threshold + 0.02);
    else if (wr > 0.6) bot.threshold = Math.max(bot.baseThreshold - 0.1, bot.threshold - 0.01);
    if (bot.threshold !== prevTh) {
      notes.push(
        `acierto ${(wr * 100).toFixed(0)} % en las últimas 10 → umbral ${prevTh.toFixed(2)}→${bot.threshold.toFixed(2)} ` +
          (bot.threshold > prevTh ? '(más exigente)' : '(más atrevido)')
      );
    }
  }

  const res = `${trade.coin} ${trade.pnlPct >= 0 ? '+' : ''}${trade.pnlPct.toFixed(2)} %`;
  return notes.length ? `Tras ${res}: ${notes.join('; ')}.` : `Tras ${res}: sin cambios relevantes.`;
}
