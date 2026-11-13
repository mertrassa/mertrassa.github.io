/* ffmeta in the browser.
   A port of analysis/ffmeta_mc.py (the Monte Carlo model of the chip) and of the
   tail fit in analysis/ffmeta_fit.py from github.com/mertrassa/tt-ffmeta.
   It models counting statistics only, exactly like the Python model. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var plot = $('#mtPlot');
  if (!plot) return;

  // Fixed parameters, the defaults of ffmeta_mc.py.
  var F_CLK = 125e6, F_DATA = 49e6, T_CQ = 380, DK = 93, DJ = 109, MISMATCH = 8, MIN_EVENTS = 2000;
  var H = 1 / (2 * F_DATA) * 1e12;   // data half period [ps]
  var T = 1 / F_CLK * 1e12;          // clock period [ps]
  var GATES = [0.01, 0.1, 1, 10];

  var last = null;

  /* ── random numbers ── */
  function normal() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function binomial(n, p) {
    var mean = n * p;
    if (mean < 30) {                       // Poisson limit, Knuth's method
      var L = Math.exp(-mean), k = 0, q = 1;
      do { k++; q *= Math.random(); } while (q > L);
      return Math.min(n, k - 1);
    }
    var x = Math.round(mean + Math.sqrt(mean * (1 - p)) * normal());
    return Math.max(0, Math.min(n, x));
  }

  /* ── the experiment: 8 vernier taps × 32 coarse taps ── */
  function measure(tau, tw, maxGate) {
    var offK = [], offJ = [], pts = [], j, k;
    for (k = 0; k < 32; k++) offK.push(normal() * MISMATCH);
    for (j = 0; j < 8; j++) offJ.push(normal() * MISMATCH);
    for (j = 0; j < 8; j++) {
      for (k = 0; k < 32; k++) {
        var t = k * DK + offK[k] - j * DJ - offJ[j];
        if (!(t > -0.2 * T && t < 0.45 * T)) continue;
        var p = t <= T_CQ ? T / H : tw / H * Math.exp(-(t - T_CQ) / tau);
        var gate = 0.01, nCyc, nMeta;
        for (;;) {                          // adaptive gate, as the host firmware does
          nCyc = Math.floor(F_CLK * gate);
          nMeta = binomial(nCyc, Math.min(p, 1));
          if (nMeta >= MIN_EVENTS || gate >= maxGate) break;
          gate = Math.min(gate * 10, maxGate);
        }
        // The chip measures its own delay: twin samplers disagree with probability |t| / H.
        var nCal = binomial(nCyc, Math.min(Math.abs(t) / H, 1));
        var tMeasured = (t < 0 ? -1 : 1) * H * nCal / nCyc;
        pts.push({ t: tMeasured, n: nMeta, N: nCyc, y: H * nMeta / nCyc });
      }
    }
    return pts;
  }

  /* ── Poisson regression of the tail: E[n] = N · exp(a + b·t) ── */
  function fit(pts) {
    var tail = pts.filter(function (p) { return p.y < T / 10 && p.t > 0; });
    if (tail.length < 4) return null;
    var knee = Math.min.apply(null, tail.map(function (p) { return p.t; }));
    var use = tail.filter(function (p) { return p.t > knee + 20; });
    if (use.length < 4) return null;
    var t0 = use.reduce(function (s, p) { return s + p.t; }, 0) / use.length;
    // start from a weighted straight line through log rate
    var sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    use.forEach(function (p) {
      if (!p.n) return;
      var w = p.n, x = p.t - t0, y = Math.log(p.n / p.N);
      sw += w; sx += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y;
    });
    if (!sw) return null;
    var b = (sw * sxy - sx * sy) / (sw * sxx - sx * sx), a = (sy - b * sx) / sw;
    var h00, h01, h11;
    for (var it = 0; it < 25; it++) {       // Newton steps to the exact Poisson maximum
      var g0 = 0, g1 = 0; h00 = 0; h01 = 0; h11 = 0;
      use.forEach(function (p) {
        var x = p.t - t0, mu = p.N * Math.exp(a + b * x);
        g0 += p.n - mu; g1 += (p.n - mu) * x;
        h00 += mu; h01 += mu * x; h11 += mu * x * x;
      });
      var det = h00 * h11 - h01 * h01;
      if (!(det > 0)) return null;
      var da = (h11 * g0 - h01 * g1) / det, db = (h00 * g1 - h01 * g0) / det;
      a += da; b += db;
      if (Math.abs(da) < 1e-10 && Math.abs(db) < 1e-12) break;
    }
    if (!(b < 0)) return null;
    var seB = Math.sqrt(h00 / (h00 * h11 - h01 * h01));
    var ys = use.filter(function (p) { return p.n > 0; }).map(function (p) { return p.y; });
    return {
      tau: -1 / b, seTau: seB / (b * b), knee: knee, t0: t0, a: a, b: b,
      twTcq: H * Math.exp(a + b * (T_CQ - t0)),  // referred to the clock-to-output delay, as the model defines T_w
      tw0: H * Math.exp(a - b * t0),          // extrapolated to t = 0, the textbook convention
      decades: Math.log(Math.max.apply(null, ys) / Math.min.apply(null, ys)) / Math.LN10,
      rate: function (t) { return H * Math.exp(a + b * (t - t0)); },
      tMax: Math.max.apply(null, use.map(function (p) { return p.t; }))
    };
  }
  window.FFMeta = { measure: measure, fit: fit };

  /* ── drawing ── */
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function draw(pts, f) {
    var W = 640, Hh = 380, m = { l: 58, r: 16, t: 16, b: 44 };
    var positive = pts.filter(function (p) { return p.n > 0; });
    var x0 = -1000, x1 = Math.max(2000, 500 * Math.ceil(Math.max.apply(null, positive.map(function (p) { return p.t; })) / 500));
    var yLo = Math.floor(Math.log(Math.min.apply(null, positive.map(function (p) { return p.y; }))) / Math.LN10);
    var yHi = 4;
    yLo = Math.min(yLo, -2);
    var X = function (t) { return m.l + (t - x0) / (x1 - x0) * (W - m.l - m.r); };
    var Y = function (y) { return m.t + (yHi - Math.log(y) / Math.LN10) / (yHi - yLo) * (Hh - m.t - m.b); };
    plot.textContent = '';
    var step = (yHi - yLo) > 8 ? 2 : 1, d, t;
    for (d = yHi; d >= yLo; d -= step) {
      plot.appendChild(s('line', { class: 'grid', x1: m.l, x2: W - m.r, y1: Y(Math.pow(10, d)), y2: Y(Math.pow(10, d)) }));
      var lab = s('text', { x: m.l - 8, y: Y(Math.pow(10, d)) + 4, 'text-anchor': 'end' });
      lab.appendChild(document.createTextNode('10'));
      var sup = s('tspan', { dy: -5, 'font-size': 8 }, String(d).replace('-', '−'));
      lab.appendChild(sup);
      plot.appendChild(lab);
    }
    for (t = x0; t <= x1; t += 500) {
      plot.appendChild(s('line', { class: 'grid', x1: X(t), x2: X(t), y1: m.t, y2: Hh - m.b }));
      plot.appendChild(s('text', { x: X(t), y: Hh - m.b + 16, 'text-anchor': 'middle' }, String(t).replace('-', '−')));
    }
    plot.appendChild(s('text', { x: (m.l + W - m.r) / 2, y: Hh - 8, 'text-anchor': 'middle' }, 'sampling delay t, as measured by the chip (ps)'));
    plot.appendChild(s('text', { x: 14, y: (m.t + Hh - m.b) / 2, 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (m.t + Hh - m.b) / 2 + ')' }, 'late transitions, as a time window (ps)'));
    if (f) {
      plot.appendChild(s('line', { class: 'knee', x1: X(f.knee), x2: X(f.knee), y1: m.t, y2: Hh - m.b }));
      plot.appendChild(s('text', { x: X(f.knee) + 6, y: m.t + 12 }, 'knee'));
    }
    positive.forEach(function (p) {
      if (p.t < x0 || p.t > x1) return;
      plot.appendChild(s('circle', { class: 'pt' + (p.y >= T / 10 ? ' pt--plateau' : ''), cx: X(p.t).toFixed(1), cy: Y(p.y).toFixed(1), r: 2.6 }));
    });
    if (f) {
      var ta = f.knee, tb = Math.min(x1, f.tMax + 60);
      var yb = Math.max(f.rate(tb), Math.pow(10, yLo));
      tb = f.t0 + (Math.log(yb / H) - f.a) / f.b;
      plot.appendChild(s('path', { class: 'fit', d: 'M' + X(ta).toFixed(1) + ' ' + Y(f.rate(ta)).toFixed(1) + ' L' + X(tb).toFixed(1) + ' ' + Y(yb).toFixed(1) }));
    }
  }

  /* ── readouts ── */
  function readout(label, value, note) {
    var d = document.createElement('div');
    var a = document.createElement('span'); a.textContent = label;
    var b = document.createElement('b'); b.textContent = value;
    var c = document.createElement('small'); c.textContent = note;
    d.appendChild(a); d.appendChild(b); d.appendChild(c);
    return d;
  }
  function fmtGate(g) { return g >= 1 ? g + ' s' : g * 1000 + ' ms'; }
  function human(seconds) {
    var Y = 365.25 * 86400, UNIVERSE = 13.8e9;
    if (seconds < 1e-3) return (seconds * 1e6).toPrecision(2) + ' microseconds';
    if (seconds < 1) return (seconds * 1e3).toPrecision(2) + ' milliseconds';
    if (seconds < 90) return seconds.toPrecision(2) + ' seconds';
    if (seconds < 5400) return (seconds / 60).toPrecision(2) + ' minutes';
    if (seconds < 172800) return (seconds / 3600).toPrecision(2) + ' hours';
    if (seconds < Y) return Math.round(seconds / 86400) + ' days';
    var years = seconds / Y;
    if (years < 1e4) return (years < 100 ? years.toPrecision(2) : Math.round(years).toLocaleString('en-CA')) + ' years';
    if (years < UNIVERSE) return years < 1e6 ? Math.round(years / 1e3).toLocaleString('en-CA') + ' thousand years'
      : years < 1e9 ? (years / 1e6).toPrecision(2) + ' million years' : (years / 1e9).toPrecision(2) + ' billion years';
    var times = years / UNIVERSE;
    return (times < 1e6 ? Math.round(times).toLocaleString('en-CA') : times.toExponential(1).replace('e+', ' × 10^')) + ' times the age of the universe';
  }
  function mtbf() {
    var out = $('#mtMtbf'), ts = +$('#mtSettle').value;
    $('#mtSettleOut').textContent = ts.toFixed(1) + ' ns';
    if (!last || !last.fit) { out.textContent = 'Run a measurement first.'; return; }
    var f = last.fit;
    var seconds = Math.exp(ts * 1000 / f.tau) / (f.tw0 * 1e-12 * 100e6 * 1e6);
    out.textContent = '';
    out.appendChild(document.createTextNode('One failure every ' + human(seconds)));
    var small = document.createElement('small');
    small.textContent = 'MTBF = exp(t / τ) / (T_w · f_clk · f_data), using the fitted τ = ' + f.tau.toFixed(1) + ' ps';
    out.appendChild(small);
  }

  function run() {
    var tau = +$('#mtTau').value, tw = +$('#mtTw').value, gate = GATES[+$('#mtGate').value];
    var pts = measure(tau, tw, gate), f = fit(pts);
    last = { pts: pts, fit: f, tau: tau };
    draw(pts, f);
    var box = $('#mtRead');
    box.textContent = '';
    if (!f) {
      box.appendChild(readout('Fit', 'not enough events', 'Use a longer gate so the tail collects counts.'));
    } else {
      var off = Math.abs(f.tau - tau) / f.seTau;
      box.appendChild(readout('Fitted τ', f.tau.toFixed(f.seTau < 0.1 ? 2 : 1) + ' ± ' + f.seTau.toFixed(f.seTau < 0.1 ? 2 : 1) + ' ps',
        'true value ' + tau + ' ps, ' + (off < 0.05 ? 'spot on' : off.toFixed(1) + ' standard errors away')));
      box.appendChild(readout('Fitted window', f.twTcq.toFixed(1) + ' ps', 'true value ' + tw + ' ps, at the ' + T_CQ + ' ps clock-to-output delay'));
      box.appendChild(readout('Tail observed', f.decades.toFixed(1) + ' decades', 'more gate time reaches further down'));
    }
    mtbf();
  }

  function labels() {
    $('#mtTauOut').textContent = $('#mtTau').value + ' ps';
    $('#mtTwOut').textContent = $('#mtTw').value + ' ps';
    $('#mtGateOut').textContent = fmtGate(GATES[+$('#mtGate').value]);
  }
  ['#mtTau', '#mtTw', '#mtGate'].forEach(function (id) {
    $(id).addEventListener('input', labels);
    $(id).addEventListener('change', run);
  });
  $('#mtSettle').addEventListener('input', mtbf);
  $('#mtRun').addEventListener('click', run);
  labels();
  run();
})();
