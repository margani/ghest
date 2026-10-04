// Browser-only: service worker registration, silent auto-update, install prompt.
// Inside the Android app none of this runs; updates there come from F-Droid or Obtainium.

import { Capacitor } from './vendor/capacitor-core.js';

const enabled = !Capacitor.isNativePlatform() && 'serviceWorker' in navigator && isSecureContext;
const startedAt = Date.now();
let installEvent = null;
let onInstallChange = () => {};

/** True when running as an installed app (home screen / desktop window). */
export const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** iOS Safari has no install prompt; users add to the home screen from the Share menu. */
export const iosManualInstall = !standalone && /iP(hone|ad|od)/.test(navigator.userAgent) && enabled;

export const isBrowser = !Capacitor.isNativePlatform();

export function canPromptInstall() {
  return !!installEvent;
}

export async function promptInstall() {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => {});
  installEvent = null;
  onInstallChange();
}

/**
 * Register the service worker and keep the app current.
 * A new version installs in the background and takes over at once; the page then reloads
 * only when that can't interrupt anything: while hidden, or in the first seconds after
 * launch with no sheet open. `isBusy` says whether a sheet (editor, settings) is open.
 */
export function initPwa({ isBusy, installChanged }) {
  onInstallChange = installChanged;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; installChanged(); });
  addEventListener('appinstalled', () => { installEvent = null; installChanged(); });
  if (!enabled) return { settle() {} };

  const hadController = !!navigator.serviceWorker.controller;
  let pending = false;

  const settle = () => {
    if (!pending) return;
    if (document.hidden || (Date.now() - startedAt < 5000 && !isBusy())) location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first visit: the page is already this version
    pending = true;
    settle();
  });

  navigator.serviceWorker.register('sw.js').then(reg => {
    // Check again whenever the app comes back to the foreground; reload when it goes away.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) settle();
      else reg.update().catch(() => {});
    });
  }).catch(e => console.warn('service worker', e));

  return { settle };
}

/** Ask the browser not to evict our storage under pressure (no prompt in most browsers). */
export function requestPersistentStorage() {
  if (enabled) navigator.storage?.persist?.().catch(() => {});
}
