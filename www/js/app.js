import { CALENDARS, today, dayFromISO, isoFromDay, weekday } from './calendars.js';
import { FREQUENCIES, status, lumpSum, firstFromStart, firstFromRemaining } from './schedule.js';
import { LANGS, makeI18n, currencies, parseNumber, guessDefaults } from './i18n.js';
import { load, save, exportFile, parseImport } from './store.js';
import { initPwa, applyUpdate, isBrowser, standalone, iosManualInstall, canPromptInstall, promptInstall, requestPersistentStorage } from './pwa.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CAL_ORDER = ['jalali', 'gregorian', 'hijri'];
const YEAR_RANGE = { gregorian: [1900, 2200], jalali: [1280, 1580], hijri: [1320, 1590] };

let doc;          // persisted document
let I;            // i18n for current prefs
let todayN;       // today's day number, refreshed on every render
let draft = null; // commitment being edited
let detailId = null; // commitment shown in the details sheet

// --- boot -----------------------------------------------------------------------

async function init() {
  doc = await load(guessDefaults(navigator.language));
  applyPrefs();
  render();

  $('addBtn').onclick = () => openEditor(null);
  $('settingsBtn').onclick = openSettings;
  $('list').onclick = e => {
    const row = e.target.closest('[data-id]');
    if (row) openDetails(row.dataset.id);
  };
  $('detailsBody').onclick = e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') closeSheet();
    if (act === 'edit') openEditor(detailId, true);
  };
  $('lumpBtn').onclick = () => { openSheet($('lumpSheet')); $('lumpAmount').focus(); };
  $('lumpClose').onclick = closeSheet;
  $('lumpAmount').oninput = renderLump;
  $('lumpCurrency').onchange = renderLump;
  $('importFile').onchange = onImport;
  window.addEventListener('resize', fitTotals);
  document.fonts?.ready.then(fitTotals); // first fit may have measured the fallback font
  document.addEventListener('visibilitychange', () => { if (!document.hidden && today() !== todayN) render(); });

  initPwa({
    updateReady: () => { $('updateBtn').hidden = false; },
    installChanged: () => { if ($('settings').open) renderSettings(); },
  });
  $('updateBtn').onclick = applyUpdate;

  // Android back closes the open sheet: each sheet pushes a history entry.
  window.addEventListener('popstate', () => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });
    d.addEventListener('click', e => { if (e.target === d) closeSheet(); }); // backdrop tap
  }
}

function applyPrefs() {
  I = makeI18n(doc.prefs.lang, doc.prefs.displayCalendar);
  const root = document.documentElement;
  root.lang = doc.prefs.lang;
  root.dir = I.dir;
  document.title = I.t.app;
}

function persist() {
  save(doc).catch(e => console.error('save failed', e));
  requestPersistentStorage();
}

/** Open a sheet. `replace` swaps it for the one already open (details → editor) under one history entry. */
function openSheet(dialog, replace = false) {
  if (replace) document.querySelectorAll('dialog[open]').forEach(d => d.close());
  dialog.showModal();
  dialog.scrollTop = 0;
  if (replace) history.replaceState({ sheet: dialog.id }, '');
  else history.pushState({ sheet: dialog.id }, '');
}

function closeSheet() {
  if (document.querySelector('dialog[open]')) history.back();
}

// --- main screen -----------------------------------------------------------------

function render() {
  todayN = today();
  const { t } = I;
  $('brand').textContent = t.app;
  $('settingsBtn').setAttribute('aria-label', t.settings);
  $('addBtn').textContent = t.add;
  $('updateBtn').textContent = t.updateBtn;
  $('foot').textContent = doc.commitments.length ? t.foot : '';
  $('lumpTitle').textContent = t.lumpTitle;
  $('lumpBtn').textContent = t.lumpTitle;
  $('lumpClose').setAttribute('aria-label', t.close);
  $('lumpHint').textContent = t.lumpHint;
  $('lumpLabel').textContent = t.lumpLabel;

  const rows = doc.commitments
    .map(c => ({ c, cur: c.currency || doc.prefs.currency, s: status(c, todayN) }))
    .sort((a, b) => (a.s.done - b.s.done) || (a.s.done ? b.s.end - a.s.end : a.s.end - b.s.end));

  $('summary').innerHTML = renderSummary(rows);
  fitTotals();
  const priced = rows.filter(r => !r.s.done && r.c.apr);
  const maxApr = priced.length > 1 ? Math.max(...priced.map(r => r.c.apr)) : null;
  hottest = maxApr;
  $('list').innerHTML = rows.map(r => renderRow(r, r.c.apr === maxApr && !r.s.done)).join('');
  if ($('details').open) renderDetails(); // e.g. the date rolled over while it was open
  renderLump();
}

function currencyOrder(set) {
  return [...set].sort((a, b) => (b === doc.prefs.currency) - (a === doc.prefs.currency) || a.localeCompare(b));
}

function renderSummary(rows) {
  const { t, money, monthYear } = I;
  if (!rows.length) return `<div class="empty"><h1>${t.emptyTitle}</h1><p>${t.emptyHint}</p></div>`;

  const active = rows.filter(r => !r.s.done);
  const groups = new Map();
  for (const { cur, s } of active) {
    const g = groups.get(cur) || { principal: 0, owed: 0, interest: 0, monthly: 0 };
    g.principal += s.principal; g.owed += s.owed; g.interest += s.interest; g.monthly += s.monthly;
    groups.set(cur, g);
  }
  const order = currencyOrder(groups.keys());
  const end = active.length ? Math.max(...active.map(r => r.s.end)) : null;

  const totals = order.map((cur, i) => {
    const g = groups.get(cur);
    const interest = g.interest >= 0.5 ? money(g.interest, cur) : '';
    return `<p class="total${i ? ' more' : ''}">${money(g.principal, cur, true)}</p>
      <p class="sub">${esc(t.totalSub(money(g.owed, cur, true), interest))}</p>`;
  }).join('');

  return `<h1>${t.totalTitle}</h1>
    ${active.length ? totals : `<p class="total">${t.allDone}</p>`}
    <div class="facts">
      ${active.length ? `<div>${order.map(c => `<b>${money(groups.get(c).monthly, c, true)}</b>`).join('')}<span>${t.monthlyFact}</span></div>` : ''}
      <div><b>${end != null ? monthYear(end) : '—'}</b><span>${t.endFact}</span></div>
    </div>`;
}

/** Shrink the big totals to one line; the system font scale can make them wider than the screen. */
function fitTotals() {
  for (const el of document.querySelectorAll('.total')) {
    el.style.fontSize = '';
    // Re-measure each step: Android's text zoom multiplies whatever size we set.
    let size = parseFloat(getComputedStyle(el).fontSize);
    for (let i = 0; i < 6 && el.scrollWidth > el.clientWidth; i++) {
      size *= (el.clientWidth / el.scrollWidth) * 0.98;
      el.style.fontSize = `${size}px`;
    }
  }
}

function tickColumns(n) {
  return n <= 12 ? n : n <= 40 ? 12 : n <= 50 ? 13 : n <= 60 ? 15 : 20;
}

let hottest = null; // highest APR among active commitments, when more than one has interest

/** One compact row on the home screen: what matters at a glance. */
function renderRow({ c, cur, s }, hot) {
  const { t, num, money, monthYear } = I;
  const meta = s.done ? t.finishedOn(monthYear(s.end)) : t.leftEnds(num(s.remaining), num(c.total), monthYear(s.end));
  return `<button type="button" class="card loan-row${hot ? ' hot' : ''}${s.done ? ' done' : ''}" data-id="${esc(c.id)}">
    <span class="lr-top"><span class="name">${esc(c.name)}</span><span class="lr-amt">${s.done ? '' : money(s.principal, cur)}</span></span>
    <span class="mini" aria-hidden="true"><i style="inline-size:${(100 * s.paid) / c.total}%"></i></span>
    <span class="lr-meta">${esc(meta)}</span>
  </button>`;
}

function openDetails(id) {
  detailId = id;
  renderDetails();
  openSheet($('details'));
}

function renderDetails() {
  const c = doc.commitments.find(x => x.id === detailId);
  if (!c) return;
  const r = { c, cur: c.currency || doc.prefs.currency, s: status(c, todayN) };
  $('detailsBody').innerHTML = renderDetail(r, c.apr === hottest && !r.s.done);
}

/** Everything about one commitment, shown in the details sheet. */
function renderDetail({ c, cur, s }, hot) {
  const { t, num, money, date, monthYear } = I;
  const progress = c.total <= 120
    ? `<div class="ticks" style="grid-template-columns:repeat(${tickColumns(c.total)},1fr)">${
        Array.from({ length: c.total }, (_, i) => `<i class="${i < s.paid ? 'p' : i === s.paid ? 'n' : ''}"></i>`).join('')}</div>`
    : `<div class="bar"><i style="inline-size:${(100 * s.paid) / c.total}%"></i></div>`;
  const rate = c.apr ? t.apr(num(c.apr, 2)) + (hot ? t.hottest : '') : t.noInterest;

  return `<div class="sheet" tabindex="-1" autofocus>
    <header><h2>${esc(c.name)}</h2>
      <button type="button" class="icon" data-act="close" aria-label="${t.close}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
    <p class="rate${hot ? ' hot' : ''}">${rate}</p>
    <div role="img" aria-label="${esc(t.progressLabel(num(s.paid), num(c.total)))}">${progress}</div>
    <div class="nums">
      <div><b>${t.of(num(s.remaining), num(c.total))}</b>${t.paymentsLeft}</div>
      <div><b>${money(s.principal, cur, true)}</b>${c.apr ? t.principalLeft : t.amountLeft}</div>
      <div><b>${c.apr ? money(s.interest, cur) : '—'}</b>${t.interestLeft}</div>
    </div>
    <div class="nums">
      <div><b>${money(c.amount, cur, true)}</b>${t.perPayment[c.frequency]}</div>
      <div><b>${s.next != null ? date(s.next) : t.finished}</b>${t.next}</div>
      <div><b>${monthYear(s.end)}</b>${t.end}</div>
    </div>
    <div class="last">${t.lastPaid}: <b>${s.lastPaid != null ? date(s.lastPaid) : t.nonePaid}</b></div>
    <div class="actions"><button type="button" class="primary" data-act="edit">${t.edit}</button></div>
  </div>`;
}

function renderLump() {
  const { t, money } = I;
  const eligible = doc.commitments.filter(c => c.apr && !status(c, todayN).done);
  $('lumpBtn').hidden = !eligible.length;
  if (!eligible.length) return;

  const curs = currencyOrder(new Set(eligible.map(c => c.currency || doc.prefs.currency)));
  const sel = $('lumpCurrency');
  const prev = sel.value;
  sel.hidden = curs.length < 2;
  sel.innerHTML = curs.map(c => `<option value="${c}">${c === 'IRT' ? esc(t.toman) : c}</option>`).join('');
  sel.value = curs.includes(prev) ? prev : curs[0];

  const x = parseNumber($('lumpAmount').value);
  if (!(x > 0)) { $('lumpRes').innerHTML = ''; return; }
  const cur = sel.value;
  const opts = eligible
    .filter(c => (c.currency || doc.prefs.currency) === cur)
    .map(c => ({ c, r: lumpSum(c, todayN, x) }))
    .sort((a, b) => b.r.saved - a.r.saved);
  $('lumpRes').innerHTML = opts.map(({ c, r }, i) => `
    <div class="opt${i === 0 && opts.length > 1 ? ' best' : ''}">
      <div>${esc(c.name)}<small>${t.monthsSooner(r.monthsCut, I.num(r.monthsCut))}${r.settles ? t.settles : ''}</small></div>
      <div class="save">${money(r.saved, cur)}</div>
    </div>`).join('');
}

// --- editor --------------------------------------------------------------------

function seg(name, options, value) {
  return `<div class="seg" role="radiogroup">${options.map(([v, label]) =>
    `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(value) ? ' checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div>`;
}

function field(name, label, control, hint = '') {
  return `<div class="field" data-field="${name}"><label>${esc(label)}</label>${control}${hint ? `<small class="hint">${esc(hint)}</small>` : ''}</div>`;
}

const text = (name, value, cls = 'num', mode = 'decimal') =>
  `<input type="text" name="${name}" class="${cls}" inputmode="${mode}" autocomplete="off" value="${esc(value ?? '')}">`;

function currencyOptions(selected, withDefault) {
  const { t, currencyName } = I;
  const all = currencies().map(code => [code, `${currencyName(code)} (${code})`]);
  const pinned = ['IRT', 'IRR', 'GBP', 'EUR', 'USD'];
  const top = all.filter(([c]) => pinned.includes(c)).sort((a, b) => pinned.indexOf(a[0]) - pinned.indexOf(b[0]));
  const rest = all.filter(([c]) => !pinned.includes(c)).sort((a, b) => a[1].localeCompare(b[1], I.lang));
  const opt = ([v, l]) => `<option value="${v}"${v === selected ? ' selected' : ''}>${esc(l)}</option>`;
  return (withDefault ? `<option value=""${!selected ? ' selected' : ''}>${esc(`${t.dflt} · ${doc.prefs.currency === 'IRT' ? t.toman : doc.prefs.currency}`)}</option>` : '')
    + top.map(opt).join('') + '<option disabled>──────</option>' + rest.map(opt).join('');
}

function openEditor(id, fromDetails = false) {
  const c = id && doc.commitments.find(x => x.id === id);
  const cal = c ? c.calendar : doc.prefs.displayCalendar;
  const p = CALENDARS[cal].toParts(todayN);
  draft = c
    ? { ...c, apr: c.apr ?? '', mode: 'remaining', remaining: status(c, todayN).remaining, startN: dayFromISO(c.first) }
    : {
        id: null, name: '', amount: '', currency: null, frequency: 'monthly', calendar: cal,
        payDay: p.d, total: '', apr: '', mode: 'start', remaining: '', startN: todayN,
      };
  draft.wd = draft.frequency === 'weekly' ? draft.payDay : weekday(todayN);
  draft.md = draft.frequency === 'monthly' ? draft.payDay : p.d;
  draft.yd = draft.frequency === 'yearly' ? draft.payDay : { m: p.m, d: p.d };
  renderEditor();
  openSheet($('editor'), fromDetails);
  if (!c) $('editForm').elements.name.focus();
}

function renderEditor(errors = {}) {
  const { t, plain, num, monthNames, weekdays } = I;
  const d = draft;
  const C = CALENDARS[d.calendar];
  const months = monthNames(d.calendar).map((n, i) => [i + 1, n]);
  // Days and years are picked, not typed: one tap opens the native picker on phones.
  const days = max => Array.from({ length: max }, (_, i) => [i + 1, num(i + 1)]);
  const sp = C.toParts(d.startN ?? todayN);
  const thisYear = C.toParts(todayN).y;
  const [yLo, yHi] = YEAR_RANGE[d.calendar];
  const years = [];
  for (let y = Math.max(yLo, Math.min(sp.y, thisYear - 40)); y <= Math.min(yHi, Math.max(sp.y, thisYear + 10)); y++) years.push([y, plain(y)]);
  const sel = (name, opts, v) => `<select name="${name}">${opts.map(([k, l]) => `<option value="${k}"${String(k) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const n = v => (v === '' || v == null || Number.isNaN(v) ? v ?? '' : typeof v === 'number' ? plain(v) : v);

  const payDay = {
    daily: '',
    weekly: field('wd', t.payWeekday, sel('wd', weekdays(), d.wd)),
    monthly: field('md', t.payMonthDay, sel('md', days(31), d.md), t.payMonthDayHint),
    yearly: field('yd', t.payYearDay, `<div class="split">${sel('ydd', days(31), d.yd.d)}${sel('ydm', months, d.yd.m)}</div>`, t.payMonthDayHint),
  }[d.frequency];

  const when = d.mode === 'start'
    ? field('start', t.startDate, `<div class="split3">${sel('sd', days(C.monthLength(sp.y, sp.m)), sp.d)}${sel('sm', months, sp.m)}${sel('sy', years, sp.y)}</div>`, t.startHint)
    : field('remaining', t.remaining, text('remaining', n(d.remaining), 'num', 'numeric'), t.remainingHint);

  $('editForm').innerHTML = `<div class="sheet" tabindex="-1" autofocus>
    <header><h2>${d.id ? t.editTitle : t.newTitle}</h2>
      <button type="button" class="icon" data-act="close" aria-label="${t.close}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
    ${field('name', t.name, `<input type="text" name="name" value="${esc(d.name)}" placeholder="${esc(t.namePh)}" autocomplete="off">`)}
    <div class="split">
      ${field('amount', t.amount, text('amount', n(d.amount)))}
      ${field('currency', t.currency, `<select name="currency">${currencyOptions(d.currency, true)}</select>`)}
    </div>
    ${field('frequency', t.frequency, seg('frequency', FREQUENCIES.map(f => [f, t.freq[f]]), d.frequency))}
    ${field('calendar', t.calendar, seg('calendar', CAL_ORDER.map(c => [c, t.cal[c]]), d.calendar), d.calendar === 'hijri' ? t.hijriHint : '')}
    ${payDay}
    <div class="split">
      ${field('total', t.total, text('total', n(d.total), 'num', 'numeric'))}
      ${field('apr', t.aprField, text('apr', n(d.apr)))}
    </div>
    <small class="hint row-hint">${esc(t.aprHint)}</small>
    ${field('mode', t.mode, seg('mode', [['start', t.fromStart], ['remaining', t.fromRemaining]], d.mode))}
    ${when}
    <div class="actions save-bar">
      <button type="submit" class="primary">${t.save}</button>
      ${d.id ? `<button type="button" class="danger" data-act="delete">${t.del}</button>` : `<button type="button" class="secondary" data-act="close">${t.cancel}</button>`}
    </div>
  </div>`;

  for (const [name, msg] of Object.entries(errors)) {
    const f = $('editForm').querySelector(`[data-field="${name}"]`);
    if (!f) continue;
    f.classList.add('invalid');
    f.insertAdjacentHTML('beforeend', `<small class="err">${esc(msg)}</small>`);
  }
}

/** Read the form back into `draft` (raw where unparseable, so it re-renders as typed). */
function collect() {
  const f = $('editForm').elements;
  const d = draft;
  const val = name => (f[name] ? f[name].value : undefined);
  const numOr = s => { const v = parseNumber(s); return v === null ? '' : Number.isNaN(v) ? s : v; };
  d.name = val('name');
  d.amount = numOr(val('amount'));
  d.currency = val('currency') || null;
  d.total = numOr(val('total'));
  d.apr = numOr(val('apr'));
  if (f.wd) d.wd = +val('wd');
  if (f.md) d.md = numOr(val('md'));
  if (f.ydd) d.yd = { d: numOr(val('ydd')), m: +val('ydm') };
  if (f.remaining) d.remaining = numOr(val('remaining'));
  if (f.sd) {
    const C = CALENDARS[d.calendar];
    const [dd, mm, yy] = [+val('sd'), +val('sm'), +val('sy')];
    // Moving to a shorter month keeps the day valid: 31 becomes that month's last day.
    d.startN = C.fromParts(yy, mm, Math.min(dd, C.monthLength(yy, mm)));
  }
}

function validateDraft() {
  const { t, num } = I;
  const d = draft, e = {};
  const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!String(d.name).trim()) e.name = t.err.required;
  if (d.amount === '') e.amount = t.err.required;
  else if (!(d.amount > 0)) e.amount = t.err.positive;
  if (d.total === '') e.total = t.err.required;
  else if (!isInt(d.total, 1, 100000)) e.total = Number.isInteger(d.total) ? t.err.positive : t.err.integer;
  if (d.apr !== '' && !(d.apr >= 0 && d.apr < 1000)) e.apr = t.err.nonneg;
  if (d.frequency === 'monthly' && !isInt(d.md, 1, 31)) e.md = t.err.range(num(1), num(31));
  if (d.frequency === 'yearly' && !isInt(d.yd.d, 1, 31)) e.yd = t.err.range(num(1), num(31));
  if (d.mode === 'start' && d.startN == null) e.start = t.err.date;
  if (d.mode === 'remaining') {
    if (d.remaining === '') e.remaining = t.err.required;
    else if (!isInt(d.remaining, 0, Number.isInteger(d.total) ? d.total : 100000))
      e.remaining = t.err.range(num(0), num(Number.isInteger(d.total) ? d.total : 100000));
  }
  return e;
}

function onEditorChange(e) {
  // sm/sy change the length of the start month, so the day list is rebuilt.
  if (!['frequency', 'calendar', 'mode', 'sm', 'sy'].includes(e.target.name)) return;
  collect();
  const d = draft;
  if (e.target.name === 'calendar') {
    const prevCal = d.calendar;
    d.calendar = e.target.value;
    // Keep the same real-world day for the start date; re-express pay days in the new calendar.
    const ref = CALENDARS[d.calendar].toParts(d.startN ?? todayN);
    if (prevCal !== d.calendar) { d.md = ref.d; d.yd = { m: ref.m, d: ref.d }; }
  } else if (e.target.name !== 'sm' && e.target.name !== 'sy') {
    d[e.target.name] = e.target.value;
  }
  renderEditor();
}

function onEditorSubmit(e) {
  e.preventDefault();
  collect();
  const errors = validateDraft();
  if (Object.keys(errors).length) {
    renderEditor(errors);
    $('editForm').querySelector('.invalid')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  const d = draft;
  const c = {
    id: d.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    name: d.name.trim(),
    amount: d.amount,
    currency: d.currency,
    frequency: d.frequency,
    calendar: d.calendar,
    payDay: { daily: null, weekly: d.wd, monthly: d.md, yearly: d.yd }[d.frequency],
    total: d.total,
    apr: d.apr === '' || d.apr === 0 ? null : d.apr,
  };
  c.first = d.mode === 'start' ? firstFromStart(c, isoFromDay(d.startN)) : firstFromRemaining(c, d.remaining, todayN);
  const i = doc.commitments.findIndex(x => x.id === c.id);
  if (i >= 0) doc.commitments[i] = c; else doc.commitments.push(c);
  persist();
  closeSheet();
  render();
}

function onEditorClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') closeSheet();
  if (act === 'delete' && confirm(I.t.confirmDelete(draft.name))) {
    doc.commitments = doc.commitments.filter(c => c.id !== draft.id);
    persist();
    closeSheet();
    render();
  }
}

$('editForm').addEventListener('change', onEditorChange);
$('editForm').addEventListener('submit', onEditorSubmit);
$('editForm').addEventListener('click', onEditorClick);

// --- settings ------------------------------------------------------------------

function renderSettings() {
  const { t } = I;
  $('settingsBody').innerHTML = `<div class="sheet" tabindex="-1" autofocus>
    <header><h2>${t.settings}</h2>
      <button type="button" class="icon" data-act="close" aria-label="${t.close}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
    ${field('lang', t.language, seg('lang', [['fa', 'فارسی'], ['en', 'English']], doc.prefs.lang))}
    ${field('displayCalendar', t.displayCalendar, seg('displayCalendar', CAL_ORDER.map(c => [c, t.cal[c]]), doc.prefs.displayCalendar))}
    ${field('currency', t.defaultCurrency, `<select name="currency">${currencyOptions(doc.prefs.currency, false)}</select>`)}
    <div class="group">
      <h2 style="font-size:16px;margin-top:14px">${t.backup}</h2>
      <p class="hint">${isBrowser ? t.backupHintWeb : t.backupHint}</p>
      <div class="actions" style="margin-top:8px">
        <button type="button" class="primary" data-act="export">${t.exportBtn}</button>
        <button type="button" class="secondary" data-act="import">${t.importBtn}</button>
      </div>
    </div>
    ${isBrowser && !standalone && (canPromptInstall() || iosManualInstall) ? `<div class="group">
      <h2 style="font-size:16px;margin-top:14px">${t.installTitle}</h2>
      <p class="hint">${canPromptInstall() ? t.installHint : t.installIos}</p>
      ${canPromptInstall() ? `<button type="button" class="primary wide" data-act="install">${t.installBtn}</button>` : ''}
    </div>` : ''}
    <p class="about">${isBrowser ? t.aboutWeb : t.about}</p>
  </div>`;
}

function openSettings() {
  renderSettings();
  openSheet($('settings'));
}

$('settingsBody').addEventListener('change', e => {
  const { name, value } = e.target;
  if (name === 'lang') {
    doc.prefs.lang = value;
    doc.prefs.displayCalendar = LANGS[value].calendar;
  } else if (name === 'displayCalendar') doc.prefs.displayCalendar = value;
  else if (name === 'currency') doc.prefs.currency = value;
  else return;
  persist();
  applyPrefs();
  render();
  renderSettings();
});

$('settingsBody').addEventListener('click', async e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') closeSheet();
  if (act === 'import') $('importFile').click();
  if (act === 'install') promptInstall();
  if (act === 'export') {
    try {
      await exportFile(doc, isoFromDay(today()));
    } catch (err) {
      if (!/cancel/i.test(String(err?.message ?? err))) alert(I.t.exportFailed);
    }
  }
});

async function onImport(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  let next;
  try {
    next = parseImport(await file.text());
  } catch (err) {
    console.error(err);
    alert(I.t.importBad);
    return;
  }
  if (!confirm(I.t.importConfirm(next.commitments.length))) return;
  doc = next;
  persist();
  applyPrefs();
  closeSheet();
  render();
}

init();
