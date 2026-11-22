// Conector para Binance (FUTURO, desactivado).
//
// El motor está preparado para cambiar el exchange simulado por uno real
// sin tocar la estrategia: solo hay que implementar buy() y sell() con la
// misma interfaz que exchanges/paper.js.
//
// Requisitos antes de activarlo:
//   1. Ser mayor de edad y tener cuenta verificada en el exchange.
//   2. Crear una API key SOLO con permiso de "Spot trading" (nunca retiradas).
//   3. Guardar la clave como secreto de GitHub (BINANCE_KEY / BINANCE_SECRET),
//      jamás dentro del código.
//   4. Haber probado la estrategia en simulación varias semanas.
//
// Ojo: los servidores de GitHub Actions están en EE. UU. y la API de
// binance.com puede rechazar esas IPs, así que para operar en real hará falta
// otro servidor (por ejemplo un VPS en Europa). Lo vemos cuando toque.

export const binanceExchange = {
  name: 'binance',
  live: true,
  buy() {
    throw new Error('Modo real desactivado: ONYX solo funciona como simulador por ahora.');
  },
  sell() {
    throw new Error('Modo real desactivado: ONYX solo funciona como simulador por ahora.');
  },
};
