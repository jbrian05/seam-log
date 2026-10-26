// Rough flat sketches of garments, redrawn with a project's changes.
// Each garment is a simple outline built from a few measurements (in inches, flat).
// A change like "Hem · shorten 2″" nudges those measurements, and the sketch shows
// the original outline dashed, the removed fabric hatched, and a label per change.
const Sketch = (() => {
  // Real alterations are small next to a whole garment, so draw them bigger than life.
  const EXAG_W = 3;
  const EXAG_L = 1.5;

  const KIND = {
    Pants: 'pants', Jeans: 'jeans', Shorts: 'shorts',
    Shirt: 'shirt', 'T-shirt': 'tee', Sweater: 'sweater', Jacket: 'jacket', Coat: 'coat',
    Skirt: 'skirt', Dress: 'dress',
  };
  const FAMILY = {
    pants: 'bottom', jeans: 'bottom', shorts: 'bottom',
    shirt: 'top', tee: 'top', sweater: 'top', jacket: 'top', coat: 'top',
    skirt: 'skirt', dress: 'dress',
  };
  // Generic flat measurements. thigh/knee/opening are leg widths; waist/hip/chest are across the front.
  const BASE = {
    pants: { waist: 16, hip: 20, thigh: 10, knee: 8, opening: 7, rise: 11, inseam: 31 },
    jeans: { waist: 16, hip: 20, thigh: 10, knee: 8, opening: 7.5, rise: 10.5, inseam: 31 },
    shorts: { waist: 16, hip: 20, thigh: 10, knee: 10, opening: 10.5, rise: 11, inseam: 8 },
    shirt: { shoulder: 18, chest: 21, waist: 20, hem: 21, length: 30, sleeve: 24, bicep: 7.5, cuff: 4.5, armhole: 9.5 },
    tee: { shoulder: 18, chest: 21, waist: 20.5, hem: 21, length: 28, sleeve: 8, bicep: 7.5, cuff: 6.5, armhole: 9 },
    sweater: { shoulder: 19, chest: 22, waist: 21, hem: 20, length: 27, sleeve: 25, bicep: 7.5, cuff: 4, armhole: 10 },
    jacket: { shoulder: 18.5, chest: 22, waist: 21, hem: 22, length: 30, sleeve: 25, bicep: 8, cuff: 5.5, armhole: 10 },
    coat: { shoulder: 19, chest: 23, waist: 22, hem: 25, length: 40, sleeve: 25.5, bicep: 8.5, cuff: 6, armhole: 10.5 },
    skirt: { waist: 14, hip: 19, hem: 22, length: 23 },
    dress: { shoulder: 13, chest: 17, waist: 14, hip: 19, hem: 24, length: 38 },
  };

  const LEN_SIGN = { shorten: -1, crop: -1, hem: -1, lengthen: 1 };
  const WID_SIGN = { take_in: -1, taper: -1, let_out: 1 };
  const SIGN = { ...LEN_SIGN, ...WID_SIGN, remove: -1, add: 1 };

  /* ---------- geometry helpers ---------- */
  const V = (x, y) => ({ x, y });
  const add = (a, b, k = 1) => V(a.x + b.x * k, a.y + b.y * k);
  const lerp = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const mir = (p) => V(-p.x, p.y);

  const fmtPt = (T, p) => `${T.x(p.x).toFixed(1)} ${T.y(p.y).toFixed(1)}`;
  const path = (T, cmds) => cmds.map(([op, ...ps]) => op + ps.map((p) => ' ' + fmtPt(T, p)).join('')).join(' ');
  const line = (T, ...pts) => path(T, pts.map((p, i) => [i ? 'L' : 'M', p]));
  const both = (T, ...pts) => line(T, ...pts) + ' ' + line(T, ...pts.map(mir));
  const circle = (T, c, r) => {
    const x = T.x(c.x), y = T.y(c.y), rr = (r * T.s).toFixed(1);
    return `M ${(x - r * T.s).toFixed(1)} ${y.toFixed(1)} a ${rr} ${rr} 0 1 0 ${(2 * r * T.s).toFixed(1)} 0 a ${rr} ${rr} 0 1 0 ${(-2 * r * T.s).toFixed(1)} 0`;
  };
  const seg = (s) => (s.c ? (s.c.length === 2 ? 'C' : 'Q') : 'L');

  // Outline that's mirror-symmetric: give the right half from `start` down to the centre line.
  function symmetric(T, start, segs, close = []) {
    const pts = [start, ...segs.map((s) => s.to)];
    const right = segs.map((s) => [seg(s), ...(s.c || []), s.to]);
    const left = segs.slice().reverse().map((s, i) => {
      const c = (s.c || []).slice().reverse().map(mir);
      return [c.length === 2 ? 'C' : c.length === 1 ? 'Q' : 'L', ...c, mir(pts[segs.length - i - 1])];
    });
    return path(T, [['M', start], ...right, ...left, ...close]) + ' Z';
  }

  /* ---------- garments ---------- */
  function bottom(p, T, kind) {
    const b = BASE[kind];
    const R = b.rise;
    const y0 = b.rise - p.rise; // a shorter rise drops the waistband; the crotch stays put
    const cx = 0.25 + b.thigh / 2; // centre line of each leg
    const W = p.waist / 2, H = p.hip / 2, L = p.inseam;
    const yHip = y0 + p.rise * 0.55, yKnee = R + L * 0.42, yHem = R + L;
    const crotchIn = V(Math.max(0.15, cx - p.thigh / 2), R);
    const crotchOut = V(crotchIn.x + p.thigh, R);
    const knee = V(cx + p.knee / 2, yKnee), hemOut = V(cx + p.opening / 2, yHem);
    const hemIn = V(cx - p.opening / 2, yHem), kneeIn = V(cx - p.knee / 2, yKnee);
    const fork = V(0, R - 1.3);
    const wb = 1.4;

    const d = symmetric(T, V(W, y0), [
      { to: V(H, yHip), c: [V(H, y0 + (yHip - y0) * 0.35)] },
      { to: crotchOut }, { to: knee }, { to: hemOut }, { to: hemIn }, { to: kneeIn }, { to: crotchIn },
      { to: fork, c: [V(crotchIn.x * 0.25, R - 0.15)] },
    ]);

    const details = [
      { d: line(T, V(-W - 0.1, y0 + wb), V(W + 0.1, y0 + wb)) },
      { d: line(T, V(0, y0 + wb), fork) },
      { d: path(T, [['M', V(-1.3, y0 + wb)], ['L', V(-1.3, y0 + p.rise * 0.48)], ['Q', V(-1.3, y0 + p.rise * 0.6), V(0, y0 + p.rise * 0.62)]]), cls: 'stitch' },
      { d: both(T, V(cx - p.opening / 2 + 0.15, yHem - 0.9), V(cx + p.opening / 2 - 0.15, yHem - 0.9)), cls: 'stitch' },
    ];
    const pocketEnd = lerp(V(W, y0), V(H, yHip), 0.6);
    const pocket = [['M', V(W - 3.4, y0 + wb)], ['Q', V(W - 3.2, pocketEnd.y - 0.4), pocketEnd]];
    details.push({ d: path(T, pocket) + ' ' + path(T, pocket.map(([op, ...ps]) => [op, ...ps.map(mir)])) });
    if (kind === 'jeans') {
      details.push({ d: line(T, V(W - 3, y0 + wb + 0.6), V(W - 1.5, y0 + wb + 0.6), V(W - 1.5, y0 + wb + 2.1), V(W - 3, y0 + wb + 2.1), V(W - 3, y0 + wb + 0.6)), cls: 'stitch' });
    }
    if (kind === 'pants') details.push({ d: both(T, V(cx, y0 + 5), V(cx, yHem - 0.2)), cls: 'faint' });
    for (const x of [W - 0.8, W * 0.38]) details.push({ d: both(T, V(x, y0 - 0.05), V(x, y0 + wb + 0.5)) });

    return {
      d, details,
      pts: [V(W, y0), V(H, yHip), crotchOut, knee, hemOut, V(0, Math.min(0, y0))],
      anchors: { waist: V(W, y0 + 0.7), hip: V(H, yHip), thigh: V(crotchOut.x, R + 0.8), knee, opening: V(hemOut.x, yHem - 0.6), inseam: hemOut, rise: V(W, y0) },
      spots: {
        zipper: V(-1.3, y0 + p.rise * 0.35), button: V(0, y0 + 0.7), waist: V(W - 1, y0 + 0.7), pocket: V(W - 2, y0 + 3.2),
        knee: V(cx, yKnee), crotch: fork, hem: V(cx, yHem - 0.5), center: V(cx, R + L * 0.25), back: V(-cx, R + L * 0.25),
      },
    };
  }

  function top(p, T, kind) {
    const b = BASE[kind];
    const nw = kind === 'jacket' || kind === 'coat' ? 3.8 : 3.5;
    const S = p.shoulder / 2, C = p.chest / 2, Wa = p.waist / 2, Hm = p.hem / 2, Len = p.length;
    const th = ((kind === 'tee' ? 34 : 50) * Math.PI) / 180;
    const u = V(Math.cos(th), Math.sin(th)), pv = V(-Math.sin(th), Math.cos(th));
    const sp = V(S, 1.5), ap = V(C, p.armhole);
    const cuffTop = add(sp, u, p.sleeve), cuffBot = add(cuffTop, pv, p.cuff);
    const mid = add(lerp(ap, cuffBot, 0.3), pv, p.bicep - b.bicep);
    const yW = Len * 0.58;
    const tail = kind === 'shirt' ? 1.8 : 0;
    const hemSide = V(Hm, Len - tail);

    const d = symmetric(T, V(nw, 0), [
      { to: sp }, { to: cuffTop }, { to: cuffBot }, { to: mid }, { to: ap },
      { to: V(Wa, yW), c: [V(C - (C - Wa) * 0.2, (p.armhole + yW) / 2)] },
      { to: hemSide },
      tail ? { to: V(0, Len), c: [V(Hm, Len - 0.2), V(Hm * 0.45, Len)] } : { to: V(0, Len) },
    ], [['Q', V(0, 0.9), V(nw, 0)]]);

    const along = (k) => [add(cuffTop, u, -k), add(cuffBot, u, -k)];
    const details = [];
    if (kind === 'shirt') {
      details.push({ d: line(T, V(-nw, 0), V(-1.4, 3.4), V(0, 2.3), V(1.4, 3.4), V(nw, 0)) });
      details.push({ d: line(T, V(0, 2.3), V(0, Len)) });
      details.push({ d: line(T, V(0.75, 2.8), V(0.75, Len - 0.1)), cls: 'stitch' });
      for (let y = 4.2; y < Len - 2; y += 3.3) details.push({ d: circle(T, V(0.38, y), 0.22) });
      details.push({ d: both(T, ...along(2.6)) });
      details.push({ d: line(T, V(3, 7.2), V(6.2, 7.2), V(6.2, 10.6), V(4.6, 11.2), V(3, 10.6), V(3, 7.2)) });
    } else if (kind === 'tee' || kind === 'sweater') {
      details.push({ d: path(T, [['M', V(-nw, 0)], ['Q', V(0, 5.6), V(nw, 0)]]) });
      details.push({ d: path(T, [['M', V(-nw - 0.45, 0.5)], ['Q', V(0, 6.9), V(nw + 0.45, 0.5)]]) });
      if (kind === 'tee') {
        details.push({ d: line(T, V(-Hm + 0.2, Len - 1), V(Hm - 0.2, Len - 1)), cls: 'stitch' });
        details.push({ d: both(T, ...along(1)), cls: 'stitch' });
      } else {
        details.push({ d: line(T, V(-Hm, Len - 2.2), V(Hm, Len - 2.2)) });
        for (let x = -Hm + 1; x < Hm; x += 1) details.push({ d: line(T, V(x, Len - 2), V(x, Len - 0.2)), cls: 'faint' });
        details.push({ d: both(T, ...along(2.4)) });
      }
    } else {
      const v = V(0.3, Len * 0.42);
      details.push({ d: both(T, V(nw, 0), V(4.3, 4.2), V(2.7, 5.2), V(3.5, 6.3), v) });
      details.push({ d: line(T, v, V(0.3, Len)) });
      const buttons = kind === 'coat' ? [0.47, 0.59, 0.71] : [0.52, 0.66];
      for (const k of buttons) details.push({ d: circle(T, V(-0.6, Len * k), 0.35) });
      details.push({ d: both(T, V(2.6, Len * 0.68), V(6.6, Len * 0.68), V(6.6, Len * 0.73), V(2.6, Len * 0.73), V(2.6, Len * 0.68)) });
      details.push({ d: line(T, V(3.4, 10), V(6.4, 9.6)) });
    }

    return {
      d, details,
      pts: [V(nw, 0), sp, cuffTop, cuffBot, ap, V(Wa, yW), hemSide, V(0, Len)],
      anchors: {
        chest: V(C, p.armhole + 0.6), waist: V(Wa, yW), hem: V(Hm, Len - tail - 0.6), length: hemSide,
        shoulder: sp, sleeve: lerp(cuffTop, cuffBot, 0.5), bicep: mid, cuff: cuffBot,
      },
      spots: {
        button: V(0.38, Len * 0.4), collar: V(0, 1.8), cuff: lerp(cuffTop, cuffBot, 0.5), pocket: V(4.6, 9),
        zipper: V(0, Len * 0.5), elbow: add(lerp(sp, mid, 0.5), u, p.sleeve * 0.25), shoulder: sp,
        hem: V(Hm * 0.5, Len - 0.8), back: V(-C * 0.5, Len * 0.5), center: V(C * 0.45, Len * 0.45), waist: V(Wa - 1, yW),
      },
    };
  }

  function skirt(p, T) {
    const W = p.waist / 2, H = p.hip / 2, Hm = p.hem / 2, L = p.length, yH = 7.5;
    const d = symmetric(T, V(W, 0), [
      { to: V(H, yH), c: [V(H, yH * 0.35)] },
      { to: V(Hm, L) },
      { to: V(0, L + 0.5), c: [V(Hm * 0.5, L + 0.5)] },
    ]);
    return {
      d,
      details: [
        { d: line(T, V(-W - 0.1, 1.4), V(W + 0.1, 1.4)) },
        { d: path(T, [['M', V(-Hm + 0.3, L - 0.6)], ['Q', V(0, L - 0.1), V(Hm - 0.3, L - 0.6)]]), cls: 'stitch' },
      ],
      pts: [V(W, 0), V(H, yH), V(Hm, L), V(0, L + 0.5)],
      anchors: { waist: V(W, 0.7), hip: V(H, yH), hem: V(Hm, L - 0.8), length: V(Hm, L) },
      spots: { zipper: V(W - 0.6, 3), waist: V(W - 1, 0.7), pocket: V(H - 2, 4), hem: V(Hm * 0.5, L - 0.4), center: V(H * 0.4, L * 0.5), back: V(-H * 0.4, L * 0.5) },
    };
  }

  function dress(p, T) {
    const nw = 2.8, S = p.shoulder / 2, C = p.chest / 2, Wa = p.waist / 2, H = p.hip / 2, Hm = p.hem / 2, L = p.length;
    const sp = V(S, 0.9), yA = 8, yW = 15, yH = 22;
    const d = symmetric(T, V(nw, 0), [
      { to: sp },
      { to: V(C, yA), c: [V(S - 1.4, 6.6)] },
      { to: V(Wa, yW), c: [V(C, 11.5)] },
      { to: V(H, yH), c: [V(Wa + (H - Wa) * 0.2, yW + 3)] },
      { to: V(Hm, L) },
      { to: V(0, L + 0.6), c: [V(Hm * 0.5, L + 0.6)] },
    ], [['Q', V(0, 0.8), V(nw, 0)]]);
    return {
      d,
      details: [
        { d: path(T, [['M', V(-nw, 0)], ['Q', V(0, 8.5), V(nw, 0)]]) },
        { d: line(T, V(-Wa, yW), V(Wa, yW)), cls: 'stitch' },
        { d: path(T, [['M', V(-Hm + 0.3, L - 0.6)], ['Q', V(0, L), V(Hm - 0.3, L - 0.6)]]), cls: 'stitch' },
      ],
      pts: [V(nw, 0), sp, V(C, yA), V(Wa, yW), V(H, yH), V(Hm, L), V(0, L + 0.6)],
      anchors: { shoulder: sp, chest: V(C, yA + 0.6), waist: V(Wa, yW), hip: V(H, yH), hem: V(Hm, L - 0.8), length: V(Hm, L) },
      spots: { zipper: V(0, 10), shoulder: sp, collar: V(0, 3), waist: V(Wa - 1, yW), hem: V(Hm * 0.5, L - 0.4), center: V(H * 0.4, 26), back: V(-H * 0.4, 26), pocket: V(H - 2, yH) },
    };
  }

  const SHAPES = { bottom, top, skirt, dress };

  /* ---------- changes → adjustments ---------- */

  // What a change does to the generic garment: which measurements move and by how much (inches).
  function effect(c, fam) {
    const amt = c.amount;
    if (!amt) return null;
    const a = (c.area || '').toLowerCase();
    const has = (re) => re.test(a);
    const ls = LEN_SIGN[c.action] || 0, ws = WID_SIGN[c.action] || 0;
    const taper = c.action === 'taper';
    // Widths on a flat are half the circumference, so a 1″ take-in narrows the flat by ½″.
    const W = (...keys) => (ws ? { type: 'w', keys, d: (ws * amt) / 2 } : null);
    const L = (key) => (ls ? { type: 'l', keys: [key], d: ls * amt } : null);

    if (fam === 'bottom') {
      if (ls && (has(/hem|inseam|length|outseam|leg/) || !a)) return L('inseam');
      if (has(/rise|crotch/)) return L('rise');
      if (has(/waist/)) return W('waist');
      if (has(/hip|seat/)) return W('hip');
      if (has(/thigh/)) return taper ? W('thigh', 'knee') : W('thigh');
      if (has(/knee/)) return taper ? W('knee', 'opening') : W('knee');
      if (has(/opening|ankle|hem|calf|cuff/)) return W('opening');
      if (has(/side|leg/) || !a) return W('thigh', 'knee', 'opening');
      return null;
    }
    if (fam === 'top') {
      if (has(/sleeve|cuff|arm|bicep/)) return ls ? L('sleeve') : taper ? W('bicep', 'cuff') : has(/cuff/) ? W('cuff') : W('bicep');
      if (ls && (has(/hem|length|body|crop|bottom/) || !a)) return L('length');
      if (has(/shoulder/)) return ws ? { type: 'w', keys: ['shoulder'], d: ws * amt } : null;
      if (has(/chest|bust/)) return W('chest');
      if (has(/waist|dart|back/)) return W('waist');
      if (has(/hem/)) return W('hem');
      if (has(/side/) || !a) return W('chest', 'waist', 'hem');
      return null;
    }
    if (ls && (has(/hem|length|crop/) || !a)) return L('length');
    if (fam === 'dress' && has(/chest|bust/)) return W('chest');
    if (has(/waist|dart/)) return W('waist');
    if (has(/hip|seat/)) return W('hip');
    if (has(/hem/)) return W('hem');
    if (has(/side/) || !a) return fam === 'dress' ? W('chest', 'waist', 'hip') : W('waist', 'hip', 'hem');
    return null;
  }

  const SPOT_RULES = [
    [/zip|fly/, 'zipper'], [/button|snap/, 'button'], [/pocket/, 'pocket'], [/collar|neck/, 'collar'],
    [/cuff/, 'cuff'], [/elbow|sleeve/, 'elbow'], [/knee/, 'knee'], [/crotch|seat/, 'crotch'],
    [/shoulder|strap/, 'shoulder'], [/hem/, 'hem'], [/belt|loop|waist/, 'waist'], [/lining|back/, 'back'],
  ];
  function spotFor(c, spots) {
    const a = (c.area || '').toLowerCase();
    for (const [re, key] of SPOT_RULES) if (re.test(a) && spots[key]) return spots[key];
    return spots.center;
  }

  // "−1½″", or "32″ → 30½″" when a before measurement was logged.
  function valueText(c) {
    const sign = SIGN[c.action] || 0;
    if (c.amount == null) return actionPast(c.action) || c.note || '';
    if (c.before != null && sign) return `${fmtLen(c.before)} → ${fmtLen(c.before + sign * c.amount)}`;
    return (sign < 0 ? '−' : sign > 0 ? '+' : '') + fmtLen(c.amount);
  }
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  /* ---------- render ---------- */
  let seq = 0;

  function render(project, { mini = false } = {}) {
    const kind = KIND[project.garment];
    if (!kind) return '';
    const fam = FAMILY[kind], base = BASE[kind], shape = SHAPES[fam];

    const after = { ...base };
    const items = [];
    for (const c of project.changes || []) {
      const e = effect(c, fam);
      if (e) {
        for (const k of e.keys) after[k] = Math.max(base[k] * 0.35, after[k] + e.d * (e.type === 'w' ? EXAG_W : EXAG_L));
      }
      if (e || c.area || c.note) items.push({ c, e });
    }
    const changed = !mini && items.some((i) => i.e);
    const labels = !mini && items.length > 0;

    const ID = { x: (v) => v, y: (v) => v, s: 1 };
    const pts = [...shape(base, ID, kind).pts, ...shape(after, ID, kind).pts];
    const maxX = Math.max(...pts.map((p) => Math.abs(p.x)));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));

    const W = mini ? 40 : 340, gutter = labels ? 132 : 0, pad = mini ? 3 : 14;
    const gw = W - gutter, maxH = mini ? 40 : 300;
    const s = Math.min((gw - pad * 2) / (maxX * 2), (maxH - pad * 2) / (maxY - minY));
    const cx = gw / 2;
    const T = { x: (v) => cx + v * s, y: (v) => pad + (v - minY) * s, s };
    const tp = (p) => V(T.x(p.x), T.y(p.y));
    const A = shape(after, T, kind);
    const B = changed ? shape(base, T, kind) : null;
    let h = pad * 2 + (maxY - minY) * s;

    let notes = '';
    if (labels) {
      const gx = gw + 4;
      const rows = items.map(({ c, e }) => {
        const pt = tp(e ? A.anchors[e.keys[0]] : spotFor(c, A.spots));
        return { c, ax: pt.x, ay: pt.y };
      }).sort((a, b) => a.ay - b.ay);
      let y = -100;
      for (const r of rows) { r.ly = Math.max(r.ay, y + 40, 18); y = r.ly; }
      h = Math.max(h, y + 22);
      notes = rows.map((r) => `
        <path class="sk-lead" d="M ${r.ax.toFixed(1)} ${r.ay.toFixed(1)} L ${gx - 12} ${r.ly.toFixed(1)} L ${gx - 3} ${r.ly.toFixed(1)}"/>
        <circle class="sk-dot" cx="${r.ax.toFixed(1)}" cy="${r.ay.toFixed(1)}" r="3"/>
        <text class="sk-lt" x="${gx}" y="${(r.ly - 3).toFixed(1)}">${esc(clip(r.c.area || actionPast(r.c.action) || 'Change', 16))}</text>
        <text class="sk-lv" x="${gx}" y="${(r.ly + 14).toFixed(1)}">${esc(clip(valueText(r.c), 17))}</text>`).join('');
    }

    const id = `skh${++seq}`;
    return `<svg class="sketch${mini ? ' mini' : ''}" viewBox="0 0 ${W} ${Math.ceil(h)}" role="img" aria-label="Sketch of the ${esc(project.garment.toLowerCase())}${changed ? ' with its changes' : ''}">
      ${changed ? `<defs><pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" class="sk-hatch"/></pattern></defs>
      <path d="${B.d}" fill="url(#${id})"/>` : ''}
      <path d="${A.d}" class="sk-body"/>
      ${mini ? '' : A.details.map((dt) => `<path d="${dt.d}" class="sk-detail ${dt.cls || ''}"/>`).join('')}
      ${changed ? `<path d="${B.d}" class="sk-ghost"/>` : ''}
      ${notes}
    </svg>`;
  }

  const hasChanges = (project) => !!KIND[project.garment] && (project.changes || []).some((c) => effect(c, FAMILY[KIND[project.garment]]));

  return { render, supports: (garment) => !!KIND[garment], hasChanges, SIGN };
})();
