/* The font a notebook is written in.
 *
 * Loaded from the <head> of the two pages that need it — Notebook, which
 * writes in it, and Settings, which picks it — ahead of anything that paints,
 * so a chapter never appears in one face and reflows into another.
 *
 * Only the reader's own writing follows this: the chapter heading, the body of
 * the chapter and the margin notes. The app around it keeps its own type, so
 * the interface stays recognisable whatever a notebook is set to.
 *
 * The stacks themselves are not here. Each one is a --font-notes-<id> token in
 * soft-clay.css and this file only chooses between them, so a font is
 * described in exactly one place and the stylesheet alone is enough to render
 * a notebook correctly before any of this runs.
 */
(function () {
  var PREFS_KEY = 'folio_prefs';

  // Four, deliberately: enough to suit how someone likes to read without
  // turning a notebook into a font menu. Every stack ends in a family that
  // exists everywhere, so no choice can leave a chapter unreadable.
  var NOTE_FONTS = [
    { id: 'comic', label: 'Comic Sans', note: 'Default',      sample: 'Aa' },
    { id: 'sans',  label: 'Sans',       note: 'As the app',   sample: 'Aa' },
    { id: 'serif', label: 'Serif',      note: 'Bookish',      sample: 'Aa' },
    { id: 'mono',  label: 'Mono',       note: 'Even widths',  sample: 'Aa' },
  ];

  var DEFAULT_ID = 'comic';

  function isNoteFontId(id) {
    for (var i = 0; i < NOTE_FONTS.length; i++) {
      if (NOTE_FONTS[i].id === id) return true;
    }
    return false;
  }

  function readNoteFontId() {
    try {
      var prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
      if (isNoteFontId(prefs.noteFont)) return prefs.noteFont;
    } catch (e) { /* unreadable storage — fall through to the default */ }
    return DEFAULT_ID;
  }

  // What a tile in Settings paints its sample with, and what the root is set
  // to below.
  function stackFor(id) {
    return 'var(--font-notes-' + (isNoteFontId(id) ? id : DEFAULT_ID) + ')';
  }

  // Cleared rather than set at the default, so an untouched account leaves no
  // inline property on the element and soft-clay.css's own --font-notes — the
  // same font — is what applies.
  function applyNoteFont(id) {
    var root = document.documentElement;
    if (!isNoteFontId(id) || id === DEFAULT_ID) root.style.removeProperty('--font-notes');
    else root.style.setProperty('--font-notes', stackFor(id));
  }

  function saveNoteFont(id) {
    if (!isNoteFontId(id)) return false;
    try {
      var prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
      prefs.noteFont = id;
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) { return false; }
    applyNoteFont(id);
    return true;
  }

  // Changed in another window — the Mac app can have a notebook and Settings
  // open side by side, and the notebook should follow along.
  window.addEventListener('storage', function (e) {
    if (e.key === PREFS_KEY || e.key === null) applyNoteFont(readNoteFontId());
  });

  window.NOTE_FONTS = NOTE_FONTS;
  window.readNoteFontId = readNoteFontId;
  window.noteFontStack = stackFor;
  window.applyNoteFont = applyNoteFont;
  window.saveNoteFont = saveNoteFont;

  applyNoteFont(readNoteFontId());
})();
