/* Sessions — a study block you can run, not just read.
 *
 * The agenda says "Study block — elasticity notes, 7:00–8:00 PM". Until now
 * that was a rectangle on a grid: nothing started it, nothing timed it, and
 * nothing remembered how it went. This is the missing half.
 *
 *   Start     One button, bottom left, on every page. When a study block is
 *             on now or coming up today it offers that block by name; say
 *             what you are doing, pick the notebook and a length, and go.
 *   Run       A countdown that follows you from page to page, with a line
 *             across the top of the window filling as the time goes.
 *   Wrap up   When the time is up (or you end it), one question: where did
 *             you stop? The answer is the first thing shown the next time
 *             you start a session on that notebook.
 *
 * Plain DOM outside the DC tree, like quick.js, and for the same reason: the
 * pages re-render their own roots. It reads the notebooks and the agenda and
 * writes to neither. Its own two keys start with 'folio_' so that signing out
 * clears them with everything else (see wipeLocal in supabase-sync.js). They
 * are not synced: a session log lives on the device it was kept on.
 *
 * It does not add to 'folio_study_minutes'. The notebook page already counts
 * the minutes spent in it, and counting a session as well would count the
 * same minutes twice.
 *
 * Like Jump, it stays out of the way of a dialog. A paper being sat is a
 * dialog: the dock hides, and a timer that runs out mid-paper waits until
 * the paper is closed before it asks anything.
 */
(function () {
  'use strict';
  if (window.notivloSession) return;

  var NOW_KEY = 'folio_focus_now';
  var LOG_KEY = 'folio_focus_log_v1';
  var NOTEBOOKS_KEY = 'folio_notebooks_v1';
  var AGENDA_KEY = 'folio_agenda_v2';
  var LOG_MAX = 200;
  var LENGTHS = [25, 45, 60, 90];
  var SOON_MIN = 180;        // a block this close is offered by name
  var MIN_KEEP_MS = 60000;   // anything shorter is a false start, not a session

  /* ---------- storage ---------------------------------------------------- */

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function write(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) { return false; }
  }

  function current() {
    var s = read(NOW_KEY);
    if (!s || typeof s !== 'object' || !s.id || !s.startedAt) return null;
    if (s.pausedLeft == null && typeof s.endsAt !== 'number') return null;
    return s;
  }
  function log() {
    var l = read(LOG_KEY);
    return Array.isArray(l) ? l.filter(function (e) { return e && typeof e === 'object'; }) : [];
  }

  /* ---------- time ------------------------------------------------------- */

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function isoDay(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function clock(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60);
  }
  function span(min) {
    min = Math.round(min);
    if (min < 60) return min + ' min';
    return Math.floor(min / 60) + 'h' + (min % 60 ? ' ' + min % 60 + 'm' : '');
  }
  function leftMs(s) {
    return s.pausedLeft != null ? s.pausedLeft : s.endsAt - Date.now();
  }
  // Time actually spent: the planned length less what is still on the clock.
  function spentMs(s) {
    return Math.max(0, s.plannedMin * 60000 - Math.max(0, leftMs(s)));
  }

  // '7:00–8:00 PM' -> { start, end } in minutes from midnight. The agenda's
  // own parser when the page has it, so the two can never disagree; a small
  // one of our own on the pages that do not load the grid.
  function range(text) {
    var tg = window.notivloTimeGrid;
    if (tg && tg.parseTimeRange) return tg.parseTimeRange(text);
    var m = /(\d{1,2})(?::(\d{2}))?\s*([ap]m)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)?/i.exec(String(text || ''));
    if (!m) return null;
    var mins = function (h, mm, mer) {
      h = Number(h) % 12;
      return (/p/i.test(mer || '') ? h + 12 : h) * 60 + Number(mm || 0);
    };
    var end = mins(m[4], m[5], m[6]);
    var start = mins(m[1], m[2], m[3] || m[6]);
    if (start >= end && !m[3]) start = mins(m[1], m[2], /p/i.test(m[6] || '') ? 'am' : 'pm');
    return end > start ? { start: start, end: end } : null;
  }
  function hourLabel(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return ((h + 11) % 12 + 1) + (m ? ':' + pad(m) : '') + (h < 12 ? ' am' : ' pm');
  }

  /* ---------- what there is to work on ----------------------------------- */

  function notebooks() {
    var list = read(NOTEBOOKS_KEY);
    if (!Array.isArray(list)) return [];
    return list.filter(function (nb) { return nb && nb.slug && nb.title; })
      .sort(function (a, b) { return (a.minutesAgo || 0) - (b.minutesAgo || 0); });
  }
  function notebookHref(nb) {
    return 'Notebook.dc.html?nb=' + nb.slug
      + (nb.userCreated ? '&title=' + encodeURIComponent(nb.title) : '');
  }
  function hereSlug() {
    if (!/notebook\.dc\.html$/i.test(location.pathname)) return null;
    try { return new URLSearchParams(location.search).get('nb'); } catch (e) { return null; }
  }

  // A block rarely says which notebook it belongs to, but its title usually
  // does: "elasticity notes" names nothing, "9709 Paper 1" names the syllabus
  // code the Mathematics notebook carries, "Chemistry revision" names itself.
  function guessNotebook(block, list) {
    var i, title = (block.title || '').toLowerCase();
    if (block.notebookSlug) {
      for (i = 0; i < list.length; i++) if (list[i].slug === block.notebookSlug) return list[i].slug;
    }
    for (i = 0; i < list.length; i++) {
      if (title.indexOf(list[i].title.toLowerCase()) > -1) return list[i].slug;
    }
    for (i = 0; i < list.length; i++) {
      var code = /\d{4}/.exec(list[i].subject || '');
      if (code && title.indexOf(code[0]) > -1) return list[i].slug;
    }
    return null;
  }

  function tidyTitle(title) {
    var t = String(title || '').replace(/^study block\s*[—–:-]\s*/i, '').trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }

  // Today's study blocks that have not been run yet, the one that is on now
  // first, then the next to start.
  function blocksToday() {
    var agenda = read(AGENDA_KEY);
    if (!Array.isArray(agenda)) return [];
    var today = isoDay();
    var ran = {};
    log().forEach(function (e) { if (e.date === today && e.blockId) ran[e.blockId] = true; });
    var d = new Date(), now = d.getHours() * 60 + d.getMinutes();
    return agenda.filter(function (it) {
      return it && it.type === 'study' && it.date === today && it.title && !ran[it.id];
    }).map(function (it) {
      var r = range(it.time);
      if (!r || r.end == null || r.end <= now) return null;
      return {
        id: it.id, title: it.title, notebookSlug: it.notebookSlug || null,
        start: r.start, end: r.end, on: r.start <= now,
        startsIn: r.start - now,
        // On now: what is left of it. Not yet: the whole of it.
        minutes: Math.max(10, Math.round((r.end - Math.max(r.start, now)) / 5) * 5),
      };
    }).filter(Boolean).sort(function (a, b) { return a.start - b.start; });
  }
  function offered() {
    var b = blocksToday()[0];
    return b && (b.on || b.startsIn <= SOON_MIN) ? b : null;
  }
  function whenLabel(b) {
    if (b.on) return 'on now, until ' + hourLabel(b.end);
    if (b.startsIn < 60) return 'in ' + b.startsIn + ' min';
    return 'at ' + hourLabel(b.start);
  }

  function lastFor(slug) {
    var l = log();
    for (var i = l.length - 1; i >= 0; i--) {
      if ((l[i].slug || null) === (slug || null) && l[i].note) return l[i];
    }
    return null;
  }
  function todayTotals() {
    var today = isoDay(), n = 0, min = 0;
    log().forEach(function (e) { if (e.date === today) { n++; min += e.minutes || 0; } });
    return { count: n, minutes: min };
  }

  /* ---------- the session itself ----------------------------------------- */

  function start(opts) {
    var min = Math.min(Math.max(Math.round(opts.minutes) || 25, 1), 480);
    var now = Date.now();
    write(NOW_KEY, {
      id: now.toString(36) + Math.random().toString(36).slice(2, 6),
      intent: String(opts.intent || '').trim().slice(0, 120),
      slug: opts.slug || null,
      nbTitle: opts.nbTitle || '',
      blockId: opts.blockId || null,
      plannedMin: min,
      startedAt: now,
      endsAt: now + min * 60000,
      pausedLeft: null,
    });
    rang = false;
    paint();
  }
  function togglePause() {
    var s = current();
    if (!s) return;
    if (s.pausedLeft != null) { s.endsAt = Date.now() + s.pausedLeft; s.pausedLeft = null; }
    else { s.pausedLeft = Math.max(0, s.endsAt - Date.now()); }
    write(NOW_KEY, s);
    paint();
  }
  function extend(min) {
    var s = current();
    if (!s) return;
    s.plannedMin += min;
    s.endsAt = Date.now() + Math.max(0, leftMs(s)) + min * 60000;
    s.pausedLeft = null;
    write(NOW_KEY, s);
    rang = false;
    paint();
  }
  function finish(note) {
    var s = current();
    if (!s) return;
    var minutes = Math.max(1, Math.round(spentMs(s) / 60000));
    var l = log();
    l.push({
      id: s.id, date: isoDay(), endedAt: Date.now(), minutes: minutes, plannedMin: s.plannedMin,
      intent: s.intent, slug: s.slug, nbTitle: s.nbTitle, blockId: s.blockId,
      note: String(note || '').trim().slice(0, 200),
    });
    write(LOG_KEY, l.slice(-LOG_MAX));
    write(NOW_KEY, null);
    flash = { text: span(minutes) + ' logged', until: Date.now() + 6000 };
    paint();
  }
  function discard() { write(NOW_KEY, null); paint(); }

  /* ---------- styles ----------------------------------------------------- */

  var INK = 'var(--cs-ink,#14161b)', RAISED = 'var(--cs-surface-raised,#f6f4ef)', RULE = 'var(--cs-rule,#14161b)';
  var SIGNAL = 'var(--cs-signal,#ff5a1f)', ONSIG = 'var(--cs-on-signal,#14161b)';
  var MONO = 'var(--cs-mono,ui-monospace,Menlo,monospace)', SANS = 'var(--cs-sans,system-ui,sans-serif)';
  var FAINT = 'var(--cs-rule-faint,rgb(20 22 27 / .22))';

  var css = [
    '.ns-dock{position:fixed;left:16px;bottom:16px;z-index:45;display:flex;align-items:stretch;height:34px;max-width:calc(100vw - 150px);',
    'background:' + RAISED + ';color:' + INK + ';border:2px solid ' + RULE + ';font:700 12px/1 ' + MONO + '}',
    'body:has([role="dialog"]) .ns-dock,body:has([role="dialog"]) .ns-line{display:none}',
    '.ns-dock button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;padding:0 12px;cursor:pointer;white-space:nowrap;min-width:0}',
    '.ns-dock button:focus-visible{outline:2px solid ' + SIGNAL + ';outline-offset:2px}',
    '.ns-dock button:hover,.ns-dock .ns-go:hover,.ns-dock .ns-time:hover{background:' + INK + ';color:var(--cs-surface,#e6e3dc)}',
    '.ns-dock button + button,.ns-dock .ns-what + button{border-left:2px solid ' + RULE + '}',
    '.ns-dock .ns-go{background:' + SIGNAL + ';color:' + ONSIG + '}',
    '.ns-go i{font-style:normal;font-weight:400;overflow:hidden;text-overflow:ellipsis}',
    '.ns-dock .ns-time{font-size:15px;font-variant-numeric:tabular-nums;letter-spacing:.02em;min-width:64px;justify-content:center;background:' + SIGNAL + ';color:' + ONSIG + '}',
    '.ns-dock.ns-paused .ns-time{background:transparent;color:inherit}',
    '.ns-what{display:flex;align-items:center;padding:0 12px;min-width:0;font:600 13px/1 ' + SANS + '}',
    '.ns-what span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ns-what em{font:400 11px/1 ' + MONO + ';font-style:normal;opacity:.7;margin-left:8px;flex:none}',
    'a.ns-what{color:inherit;text-decoration:none}a.ns-what:hover span{text-decoration:underline}',
    '.ns-flash{display:flex;align-items:center;padding:0 12px;border-left:2px solid ' + RULE + ';font-weight:400}',
    '.ns-line{position:fixed;left:0;top:0;height:3px;z-index:46;background:' + SIGNAL + ';pointer-events:none;transition:width 1s linear}',
    '.ns-scrim{position:fixed;inset:0;z-index:5000;background:rgb(20 22 27 / .55);display:flex;justify-content:center;align-items:flex-start;padding:10vh 16px 16px;overflow-y:auto}',
    ':root[data-theme="dark"] .ns-scrim{background:rgb(0 0 0 / .62)}',
    '.ns-box{width:min(560px,100%);box-sizing:border-box;background:' + RAISED + ';color:' + INK + ';border:2px solid ' + RULE + ';padding:22px 22px 18px;font:14px/1.45 ' + SANS + '}',
    '.ns-box h2{margin:0 0 4px;font:700 24px/1.15 ' + SANS + ';letter-spacing:-.01em}',
    '.ns-sub{margin:0 0 18px;opacity:.8}',
    '.ns-label{display:block;margin:16px 0 7px;font:11px/1 ' + MONO + ';text-transform:uppercase;letter-spacing:.08em;opacity:.75}',
    '.ns-in{width:100%;box-sizing:border-box;height:44px;padding:0 12px;border:2px solid ' + RULE + ';background:transparent;color:inherit;font:16px/1 ' + SANS + ';border-radius:0}',
    '.ns-in:focus{outline:2px solid ' + SIGNAL + ';outline-offset:1px}',
    '.ns-in::placeholder{color:inherit;opacity:.5}',
    '.ns-chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.ns-chip{all:unset;box-sizing:border-box;cursor:pointer;padding:7px 11px;border:2px solid ' + FAINT + ';font:600 13px/1.1 ' + SANS + '}',
    '.ns-chip:hover{border-color:' + RULE + '}',
    '.ns-chip:focus-visible{outline:2px solid ' + SIGNAL + ';outline-offset:1px}',
    '.ns-chip[aria-pressed="true"]{background:' + INK + ';color:var(--cs-surface,#e6e3dc);border-color:' + INK + '}',
    '.ns-chip small{font:400 11px/1 ' + MONO + ';opacity:.75;margin-left:6px}',
    '.ns-last{margin:14px 0 0;padding:10px 12px;border-left:4px solid ' + SIGNAL + ';background:rgb(255 90 31 / .09)}',
    '.ns-last b{display:block;font:11px/1 ' + MONO + ';text-transform:uppercase;letter-spacing:.08em;opacity:.75;margin-bottom:5px;font-weight:400}',
    '.ns-foot{display:flex;align-items:center;gap:10px;margin-top:22px;flex-wrap:wrap}',
    '.ns-foot .ns-note{flex:1;min-width:120px;font:11px/1.4 ' + MONO + ';opacity:.7}',
    '.ns-btn{all:unset;box-sizing:border-box;cursor:pointer;height:40px;padding:0 16px;display:inline-flex;align-items:center;border:2px solid ' + RULE + ';font:700 13px/1 ' + MONO + '}',
    '.ns-btn:hover{background:' + INK + ';color:var(--cs-surface,#e6e3dc)}',
    '.ns-btn:focus-visible{outline:2px solid ' + SIGNAL + ';outline-offset:2px}',
    '.ns-btn.ns-primary{background:' + SIGNAL + ';color:' + ONSIG + ';border-color:' + SIGNAL + '}',
    '.ns-btn.ns-primary:hover{background:' + INK + ';color:var(--cs-surface,#e6e3dc);border-color:' + INK + '}',
    '.ns-big{font:700 44px/1 ' + MONO + ';letter-spacing:-.02em;margin:2px 0 10px;font-variant-numeric:tabular-nums}',
    '@media (max-width:760px){.ns-dock{left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:calc(100vw - 104px)}.ns-what em,.ns-go i{display:none}.ns-scrim{padding-top:5vh}.ns-box h2{font-size:21px}}',
    '@media print{.ns-dock,.ns-line,.ns-scrim{display:none !important}}',
    '@media (prefers-reduced-motion:reduce){.ns-line{transition:none}}',
  ].join('');

  /* ---------- small DOM helpers ------------------------------------------ */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(cls, text, onClick) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function dialogOpen() {
    var all = document.querySelectorAll('[role="dialog"]');
    for (var i = 0; i < all.length; i++) if (all[i] !== box) return true;
    return false;
  }

  /* ---------- the dock --------------------------------------------------- */

  var dock = null, line = null, timeEl = null, sig = '', flash = null, rang = false;
  var TITLE_RE = /^(?:(?:\d+:)?\d+:\d\d|Time) · /;

  // The dock is rebuilt only when what it shows changes shape; the clock
  // itself ticks by replacing one text node, so a button under the pointer
  // is never swapped out mid-click.
  function paint() {
    if (!dock) return;
    var s = current();
    if (flash && Date.now() > flash.until) flash = null;
    var offer = s ? null : offered();
    var next = s
      ? 'run|' + s.id + '|' + (s.pausedLeft != null) + '|' + s.plannedMin
      : 'idle|' + (offer ? offer.id + (offer.on ? 'on' : Math.ceil(offer.startsIn / 5)) : '') + '|' + (flash ? flash.text : '');

    if (next !== sig) {
      sig = next;
      dock.textContent = '';
      dock.classList.toggle('ns-paused', !!(s && s.pausedLeft != null));
      timeEl = null;
      if (s) {
        timeEl = btn('ns-time', '', function () { openWrap(false); });
        timeEl.title = 'End or wrap up this session';
        dock.appendChild(timeEl);
        var nb = null;
        notebooks().forEach(function (n) { if (n.slug === s.slug) nb = n; });
        var away = nb && hereSlug() !== nb.slug;
        var what = el(away ? 'a' : 'div', 'ns-what');
        if (away) { what.href = notebookHref(nb); what.title = 'Back to ' + nb.title; }
        what.appendChild(el('span', '', s.intent || s.nbTitle || 'Study session'));
        if (s.intent && s.nbTitle) what.appendChild(el('em', '', s.nbTitle));
        dock.appendChild(what);
        var paused = s.pausedLeft != null;
        dock.appendChild(btn('', paused ? 'Resume' : 'Pause', togglePause));
        dock.appendChild(btn('', 'End', function () { openWrap(false); }));
      } else {
        var go = btn('ns-go', '', function () { openStart(offer); });
        go.appendChild(document.createTextNode(offer ? '▶ Start' : '▶ Start a session'));
        if (offer) {
          go.appendChild(el('i', '', tidyTitle(offer.title) + ' · ' + whenLabel(offer)));
          go.title = offer.title;
        }
        dock.appendChild(go);
        if (flash) dock.appendChild(el('span', 'ns-flash', '✓ ' + flash.text));
      }
    }

    if (s) {
      var left = leftMs(s);
      var label = left <= 0 ? '0:00' : clock(left);
      if (timeEl && timeEl.textContent !== label) timeEl.textContent = label;
      var done = Math.min(1, spentMs(s) / (s.plannedMin * 60000));
      line.style.width = (done * 100).toFixed(2) + '%';
      line.style.display = '';
      // Re-derived from whatever the title is now, so a page that renames
      // itself (the notebook does, once it knows its title) is never undone.
      var t = (left <= 0 ? 'Time · ' : label + ' · ') + document.title.replace(TITLE_RE, '');
      if (document.title !== t) document.title = t;
      if (left <= 0 && s.pausedLeft == null && !box && !dialogOpen()) {
        if (!rang) { rang = true; chime(); }
        openWrap(true);
      }
    } else {
      line.style.display = 'none';
      if (TITLE_RE.test(document.title)) document.title = document.title.replace(TITLE_RE, '');
    }
  }

  // Two soft notes. Skipped without complaint where the browser will not
  // play sound unprompted; the title bar and the dialog say it as well.
  function chime() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      [[660, 0], [880, 0.22]].forEach(function (n) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, ctx.currentTime + n[1]);
        g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + n[1] + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n[1] + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + n[1]); o.stop(ctx.currentTime + n[1] + 0.55);
      });
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 1500);
    } catch (e) {}
  }

  /* ---------- dialogs ---------------------------------------------------- */

  var scrim = null, box = null, lastFocus = null;

  function openBox(label) {
    closeBox();
    lastFocus = document.activeElement;
    scrim = el('div', 'ns-scrim');
    box = el('div', 'ns-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', label);
    scrim.appendChild(box);
    scrim.addEventListener('mousedown', function (e) { if (e.target === scrim && scrim.dataset.sticky !== '1') closeBox(); });
    // Tab stays inside the box; Escape closes it unless it has to be answered.
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (scrim.dataset.sticky !== '1') closeBox();
        return;
      }
      if (e.key !== 'Tab') return;
      var f = box.querySelectorAll('button,input,a[href]');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.body.appendChild(scrim);
    return box;
  }
  function closeBox() {
    if (!scrim) return;
    scrim.remove();
    scrim = null; box = null;
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
    paint();
  }

  function chipRow(items, selected, onPick) {
    var row = el('div', 'ns-chips');
    var buttons = [];
    items.forEach(function (it) {
      var b = btn('ns-chip', it.label, function () {
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        onPick(it.value);
      });
      if (it.small) b.appendChild(el('small', '', it.small));
      b.setAttribute('aria-pressed', it.value === selected ? 'true' : 'false');
      buttons.push(b);
      row.appendChild(b);
    });
    return row;
  }

  function openStart(block) {
    if (current() || dialogOpen()) return;
    var list = notebooks();
    var blocks = blocksToday();
    if (block === undefined) block = offered();
    var here = hereSlug();

    var pick = {
      intent: block ? tidyTitle(block.title) : '',
      blockId: block ? block.id : null,
      slug: (block && guessNotebook(block, list)) || here || (list[0] && list[0].slug) || null,
      minutes: block ? block.minutes : 25,
    };

    var b = openBox('Start a session');
    b.appendChild(el('h2', '', 'Start a session'));
    b.appendChild(el('p', 'ns-sub', 'One thing, one notebook, a clock that follows you until it is done.'));

    var form = el('form');
    form.noValidate = true;
    b.appendChild(form);

    var lab = el('label', 'ns-label', 'What are you going to get done?');
    lab.htmlFor = 'ns-intent';
    form.appendChild(lab);
    var input = el('input', 'ns-in');
    input.id = 'ns-intent'; input.type = 'text'; input.maxLength = 120; input.autocomplete = 'off';
    input.placeholder = 'e.g. Finish the elasticity notes';
    input.value = pick.intent;
    input.addEventListener('input', function () { pick.intent = input.value; });
    form.appendChild(input);

    var lengthSlot = el('div'), lastSlot = el('div');

    function drawLength() {
      var opts = LENGTHS.map(function (m) { return { label: span(m), value: m }; });
      if (LENGTHS.indexOf(pick.minutes) === -1) {
        opts.unshift({ label: span(pick.minutes), value: pick.minutes, small: 'the block' });
      }
      lengthSlot.textContent = '';
      lengthSlot.appendChild(chipRow(opts, pick.minutes, function (v) { pick.minutes = v; }));
    }
    function drawLast() {
      lastSlot.textContent = '';
      var prev = lastFor(pick.slug);
      if (!prev) return;
      var box2 = el('div', 'ns-last');
      var when = prev.date === isoDay() ? 'earlier today'
        : new Date(prev.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      box2.appendChild(el('b', '', 'Where you stopped · ' + when + ' · ' + span(prev.minutes || 0)));
      box2.appendChild(document.createTextNode(prev.note));
      lastSlot.appendChild(box2);
    }

    if (blocks.length) {
      form.appendChild(el('span', 'ns-label', 'From today’s agenda'));
      form.appendChild(chipRow(blocks.map(function (bl) {
        return { label: tidyTitle(bl.title), value: bl.id, small: whenLabel(bl) };
      }), pick.blockId, function (id) {
        var bl = blocks.filter(function (x) { return x.id === id; })[0];
        pick.blockId = id; pick.intent = input.value = tidyTitle(bl.title); pick.minutes = bl.minutes;
        drawLength();
      }));
    }

    if (list.length) {
      form.appendChild(el('span', 'ns-label', 'Notebook'));
      form.appendChild(chipRow(list.map(function (nb) { return { label: nb.title, value: nb.slug }; })
        .concat([{ label: 'None', value: null }]), pick.slug, function (v) { pick.slug = v; drawLast(); }));
    }
    form.appendChild(lastSlot);

    form.appendChild(el('span', 'ns-label', 'For how long'));
    form.appendChild(lengthSlot);
    drawLength();
    drawLast();

    var foot = el('div', 'ns-foot');
    var tot = todayTotals();
    foot.appendChild(el('span', 'ns-note', tot.count
      ? 'Today: ' + tot.count + (tot.count === 1 ? ' session, ' : ' sessions, ') + span(tot.minutes)
      : 'Nothing run yet today.'));
    foot.appendChild(btn('ns-btn', 'Cancel', closeBox));
    var go = el('button', 'ns-btn ns-primary', 'Start ▶');
    go.type = 'submit';
    foot.appendChild(go);
    form.appendChild(foot);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nb = list.filter(function (n) { return n.slug === pick.slug; })[0] || null;
      start({
        intent: pick.intent, minutes: pick.minutes, blockId: pick.blockId,
        slug: nb ? nb.slug : null, nbTitle: nb ? nb.title : '',
      });
      lastFocus = null;
      closeBox();
      if (nb && hereSlug() !== nb.slug) window.location.href = notebookHref(nb);
    });

    input.focus();
    input.select();
  }

  // timeUp: the clock ran out, so this must be answered (more time, or done).
  // Otherwise the reader pressed End, and Escape means "I did not mean that".
  function openWrap(timeUp) {
    var s = current();
    if (!s || dialogOpen()) return;
    if (!timeUp && spentMs(s) < MIN_KEEP_MS) { discard(); return; }

    var b = openBox('Wrap up the session');
    if (timeUp) scrim.dataset.sticky = '1';
    var minutes = Math.max(1, Math.round(spentMs(s) / 60000));
    b.appendChild(el('span', 'ns-label', timeUp ? 'Time' : 'Ending early'));
    b.firstChild.style.marginTop = '0';
    b.appendChild(el('div', 'ns-big', span(minutes)));
    b.appendChild(el('p', 'ns-sub',
      (timeUp ? 'That is the session' : 'Of the ' + span(s.plannedMin) + ' you set')
      + (s.nbTitle ? ' on ' + s.nbTitle : '') + (s.intent ? ' — ' + s.intent + '.' : '.')));

    var form = el('form');
    form.noValidate = true;
    b.appendChild(form);
    var lab = el('label', 'ns-label', 'Where did you stop?');
    lab.htmlFor = 'ns-note';
    form.appendChild(lab);
    var input = el('input', 'ns-in');
    input.id = 'ns-note'; input.type = 'text'; input.maxLength = 200; input.autocomplete = 'off';
    input.placeholder = 'e.g. Halfway through question 4, stuck on the elasticity sign';
    form.appendChild(input);

    var foot = el('div', 'ns-foot');
    foot.appendChild(el('span', 'ns-note', 'Shown the next time you start a session'
      + (s.nbTitle ? ' on ' + s.nbTitle : '') + '.'));
    if (timeUp) {
      foot.appendChild(btn('ns-btn', '+10 min', function () { lastFocus = null; extend(10); closeBox(); }));
    } else {
      foot.appendChild(btn('ns-btn', 'Keep going', closeBox));
    }
    var done = el('button', 'ns-btn ns-primary', 'Done ✓');
    done.type = 'submit';
    foot.appendChild(done);
    form.appendChild(foot);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      finish(input.value);
      closeBox();
    });
    input.focus();
  }

  /* ---------- wiring ----------------------------------------------------- */

  function mount() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    line = el('div', 'ns-line');
    line.style.display = 'none';
    line.setAttribute('aria-hidden', 'true');
    dock = el('div', 'ns-dock');
    dock.setAttribute('role', 'group');
    dock.setAttribute('aria-label', 'Study session');
    document.body.appendChild(line);
    document.body.appendChild(dock);
    paint();
    setInterval(paint, 1000);
    // Another window started, paused or ended it.
    window.addEventListener('storage', function (e) {
      if (e.key === NOW_KEY || e.key === LOG_KEY || e.key === AGENDA_KEY || e.key === null) { sig = ''; paint(); }
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) paint(); });
  }

  window.notivloSession = {
    open: function () { if (current()) openWrap(false); else openStart(); },
    current: current,
    togglePause: togglePause,
    log: log,
  };

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
