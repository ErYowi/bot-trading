// Gráficas SVG ligeras, sin librerías. Soportan toque/arrastre para ver valores.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  let gid = 0;

  // series: [{ points: [[t, v], ...], color, width, fill, dash, label }]
  function lineChart(container, series, opts = {}) {
    const H = opts.height || 180;
    const W = Math.max(280, container.clientWidth || 340);
    container.innerHTML = '';
    container.classList.add('chart');
    const all = series.flatMap((s) => s.points);
    if (all.length < 2) {
      container.innerHTML = '<p class="muted small" style="padding:30px 0;text-align:center">Aún no hay datos suficientes para la gráfica.</p>';
      return;
    }
    const t0 = Math.min(...all.map((p) => p[0]));
    const t1 = Math.max(...all.map((p) => p[0]));
    let v0 = Math.min(...all.map((p) => p[1]));
    let v1 = Math.max(...all.map((p) => p[1]));
    if (opts.baseline != null) { v0 = Math.min(v0, opts.baseline); v1 = Math.max(v1, opts.baseline); }
    const pad = (v1 - v0) * 0.12 || Math.abs(v1) * 0.01 || 1;
    v0 -= pad; v1 += pad;
    const x = (t) => ((t - t0) / (t1 - t0 || 1)) * W;
    const y = (v) => H - ((v - v0) / (v1 - v0)) * H;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': opts.label || 'Gráfica' });
    if (opts.baseline != null) {
      svg.appendChild(el('line', { x1: 0, x2: W, y1: y(opts.baseline), y2: y(opts.baseline), stroke: 'rgba(255,255,255,0.12)', 'stroke-dasharray': '2 5' }));
    }
    for (const s of series) {
      if (s.points.length < 2) continue;
      const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
      if (s.fill) {
        const id = `g${++gid}`;
        const grad = el('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 });
        grad.appendChild(el('stop', { offset: '0%', 'stop-color': s.color, 'stop-opacity': 0.22 }));
        grad.appendChild(el('stop', { offset: '100%', 'stop-color': s.color, 'stop-opacity': 0 }));
        const defs = el('defs');
        defs.appendChild(grad);
        svg.appendChild(defs);
        const last = s.points[s.points.length - 1];
        svg.appendChild(el('path', { d: `${d}L${x(last[0])},${H}L${x(s.points[0][0])},${H}Z`, fill: `url(#${id})` }));
      }
      svg.appendChild(el('path', {
        d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 1.6,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dash || 'none',
        'vector-effect': 'non-scaling-stroke',
      }));
    }
    // punto final del primer trazo
    const main = series[0].points;
    if (main.length) {
      const lp = main[main.length - 1];
      svg.appendChild(el('circle', { cx: x(lp[0]), cy: y(lp[1]), r: 3.5, fill: series[0].color }));
    }

    // Interacción: cruz + etiqueta
    const cross = el('line', { y1: 0, y2: H, stroke: 'rgba(255,255,255,0.25)', visibility: 'hidden' });
    const dots = series.map((s) => el('circle', { r: 4, fill: s.color, visibility: 'hidden' }));
    svg.appendChild(cross);
    dots.forEach((d) => svg.appendChild(d));
    container.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.hidden = true;
    container.appendChild(tip);

    const fmtV = opts.format || ((v) => v.toFixed(2));
    const fmtT = opts.formatTime || ((t) => new Date(t * 1000).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
    const nearest = (pts, t) => {
      let lo = 0, hi = pts.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid][0] < t) lo = mid; else hi = mid; }
      return Math.abs(pts[lo][0] - t) < Math.abs(pts[hi][0] - t) ? pts[lo] : pts[hi];
    };
    const move = (clientX) => {
      const r = svg.getBoundingClientRect();
      const px = Math.max(0, Math.min(r.width, clientX - r.left));
      const t = t0 + (px / r.width) * (t1 - t0);
      const xs = (px / r.width) * W;
      cross.setAttribute('x1', xs); cross.setAttribute('x2', xs); cross.setAttribute('visibility', 'visible');
      const parts = [];
      series.forEach((s, i) => {
        if (!s.points.length) return;
        const p = nearest(s.points, t);
        dots[i].setAttribute('cx', x(p[0])); dots[i].setAttribute('cy', y(p[1])); dots[i].setAttribute('visibility', 'visible');
        parts.push(`${s.label ? s.label + ' ' : ''}<b>${fmtV(p[1])}</b>`);
      });
      tip.innerHTML = `${parts.join('&nbsp;&nbsp;')}<br><span class="muted">${fmtT(nearest(series[0].points, t)[0])}</span>`;
      tip.hidden = false;
      tip.style.left = `${Math.max(70, Math.min(r.width - 70, px))}px`;
    };
    const end = () => { cross.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); tip.hidden = true; };
    svg.addEventListener('pointerdown', (e) => move(e.clientX));
    svg.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) move(e.clientX); });
    svg.addEventListener('pointerleave', end);
    svg.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(end, 1400); });
  }

  function sparkline(values, color, w = 76, h = 28) {
    if (!values || values.length < 2) return '';
    const min = Math.min(...values), max = Math.max(...values);
    const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  window.Charts = { lineChart, sparkline };
})();
