// One device, several accounts: keeping each account's work to itself.
//
// Everything the app saves lives in this browser's localStorage under fixed
// keys (folio_notebooks_v1, folio_agenda_v2, folio_nb_state:<slug>, …), and
// signing out leaves it there on purpose. Without this file, the next person
// to sign up or sign in on the same browser opened onto the last person's
// notebooks — and the setup guide, which only offers itself on an empty
// shelf, never appeared for them.
//
// So the stores have an owner (OWNER_KEY). When someone else becomes the
// account on this device, the owner's keys are moved aside — renamed, never
// deleted — under STASH_PREFIX, and the arriving account gets back whatever
// was moved aside for it last time. Moving rather than clearing matters: in
// local mode this browser is the only copy, and on the server-backed build a
// previous account can still have work it never sent.
//
// The stash deliberately does NOT start with 'folio_': Settings' export,
// "Reset data" and storage figures all work on folio_* keys and are about the
// signed-in account, so another account's stash must not be downloaded,
// erased or counted by them.
//
// Must be loaded straight after demo.js (which may swap localStorage for the
// landing page's demo) and before anything reads the stores: it runs once on
// load and settles whose stores these are before the page looks at them.
(function (root) {
  'use strict';

  var OWNER_KEY = 'folio_owner';
  var SESSION_KEY = 'folio_session';
  var META_KEY = 'folio_sync_meta';
  var SETUP_KEY = 'folio_setup_v1';
  var STASH_PREFIX = 'notivlo_stash:';
  // An owner nobody can be told apart from: data written before stores had
  // owners, found on a device when a brand new account is made there.
  var UNCLAIMED = '?';

  // Keys that belong to the device, not to whoever is signed in: the session
  // itself, the local account list, theme and text size, the guide's switch,
  // the sign-in throttle, a timer length. Everything else under folio_ is an
  // account's.
  var DEVICE_KEYS = {
    folio_session: 1,
    folio_supabase_session: 1,
    folio_users: 1,
    folio_prefs: 1,
    folio_setup_flag: 1,
    folio_login_throttle: 1,
    folio_blurt_len: 1,
    folio_owner: 1,
  };

  var injected = null;
  function ls() {
    if (injected) return injected;
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }

  function norm(email) { return String(email || '').trim().toLowerCase(); }

  function readJson(key) {
    try {
      var raw = ls().getItem(key);
      return raw == null ? null : JSON.parse(raw);
    } catch (e) { return null; }
  }

  function allKeys() {
    var s = ls(), out = [];
    if (!s) return out;
    // A fake storage in the test exposes its map; the real one has key(i).
    if (s._map) return Object.keys(s._map);
    try { for (var i = 0; i < s.length; i++) { var k = s.key(i); if (k != null) out.push(k); } } catch (e) {}
    return out;
  }

  // The keys that make up the current account's stores.
  function accountKeys() {
    return allKeys().filter(function (k) {
      return k.indexOf('folio_') === 0 && !DEVICE_KEYS[k];
    });
  }

  function stashPrefix(owner) { return STASH_PREFIX + encodeURIComponent(owner) + '|'; }

  // Whose the stores are. The mark this file writes, else the last account
  // that synced them, else the account the setup guide's record was written
  // for — the last two cover stores written before this file existed.
  function owner() {
    var s = ls();
    var mark = s ? norm(s.getItem(OWNER_KEY)) : '';
    if (mark) return mark;
    var meta = readJson(META_KEY);
    if (meta && meta.email) return norm(meta.email);
    var setup = readJson(SETUP_KEY);
    if (setup && typeof setup.account === 'string' && setup.account) return norm(setup.account);
    return '';
  }

  function setOwner(email) {
    try { ls().setItem(OWNER_KEY, norm(email)); } catch (e) {}
  }

  // Key by key, so the device never has to hold two copies of everything at
  // once: localStorage is a few megabytes in all, and a notebook's writing can
  // be a good part of that. A key whose copy cannot be written stays where it
  // is — on screen for the wrong account, which is bad, rather than gone.
  function moveKeys(keys, from, to) {
    var s = ls(), moved = 0, failed = 0;
    // `keys` are full names that start with `from`; each is renamed to the
    // same name with `to` in place of that start.
    keys.forEach(function (src) {
      var raw = s.getItem(src);
      if (raw == null) return;
      var dest = to + src.slice(from.length);
      try {
        s.setItem(dest, raw);
        s.removeItem(src);
        moved++;
      } catch (e) { failed++; }
    });
    return { moved: moved, failed: failed };
  }

  // Moves the current stores aside for `who`. A second stash for the same
  // owner merges into the first; for the unclaimed owner each one gets its
  // own name, so two lots of unowned data never overwrite each other.
  function stash(who) {
    var keys = accountKeys();
    if (!keys.length) return { moved: 0, failed: 0 };
    var name = who || UNCLAIMED;
    if (name === UNCLAIMED) name = UNCLAIMED + Date.now().toString(36);
    return moveKeys(keys, '', stashPrefix(name));
  }

  // Puts back what was moved aside for `who`, if anything.
  function restore(who) {
    var prefix = stashPrefix(norm(who));
    var keys = allKeys().filter(function (k) { return k.indexOf(prefix) === 0; });
    if (!keys.length) return { moved: 0, failed: 0 };
    return moveKeys(keys, prefix, '');
  }

  function stashedFor(who) {
    var prefix = stashPrefix(norm(who));
    return allKeys().some(function (k) { return k.indexOf(prefix) === 0; });
  }

  // `email` is now the account on this device. Called on every page load
  // with the signed-in account, and by Sign in before its first sync.
  //   - Already theirs: nothing to do.
  //   - Nobody's: theirs now. This is someone who used notivlo before stores
  //     had owners, and those are their notebooks.
  //   - Someone else's: moved aside for that someone, and this account's own,
  //     if it left any here, come back.
  function becomeAccount(email) {
    var me = norm(email);
    if (!me || !ls()) return 'none';
    var current = owner();
    if (current === me) { setOwner(me); return 'same'; }
    if (!current) {
      // A stash of their own waiting, and nothing here: put it back.
      if (!accountKeys().length) restore(me);
      setOwner(me);
      return 'claimed';
    }
    var out = stash(current);
    if (out.failed) return 'stuck';
    restore(me);
    setOwner(me);
    return 'switched';
  }

  // A brand new account was just made here. Whatever is on the device is not
  // its own, whoever it belongs to — including stores nobody can name, which
  // becomeAccount() would otherwise hand over to it.
  function startNewAccount(email) {
    var me = norm(email);
    if (!me || !ls()) return 'none';
    var current = owner();
    var out = stash(current && current !== me ? current : UNCLAIMED);
    if (out.failed) return 'stuck';
    setOwner(me);
    return out.moved ? 'moved' : 'empty';
  }

  function sessionEmail() {
    var s = readJson(SESSION_KEY);
    return s && typeof s === 'object' ? norm(s.email) : '';
  }

  var api = {
    owner: owner,
    accountKeys: accountKeys,
    becomeAccount: becomeAccount,
    startNewAccount: startNewAccount,
    stashedFor: stashedFor,
    OWNER_KEY: OWNER_KEY,
    STASH_PREFIX: STASH_PREFIX,
    _useStorage: function (s) { injected = s; },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  root.notivloAccounts = api;

  // Once per page, before the page reads anything. Never in the landing
  // page's demo, whose stores are a stage set rather than anyone's.
  try {
    if (!root.notivloDemo) {
      var who = sessionEmail();
      if (who) becomeAccount(who);
    }
  } catch (e) {}
}(typeof window !== 'undefined' ? window : this));
