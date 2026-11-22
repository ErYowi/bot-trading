// Indicadores técnicos clásicos, calculados sobre arrays de velas.

export function ema(values, period) {
  const k = 2 / (period + 1);
  const out = new Array(values.length).fill(null);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += values[j];
      prev = s / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    s += values[i];
    if (i >= period) s -= values[i - period];
    if (i >= period - 1) out[i] = s / period;
  }
  return out;
}

export function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  let gain = 0, loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = Math.max(d, 0), l = Math.max(-d, 0);
    if (i <= period) {
      gain += g; loss += l;
      if (i === period) {
        gain /= period; loss /= period;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
      }
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
}

export function atr(candles, period = 14) {
  const tr = candles.map((k, i) => {
    if (i === 0) return k.h - k.l;
    const pc = candles[i - 1].c;
    return Math.max(k.h - k.l, Math.abs(k.h - pc), Math.abs(k.l - pc));
  });
  const out = new Array(candles.length).fill(null);
  let prev = null;
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) {
      let s = 0;
      for (let j = 0; j < period; j++) s += tr[j];
      prev = s / period;
    } else prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export function rollingMax(values, period) {
  return values.map((_, i) => (i < period ? null : Math.max(...values.slice(i - period, i))));
}
export function rollingMin(values, period) {
  return values.map((_, i) => (i < period ? null : Math.min(...values.slice(i - period, i))));
}

// Precalcula todo lo que necesita la estrategia para una moneda.
export function computeIndicators(candles) {
  const c = candles.map((k) => k.c);
  const v = candles.map((k) => k.v);
  return {
    ema20: ema(c, 20),
    ema50: ema(c, 50),
    rsi14: rsi(c, 14),
    atr14: atr(candles, 14),
    hi20: rollingMax(candles.map((k) => k.h), 20),
    lo20: rollingMin(candles.map((k) => k.l), 20),
    vol20: sma(v, 20),
  };
}
