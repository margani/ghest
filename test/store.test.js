import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImport } from '../www/js/store.js';
import { parseNumber, makeI18n } from '../www/js/i18n.js';

const valid = () => ({
  app: 'ghest', version: 1,
  prefs: { lang: 'fa', displayCalendar: 'jalali', currency: 'GBP' },
  commitments: [
    { id: 'a', name: ' وام ماشین ', amount: 312.4, currency: null, frequency: 'monthly', calendar: 'gregorian', payDay: 9, total: 48, apr: 8.9, first: '2024-06-09' },
    { id: 'b', name: 'rent', amount: 100, currency: 'IRT', frequency: 'yearly', calendar: 'jalali', payDay: { m: 12, d: 30 }, total: 3, apr: 0, first: '2025-03-20' },
  ],
});

test('import accepts a valid backup and normalises it', () => {
  const doc = parseImport(JSON.stringify(valid()));
  assert.equal(doc.commitments[0].name, 'وام ماشین');
  assert.equal(doc.commitments[1].apr, null); // 0 APR stored as no interest
});

test('import rejects malformed backups', () => {
  const cases = [
    d => { d.app = 'other'; },
    d => { d.version = 2; },
    d => { d.commitments[0].frequency = 'hourly'; },
    d => { d.commitments[0].payDay = 32; },
    d => { d.commitments[0].first = '2025-02-30'; },
    d => { d.commitments[0].total = 0; },
    d => { d.commitments[0].amount = -1; },
    d => { d.commitments[1].id = 'a'; },
    d => { d.commitments[1].payDay = 5; },
    d => { d.prefs.currency = 'pounds'; },
  ];
  for (const mutate of cases) {
    const d = valid();
    mutate(d);
    assert.throws(() => parseImport(JSON.stringify(d)), /invalid backup/, mutate.toString());
  }
  assert.throws(() => parseImport('not json'));
});

test('number input accepts Persian and Arabic-Indic digits', () => {
  assert.equal(parseNumber('۱۲٬۵۰۰٫۷۵'), 12500.75);
  assert.equal(parseNumber('٣٠'), 30);
  assert.equal(parseNumber('1,250.5'), 1250.5);
  assert.equal(parseNumber(''), null);
  assert.ok(Number.isNaN(parseNumber('12a')));
});

test('formatting: Persian digits for fa, Latin for en, toman, any ISO currency', () => {
  const fa = makeI18n('fa', 'jalali'), en = makeI18n('en', 'gregorian');
  assert.match(fa.num(1234), /^[۰-۹٬]+$/);
  assert.equal(en.num(1234), '1,234');
  assert.equal(en.money(1234.5, 'GBP', true), '£1,234.50');
  assert.equal(en.money(1234567, 'IRT'), '1,234,567 Toman');
  assert.match(fa.money(1500, 'IRT'), /^[۰-۹٬]+ تومان$/);
  assert.match(en.money(1000, 'JPY', true), /1,000/);
  assert.match(fa.date(20730), /مهر ۱۴۰۵/); // 2026-10-04
  assert.match(en.date(20730), /4 October 2026/);
  assert.match(makeI18n('fa', 'hijri').date(20730), /۱۴۴۸/);
});

test('theme preference: kept on import, missing reads as system, junk rejected', () => {
  assert.equal(parseImport(JSON.stringify(valid())).prefs.theme, 'system'); // backups from before the setting
  for (const theme of ['system', 'light', 'dark']) {
    const d = valid();
    d.prefs.theme = theme;
    assert.equal(parseImport(JSON.stringify(d)).prefs.theme, theme);
  }
  const d = valid();
  d.prefs.theme = 'sepia';
  assert.throws(() => parseImport(JSON.stringify(d)), /invalid backup: prefs/);
});

test('early payoff days: kept on import, missing reads as 0, junk rejected', () => {
  assert.equal(parseImport(JSON.stringify(valid())).commitments[0].settleDays, 0); // backups from before the field
  const d = valid();
  d.commitments[0].settleDays = 58;
  assert.equal(parseImport(JSON.stringify(d)).commitments[0].settleDays, 58);
  for (const bad of [-1, 1.5, 366, '58']) {
    d.commitments[0].settleDays = bad;
    assert.throws(() => parseImport(JSON.stringify(d)), /invalid backup/, String(bad));
  }
});

test('amount borrowed and its date: kept together, missing reads as null, junk rejected', () => {
  const c0 = parseImport(JSON.stringify(valid())).commitments[0];
  assert.equal(c0.borrowed, null);
  assert.equal(c0.borrowedOn, null);
  const d = valid();
  const first = d.commitments[0].first;
  Object.assign(d.commitments[0], { borrowed: 5000, borrowedOn: first });
  const c = parseImport(JSON.stringify(d)).commitments[0];
  assert.deepEqual([c.borrowed, c.borrowedOn], [5000, first]);
  const dayAfter = new Date(Date.parse(`${first}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
  for (const [borrowed, borrowedOn] of [[5000, null], [null, first], [0, first], [-5, first], ['5000', first],
    [5000, '2024-02-30'], [5000, dayAfter]]) {
    Object.assign(d.commitments[0], { borrowed, borrowedOn });
    assert.throws(() => parseImport(JSON.stringify(d)), /invalid backup/, `${borrowed} ${borrowedOn}`);
  }
});

test('count-from choice: kept on import, missing reads as remaining, junk rejected', () => {
  assert.equal(parseImport(JSON.stringify(valid())).commitments[0].countFrom, 'remaining'); // older backups
  const d = valid();
  d.commitments[0].countFrom = 'start';
  assert.equal(parseImport(JSON.stringify(d)).commitments[0].countFrom, 'start');
  d.commitments[0].countFrom = 'end';
  assert.throws(() => parseImport(JSON.stringify(d)), /invalid backup/);
});

test('extra repayments: kept on import, missing reads as none, junk rejected', () => {
  assert.deepEqual(parseImport(JSON.stringify(valid())).commitments[0].extra, []);
  const d = valid();
  d.commitments[0].extra = [{ on: '2025-01-20', amount: 500, effect: 'term' }];
  assert.deepEqual(parseImport(JSON.stringify(d)).commitments[0].extra, [{ on: '2025-01-20', amount: 500, effect: 'term' }]);
  for (const bad of ['x', [{ on: '2025-02-30', amount: 5, effect: 'term' }], [{ on: '2025-01-20', amount: 0, effect: 'term' }],
    [{ on: '2025-01-20', amount: 5, effect: 'both' }], [null]]) {
    d.commitments[0].extra = bad;
    assert.throws(() => parseImport(JSON.stringify(d)), /invalid backup/, JSON.stringify(bad));
  }
});
