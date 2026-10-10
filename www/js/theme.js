// Classic script in <head>: sets the theme before first paint, so a saved Light/Dark
// choice doesn't flash the device theme while app.js loads. The setting itself lives in
// prefs (store.js); this reads the copy app.js keeps in localStorage, because the
// Android store (Preferences) can only be read asynchronously.
(function () {
  var pref = null;
  try { pref = localStorage.getItem('ghest-theme'); } catch (e) {}
  var dark = pref === 'dark' || (pref !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
