// Descarga de velas reales. Fuente principal: Kraken. Respaldo: Coinbase.
import { COINS, CANDLE_SECONDS } from './config.js';

const UA = { 'User-Agent': 'onyx-bot-simulator/1.0' };

async function getJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Formato interno de vela: { t, o, h, l, c, v } con t = inicio en segundos.
async function fromKraken(pair) {
  const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${CANDLE_SECONDS / 60}`;
  const json = await getJSON(url);
  if (json.error && json.error.length) throw new Error(json.error.join(','));
  const key = Object.keys(json.result).find((k) => k !== 'last');
  return json.result[key].map((r) => ({ t: +r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[6] }));
}

async function fromCoinbase(product) {
  const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${CANDLE_SECONDS}`;
  const rows = await getJSON(url);
  if (!Array.isArray(rows)) throw new Error('respuesta inválida');
  // Coinbase: [time, low, high, open, close, volume], más reciente primero
  return rows.map((r) => ({ t: +r[0], l: +r[1], h: +r[2], o: +r[3], c: +r[4], v: +r[5] })).reverse();
}

// Devuelve solo velas CERRADAS (la vela en curso se descarta).
export async function fetchCandles(symbols, nowSec = Math.floor(Date.now() / 1000)) {
  const out = {};
  const sources = {};
  await Promise.all(
    symbols.map(async (sym) => {
      const meta = COINS[sym];
      if (!meta) return;
      let candles = null;
      try {
        candles = await fromKraken(meta.kraken);
        sources[sym] = 'kraken';
      } catch (e) {
        console.warn(`[datos] Kraken falló para ${sym}: ${e.message}`);
        if (meta.coinbase) {
          try {
            candles = await fromCoinbase(meta.coinbase);
            sources[sym] = 'coinbase';
          } catch (e2) {
            console.warn(`[datos] Coinbase falló para ${sym}: ${e2.message}`);
          }
        }
      }
      if (candles && candles.length) {
        out[sym] = candles.filter((k) => k.t + CANDLE_SECONDS <= nowSec && k.c > 0);
      }
    })
  );
  return { candles: out, sources };
}
