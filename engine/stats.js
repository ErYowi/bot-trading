// Estadísticas "pro" de cada bot.
export function computeStats(bot) {
  const h = bot.equityHistory;
  const last = h[h.length - 1];
  const now = last[0];
  const equity = last[1];
  const hodl = last[2];
  const trades = bot.trades;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = -losses.reduce((a, t) => a + t.pnl, 0);

  let peak = -Infinity, maxDD = 0;
  for (const [, eq] of h) {
    peak = Math.max(peak, eq);
    maxDD = Math.max(maxDD, (peak - eq) / peak);
  }

  const valueAgo = (secs) => {
    const target = now - secs;
    let v = h[0][1];
    for (const p of h) { if (p[0] <= target) v = p[1]; else break; }
    return v;
  };

  return {
    equity,
    pnl: equity - bot.capital,
    returnPct: (equity / bot.capital - 1) * 100,
    hodl,
    hodlPct: (hodl / bot.capital - 1) * 100,
    vsHodlPct: ((equity - hodl) / bot.capital) * 100,
    trades: trades.length,
    openPositions: bot.positions.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : wins.length ? null : null,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? -grossLoss / losses.length : 0,
    best: trades.length ? Math.max(...trades.map((t) => t.pnlPct)) : null,
    worst: trades.length ? Math.min(...trades.map((t) => t.pnlPct)) : null,
    maxDrawdownPct: maxDD * 100,
    avgHoldHours: trades.length ? trades.reduce((a, t) => a + (t.exitTime - t.entryTime), 0) / trades.length / 3600 : null,
    pnl24h: equity - valueAgo(86400),
    pnl7d: equity - valueAgo(7 * 86400),
    pnl30d: equity - valueAgo(30 * 86400),
    fees: bot.totalFees,
    runningDays: (now - bot.createdAt) / 86400,
  };
}
