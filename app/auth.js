/* Shared account helpers for SignIn, SignUp and Settings.
 *
 * These were copied into all three pages, with comments in each reminding the
 * next person to keep them in step. Adding the password-reset flow would have
 * made a fourth copy, so they live here instead — the rules and the hashing
 * are now defined once, and a change to either can't apply to some pages and
 * not others.
 *
 * Loaded from each page's <head>, not its <helmet>. The runtime can insert
 * helmet scripts more than once, and a second run of this file throws on its
 * top-level consts ("Identifier 'PW_MIN' has already been declared"). From
 * <head> it runs exactly once, and everything below is a global before the
 * page's own DC script runs.
 */

/* ---------- Password rules -------------------------------------------- */

const PW_MIN = 8;

function passwordChecks(pw) {
  return {
    length: pw.length >= PW_MIN,
    upper: /[A-Z]/.test(pw),
    // Anything that isn't a letter or a digit, so whatever punctuation the
    // user reaches for counts without enumerating an allowed set.
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

// One message at a time, in the order the on-screen checklist lists them, so
// the fix is unambiguous rather than a pile of everything wrong at once.
// `subject` lets Settings and the reset flow say "New password" instead.
function passwordProblem(pw, subject) {
  const who = subject || 'Password';
  const c = passwordChecks(pw);
  if (!c.length) return who + ' must be at least ' + PW_MIN + ' characters.';
  if (!c.upper) return who + ' needs at least one uppercase letter.';
  if (!c.symbol) return who + ' needs at least one symbol, like ! ? @ or #.';
  return '';
}

// The renderVals half of the live checklist, so the three pages that show it
// don't each re-derive the marks and colours.
function passwordRuleRows(pw) {
  const c = passwordChecks(pw);
  const mark = (ok) => (ok ? '✓' : '○');
  const color = (ok) => (ok ? 'var(--color-accent-800)' : 'var(--color-neutral-500)');
  return {
    pwLenMark: mark(c.length), pwLenColor: color(c.length),
    pwUpperMark: mark(c.upper), pwUpperColor: color(c.upper),
    pwSymbolMark: mark(c.symbol), pwSymbolColor: color(c.symbol),
  };
}

/* ---------- Field limits ---------------------------------------------- */

// What the account forms will accept. Not cosmetic: without a ceiling a
// pasted megabyte would be run through the key derivation below and written
// to storage as-is. The inputs carry matching maxlength attributes; these are
// the checks that still hold if something bypasses the form.
const FIELD_LIMITS = { name: 80, email: 254, password: 128 };

/* ---------- Credential storage ---------------------------------------- */

// PBKDF2-HMAC-SHA256 at 600,000 iterations — OWASP's current recommendation
// for this algorithm. Deliberately slow: it makes every guess against a copied
// credential record cost real CPU time, which a single SHA-256 did not.
const PBKDF2_ITERATIONS = 600000;
const CREDENTIAL_ALGO = 'pbkdf2-sha256';

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

async function derivePbkdf2(password, saltHex, iterations) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations },
    material, 256);
  return bytesToHex(bits);
}

// A new stored credential for a password: fresh salt, full iteration count.
async function createCredential(password) {
  const salt = randomSalt();
  const hash = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return { algo: CREDENTIAL_ALGO, iter: PBKDF2_ITERATIONS, salt, hash };
}

// The scheme every account created before the PBKDF2 upgrade was stored with:
// one salted SHA-256. Kept solely so those accounts can still sign in — and
// verifyPassword re-stores them under PBKDF2 the moment they do.
async function legacySha256(password, salt) {
  const digest = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(salt + ':' + password));
  return bytesToHex(digest);
}

// Walks every character whatever the position of the first mismatch, so the
// time taken doesn't hint at how much of a guess was right.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Checks a password against a stored user record. `upgrade` is a replacement
// credential when the record is on the old scheme or a lower iteration count;
// the caller writes it back, so accounts move to the current scheme on their
// next successful sign-in with no reset and nothing for the user to do.
async function verifyPassword(user, password) {
  const fail = { ok: false, upgrade: null };
  if (!user || typeof user.salt !== 'string' || typeof user.hash !== 'string') return fail;

  if (user.algo === CREDENTIAL_ALGO) {
    // Bounded, so a corrupted record can't stall the page on a vast count.
    const iter = Math.min(Math.max(Number(user.iter) || PBKDF2_ITERATIONS, 1), 10000000);
    const hash = await derivePbkdf2(password, user.salt, iter);
    if (!timingSafeEqual(hash, user.hash)) return fail;
    return { ok: true, upgrade: iter < PBKDF2_ITERATIONS ? await createCredential(password) : null };
  }

  const legacy = await legacySha256(password, user.salt);
  if (!timingSafeEqual(legacy, user.hash)) return fail;
  return { ok: true, upgrade: await createCredential(password) };
}

/* ---------- Sign-in throttling ---------------------------------------- */

// Five free attempts per email, then a lockout that doubles with each further
// miss: 30 s, 1 min, 2 min… capped at 15 min.
//
// Honest limits: it lives in localStorage beside everything else, so anyone
// able to clear site data resets it, and the reset-password flow doesn't need
// the old password at all. What it protects is narrower — the password itself,
// which people reuse on other sites, from being found by trial in the UI.
const LOGIN_THROTTLE_KEY = 'folio_login_throttle';
const LOGIN_FREE_ATTEMPTS = 5;
const LOGIN_BASE_LOCK_MS = 30 * 1000;
const LOGIN_MAX_LOCK_MS = 15 * 60 * 1000;

function readLoginThrottle() {
  try {
    const t = JSON.parse(localStorage.getItem(LOGIN_THROTTLE_KEY));
    return t && typeof t === 'object' && !Array.isArray(t) ? t : {};
  } catch (e) { return {}; }
}

function writeLoginThrottle(t) {
  try { localStorage.setItem(LOGIN_THROTTLE_KEY, JSON.stringify(t)); } catch (e) {}
}

function loginLockRemainingMs(email) {
  const rec = readLoginThrottle()[email];
  return rec && Number(rec.until) ? Math.max(0, Number(rec.until) - Date.now()) : 0;
}

// Records a failed attempt; returns the lockout it triggered, in ms (0 if none).
function recordLoginFailure(email) {
  const t = readLoginThrottle();
  const rec = t[email] && typeof t[email] === 'object' ? t[email] : { fails: 0, until: 0 };
  rec.fails = (Number(rec.fails) || 0) + 1;
  if (rec.fails >= LOGIN_FREE_ATTEMPTS) {
    const step = rec.fails - LOGIN_FREE_ATTEMPTS;
    rec.until = Date.now() + Math.min(LOGIN_MAX_LOCK_MS, LOGIN_BASE_LOCK_MS * Math.pow(2, step));
  }
  t[email] = rec;
  writeLoginThrottle(t);
  return Math.max(0, (Number(rec.until) || 0) - Date.now());
}

function clearLoginFailures(email) {
  const t = readLoginThrottle();
  if (t[email]) { delete t[email]; writeLoginThrottle(t); }
}

function formatLockWait(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return s + (s === 1 ? ' second' : ' seconds');
  const m = Math.ceil(s / 60);
  return m + (m === 1 ? ' minute' : ' minutes');
}
