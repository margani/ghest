// Strings and formatters. Digits, currency symbols, month names and calendar
// conversion for display all come from Intl, so every ISO 4217 currency works
// without a table. IRT (toman) is not ISO, so it is the one special case.

import { CALENDARS, today } from './calendars.js';

export const LANGS = {
  fa: { locale: 'fa-IR', dir: 'rtl', calendar: 'jalali', weekStart: 6 },
  en: { locale: 'en-GB', dir: 'ltr', calendar: 'gregorian', weekStart: 1 },
};

const INTL_CAL = { gregorian: 'gregory', jalali: 'persian', hijri: 'islamic-umalqura' };
const DAY = 86400000;

const S = {
  fa: {
    app: 'قسط',
    totalTitle: 'کل بدهی باقی‌مونده',
    totalSub: (owed, interest) => interest
      ? `مجموع قسط‌های باقی‌مونده ${owed}، یعنی ${interest} سود دیگه در پیشه.`
      : `مجموع قسط‌های باقی‌مونده ${owed}.`,
    monthlyFact: 'پرداخت ماهانه‌ی فعلی',
    endFact: 'پایان همه‌ی تعهدها',
    allDone: 'همه تموم شدن',
    emptyTitle: 'هنوز تعهدی ثبت نکردی',
    emptyHint: 'وام، قسط ماشین، شهریه یا هر پرداخت ثابتی که تعداد قسطش معلومه رو اضافه کن تا ببینی کجای کاری و کِی تموم می‌شه.',
    add: 'افزودن تعهد',
    noInterest: 'بدون سود',
    apr: v => `سود ${v}٪`,
    hottest: '، گرون‌ترین',
    of: (a, b) => `${a} از ${b}`,
    paymentsLeft: 'قسط مونده',
    principalLeft: 'اصل باقی‌مونده',
    amountLeft: 'مبلغ باقی‌مونده',
    interestLeft: 'سود باقی‌مونده',
    perPayment: { daily: 'قسط روزانه', weekly: 'قسط هفتگی', monthly: 'قسط ماهانه', yearly: 'قسط سالانه' },
    next: 'قسط بعدی',
    end: 'آخرین قسط',
    lastPaid: 'آخرین پرداخت انجام‌شده',
    nonePaid: 'هنوز پرداختی نشده',
    finished: 'تموم شد',
    progressLabel: (a, b) => `${a} از ${b} قسط پرداخت شده`,
    lumpTitle: 'اگه پول اضافه دستم اومد',
    lumpHint: 'مبلغ رو بزن تا ببینی پرداختش روی هر تعهد چقدر سود کم می‌کنه. فرض: قسط ثابت می‌مونه و مدت کوتاه می‌شه. تعهدهای بدون سود اینجا نیستن.',
    lumpLabel: 'مبلغ پیش‌پرداخت',
    monthsSooner: (n, f) => n > 0 ? `${f} ماه زودتر تموم می‌شه` : 'تاریخ پایان تقریباً عوض نمی‌شه',
    settles: '، کل بدهی تسویه می‌شه',
    foot: 'اصل باقی‌مونده از روی سود سالانه (APR)، مبلغ و تعداد قسط‌ها حساب می‌شه. عدد تسویه‌ی بانک ممکنه کمی فرق کنه.',
    newTitle: 'تعهد جدید',
    editTitle: 'ویرایش تعهد',
    name: 'اسم',
    namePh: 'مثلاً وام ماشین',
    amount: 'مبلغ هر قسط',
    currency: 'ارز',
    frequency: 'تناوب',
    freq: { daily: 'روزانه', weekly: 'هفتگی', monthly: 'ماهانه', yearly: 'سالانه' },
    calendar: 'تقویم',
    cal: { jalali: 'شمسی', gregorian: 'میلادی', hijri: 'قمری' },
    payWeekday: 'روز هفته',
    payMonthDay: 'روز ماه',
    payMonthDayHint: 'اگه ماه کوتاه‌تر باشه، قسط آخرین روز همون ماهه.',
    payYearDay: 'روز و ماه پرداخت',
    total: 'تعداد کل قسط‌ها',
    aprField: 'سود سالانه (APR٪)',
    aprHint: 'اختیاری. خالی یعنی بدون سود.',
    mode: 'از کجا حساب کنم؟',
    fromStart: 'تاریخ شروع',
    fromRemaining: 'قسط‌های مونده',
    startDate: 'تاریخ شروع',
    startHint: 'اولین قسط، اولین روز پرداخت از این تاریخ به بعده.',
    remaining: 'تعداد قسط‌های مونده از امروز',
    remainingHint: 'اگه قسط امروز رو دادی، حسابش نکن.',
    day: 'روز', month: 'ماه', year: 'سال',
    save: 'ذخیره',
    cancel: 'انصراف',
    del: 'حذف',
    confirmDelete: n => `«${n}» حذف بشه؟`,
    err: {
      required: 'این رو پر کن',
      positive: 'باید بیشتر از صفر باشه',
      nonneg: 'نمی‌تونه منفی باشه',
      integer: 'باید عدد صحیح باشه',
      range: (a, b) => `باید بین ${a} و ${b} باشه`,
      date: 'این تاریخ وجود نداره',
    },
    settings: 'تنظیمات',
    language: 'زبان',
    displayCalendar: 'تقویم نمایش',
    defaultCurrency: 'ارز پیش‌فرض',
    dflt: 'پیش‌فرض',
    backup: 'پشتیبان',
    backupHint: 'داده‌ها فقط روی همین گوشی‌ان. با حذف اپ یا پاک کردن داده‌هاش از بین می‌رن، پس گاهی خروجی بگیر.',
    exportBtn: 'خروجی گرفتن',
    importBtn: 'وارد کردن از فایل',
    importConfirm: n => `${n} تعهد از فایل جایگزین همه‌ی داده‌های فعلی می‌شه. ادامه بدیم؟`,
    importBad: 'این فایل پشتیبان قسط نیست یا خرابه.',
    exportFailed: 'خروجی گرفتن نشد.',
    about: 'متن‌باز با مجوز GPL-3.0. بدون دسترسی به اینترنت.',
    backupHintWeb: 'داده‌ها فقط توی همین مرورگر روی همین دستگاه‌ان. پاک کردن داده‌های سایت یا مرورگر پاکشون می‌کنه، پس گاهی خروجی بگیر.',
    aboutWeb: 'متن‌باز با مجوز GPL-3.0. بعد از اولین بار بدون اینترنت کار می‌کنه و هیچ داده‌ای به جایی فرستاده نمی‌شه.',
    installTitle: 'نصب اپ',
    installHint: 'قسط رو مثل یه اپ نصب کن تا از صفحه‌ی اصلی و بدون اینترنت باز بشه.',
    installIos: 'برای نصب: توی سافاری دکمه‌ی Share و بعد Add to Home Screen.',
    installBtn: 'نصب',
    updateBtn: 'به‌روزرسانی',
    hijriHint: 'قمری بر اساس تقویم ام‌القری حساب می‌شه و ممکنه با تقویم رسمی ایران یک روز فرق داشته باشه.',
    close: 'بستن',
    toman: 'تومان',
  },
  en: {
    app: 'Ghest',
    totalTitle: 'Total left to repay',
    totalSub: (owed, interest) => interest
      ? `${owed} in remaining payments, so ${interest} of interest still to come.`
      : `${owed} in remaining payments.`,
    monthlyFact: 'Paying per month',
    endFact: 'Everything ends',
    allDone: 'All done',
    emptyTitle: 'Nothing here yet',
    emptyHint: 'Add a loan, car finance, tuition or any fixed payment with a known number of instalments to see where you are and when it ends.',
    add: 'Add commitment',
    noInterest: 'No interest',
    apr: v => `${v}% APR`,
    hottest: ', most expensive',
    of: (a, b) => `${a} of ${b}`,
    paymentsLeft: 'payments left',
    principalLeft: 'Principal left',
    amountLeft: 'Amount left',
    interestLeft: 'Interest left',
    perPayment: { daily: 'Daily payment', weekly: 'Weekly payment', monthly: 'Monthly payment', yearly: 'Yearly payment' },
    next: 'Next payment',
    end: 'Final payment',
    lastPaid: 'Last payment made',
    nonePaid: 'none yet',
    finished: 'Finished',
    progressLabel: (a, b) => `${a} of ${b} payments made`,
    lumpTitle: 'If I pay a lump sum',
    lumpHint: 'Enter an amount to see how much interest it saves on each commitment. Assumes the payment stays the same and the term gets shorter. Interest-free commitments are left out.',
    lumpLabel: 'Lump sum',
    monthsSooner: (n, f) => n > 0 ? `ends ${f} month${n === 1 ? '' : 's'} sooner` : 'end date barely moves',
    settles: ', pays it off entirely',
    foot: 'Principal is derived from the APR, the payment amount and the number of payments. Your lender’s settlement figure may differ slightly.',
    newTitle: 'New commitment',
    editTitle: 'Edit commitment',
    name: 'Name',
    namePh: 'e.g. Car loan',
    amount: 'Amount per payment',
    currency: 'Currency',
    frequency: 'Frequency',
    freq: { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' },
    calendar: 'Calendar',
    cal: { jalali: 'Solar Hijri', gregorian: 'Gregorian', hijri: 'Lunar Hijri' },
    payWeekday: 'Day of week',
    payMonthDay: 'Day of month',
    payMonthDayHint: 'In shorter months the payment falls on the last day.',
    payYearDay: 'Payment date each year',
    total: 'Number of payments',
    aprField: 'APR (%)',
    aprHint: 'Optional. Leave empty for no interest.',
    mode: 'Count from',
    fromStart: 'Start date',
    fromRemaining: 'Payments left',
    startDate: 'Start date',
    startHint: 'The first payment is the first payment day on or after this date.',
    remaining: 'Payments left as of today',
    remainingHint: 'Don’t count today’s if you’ve already paid it.',
    day: 'Day', month: 'Month', year: 'Year',
    save: 'Save',
    cancel: 'Cancel',
    del: 'Delete',
    confirmDelete: n => `Delete “${n}”?`,
    err: {
      required: 'Required',
      positive: 'Must be more than zero',
      nonneg: 'Can’t be negative',
      integer: 'Must be a whole number',
      range: (a, b) => `Must be between ${a} and ${b}`,
      date: 'That date doesn’t exist',
    },
    settings: 'Settings',
    language: 'Language',
    displayCalendar: 'Display calendar',
    defaultCurrency: 'Default currency',
    dflt: 'Default',
    backup: 'Backup',
    backupHint: 'Your data lives only on this phone. Uninstalling or clearing app data deletes it, so export now and then.',
    exportBtn: 'Export',
    importBtn: 'Import from file',
    importConfirm: n => `Replace all current data with ${n} commitment${n === 1 ? '' : 's'} from the file?`,
    importBad: 'That file isn’t a Ghest backup, or it’s damaged.',
    exportFailed: 'Export failed.',
    about: 'Open source under GPL-3.0. No internet access.',
    backupHintWeb: 'Your data lives only in this browser on this device. Clearing site or browser data deletes it, so export now and then.',
    aboutWeb: 'Open source under GPL-3.0. Works offline after the first visit; nothing you enter is sent anywhere.',
    installTitle: 'Install',
    installHint: 'Install Ghest as an app to open it from your home screen, offline.',
    installIos: 'To install: in Safari, tap Share, then Add to Home Screen.',
    installBtn: 'Install',
    updateBtn: 'Update',
    hijriHint: 'Lunar Hijri follows the Umm al-Qura calendar and can differ by a day from sighting-based calendars.',
    close: 'Close',
    toman: 'Toman',
  },
};

export function makeI18n(lang, displayCalendar) {
  const L = LANGS[lang];
  const t = S[lang];
  const loc = L.locale;
  const dateLoc = `${loc}-u-ca-${INTL_CAL[displayCalendar]}`;
  const cache = new Map();
  const nfmt = (key, opts) => {
    let f = cache.get(key);
    if (!f) cache.set(key, (f = new Intl.NumberFormat(loc, opts)));
    return f;
  };
  const dfmt = (key, l, opts) => {
    let f = cache.get(key);
    if (!f) cache.set(key, (f = new Intl.DateTimeFormat(l, { timeZone: 'UTC', ...opts })));
    return f;
  };

  const num = (v, max = 0) => nfmt(`n${max}`, { maximumFractionDigits: max }).format(v);
  const plain = v => nfmt('plain', { useGrouping: false, maximumFractionDigits: 6 }).format(v);

  /** Money; `exact` keeps the currency's minor units, otherwise rounds to whole units. */
  function money(v, currency, exact = false) {
    if (currency === 'IRT') return `${num(Math.round(v))} ${t.toman}`;
    const digits = exact ? {} : { minimumFractionDigits: 0, maximumFractionDigits: 0 };
    try {
      return nfmt(`m${currency}${exact}`, { style: 'currency', currency, ...digits }).format(exact ? v : Math.round(v));
    } catch {
      return `${num(v, exact ? 2 : 0)} ${currency}`;
    }
  }

  const date = n => dfmt('d', dateLoc, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(n * DAY));
  const monthYear = n => dfmt('my', dateLoc, { month: 'long', year: 'numeric' }).format(new Date(n * DAY));

  /** Month names (1..12) of `cal`, in the UI language. */
  function monthNames(cal) {
    const C = CALENDARS[cal];
    const y = C.toParts(today()).y;
    const f = dfmt(`mn${cal}`, `${loc}-u-ca-${INTL_CAL[cal]}`, { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => f.format(new Date(C.fromParts(y, i + 1, 1) * DAY)));
  }

  /** Weekdays as [index, name] in this locale's week order. */
  function weekdays() {
    const f = dfmt('wd', loc, { weekday: 'long' });
    return Array.from({ length: 7 }, (_, i) => {
      const d = (L.weekStart + i) % 7;
      return [d, f.format(new Date((3 + d) * DAY))]; // day 3 = Sunday 1970-01-04
    });
  }

  function currencyName(code) {
    if (code === 'IRT') return t.toman;
    try { return new Intl.DisplayNames([loc], { type: 'currency' }).of(code); } catch { return code; }
  }

  return { lang, dir: L.dir, t, num, plain, money, date, monthYear, monthNames, weekdays, currencyName };
}

export function currencies() {
  let list;
  try { list = Intl.supportedValuesOf('currency'); } catch { list = ['EUR', 'GBP', 'IRR', 'USD']; }
  return [...new Set([...list, 'IRT'])];
}

/** Parse user input with Persian or Arabic-Indic digits and either decimal mark. */
export function parseNumber(s) {
  const str = String(s ?? '')
    .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x06f0)
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660)
    .replace(/[٫]/g, '.')
    .replace(/[٬,\s]/g, '')
    .trim();
  if (str === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(str)) return str === '' ? null : NaN;
  return Number(str);
}

/** Best-guess defaults from the device locale. */
export function guessDefaults(navLang = 'en') {
  const lang = /^fa\b/i.test(navLang) ? 'fa' : 'en';
  let region = '';
  try { region = new Intl.Locale(navLang).maximize().region || ''; } catch {}
  const EURO = 'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ');
  const BY_REGION = { IR: 'IRT', GB: 'GBP', US: 'USD', CA: 'CAD', AU: 'AUD', TR: 'TRY', AE: 'AED', AF: 'AFN', SE: 'SEK', NO: 'NOK', DK: 'DKK', CH: 'CHF' };
  const currency = BY_REGION[region] || (EURO.includes(region) ? 'EUR' : lang === 'fa' ? 'IRT' : 'USD');
  return { lang, displayCalendar: LANGS[lang].calendar, currency };
}
