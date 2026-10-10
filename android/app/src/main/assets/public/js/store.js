// Persistence and backup. On Android, data lives in SharedPreferences via
// @capacitor/preferences, which survives WebView cache clears. In a desktop
// browser (development), localStorage stands in.
//
// The stored document and the export file are the same shape:
//   { app: 'ghest', version: 1, prefs: {lang, displayCalendar, currency, theme}, commitments: [...] }

import { FREQUENCIES } from './schedule.js';
import { CALENDARS, dayFromISO, isoFromDay } from './calendars.js';
import { LANGS } from './i18n.js';
import { Capacitor, registerPlugin } from './vendor/capacitor-core.js';

const KEY = 'ghest';
const VERSION = 1;
export const THEMES = ['system', 'light', 'dark'];

const native = Capacitor.isNativePlatform();
const Preferences = native ? registerPlugin('Preferences') : null;
const Filesystem = native ? registerPlugin('Filesystem') : null;
const Share = native ? registerPlugin('Share') : null;

export async function load(defaults) {
  let raw = null;
  try {
    raw = native ? (await Preferences.get({ key: KEY })).value : localStorage.getItem(KEY);
  } catch {}
  if (raw) {
    try { return validate(JSON.parse(raw)); } catch (e) { console.error('stored data invalid', e); }
  }
  return { app: 'ghest', version: VERSION, prefs: { ...defaults }, commitments: [] };
}

export async function save(doc) {
  const raw = JSON.stringify(doc);
  if (native) await Preferences.set({ key: KEY, value: raw });
  else localStorage.setItem(KEY, raw);
}

/** Hand the backup to the system share sheet (Android) or download it (browser). */
export async function exportFile(doc, todayISO) {
  const name = `ghest-${todayISO}.json`;
  const data = JSON.stringify(doc, null, 2);
  if (native) {
    const { uri } = await Filesystem.writeFile({ path: name, data, directory: 'CACHE', encoding: 'utf8' });
    await Share.share({ title: name, files: [uri] });
    return;
  }
  // Mobile browsers: hand the file to the share sheet, like the Android app does.
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Parse and validate an imported backup. Throws on anything malformed. */
export function parseImport(text) {
  return validate(JSON.parse(text));
}

const isISO = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isoFromDay(dayFromISO(s)) === s;
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isCurrency = v => typeof v === 'string' && /^[A-Z]{3}$/.test(v);

function fail(msg) { throw new Error(`invalid backup: ${msg}`); }

function validate(doc) {
  if (!doc || doc.app !== 'ghest') fail('not a ghest file');
  if (doc.version !== VERSION) fail(`unsupported version ${doc.version}`);
  const p = doc.prefs || {};
  if (!LANGS[p.lang] || !CALENDARS[p.displayCalendar] || !isCurrency(p.currency)) fail('prefs');
  // Backups made before the theme setting have no `theme`; they follow the device.
  if (p.theme != null && !THEMES.includes(p.theme)) fail('prefs');
  if (!Array.isArray(doc.commitments)) fail('commitments');
  const ids = new Set();
  const commitments = doc.commitments.map((c, i) => {
    const bad = what => fail(`commitment ${i}: ${what}`);
    if (typeof c.id !== 'string' || !c.id || ids.has(c.id)) bad('id');
    ids.add(c.id);
    if (typeof c.name !== 'string' || !c.name.trim()) bad('name');
    if (typeof c.amount !== 'number' || !(c.amount > 0) || !isFinite(c.amount)) bad('amount');
    if (c.currency != null && !isCurrency(c.currency)) bad('currency');
    if (!FREQUENCIES.includes(c.frequency)) bad('frequency');
    if (!CALENDARS[c.calendar]) bad('calendar');
    const ok = {
      daily: () => c.payDay === null,
      weekly: () => isInt(c.payDay, 0, 6),
      monthly: () => isInt(c.payDay, 1, 31),
      yearly: () => c.payDay && isInt(c.payDay.m, 1, 12) && isInt(c.payDay.d, 1, 31),
    }[c.frequency]();
    if (!ok) bad('payDay');
    if (!isInt(c.total, 1, 100000)) bad('total');
    if (c.apr != null && !(typeof c.apr === 'number' && c.apr >= 0 && c.apr < 1000)) bad('apr');
    if (!isISO(c.first)) bad('first');
    return {
      id: c.id, name: c.name.trim(), amount: c.amount, currency: c.currency ?? null,
      frequency: c.frequency, calendar: c.calendar,
      payDay: c.frequency === 'yearly' ? { m: c.payDay.m, d: c.payDay.d } : c.payDay,
      total: c.total, apr: c.apr || null, first: c.first,
    };
  });
  return {
    app: 'ghest', version: VERSION,
    prefs: { lang: p.lang, displayCalendar: p.displayCalendar, currency: p.currency, theme: p.theme ?? 'system' },
    commitments,
  };
}
