// Native-style navigation: full-screen pages pushed on a stack that mirrors browser history,
// so the app bar's Back, Android's back gesture, the browser's back button and Escape
// all do the same thing: pop one page.

const stack = []; // open pages, bottom to top
const openers = new Map(); // page -> element that had focus when it was pushed

export function initNav() {
  history.replaceState({ depth: 0 }, '');
  addEventListener('popstate', e => {
    const depth = e.state?.depth ?? 0;
    while (stack.length > depth) hide(stack.pop());
    updateInert();
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && stack.length) { e.preventDefault(); back(); }
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-back]')) back(); });
}

/** Slide `page` in on top of the current screen. Focus goes to `focusEl`, or the page title. */
export function push(page, focusEl) {
  openers.set(page, document.activeElement);
  stack.push(page);
  page.style.zIndex = String(20 + stack.length);
  page.scrollTop = 0;
  page.removeAttribute('aria-hidden');
  page.classList.add('open');
  history.pushState({ depth: stack.length }, '');
  updateInert();
  (focusEl || page.querySelector('.appbar-title'))?.focus({ preventScroll: true });
}

/** Go back `n` pages (default one). The popstate handler does the actual hiding. */
export function back(n = 1) {
  if (stack.length) history.go(-Math.min(n, stack.length));
}

export function isOpen(page) {
  return stack.includes(page);
}

export function depth() {
  return stack.length;
}

function hide(page) {
  page.classList.remove('open');
  page.setAttribute('aria-hidden', 'true');
  page.inert = true;
  openers.get(page)?.focus?.({ preventScroll: true });
  openers.delete(page);
}

/** Only the top page (or the home screen when none is open) is interactive. */
function updateInert() {
  document.querySelector('main').inert = stack.length > 0;
  stack.forEach((p, i) => { p.inert = i < stack.length - 1; });
}
