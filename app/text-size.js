/* Text size preference, applied on every page.
 *
 * Loaded from each page's <head> rather than the <helmet>, so the size is set
 * before first paint and the app doesn't visibly resize a moment after it
 * appears.
 *
 * Implemented as a zoom on the root element rather than by scaling font sizes
 * alone. Every size in this app is a hardcoded px value, much of it inline, so
 * there is no type scale to turn up — and growing the text while padding,
 * row heights and the 30px toolbar buttons stayed put would push text out of
 * fixed-size boxes. Zoom scales the whole interface together, which keeps every
 * layout intact at every step and is what a reader actually wants: bigger text
 * with its surroundings still in proportion.
 */
(function () {
  var PREFS_KEY = 'folio_prefs';

  // Deliberately gentle. 1 is the app's own sizing; a step either side is
  // noticeable without reflowing anything dramatically.
  var TEXT_SCALES = [
    { id: 'compact',  label: 'Compact',     scale: 0.92 },
    { id: 'default',  label: 'Default',     scale: 1 },
    { id: 'large',    label: 'Large',       scale: 1.1 },
    { id: 'largest',  label: 'Extra large', scale: 1.22 },
  ];

  function readTextSizeId() {
    try {
      var prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
      var id = prefs.textSize;
      for (var i = 0; i < TEXT_SCALES.length; i++) {
        if (TEXT_SCALES[i].id === id) return id;
      }
    } catch (e) { /* unreadable storage — fall through to the default */ }
    return 'default';
  }

  function scaleFor(id) {
    for (var i = 0; i < TEXT_SCALES.length; i++) {
      if (TEXT_SCALES[i].id === id) return TEXT_SCALES[i].scale;
    }
    return 1;
  }

  // Cleared rather than set to 1 at the default, so the untouched case leaves
  // no zoom on the element at all.
  function applyTextSize(id) {
    var scale = scaleFor(id);
    var root = document.documentElement;
    if (scale === 1) root.style.removeProperty('zoom');
    else root.style.zoom = String(scale);
  }

  function saveTextSize(id) {
    try {
      var prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
      prefs.textSize = id;
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) { return false; }
    applyTextSize(id);
    return true;
  }

  window.TEXT_SCALES = TEXT_SCALES;
  window.readTextSizeId = readTextSizeId;
  window.applyTextSize = applyTextSize;
  window.saveTextSize = saveTextSize;

  applyTextSize(readTextSizeId());
})();
