// The setup guide's one switch.
//
// The guide is the first thing a new account sees, so unlike an extra feature
// this one ships ON: turning it off is how you get back the app as it was
// before — straight from Welcome to Home, no guide, no getting-started card,
// and the example notebooks and agenda seeded on first open as they always
// were.
//
// Every page that shows any part of the guide asks this file first, and
// Setup.dc.html refuses to paint at all while the answer is no. Nothing in
// the app writes OVERRIDE_KEY, so "on by default" is a property of the build
// rather than of one browser.
(function (root) {
  'use strict';

  var DEFAULT_ENABLED = true;
  var OVERRIDE_KEY = 'folio_setup_flag';

  // 'on' / 'off' in localStorage wins, for looking at both behaviours without
  // editing this file and reloading every page. Anything else is ignored.
  function enabled() {
    try {
      var o = localStorage.getItem(OVERRIDE_KEY);
      if (o === 'on') return true;
      if (o === 'off') return false;
    } catch (e) {}
    return DEFAULT_ENABLED;
  }

  // Called at the top of Setup.dc.html's script, before the page renders.
  // Returns false when the caller should stop, having already sent the
  // visitor to Home — replace() rather than assign() so Back doesn't bounce
  // them straight back into a page that will redirect again.
  function guardPage() {
    if (enabled()) return true;
    try { window.location.replace('Home.dc.html'); } catch (e) {}
    return false;
  }

  root.notivloSetupFlag = {
    enabled: enabled,
    guardPage: guardPage,
    DEFAULT_ENABLED: DEFAULT_ENABLED,
    OVERRIDE_KEY: OVERRIDE_KEY,
  };
}(typeof window !== 'undefined' ? window : this));
