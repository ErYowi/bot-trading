// Notificaciones push al iPhone (Web Push).
// Claves VAPID: se usan las del secreto de GitHub si existen; si no, se generan
// una vez y se guardan en la caché privada de GitHub Actions (.vapid/).
import fs from 'node:fs';
import path from 'node:path';

const VAPID_DIR = '.vapid';
const VAPID_FILE = path.join(VAPID_DIR, 'vapid.json');

async function loadWebPush() {
  try {
    const mod = await import('web-push');
    return mod.default || mod;
  } catch {
    console.warn('[push] web-push no instalado; notificaciones desactivadas');
    return null;
  }
}

export async function getVapid() {
  const wp = await loadWebPush();
  if (!wp) return null;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { wp, publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  if (fs.existsSync(VAPID_FILE)) {
    const k = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
    return { wp, ...k };
  }
  const k = wp.generateVAPIDKeys();
  fs.mkdirSync(VAPID_DIR, { recursive: true });
  fs.writeFileSync(VAPID_FILE, JSON.stringify(k));
  console.log('[push] claves VAPID generadas y guardadas en la caché');
  return { wp, ...k };
}

function summarize(events) {
  if (events.length === 1) {
    const e = events[0];
    if (e.type === 'compra') return { title: `🟢 ${e.bot} compró ${e.coin}`, body: `${e.eur.toFixed(2)} € · ${e.text}` };
    const sign = e.pnl >= 0 ? '+' : '';
    return {
      title: `${e.pnl >= 0 ? '✅' : '🔻'} ${e.bot} vendió ${e.coin} (${sign}${e.pnlPct.toFixed(2)} %)`,
      body: `${sign}${e.pnl.toFixed(2)} € · ${e.text}`,
    };
  }
  const buys = events.filter((e) => e.type === 'compra').length;
  const sells = events.filter((e) => e.type === 'venta');
  const pnl = sells.reduce((a, e) => a + e.pnl, 0);
  return {
    title: `ONYX: ${events.length} operaciones nuevas`,
    body: `${buys} compras · ${sells.length} ventas${sells.length ? ` · resultado ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} €` : ''}`,
  };
}

export async function sendPush(vapid, subscriptions, events) {
  if (!vapid || !events.length || !subscriptions.length) return 0;
  const { wp, publicKey, privateKey } = vapid;
  wp.setVapidDetails('mailto:onyx-bot@users.noreply.github.com', publicKey, privateKey);
  const payload = JSON.stringify({ ...summarize(events.slice(-20)), url: './#diario' });
  let ok = 0;
  for (const sub of subscriptions) {
    try {
      await wp.sendNotification(sub, payload, { TTL: 3600 });
      ok++;
    } catch (e) {
      console.warn(`[push] fallo (${e.statusCode || e.message})`);
    }
  }
  return ok;
}
