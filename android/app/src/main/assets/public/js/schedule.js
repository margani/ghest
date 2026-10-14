// Payment dates and amortisation for a fixed-payment commitment.
// Pure functions, no DOM: imported by the app and by test/.
//
// A commitment, as stored:
//   { amount, frequency, calendar, payDay, total, apr, settleDays, borrowed, borrowedOn, first }
//   settleDays: extra days of interest a lender counts on early payoff (0 if none)
//   borrowed, borrowedOn: optional amount paid out and its ISO date (both or neither)
//   frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
//   calendar:  'gregorian' | 'jalali' | 'hijri'  (only matters for monthly/yearly)
//   payDay:    daily null | weekly 0–6 (0 = Sunday) | monthly 1–31 | yearly {m, d}
//   first:     ISO date of payment #0 (always Gregorian ISO)
//   extra:     optional repayments outside the instalments, [{ on: ISO, amount, effect }];
//              effect 'term' keeps the instalment and ends sooner, 'payment' keeps the end and lowers it
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
  if (c.extra?.length) return ledgerStatus(c, todayN);
  const paid = paidCount(c, todayN);
  const remaining = c.total - paid;
  const r = periodicRate(c.apr, c.frequency);
  const principal = presentValue(r, remaining, c.amount);
  return {
    paid,
    remaining,
    total: c.total,
    amount: c.amount,
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

/** Instalment that clears `bal` in `n` payments, the first one period away. */
function annuity(r, n, bal) {
  return r ? (bal * r) / (1 - Math.pow(1 + r, -n)) : bal / n;
}

/** Payments of `amt` (the last one smaller) that clear `bal`, the first one period away. */
function nper(r, bal, amt) {
  const x = r ? 1 - (bal * r) / amt : 1;
  if (x <= 0) return Infinity;
  return Math.max(1, Math.ceil((r ? -Math.log(x) / Math.log(1 + r) : bal / amt) - 1e-9));
}

/**
 * The loan as a ledger, for commitments with extra repayments (#75): the advance on its date (or,
 * without one, the schedule's value one period before payment #0), interest at the periodic rate
 * on the payment grid, and every instalment and extra repayment taken off in date order. An extra
 * on an instalment's day counts after it. Instalment and count change as each extra's `effect` says;
 * the last instalment clears what is left. Returns every event with the balance after it.
 */
export function ledger(c) {
  const r = periodicRate(c.apr, c.frequency);
  const extras = (c.extra || []).map((e, i) => ({ ...e, i, day: dayFromISO(e.on) })).sort((a, b) => a.day - b.day || a.i - b.i);
  let pos = -1, bal = presentValue(r, c.total, c.amount);
  if (c.borrowed && c.borrowedOn) { pos = periodsAt(c, dayFromISO(c.borrowedOn)); bal = c.borrowed; }
  const start = { pos, balance: bal };
  let amt = c.amount, n = c.total, ei = 0;
  const events = [];
  const grow = to => { bal *= Math.pow(1 + r, to - pos); pos = to; };
  for (let k = 0; k < n; k++) {
    const day = paymentDay(c, k);
    for (; ei < extras.length && extras[ei].day < day; ei++) {
      const e = extras[ei];
      grow(periodsAt(c, e.day));
      bal = Math.max(0, bal - e.amount);
      events.push({ day: e.day, amount: e.amount, extra: e.i, effect: e.effect, balance: bal });
      if (bal <= 1e-6) { n = k; break; }
      const atStart = bal / Math.pow(1 + r, pos - (k - 1)); // as if one period before instalment k
      if (e.effect === 'payment') amt = annuity(r, n - k, atStart);
      else n = k + nper(r, atStart, amt);
    }
    if (k >= n) break;
    grow(k);
    const pay = k === n - 1 ? bal : Math.min(amt, bal);
    bal -= pay;
    events.push({ day, amount: pay, k, balance: bal });
  }
  // Extras after the last instalment change nothing left to pay, but still belong in the list.
  for (; ei < extras.length; ei++) events.push({ day: extras[ei].day, amount: extras[ei].amount, extra: extras[ei].i, effect: extras[ei].effect, balance: 0 });
  return { events, n, amt, rate: r, start };
}

function ledgerStatus(c, todayN) {
  const { events, n, amt, rate, start: ledgerStart } = ledger(c);
  const past = events.filter(e => e.day <= todayN);
  const due = events.filter(e => e.day > todayN && e.k != null);
  const paid = past.filter(e => e.k != null).length;
  const remaining = due.length;
  const owed = due.reduce((a, e) => a + e.amount, 0);
  const principal = remaining ? (past.length ? past[past.length - 1].balance : ledgerStart.balance) : 0;
  const lastK = events.filter(e => e.k != null).pop();
  return {
    paid,
    remaining,
    total: n,
    amount: amt,
    done: remaining === 0,
    rate,
    principal,
    interest: owed - principal,
    owed,
    lastPaid: paid > 0 ? paymentDay(c, paid - 1) : null,
    next: remaining > 0 ? due[0].day : null,
    end: lastK ? lastK.day : (past.length ? past[past.length - 1].day : paymentDay(c, 0)),
    monthly: remaining > 0 ? (amt * PER_YEAR[c.frequency]) / 12 : 0,
  };
}

/** Payments made by `todayN`, newest first: instalments (automatic) and extra repayments (`extra` = its index). */
export function payments(c, todayN) {
  const events = c.extra?.length
    ? ledger(c).events
    : Array.from({ length: paidCount(c, todayN) }, (_, k) => ({ day: paymentDay(c, k), amount: c.amount, k }));
  return events.filter(e => e.day <= todayN).reverse();
}

/**
 * Effect of paying `lump` off this commitment today. It settles the loan only at the payoff amount
 * (the lender's extra days included), and then saves what payoff() says. A smaller sum first covers
 * the instalments due by the settlement date; the rest is an extra repayment on that date that keeps
 * the instalment and shortens the term. Before, a loan took only its principal and was called paid
 * off, below the payoff figure on its own page (#77). Returns null if there is no interest left.
 */
export function lumpSum(c, todayN, lump) {
  const s = status(c, todayN);
  if (s.done || !s.rate) return null;
  const days = c.settleDays || 0;
  const po = payoff(c, todayN, days);
  const settle = todayN + days;
  if (lump >= po.amount - 1e-6) {
    const cut = s.remaining - po.dueCount;
    const newEnd = po.dueCount ? (s.next != null ? paymentDay(c, s.paid + po.dueCount - 1) : todayN) : todayN;
    return { applied: po.amount, settles: true, saved: po.saved, periodsCut: cut,
      monthsCut: monthsBetween(c.frequency, cut, newEnd, s.end), newEnd };
  }
  const x = lump - po.due;
  if (x <= 1e-9) return { applied: lump, settles: false, saved: 0, periodsCut: 0, monthsCut: 0, newEnd: s.end };
  const s2 = status({ ...c, extra: [...(c.extra || []), { on: isoFromDay(settle), amount: x, effect: 'term' }] }, todayN);
  const cut = s.remaining - s2.remaining;
  return {
    applied: lump,
    settles: false,
    saved: s.owed - s2.owed - x,
    periodsCut: cut,
    monthsCut: monthsBetween(c.frequency, cut, s2.end, s.end),
    newEnd: s2.end,
  };
}

/**
 * Split `lump` across commitments: highest APR first (most interest saved per unit), each taking
 * up to its principal left, the rest flowing on to the next. Commitments with no interest or
 * already finished are left out. Asked for instead of "the whole sum on each one" (#59).
 */
export function allocate(cs, todayN, lump) {
  const order = cs
    .map(c => ({ c, s: status(c, todayN) }))
    .filter(({ s }) => !s.done && s.rate)
    .sort((a, b) => b.c.apr - a.c.apr || a.s.principal - b.s.principal);
  // Each loan takes up to its payoff amount, the figure its details page shows (#77).
  let left = lump, saved = 0;
  const rows = order.map(({ c, s }) => {
    const give = Math.min(left, payoff(c, todayN, c.settleDays || 0).amount);
    left -= give;
    const r = give > 0 ? lumpSum(c, todayN, give) : null;
    if (r) saved += r.saved;
    return { c, give, r };
  });
  return { rows, left, saved };
}

/**
 * What paying this commitment off costs if the lender settles `extraDays` after `todayN`.
 * Follows the UK Consumer Credit (Early Settlement) Regulations 2004: instalments due by the
 * settlement date are paid in full; the rest is the balance discounted at the APR, grown by
 * (1 + r)^(days since the last instalment / days in that period), as in the Schedule's examples.
 * Without this a lender's quote looked wrong: it is above "principal left" by these days (#50).
 */
export function payoff(c, todayN, extraDays = 0) {
  const s = status(c, todayN);
  if (s.done || !s.rate) return null;
  const settle = todayN + extraDays;
  if (c.extra?.length) {
    // Instalments due by the settlement date in full, then the ledger's balance grown to that date.
    const { events, start } = ledger(c);
    let amount = 0, last = null, dueCount = 0;
    for (const e of events) {
      if (e.day > settle) break;
      if (e.day > todayN && e.k != null) { amount += e.amount; dueCount++; }
      last = e;
    }
    const due = amount;
    const open = events.some(e => e.day > settle && e.k != null);
    if (open) {
      const [from, bal] = !last ? [start.pos, start.balance] : [last.k != null ? last.k : periodsAt(c, last.day), last.balance];
      amount += bal * Math.pow(1 + s.rate, periodsAt(c, settle) - from);
    }
    return { amount, saved: s.owed - amount, due, dueCount };
  }
  const due = paidCount(c, settle); // payments made by the settlement date
  let amount = (due - s.paid) * c.amount;
  if (due < c.total) {
    const at = periodsAt(c, settle);
    const grow = periods => Math.pow(1 + s.rate, periods);
    if (c.borrowed && c.borrowedOn) {
      // The regulations start from the advance on its real date. Lenders often pay out more than
      // a period before the first instalment, which was priced for exactly one, so rebuilding the
      // balance from the instalments came out ~£79 under a real quote; this matched it to the penny (#54).
      amount += c.borrowed * grow(at - periodsAt(c, dayFromISO(c.borrowedOn)));
      for (let k = 0; k < due; k++) amount -= c.amount * grow(at - k);
    } else {
      amount += presentValue(s.rate, c.total - due, c.amount) * grow(at - (due - 1));
    }
  }
  return { amount, saved: s.owed - amount, due: (due - s.paid) * c.amount, dueCount: due - s.paid };
}

/** Where day `x` falls on the payment grid, in periods from payment #0; part periods by days in that period. */
function periodsAt(c, x) {
  let k = paidCount(c, x) - 1; // last payment on or before x
  if (k < 0) while (paymentDay(c, k) > x) k--;
  const from = paymentDay(c, k);
  return k + (x - from) / (paymentDay(c, k + 1) - from);
}

function monthsBetween(frequency, periods, from, to) {
  if (frequency === 'monthly') return periods;
  if (frequency === 'yearly') return periods * 12;
  return Math.round((to - from) / 30.436875);
}
