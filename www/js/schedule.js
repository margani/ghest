// Payment dates and amortisation for a fixed-payment commitment.
// Pure functions, no DOM: imported by the app and by test/.
//
// A commitment, as stored:
//   { amount, frequency, calendar, payDay, total, apr, first }
//   frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
//   calendar:  'gregorian' | 'jalali' | 'hijri'  (only matters for monthly/yearly)
//   payDay:    daily null | weekly 0–6 (0 = Sunday) | monthly 1–31 | yearly {m, d}
//   first:     ISO date of payment #0 (always Gregorian ISO)
//
// Every date is derived from `first` and an index, never by stepping from the
// previous payment, so month-end clamping cannot drift (31 Jan → 28 Feb → 31 Mar).

import { CALENDARS, dayFromISO, isoFromDay, weekday } from './calendars.js';

export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];
export const PER_YEAR = { daily: 365, weekly: 52, monthly: 12, yearly: 1 };

function clampedDay(cal, y, m, d) {
  return cal.fromParts(y, m, Math.min(d, cal.monthLength(y, m)));
}

/** Day number of the payment `k` periods after the payment on day `base` (k may be negative). */
function shift(c, base, k) {
  switch (c.frequency) {
    case 'daily': return base + k;
    case 'weekly': return base + 7 * k;
    case 'monthly': {
      const cal = CALENDARS[c.calendar];
      const p = cal.toParts(base);
      const idx = p.y * 12 + (p.m - 1) + k;
      return clampedDay(cal, Math.floor(idx / 12), (idx % 12) + 1, c.payDay);
    }
    case 'yearly': {
      const cal = CALENDARS[c.calendar];
      return clampedDay(cal, cal.toParts(base).y + k, c.payDay.m, c.payDay.d);
    }
  }
  throw new Error(`unknown frequency ${c.frequency}`);
}

/** First payment day on or after `start` (day number) for this schedule. */
export function firstOnOrAfter(c, start) {
  switch (c.frequency) {
    case 'daily': return start;
    case 'weekly': return start + ((c.payDay - weekday(start) + 7) % 7);
    case 'monthly': {
      const cal = CALENDARS[c.calendar];
      const p = cal.toParts(start);
      const n = clampedDay(cal, p.y, p.m, c.payDay);
      return n >= start ? n : shift(c, n, 1);
    }
    case 'yearly': {
      const cal = CALENDARS[c.calendar];
      const n = clampedDay(cal, cal.toParts(start).y, c.payDay.m, c.payDay.d);
      return n >= start ? n : shift(c, n, 1);
    }
  }
  throw new Error(`unknown frequency ${c.frequency}`);
}

/** ISO `first` from a start date: payment #0 is the first payment day on or after it. */
export function firstFromStart(c, startISO) {
  return isoFromDay(firstOnOrAfter(c, dayFromISO(startISO)));
}

/**
 * ISO `first` from "`remaining` payments left as of `todayN`".
 * A payment falling on today counts as already made, so the next one is strictly after today.
 */
export function firstFromRemaining(c, remaining, todayN) {
  const next = firstOnOrAfter(c, todayN + 1);
  return isoFromDay(shift(c, next, -(c.total - remaining)));
}

/** Day number of payment k (0-based). */
export function paymentDay(c, k) {
  return shift(c, dayFromISO(c.first), k);
}

/** Payments made by `todayN` inclusive: count of k < total with date(k) ≤ today. */
export function paidCount(c, todayN) {
  let lo = 0, hi = c.total; // answer in [lo, hi]
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (paymentDay(c, mid - 1) <= todayN) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** Periodic rate from APR (%), read as a UK-style effective annual rate. */
export function periodicRate(apr, frequency) {
  return apr ? Math.pow(1 + apr / 100, 1 / PER_YEAR[frequency]) - 1 : 0;
}

/** Present value of `k` payments of `p` at rate `r` per period. */
export function presentValue(r, k, p) {
  return r ? (p * (1 - Math.pow(1 + r, -k))) / r : p * k;
}

/** Simulate paying `p` per period against balance `b` until cleared. */
function simulate(b, r, p) {
  let interest = 0, periods = 0;
  while (b > 1e-6 && periods < 1e6) {
    const i = b * r;
    interest += i;
    b += i - p;
    periods++;
  }
  return { interest, periods };
}

/** Everything the UI shows for one commitment on `todayN`. */
export function status(c, todayN) {
  const paid = paidCount(c, todayN);
  const remaining = c.total - paid;
  const r = periodicRate(c.apr, c.frequency);
  const principal = presentValue(r, remaining, c.amount);
  return {
    paid,
    remaining,
    done: remaining === 0,
    rate: r,
    principal,
    interest: c.amount * remaining - principal,
    owed: c.amount * remaining,
    lastPaid: paid > 0 ? paymentDay(c, paid - 1) : null,
    next: remaining > 0 ? paymentDay(c, paid) : null,
    end: paymentDay(c, c.total - 1),
    monthly: remaining > 0 ? (c.amount * PER_YEAR[c.frequency]) / 12 : 0,
  };
}

/**
 * Effect of paying `lump` off this commitment today, keeping the payment fixed
 * and shortening the term. Returns null if the commitment has no interest left.
 */
export function lumpSum(c, todayN, lump) {
  const s = status(c, todayN);
  if (s.done || !s.rate) return null;
  const applied = Math.min(lump, s.principal);
  const before = simulate(s.principal, s.rate, c.amount);
  const after = simulate(s.principal - applied, s.rate, c.amount);
  const periodsCut = before.periods - after.periods;
  const newEnd = after.periods > 0 ? paymentDay(c, s.paid + after.periods - 1) : todayN;
  return {
    applied,
    settles: applied >= s.principal - 1e-6,
    saved: before.interest - after.interest,
    periodsCut,
    monthsCut: monthsBetween(c.frequency, periodsCut, newEnd, s.end),
    newEnd,
  };
}

function monthsBetween(frequency, periods, from, to) {
  if (frequency === 'monthly') return periods;
  if (frequency === 'yearly') return periods * 12;
  return Math.round((to - from) / 30.436875);
}
