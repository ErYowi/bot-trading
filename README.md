# ONYX: simulador de bot de trading cripto 24/7

Bots que operan **con dinero simulado y precios reales** las 24 horas, y una app para el móvil donde ver cómo van.

## Cómo funciona
- **Motor** (`engine/`): GitHub Actions lo ejecuta cada ~5 minutos. Descarga velas reales de 15 min (Kraken, con Coinbase de respaldo), avanza cada bot y guarda el resultado en la rama `data`.
- **App** (`docs/`): web instalable (PWA) publicada con GitHub Pages. Se añade a la pantalla de inicio desde Safari.
- **Varios bots a la vez**, cada uno con su dinero, estrategia y riesgo (`config/bots.json`, editable desde la app).
- **Aprende**: tras cada operación ajusta cuánto se fía de cada señal (tendencia, momentum, RSI, rupturas, volumen), de cada moneda y de su umbral de entrada. Todo queda en el Diario.
- **Realista**: 0,1 % de comisión + 0,05 % de deslizamiento por orden, orden mínima de 5 €, stops ejecutados con el mínimo real de la vela.

## Puesta en marcha
1. Sube este proyecto a un repositorio **público** (Actions es gratis en repos públicos).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `docs`.
3. Settings → Actions → General → Workflow permissions: *Read and write*.
4. Actions → "ONYX bot 24/7" → *Run workflow* (o espera 5 min).
5. Abre `https://TU_USUARIO.github.io/bot-trading/` en Safari → Compartir → *Añadir a pantalla de inicio*.
6. (Opcional) En Ajustes de la app pega un token *fine-grained* con permiso **Contents: Read and write** solo para este repo, para crear bots y activar notificaciones desde el móvil.

## Probar en local
```bash
npm install
npm test            # simula 6 días con precios sintéticos
node engine/run.js  # un ciclo real (necesita internet)
```
Abre `docs/index.html?demo=1` con un servidor local para ver la demo.

## Futuro: modo real (18+)
La estrategia no sabe si el exchange es real o simulado (`engine/exchanges/`). Para operar en real habrá que implementar `binance.js`, usar una API key solo con permiso de trading guardada como secreto, y ejecutar el motor en un servidor europeo. Antes, semanas de simulación.

> Aviso: es una herramienta educativa. Resultados pasados o simulados no garantizan resultados futuros.
