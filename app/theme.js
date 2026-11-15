/* Light and dark appearance, applied on every page.
 *
 * Loaded from each page's <head>, ahead of anything that paints, so a dark
 * page never flashes white on its way in.
 *
 * The choice is 'system' (follow the device), 'light' or 'dark', kept in
 * folio_prefs beside the text size. All this file does is mark the root
 * element data-theme="light" or "dark"; soft-clay.css holds both palettes and
 * swaps its colour tokens under that attribute.
 */
(function () {
  var PREFS_KEY = 'folio_prefs';

  var THEMES = [
    { id: 'system', label: 'Match system' },
    { id: 'light',  label: 'Light' },
    { id: 'dark',   label: 'Dark' },
  ];

  // soft-clay.css's dark --color-background. Painted onto <html> directly
  // because the stylesheet only arrives with the page body, and until then the
  // window would otherwise be plain white.
  var DARK_GROUND = '#14161b';

  var media = null;
  try { media = window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) { /* no matchMedia */ }

  var current = null;
  var postedToShell = null;

  function isThemeId(id) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === id) return true;
    }
    return false;
  }

  function readThemeId() {
    try {
      var prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
      if (isThemeId(prefs.theme)) return prefs.theme;
    } catch (e) { /* unreadable storage — fall through to the default */ }
    return 'system';
  }

  function resolveTheme(id) {
    if (id === 'light' || id === 'dark') return id;
    return media && media.matches ? 'dark' : 'light';
  }

  // The Mac and iPhone apps mirror the choice onto the native window, so the
  // title bar and status bar match the page instead of the device setting.
  // Sent as the choice, not the result: 'system' has to hand control back to
  // the device rather than pin whatever it happens to be right now.
  function tellNativeShell(id) {
    if (postedToShell === id) return;
    try {
      var handler = window.webkit && window.webkit.messageHandlers
        && window.webkit.messageHandlers.notivloAppearance;
      if (handler) { handler.postMessage(id); postedToShell = id; }
    } catch (e) { /* not running inside the native shell */ }
  }

  function applyTheme(id) {
    var resolved = resolveTheme(id);
    var root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    // Native controls, scrollbars and form popups follow this.
    root.style.colorScheme = resolved;
    if (resolved === 'dark') root.style.backgroundColor = DARK_GROUND;
    else root.style.removeProperty('background-color');
    tellNativeShell(id);

    var changed = !current || current.id !== id || current.resolved !== resolved;
    current = { id: id, resolved: resolved };
    if (changed) {
      try {
        window.dispatchEvent(new CustomEvent('notivlo:themechange', { detail: { id: id, resolved: resolved } }));
      } catch (e) { /* CustomEvent unavailable — nothing is listening then anyway */ }
    }
  }

  function saveTheme(id) {
    if (!isThemeId(id)) return false;
    try {
      var prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
      prefs.theme = id;
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) { return false; }

    // Most surfaces ease their background on hover, and would all fade to the
    // new palette at slightly different speeds. The switch should be one clean
    // cut, so transitions are held off until it has painted.
    var root = document.documentElement;
    root.classList.add('notivlo-theme-switching');
    applyTheme(id);
    var release = function () { root.classList.remove('notivlo-theme-switching'); };
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () { requestAnimationFrame(release); });
    } else {
      setTimeout(release, 50);
    }
    return true;
  }

  function currentTheme() {
    return { id: current ? current.id : readThemeId(), resolved: current ? current.resolved : resolveTheme(readThemeId()) };
  }

  // The device switched between light and dark (on a schedule, say) while the
  // app was open.
  if (media) {
    var onSystemChange = function () {
      if (readThemeId() === 'system') applyTheme('system');
    };
    if (media.addEventListener) media.addEventListener('change', onSystemChange);
    else if (media.addListener) media.addListener(onSystemChange);
  }

  // The setting was changed in another window — the Mac app can have several.
  window.addEventListener('storage', function (e) {
    if (e.key === PREFS_KEY || e.key === null) applyTheme(readThemeId());
  });

  window.THEMES = THEMES;
  window.readThemeId = readThemeId;
  window.saveTheme = saveTheme;
  window.currentTheme = currentTheme;

  applyTheme(readThemeId());
})();
