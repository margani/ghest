import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CALENDARS, dayFromISO as D, isoFromDay as iso, weekday } from '../www/js/calendars.js';
import {
  firstFromStart, firstFromRemaining, paymentDay, paidCount, status, lumpSum, periodicRate, presentValue,
} from '../www/js/schedule.js';

const dates = (c, n) => Array.from({ length: n }, (_, k) => iso(paymentDay(c, k)));
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

const monthly = (first, payDay, extra = {}) =>
  ({ amount: 100, frequency: 'monthly', calendar: 'gregorian', payDay, total: 12, apr: null, first, ...extra });

// --- calendars ---------------------------------------------------------------

test('weekday and ISO round trip', () => {
  assert.equal(weekday(D('2026-10-04')), 0); // Sunday
  assert.equal(weekday(D('1969-12-31')), 3);
  assert.equal(iso(D('2024-02-29')), '2024-02-29');
});

test('jalali anchors: Nowruz 1404/1405, Esfand 1403 is leap', () => {
  const J = CALENDARS.jalali;
  assert.equal(iso(J.fromParts(1404, 1, 1)), '2025-03-21');
  assert.equal(iso(J.fromParts(1405, 1, 1)), '2026-03-21');
  assert.equal(J.monthLength(1403, 12), 30);
  assert.equal(J.monthLength(1404, 12), 29);
  assert.equal(J.monthLength(1404, 7), 30);
  assert.deepEqual(J.toParts(D('2026-10-04')), { y: 1405, m: 7, d: 12 });
});

test('hijri round trip and month lengths', () => {
  const H = CALENDARS.hijri;
  for (let n = D('2020-01-01'); n < D('2035-01-01'); n++) {
    const p = H.toParts(n);
    assert.equal(H.fromParts(p.y, p.m, p.d), n);
  }
  for (let m = 1; m <= 12; m++) assert.ok([29, 30].includes(H.monthLength(1448, m)));
});

// --- payment dates -------------------------------------------------------------

test('monthly day 31 clamps to month end without drifting', () => {
  assert.deepEqual(dates(monthly('2025-01-31', 31), 4), ['2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30']);
  assert.deepEqual(dates(monthly('2024-01-31', 31), 3), ['2024-01-31', '2024-02-29', '2024-03-31']);
});

test('monthly day 30 in February then back to 30', () => {
  assert.deepEqual(dates(monthly('2025-01-30', 30), 3), ['2025-01-30', '2025-02-28', '2025-03-30']);
});

test('start date on a clamped month: day 31 starting mid-February', () => {
  const c = monthly(null, 31);
  assert.equal(firstFromStart(c, '2025-02-10'), '2025-02-28');
  assert.equal(firstFromStart(c, '2025-03-01'), '2025-03-31');
  assert.equal(firstFromStart(c, '2025-01-31'), '2025-01-31'); // on the day itself
});

test('yearly 29 Feb falls back to 28 Feb in common years', () => {
  const c = { amount: 1, frequency: 'yearly', calendar: 'gregorian', payDay: { m: 2, d: 29 }, total: 5, first: '2024-02-29' };
  assert.deepEqual(dates(c, 5), ['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
});

test('jalali monthly day 31 clamps in Mehr and in non-leap Esfand', () => {
  const c = monthly('2025-09-22', 31, { calendar: 'jalali' }); // 31 Shahrivar 1404
  const ds = dates(c, 7);
  assert.equal(ds[0], '2025-09-22');
  assert.equal(ds[1], '2025-10-22'); // 30 Mehr
  assert.equal(ds[6], '2026-03-20'); // 29 Esfand 1404 (common year)
  const leap = monthly(iso(CALENDARS.jalali.fromParts(1403, 11, 30)), 31, { calendar: 'jalali' });
  assert.equal(iso(paymentDay(leap, 1)), '2025-03-20'); // 30 Esfand 1403 (leap)
});

test('jalali yearly on 30 Esfand', () => {
  const J = CALENDARS.jalali;
  const c = { frequency: 'yearly', calendar: 'jalali', payDay: { m: 12, d: 30 }, total: 3, first: iso(J.fromParts(1403, 12, 30)) };
  assert.deepEqual(dates(c, 2).map(d => J.toParts(D(d))), [{ y: 1403, m: 12, d: 30 }, { y: 1404, m: 12, d: 29 }]);
});

test('hijri monthly day 30 clamps to 29-day months', () => {
  const H = CALENDARS.hijri;
  const c = monthly(iso(H.fromParts(1448, 1, 30 > H.monthLength(1448, 1) ? 29 : 30)), 30, { calendar: 'hijri' });
  for (const [k, d] of dates(c, 12).entries()) {
    const p = H.toParts(D(d));
    assert.equal(p.m, k + 1);
    assert.equal(p.d, H.monthLength(1448, k + 1));
  }
});

test('weekly snaps to the payment weekday', () => {
  const c = { frequency: 'weekly', payDay: 6, total: 3 }; // Saturday
  c.first = firstFromStart(c, '2026-10-04'); // Sunday
  assert.equal(c.first, '2026-10-10');
  assert.deepEqual(dates(c, 3), ['2026-10-10', '2026-10-17', '2026-10-24']);
  assert.equal(firstFromStart(c, '2026-10-10'), '2026-10-10');
});

test('daily', () => {
  const c = { frequency: 'daily', payDay: null, total: 3, first: '2024-02-28' };
  assert.deepEqual(dates(c, 3), ['2024-02-28', '2024-02-29', '2024-03-01']);
});

// --- paid count --------------------------------------------------------------

test('a payment due today counts as made', () => {
  const c = monthly('2026-01-09', 9);
  assert.equal(paidCount(c, D('2026-01-08')), 0);
  assert.equal(paidCount(c, D('2026-01-09')), 1);
  assert.equal(paidCount(c, D('2026-10-08')), 9);
  assert.equal(paidCount(c, D('2026-10-09')), 10);
  assert.equal(paidCount(c, D('2030-01-01')), 12);
});

test('remaining-as-of-today round trips for every frequency, calendar and pay day', () => {
  const todayN = D('2026-10-04');
  const cases = [];
  for (const calendar of ['gregorian', 'jalali', 'hijri'])
    for (let payDay = 1; payDay <= 31; payDay++) cases.push({ frequency: 'monthly', calendar, payDay });
  for (let payDay = 0; payDay < 7; payDay++) cases.push({ frequency: 'weekly', payDay });
  cases.push({ frequency: 'daily', payDay: null });
  cases.push({ frequency: 'yearly', calendar: 'gregorian', payDay: { m: 2, d: 29 } });
  cases.push({ frequency: 'yearly', calendar: 'jalali', payDay: { m: 12, d: 30 } });
  for (const base of cases)
    for (const remaining of [0, 1, 17, 48]) {
      const c = { ...base, total: 48 };
      c.first = firstFromRemaining(c, remaining, todayN);
      assert.equal(paidCount(c, todayN), 48 - remaining, JSON.stringify(c));
      // and the derived first is itself a valid start date
      assert.equal(firstFromStart(c, c.first), c.first, JSON.stringify(c));
    }
});

// --- amortisation --------------------------------------------------------------

// Synthetic loans: payment = annuity on the principal at the APR read as an effective annual rate,
// rounded to pennies the way lenders quote it. (Checked against real UK loan statements during development.)
const annuity = (P, apr, n) => { const r = Math.pow(1 + apr / 100, 1 / 12) - 1; return Math.round((P * r) / (1 - Math.pow(1 + r, -n)) * 100) / 100; };
const LOANS = [
  { principal: 20000, apr: 8.4, total: 48 },
  { principal: 9000, apr: 5.9, total: 36 },
  { principal: 15000, apr: 11.5, total: 60 },
].map(l => ({ ...l, amount: annuity(l.principal, l.apr, l.total) }));

test('APR is read as effective annual, not nominal/12', () => {
  for (const l of LOANS) {
    const effective = presentValue(periodicRate(l.apr, 'monthly'), l.total, l.amount);
    const nominal = presentValue(l.apr / 1200, l.total, l.amount);
    assert.ok(Math.abs(effective - l.principal) < 1, `${effective} vs ${l.principal}`);
    assert.ok(l.principal - nominal > 20, `nominal ${nominal} should undershoot ${l.principal}`);
  }
});

test('status of a running interest-bearing loan', () => {
  const todayN = D('2026-10-04');
  const c = { ...LOANS[0], frequency: 'monthly', calendar: 'gregorian', payDay: 9 };
  c.first = firstFromRemaining(c, 22, D('2026-09-22'));
  const p = c.amount;
  const s = status(c, todayN);
  assert.equal(s.remaining, 22);
  assert.equal(iso(s.next), '2026-10-09');
  assert.equal(iso(s.lastPaid), '2026-09-09');
  assert.equal(iso(s.end), '2028-07-09'); // 22 payments from Oct 2026
  near(s.principal, presentValue(s.rate, 22, p));
  near(s.principal + s.interest, 22 * p);
  assert.ok(s.interest > 0);
  near(s.monthly, p);
});

test('zero-interest commitment', () => {
  const c = { amount: 1500, frequency: 'monthly', calendar: 'gregorian', payDay: 3, total: 48, apr: null };
  c.first = firstFromRemaining(c, 30, D('2026-09-22'));
  const s = status(c, D('2026-09-22'));
  assert.equal(s.rate, 0);
  assert.equal(s.principal, 45000);
  assert.equal(s.interest, 0);
  assert.equal(lumpSum(c, D('2026-09-22'), 1000), null);
  assert.equal(status({ ...c, apr: 0 }, D('2026-09-22')).interest, 0);
});

test('finished commitment', () => {
  const c = monthly('2020-01-15', 15, { apr: 5 });
  const s = status(c, D('2026-10-04'));
  assert.equal(s.done, true);
  assert.equal(s.principal, 0);
  assert.equal(s.next, null);
  assert.equal(s.monthly, 0);
  assert.equal(lumpSum(c, D('2026-10-04'), 500), null);
});

test('normalised monthly amount per frequency', () => {
  const base = { amount: 12, total: 1000, first: '2026-01-01', apr: null };
  const t = D('2026-01-01');
  near(status({ ...base, frequency: 'daily' }, t).monthly, 365);
  near(status({ ...base, frequency: 'weekly', payDay: 4 }, t).monthly, 52);
  near(status({ ...base, frequency: 'yearly', calendar: 'gregorian', payDay: { m: 1, d: 1 } }, t).monthly, 1);
});

test('lump sum: saves interest and shortens the term; most expensive loan wins', () => {
  const todayN = D('2026-10-04');
  const res = LOANS.map(l => {
    const c = { ...l, frequency: 'monthly', calendar: 'gregorian', payDay: 9 };
    c.first = firstFromRemaining(c, 30, todayN);
    return { apr: l.apr, end: status(c, todayN).end, ...lumpSum(c, todayN, 1000) };
  });
  for (const r of res) {
    assert.ok(r.saved > 0 && r.monthsCut >= 1 && !r.settles);
    assert.ok(r.newEnd < r.end);
  }
  // At equal remaining terms, a higher rate saves more per pound.
  assert.equal(res.reduce((a, b) => (b.saved > a.saved ? b : a)).apr, 11.5);
});

test('lump sum larger than the balance settles it', () => {
  const todayN = D('2026-10-04');
  const c = { ...LOANS[1], frequency: 'monthly', calendar: 'gregorian', payDay: 11 };
  c.first = firstFromRemaining(c, 5, todayN);
  const s = status(c, todayN);
  const r = lumpSum(c, todayN, 1e6);
  assert.equal(r.settles, true);
  near(r.applied, s.principal);
  near(r.saved, s.interest);
  assert.equal(r.periodsCut, 5);
  assert.equal(r.newEnd, todayN);
});

test('lump sum on a weekly commitment reports calendar months', () => {
  const todayN = D('2026-10-04');
  const c = { amount: 100, frequency: 'weekly', payDay: 1, total: 104, apr: 20 };
  c.first = firstFromRemaining(c, 104, todayN);
  const r = lumpSum(c, todayN, 2600);
  assert.ok(r.periodsCut >= 26);
  assert.equal(r.monthsCut, Math.round((status(c, todayN).end - r.newEnd) / 30.436875));
});
