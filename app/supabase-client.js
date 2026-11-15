/* The HTTP layer: tokens, refresh, and two helpers for talking to PostgREST.
 *
 * This is deliberately not the supabase-js SDK. The pages are plain files
 * loaded with <script src>, there is no bundler and no package.json, and the
 * native wrapper loads the same files from disk — so a CDN import would add a
 * network dependency to boot, and a vendored UMD bundle would add ~40 kB of
 * code to carry for the handful of endpoints the app actually uses. Supabase
 * is a REST API; this file is that API.
 *
 *   /auth/v1/...   GoTrue: signup, token, logout, user, recover
 *   /rest/v1/...   PostgREST: one path per table, plus /rpc/<function>
 *
 * Everything returns { data, error } rather than throwing, because every
 * caller is a form handler that has to put a sentence on screen either way.
 * An `error` carries { status, code, message, offline } where `message` is
 * already fit to show a reader.
 *
 * The session (access token, refresh token, user) lives in localStorage, next
 * to the rest of the app's state, and is refreshed slightly before it expires
 * rather than after a request has already failed on it.
 */
(function () {
  var backend = window.notivloBackend || { configured: function () { return false; } };

  var SESSION_KEY = 'folio_supabase_session';
  // Refresh this far ahead of expiry, so a request never leaves with a token
  // that will have expired by the time it arrives.
  var REFRESH_MARGIN_MS = 60 * 1000;

  var listeners = [];
  var refreshing = null;   // the one in-flight refresh, shared by all callers

  /* ---------- session storage ------------------------------------------ */

  function readSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!s || typeof s !== 'object' || !s.access_token) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  function writeSession(session) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) { /* storage full or blocked — the session lasts this page */ }
  }

  function dropSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // GoTrue returns expires_in (seconds from now) and usually expires_at
  // (epoch seconds). expires_in is the one that does not depend on the
  // device's clock agreeing with the server's, so it wins where both exist.
  function stamp(token) {
    var now = Date.now();
    var ms = Number(token.expires_in) > 0
      ? Number(token.expires_in) * 1000
      : (Number(token.expires_at) > 0 ? Number(token.expires_at) * 1000 - now : 3600 * 1000);
    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_type: token.token_type || 'bearer',
      expires_at_ms: now + ms,
      user: token.user || null,
    };
  }

  function notify(event, session) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](event, session); } catch (e) {}
    }
  }

  function setSession(token) {
    var session = stamp(token);
    writeSession(session);
    notify('signed-in', session);
    return session;
  }

  function clearSession() {
    dropSession();
    notify('signed-out', null);
  }

  /* ---------- the request itself --------------------------------------- */

  function fail(status, code, message, extra) {
    var error = { status: status, code: code || '', message: message };
    if (extra) for (var k in extra) error[k] = extra[k];
    return { data: null, error: error };
  }

  var OFFLINE_MESSAGE = "Can't reach notivlo's server. Check your connection and try again.";

  function request(path, options) {
    var opts = options || {};

    if (!backend.configured()) {
      return Promise.resolve(fail(0, 'not_configured',
        'No backend is configured for this build.', { notConfigured: true }));
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return Promise.resolve(fail(0, 'offline', OFFLINE_MESSAGE, { offline: true }));
    }

    var headers = {
      apikey: backend.anonKey,
      Authorization: 'Bearer ' + (opts.token || backend.anonKey),
    };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.headers) for (var h in opts.headers) headers[h] = opts.headers[h];

    // A request that outlives its usefulness is cut off rather than left to
    // hold a spinner on screen indefinitely.
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () { controller.abort(); }, backend.timeoutMs || 15000)
      : null;

    return fetch(backend.url + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller ? controller.signal : undefined,
      cache: 'no-store',
      credentials: 'omit',
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (res.status === 204) return { data: null, error: null, status: 204 };

      return res.text().then(function (text) {
        var body = null;
        if (text) {
          try { body = JSON.parse(text); } catch (e) { body = { message: text }; }
        }
        if (res.ok) return { data: body, error: null, status: res.status };

        // GoTrue and PostgREST disagree about which field holds the message,
        // so all of them are tried before falling back to the status line.
        var message = (body && (body.error_description || body.msg || body.message
          || body.error_message || body.hint || body.error)) || ('Request failed (' + res.status + ').');
        var code = (body && (body.error_code || body.code)) || '';
        return fail(res.status, code, String(message));
      });
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      if (e && e.name === 'AbortError') {
        return fail(0, 'timeout', 'That took too long. Try again.', { timeout: true });
      }
      // A TypeError from fetch is the network itself: DNS, no route, a CSP
      // connect-src that does not list this project, a blocked request.
      return fail(0, 'network', OFFLINE_MESSAGE, { offline: true });
    });
  }

  /* ---------- tokens --------------------------------------------------- */

  function refresh() {
    if (refreshing) return refreshing;
    var session = readSession();
    if (!session || !session.refresh_token) {
      return Promise.resolve(fail(401, 'no_session', 'You are signed out.'));
    }

    refreshing = request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: session.refresh_token },
    }).then(function (res) {
      refreshing = null;
      if (res.error) {
        // A refresh token the server has forgotten (revoked, rotated past,
        // or the account deleted) is unrecoverable: the session is over, and
        // the pages are told so they can send the reader to sign in. A
        // network failure is not that — the session is kept and retried.
        //
        // GoTrue reports the dead-token case as a 400 about refresh tokens,
        // which would reach a form handler as a sentence about refresh
        // tokens. Every caller means the same thing by it, so it is
        // normalised here rather than in each of them.
        if (res.error.status === 400 || res.error.status === 401) {
          clearSession();
          return fail(401, 'no_session', 'Your session has expired. Sign in again.');
        }
        return res;
      }
      if (!res.data || !res.data.access_token) {
        clearSession();
        return fail(401, 'no_session', 'You are signed out.');
      }
      var next = stamp(res.data);
      // A refresh response carries no `user` in some versions; keeping the
      // one already held stops the signed-in name vanishing mid-session.
      if (!next.user) next.user = session.user;
      writeSession(next);
      notify('refreshed', next);
      return { data: next, error: null };
    });

    return refreshing;
  }

  // The access token to send, refreshed first if it is at or near expiry.
  function accessToken() {
    var session = readSession();
    if (!session) return Promise.resolve({ data: null, error: null });
    if (Date.now() < session.expires_at_ms - REFRESH_MARGIN_MS) {
      return Promise.resolve({ data: session.access_token, error: null });
    }
    return refresh().then(function (res) {
      if (res.error) return { data: null, error: res.error };
      return { data: res.data.access_token, error: null };
    });
  }

  // A request made as the signed-in user. One retry after a 401: a token can
  // be rejected for reasons the expiry check cannot see (a clock that is
  // wrong, a server-side rotation), and refreshing once is cheaper than
  // bouncing a reader to the sign-in page over it.
  function authed(path, options, retried) {
    return accessToken().then(function (tok) {
      if (tok.error) return { data: null, error: tok.error };
      if (!tok.data) return fail(401, 'no_session', 'You are signed out.');

      var opts = {};
      for (var k in (options || {})) opts[k] = options[k];
      opts.token = tok.data;

      return request(path, opts).then(function (res) {
        if (res.error && res.error.status === 401 && !retried) {
          return refresh().then(function (r) {
            if (r.error) return res;
            return authed(path, options, true);
          });
        }
        return res;
      });
    });
  }

  /* ---------- PostgREST ------------------------------------------------ */

  function query(params) {
    var parts = [];
    for (var k in (params || {})) {
      if (params[k] === undefined || params[k] === null) continue;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    }
    return parts.length ? '?' + parts.join('&') : '';
  }

  // Rows for this account. The policies already restrict every table to the
  // caller, so a filter here is about narrowing, never about access.
  function select(table, params) {
    var p = params || {};
    if (!p.select) p.select = '*';
    return authed('/rest/v1/' + table + query(p), { method: 'GET' });
  }

  // `onConflict` names the natural key from the migration — 'user_id,slug'
  // for notebooks, 'notebook_id,position' for chapters — so a second sync of
  // the same record updates it instead of failing on the unique constraint.
  function upsert(table, rows, onConflict) {
    var list = Array.isArray(rows) ? rows : [rows];
    if (!list.length) return Promise.resolve({ data: [], error: null });
    return authed('/rest/v1/' + table + query({ on_conflict: onConflict }), {
      method: 'POST',
      body: list,
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
        'Content-Profile': 'public',
      },
    });
  }

  function remove(table, params) {
    // PostgREST deletes everything matching, and an empty filter matches the
    // caller's whole table. Nothing here is allowed to be that request by
    // accident: a delete without a filter is a bug, not a wipe.
    var p = params || {};
    var hasFilter = false;
    for (var k in p) { if (k !== 'select') hasFilter = true; }
    if (!hasFilter) {
      return Promise.resolve(fail(0, 'unfiltered_delete',
        'Refusing to delete without a filter.'));
    }
    return authed('/rest/v1/' + table + query(p), {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  }

  function rpc(name, args) {
    return authed('/rest/v1/rpc/' + name, { method: 'POST', body: args || {} });
  }

  /* ---------- other tabs ----------------------------------------------- */

  // Signing out in Settings in one tab should not leave another tab holding a
  // session. localStorage fires `storage` in the *other* tabs only, which is
  // exactly the ones that need telling.
  try {
    window.addEventListener('storage', function (e) {
      if (e.key !== SESSION_KEY && e.key !== null) return;
      var session = readSession();
      notify(session ? 'signed-in' : 'signed-out', session);
    });
  } catch (e) {}

  window.notivloSupabase = {
    SESSION_KEY: SESSION_KEY,
    ready: function () { return backend.configured(); },
    session: readSession,
    user: function () { var s = readSession(); return s ? s.user : null; },
    isSignedIn: function () { return !!readSession(); },
    setSession: setSession,
    clearSession: clearSession,
    accessToken: accessToken,
    refresh: refresh,
    request: request,
    authed: authed,
    select: select,
    upsert: upsert,
    remove: remove,
    rpc: rpc,
    onChange: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };
})();
