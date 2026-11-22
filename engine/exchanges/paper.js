// Exchange simulado ("paper trading"). Misma interfaz que tendrá el exchange real:
//   buy({ coin, eur, price })  -> { qty, price, fee }
//   sell({ coin, qty, price }) -> { eur, price, fee }
// Aplica comisión y deslizamiento para que los resultados sean realistas.
import { FEE_RATE, SLIPPAGE } from '../config.js';

export const paperExchange = {
  name: 'paper',
  live: false,
  buy({ eur, price }) {
    const fill = price * (1 + SLIPPAGE);
    const fee = eur * FEE_RATE;
    const qty = (eur - fee) / fill;
    return { qty, price: fill, fee };
  },
  sell({ qty, price }) {
    const fill = price * (1 - SLIPPAGE);
    const gross = qty * fill;
    const fee = gross * FEE_RATE;
    return { eur: gross - fee, price: fill, fee };
  },
};
