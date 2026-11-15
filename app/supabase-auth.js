/* Accounts, against the server.
 *
 * The same six operations the pages already do — create an account, sign in,
 * sign out, reset a forgotten password, change a known one, edit the profile
 * — plus deleting an account and exporting it, which localStorage could only
 * approximate.
 *
 * What moves off the device by doing this:
 *
 *   - Passwords. auth.js derives PBKDF2 hashes because there was nowhere else
 *     to put a credential; GoTrue stores a bcrypt hash and the app never sees
 *     the password again after the request leaves. The rules themselves stay
 *     in auth.js, shared with the pages' live checklist, and are checked here
 *     before anything is sent.
 *
 *   - "No account found for that email." Settings and SignIn say that today
 *     because the user store is right there to look in. A server answers
 *     "Incorrect email or password" to both halves instead, so a stranger
 *     cannot use the form to find out which addresses are registered.
 *
 * Every call resolves to { ok: true, ... } or { ok: false, error: '<sentence
 * for the reader>' }. Nothing throws, and nothing here redirects — the page
 * decides where to go next, as it does now.
 */
(function () {
  var sb = window.notivloSupabase;
  var backend = window.notivloBackend || { configured: function () { return false; } };

  // The app's own session marker: { email, name }. Every page gates on this
  // key, and the native shell reads it too, so it is kept in step with the
  // real session rather than replaced. The tokens live under their own key.
  var APP_SESSION_KEY = 'folio_session';

  // auth.js's own limits and password rules, so there is one definition of
  // both and not a second one here that can drift. A top-level `const` in a
  // classic script is not a property of `window`, which is why this is a
  // typeof check on the bare name rather than a lookup on the object.
  var LIMITS = (typeof FIELD_LIMITS !== 'undefined' && FIELD_LIMITS)
    || window.FIELD_LIMITS
    || { name: 80, email: 254, password: 128 };

  function rules(pw, subject) {
    var fn = (typeof passwordProblem !== 'undefined' && passwordProblem) || window.passwordProblem;
    return typeof fn === 'function' ? fn(pw, subject) : '';
  }

  function enabled() {
    return !!(sb && backend.configured());
  }

  function off() {
    return { ok: false, error: 'No account server is configured for this build.', notConfigured: true };
  }

  function emailOk(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function clean(email) {
    return String(email || '').trim().toLowerCase();
  }

  // GoTrue takes the page an email link should return to as a query parameter
  // on the request that sends the email, not as a field in its body: a body
  // field is accepted and quietly ignored, and the link then lands on the
  // project's Site URL instead of wherever the app is actually running.
  function redirectParam() {
    var to = backend.authRedirectUrl();
    return to ? '?redirect_to=' + encodeURIComponent(to) : '';
  }

  /* ---------- turning server errors into sentences ---------------------- */

  // GoTrue's wording is for developers, and some of it ("Invalid login
  // credentials") would be a worse answer on screen than the app's own. The
  // mapping is by code where there is one, and by substring where there is
  // not, because the codes arrived later than the messages.
  function say(error, fallback) {
    if (!error) return fallback;
    if (error.offline || error.timeout || error.notConfigured) return error.message;

    var code = String(error.code || '').toLowerCase();
    var msg = String(error.message || '').toLowerCase();

    if (code === 'invalid_credentials' || msg.indexOf('invalid login credentials') >= 0) {
      return 'Incorrect email or password.';
    }
    if (code === 'email_not_confirmed' || msg.indexOf('email not confirmed') >= 0) {
      return 'Confirm your email address first — check your inbox for the link.';
    }
    if (code === 'user_already_exists' || code === 'email_exists'
        || msg.indexOf('already registered') >= 0 || msg.indexOf('already been registered') >= 0) {
      return 'An account with that email already exists.';
    }
    if (code === 'weak_password' || msg.indexOf('password should be') >= 0) {
      // The server's own reason is more specific than anything guessable here.
      return error.message;
    }
    if (code === 'same_password' || msg.indexOf('should be different from the old') >= 0) {
      return 'That is already your password — pick a different one.';
    }
    if (error.status === 429 || code.indexOf('rate_limit') >= 0 || msg.indexOf('rate limit') >= 0) {
      return 'Too many attempts. Wait a minute and try again.';
    }
    if (code === 'signup_disabled' || msg.indexOf('signups not allowed') >= 0) {
      return 'New accounts are closed at the moment.';
    }
    if (code === 'validation_failed' && msg.indexOf('email') >= 0) {
      return 'Enter a valid email address.';
    }
    if (error.status === 401 || code === 'no_session'
        || code.indexOf('refresh_token') >= 0 || code.indexOf('session_') >= 0
        || msg.indexOf('refresh token') >= 0) {
      return 'Your session has expired. Sign in again.';
    }
    return fallback || error.message || 'Something went wrong. Try again.';
  }

  /* ---------- the app's session marker ---------------------------------- */

  function displayName(user) {
    var meta = (user && user.user_metadata) || {};
    return String(meta.name || meta.full_name || '').trim();
  }

  function writeAppSession(user) {
    if (!user) return;
    try {
      localStorage.setItem(APP_SESSION_KEY, JSON.stringify({
        email: user.email || '',
        name: displayName(user),
      }));
    } catch (e) {}
  }

  function clearAppSession() {
    try { localStorage.removeItem(APP_SESSION_KEY); } catch (e) {}
  }

  /* ---------- create an account ----------------------------------------- */

  // Returns { ok: true, signedIn: true } when the project creates sessions on
  // signup, and { ok: true, signedIn: false, needsConfirmation: true } when it
  // sends a confirmation email first. SignUp.dc.html has to handle both: the
  // second one has no session, so there is nowhere to send the reader yet.
  function signUp(details) {
    if (!enabled()) return Promise.resolve(off());

    var name = String((details && details.name) || '').trim();
    var email = clean(details && details.email);
    var password = String((details && details.password) || '');

    if (!name) return Promise.resolve({ ok: false, error: 'Enter your name.' });
    if (name.length > LIMITS.name) {
      return Promise.resolve({ ok: false, error: 'Keep your name under ' + LIMITS.name + ' characters.' });
    }
    if (!emailOk(email) || email.length > LIMITS.email) {
      return Promise.resolve({ ok: false, error: 'Enter a valid email address.' });
    }
    var problem = rules(password);
    if (problem) return Promise.resolve({ ok: false, error: problem });
    if (password.length > LIMITS.password) {
      return Promise.resolve({ ok: false, error: 'Keep your password under ' + LIMITS.password + ' characters.' });
    }

    return sb.request('/auth/v1/signup' + redirectParam(), {
      method: 'POST',
      body: {
        email: email,
        password: password,
        // Read by the handle_new_user trigger to fill profiles.name, so the
        // display name exists from the first moment the account does.
        data: { name: name },
      },
    }).then(function (res) {
      if (res.error) return { ok: false, error: say(res.error, 'Could not create the account.') };

      var body = res.data || {};
      // Confirmations on: GoTrue answers with the user and no tokens.
      if (!body.access_token) {
        return { ok: true, signedIn: false, needsConfirmation: true, email: email };
      }
      var session = sb.setSession(body);
      var user = session.user || body.user || { email: email, user_metadata: { name: name } };
      writeAppSession(user);
      return { ok: true, signedIn: true, user: user };
    });
  }

  /* ---------- sign in --------------------------------------------------- */

  function signIn(details) {
    if (!enabled()) return Promise.resolve(off());

    var email = clean(details && details.email);
    var password = String((details && details.password) || '');

    if (!email || !password) {
      return Promise.resolve({ ok: false, error: 'Enter your email and password.' });
    }
    // Over-long input is rejected without a round trip, and with the same
    // sentence a wrong password gets: the length of what was typed is not
    // something the form needs to confirm.
    if (email.length > LIMITS.email || password.length > LIMITS.password) {
      return Promise.resolve({ ok: false, error: 'Incorrect email or password.' });
    }

    return sb.request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email: email, password: password },
    }).then(function (res) {
      if (res.error) return { ok: false, error: say(res.error, 'Incorrect email or password.') };
      var body = res.data || {};
      if (!body.access_token) return { ok: false, error: 'Incorrect email or password.' };

      var session = sb.setSession(body);
      var user = session.user || body.user || { email: email };
      writeAppSession(user);
      return { ok: true, user: user };
    });
  }

  /* ---------- sign out -------------------------------------------------- */

  // The local session goes whatever the server says. A logout that fails on a
  // dead connection must still sign the reader out of this device; the token
  // expires on its own within the hour.
  function signOut() {
    clearAppSession();
    if (!enabled() || !sb.isSignedIn()) {
      if (sb) sb.clearSession();
      return Promise.resolve({ ok: true });
    }
    return sb.authed('/auth/v1/logout', { method: 'POST', body: {} })
      .then(function () { sb.clearSession(); return { ok: true }; })
      .catch(function () { sb.clearSession(); return { ok: true }; });
  }

  /* ---------- forgotten password ---------------------------------------- */

  // Sends the reset email. Answers the same way whether or not the address has
  // an account — which is the point, and the opposite of what the app can do
  // with a user store it can read. The honest note on SignIn about there being
  // no email to send needs replacing when this is wired up.
  function sendPasswordReset(email) {
    if (!enabled()) return Promise.resolve(off());
    var addr = clean(email);
    if (!emailOk(addr)) {
      return Promise.resolve({ ok: false, error: 'Enter the email address you signed up with.' });
    }

    return sb.request('/auth/v1/recover' + redirectParam(), {
      method: 'POST',
      body: { email: addr },
    }).then(function (res) {
      if (res.error && res.error.status !== 422) {
        return { ok: false, error: say(res.error, 'Could not send the reset email.') };
      }
      return {
        ok: true,
        message: 'Check ' + addr + ' for a link to set a new password. It expires in an hour.',
      };
    });
  }

  // The link in that email lands back on the app with tokens in the URL
  // fragment. Reading them establishes a session just long enough to set a new
  // password, then the fragment is wiped from the address bar and from
  // history — an access token left in a URL gets copied, pasted and shared.
  //
  // Returns { ok: true, recovery: true } when a recovery session was picked
  // up, { ok: false, ... } when there was nothing to pick up.
  function consumeRecoveryLink() {
    if (!enabled()) return off();

    var hash = '';
    try { hash = String(window.location.hash || '').replace(/^#/, ''); } catch (e) {}
    if (!hash) return { ok: false, none: true };

    var params = {};
    hash.split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i <= 0) return;
      params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    });

    function scrub() {
      try {
        var url = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', url);
      } catch (e) {
        try { window.location.hash = ''; } catch (e2) {}
      }
    }

    if (params.error || params.error_description) {
      scrub();
      var why = params.error_description || params.error;
      return {
        ok: false,
        error: /expired/i.test(why)
          ? 'That reset link has expired. Ask for a new one.'
          : 'That reset link is not valid. Ask for a new one.',
      };
    }

    if (!params.access_token) return { ok: false, none: true };

    sb.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
      expires_in: params.expires_in,
      token_type: params.token_type,
    });
    scrub();
    return { ok: true, recovery: params.type === 'recovery', type: params.type || '' };
  }

  /* ---------- change a known password ----------------------------------- */

  // Proves the current password by signing in with it on the side. The token
  // that comes back is revoked immediately and never stored, so the session
  // the reader is using is untouched either way.
  //
  // Identical in effect to what Settings does today with verifyPassword(), and
  // the reason secure_password_change is off in supabase/config.toml: the
  // alternative is a code emailed mid-form.
  function verifyCurrentPassword(password) {
    if (!enabled()) return Promise.resolve(off());
    var user = sb.user();
    var email = (user && user.email) || '';
    if (!email) return Promise.resolve({ ok: false, error: 'Your session has expired. Sign in again.' });
    if (!password) return Promise.resolve({ ok: false, error: 'Enter your current password.' });

    return sb.request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email: email, password: String(password) },
    }).then(function (res) {
      if (res.error) {
        return { ok: false, error: say(res.error, 'Current password is incorrect.') };
      }
      var token = res.data && res.data.access_token;
      if (!token) return { ok: false, error: 'Current password is incorrect.' };

      // Best effort: a session left open is one more token to expire on its
      // own, not a hole, so a failed revoke does not fail the check.
      return sb.request('/auth/v1/logout?scope=local', {
        method: 'POST', body: {}, token: token,
      }).then(function () { return { ok: true }; },
              function () { return { ok: true }; });
    });
  }

  function updatePassword(newPassword, currentPassword) {
    if (!enabled()) return Promise.resolve(off());

    var problem = rules(newPassword, 'New password');
    if (problem) return Promise.resolve({ ok: false, error: problem });
    if (String(newPassword).length > LIMITS.password) {
      return Promise.resolve({ ok: false, error: 'Keep the new password under ' + LIMITS.password + ' characters.' });
    }

    // `currentPassword` is omitted by the reset flow, where the recovery link
    // is the proof and there is no old password to give.
    var proof = currentPassword === undefined || currentPassword === null
      ? Promise.resolve({ ok: true })
      : verifyCurrentPassword(currentPassword);

    return proof.then(function (check) {
      if (!check.ok) return check;
      return sb.authed('/auth/v1/user', {
        method: 'PUT',
        body: { password: String(newPassword) },
      }).then(function (res) {
        if (res.error) return { ok: false, error: say(res.error, 'Could not change the password.') };
        return { ok: true, message: 'Password updated.' };
      });
    });
  }

  /* ---------- profile --------------------------------------------------- */

  function profile() {
    if (!enabled()) return Promise.resolve(off());
    return sb.select('profiles', { select: 'id,email,name,created_at', limit: 1 })
      .then(function (res) {
        if (res.error) return { ok: false, error: say(res.error, 'Could not load your profile.') };
        var row = Array.isArray(res.data) ? res.data[0] : null;
        return { ok: true, profile: row || null };
      });
  }

  // A name change is immediate. An email change is not: the server emails
  // both the old and the new address, and the account keeps its old email
  // until the link is followed — so this reports back which happened rather
  // than letting Settings claim "Saved." for something still pending.
  function updateProfile(details) {
    if (!enabled()) return Promise.resolve(off());

    var name = String((details && details.name) || '').trim();
    var email = details && details.email !== undefined ? clean(details.email) : null;
    var current = sb.user() || {};

    if (!name) return Promise.resolve({ ok: false, error: 'Enter a display name.' });
    if (name.length > LIMITS.name) {
      return Promise.resolve({ ok: false, error: 'Keep your name under ' + LIMITS.name + ' characters.' });
    }
    if (email !== null && (!emailOk(email) || email.length > LIMITS.email)) {
      return Promise.resolve({ ok: false, error: 'Enter a valid email address.' });
    }

    var body = { data: { name: name } };
    var emailChanging = email !== null && email !== clean(current.email);
    if (emailChanging) body.email = email;

    return sb.authed('/auth/v1/user' + (emailChanging ? redirectParam() : ''), { method: 'PUT', body: body })
      .then(function (res) {
        if (res.error) return { ok: false, error: say(res.error, 'Could not save your profile.') };

        // profiles.name is the copy the app reads; auth's user_metadata is the
        // copy the trigger seeded it from. Only the email side has a trigger
        // keeping it in step, so the name is written here as well.
        return sb.authed('/rest/v1/profiles?id=eq.' + encodeURIComponent(current.id || ''), {
          method: 'PATCH',
          body: { name: name },
          headers: { Prefer: 'return=minimal' },
        }).then(function () {
          var user = (res.data && res.data.id) ? res.data : current;
          // The marker keeps the old email until a pending change confirms,
          // because that is still the address this account signs in with.
          writeAppSession({
            email: emailChanging ? current.email : (user.email || current.email),
            user_metadata: { name: name },
          });
          return {
            ok: true,
            emailPending: emailChanging,
            message: emailChanging
              ? 'Name saved. Check both inboxes to confirm the new email address.'
              : 'Saved.',
          };
        });
      });
  }

  /* ---------- the danger zone ------------------------------------------- */

  function deleteAccount() {
    if (!enabled()) return Promise.resolve(off());
    return sb.rpc('delete_my_account').then(function (res) {
      if (res.error) return { ok: false, error: say(res.error, 'Could not delete the account.') };
      clearAppSession();
      sb.clearSession();
      return { ok: true };
    });
  }

  function exportData() {
    if (!enabled()) return Promise.resolve(off());
    return sb.rpc('export_my_data').then(function (res) {
      if (res.error) return { ok: false, error: say(res.error, 'Could not build the export.') };
      return { ok: true, data: res.data };
    });
  }

  /* ---------- keeping the app's marker honest ---------------------------- */

  // A session can end without anyone calling signOut(): a refresh token that
  // has been revoked, rotated past, or belonged to an account that no longer
  // exists. The client clears the tokens when that happens, and the app's own
  // 'folio_session' marker has to go with them — every page gates on that
  // key, and one left behind means a page that believes it is signed in and
  // then fails on every request.
  if (sb) {
    sb.onChange(function (event, session) {
      if (event === 'signed-out') clearAppSession();
      else if (session && session.user) writeAppSession(session.user);
    });
  }

  /* ---------- what the pages see ---------------------------------------- */

  window.notivloAuth = {
    enabled: enabled,
    isSignedIn: function () { return !!(sb && sb.isSignedIn()); },
    user: function () { return sb ? sb.user() : null; },
    displayName: displayName,

    signUp: signUp,
    signIn: signIn,
    signOut: signOut,

    sendPasswordReset: sendPasswordReset,
    consumeRecoveryLink: consumeRecoveryLink,
    verifyCurrentPassword: verifyCurrentPassword,
    updatePassword: updatePassword,

    profile: profile,
    updateProfile: updateProfile,

    deleteAccount: deleteAccount,
    exportData: exportData,

    // So a page can react to a sign-out that happened in another tab.
    onChange: function (fn) { return sb ? sb.onChange(fn) : function () {}; },
  };
})();
