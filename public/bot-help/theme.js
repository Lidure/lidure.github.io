/* Bot Help shared theme controller: auto (default), light or dark. */
(function () {
  'use strict';
  var key = 'bot-help-theme-preference';
  var root = document.documentElement;
  var media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function readPreference() {
    try {
      var saved = window.localStorage.getItem(key);
      return saved === 'light' || saved === 'dark' ? saved : 'auto';
    } catch (_) {
      return 'auto';
    }
  }

  var preference = readPreference();

  function updateTheme() {
    var effective = preference === 'auto'
      ? (media && media.matches ? 'dark' : 'light')
      : preference;
    root.dataset.theme = effective;
    root.dataset.themeMode = preference;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', effective === 'dark' ? '#17141e' : '#fff6fa');
    }
    var control = document.getElementById('bot-help-theme');
    if (control && control.value !== preference) control.value = preference;
  }

  function initControl() {
    var control = document.getElementById('bot-help-theme');
    if (!control) return;
    control.value = preference;
    control.addEventListener('change', function () {
      var value = control.value;
      if (value !== 'auto' && value !== 'light' && value !== 'dark') return;
      preference = value;
      try {
        if (value === 'auto') window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch (_) { /* Browsers with blocked storage still switch locally. */ }
      updateTheme();
    });
  }

  // Called in <head> before paint, then again after the controls exist.
  updateTheme();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initControl, { once: true });
  } else {
    initControl();
  }

  function onSystemChange() {
    if (preference === 'auto') updateTheme();
  }
  if (media) {
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onSystemChange);
    } else if (typeof media.addListener === 'function') {
      media.addListener(onSystemChange);
    }
  }
  window.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    preference = readPreference();
    updateTheme();
  });
})();
