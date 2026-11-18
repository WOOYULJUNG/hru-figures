// Shared helpers for the HRU figures (2026-11-18). Plain ES5 so node can syntax-check it.
var HRU = (function () {
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  // energy of the pattern term with per-pattern scores s and an optional linear tilt b (2-D points)
  function energy2(c, XI, beta, s, tilt) {
    var m = -Infinity, z = [], k;
    for (k = 0; k < XI.length; k++) {
      var dx = c[0] - XI[k][0], dy = c[1] - XI[k][1];
      z.push(-beta * (dx * dx + dy * dy) + (s ? s[k] : 0)); if (z[k] > m) m = z[k];
    }
    var sum = 0; for (k = 0; k < z.length; k++) sum += Math.exp(z[k] - m);
    return -(m + Math.log(sum)) / (2 * beta) - (tilt ? tilt[0] * c[0] + tilt[1] * c[1] : 0);
  }
  function weights2(c, XI, beta, s) {
    var z = [], m = -Infinity, k;
    for (k = 0; k < XI.length; k++) {
      var dx = c[0] - XI[k][0], dy = c[1] - XI[k][1];
      z.push(-beta * (dx * dx + dy * dy) + (s ? s[k] : 0)); if (z[k] > m) m = z[k];
    }
    var w = z.map(function (v) { return Math.exp(v - m); }), tot = w.reduce(function (a, b) { return a + b; }, 0);
    return w.map(function (v) { return v / tot; });
  }
  function target2(c, XI, beta, s) {
    var w = weights2(c, XI, beta, s), y = [0, 0];
    for (var k = 0; k < XI.length; k++) { y[0] += w[k] * XI[k][0]; y[1] += w[k] * XI[k][1]; }
    return y;
  }
  // canvas set-up in CSS pixels; world window [x0, x1] x [y0, y1] mapped to a W x H box
  function prep(cv, aspect) {
    var dpr = window.devicePixelRatio || 1, W = cv.getBoundingClientRect().width || 320, H = W * (aspect || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + "px";
    var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, W: W, H: H };
  }
  function view(W, H, box) {
    return { X: function (x) { return (x - box[0]) / (box[1] - box[0]) * W; }, Y: function (y) { return (box[3] - y) / (box[3] - box[2]) * H; } };
  }
  // banded heat map of f over the window (lower = darker blue)
  function heat(ctx, W, H, box, f, N) {
    N = N || 110;
    var M = Math.round(N * H / W), E = new Float64Array(N * M), i, j;
    for (j = 0; j < M; j++) for (i = 0; i < N; i++)
      E[j * N + i] = f([box[0] + (box[1] - box[0]) * i / (N - 1), box[3] - (box[3] - box[2]) * j / (M - 1)]);
    var srt = Array.prototype.slice.call(E).sort(function (a, b) { return a - b; });
    var lo = srt[0], hi = srt[Math.floor(0.85 * srt.length)], cL = hex(css("--map-lo")), cH = hex(css("--map-hi"));
    var off = document.createElement("canvas"); off.width = N; off.height = M;
    var o = off.getContext("2d"), img = o.createImageData(N, M);
    for (i = 0; i < N * M; i++) {
      var t = Math.min(1, Math.max(0, (E[i] - lo) / (hi - lo))); t = Math.floor(t * 14) / 14;
      for (var ch = 0; ch < 3; ch++) img.data[4 * i + ch] = Math.round(cL[ch] * (1 - t) + cH[ch] * t);
      img.data[4 * i + 3] = 255;
    }
    o.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, W, H);
  }
  function dot(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function cross(ctx, x, y, r, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x - r, y + r); ctx.lineTo(x + r, y - r); ctx.stroke(); ctx.restore();
  }
  function text(ctx, s, x, y, color, size, weight) {
    ctx.save(); ctx.fillStyle = color; ctx.font = (weight || 500) + " " + (size || 13) + "px " + getComputedStyle(document.body).fontFamily;
    ctx.fillText(s, x, y); ctx.restore();
  }
  function seg(el, items, cur, onPick) {
    el.innerHTML = "";
    items.forEach(function (it) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = it.n; b.id = el.id + "-" + it.k;
      b.setAttribute("aria-pressed", it.k === cur ? "true" : "false");
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(el.children, function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true"); onPick(it.k);
      });
      el.appendChild(b);
    });
  }
  function onResize(f) {
    var t = null;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(f, 80); });
    if (window.matchMedia) { var mq = window.matchMedia("(prefers-color-scheme: dark)"); if (mq.addEventListener) mq.addEventListener("change", f); }
  }
  return { css: css, energy2: energy2, weights2: weights2, target2: target2, prep: prep, view: view, heat: heat,
           dot: dot, cross: cross, text: text, seg: seg, onResize: onResize };
})();
if (typeof module !== "undefined") module.exports = HRU;
