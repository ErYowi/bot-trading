// Configuración global del motor ONYX.
// Todo lo que afecta al realismo de la simulación está aquí.

export const BASE_SECONDS = 300; // se descargan velas de 5 minutos (las de 15 min se construyen a partir de ellas)
export const CANDLE_SECONDS = 900; // marco temporal por defecto: 15 minutos

// Comisiones y deslizamiento (similares a un exchange spot tipo Binance/Kraken).
export const FEE_RATE = 0.001; // 0,1 % por operación (compra y venta)
export const SLIPPAGE = 0.0005; // 0,05 % de deslizamiento en cada orden
export const MIN_ORDER_EUR = 5; // orden mínima

// Las 10 criptos grandes (sin stablecoins) disponibles en Kraken/Coinbase en EUR.
export const COINS = {
  BTC: { name: 'Bitcoin', kraken: 'XBTEUR', coinbase: 'BTC-EUR', ws: 'BTC/EUR' },
  ETH: { name: 'Ethereum', kraken: 'ETHEUR', coinbase: 'ETH-EUR', ws: 'ETH/EUR' },
  XRP: { name: 'XRP', kraken: 'XRPEUR', coinbase: 'XRP-EUR', ws: 'XRP/EUR' },
  SOL: { name: 'Solana', kraken: 'SOLEUR', coinbase: 'SOL-EUR', ws: 'SOL/EUR' },
  DOGE: { name: 'Dogecoin', kraken: 'XDGEUR', coinbase: 'DOGE-EUR', ws: 'DOGE/EUR' },
  ADA: { name: 'Cardano', kraken: 'ADAEUR', coinbase: 'ADA-EUR', ws: 'ADA/EUR' },
  TRX: { name: 'TRON', kraken: 'TRXEUR', coinbase: null, ws: 'TRX/EUR' },
  LINK: { name: 'Chainlink', kraken: 'LINKEUR', coinbase: 'LINK-EUR', ws: 'LINK/EUR' },
  AVAX: { name: 'Avalanche', kraken: 'AVAXEUR', coinbase: 'AVAX-EUR', ws: 'AVAX/EUR' },
  DOT: { name: 'Polkadot', kraken: 'DOTEUR', coinbase: 'DOT-EUR', ws: 'DOT/EUR' },
};

// Perfiles de riesgo.
export const RISK = {
  // Calmado: pocas operaciones, solo entra con señales muy claras y las deja correr.
  conservador: { label: 'Calmado', timeframe: 900, maxPositions: 2, positionPct: 0.2, stopATR: 1.8, tpATR: 3.0, threshold: 0.45, maxHoldCandles: 288, cooldownCandles: 16, minHoldCandles: 8, minAgree: 3 },
  // Equilibrado: término medio.
  equilibrado: { label: 'Equilibrado', timeframe: 900, maxPositions: 3, positionPct: 0.25, stopATR: 2.0, tpATR: 3.0, threshold: 0.35, maxHoldCandles: 192, cooldownCandles: 8, minHoldCandles: 4, minAgree: 2 },
  // Rápido: decide cada 5 minutos con velas de 5 min, stops y objetivos más cortos y
  // operaciones de como mucho 8 h, pero exige que al menos 2 señales estén de acuerdo.
  agresivo: { label: 'Rápido', timeframe: 300, maxPositions: 4, positionPct: 0.22, stopATR: 1.8, tpATR: 2.6, threshold: 0.28, maxHoldCandles: 96, cooldownCandles: 3, minHoldCandles: 2, minAgree: 2 },
};

// Señales que usa el bot. Cada estrategia empieza con pesos distintos
// y luego los ajusta sola según lo que le funciona (aprendizaje).
export const SIGNALS = {
  tendencia: 'Tendencia (EMA 20/50)',
  momentum: 'Momentum (4h)',
  rebote: 'Rebote (RSI)',
  ruptura: 'Ruptura (máximos 5h)',
  volumen: 'Volumen',
};

export const STRATEGIES = {
  adaptativo: {
    label: 'IA adaptativa',
    weights: { tendencia: 0.2, momentum: 0.2, rebote: 0.2, ruptura: 0.2, volumen: 0.2 },
  },
  tendencia: {
    label: 'Seguidor de tendencia',
    weights: { tendencia: 0.4, momentum: 0.3, rebote: 0.05, ruptura: 0.15, volumen: 0.1 },
  },
  rebote: {
    label: 'Cazador de rebotes',
    weights: { tendencia: 0.1, momentum: 0.05, rebote: 0.55, ruptura: 0.05, volumen: 0.25 },
  },
  ruptura: {
    label: 'Rupturas',
    weights: { tendencia: 0.15, momentum: 0.2, rebote: 0.05, ruptura: 0.4, volumen: 0.2 },
  },
};

export const LEARNING_RATE = 0.15;
export const MIN_WEIGHT = 0.03;
export const MAX_TRADES_KEPT = 250;
export const MAX_JOURNAL = 250;
export const MAX_EQUITY_POINTS = 2000;
