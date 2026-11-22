// Prueba offline: genera precios sintéticos realistas y ejecuta el motor como
// lo haría GitHub Actions cada 5 minutos durante varios días.
//   node engine/test/simulate.js [dias] [salida]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../run.js';
import { COINS, BASE_SECONDS as STEP } from '../config.js';

const days = Number(process.argv[2] || 6);
const out = process.argv[3] || path.join(os.tmpdir(), 'onyx-state.json');

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());

const start = process.env.DEMO_NOW
  ? Math.floor((Date.now() / 1000 - days * 86400 - 720 * STEP) / 900) * 900
  : Math.floor(Date.UTC(2026, 10, 1) / 1000);
const total = Math.ceil((days * 86400) / STEP) + 800;
const base = { BTC: 78000, ETH: 2900, XRP: 2.1, SOL: 150, DOGE: 0.17, ADA: 0.62, TRX: 0.25, LINK: 14, AVAX: 18, DOT: 3.4 };
const series = {};
for (const sym of Object.keys(COINS)) {
  let p = base[sym], drift = 0;
  const vol = (sym === 'BTC' ? 0.0035 : 0.006) / Math.sqrt(3);
  series[sym] = [];
  for (let i = 0; i < total; i++) {
    if (i % 288 === 0) drift = gauss() * 0.0002; // regímenes de tendencia diarios
    const o = p;
    p = p * Math.exp(drift + vol * gauss());
    const h = Math.max(o, p) * (1 + Math.abs(gauss()) * vol * 0.5);
    const l = Math.min(o, p) * (1 - Math.abs(gauss()) * vol * 0.5);
    series[sym].push({ t: start + i * STEP, o, h, l, c: p, v: 100 * (1 + Math.abs(gauss())) });
  }
}

const fetcher = async (symbols, now) => {
  const candles = {};
  for (const s of symbols) candles[s] = series[s].filter((k) => k.t + STEP <= now).slice(-720);
  return { candles, sources: Object.fromEntries(symbols.map((s) => [s, 'sintético'])) };
};

if (fs.existsSync(out)) fs.unlinkSync(out);
const t0 = start + 720 * STEP;
let state;
for (let now = t0; now <= t0 + days * 86400; now += 300) {
  state = await run({ fetcher, now, statePath: out, push: false });
}
const s = state;
console.log('\n=== Resultado tras', days, 'días simulados ===');
for (const b of s.bots) {
  const st = b.stats;
  console.log(
    `${b.name.padEnd(10)} ${st.equity.toFixed(2)} € (${st.returnPct.toFixed(2)} %) · ops ${st.trades} · acierto ${st.winRate?.toFixed(0)} % · ` +
      `DD ${st.maxDrawdownPct.toFixed(1)} % · HODL BTC ${st.hodlPct.toFixed(2)} % · pesos ${Object.entries(b.weights).map(([k, v]) => k[0] + v.toFixed(2)).join(' ')}`
  );
}
console.log('Tamaño state.json:', (fs.statSync(out).size / 1024).toFixed(0), 'KB →', out);
