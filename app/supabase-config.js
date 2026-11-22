/* Where the backend is, and whether there is one.
 *
 * notivlo has always worked with no server at all, and still does: with the
 * two values below left empty every page behaves exactly as it did, storing
 * accounts and notebooks in localStorage. Filling them in is what turns the
 * Supabase side on — nothing else needs editing to switch between the two.
 *
 * The publishable key belongs in page source. It is not a secret: it
 * identifies the project and nothing else, and on its own it can read nothing,
 * because every table in supabase/migrations/ is row-level-secured against the
 * signed-in user and grants the unauthenticated role no access. The key that
 * *is* a secret — `sb_secret_…`, the service role key under the older scheme —
 * must never appear in this file or any other file the app ships.
 *
 * Note what is deliberately missing: no way to point the app at a different
 * backend at runtime. An override read from localStorage or the query string
 * would be convenient for testing and would also mean that anyone who can run
 * one line in the console can redirect every password typed afterwards to a
 * server of their choosing. Staging goes in a copy of this file.
 */
(function () {
  // https://<project-ref>.supabase.co — Project Settings → API → Project URL.
  var SUPABASE_URL = 'https://tftwbhkypzsrhwaxkgbr.supabase.co';

  // Project Settings → API Keys → Publishable key.
  //
  // This is the newer scheme. The legacy pair it replaces — a JWT called
  // `anon`, and `service_role` — still works and is still what the variable
  // below is named for, but Supabase retires it in early 2027, so a project
  // being set up now has no reason to adopt it. Nothing in supabase-client.js
  // decodes this value: it goes out verbatim as the `apikey` header and as the
  // bearer token when nobody is signed in, so either scheme works unchanged.
  var SUPABASE_ANON_KEY = 'sb_publishable_eTd8_Mo9HYVN50IjkTv0ag_B3d9MW2W';

  /* --------------------------------------------------------------------- */

  function trimSlash(s) {
    return String(s || '').replace(/\/+$/, '');
  }

  var url = trimSlash(SUPABASE_URL);
  var key = String(SUPABASE_ANON_KEY || '').trim();

  // Both, or neither. Half-configured is the state that produces confusing
  // failures deep in a request, so it is treated as "no backend" here.
  var configured = /^https:\/\/[^\s/]+$/.test(url) && key.length > 20;

  // A page served from a development host — the dev server on localhost, a
  // .localhost or .test name — runs with no backend, as if the values above
  // were empty. The project above is the live one, and without this a sign-up
  // made while testing locally is a real account on it, and the notebooks
  // typed afterwards sync into production. (That happened, 22 Nov 2026.)
  //
  // The Mac and iOS apps load from file:// and the beta from github.io, so
  // neither is affected. To test sync against the live project on purpose,
  // run `localStorage.notivloLiveBackend = '1'` on the dev host and reload;
  // remove it to switch back. This only turns the project above back on — it
  // cannot point the app anywhere else, which the note at the top rules out.
  var devHost = false;
  var liveOptIn = false;
  try {
    var host = String(window.location.hostname || '').toLowerCase();
    devHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
      || /\.localhost$/.test(host) || /\.test$/.test(host);
    liveOptIn = devHost && window.localStorage.getItem('notivloLiveBackend') === '1';
  } catch (e) { /* storage blocked: stay off on a dev host */ }
  if (devHost && !liveOptIn) configured = false;

  window.notivloBackend = {
    url: configured ? url : '',
    anonKey: configured ? key : '',

    // Every caller asks this first; the sync and auth modules are inert
    // without it and the pages fall back to their localStorage paths.
    configured: function () { return configured; },

    // True when the live project was switched off because this is a dev host.
    devOffline: devHost && !liveOptIn,

    // Where an email link (password reset, email confirmation) should land.
    // Must also be listed in the project's Auth → URL Configuration, or
    // Supabase refuses to redirect there.
    authRedirectUrl: function () {
      try {
        var here = window.location.href.split('?')[0].split('#')[0];
        return here.replace(/[^/]*$/, '') + 'SignIn.dc.html';
      } catch (e) {
        return '';
      }
    },

    // How long any one request may take before it is given up on. The pages
    // stay usable while a request is in flight, so this is about not leaving
    // a spinner running for a minute on a dead connection.
    timeoutMs: 15000,
  };
})();
