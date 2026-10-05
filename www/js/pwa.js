// Browser-only: service worker registration, update prompt, install prompt.
// Inside the Android app none of this runs; updates there come from F-Droid or Obtainium.

import { Capacitor } from './vendor/capacitor-core.js';

const enabled = !Capacitor.isNativePlatform() && 'serviceWorker' in navigator && isSecureContext;
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
 * A new version downloads and activates in the background; `updateReady` is then called
 * so the UI can offer an Update button. Nothing reloads on its own: if the button is never
 * used, the next launch opens the new version anyway.
 */
export function initPwa({ updateReady, installChanged }) {
  onInstallChange = installChanged;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; installChanged(); });
  addEventListener('appinstalled', () => { installEvent = null; installChanged(); });
  if (!enabled) return;

  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) updateReady(); // on a first visit the page already is the current version
  });

  navigator.serviceWorker.register('sw.js').then(reg => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, 60 * 60 * 1000); // tabs that stay open for days
  }).catch(e => console.warn('service worker', e));
}

/** Switch to the version the service worker has already installed. */
export function applyUpdate() {
  location.reload();
}

/** Ask the browser not to evict our storage under pressure (no prompt in most browsers). */
export function requestPersistentStorage() {
  if (enabled) navigator.storage?.persist?.().catch(() => {});
}
