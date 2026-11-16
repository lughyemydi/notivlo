/* The live demo embedded in the landing page.
 *
 * The landing page shows the real app running in a frame rather than a
 * screenshot of it. The app and the landing page are served from the same
 * origin, which means they share one localStorage — so a demo that wrote to
 * it would hand a visitor's real notebooks a stranger's data, and a visitor
 * who had been using the app would find the demo full of their own work.
 *
 * This file prevents that by giving the demo its own storage. Before any
 * other script runs it replaces window.localStorage with an object that
 * keeps everything in memory and is thrown away with the frame. Nothing the
 * demo does can reach what is on disk, and nothing on disk can reach the
 * demo. Reloading starts a clean one.
 *
 * It has to be the FIRST script in the head of every page, above the session
 * guard: that guard reads localStorage to decide whether to bounce a
 * logged-out visitor to sign-in, and it has to be reading this store by then
 * rather than the real one.
 *
 * WHAT TURNS IT ON is the frame, not the URL. An earlier version used a
 * ?demo=1 query string and broke the moment anyone clicked a notebook: the
 * app navigates with plain relative links and scripted assignments to
 * location.href, the query string did not survive either, and the second
 * page came up with no session and bounced to sign-in. So the demo is
 * instead anything running inside a frame whose parent has declared itself
 * a demo host. That is a property of where the page is, not of how it was
 * linked to, so it holds across every navigation the visitor makes inside
 * the frame, through pages this file never has to know about.
 *
 * Two keys are planted and the app does the rest. `folio_session` is what
 * stops the bounce; `folio_setup_flag` is the build switch in
 * setup/setup-flag.js, set to 'off' so the demo opens on Home rather than on
 * the setup guide. Everything a visitor then sees — seven notebooks, a week
 * of classes and deadlines, the study minutes — is the app's own first-run
 * seed, written by Home and Planner into this memory store exactly as they
 * would write it to disk. The demo is not a fixture: it is the app's real
 * empty state, filled in by the app.
 *
 * Unframed, this file does nothing at all, so it is inert in an ordinary tab
 * and in the Mac and iOS wrappers.
 */
(function () {
  'use strict';

  /* The host frame, or null. Reading a property off window.parent throws
     when the parent is another origin, which is the case worth being
     careful about: a page somewhere else framing the app must never be able
     to switch this on, and the throw is what guarantees it. */
  function demoHost() {
    try {
      if (window.parent && window.parent !== window && window.parent.notivloDemoHost === true) {
        return window.parent;
      }
    } catch (e) { /* cross-origin parent — not our host */ }
    return null;
  }

  var host = demoHost();
  if (!host) return;

  /* A Storage-shaped object. The app reaches for getItem, setItem,
     removeItem, clear, key and length, and indexes nothing by property, so
     a plain object with those methods stands in exactly. Values are coerced
     to strings the way the real one does, because code that reads a number
     back out of storage expects to parse it. */
  function memoryStorage(data) {
    return {
      getItem: function (k) {
        k = String(k);
        return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
      },
      setItem: function (k, v) { data[String(k)] = String(v); },
      removeItem: function (k) { delete data[String(k)]; },
      clear: function () { for (var k in data) delete data[k]; },
      key: function (i) { var ks = Object.keys(data); return i < ks.length ? ks[i] : null; },
      get length() { return Object.keys(data).length; },
    };
  }

  /* The store lives on the host, not on this page, so that clicking from
     Home into a notebook and back keeps the same demo rather than starting
     a new one each time the frame navigates. */
  if (!host.notivloDemoData) {
    host.notivloDemoData = Object.create(null);
    var seed = memoryStorage(host.notivloDemoData);
    seed.setItem('folio_session', JSON.stringify({
      name: 'Sam',
      email: 'you@example.com',
      demo: true,
    }));
    seed.setItem('folio_setup_flag', 'off');
  }

  var store = memoryStorage(host.notivloDemoData);

  /* The theme comes from the page doing the embedding, so the demo is in the
     same mode as the site around it instead of asking the device and
     disagreeing with the page it sits in. Read fresh on every navigation,
     for the same reason the store is kept on the host. */
  var theme = 'system';
  try {
    if (host.notivloDemoTheme === 'light' || host.notivloDemoTheme === 'dark') {
      theme = host.notivloDemoTheme;
    }
  } catch (e) {}
  store.setItem('folio_prefs', JSON.stringify({ theme: theme }));

  /* defineProperty rather than assignment: localStorage is a getter on the
     window prototype in every browser that matters, and assigning to it is
     silently ignored. */
  try {
    Object.defineProperty(window, 'localStorage', {
      value: store,
      configurable: true,
      writable: false,
    });
  } catch (e) {
    /* Nothing sensible to fall back to: letting the demo run against the
       real store is exactly what this file exists to prevent, so it stops
       instead and the frame stays on whatever it was showing. */
    try { window.stop(); } catch (e2) {}
    return;
  }

  window.notivloDemo = true;

  /* Tell the host the app has painted, so it can take the screenshot out
     from under the frame only once there is something to replace it with. */
  function announce() {
    try {
      host.postMessage({ notivlo: 'demo-ready' }, window.location.origin);
    } catch (e) {}
  }
  if (document.readyState === 'complete') announce();
  else window.addEventListener('load', announce);
}());
