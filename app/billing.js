/* Lesson credits, on the page: how many are left, and how to buy more.
 *
 * Everything in notivlo is free except one thing — a lesson written to order,
 * which spends a real model call per lesson. This file is the page's side of
 * that: it reads the balance, and it starts a purchase. It cannot grant
 * anything, and there is deliberately no code here that could: credits arrive
 * because Stripe told the server so, signed, and the only way this file learns
 * about a purchase is by the balance going up. See supabase/PAID-TIER.md.
 *
 * ---------------------------------------------------------------------------
 * Inert without a backend, like everything else here
 *
 * With supabase-config.js empty, or nobody signed in, or no network, this
 * module does nothing and says so: `enabled()` is false, `balance()` is null,
 * and `canGenerate()` is false. The notebook then offers the seven written
 * lessons exactly as it did before any of this existed, which is the whole
 * point — the free app is the app, and the paid tier is one button inside it.
 *
 * It also makes no request at all until something asks it to. A page that
 * loaded this file has not touched the network because of it.
 *
 * ---------------------------------------------------------------------------
 * Why the balance here is only ever for display
 *
 * The number this module holds decides what a button says. It does not decide
 * whether a lesson may be written: generate-lesson asks the database, in a
 * locked transaction, every time. So a stale balance here is a cosmetic bug
 * and never a free lesson — which is the only arrangement worth having, since
 * anything in these files can be edited by whoever is holding the device.
 *
 * ---------------------------------------------------------------------------
 * Why Checkout opens outside the app
 *
 * Every page's Content-Security-Policy sets `form-action 'none'` and
 * `frame-src 'none'`, and lists only self and *.supabase.co in `connect-src`.
 * Stripe therefore cannot be framed, posted to, or fetched from a page here —
 * by design, and the right outcome: a card never comes near this app. The
 * server creates the Checkout Session and returns its URL, and this file hands
 * that URL to whatever will open it.
 *
 * In a browser that is window.open. In the Mac and iOS wrappers it is the
 * native side, through the same message-handler convention theme.js already
 * uses for appearance — `notivloOpenURL`, in
 * ../folio-app/Shared/NotivloWebView.swift. That side opens an https URL in
 * the system browser and refuses any host but Stripe's own, so handing it
 * something else achieves nothing; the URL checked here is the same one, and
 * neither check is load-bearing on its own.
 *
 * The third fallback — showing the student the URL — stays for every case
 * where neither is available: a wrapper built before the handler existed, and
 * a browser that blocked the window. It works, and it is the worst of the
 * three, so it is last.
 */
(function () {
  'use strict';

  var CHECKOUT_PATH = '/functions/v1/create-checkout';

  // The balance, once read. Null means "not read yet or not readable", which
  // is a different thing from zero and is why the panel can say "no credits"
  // without ever having to guess.
  var state = { balance: null, granted: 0, spent: 0, freeGrantUsed: false, purchases: 0, at: 0 };

  // Re-reading on every render would be a request per keystroke in a notebook.
  // Thirty seconds is short enough that a purchase made in another window
  // shows up while the student is still looking for it.
  var FRESH_MS = 30 * 1000;

  var pending = null;        // the one in-flight read, shared by callers
  var listeners = [];
  // Whether a purchase has been started in this session, which is what makes
  // this window re-read the balance when it comes back into focus. See
  // "Coming back from Checkout" below.
  var watching = false;

  function sb() { return window.notivloSupabase || null; }

  function enabled() {
    var s = sb();
    return !!(s && s.ready() && s.isSignedIn());
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](snapshot()); } catch (e) {}
    }
  }

  function snapshot() {
    return {
      enabled: enabled(),
      balance: state.balance,
      granted: state.granted,
      spent: state.spent,
      freeGrantUsed: state.freeGrantUsed,
      purchases: state.purchases,
      // The question every caller actually has.
      canGenerate: enabled() && typeof state.balance === 'number' && state.balance > 0,
    };
  }

  /* ---- Reading the balance -------------------------------------------- */

  // One round trip: my_entitlement() returns the balance and where it came
  // from as a single jsonb, because the panel needs all of it to write one
  // sentence and a second request to say "and three of those were free" would
  // be absurd.
  function refresh(force) {
    if (!enabled()) {
      state.balance = null;
      return Promise.resolve(snapshot());
    }
    if (!force && state.at && Date.now() - state.at < FRESH_MS) {
      return Promise.resolve(snapshot());
    }
    if (pending) return pending;

    pending = sb().rpc('my_entitlement', {}).then(function (res) {
      pending = null;
      if (res.error) {
        // Left as it was rather than zeroed. A failed read is not evidence of
        // an empty balance, and a panel that said "you have no credits"
        // because the network blinked would be telling the student something
        // false about their own money.
        //
        // The one exception worth noting: a project without the billing
        // migration applied answers PGRST202 here, and the balance stays null,
        // and the panel treats that as "not set up" rather than "none left".
        console.warn('notivlo: could not read lesson credits — ' + res.error.message);
        return snapshot();
      }
      var row = res.data || {};
      state.balance = typeof row.balance === 'number' ? row.balance : 0;
      state.granted = Number(row.granted) || 0;
      state.spent = Number(row.spent) || 0;
      state.freeGrantUsed = !!row.freeGrantUsed;
      state.purchases = Number(row.purchases) || 0;
      state.at = Date.now();
      notify();
      return snapshot();
    });
    return pending;
  }

  /* ---- Opening a purchase --------------------------------------------- */

  // Where a purchase may send a student. The same two hosts the native side
  // allows, in ../folio-app/Shared/NotivloWebView.swift, and the two lists
  // have to agree: `postMessage` is fire-and-forget, so if this one were the
  // wider of the two, a URL the native side quietly refused would look from
  // here like a page that had opened. The student would be left watching
  // nothing happen with no fallback, which is the failure this duplication
  // exists to prevent.
  //
  // checkout.stripe.com is the purchase; billing.stripe.com is the customer
  // portal, for the receipts page Settings will want.
  var OPENABLE_HOSTS = ['checkout.stripe.com', 'billing.stripe.com'];

  // An https URL to one of those hosts, or ''. Written against the host
  // exactly rather than with a regular expression over the whole URL, because
  // "ends in checkout.stripe.com" is a different and much weaker test than
  // "is checkout.stripe.com" — `https://checkout.stripe.com.example.net/` passes
  // the first.
  function openableUrl(raw) {
    var text = String(raw == null ? '' : raw);
    if (text.length > 2048 || !/^https:\/\/[^\s]+$/.test(text)) return '';
    var host = text.slice(8).split('/')[0].split('?')[0].split('#')[0];
    // No credentials in the authority: `https://checkout.stripe.com@evil.test/`
    // has a host of evil.test and would otherwise read as Stripe's.
    if (host.indexOf('@') >= 0) return '';
    host = host.split(':')[0].toLowerCase();
    for (var i = 0; i < OPENABLE_HOSTS.length; i++) {
      if (host === OPENABLE_HOSTS[i]) return text;
    }
    return '';
  }

  // Tried in order. The first that reports having opened the URL wins; the
  // last one always "works", in the sense that the student can at least read
  // where they were meant to go.
  function openExternal(url) {
    // The wrappers. Same convention as theme.js's notivloAppearance handler.
    try {
      var handler = window.webkit && window.webkit.messageHandlers
        && window.webkit.messageHandlers.notivloOpenURL;
      if (handler && typeof handler.postMessage === 'function') {
        handler.postMessage(String(url));
        return 'native';
      }
    } catch (e) { /* not in a wrapper, or the handler is not registered */ }

    try {
      // noopener, because the Stripe page has no business holding a reference
      // back to this one.
      var win = window.open(String(url), '_blank', 'noopener,noreferrer');
      if (win) return 'window';
    } catch (e) {}

    return 'none';
  }

  /**
   * Start a purchase. Resolves with { ok, url, opened } — `opened` is 'native',
   * 'window' or 'none', and on 'none' the caller is expected to show the URL,
   * because it is the only thing left that will get the student there.
   *
   * Note what is not sent: a price, an amount, a quantity, a currency, or a
   * number of credits. A pack name, and that is all. The server resolves what
   * that costs from its own environment — see supabase/functions/_shared/packs.ts
   * for why that separation is the whole security of the purchase path.
   */
  function buy(pack) {
    if (!enabled()) {
      return Promise.resolve({
        ok: false,
        error: 'Sign in to buy lesson credits.',
      });
    }
    // Starting a purchase is what arms the re-read below. Doing it here rather
    // than leaving it to the caller means a caller cannot forget, and the
    // failure if they did would be the worst kind: a student who paid, came
    // back, and saw the same "no credits" panel.
    watching = true;
    return sb().authed(CHECKOUT_PATH, {
      method: 'POST',
      body: { pack: String(pack || 'medium') },
    }).then(function (res) {
      if (res.error) {
        return { ok: false, error: res.error.message || 'The payment page could not be opened just now.' };
      }
      // Refused rather than opened if it is not a Stripe page. The server is
      // ours and should never return anything else, which is exactly why a
      // response that does is worth treating as a fault rather than following.
      var url = openableUrl(res.data && res.data.url);
      if (!url) {
        return { ok: false, error: 'The payment page could not be opened just now.' };
      }
      return { ok: true, url: url, opened: openExternal(url), sessionId: res.data.sessionId || '' };
    });
  }

  /** Which packs this deployment sells, if any. The page does not hard-code
   *  them: a pack with no price configured is a pack the webhook could not
   *  grant, so the server is the only thing that knows which exist. */
  function packs() {
    if (!enabled()) return Promise.resolve([]);
    return sb().authed(CHECKOUT_PATH, { method: 'POST', body: { list: true } })
      .then(function (res) {
        if (res.error || !res.data || !Array.isArray(res.data.packs)) return [];
        return res.data.packs;
      });
  }

  /* ---- Coming back from Checkout -------------------------------------- */

  // The purchase happens in another window, so there is no callback. What
  // there is: the student returning to this one. Re-reading the balance when
  // the page regains focus is what turns "I paid" into a number going up,
  // without polling anything.
  //
  // Only after a purchase has been started in this session — `watching`, set
  // by buy() — so a notebook that nobody is buying anything in makes no
  // requests on every tab switch. Exported as well, for a caller that sends a
  // student to a payment page some other way.
  function watchForReturn() { watching = true; }

  try {
    window.addEventListener('focus', function () {
      if (watching && enabled()) refresh(true);
    });
    document.addEventListener('visibilitychange', function () {
      if (watching && !document.hidden && enabled()) refresh(true);
    });
  } catch (e) {}

  // Signing in or out changes the answer to every question here. The balance
  // is dropped rather than kept: showing the last account's credit count to
  // whoever signs in next would be showing them someone else's money.
  if (sb() && sb().onChange) {
    sb().onChange(function () {
      state = { balance: null, granted: 0, spent: 0, freeGrantUsed: false, purchases: 0, at: 0 };
      notify();
      if (enabled()) refresh(true);
    });
  }

  window.notivloBilling = {
    enabled: enabled,
    /** The last-read snapshot. Never a promise: callers render with this and
     *  call refresh() when they want it to be current. */
    state: snapshot,
    balance: function () { return state.balance; },
    canGenerate: function () { return snapshot().canGenerate; },
    refresh: refresh,
    packs: packs,
    buy: buy,
    watchForReturn: watchForReturn,
    onChange: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
  };
})();
