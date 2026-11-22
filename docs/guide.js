// Contenido de la guía (botón "?"). Cada pantalla muestra primero sus temas.
window.GUIDE = {
  topics: {
    inicio: {
      title: 'Qué ves en Inicio',
      html: `<p>El número grande es el <b>dinero total simulado</b> de todos tus bots juntos, con los precios del momento. Debajo, lo que llevas ganado o perdido desde el principio y en las últimas 24 horas.</p>
      <p>La gráfica dorada es la evolución de tus bots. La línea discontinua gris es lo que tendrías si hubieras comprado Bitcoin con el mismo dinero y no lo hubieras tocado. Toca y arrastra sobre la gráfica para ver el valor en cada momento.</p>`,
    },
    vsbtc: {
      title: 'Bots contra "mantener BTC"',
      html: `<p>Es la prueba de fuego. Si los bots no ganan a simplemente comprar Bitcoin y esperar, no merecen la pena. La barra muestra quién va por delante y por cuánto.</p>
      <p>En mercados que suben fuerte, mantener BTC suele ganar. Los bots tienden a defenderse mejor cuando el mercado cae, porque salen con el stop-loss.</p>`,
    },
    bots: {
      title: 'Qué es cada bot',
      html: `<p>Cada bot es un simulador independiente: tiene su propio dinero, su estrategia, su nivel de riesgo y su propio aprendizaje. Corren todos a la vez, 24 horas al día, con los mismos precios reales.</p>
      <p>Así puedes comparar qué forma de operar funciona mejor sin arriesgar nada.</p>`,
    },
    riesgos: {
      title: 'Niveles de riesgo',
      html: `<p><b>Rápido.</b> Decide cada 5 minutos con velas de 5 min (los demás, cada 15). Objetivos y stops más cortos, pausa mínima entre operaciones y como mucho 8 h por operación. Aun así exige que al menos 2 señales estén de acuerdo antes de comprar.</p>
      <p><b>Equilibrado.</b> Término medio: hasta 3 posiciones, cada una con un 25 % del dinero.</p>
      <p><b>Calmado.</b> Solo entra cuando 3 señales coinciden y la puntuación es alta. Pocas operaciones, deja correr más los beneficios y espera más entre operaciones.</p>
      <p>Más operaciones no significa más beneficio: cada orden paga comisión, y eso se nota.</p>`,
    },
    estrategias: {
      title: 'Estrategias',
      html: `<p><b>IA adaptativa.</b> Empieza confiando igual en todas las señales y va ajustando sola según lo que le funciona.</p>
      <p><b>Tendencia.</b> "Súbete al tren que ya va en marcha". Compra criptos que llevan horas subiendo con fuerza, porque lo que sube suele seguir subiendo un rato.</p>
      <p><b>Rebotes.</b> "Compra en rebajas". Espera a que una cripto caiga demasiado rápido (RSI bajo) y compra pensando que rebotará. Opera poco, porque esas caídas bruscas no pasan cada día.</p>
      <p><b>Rupturas.</b> "Salta cuando rompe el techo". Si el precio supera su máximo de las últimas horas con mucho volumen, compra esperando un empujón fuerte.</p>
      <p>Todas aprenden: con el tiempo sus pesos cambian según los resultados.</p>`,
    },
    senales: {
      title: 'Las 5 señales',
      html: `<p><b>Tendencia (EMA 20/50):</b> compara la media de las últimas 5 h con la de 12,5 h. Si la corta está por encima, hay tendencia alcista.</p>
      <p><b>Momentum (4h):</b> cuánto ha subido o bajado el precio en las últimas 4 horas.</p>
      <p><b>Rebote (RSI):</b> el RSI va de 0 a 100. Por debajo de 35 está "sobrevendido" (posible rebote); por encima de 70, "sobrecomprado".</p>
      <p><b>Ruptura:</b> si el precio supera el máximo de las últimas 5 horas.</p>
      <p><b>Volumen:</b> si se está negociando mucho más de lo normal, confirma el movimiento.</p>
      <p>Cada señal da una nota entre −1 y +1. El bot las combina según sus pesos y compra si la puntuación supera su umbral.</p>`,
    },
    aprendizaje: {
      title: 'Cómo aprende',
      html: `<p>Cada vez que cierra una operación, el bot mira qué señales le animaron a comprar:</p>
      <p>Si ganó, <b>sube el peso</b> de esas señales. Si perdió, <b>lo baja</b>. También ajusta su <b>confianza en cada moneda</b> (de 0,5 a 1,5) y, cada 10 operaciones, su <b>umbral</b>: si falla mucho se vuelve más exigente, si acierta se atreve un poco más.</p>
      <p>Es un aprendizaje sencillo y transparente: todo queda escrito en Diario, Aprendizaje. No es magia y no garantiza ganar.</p>`,
    },
    posiciones: {
      title: 'Posiciones abiertas',
      html: `<p>Son compras que el bot todavía no ha vendido. El resultado se actualiza en directo con el precio real.</p>
      <p><b>Stop:</b> si el precio baja hasta ahí, vende para cortar pérdidas. Si la operación va bien, el stop sube solo para proteger el beneficio (trailing stop).</p>
      <p><b>Objetivo:</b> si el precio llega ahí, vende y se lleva el beneficio.</p>
      <p>También vende si las señales se vuelven bajistas o si pasa el tiempo máximo sin llegar a ninguno de los dos.</p>`,
    },
    estadisticas: {
      title: 'Estadísticas explicadas',
      html: `<p><b>Acierto:</b> porcentaje de operaciones cerradas con beneficio. Un 60 % puede perder dinero si las pérdidas son más grandes que las ganancias.</p>
      <p><b>Factor de beneficio:</b> todo lo ganado dividido entre todo lo perdido. Por encima de 1 gana dinero; por encima de 1,5 es bueno.</p>
      <p><b>Mayor caída:</b> la peor bajada desde un máximo. Mide cuánto "sufre" el bot.</p>
      <p><b>Contra mantener BTC:</b> diferencia entre el bot y comprar Bitcoin y no tocarlo.</p>
      <p><b>Comisiones pagadas:</b> lo que se habría llevado el exchange. Con muchas operaciones, pesa bastante.</p>`,
    },
    radar: {
      title: 'Radar: cuándo va a comprar',
      html: `<p>Cada bot puntúa todas las criptos en cada vela. El radar te enseña las que tiene más cerca de comprar: al 100 % llega a su umbral.</p>
      <p>Para comprar necesita las dos cosas: superar el umbral <b>y</b> que haya suficientes señales a favor (2 o 3 según el riesgo). Si pone "en pausa", acaba de vender esa moneda y espera un poco antes de volver.</p>`,
    },
    cuando: {
      title: '¿Cuándo operan y cuándo ganan o pierden?',
      html: `<p><b>Compran</b> solo cuando las señales son claras. En un mercado tranquilo pueden pasar horas sin operar; la IA Calmada y Rebotes, incluso días. No operar también es una decisión: evita perder dinero en comisiones.</p>
      <p><b>Ganan o pierden</b> al vender: cuando el precio toca el objetivo (ganancia), el stop (pérdida), cuando las señales se vuelven bajistas o al pasar el tiempo máximo. Mientras la posición está abierta, el resultado se mueve en directo.</p>
      <p>Para sacar conclusiones hacen falta semanas y decenas de operaciones, no un día.</p>`,
    },
    ranking: {
      title: 'Ranking',
      html: `<p>Ordena los bots por rentabilidad desde que empezaron. Ojo: un bot creado ayer y otro de hace un mes no son comparables del todo. Mira también la mayor caída y el número de operaciones.</p>`,
    },
    plantillas: {
      title: 'Plantillas y duplicar',
      html: `<p>Al crear un bot puedes partir de una <b>plantilla</b> ya configurada y cambiar lo que quieras.</p>
      <p>En la pantalla de un bot, <b>Editar</b> y luego <b>Duplicar</b> crea una copia para cambiarle una sola cosa (por ejemplo, el riesgo) y comparar cuál funciona mejor.</p>
      <p>Cambiar el dinero inicial o la estrategia de un bot lo reinicia desde cero.</p>`,
    },
    mercado: {
      title: 'Mercado',
      html: `<p>Las 10 criptos que vigilan los bots, con su precio en directo (Kraken), la variación de las últimas 24 horas y su RSI.</p>
      <p>Toca una para ver su gráfica de 24 h, máximos y mínimos y qué bots la tienen comprada ahora.</p>`,
    },
    diario: {
      title: 'Diario',
      html: `<p><b>Operaciones:</b> todas las ventas de todos los bots. Toca una para ver por qué compró, por qué vendió, comisiones y duración.</p>
      <p><b>Aprendizaje:</b> lo que cada bot ha cambiado de su forma de pensar tras cada operación.</p>`,
    },
    realismo: {
      title: '¿Es realista la simulación?',
      html: `<p>Usa precios reales de Kraken en velas de 15 minutos. Cada orden paga un 0,1 % de comisión y un 0,05 % de deslizamiento. Los stops se ejecutan con el mínimo real de la vela, y si el precio abre por debajo, se vende peor (como en la realidad).</p>
      <p>Lo que no simula: retrasos de red, libros de órdenes con poco volumen ni caídas del exchange. Por eso los resultados reales suelen ser algo peores.</p>
      <p>El motor se ejecuta cada ~5 minutos en GitHub. Si GitHub se retrasa, el bot recupera las velas que se perdió.</p>`,
    },
    personalizar: {
      title: 'Personalizar la app',
      html: `<p>En Ajustes puedes cambiar el color principal y el fondo (con colores ya hechos o uno libre), los colores de subidas y bajadas, la tipografía, cómo se ven las gráficas, ocultar las cantidades, la pantalla al abrir y las animaciones.</p>
      <p>Todo se guarda solo en este móvil.</p>`,
    },
    github: {
      title: 'Conexión con GitHub',
      html: `<p>La app lee los resultados del motor desde tu repositorio. Sin token funciona en modo lectura.</p>
      <p>Con un token <b>fine-grained</b> (solo ese repositorio, permiso Contents de lectura y escritura) puedes crear, editar y borrar bots y activar notificaciones desde el móvil. El token se guarda únicamente en este dispositivo.</p>`,
    },
    notificaciones: {
      title: 'Notificaciones',
      html: `<p>En iPhone necesitan iOS 16.4 o superior y que abras ONYX desde el icono de la pantalla de inicio. Pulsa Activar y acepta el permiso.</p>
      <p>Puedes elegir si avisar de compras, de ventas o de ambas.</p>`,
    },
  },
  context: {
    inicio: ['inicio', 'cuando', 'vsbtc'],
    bots: ['bots', 'cuando', 'riesgos', 'estrategias', 'ranking', 'plantillas'],
    bot: ['radar', 'cuando', 'estadisticas', 'posiciones', 'aprendizaje', 'senales'],
    mercado: ['mercado', 'senales'],
    diario: ['diario', 'aprendizaje'],
    ajustes: ['personalizar', 'github', 'notificaciones'],
  },
};
