// Seam Log: body measurements, fit profiles and a sewing project log.
// Plain JS, no build step. Data lives in IndexedDB on the device (see db.js).

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const view = $('#view');

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHEV = '<svg class="chev" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---------------- Reference data ---------------- */

const DEFAULT_TYPES = [
  { key: 'height', label: 'Height', group: 'General' },
  { key: 'neck', label: 'Neck', group: 'Upper body', hint: 'Around the base of the neck' },
  { key: 'shoulders', label: 'Shoulder width', group: 'Upper body', hint: 'Shoulder point to shoulder point, across the back' },
  { key: 'chest', label: 'Chest', group: 'Upper body', hint: 'Fullest part, tape level under the arms' },
  { key: 'bicep', label: 'Bicep', group: 'Upper body', hint: 'Fullest part of the upper arm' },
  { key: 'wrist', label: 'Wrist', group: 'Upper body' },
  { key: 'sleeve', label: 'Sleeve length', group: 'Upper body', hint: 'Shoulder point to wrist bone, arm relaxed' },
  { key: 'backlength', label: 'Back length', group: 'Upper body', hint: 'Base of neck to natural waist' },
  { key: 'waist', label: 'Waist', group: 'Lower body', hint: 'Where your pants usually sit' },
  { key: 'hip', label: 'Hip / seat', group: 'Lower body', hint: 'Fullest part of the seat' },
  { key: 'thigh', label: 'Thigh', group: 'Lower body', hint: 'Fullest part, just below the crotch' },
  { key: 'knee', label: 'Knee', group: 'Lower body' },
  { key: 'calf', label: 'Calf', group: 'Lower body' },
  { key: 'inseam', label: 'Inseam', group: 'Lower body', hint: 'Crotch to ankle bone' },
  { key: 'outseam', label: 'Outseam', group: 'Lower body', hint: 'Waist to ankle, down the side' },
  { key: 'rise', label: 'Rise', group: 'Lower body', hint: 'Sitting down: waist to chair seat' },
];
const GROUP_ORDER = ['General', 'Upper body', 'Lower body', 'Custom'];

const GARMENTS = [
  ['T-shirt', 'top'], ['Long-sleeve tee', 'top'], ['Henley', 'top'], ['Polo', 'top'], ['Button-up', 'top'], ['Tank top', 'top'],
  ['Sweater', 'top'], ['Sweatshirt', 'top'], ['Hoodie', 'top'], ['Cardigan', 'top'], ['Jacket', 'top'], ['Blazer', 'top'], ['Coat', 'top'],
  ['Pants', 'bottom'], ['Jeans', 'bottom'], ['Joggers', 'bottom'], ['Shorts', 'bottom'],
  ['Skirt', 'skirt'], ['Dress', 'dress'], ['Other', null],
];
const GARMENT_GROUPS = [['Tops', 'top'], ['Bottoms', 'bottom'], ['Skirts & dresses', 'skirt', 'dress'], ['Other', null]];
// Garment picker, grouped. An older name (like "Shirt") still shows as selected.
const garmentOptions = (sel) => GARMENT_GROUPS.map(([lbl, ...kinds]) =>
  `<optgroup label="${lbl}">${GARMENTS.filter(([, k]) => kinds.includes(k)).map(([g]) => `<option ${g === sel ? 'selected' : ''}>${g}</option>`).join('')}</optgroup>`).join('') +
  (GARMENTS.some(([g]) => g === sel) ? '' : `<option selected>${esc(sel)}</option>`);
const FITS = ['Fitted', 'Slim', 'Regular', 'Relaxed', 'Oversized', 'Cropped'];

// Starting lines for a new fit profile, by garment kind. [label, body measurement or null for a set length]
const SUGGESTED_LINES = {
  top: [['Chest', 'chest'], ['Waist', 'waist'], ['Shoulder width', 'shoulders'], ['Sleeve length', 'sleeve'], ['Bicep', 'bicep'], ['Body length', null]],
  bottom: [['Waist', 'waist'], ['Hip / seat', 'hip'], ['Thigh', 'thigh'], ['Knee', 'knee'], ['Leg opening', null], ['Inseam', 'inseam'], ['Rise', 'rise']],
  skirt: [['Waist', 'waist'], ['Hip / seat', 'hip'], ['Length', null]],
  dress: [['Chest', 'chest'], ['Waist', 'waist'], ['Hip / seat', 'hip'], ['Length', null]],
};

const ACTIONS = [
  ['take_in', 'Take in', 'Took in'], ['let_out', 'Let out', 'Let out'], ['shorten', 'Shorten', 'Shortened'],
  ['lengthen', 'Lengthen', 'Lengthened'], ['taper', 'Taper', 'Tapered'], ['crop', 'Crop', 'Cropped'],
  ['hem', 'Hem', 'Hemmed'], ['add', 'Add', 'Added'], ['remove', 'Remove', 'Removed'],
  ['replace', 'Replace', 'Replaced'], ['repair', 'Repair', 'Repaired'], ['other', 'Other', ''],
];
const AREAS = ['Waist', 'Hip / seat', 'Thigh', 'Knee', 'Leg opening', 'Inseam', 'Outseam', 'Rise', 'Hem', 'Chest',
  'Shoulders', 'Side seams', 'Sleeves', 'Sleeve length', 'Armhole', 'Collar', 'Cuffs', 'Back', 'Darts', 'Buttons',
  'Zipper', 'Pockets', 'Lining', 'Body length'];
const PROJECT_TYPES = [['alteration', 'Alteration'], ['made', 'Made'], ['refashion', 'Refashion']];
const STATUSES = [['planned', 'Planned'], ['wip', 'In progress'], ['done', 'Done']];

/* ---------------- Formatting ---------------- */

const FRACTION_CHARS = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅛': ' 1/8', '⅜': ' 3/8', '⅝': ' 5/8', '⅞': ' 7/8' };

// "31", "31.5", "31 1/2", "31-1/2", "31½", "-1/4" -> inches. null when blank, NaN when unreadable.
function parseLen(input) {
  let s = String(input ?? '').trim().replace(/(["″”]|inches|inch|in)$/i, '').trim();
  if (!s) return null;
  let sign = 1;
  if (/^[-−–]/.test(s)) { sign = -1; s = s.slice(1).trim(); } else if (s[0] === '+') s = s.slice(1).trim();
  s = s.replace(/[½¼¾⅛⅜⅝⅞]/g, (c) => FRACTION_CHARS[c]).replace(/(\d)\s*-\s*(\d+\/\d+)/, '$1 $2').trim();
  const parts = s.split(/\s+/);
  if (!s || parts.length > 2) return NaN;
  let total = 0;
  for (const p of parts) {
    if (p.includes('/')) {
      const [a, b] = p.split('/').map(Number);
      if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return NaN;
      total += a / b;
    } else {
      const n = Number(p);
      if (!Number.isFinite(n)) return NaN;
      total += n;
    }
  }
  return sign * total;
}

const EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

// Rounds to the nearest 1/8", the way a tape measure reads: 31.5 -> 31½″
function fmtLen(n, { sign = false, unit = true } = {}) {
  if (n == null || Number.isNaN(n)) return '';
  const e = Math.round(Math.abs(n) * 8);
  const whole = Math.floor(e / 8);
  const frac = EIGHTHS[e % 8];
  let s = (whole || !frac ? String(whole) : '') + frac;
  if (e && n < 0) s = '−' + s;
  else if (e && sign) s = '+' + s;
  return s + (unit ? '″' : '');
}
const fmtInput = (n) => (n == null ? '' : String(+n.toFixed(3)));

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
const fmtDate = (iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  iso ? new Date(iso + 'T12:00:00').toLocaleDateString(undefined, opts) : '';

/* ---------------- State ---------------- */

const S = { measurements: [], profiles: [], projects: [], settings: { id: 'settings', customTypes: [] } };

async function loadAll() {
  [S.measurements, S.profiles, S.projects] = await Promise.all(['measurements', 'profiles', 'projects'].map((s) => DB.all(s)));
  S.settings = (await DB.get('meta', 'settings')) || { id: 'settings', customTypes: [] };
  // v4 split "Shirt" into button-ups, henleys, polos and so on; old shirts were button-ups.
  for (const [store, list] of [['projects', S.projects], ['profiles', S.profiles]]) {
    for (const r of list) if (r.garment === 'Shirt') { r.garment = 'Button-up'; await DB.put(store, r); }
  }
}

const types = () => [...DEFAULT_TYPES, ...S.settings.customTypes];
const typeOf = (key) => types().find((t) => t.key === key);

function groupsOf(list) {
  const groups = GROUP_ORDER.map((name) => ({ name, items: list.filter((t) => t.group === name) }));
  return groups.filter((g) => g.items.length);
}

const byNewest = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0);
const historyOf = (key) => S.measurements.filter((m) => m.key === key).sort(byNewest);
const latest = (key) => historyOf(key)[0];

const actionPast = (key) => (ACTIONS.find((a) => a[0] === key) || ACTIONS[ACTIONS.length - 1])[2];
const label = (pairs, key) => (pairs.find((p) => p[0] === key) || [, ''])[1];

// What a fit-profile line works out to with the current body measurements.
function lineCalc(l) {
  const t = l.ref && typeOf(l.ref);
  if (!t) return l.value == null ? { value: null, how: 'Not set yet' } : { value: l.value, how: 'Set length' };
  const body = latest(l.ref);
  if (!body) return { value: null, missing: true, how: `Measure your ${t.label.toLowerCase()} first` };
  const ease = l.value || 0;
  return { value: body.value + ease, how: `${t.label} ${fmtLen(body.value)} ${ease < 0 ? '−' : '+'} ${fmtLen(Math.abs(ease))} ease` };
}

/* ---------------- UI helpers ---------------- */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// In-app history, so Back and Cancel return to wherever you came from (home, a list, a detail page).
const navStack = [];
let replacing = false;
function replaceTo(hash) {
  if (location.hash === hash) return render();
  replacing = true;
  location.replace(hash);
}
function goBack(fallback) {
  if (navStack.length > 1) history.back();
  else replaceTo(fallback);
}
function trackNav(hash) {
  if (replacing) { navStack[navStack.length - 1] = hash; replacing = false; return; }
  const i = navStack.lastIndexOf(hash, navStack.length - 2);
  if (i >= 0) navStack.length = i + 1;
  else if (navStack[navStack.length - 1] !== hash) navStack.push(hash);
}

// Label for the back button: the page you'd return to.
function backLabel(fallback) {
  const h = navStack.length > 1 ? navStack[navStack.length - 2] : fallback;
  if (h === '#/') return 'Home';
  if (h === '#/body') return 'Body';
  if (h === '#/fits') return 'Fits';
  if (h === '#/projects') return 'Projects';
  if (h === '#/more') return 'Settings';
  const m = h.match(/^#\/body\/m\/(\w+)$/);
  if (m) return typeOf(m[1])?.label || 'Back';
  return 'Back';
}

const subHead = (title, back, label = null, action = '<span class="action"></span>') =>
  `<header class="head"><button class="back" data-back="${back}">${label === 'Cancel' ? 'Cancel' : `‹ ${esc(label || backLabel(back))}`}</button><h1>${esc(title)}</h1>${action}</header>`;

const emptyState = (title, body, btnHref, btnLabel) =>
  `<div class="card"><div class="empty-state"><h2>${title}</h2><p>${body}</p>${btnHref ? `<a class="btn" href="${btnHref}">${btnLabel}</a>` : ''}</div></div>`;

const datalist = (id, items) => `<datalist id="${id}">${items.map((i) => `<option value="${esc(i)}">`).join('')}</datalist>`;

let liveUrls = [];
const trackUrl = (u) => (liveUrls.push(u), u);
function revokeUrls() {
  liveUrls.forEach((u) => URL.revokeObjectURL(u));
  liveUrls = [];
}

// Fills every [data-photo] element under root with its image from the photos store.
async function hydratePhotos(root = view) {
  for (const el of $$('[data-photo]', root)) {
    if (el.dataset.loaded) continue;
    el.dataset.loaded = '1';
    const rec = await DB.get('photos', el.dataset.photo);
    if (!rec) continue;
    const img = document.createElement('img');
    img.alt = '';
    img.src = trackUrl(URL.createObjectURL(rec.blob));
    el.textContent = '';
    el.appendChild(img);
  }
}

function lightbox(src) {
  const d = document.createElement('div');
  d.className = 'lightbox';
  d.innerHTML = `<img src="${src}" alt="">`;
  d.onclick = () => d.remove();
  document.body.appendChild(d);
}

async function resizeImage(file, max = 1400) {
  let src = await createImageBitmap(file).catch(() => null);
  if (!src) {
    src = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const scale = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.82));
}

function sparkline(points) {
  const W = 320, H = 120, PX = 18, PT = 22, PB = 14;
  const xs = points.map((p) => new Date(p.date + 'T12:00:00').getTime());
  const ys = points.map((p) => p.value);
  let [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  let [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  if (y1 - y0 < 1) { const mid = (y0 + y1) / 2; y0 = mid - 0.5; y1 = mid + 0.5; }
  const X = (x) => PX + ((x - x0) / (x1 - x0)) * (W - 2 * PX);
  const Y = (y) => PT + (1 - (y - y0) / (y1 - y0)) * (H - PT - PB);
  const pts = points.map((p, i) => [X(xs[i]), Y(p.value)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const first = pts[0], last = pts[pts.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="History chart">
    <path class="line" d="${d}"/>
    ${pts.map(([x, y]) => `<circle class="dot" cx="${x}" cy="${y}" r="3.5"/>`).join('')}
    <text x="${first[0]}" y="${first[1] - 9}" text-anchor="start">${fmtLen(points[0].value)}</text>
    <text x="${last[0]}" y="${last[1] - 9}" text-anchor="end">${fmtLen(points[points.length - 1].value)}</text>
  </svg>`;
}

/* ---------------- Home ---------------- */

const HOME_KEYS = ['chest', 'waist', 'hip', 'inseam', 'shoulders', 'sleeve'];
const SHORT_LABELS = { hip: 'Hip', shoulders: 'Shoulder', sleeve: 'Sleeve', backlength: 'Back' };
const SIGNED = { take_in: '−', shorten: '−', crop: '−', let_out: '+', lengthen: '+' };
// One icon set: 24px grid, 1.75px rounded line.
const icon = (body) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICONS = {
  body: icon('<circle cx="9.5" cy="10.5" r="6.5"/><circle cx="9.5" cy="10.5" r="2"/><path d="M9.5 17H21v-3.4M14.5 17v-1.6M17 17v-2.2M19.5 17v-1.6"/>'),
  fits: icon('<path d="M10 5.2a2 2 0 1 1 2 2v1.3"/><path d="M12 8.5 3.7 15.2a1.1 1.1 0 0 0 .7 2h15.2a1.1 1.1 0 0 0 .7-2L12 8.5Z"/>'),
  proj: icon('<rect x="6" y="3" width="12" height="3.2" rx="1.4"/><rect x="6" y="17.8" width="12" height="3.2" rx="1.4"/><path d="M8 6.2v11.6M16 6.2v11.6M8 10l8-1.6M8 13.6l8-1.6"/><path d="M16 15.2c2.6.2 4 1.6 3.6 4.4"/>'),
  settings: icon('<path d="M4 7h8.5M16.5 7H20M4 17h3.5M11.5 17H20"/><circle cx="14.5" cy="7" r="2"/><circle cx="9.5" cy="17" r="2"/>'),
};

// "Oct 24" this year, "Oct 24, 2025" otherwise.
const fmtShort = (iso) => fmtDate(iso, iso && iso.slice(0, 4) === today().slice(0, 4)
  ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });

// "Waist −1½″", "Thigh tapered ¾″"
function shortChange(c) {
  const amt = c.amount != null ? fmtLen(c.amount) : '';
  const how = SIGNED[c.action] && amt ? SIGNED[c.action] + amt : [actionPast(c.action).toLowerCase(), amt].filter(Boolean).join(' ');
  return [c.area, how].filter(Boolean).join(' ');
}

function projectRow(p) {
  const profile = S.profiles.find((x) => x.id === p.profileId);
  const summary = p.changes.length ? p.changes.map(shortChange).join(' · ') : [p.garment, profile && profile.fit].filter(Boolean).join(' · ');
  return `<a class="proj" href="#/projects/${p.id}">
    <div class="thumb" ${p.photoIds[0] ? `data-photo="${p.photoIds[0]}"` : ''}>${Sketch.render(p, { mini: true }) || esc((p.garment || '?')[0])}</div>
    <div class="pm"><div class="pt">${esc(p.name)}</div><div class="pc">${esc(summary)}</div>
      <div class="pd">${esc([fmtShort(p.date), label(PROJECT_TYPES, p.type)].filter(Boolean).join(' · '))}</div></div>
    <span class="pill ${p.status === 'done' ? '' : 'accent'}">${label(STATUSES, p.status)}</span>
  </a>`;
}

function fitCard(p) {
  const rows = p.lines.map((l) => [l.label, lineCalc(l).value]).filter(([, v]) => v != null).slice(0, 3);
  return `<a class="fitcard" href="#/fits/${p.id}"><div class="fg">${esc(p.garment)}</div><div class="fn">${esc(p.fit)}</div>
    <dl>${rows.length ? rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${fmtLen(v)}</dd></div>`).join('') : '<div><dt>No targets yet</dt></div>'}</dl></a>`;
}

const homeEmpty = (title, body, href, btn) =>
  `<div class="home-empty"><b>${title}</b>${body}<br><a class="btn small" href="${href}">${btn}</a></div>`;

function viewHome() {
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  let html = `<header class="home-h"><div><div class="eyebrow">${esc(day)}</div><h1>Seam Log</h1></div>
    <a class="gear" href="#/more" aria-label="Settings and backup">${ICONS.settings}</a></header>`;

  html += `<section class="sec s-body"><div class="sh"><h2>Body</h2><a href="#/body/log">Update</a></div>`;
  if (!S.measurements.length) {
    html += homeEmpty('Start with your measurements', 'Fits and projects build on them, so you only re-measure when something changes.', '#/body/log', 'Log measurements');
  } else {
    const last = S.measurements.reduce((a, m) => (m.date > a ? m.date : a), '');
    const tracked = new Set(S.measurements.map((m) => m.key)).size;
    html += `<div class="sub">Last measured ${fmtShort(last)} · ${tracked} of ${types().length} tracked</div><div class="grid6">` +
      HOME_KEYS.map((k) => {
        const l = latest(k);
        return `<a class="tile" href="#/body/m/${k}"><span class="k">${esc(SHORT_LABELS[k] || typeOf(k).label)}</span>
          <span class="v ${l ? '' : 'empty'}">${l ? `${fmtLen(l.value, { unit: false })}<i>″</i>` : '—'}</span></a>`;
      }).join('') + `</div><a class="more-link" href="#/body">All measurements ›</a>`;
  }
  html += `</section>`;

  html += `<section class="sec s-fits"><div class="sh"><h2>Fits</h2><a href="#/fits/new">New</a></div>`;
  if (!S.profiles.length) {
    html += homeEmpty('How do you like things to fit?', 'Make a profile like “Shirt · Fitted” and Seam Log works out your finished measurements.', '#/fits/new', 'Create a fit');
  } else {
    const sorted = S.profiles.slice().sort((a, b) => garmentRank(a.garment) - garmentRank(b.garment) || a.fit.localeCompare(b.fit));
    html += `<div class="sub">Finished measurements, updated from your body</div>
      <div class="hscroll">${sorted.map(fitCard).join('')}<a class="fitcard add" href="#/fits/new"><span>+</span>New fit</a></div>
      <a class="more-link" href="#/fits">All fits ›</a>`;
  }
  html += `</section>`;

  html += `<section class="sec s-proj"><div class="sh"><h2>Projects</h2><a href="${S.projects.length ? '#/projects' : '#/projects/new'}">${S.projects.length ? 'See all' : 'New'}</a></div>`;
  if (!S.projects.length) {
    html += homeEmpty('Your sewing log', 'Log each alteration or make: what you changed, by how much, and how it turned out.', '#/projects/new', 'Log a project');
  } else {
    const month = today().slice(0, 7);
    const thisMonth = S.projects.filter((p) => (p.date || '').startsWith(month)).length;
    const changes = S.projects.reduce((n, p) => n + p.changes.length, 0);
    html += `<div class="sub">${thisMonth} this month · ${changes} change${changes === 1 ? '' : 's'} logged</div>
      <div>${S.projects.slice().sort(byNewest).slice(0, 3).map(projectRow).join('')}</div>`;
  }
  html += `</section><button class="fab" id="fab" aria-label="Add">+</button>`;

  view.innerHTML = html;
  hydratePhotos();
  $('#fab').onclick = openAddSheet;
}

function openAddSheet() {
  closeSheet();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Add');
  sheet.innerHTML = `
    <a class="s-proj" href="#/projects/new"><span class="ic">${ICONS.proj}</span><span>New project<small>An alteration, make or refashion</small></span></a>
    <a class="s-body" href="#/body/log"><span class="ic">${ICONS.body}</span><span>Log measurements<small>Update what you’ve re-measured</small></span></a>
    <a class="s-fits" href="#/fits/new"><span class="ic">${ICONS.fits}</span><span>New fit<small>Like “Jeans · Relaxed”</small></span></a>
    <button class="cancel">Cancel</button>`;
  bg.onclick = closeSheet;
  $('.cancel', sheet).onclick = closeSheet;
  document.body.append(bg, sheet);
}

function closeSheet() {
  $$('.sheet, .sheet-bg').forEach((el) => el.remove());
}

// After deleting from an edit page, skip past the now-missing detail page too.
function leaveDeleted(fallback) {
  if (navStack.length > 2) history.go(-2);
  else replaceTo(fallback);
}

/* ---------------- Body ---------------- */

function viewBody() {
  const any = S.measurements.length > 0;
  let html = subHead('', '#/', null, '<a class="action" href="#/body/log">Log</a>') + `<h2 class="page-title dot">Body</h2>`;
  if (!any) {
    html += emptyState('Measure once, reuse everywhere',
      'Log your body measurements here. Fit profiles and projects build on them, so you only re-measure when something changes.',
      '#/body/log', 'Log measurements');
  } else {
    const last = S.measurements.reduce((a, m) => (m.date > a ? m.date : a), '');
    html += `<p class="lede">Last measured ${fmtDate(last)}. Tap one to see how it’s changed.</p>`;
  }
  for (const g of groupsOf(types())) {
    html += `<div class="section-label">${esc(g.name)}</div><div class="card">`;
    html += g.items.map((t) => {
      const l = latest(t.key);
      return `<a class="row" href="#/body/m/${t.key}">
        <div class="main"><div class="title">${esc(t.label)}</div><div class="meta">${l ? fmtDate(l.date) : 'Not measured yet'}</div></div>
        <div class="val ${l ? '' : 'empty'}">${l ? fmtLen(l.value) : '—'}</div>${CHEV}</a>`;
    }).join('');
    html += `</div>`;
  }
  view.innerHTML = html;
}

function viewLog(onlyKey) {
  const list = onlyKey ? types().filter((t) => t.key === onlyKey) : types();
  if (!list.length) return replaceTo('#/');
  const back = onlyKey ? `#/body/m/${onlyKey}` : '#/';
  let html = subHead(onlyKey ? list[0].label : 'Log measurements', back, 'Cancel', '<button class="action" id="save">Save</button>');
  html += `<div class="card"><div class="field-grid">
    <div class="field"><label for="date">Date</label><input type="date" id="date" value="${today()}"></div>
    <div class="field"><label for="note">Note</label><input id="note" placeholder="Optional"></div>
  </div></div>`;
  if (!onlyKey) html += `<p class="hint">Fill in what you measured and skip the rest. Grey numbers are your last measurement.</p>`;
  for (const g of groupsOf(list)) {
    html += onlyKey ? '<div style="height:12px"></div>' : `<div class="section-label">${esc(g.name)}</div>`;
    html += `<div class="card">` + g.items.map((t) => {
      const l = latest(t.key);
      return `<div class="measure-input">
        <label for="m_${t.key}">${esc(t.label)}${t.hint ? `<small>${esc(t.hint)}</small>` : ''}</label>
        <input id="m_${t.key}" data-key="${t.key}" inputmode="decimal" autocomplete="off" placeholder="${l ? esc(fmtInput(l.value)) : ''}">
        <span class="unit">in</span></div>`;
    }).join('') + `</div>`;
  }
  html += `<p class="hint">Inches. Decimals work (31.5), and so do fractions typed on a full keyboard (31 1/2).</p>
    <div class="btn-row"><button class="btn" id="save2">Save</button></div>`;
  view.innerHTML = html;

  async function save() {
    const date = $('#date').value || today();
    const note = $('#note').value.trim();
    const entries = [];
    for (const inp of $$('[data-key]')) {
      const v = parseLen(inp.value);
      if (v === null) continue;
      if (Number.isNaN(v) || v <= 0) {
        inp.classList.add('bad');
        inp.focus();
        return toast(`Couldn’t read “${inp.value}”`);
      }
      entries.push({ id: uid(), key: inp.dataset.key, value: v, date, note, createdAt: Date.now() });
    }
    if (!entries.length) return toast('Nothing to save yet');
    for (const e of entries) await DB.put('measurements', e);
    S.measurements.push(...entries);
    toast(entries.length === 1 ? 'Saved' : `Saved ${entries.length} measurements`);
    goBack(back);
  }
  $('#save').onclick = save;
  $('#save2').onclick = save;
  if (onlyKey) $('[data-key]').focus();
}

function viewMeasure(key) {
  const t = typeOf(key);
  if (!t) return replaceTo('#/');
  const hist = historyOf(key);
  let html = subHead(t.label, '#/body', null, `<a class="action" href="#/body/log/${key}">Add</a>`);
  if (!hist.length) {
    html += emptyState('Not measured yet', esc(t.hint || 'Add your first measurement.'), `#/body/log/${key}`, 'Add measurement');
  } else {
    const [cur, prev] = hist;
    const diff = prev ? cur.value - prev.value : 0;
    const change = prev ? ` · ${Math.abs(diff) < 1 / 16 ? 'no change' : fmtLen(diff, { sign: true })} since ${fmtDate(prev.date)}` : '';
    html += `<div class="card pad tint">
      <div class="big-figure">${fmtLen(cur.value, { unit: false })}<span class="u">in</span></div>
      <div class="delta">${fmtDate(cur.date)}${change}</div>
      ${hist.length > 1 ? sparkline(hist.slice().reverse()) : ''}
    </div>`;
    if (t.hint) html += `<p class="hint">How to measure: ${esc(t.hint)}</p>`;
    html += `<div class="section-label">History</div><div class="card">` + hist.map((m) => `
      <div class="row">
        <div class="main"><div class="title">${fmtDate(m.date)}</div>${m.note ? `<div class="meta">${esc(m.note)}</div>` : ''}</div>
        <div class="val">${fmtLen(m.value)}</div>
        <button class="icon-btn" data-del="${m.id}" aria-label="Delete entry">×</button>
      </div>`).join('') + `</div>`;
  }
  const usedBy = S.profiles.filter((p) => p.lines.some((l) => l.ref === key));
  if (usedBy.length) {
    html += `<div class="section-label">Used by these fits</div><div class="card">` + usedBy.map((p) => {
      const l = p.lines.find((x) => x.ref === key);
      return `<a class="row" href="#/fits/${p.id}"><div class="main"><div class="title">${esc(p.garment)} · ${esc(p.fit)}</div>
        <div class="meta">${esc(l.label)}</div></div><div class="val">${fmtLen(lineCalc(l).value)}</div>${CHEV}</a>`;
    }).join('') + `</div>`;
  }
  view.innerHTML = html;
  view.onclick = async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b || !confirm('Delete this entry?')) return;
    await DB.del('measurements', b.dataset.del);
    S.measurements = S.measurements.filter((m) => m.id !== b.dataset.del);
    toast('Deleted');
    render();
  };
}

/* ---------------- Fit profiles ---------------- */

const garmentKind = (g) => (GARMENTS.find((x) => x[0] === g) || [])[1];
const garmentRank = (g) => { const i = GARMENTS.findIndex((x) => x[0] === g); return i < 0 ? 99 : i; };
const suggestedLines = (garment) =>
  (SUGGESTED_LINES[garmentKind(garment)] || []).map(([lbl, ref]) => ({ id: uid(), label: lbl, ref, value: null }));
const profileName = (p) => `${p.garment} · ${p.fit}`;

function viewFits() {
  let html = subHead('', '#/', null, '<a class="action" href="#/fits/new">New</a>') + `<h2 class="page-title dot">Fits</h2>`;
  if (!S.profiles.length) {
    html += emptyState('How do you like things to fit?',
      'Make a profile for each garment and fit, like “Shirt · Fitted” or “Jeans · Relaxed”. Add ease on top of your body measurements and Seam Log works out the finished numbers.',
      '#/fits/new', 'Create a fit profile');
    view.innerHTML = html;
    return;
  }
  html += `<p class="lede">Finished-garment targets. They update on their own when your body measurements change.</p>`;
  const sorted = S.profiles.slice().sort((a, b) => garmentRank(a.garment) - garmentRank(b.garment) || a.fit.localeCompare(b.fit));
  const garments = [...new Set(sorted.map((p) => p.garment))];
  for (const g of garments) {
    html += `<div class="section-label">${esc(g)}</div><div class="card">`;
    html += sorted.filter((p) => p.garment === g).map((p) => {
      const summary = p.lines.map((l) => [l.label, lineCalc(l).value]).filter(([, v]) => v != null).slice(0, 3)
        .map(([lbl, v]) => `${esc(lbl)} ${fmtLen(v)}`).join(' · ');
      return `<a class="row" href="#/fits/${p.id}"><div class="main"><div class="title">${esc(p.fit)}</div>
        <div class="meta">${summary || 'No targets yet'}</div></div>${CHEV}</a>`;
    }).join('');
    html += `</div>`;
  }
  view.innerHTML = html;
}

function viewFit(id) {
  const p = S.profiles.find((x) => x.id === id);
  if (!p) return replaceTo('#/');
  let html = subHead('', '#/', null, `<a class="action" href="#/fits/${id}/edit">Edit</a>`);
  html += `<h2 class="page-title">${esc(profileName(p))}</h2>`;
  if (p.lines.length) {
    html += `<div class="section-label">Finished measurements</div><div class="card tint"><table class="target-table">`;
    html += p.lines.map((l) => {
      const c = lineCalc(l);
      const val = c.missing
        ? `<td class="t-val missing"><a href="#/body/log/${l.ref}">Measure</a></td>`
        : `<td class="t-val ${c.value == null ? 'missing' : ''}">${c.value == null ? '—' : fmtLen(c.value)}</td>`;
      return `<tr><td><div class="t-name">${esc(l.label)}</div><div class="t-how">${esc(c.how)}</div></td>${val}</tr>`;
    }).join('');
    html += `</table></div><p class="hint">Ease is extra room added to your latest body measurement. Negative ease means smaller than your body, like a cropped inseam.</p>`;
  }
  if (p.notes) html += `<div class="section-label">Notes</div><div class="card pad"><p class="notes-text">${esc(p.notes)}</p></div>`;
  const projects = S.projects.filter((x) => x.profileId === id).sort(byNewest);
  if (projects.length) {
    html += `<div class="section-label">Projects with this fit</div><div class="card">` +
      projects.map((x) => `<a class="row" href="#/projects/${x.id}"><div class="main"><div class="title">${esc(x.name)}</div>
        <div class="meta">${fmtDate(x.date)}</div></div>${CHEV}</a>`).join('') + `</div>`;
  }
  view.innerHTML = html;
}

function viewFitEdit(id) {
  const existing = id && S.profiles.find((x) => x.id === id);
  if (id && !existing) return replaceTo('#/');
  const draft = existing
    ? structuredClone(existing)
    : { id: uid(), garment: 'Button-up', fit: '', notes: '', lines: suggestedLines('Button-up'), createdAt: Date.now() };
  draft.lines.forEach((l) => { l.neg = l.ref ? l.value < 0 : false; });
  const back = existing ? `#/fits/${id}` : '#/';

  const typeOptions = (sel) => `<option value="">Set length</option><optgroup label="Body + ease">` +
    types().map((t) => `<option value="${t.key}" ${sel === t.key ? 'selected' : ''}>${esc(t.label)}</option>`).join('') + `</optgroup>`;

  const previewText = (l) => {
    const c = lineCalc(l);
    if (l.ref && !c.missing && l.value == null) return `Your ${typeOf(l.ref).label.toLowerCase()} is ${fmtLen(latest(l.ref).value)}. Add ease on top.`;
    return c.missing || c.value == null ? c.how : `→ ${fmtLen(c.value)} finished · ${c.how}`;
  };

  const lineHtml = (l, i) => `<div class="line-editor">
    <div class="top">
      <input data-line="${i}" data-f="label" value="${esc(l.label)}" placeholder="Name, e.g. Chest" list="dl-labels" aria-label="Name">
      <button class="icon-btn" data-rm="${i}" aria-label="Remove line">×</button>
    </div>
    <div class="bottom">
      <select data-line="${i}" data-f="ref" aria-label="Based on">${typeOptions(l.ref)}</select>
      ${l.ref ? `<button class="sign-btn" data-sign="${i}" aria-label="Toggle plus or minus">${l.neg ? '−' : '+'}</button>` : ''}
      <input data-line="${i}" data-f="value" inputmode="decimal" autocomplete="off" aria-label="${l.ref ? 'Ease' : 'Length'}"
        value="${esc(l._raw ?? fmtInput(l.value == null ? null : Math.abs(l.value)))}" placeholder="${l.ref ? 'ease' : 'length'}">
      <span class="unit">in</span>
    </div>
    <div class="t-how" data-preview="${i}">${esc(previewText(l))}</div>
  </div>`;

  view.innerHTML = subHead(existing ? 'Edit fit' : 'New fit', back, 'Cancel', '<button class="action" id="save">Save</button>') + `
    <div class="card">
      <div class="field-grid">
        <div class="field"><label for="garment">Garment</label>
          <select id="garment" data-bind="garment">${garmentOptions(draft.garment)}</select></div>
        <div class="field"><label for="fit">Fit</label>
          <input id="fit" data-bind="fit" value="${esc(draft.fit)}" placeholder="e.g. Fitted" list="dl-fits" autocomplete="off"></div>
      </div>
    </div>
    <div class="section-label">Measurements</div>
    <div class="card" id="lines"></div>
    <p class="hint">Each line is either a body measurement plus ease (2 means 2″ bigger than your body; tap + to switch to −) or a set length, like 27″ for shirt length.</p>
    <div class="section-label">Notes</div>
    <div class="card"><div class="field"><textarea data-bind="notes" placeholder="What makes this fit work, which patterns or brands match it…">${esc(draft.notes)}</textarea></div></div>
    <div class="btn-row"><button class="btn" id="save2">Save</button></div>
    ${existing ? '<div class="btn-row"><button class="btn danger block" id="delete">Delete fit profile</button></div>' : ''}
    ${datalist('dl-fits', FITS)}${datalist('dl-labels', [...new Set([...types().map((t) => t.label), 'Body length', 'Leg opening', 'Length', 'Hem width'])])}`;

  const drawLines = () => {
    $('#lines').innerHTML = draft.lines.map(lineHtml).join('') + `<button class="add-line" id="add-line">+ Add a measurement</button>`;
  };
  drawLines();

  const untouched = () => draft.lines.every((l) => l.value == null);

  view.oninput = (e) => {
    const el = e.target;
    if (el.dataset.bind) {
      draft[el.dataset.bind] = el.value;
      if (el.dataset.bind === 'garment' && untouched()) { draft.lines = suggestedLines(el.value); drawLines(); }
      return;
    }
    if (el.dataset.line == null) return;
    const i = +el.dataset.line, l = draft.lines[i], f = el.dataset.f;
    if (f === 'value') {
      const v = parseLen(el.value);
      l._raw = el.value;
      el.classList.toggle('bad', Number.isNaN(v));
      if (v === null || Number.isNaN(v)) l.value = null;
      else {
        if (l.ref && v < 0) { l.neg = true; $(`[data-sign="${i}"]`).textContent = '−'; }
        l.value = l.ref ? (l.neg ? -Math.abs(v) : Math.abs(v)) : v;
      }
    } else if (f === 'ref') {
      const oldLabel = l.ref && typeOf(l.ref)?.label;
      l.ref = el.value || null;
      if (!l.ref) l.neg = false;
      if (l.value != null) l.value = l.ref && l.neg ? -Math.abs(l.value) : Math.abs(l.value);
      if (l.ref && (!l.label || l.label === oldLabel)) l.label = typeOf(l.ref).label;
      drawLines();
      return;
    } else {
      l[f] = el.value;
    }
    $(`[data-preview="${i}"]`).textContent = previewText(l);
  };

  view.onclick = (e) => {
    const rm = e.target.closest('[data-rm]');
    const sign = e.target.closest('[data-sign]');
    if (rm) { draft.lines.splice(+rm.dataset.rm, 1); drawLines(); }
    else if (sign) {
      const l = draft.lines[+sign.dataset.sign];
      l.neg = !l.neg;
      if (l.value != null) l.value = l.neg ? -Math.abs(l.value) : Math.abs(l.value);
      drawLines();
    } else if (e.target.id === 'add-line') {
      draft.lines.push({ id: uid(), label: '', ref: null, value: null, neg: false });
      drawLines();
      $(`[data-line="${draft.lines.length - 1}"][data-f="label"]`).focus();
    }
  };

  async function save() {
    draft.fit = draft.fit.trim();
    if (!draft.fit) { $('#fit').focus(); return toast('Name the fit, e.g. Fitted'); }
    const clean = { ...draft, updatedAt: Date.now() };
    clean.lines = draft.lines
      .filter((l) => l.label.trim() || l.ref)
      .map(({ id: lid, label: lbl, ref, value }) => ({ id: lid, label: lbl.trim() || typeOf(ref)?.label || 'Measurement', ref, value }));
    await DB.put('profiles', clean);
    S.profiles = S.profiles.filter((p) => p.id !== clean.id).concat(clean);
    toast('Fit saved');
    if (existing) goBack(`#/fits/${clean.id}`);
    else replaceTo(`#/fits/${clean.id}`);
  }
  $('#save').onclick = save;
  $('#save2').onclick = save;
  if (existing) {
    $('#delete').onclick = async () => {
      if (!confirm(`Delete “${profileName(existing)}”? Projects that used it keep their own notes.`)) return;
      await DB.del('profiles', id);
      S.profiles = S.profiles.filter((p) => p.id !== id);
      toast('Deleted');
      leaveDeleted('#/');
    };
  }
}

/* ---------------- Projects ---------------- */

const projectState = { filter: 'all', query: '' };
const PROJECT_FILTERS = [['all', 'All'], ['alteration', 'Alterations'], ['made', 'Made'], ['refashion', 'Refashions'], ['wip', 'In progress'], ['planned', 'Planned']];

// "32″ → 30½″" when a before measurement was logged for a change.
function beforeAfter(c) {
  const sign = Sketch.SIGN[c.action];
  if (c.before == null || c.amount == null || !sign) return '';
  return `${fmtLen(c.before)} → ${fmtLen(c.before + sign * c.amount)}`;
}

const SKETCH_LEGEND = `<div class="sk-legend"><span><i class="lg-ghost"></i>Original</span><span><i class="lg-hatch"></i>Removed</span><span>Changes drawn bigger so they’re easy to see</span></div>`;

function sketchCard(p) {
  if (!Sketch.supports(p.garment)) return `<p class="hint" style="margin:0">No sketch for “${esc(p.garment)}” garments yet.</p>`;
  return Sketch.render(p) + (Sketch.hasChanges(p) ? SKETCH_LEGEND : `<p class="hint" style="margin:6px 0 0">Add a change with an amount, like Hem · Shorten · 2, to see it drawn here.</p>`);
}

function changeText(c) {
  const verb = actionPast(c.action);
  const amt = c.amount != null ? fmtLen(c.amount) : '';
  return [verb, amt].filter(Boolean).join(' ');
}

function viewProjects() {
  let html = subHead('', '#/', null, '<a class="action" href="#/projects/new">New</a>') + `<h2 class="page-title dot">Projects</h2>`;
  if (!S.projects.length) {
    html += emptyState('Your sewing log',
      'Log each alteration or make: what you changed, by how much, and how it turned out. Next time you’ll know exactly what worked.',
      '#/projects/new', 'Log a project');
    view.innerHTML = html;
    return;
  }
  const year = today().slice(0, 4);
  const changes = S.projects.reduce((n, p) => n + p.changes.length, 0);
  html += `<div class="stats">
    <div class="stat"><b>${S.projects.length}</b><span>projects</span></div>
    <div class="stat"><b>${S.projects.filter((p) => (p.date || '').startsWith(year)).length}</b><span>in ${year}</span></div>
    <div class="stat"><b>${changes}</b><span>changes</span></div>
  </div>
  <div style="height:12px"></div>
  <input class="search" id="q" type="search" placeholder="Search projects, fabric, changes…" value="${esc(projectState.query)}" autocomplete="off">
  <div class="filter-row">${PROJECT_FILTERS.map(([k, l]) => `<button data-filter="${k}" class="${projectState.filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  <div id="plist"></div>`;
  view.innerHTML = html;

  const drawList = () => {
    const q = projectState.query.trim().toLowerCase();
    const f = projectState.filter;
    const list = S.projects.filter((p) => {
      if (f === 'wip' || f === 'planned') { if (p.status !== f) return false; }
      else if (f !== 'all' && p.type !== f) return false;
      if (!q) return true;
      const hay = [p.name, p.garment, p.fabric, p.pattern, p.notes, ...p.changes.map((c) => `${c.area} ${c.note} ${actionPast(c.action)}`)].join(' ').toLowerCase();
      return hay.includes(q);
    }).sort(byNewest);
    $('#plist').innerHTML = list.length ? list.map(projectRow).join('') : `<p class="hint" style="text-align:center;margin-top:24px">No projects match.</p>`;
    hydratePhotos($('#plist'));
  };
  drawList();

  $('#q').oninput = (e) => { projectState.query = e.target.value; drawList(); };
  view.onclick = (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    projectState.filter = b.dataset.filter;
    $$('[data-filter]').forEach((x) => x.classList.toggle('on', x === b));
    drawList();
  };
}

function viewProject(id) {
  const p = S.projects.find((x) => x.id === id);
  if (!p) return replaceTo('#/');
  const profile = S.profiles.find((x) => x.id === p.profileId);
  let html = subHead('', '#/projects', null, `<a class="action" href="#/projects/${id}/edit">Edit</a>`);
  html += `<h2 class="page-title">${esc(p.name)}</h2>
    <div class="page-meta"><span>${[fmtDate(p.date), label(PROJECT_TYPES, p.type), p.garment].filter(Boolean).map(esc).join(' · ')}</span>
    <span class="pill ${p.status === 'done' ? '' : 'accent'}">${label(STATUSES, p.status)}</span></div>`;
  if (Sketch.supports(p.garment) && p.changes.length) html += `<div class="card pad tint sketch-card">${sketchCard(p)}</div>`;
  if (p.photoIds.length) {
    html += `<div class="card"><div class="photos">${p.photoIds.map((pid) => `<div class="ph" data-open><div class="img" data-photo="${pid}"></div></div>`).join('')}</div></div>`;
  }
  html += `<div class="section-label">Changes</div>`;
  html += p.changes.length
    ? `<div class="card change-list">` + p.changes.map((c) => `<div class="row">
        <div class="main"><div class="title">${esc(c.area || 'Change')}</div>${c.note || beforeAfter(c) ? `<div class="meta" style="white-space:normal">${esc([beforeAfter(c), c.note].filter(Boolean).join(' · '))}</div>` : ''}</div>
        <div class="change-amt">${esc(changeText(c))}</div></div>`).join('') + `</div>`
    : `<div class="card pad"><span class="hint" style="margin:0">No changes logged.</span></div>`;

  const details = [
    profile && ['Fit', `<a href="#/fits/${profile.id}">${esc(profileName(profile))}</a>`],
    p.fabric && ['Fabric', esc(p.fabric)],
    p.pattern && ['Pattern', esc(p.pattern)],
    p.rating && ['Result', `<span class="stars-static" aria-label="${p.rating} of 5">${'★'.repeat(p.rating)}${'☆'.repeat(5 - p.rating)}</span>`],
  ].filter(Boolean);
  if (details.length) {
    html += `<div class="section-label">Details</div><div class="card pad"><dl class="kv">${details.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`;
  }
  if (p.notes) html += `<div class="section-label">Notes</div><div class="card pad"><p class="notes-text">${esc(p.notes)}</p></div>`;
  view.innerHTML = html;
  hydratePhotos();
  view.onclick = (e) => {
    const ph = e.target.closest('[data-open]');
    const img = ph && $('img', ph);
    if (img) lightbox(img.src);
  };
}

function viewProjectEdit(id) {
  const existing = id && S.projects.find((x) => x.id === id);
  if (id && !existing) return replaceTo('#/');
  const draft = existing ? structuredClone(existing) : {
    id: uid(), name: '', date: today(), status: 'done', type: 'alteration', garment: 'Pants', profileId: '',
    changes: [{ id: uid(), area: '', action: 'take_in', amount: null, note: '' }], photoIds: [],
    fabric: '', pattern: '', notes: '', rating: 0, createdAt: Date.now(),
  };
  const newPhotos = []; // { id, blob, url } not yet saved
  const removed = new Set();
  let photoJob = Promise.resolve(); // resizing in progress; save waits for it
  const back = existing ? `#/projects/${id}` : '#/';

  const seg = (name, options) => `<div class="seg" data-seg="${name}">${options.map(([k, l]) =>
    `<button type="button" data-v="${k}" class="${draft[name] === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;

  const profileOptions = () => `<option value="">None</option>` + S.profiles.slice()
    .sort((a, b) => (b.garment === draft.garment) - (a.garment === draft.garment) || profileName(a).localeCompare(profileName(b)))
    .map((p) => `<option value="${p.id}" ${draft.profileId === p.id ? 'selected' : ''}>${esc(profileName(p))}</option>`).join('');

  const changeHtml = (c, i) => `<div class="line-editor">
    <div class="top">
      <input data-chg="${i}" data-f="area" value="${esc(c.area)}" placeholder="Where, e.g. Waist" list="dl-areas" aria-label="Area">
      <button class="icon-btn" data-rmchg="${i}" aria-label="Remove change">×</button>
    </div>
    <div class="bottom">
      <select data-chg="${i}" data-f="action" aria-label="What you did">${ACTIONS.map(([k, l]) => `<option value="${k}" ${c.action === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input data-chg="${i}" data-f="amount" inputmode="decimal" autocomplete="off" value="${esc(c._raw ?? fmtInput(c.amount))}" placeholder="amount" aria-label="Amount">
      <span class="unit">in</span>
    </div>
    <div class="bottom">
      <label class="mini-label" for="before-${i}">Measured before</label>
      <input id="before-${i}" data-chg="${i}" data-f="before" inputmode="decimal" autocomplete="off" value="${esc(c._rawBefore ?? fmtInput(c.before))}" placeholder="optional">
      <span class="unit">in</span>
    </div>
    <div class="t-how" data-after="${i}">${afterHint(c)}</div>
    <input class="note" data-chg="${i}" data-f="note" value="${esc(c.note)}" placeholder="Notes, e.g. ¾″ off each side seam" aria-label="Notes">
  </div>`;
  function afterHint(c) {
    const ba = beforeAfter(c);
    return ba ? `Now ${ba.split('→ ')[1]}` : '';
  }

  view.innerHTML = subHead(existing ? 'Edit project' : 'New project', back, 'Cancel', '<button class="action" id="save">Save</button>') + `
    <div class="card">
      <div class="field"><label for="name">Name</label><input id="name" data-bind="name" value="${esc(draft.name)}" placeholder="e.g. Thrifted Levi’s 501s" autocomplete="off"></div>
      <div class="field-grid">
        <div class="field"><label for="date">Date</label><input type="date" id="date" data-bind="date" value="${esc(draft.date)}"></div>
        <div class="field"><label for="garment">Garment</label>
          <select id="garment" data-bind="garment">${garmentOptions(draft.garment)}</select></div>
      </div>
      <div class="field"><label for="profile">Fit profile</label><select id="profile" data-bind="profileId">${profileOptions()}</select></div>
      <div class="field"><span class="label">Type</span>${seg('type', PROJECT_TYPES)}</div>
      <div class="field"><span class="label">Status</span>${seg('status', STATUSES)}</div>
    </div>
    <div class="section-label">Changes</div>
    <div class="card" id="changes"></div>
    <div class="section-label">Sketch</div>
    <div class="card pad tint sketch-card" id="sketch"></div>
    <div class="section-label">Photos</div>
    <div class="card"><div class="photos" id="photos"></div></div>
    <div class="section-label">Details</div>
    <div class="card">
      <div class="field-grid">
        <div class="field"><label for="fabric">Fabric</label><input id="fabric" data-bind="fabric" value="${esc(draft.fabric)}" placeholder="e.g. 12oz denim"></div>
        <div class="field"><label for="pattern">Pattern</label><input id="pattern" data-bind="pattern" value="${esc(draft.pattern)}" placeholder="Optional"></div>
      </div>
      <div class="field"><span class="label">How it turned out</span><div class="stars" id="stars"></div></div>
      <div class="field"><label for="notes">Notes</label><textarea id="notes" data-bind="notes" placeholder="What worked, what you’d do differently…">${esc(draft.notes)}</textarea></div>
    </div>
    <div class="btn-row"><button class="btn" id="save2">Save</button></div>
    ${existing ? '<div class="btn-row"><button class="btn danger block" id="delete">Delete project</button></div>' : ''}
    ${datalist('dl-areas', AREAS)}
    <input type="file" id="file" accept="image/*" multiple hidden>`;

  const drawSketch = () => { $('#sketch').innerHTML = sketchCard(draft); };
  const drawChanges = () => {
    $('#changes').innerHTML = draft.changes.map(changeHtml).join('') + `<button class="add-line" id="add-change">+ Add a change</button>`;
    drawSketch();
  };
  const drawPhotos = () => {
    if (!$('#photos')) return;
    const tiles = draft.photoIds.map((pid) => `<div class="ph"><div class="img" data-photo="${pid}"></div><button class="icon-btn" data-rmph="${pid}" aria-label="Remove photo">×</button></div>`)
      .concat(newPhotos.map((np) => `<div class="ph"><div class="img"><img src="${np.url}" alt=""></div><button class="icon-btn" data-rmph="${np.id}" aria-label="Remove photo">×</button></div>`));
    $('#photos').innerHTML = tiles.join('') + `<label class="add-ph" for="file"><span>+</span>Add photo</label>`;
    hydratePhotos($('#photos'));
  };
  const drawStars = () => {
    $('#stars').innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" class="${n <= draft.rating ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('');
  };
  drawChanges();
  drawPhotos();
  drawStars();

  view.oninput = (e) => {
    const el = e.target;
    if (el.dataset.bind) {
      draft[el.dataset.bind] = el.value;
      if (el.dataset.bind === 'garment') drawSketch();
      return;
    }
    if (el.dataset.chg == null) return;
    const i = +el.dataset.chg, c = draft.changes[i], f = el.dataset.f;
    if (f === 'amount' || f === 'before') {
      const v = parseLen(el.value);
      c[f === 'amount' ? '_raw' : '_rawBefore'] = el.value;
      el.classList.toggle('bad', Number.isNaN(v));
      c[f] = v === null || Number.isNaN(v) ? null : Math.abs(v);
    } else {
      c[f] = el.value;
    }
    $(`[data-after="${i}"]`).textContent = afterHint(c);
    drawSketch();
  };

  view.onclick = (e) => {
    const t = e.target;
    const segBtn = t.closest('[data-seg] button');
    if (segBtn) {
      const name = segBtn.parentElement.dataset.seg;
      draft[name] = segBtn.dataset.v;
      $$('button', segBtn.parentElement).forEach((b) => b.classList.toggle('on', b === segBtn));
      return;
    }
    const star = t.closest('[data-star]');
    if (star) { const n = +star.dataset.star; draft.rating = draft.rating === n ? 0 : n; drawStars(); return; }
    const rmc = t.closest('[data-rmchg]');
    if (rmc) { draft.changes.splice(+rmc.dataset.rmchg, 1); drawChanges(); return; }
    if (t.id === 'add-change') {
      draft.changes.push({ id: uid(), area: '', action: 'take_in', amount: null, note: '' });
      drawChanges();
      $(`[data-chg="${draft.changes.length - 1}"][data-f="area"]`).focus();
      return;
    }
    const rmp = t.closest('[data-rmph]');
    if (rmp) {
      const pid = rmp.dataset.rmph;
      if (draft.photoIds.includes(pid)) { draft.photoIds = draft.photoIds.filter((x) => x !== pid); removed.add(pid); }
      else newPhotos.splice(newPhotos.findIndex((np) => np.id === pid), 1);
      drawPhotos();
    }
  };

  $('#file').onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    photoJob = photoJob.then(async () => {
      for (const f of files) {
        try {
          const blob = await resizeImage(f);
          newPhotos.push({ id: uid(), blob, url: trackUrl(URL.createObjectURL(blob)) });
        } catch {
          toast('Couldn’t read that photo');
        }
      }
      drawPhotos();
    });
  };

  async function save() {
    draft.name = draft.name.trim();
    if (!draft.name) { $('#name').focus(); return toast('Give the project a name'); }
    await photoJob;
    if ($('.bad', view)) { $('.bad', view).focus(); return toast('One of the amounts isn’t a number'); }
    for (const np of newPhotos) {
      await DB.put('photos', { id: np.id, projectId: draft.id, blob: np.blob, createdAt: Date.now() });
      draft.photoIds.push(np.id);
    }
    for (const pid of removed) await DB.del('photos', pid);
    draft.changes = draft.changes
      .filter((c) => c.area.trim() || c.note.trim() || c.amount != null)
      .map(({ _raw, _rawBefore, ...c }) => ({ ...c, before: c.before ?? null, area: c.area.trim(), note: c.note.trim() }));
    draft.updatedAt = Date.now();
    await DB.put('projects', draft);
    S.projects = S.projects.filter((p) => p.id !== draft.id).concat(draft);
    toast('Project saved');
    if (existing) goBack(`#/projects/${draft.id}`);
    else replaceTo(`#/projects/${draft.id}`);
  }
  $('#save').onclick = save;
  $('#save2').onclick = save;
  if (existing) {
    $('#delete').onclick = async () => {
      if (!confirm(`Delete “${existing.name}” and its photos?`)) return;
      for (const pid of existing.photoIds) await DB.del('photos', pid);
      await DB.del('projects', id);
      S.projects = S.projects.filter((p) => p.id !== id);
      toast('Deleted');
      leaveDeleted('#/');
    };
  }
  if (!existing) $('#name').focus();
}

/* ---------------- More: backup, custom measurements ---------------- */

const blobToDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

async function buildBackup() {
  const data = { app: 'seam-log', version: 1, exportedAt: new Date().toISOString() };
  for (const s of ['measurements', 'profiles', 'projects', 'meta']) data[s] = await DB.all(s);
  const photos = await DB.all('photos');
  data.photos = await Promise.all(photos.map(async (p) => ({ ...p, blob: await blobToDataURL(p.blob) })));
  return new File([JSON.stringify(data)], `seam-log-backup-${today()}.json`, { type: 'application/json' });
}

// Must run straight from a tap: iOS only opens the share sheet with a fresh user gesture.
async function deliverFile(file) {
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

async function restoreBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('That file isn’t a backup'); }
  if (data.app !== 'seam-log') return toast('That file isn’t a Seam Log backup');
  if (!confirm(`Replace everything on this device with the backup from ${fmtDate(data.exportedAt.slice(0, 10))}?`)) return;
  for (const s of DB.STORES) await DB.clear(s);
  for (const s of ['measurements', 'profiles', 'projects', 'meta']) for (const r of data[s] || []) await DB.put(s, r);
  for (const p of data.photos || []) await DB.put('photos', { ...p, blob: await (await fetch(p.blob)).blob() });
  await loadAll();
  toast('Backup restored');
  replaceTo('#/');
}

async function viewMore() {
  const custom = S.settings.customTypes;
  view.innerHTML = subHead('', '#/') + `<h2 class="page-title">Settings</h2>
    <div class="section-label">Backup to Google Drive</div>
    <div class="card">
      <button class="row as-btn" id="export"><div class="main"><div class="title">Back up now</div>
        <div class="meta">Everything, photos included, in one file</div></div>${CHEV}</button>
      <label class="row as-btn" for="import-file"><div class="main"><div class="title">Restore from backup</div>
        <div class="meta">Pick a backup file from Google Drive</div></div>${CHEV}</label>
    </div>
    <div id="export-ready"></div>
    <p class="hint">Your data lives only on this phone. Every few weeks, tap Back up now, then Save backup file, and choose <b>Drive</b> in the share sheet (or Save to Files → Google Drive). Needs the Google Drive app. Restoring replaces what’s on this phone.</p>
    <input type="file" id="import-file" accept="application/json,.json" hidden>

    <div class="section-label">Custom measurements</div>
    <div class="card">
      ${custom.map((t) => `<div class="row"><div class="main"><div class="title">${esc(t.label)}</div><div class="meta">${esc(t.group)}</div></div>
        <button class="icon-btn" data-rmtype="${t.key}" aria-label="Delete ${esc(t.label)}">×</button></div>`).join('')}
      <div class="field"><label for="new-type">Add a measurement</label><input id="new-type" placeholder="e.g. Across back, Bust, Hand" autocomplete="off"></div>
      <div class="field-grid">
        <div class="field"><label for="new-group">Section</label><select id="new-group">${GROUP_ORDER.map((g) => `<option ${g === 'Custom' ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div class="field" style="display:flex;align-items:center;justify-content:flex-end"><button class="btn small" id="add-type">Add</button></div>
      </div>
    </div>

    <div class="section-label">Storage</div>
    <div class="card pad"><div class="meta" id="storage" style="color:var(--ink-2);font-size:15px">Checking…</div></div>
    <p class="hint" style="text-align:center;margin-top:28px">Seam Log · version 2 · measurements in inches</p>`;

  $('#export').onclick = async () => {
    const box = $('#export-ready');
    box.innerHTML = `<p class="hint">Preparing…</p>`;
    const file = await buildBackup();
    const mb = (file.size / 1048576).toFixed(file.size > 1048576 ? 1 : 2);
    box.innerHTML = `<div class="btn-row"><button class="btn block" id="save-backup">Save backup file (${mb} MB)</button></div>`;
    $('#save-backup').onclick = () => deliverFile(file);
  };
  $('#import-file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restoreBackup(f); };

  $('#add-type').onclick = async () => {
    const name = $('#new-type').value.trim();
    if (!name) return $('#new-type').focus();
    if (types().some((t) => t.label.toLowerCase() === name.toLowerCase())) return toast('You already track that');
    S.settings.customTypes.push({ key: 'c' + uid(), label: name, group: $('#new-group').value, custom: true });
    await DB.put('meta', S.settings);
    toast(`Added ${name}`);
    render();
  };
  view.onclick = async (e) => {
    const b = e.target.closest('[data-rmtype]');
    if (!b) return;
    const key = b.dataset.rmtype;
    const n = S.measurements.filter((m) => m.key === key).length;
    if (!confirm(n ? `Delete this measurement and its ${n} logged ${n === 1 ? 'entry' : 'entries'}?` : 'Delete this measurement?')) return;
    for (const m of S.measurements.filter((x) => x.key === key)) await DB.del('measurements', m.id);
    S.measurements = S.measurements.filter((m) => m.key !== key);
    S.settings.customTypes = S.settings.customTypes.filter((t) => t.key !== key);
    await DB.put('meta', S.settings);
    render();
  };

  const est = await navigator.storage?.estimate?.();
  const persisted = await navigator.storage?.persisted?.();
  const el = $('#storage');
  if (el) {
    el.textContent = est
      ? `Using ${(est.usage / 1048576).toFixed(1)} MB on this device.${persisted ? ' Storage is marked persistent.' : ''}`
      : 'Storage details aren’t available in this browser.';
  }
}

/* ---------------- Router ---------------- */

const routes = [
  [/^#\/$/, viewHome],
  [/^#\/body$/, viewBody],
  [/^#\/body\/log(?:\/(\w+))?$/, viewLog],
  [/^#\/body\/m\/(\w+)$/, viewMeasure],
  [/^#\/fits$/, viewFits],
  [/^#\/fits\/new$/, () => viewFitEdit(null)],
  [/^#\/fits\/(\w+)\/edit$/, viewFitEdit],
  [/^#\/fits\/(\w+)$/, viewFit],
  [/^#\/projects$/, viewProjects],
  [/^#\/projects\/new$/, () => viewProjectEdit(null)],
  [/^#\/projects\/(\w+)\/edit$/, viewProjectEdit],
  [/^#\/projects\/(\w+)$/, viewProject],
  [/^#\/more$/, viewMore],
];

const SECTION_OF = { body: 'body', fits: 'fits', projects: 'proj' };

let lastHash = '';
async function render() {
  const hash = location.hash || '#/';
  const route = routes.find(([re]) => re.test(hash));
  if (!route) { replaceTo('#/'); return; }
  trackNav(hash);
  closeSheet();
  revokeUrls();
  view.oninput = view.onclick = null;
  const section = SECTION_OF[hash.split('/')[1]];
  if (section) view.dataset.section = section;
  else delete view.dataset.section;
  await route[1](...hash.match(route[0]).slice(1));
  if (hash !== lastHash) window.scrollTo(0, 0);
  lastHash = hash;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-back]');
  if (b) { e.preventDefault(); goBack(b.dataset.back); }
});

window.addEventListener('hashchange', render);

(async function boot() {
  await loadAll();
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/');
  render();
  navigator.storage?.persist?.();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
