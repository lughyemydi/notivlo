/* Sending feedback from inside the app.
 *
 * The landing page has a form that does the same thing. This is the one that
 * matters more: it is reachable at the moment something goes wrong, which is
 * the moment a person is actually willing to describe it.
 *
 * Where it goes: `public.feedback`, which is insert-only. The table grants
 * `anon` and `authenticated` exactly one verb and carries no select policy at
 * all, so nothing here — and nothing a reader of this file could write — can
 * read a report back out, their own included. That asymmetry is deliberate;
 * supabase/migrations/20261115090000_feedback.sql says so at more length.
 *
 * What it sends: the message, an email only if one is typed, which build and
 * which wrapper it came from, and the user-agent string. Not a line of what
 * is in anyone's notebooks. Settings states this above the button rather than
 * burying it in the privacy document, for the same reason PROVIDER.md argues
 * the lesson feature should: a disclosure nobody reads is not one.
 *
 * Signed in, the report carries the account id so a reply can find the right
 * person and so several reports from one tester can be read together. Signed
 * out it carries null, and that path is not second-class: someone who could
 * not get *past* sign-up is exactly who most needs to be able to say so.
 */
(function () {
  'use strict';

  // Bump with each release. It is what ties a report to the build it came
  // from, which is the difference between "this is broken" and "this broke
  // between beta 1 and beta 2".
  var APP_VERSION = '1.0.0-beta.4';

  var MESSAGE_MAX = 4000;   // matches feedback_message_len
  var EMAIL_MAX = 254;      // matches feedback_email_len
  var UA_MAX = 400;         // matches feedback_ua_len

  /* Which build this is. The native wrappers load the same pages from the
     bundle over file://, so the protocol separates native from browser and
     the user-agent separates the two native platforms. Anything unrecognised
     is reported as web rather than guessed at — the column is constrained to
     these three, and a wrong guess would be refused by the check.

     The iPad is the awkward one. Since desktop-class browsing, iPadOS reports
     a *Macintosh* user-agent, so matching on the UA alone files every iPad
     report under "mac" — and a layout bug that only happens on an iPad is
     exactly the kind this column exists to separate out. Touch points are the
     usual way to tell the two apart: a Mac reports 0 or 1, an iPad reports 5. */
  function surface() {
    try {
      if (window.location.protocol === 'file:') {
        var ua = (navigator && navigator.userAgent) || '';
        if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
        if (Number(navigator.maxTouchPoints) > 1) return 'ios';
        return 'mac';
      }
    } catch (e) {}
    return 'web';
  }

  function signedInUserId() {
    try {
      var sb = window.notivloSupabase;
      if (!sb || !sb.isSignedIn()) return null;
      var user = sb.user();
      return user && user.id ? user.id : null;
    } catch (e) {
      return null;
    }
  }

  /* The email the account was created with, offered as the default so a
     signed-in tester does not retype it. Still editable, and still optional:
     clearing it sends the report without one. */
  function suggestedEmail() {
    try {
      var sb = window.notivloSupabase;
      if (sb && sb.isSignedIn()) {
        var user = sb.user();
        if (user && user.email) return String(user.email);
      }
    } catch (e) {}
    try {
      var local = JSON.parse(localStorage.getItem('folio_session')) || {};
      return String(local.email || '');
    } catch (e) {}
    return '';
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /* Resolves { ok: true } or { ok: false, message }. The message is written
     to be shown to a person as it is — a tester who hits a failure here is
     already having a bad time, and "error 403" is not an answer. */
  function send(input) {
    var opts = input || {};
    var message = String(opts.message || '').trim();
    var email = String(opts.email || '').trim();

    if (!message) {
      return Promise.resolve({ ok: false, message: 'Write a line first and it will go.' });
    }
    if (email && !validEmail(email)) {
      return Promise.resolve({ ok: false, message: 'That email does not look right — or leave it empty.' });
    }

    var sb = window.notivloSupabase;
    if (!sb || !sb.ready()) {
      return Promise.resolve({
        ok: false,
        message: 'This build has no server configured, so feedback cannot be sent from here.',
      });
    }

    var userId = signedInUserId();
    var row = {
      message: message.slice(0, MESSAGE_MAX),
      email: email ? email.slice(0, EMAIL_MAX) : null,
      surface: surface(),
      app_version: APP_VERSION,
      user_agent: String((navigator && navigator.userAgent) || '').slice(0, UA_MAX),
      user_id: userId,
    };

    var path = '/rest/v1/feedback';
    var options = {
      method: 'POST',
      body: row,
      // Nothing is read back, so there is nothing to return. It also keeps
      // the response empty on a table the client is not allowed to select.
      headers: { Prefer: 'return=minimal' },
    };

    // Signed in, go through `authed` so the row can carry its user_id: the
    // insert policy checks it against auth.uid(), which means an anon-key
    // request claiming a user_id would be refused rather than silently
    // mis-attributed.
    var call = userId ? sb.authed(path, options) : sb.request(path, options);

    return call.then(function (res) {
      if (!res.error) return { ok: true };

      var err = res.error || {};
      if (err.offline) {
        return { ok: false, message: 'No connection — this will need sending again once you are back online.' };
      }
      if (err.status === 404) {
        return { ok: false, message: 'Feedback is not set up on this project yet.' };
      }
      return { ok: false, message: 'That did not send. Try again in a moment.' };
    }).catch(function () {
      return { ok: false, message: 'That did not send. Try again in a moment.' };
    });
  }

  window.notivloFeedback = {
    VERSION: APP_VERSION,
    MESSAGE_MAX: MESSAGE_MAX,
    EMAIL_MAX: EMAIL_MAX,
    surface: surface,
    suggestedEmail: suggestedEmail,
    send: send,
  };
})();
