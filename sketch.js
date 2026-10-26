// Rough flat sketches of garments, redrawn with a project's changes.
// Each garment is a simple, generic outline built from a few measurements (in inches, flat),
// plus only the details that identify it: collars, plackets, buttons, zips, hoods, lapels.
// A change like "Hem · shorten 2″" nudges those measurements, and the sketch shows
// the original outline dashed, the removed fabric hatched, and a label per change.
const Sketch = (() => {
  // Real alterations are small next to a whole garment, so draw them bigger than life.
  const EXAG_W = 3;
  const EXAG_L = 1.5;

  const KIND = {
    'T-shirt': 'tee', 'Long-sleeve tee': 'longtee', Henley: 'henley', Polo: 'polo',
    'Button-up': 'buttonup', Shirt: 'buttonup', 'Tank top': 'tank',
    Sweater: 'sweater', Sweatshirt: 'sweatshirt', Hoodie: 'hoodie', Cardigan: 'cardigan',
    Jacket: 'jacket', Blazer: 'blazer', Coat: 'coat',
    Pants: 'pants', Jeans: 'jeans', Joggers: 'joggers', Shorts: 'shorts',
    Skirt: 'skirt', Dress: 'dress',
  };

  // What identifies each top. `band` = ribbed hem and cuffs, drawn as a gathered step in the outline.
  const TOPS = {
    tee: { sleeve: 'short', neck: 'crew' },
    longtee: { sleeve: 'long', neck: 'crew' },
    henley: { sleeve: 'long', neck: 'crew', placket: 'short', buttons: 3 },
    polo: { sleeve: 'short', neck: 'polo', placket: 'short', buttons: 2 },
    buttonup: { sleeve: 'long', neck: 'collar', placket: 'full', tail: 1.6 },
    tank: { sleeve: 'none', neck: 'scoop' },
    sweater: { sleeve: 'long', neck: 'crew', band: true },
    sweatshirt: { sleeve: 'long', neck: 'crew', vee: true, band: true },
    hoodie: { sleeve: 'long', neck: 'hood', band: true },
    cardigan: { sleeve: 'long', neck: 'v', placket: 'cardigan', band: true },
    jacket: { sleeve: 'long', neck: 'stand', placket: 'zip', band: true },
    blazer: { sleeve: 'long', neck: 'lapel', buttons: 2 },
    coat: { sleeve: 'long', neck: 'lapel', double: true },
  };
  const FAMILY = { pants: 'bottom', jeans: 'bottom', joggers: 'bottom', shorts: 'bottom', skirt: 'skirt', dress: 'dress' };
  for (const k in TOPS) FAMILY[k] = 'top';

  // Generic flat measurements. Bodies are boxy and straight; legs are a straight cut.
  const t = (shoulder, chest, hem, length, sleeve, bicep, cuff) => ({ shoulder, chest, waist: chest, hem, length, sleeve, bicep, cuff });
  const leg = (waist, hip, width, rise, inseam) => ({ waist, hip, thigh: width, knee: width, opening: width, rise, inseam });
  const BASE = {
    tee: t(18, 20.5, 20.5, 28, 8.5, 7.5, 7),
    longtee: t(18, 20.5, 20.5, 28, 25, 6.5, 4.4),
    henley: t(18, 20.5, 20.5, 28.5, 25, 6.5, 4.4),
    polo: t(18, 21, 21, 28.5, 9, 7.5, 6.8),
    buttonup: t(18.5, 21, 21, 30, 25, 6.8, 4.8),
    tank: { shoulder: 13, chest: 19.5, waist: 19.5, hem: 19.5, length: 27 },
    sweater: t(19, 22, 21, 27, 25, 6.8, 4.2),
    sweatshirt: t(19.5, 22.5, 21.5, 27, 25, 7, 4.2),
    hoodie: t(19.5, 23, 22, 27.5, 25, 7.2, 4.2),
    cardigan: t(18.5, 21.5, 21, 26.5, 24.5, 6.6, 4.2),
    jacket: t(19, 23, 22, 26.5, 25, 7.2, 4.6),
    blazer: t(18.5, 21.5, 21.5, 30, 25, 7, 5.4),
    coat: t(19, 23, 24.5, 40, 25.5, 7.5, 6),
    pants: leg(16, 19.5, 9.5, 11, 31),
    jeans: leg(16, 19.5, 9.5, 10.5, 31),
    joggers: leg(15, 20, 10, 11.5, 29),
    shorts: leg(16, 19.5, 10.5, 11, 8),
    skirt: { waist: 14, hip: 19, hem: 22, length: 23 },
    dress: { shoulder: 13, chest: 17, waist: 14, hip: 19, hem: 24, length: 38 },
  };

  const LEN_SIGN = { shorten: -1, crop: -1, hem: -1, lengthen: 1 };
  const WID_SIGN = { take_in: -1, taper: -1, let_out: 1 };
  const SIGN = { ...LEN_SIGN, ...WID_SIGN, remove: -1, add: 1 };

  /* ---------- geometry helpers ---------- */
  const V = (x, y) => ({ x, y });
  const add = (a, b, k = 1) => V(a.x + b.x * k, a.y + b.y * k);
  const lerp = (a, b, k) => V(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
  const mir = (p) => V(-p.x, p.y);
  const rad = (deg) => (deg * Math.PI) / 180;

  const fmtPt = (T, p) => `${T.x(p.x).toFixed(1)} ${T.y(p.y).toFixed(1)}`;
  const path = (T, cmds) => cmds.map(([op, ...ps]) => op + ps.map((p) => ' ' + fmtPt(T, p)).join('')).join(' ');
  const mirCmds = (cmds) => cmds.map(([op, ...ps]) => [op, ...ps.map(mir)]);
  const pathBoth = (T, cmds) => path(T, cmds) + ' ' + path(T, mirCmds(cmds));
  const line = (T, ...pts) => path(T, pts.map((p, i) => [i ? 'L' : 'M', p]));
  const both = (T, ...pts) => line(T, ...pts) + ' ' + line(T, ...pts.map(mir));
  const circle = (T, c, r) => {
    const x = T.x(c.x), y = T.y(c.y), rr = Math.max(r * T.s, T.minR || 0);
    return `M ${(x - rr).toFixed(1)} ${y.toFixed(1)} a ${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 0 ${(2 * rr).toFixed(1)} 0 a ${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 0 ${(-2 * rr).toFixed(1)} 0`;
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

  // An identifying detail. `mini: false` drops it from thumbnails where it'd just be noise.
  const D = (d, cls = '', mini = true) => ({ d, cls, mini });

  /* ---------- tops ---------- */
  function top(p, T, kind) {
    const cfg = TOPS[kind], b = BASE[kind];
    const nw = { hood: 3.8, stand: 3.6, lapel: 3.9, scoop: 3.6, v: 3.6 }[cfg.neck] || 3.4;
    const S = p.shoulder / 2, C = p.chest / 2, Wa = p.waist / 2, Hm = p.hem / 2, Len = p.length;
    const sp = V(S, 1.8);
    const tail = cfg.tail || 0;
    const details = [], anchors = {}, extra = [];

    const segs = [];
    let start = V(nw, 0), close = [['Q', V(0, 0.9), V(nw, 0)]];
    if (cfg.neck === 'hood') {
      start = V(0, -9.5);
      close = [];
      segs.push({ to: V(nw + 1.9, -3.2), c: [V(nw + 2.1, -9.5)] }, { to: V(nw + 0.3, 0.7), c: [V(nw + 2.3, -0.6)] });
      extra.push(V(nw + 2.1, -3.2));
    }

    // Sleeves: the armpit sits wherever the sleeve is a sensible width where it meets the body,
    // so sleeves never come out skinny. Thumbnails hang long sleeves lower to stay compact.
    let ap, cuffTop, cuffBot, u, mid;
    if (cfg.sleeve === 'none') {
      ap = V(C, 10.5);
      segs.push({ to: sp }, { to: ap, c: [V(sp.x - 0.3, ap.y - 0.8)] });
    } else {
      const short = cfg.sleeve === 'short';
      const th = rad(short ? 30 : T.mini ? 58 : 54);
      u = V(Math.cos(th), Math.sin(th));
      const pv = V(-Math.sin(th), Math.cos(th));
      const width = short ? b.bicep * 0.95 : b.bicep * 0.78;
      ap = V(C, Math.min(Len * 0.5, sp.y + (width + (C - S) * Math.sin(th)) / Math.cos(th)));
      const sl = p.sleeve * (T.mini && !short ? 0.88 : 1);
      cuffTop = add(sp, u, sl);
      cuffBot = add(cuffTop, pv, p.cuff);
      mid = add(lerp(ap, cuffBot, 0.35), pv, p.bicep - b.bicep);
      segs.push({ to: sp });
      if (cfg.band) {
        // Ribbed cuff: the sleeve gathers in for the last couple of inches.
        const k = Math.min(2.2, sl * 0.3), g = 0.6;
        segs.push(
          { to: add(sp, u, sl - k) }, { to: add(add(sp, u, sl - k), pv, g) }, { to: add(cuffTop, pv, g) },
          { to: add(cuffTop, pv, p.cuff - g) }, { to: add(add(cuffTop, u, -k), pv, p.cuff - g) }, { to: add(cuffBot, u, -k) },
        );
      } else {
        segs.push({ to: cuffTop }, { to: cuffBot });
      }
      segs.push({ to: mid }, { to: ap });
      Object.assign(anchors, { sleeve: lerp(cuffTop, cuffBot, 0.5), bicep: mid, cuff: cuffBot });
    }

    // Body: straight and boxy. Banded tops step in at a ribbed hem.
    const yW = Math.max(ap.y + 2, Len * 0.58);
    const band = cfg.band ? 2.2 : 0, g = 0.9;
    segs.push({ to: V(Wa, yW) });
    if (band) {
      segs.push({ to: V(Hm, Len - band) }, { to: V(Hm - g, Len - band + 0.2) }, { to: V(Hm - g, Len) }, { to: V(0, Len) });
    } else {
      segs.push({ to: V(Hm, Len - tail) }, tail ? { to: V(0, Len), c: [V(Hm, Len - 0.2), V(Hm * 0.45, Len)] } : { to: V(0, Len) });
    }
    const d = symmetric(T, start, segs, close);

    // Neckline.
    let neckBottom = 2.7;
    if (cfg.neck === 'crew') {
      details.push(D(path(T, [['M', V(-nw, 0)], ['Q', V(0, 5.4), V(nw, 0)]])));
      if (cfg.vee) details.push(D(line(T, V(-0.9, 2.6), V(0, 4.2), V(0.9, 2.6))));
    } else if (cfg.neck === 'collar') {
      details.push(D(line(T, V(-nw, 0), V(-1.7, 3.7), V(0, 2.5), V(1.7, 3.7), V(nw, 0))));
      neckBottom = 2.5;
    } else if (cfg.neck === 'polo') {
      details.push(D(path(T, [['M', V(-nw, 0)], ['L', V(-1.6, 3.1)], ['L', V(-0.2, 2.3)]]) + ' ' + path(T, [['M', V(nw, 0)], ['L', V(1.6, 3.1)], ['L', V(0.2, 2.3)]])));
      neckBottom = 2.3;
    } else if (cfg.neck === 'scoop') {
      details.push(D(path(T, [['M', V(-nw, 0)], ['Q', V(0, 9), V(nw, 0)]])));
    } else if (cfg.neck === 'v') {
      details.push(D(line(T, V(-nw, 0), V(0, 11), V(nw, 0))));
    } else if (cfg.neck === 'stand') {
      details.push(D(path(T, [['M', V(-nw - 0.2, 0.4)], ['L', V(-nw + 0.15, -1.6)], ['Q', V(0, -1.1), V(nw - 0.15, -1.6)], ['L', V(nw + 0.2, 0.4)]])));
      extra.push(V(nw, -1.6));
      neckBottom = 0.3;
    } else if (cfg.neck === 'lapel') {
      const v = V(0.3, Len * (cfg.double ? 0.36 : 0.42));
      details.push(D(both(T, V(nw, 0), V(4.4, 4.3), V(2.8, 5.3), V(3.7, 6.5), v)));
      if (!cfg.double) details.push(D(line(T, v, V(0.3, Len))));
    } else if (cfg.neck === 'hood') {
      details.push(D(path(T, [['M', V(-nw - 0.1, 0.4)], ['C', V(-nw - 1.3, -7.6), V(nw + 1.3, -7.6), V(nw + 0.1, 0.4)]])));
      details.push(D(path(T, [['M', V(-nw - 0.1, 0.4)], ['Q', V(0, 5.2), V(nw + 0.1, 0.4)]])));
      details.push(D(both(T, V(1.2, 2.6), V(1.45, 8.5)), '', false));
    }

    // Front opening and buttons.
    if (cfg.placket === 'full') {
      details.push(D(line(T, V(0, 2.5), V(0, Len))));
      for (let y = 4.4; y < Len - 2; y += 3.3) details.push(D(circle(T, V(0.4, y), 0.24), 'dot'));
    } else if (cfg.placket === 'short') {
      const len = kind === 'henley' ? 6 : 4.5, top0 = kind === 'henley' ? 2.5 : neckBottom - 0.2;
      details.push(D(line(T, V(-0.55, top0), V(-0.55, top0 + len), V(0.55, top0 + len), V(0.55, top0))));
      for (let i = 0; i < cfg.buttons; i++) details.push(D(circle(T, V(0, top0 + 1.1 + (i * (len - 1.8)) / Math.max(1, cfg.buttons - 1)), 0.24), 'dot'));
    } else if (cfg.placket === 'cardigan') {
      details.push(D(line(T, V(0, 11), V(0, Len))));
      for (let y = 13; y < Len - 2.5; y += 3.4) details.push(D(circle(T, V(0.5, y), 0.27), 'dot'));
    } else if (cfg.placket === 'zip') {
      details.push(D(line(T, V(0, neckBottom), V(0, Len))));
      details.push(D(line(T, V(0.15, neckBottom + 0.8), V(0.95, neckBottom + 0.8), V(0.95, neckBottom + 2.4), V(0.15, neckBottom + 2.4))));
    }
    if (cfg.neck === 'lapel') {
      const xs = cfg.double ? [-1.8, 1.8] : [-0.6];
      const rows = cfg.double ? [0.45, 0.56, 0.67] : [0.52, 0.66];
      for (const x of xs) for (const k of rows) details.push(D(circle(T, V(x, Len * k), 0.35), 'dot'));
    }

    const ptsList = [start, sp, ap, V(Wa, yW), V(Hm, Len), V(0, Len), ...extra];
    if (cuffTop) ptsList.push(cuffTop, cuffBot);
    return {
      d, details,
      pts: ptsList,
      anchors: { ...anchors, chest: V(C, ap.y + 0.8), waist: V(Wa, yW), hem: V(Hm - (band ? g : 0), Len - tail - 0.6), length: V(Hm - (band ? g : 0), Len - tail), shoulder: sp },
      spots: {
        button: V(0.4, Len * 0.4), collar: V(0, 1.8), pocket: V(4.6, Len - 6),
        zipper: V(0, Len * 0.5), shoulder: sp, hem: V(Hm * 0.5, Len - 0.8), back: V(-C * 0.5, Len * 0.5),
        center: V(C * 0.45, Len * 0.45), waist: V(Wa - 1, yW),
        ...(cuffTop ? { cuff: lerp(cuffTop, cuffBot, 0.5), elbow: add(lerp(sp, mid, 0.5), u, p.sleeve * 0.25) } : {}),
      },
    };
  }

  /* ---------- bottoms (straight-leg) ---------- */
  function bottom(p, T, kind) {
    const b = BASE[kind];
    const R = b.rise;
    const y0 = b.rise - p.rise; // a shorter rise drops the waistband; the crotch stays put
    const cx = 0.25 + b.thigh / 2; // centre line of each leg
    const W = p.waist / 2, H = p.hip / 2, L = p.inseam;
    const yHip = y0 + p.rise * 0.55, yKnee = R + L * 0.45, yHem = R + L;
    const crotchIn = V(Math.max(0.15, cx - p.thigh / 2), R);
    const crotchOut = V(crotchIn.x + p.thigh, R);
    // Legs stay a constant width but splay out a little, so there's a gap between them.
    const spread = L > 15 ? 1.3 : 0.9, kx = cx + spread * 0.45, hx = cx + spread;
    const knee = V(kx + p.knee / 2, yKnee), kneeIn = V(kx - p.knee / 2, yKnee);
    const O = p.opening / 2;
    const fork = V(0, R - 1.3);
    const jog = kind === 'joggers';
    const wb = jog ? 2.2 : 1.4;

    // Joggers gather into a ribbed ankle cuff; everything else is a plain straight leg.
    const hem = jog
      ? [{ to: V(hx + O, yHem - 2.4) }, { to: V(hx + O - 0.8, yHem - 2.2) }, { to: V(hx + O - 0.8, yHem) }, { to: V(hx - O + 0.8, yHem) }, { to: V(hx - O + 0.8, yHem - 2.2) }, { to: V(hx - O, yHem - 2.4) }]
      : [{ to: V(hx + O, yHem) }, { to: V(hx - O, yHem) }];
    const d = symmetric(T, V(W, y0), [
      { to: V(H, yHip), c: [V(H, y0 + (yHip - y0) * 0.35)] },
      { to: crotchOut }, { to: knee }, ...hem, { to: kneeIn }, { to: crotchIn },
      { to: fork, c: [V(crotchIn.x * 0.25, R - 0.15)] },
    ]);

    const details = [D(line(T, V(-W - 0.1, y0 + wb), V(W + 0.1, y0 + wb)))];
    if (jog) {
      details.push(D(pathBoth(T, [['M', V(0.6, y0 + wb)], ['Q', V(1, y0 + wb + 1.8), V(1.6, y0 + wb + 3.2)]])));
    } else {
      details.push(D(circle(T, V(0, y0 + wb / 2), 0.3), 'dot'));
      if (kind === 'jeans') {
        details.push(D(path(T, [['M', V(-1.4, y0 + wb)], ['L', V(-1.4, y0 + p.rise * 0.48)], ['Q', V(-1.4, y0 + p.rise * 0.62), V(0, y0 + p.rise * 0.64)]])));
        details.push(D(line(T, V(0, y0 + wb), fork)));
      } else {
        details.push(D(line(T, V(0, y0 + wb), fork)));
      }
      if (kind === 'pants') details.push(D(both(T, V(cx, y0 + 5), V(hx, yHem - 0.3)), 'faint', false));
    }

    return {
      d, details,
      pts: [V(W, y0), V(H, yHip), crotchOut, knee, V(hx + O, yHem), V(0, Math.min(0, y0))],
      anchors: { waist: V(W, y0 + 0.7), hip: V(H, yHip), thigh: V(crotchOut.x, R + 0.8), knee, opening: V(hx + O - (jog ? 0.8 : 0), yHem - 0.6), inseam: V(hx + O - (jog ? 0.8 : 0), yHem), rise: V(W, y0) },
      spots: {
        zipper: V(-0.8, y0 + p.rise * 0.35), button: V(0, y0 + 0.7), waist: V(W - 1, y0 + 0.7), pocket: V(W - 2, y0 + 3.2),
        knee: V(kx, yKnee), crotch: fork, hem: V(hx, yHem - 0.5), center: V(cx, R + L * 0.25), back: V(-cx, R + L * 0.25),
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
      details: [D(line(T, V(-W - 0.1, 1.4), V(W + 0.1, 1.4)))],
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
      details: [D(path(T, [['M', V(-nw, 0)], ['Q', V(0, 8.5), V(nw, 0)]]))],
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
    [/zip|fly/, 'zipper'], [/button|snap/, 'button'], [/pocket/, 'pocket'], [/collar|neck|hood/, 'collar'],
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
      const shown = e && e.keys.some((k) => k in base);
      if (shown) {
        for (const k of e.keys) {
          if (k in after) after[k] = Math.max(base[k] * 0.35, after[k] + e.d * (e.type === 'w' ? EXAG_W : EXAG_L));
        }
      }
      if (shown || c.area || c.note) items.push({ c, e: shown ? e : null });
    }
    const changed = !mini && items.some((i) => i.e);
    const labels = !mini && items.length > 0;

    const ID = { x: (v) => v, y: (v) => v, s: 1, mini };
    const pts = [...shape(base, ID, kind).pts, ...shape(after, ID, kind).pts];
    const maxX = Math.max(...pts.map((p) => Math.abs(p.x)));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));

    const W = mini ? 40 : 340, gutter = labels ? 132 : 0, pad = mini ? 3 : 14;
    const gw = W - gutter, maxH = mini ? 40 : 300;
    const s = Math.min((gw - pad * 2) / (maxX * 2), (maxH - pad * 2) / (maxY - minY));
    const cx = gw / 2;
    const drawn = pad * 2 + (maxY - minY) * s;
    // Thumbnails are square; centre the garment vertically in them.
    const top0 = mini ? (40 - drawn) / 2 : 0;
    const T = { x: (v) => cx + v * s, y: (v) => top0 + pad + (v - minY) * s, s, mini, minR: mini ? 0.9 : 0 };
    const tp = (p) => V(T.x(p.x), T.y(p.y));
    const A = shape(after, T, kind);
    const B = changed ? shape(base, T, kind) : null;
    let h = mini ? 40 : drawn;

    let notes = '';
    if (labels) {
      const gx = gw + 4;
      const rows = items.map(({ c, e }) => {
        const key = e && e.keys.find((k) => A.anchors[k]);
        const pt = tp(key ? A.anchors[key] : spotFor(c, A.spots));
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

    const details = mini ? A.details.filter((dt) => dt.mini) : A.details;
    const id = `skh${++seq}`;
    return `<svg class="sketch${mini ? ' mini' : ''}" viewBox="0 0 ${W} ${Math.ceil(h)}" role="img" aria-label="Sketch of the ${esc(project.garment.toLowerCase())}${changed ? ' with its changes' : ''}">
      ${changed ? `<defs><pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" class="sk-hatch"/></pattern></defs>
      <path d="${B.d}" fill="url(#${id})"/>` : ''}
      <path d="${A.d}" class="sk-body"/>
      ${details.map((dt) => `<path d="${dt.d}" class="sk-detail ${dt.cls}"/>`).join('')}
      ${changed ? `<path d="${B.d}" class="sk-ghost"/>` : ''}
      ${notes}
    </svg>`;
  }

  // The plain garment fitted into a w×h box, in px, for drawing overlays such as a heatmap.
  function outline(garment, w, h, pad = 12) {
    const kind = KIND[garment];
    if (!kind) return null;
    const fam = FAMILY[kind], shape = SHAPES[fam];
    const pts = shape(BASE[kind], { x: (v) => v, y: (v) => v, s: 1 }, kind).pts;
    const maxX = Math.max(...pts.map((p) => Math.abs(p.x)));
    const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
    const s = Math.min((w - pad * 2) / (maxX * 2), (h - pad * 2) / (maxY - minY));
    const oy = pad + (h - pad * 2 - (maxY - minY) * s) / 2;
    const T = { x: (v) => w / 2 + v * s, y: (v) => oy + (v - minY) * s, s };
    const A = shape(BASE[kind], T, kind);
    const px = (o) => Object.fromEntries(Object.entries(o).map(([k, p]) => [k, V(T.x(p.x), T.y(p.y))]));
    return { d: A.d, details: A.details, anchors: px(A.anchors), spots: px(A.spots), fam, top: T.y(minY), bottom: T.y(maxY), s };
  }

  const hasChanges = (project) => {
    const kind = KIND[project.garment];
    return !!kind && (project.changes || []).some((c) => { const e = effect(c, FAMILY[kind]); return e && e.keys.some((k) => k in BASE[kind]); });
  };

  return { render, outline, supports: (garment) => !!KIND[garment], hasChanges, SIGN };
})();
