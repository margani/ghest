// Calendar arithmetic on integer day numbers (days since 1970-01-01, UTC).
// Day numbers avoid every time-zone and DST problem: a payment date is a
// calendar day, never an instant.
//
// Each calendar exposes:
//   toParts(n)            -> {y, m, d}   (m is 1-based)
//   fromParts(y, m, d)    -> n           (d must be valid for that month)
//   monthLength(y, m)     -> 29..31

import { toJalaali, toGregorian, jalaaliMonthLength } from './vendor/jalaali.js';

const DAY = 86400000;

export function dayFromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}

export function isoFromDay(n) {
  return new Date(n * DAY).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, same as Date#getDay. */
export function weekday(n) {
  return ((n % 7) + 11) % 7; // 1970-01-01 was a Thursday (4)
}

/** Local calendar date of `date` (default: now) as a day number. */
export function today(date = new Date()) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY;
}

const gregorian = {
  toParts(n) {
    const t = new Date(n * DAY);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  },
  fromParts(y, m, d) {
    return Date.UTC(y, m - 1, d) / DAY;
  },
  monthLength(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  },
};

const jalali = {
  toParts(n) {
    const g = gregorian.toParts(n);
    const j = toJalaali(g.y, g.m, g.d);
    return { y: j.jy, m: j.jm, d: j.jd };
  },
  fromParts(y, m, d) {
    const g = toGregorian(y, m, d);
    return gregorian.fromParts(g.gy, g.gm, g.gd);
  },
  monthLength(y, m) {
    return jalaaliMonthLength(y, m);
  },
};

// Hijri uses ICU's Umm al-Qura tables through Intl, which every Android
// WebView ships. Iran's official lunar calendar is set by moon sighting and
// can differ from Umm al-Qura by a day; no offline source can predict that.
const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric',
});
const hijriCache = new Map();
const HIJRI_EPOCH = -492148; // 1 Muharram 1 AH (civil), 622-07-16

const hijri = {
  toParts(n) {
    let p = hijriCache.get(n);
    if (!p) {
      const o = {};
      for (const { type, value } of hijriFmt.formatToParts(new Date(n * DAY))) o[type] = value;
      p = { y: parseInt(o.year, 10), m: +o.month, d: +o.day };
      hijriCache.set(n, p);
    }
    return p;
  },
  fromParts(y, m, d) {
    // Estimate from the mean month, then correct; converges in 2–3 steps.
    let n = Math.round(HIJRI_EPOCH + ((y - 1) * 12 + (m - 1)) * 29.530588853) + d - 1;
    for (let i = 0; i < 20; i++) {
      const p = hijri.toParts(n);
      const delta = Math.round(((y - p.y) * 12 + (m - p.m)) * 29.53) + (d - p.d);
      if (delta === 0) return n;
      n += delta;
    }
    throw new RangeError(`Hijri date out of range: ${y}-${m}-${d}`);
  },
  monthLength(y, m) {
    const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    return hijri.fromParts(ny, nm, 1) - hijri.fromParts(y, m, 1);
  },
};

export const CALENDARS = { gregorian, jalali, hijri };
