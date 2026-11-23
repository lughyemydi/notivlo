/* Blurt — close the book and write down everything you remember.
 *
 * Blurting is how a lot of A level students actually revise: shut the notes,
 * write every single thing you can remember about a topic on a blank page,
 * then open the notes again and see what you missed. It is free recall, the
 * hardest and most useful kind, and until now the app had nothing for it —
 * Recall shows you a card, which is recognition, not retrieval.
 *
 *   Write     The chapter disappears. A blank page fills the window with the
 *             chapter's title and nothing else. A countdown starts on the first
 *             keystroke (3, 5 or 10 minutes, or none) with a line filling
 *             across the top. When it runs out it says so and waits: it never
 *             snatches the page away mid-sentence.
 *   Compare   Your page beside your own notes. Every idea in the chapter
 *             (one sentence of what you wrote there) is marked recalled,
 *             partly there or missed, and the words you got are underlined on
 *             both sides. Definitions are checked as key terms. One score,
 *             and how it moved since last time.
 *   Feed      A definition you did not reproduce is counted as a miss in
 *             Recall, so it comes up first the next time Recall is opened.
 *             That is the only thing it writes outside its own keys.
 *
 * Matching is deliberately simple and runs on the device: words are lower-
 * cased, common words dropped, and the rest cut to a short stem, so
 * "elasticity" finds "elastic" and "curves" finds "curve". It cannot tell a
 * right explanation from a wrong one that uses the right words, and the page
 * says as much — the score is a prompt to look, not a mark.
 *
 * Plain DOM outside the DC tree, like quick.js and session.js, and for the
 * same reason: the page re-renders its own root. The notebook page hands it
 * the chapter through window.notivloBlurtSource; nothing here reads the
 * editor. Its keys start with 'folio_' so signing out clears them, and they
 * are not synced.
 *
 *   folio_blurt_v1   { "<slug>": { "<chapter title>": [ attempt, ... ] } }
 *   folio_blurt_len  minutes last chosen (0 = no limit)
 */
(function () {
  'use strict';
  if (window.notivloBlurt) return;

  var LOG_KEY = 'folio_blurt_v1';
  var LEN_KEY = 'folio_blurt_len';
  var RECALL_KEY = 'folio_recall_v1';
  var RECALL_MAX_MISSES = 5;       // matches Notebook.dc.html
  var KEEP_PER_CHAPTER = 12;
  var LENGTHS = [3, 5, 10, 0];
  var DEFAULT_LEN = 5;

  /* ---------- storage ---------------------------------------------------- */

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  function chapterKey(title) {
    return String(title || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120) || 'untitled';
  }
  function history(slug, title) {
    var all = read(LOG_KEY);
    var list = all && all[slug] && all[slug][chapterKey(title)];
    return Array.isArray(list) ? list.filter(function (a) { return a && typeof a.score === 'number'; }) : [];
  }
  function remember(slug, title, attempt) {
    var all = read(LOG_KEY);
    if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
    if (!all[slug] || typeof all[slug] !== 'object') all[slug] = {};
    var k = chapterKey(title);
    var list = Array.isArray(all[slug][k]) ? all[slug][k] : [];
    list.push(attempt);
    all[slug][k] = list.slice(-KEEP_PER_CHAPTER);
    write(LOG_KEY, all);
  }
  function lastLength() {
    var n = read(LEN_KEY);
    return LENGTHS.indexOf(n) > -1 ? n : DEFAULT_LEN;
  }

  // Same key shape as recallCardKey() in Notebook.dc.html for a 'Define' card,
  // so a miss here is the same card's miss there.
  function feedRecall(slug, fronts) {
    if (!slug || !fronts.length) return;
    var all = read(RECALL_KEY);
    if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
    var mine = all[slug] && typeof all[slug] === 'object' ? all[slug] : {};
    fronts.forEach(function (f) {
      var key = 'd|' + String(f).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
      mine[key] = Math.min(RECALL_MAX_MISSES, (mine[key] || 0) + 1);
    });
    all[slug] = mine;
    write(RECALL_KEY, all);
  }

  /* ---------- text --------------------------------------------------------- */

  // Stored paragraphs are markup and are never innerHTML'd; DOMParser makes a
  // detached document that runs and fetches nothing. Same rule as the page.
  function plain(markup) {
    var raw = String(markup == null ? '' : markup);
    if (!raw) return '';
    try {
      var doc = new DOMParser().parseFromString(raw, 'text/html');
      return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) {
      return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  var STOP = ('a about above after again against all also although always am an and any are as at be because been '
    + 'before being below between both but by can cannot could did do does doing down during each either else '
    + 'even ever every few for from further get gets given gives had has have having he her here hers him his how '
    + 'however i if in into is it its itself just less like made make makes making many may me might more most '
    + 'much must my never no nor not now of off often on once one only or other others otherwise our ours out '
    + 'over own per rather really same see seen shall she should show shows since so some such than that the '
    + 'their theirs them then there therefore these they thing things this those though through thus to too '
    + 'under until up upon us use used uses using very was way ways we well were what whatever when where '
    + 'whether which while who whole whom whose why will with within without would yet you your yours '
    + 'also back called case come comes done first going good keep know last least means mean meant next part '
    + 'point put said say says second take takes tell three two four five whatever whichever sure work works '
    + 'into onto across along around actually basically something anything nothing everything someone anyone '
    + 'question questions answer answers mark marks marking scheme exam paper papers chapter notes write written').split(' ');
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = true; });

  function stem(word) {
    var w = word.toLowerCase().replace(/[’']s$/, '').replace(/[^a-z0-9]/g, '');
    if (!w) return '';
    if (w.length > 4 && /ies$/.test(w)) w = w.slice(0, -3) + 'y';
    else if (w.length > 4 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
    return w.length > 6 ? w.slice(0, 6) : w;
  }

  // Splits text into runs of word / not-word, keeping every character, so the
  // same pass can both score and repaint the text exactly as written.
  function tokens(text) {
    var out = [];
    var re = /[A-Za-zÀ-ɏ0-9][A-Za-zÀ-ɏ0-9’'\-]*/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ text: text.slice(last, m.index) });
      var raw = m[0].replace(/[\-’']+$/, '');
      var trail = m[0].slice(raw.length);
      out.push({ text: raw, key: keyFor(raw) });
      if (trail) out.push({ text: trail });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
  }

  // A word worth recalling: not a common word, and four letters or more —
  // except acronyms (PED, GDP, DNA), which are short and matter most.
  function keyFor(raw) {
    if (/^\d+$/.test(raw)) return '';
    var acronym = /^[A-Z]{2,6}s?$/.test(raw);
    var lower = raw.toLowerCase();
    if (!acronym && (lower.length < 4 || STOPSET[lower])) return '';
    if (STOPSET[lower]) return '';
    return stem(raw);
  }

  function keysOf(text) {
    var set = {};
    tokens(text).forEach(function (t) { if (t.key) set[t.key] = true; });
    return Object.keys(set);
  }

  function sentences(text) {
    var parts = String(text || '').match(/[^.!?]+(?:[.!?]+["”’)]*\s*|$)/g) || [];
    return parts.map(function (s) { return s; }).filter(function (s) { return s.trim().length > 0; });
  }

  // "Opportunity cost — the benefit of..." → term and meaning. Mirrors
  // recallSplitTerm() on the notebook page.
  function splitTerm(text) {
    var t = String(text || '').trim();
    var m = t.match(/^([\s\S]{2,90}?)\s*[—–]\s*([\s\S]+)$/);
    if (!m) m = t.match(/^([\s\S]{2,90}?)\s+-\s+([\s\S]+)$/);
    if (!m) return null;
    return { front: m[1].trim(), back: m[2].trim() };
  }

  /* ---------- scoring ------------------------------------------------------ */

  function analyse(source, written) {
    var have = {};
    keysOf(written).forEach(function (k) { have[k] = true; });

    var paragraphs = paragraphsOf(source).map(function (p) {
      return sentences(p).map(function (s) {
        var keys = keysOf(s);
        var hit = keys.filter(function (k) { return have[k]; }).length;
        var cov = keys.length ? hit / keys.length : 0;
        var state = !keys.length ? 'none' : cov >= 0.5 ? 'got' : (cov >= 0.25 && hit > 0) ? 'part' : 'miss';
        return { text: s, keys: keys.length, hit: hit, state: state };
      });
    }).filter(function (list) { return list.length; });

    var terms = [];
    (source.notes || []).forEach(function (n) {
      if (!n || n.type !== 'def') return;
      var split = splitTerm(plain(n.text));
      if (!split) return;
      var keys = keysOf(split.front);
      if (!keys.length) return;
      var hit = keys.filter(function (k) { return have[k]; }).length;
      var need = keys.length <= 2 ? keys.length : Math.ceil(keys.length * 2 / 3);
      terms.push({ front: split.front, back: split.back, got: hit >= need });
    });

    var ideas = [];
    paragraphs.forEach(function (list) { list.forEach(function (s) { if (s.state !== 'none') ideas.push(s); }); });
    var got = ideas.filter(function (s) { return s.state === 'got'; }).length;
    var part = ideas.filter(function (s) { return s.state === 'part'; }).length;
    var termsGot = terms.filter(function (t) { return t.got; }).length;
    var total = ideas.length + terms.length;
    var score = total ? Math.round(100 * (got + part * 0.5 + termsGot) / total) : 0;

    // Every stem in the chapter, so the reader's own page can show which of
    // their words were the chapter's words.
    var chapterKeys = {};
    paragraphs.forEach(function (list) { list.forEach(function (s) { keysOf(s.text).forEach(function (k) { chapterKeys[k] = true; }); }); });
    terms.forEach(function (t) { keysOf(t.front + ' ' + t.back).forEach(function (k) { chapterKeys[k] = true; }); });

    return {
      have: have, chapterKeys: chapterKeys, paragraphs: paragraphs, terms: terms, ideas: ideas,
      got: got, part: part, termsGot: termsGot, score: score, total: total,
    };
  }

  // The notebook hands over plain text lines; stored markup is accepted too.
  function paragraphsOf(source) {
    if (!source) return [];
    if (Array.isArray(source.text)) return source.text.map(String);
    return (source.paragraphs || []).map(plain);
  }

  function hasContent(source) {
    return keysOf(paragraphsOf(source).join(' ')).length >= 3;
  }

  /* ---------- styles ------------------------------------------------------- */

  var INK = 'var(--cs-ink,#14161b)', RAISED = 'var(--cs-surface-raised,#f6f4ef)', SURFACE = 'var(--cs-surface,#e6e3dc)';
  var RULE = 'var(--cs-rule,#14161b)', FAINT = 'var(--cs-rule-faint,rgb(20 22 27 / .22))';
  var SIGNAL = 'var(--cs-signal,#ff5a1f)', ONSIG = 'var(--cs-on-signal,#14161b)', ACCENT = 'var(--cs-accent-text,#2b4bff)';
  var MONO = 'var(--cs-mono,ui-monospace,Menlo,monospace)', SANS = 'var(--cs-sans,system-ui,sans-serif)';
  var NOTES = 'var(--font-notes,' + SANS + ')';

  var css = [
    '.bl-root{position:fixed;inset:0;z-index:5000;display:flex;flex-direction:column;background:' + SURFACE + ';color:' + INK + ';font:15px/1.5 ' + SANS + '}',
    '.bl-root *{box-sizing:border-box}',
    // concrete-signal.css gives every [role=dialog] the raised surface and an
    // ink outline, which is right for a sheet over the page. This is not a
    // sheet: it replaces the page, so it takes the page's own ground.
    'html .bl-root[role="dialog"]{background:' + SURFACE + ' !important;border:0 !important}',
    '.bl-line{position:absolute;left:0;top:0;height:4px;width:0;background:' + SIGNAL + ';transition:width 1s linear;pointer-events:none}',
    '.bl-root.bl-over .bl-line{width:100% !important}',
    '.bl-bar{display:flex;align-items:center;gap:14px;padding:16px 24px;border-bottom:2px solid ' + RULE + ';flex:none;flex-wrap:wrap}',
    '.bl-kicker{font:11px/1 ' + MONO + ';text-transform:uppercase;letter-spacing:.1em;opacity:.75}',
    '.bl-kicker b{font-weight:700;opacity:1;color:' + INK + '}',
    '.bl-spacer{flex:1}',
    '.bl-chips{display:flex;gap:0;border:2px solid ' + RULE + '}',
    '.bl-chip{all:unset;cursor:pointer;padding:6px 10px;font:700 12px/1 ' + MONO + '}',
    '.bl-chip + .bl-chip{border-left:2px solid ' + RULE + '}',
    '.bl-chip[aria-pressed="true"]{background:' + INK + ';color:' + SURFACE + '}',
    '.bl-chip:focus-visible,.bl-btn:focus-visible,.bl-x:focus-visible{outline:2px solid ' + SIGNAL + ';outline-offset:2px}',
    '.bl-clock{font:700 22px/1 ' + MONO + ';font-variant-numeric:tabular-nums;letter-spacing:-.01em;min-width:72px;text-align:right}',
    '.bl-root.bl-over .bl-clock{color:' + SIGNAL + '}',
    '.bl-x{all:unset;cursor:pointer;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border:2px solid ' + RULE + ';font:700 16px/1 ' + MONO + '}',
    '.bl-x:hover,.bl-btn:hover{background:' + INK + ';color:' + SURFACE + '}',
    '.bl-body{flex:1;min-height:0;overflow:auto}',
    '.bl-page{max-width:820px;margin:0 auto;padding:48px 24px 24px;display:flex;flex-direction:column;min-height:100%}',
    '.bl-title{margin:0 0 6px;font:700 clamp(28px,4.4vw,46px)/1.05 ' + SANS + ';letter-spacing:-.02em}',
    '.bl-hint{margin:0 0 26px;opacity:.72;max-width:60ch}',
    '.bl-ta{flex:1;min-height:46vh;width:100%;resize:none;border:0;border-top:2px solid ' + FAINT + ';background:transparent;color:inherit;padding:22px 0 40px;font:18px/1.75 ' + NOTES + ';outline:none}',
    '.bl-ta::placeholder{color:inherit;opacity:.38}',
    // concrete-signal.css: text being edited shows a caret, not a ring.
    'html .bl-root .bl-ta:focus,html .bl-root .bl-ta:focus-visible{outline:none !important}',
    '.bl-foot{display:flex;align-items:center;gap:12px;padding:14px 24px calc(14px + var(--notivlo-safe-bottom,env(safe-area-inset-bottom,0px)));border-top:2px solid ' + RULE + ';flex:none;flex-wrap:wrap;background:' + RAISED + '}',
    '.bl-meta{font:12px/1.4 ' + MONO + ';opacity:.75;flex:1;min-width:160px}',
    '.bl-btn{all:unset;cursor:pointer;height:40px;padding:0 16px;display:inline-flex;align-items:center;gap:8px;border:2px solid ' + RULE + ';font:700 13px/1 ' + MONO + ';white-space:nowrap}',
    '.bl-btn kbd{font:400 11px/1 ' + MONO + ';opacity:.7}',
    '.bl-btn.bl-primary{background:' + SIGNAL + ';color:' + ONSIG + ';border-color:' + SIGNAL + '}',
    '.bl-btn.bl-primary:hover{background:' + INK + ';color:' + SURFACE + ';border-color:' + INK + '}',
    '.bl-btn[disabled]{opacity:.4;pointer-events:none}',
    '.bl-root.bl-over .bl-primary{animation:bl-pulse 1.4s ease-in-out infinite}',
    '@keyframes bl-pulse{50%{box-shadow:0 0 0 6px rgb(255 90 31 / .25)}}',
    /* compare */
    '.bl-result{max-width:1280px;margin:0 auto;padding:28px 24px 32px}',
    '.bl-head{display:grid;grid-template-columns:auto 1fr;gap:6px 28px;align-items:end;padding-bottom:22px;border-bottom:2px solid ' + RULE + '}',
    '.bl-score{font:700 clamp(64px,9vw,112px)/.85 ' + MONO + ';letter-spacing:-.05em;font-variant-numeric:tabular-nums;grid-row:span 2}',
    '.bl-score small{font-size:.32em;letter-spacing:0;margin-left:4px}',
    '.bl-verdict{font:700 24px/1.15 ' + SANS + ';letter-spacing:-.01em;margin:0}',
    '.bl-detail{font:12px/1.5 ' + MONO + ';opacity:.8;margin:0}',
    '.bl-delta{display:inline-block;padding:3px 7px;margin-left:8px;font:700 12px/1 ' + MONO + ';border:2px solid ' + RULE + '}',
    '.bl-delta.up{background:' + INK + ';color:' + SURFACE + '}',
    '.bl-strip{display:flex;gap:3px;margin:18px 0 0;height:14px}',
    '.bl-seg{flex:1;border:2px solid ' + RULE + '}',
    '.bl-seg.got{background:' + INK + '}',
    '.bl-seg.part{background:repeating-linear-gradient(135deg,' + INK + ' 0 3px,transparent 3px 7px)}',
    '.bl-seg.miss{border-color:' + SIGNAL + ';background:rgb(255 90 31 / .18)}',
    '.bl-legend{display:flex;gap:16px;flex-wrap:wrap;margin:8px 0 0;font:11px/1 ' + MONO + ';opacity:.8}',
    '.bl-legend i{display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:-1px;border:2px solid ' + RULE + '}',
    '.bl-legend .got{background:' + INK + '}.bl-legend .part{background:repeating-linear-gradient(135deg,' + INK + ' 0 2px,transparent 2px 4px)}.bl-legend .miss{border-color:' + SIGNAL + ';background:rgb(255 90 31 / .25)}',
    '.bl-terms{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:22px 0 0}',
    '.bl-term{padding:7px 11px;border:2px solid ' + RULE + ';font:600 13px/1.1 ' + SANS + '}',
    '.bl-term.got{background:' + INK + ';color:' + SURFACE + '}',
    '.bl-term.miss{border-color:' + SIGNAL + ';border-style:dashed}',
    '.bl-term small{font:400 11px/1 ' + MONO + ';opacity:.75;margin-left:6px}',
    '.bl-cols{display:grid;grid-template-columns:1fr 1fr;gap:0;margin-top:24px;border:2px solid ' + RULE + '}',
    '.bl-col{padding:20px 22px;min-width:0}',
    '.bl-col + .bl-col{border-left:2px solid ' + RULE + ';background:' + RAISED + '}',
    '.bl-col h3{margin:0 0 14px;font:11px/1 ' + MONO + ';text-transform:uppercase;letter-spacing:.1em;opacity:.75;font-weight:400}',
    '.bl-mine{white-space:pre-wrap;font:16px/1.75 ' + NOTES + ';word-wrap:break-word}',
    '.bl-mine .w{text-decoration:underline;text-decoration-color:' + ACCENT + ';text-decoration-thickness:3px;text-underline-offset:4px}',
    '.bl-empty{opacity:.6;font-style:italic}',
    '.bl-notes p{margin:0 0 14px;font:16px/1.75 ' + NOTES + '}',
    '.bl-s{padding:1px 0;transition:background .15s}',
    '.bl-s.miss{background:rgb(255 90 31 / .2);box-shadow:0 0 0 2px rgb(255 90 31 / .2)}',
    '.bl-s.part{background:rgb(255 90 31 / .08)}',
    '.bl-s.got{opacity:.86}',
    '.bl-s .w{text-decoration:underline;text-decoration-color:' + ACCENT + ';text-decoration-thickness:3px;text-underline-offset:4px;opacity:1}',
    '.bl-note{margin:18px 0 0;font:11px/1.5 ' + MONO + ';opacity:.65}',
    '.bl-nothing{max-width:560px;margin:12vh auto;padding:0 24px}',
    '.bl-nothing h2{font:700 28px/1.1 ' + SANS + ';margin:0 0 10px;letter-spacing:-.01em}',
    '@media (max-width:760px){.bl-bar{padding:12px 16px}.bl-foot{padding:12px 16px calc(12px + var(--notivlo-safe-bottom,env(safe-area-inset-bottom,0px)))}.bl-page{padding:28px 16px 16px}.bl-result{padding:20px 16px}',
    '.bl-cols{grid-template-columns:1fr}.bl-col + .bl-col{border-left:0;border-top:2px solid ' + RULE + '}.bl-head{grid-template-columns:1fr}.bl-score{grid-row:auto}',
    '.bl-chips{order:5}.bl-btn kbd{display:none}}',
    '@media print{.bl-root{display:none !important}}',
    '@media (prefers-reduced-motion:reduce){.bl-line{transition:none}.bl-root.bl-over .bl-primary{animation:none}}',
  ].join('');

  /* ---------- DOM helpers ------------------------------------------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(cls, label, onClick, kbd) {
    var b = el('button', cls, label);
    b.type = 'button';
    if (kbd) { var k = el('kbd', null, kbd); b.appendChild(k); }
    b.addEventListener('click', onClick);
    return b;
  }
  function otherDialogOpen() {
    var all = document.querySelectorAll('[role="dialog"]');
    for (var i = 0; i < all.length; i++) if (!root || !root.contains(all[i])) return true;
    return false;
  }
  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function ago(at) {
    var d = Math.round((Date.now() - at) / 86400000);
    if (d <= 0) return 'earlier today';
    if (d === 1) return 'yesterday';
    if (d < 14) return d + ' days ago';
    return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  function wordCount(text) {
    var m = String(text || '').match(/\S+/g);
    return m ? m.length : 0;
  }
  // Paints text with the words whose stem is in `keys` wrapped in <span.w>.
  function paint(into, text, keys) {
    tokens(text).forEach(function (t) {
      if (t.key && keys[t.key]) into.appendChild(el('span', 'w', t.text));
      else into.appendChild(document.createTextNode(t.text));
    });
  }

  /* ---------- the overlay --------------------------------------------------- */

  var root = null, styleOn = false;
  var st = null;   // { source, len, startedAt, timer, phase, discardArmed, prevFocus }

  function ensureStyle() {
    if (styleOn) return;
    var s = document.createElement('style');
    s.id = 'notivlo-blurt-style';
    s.textContent = css;
    document.head.appendChild(s);
    styleOn = true;
  }

  function source() {
    try { return typeof window.notivloBlurtSource === 'function' ? window.notivloBlurtSource() : null; } catch (e) { return null; }
  }

  function available() { return hasContent(source()); }

  function open(src) {
    if (root) return;
    src = src || source();
    if (!src) return;
    if (otherDialogOpen()) return;
    ensureStyle();
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
    st = { source: src, len: lastLength(), startedAt: null, timer: null, phase: 'write', discardArmed: false, text: '' };
    root = el('div', 'bl-root');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Blurt: ' + (src.chapterTitle || 'chapter'));
    document.body.appendChild(root);
    document.addEventListener('keydown', onKey, true);
    document.documentElement.style.overflow = 'hidden';
    if (hasContent(src)) renderWrite(); else renderNothing();
  }

  function close() {
    if (!root) return;
    stopClock();
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    root = null;
    st = null;
    document.documentElement.style.overflow = '';
  }

  function topBar(kickerWord) {
    var bar = el('div', 'bl-bar');
    var k = el('span', 'bl-kicker');
    var b = el('b', null, kickerWord);
    k.appendChild(b);
    k.appendChild(document.createTextNode(' · ' + (st.source.nbTitle || 'Notebook')));
    bar.appendChild(k);
    bar.appendChild(el('span', 'bl-spacer'));
    return bar;
  }

  function renderNothing() {
    root.textContent = '';
    var bar = topBar('Blurt');
    bar.appendChild(btn('bl-x', '×', close));
    bar.lastChild.setAttribute('aria-label', 'Close');
    root.appendChild(bar);
    var box = el('div', 'bl-nothing');
    box.appendChild(el('h2', null, 'Nothing to check against yet'));
    box.appendChild(el('p', null, 'Blurting compares what you remember with what this chapter says, and “'
      + (st.source.chapterTitle || 'this chapter') + '” is still nearly empty. Write your notes first, then come back and blurt them.'));
    var foot = el('div', 'bl-foot');
    foot.style.border = '0';
    foot.style.background = 'transparent';
    foot.style.padding = '18px 0 0';
    foot.appendChild(btn('bl-btn bl-primary', 'Back to the notebook', close));
    box.appendChild(foot);
    root.appendChild(box);
    foot.firstChild.focus();
  }

  function renderWrite() {
    st.phase = 'write';
    st.startedAt = null;
    st.discardArmed = false;
    root.classList.remove('bl-over');
    root.textContent = '';

    var line = el('div', 'bl-line');
    root.appendChild(line);

    var bar = topBar('Blurt');
    var chips = el('div', 'bl-chips');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Time limit');
    LENGTHS.forEach(function (n) {
      var c = btn('bl-chip', n ? n + ' min' : 'No limit', function () {
        if (st.startedAt) return;
        st.len = n;
        write(LEN_KEY, n);
        Array.prototype.forEach.call(chips.children, function (x) { x.setAttribute('aria-pressed', String(x === c)); });
        clock.textContent = n ? fmt(n * 60000) : '—';
        ta.focus();
      });
      c.setAttribute('aria-pressed', String(n === st.len));
      chips.appendChild(c);
    });
    bar.appendChild(chips);
    var clock = el('span', 'bl-clock', st.len ? fmt(st.len * 60000) : '—');
    clock.setAttribute('aria-live', 'off');
    bar.appendChild(clock);
    var x = btn('bl-x', '×', tryClose);
    x.setAttribute('aria-label', 'Close without comparing');
    bar.appendChild(x);
    root.appendChild(bar);

    var body = el('div', 'bl-body');
    var page = el('div', 'bl-page');
    page.appendChild(el('h1', 'bl-title', st.source.chapterTitle || 'Untitled chapter'));
    page.appendChild(el('p', 'bl-hint', 'Your notes are hidden. Write down everything you can remember about this chapter — '
      + 'definitions, causes, examples, diagrams in words. Don’t tidy it. The clock starts when you type.'));
    var ta = el('textarea', 'bl-ta');
    ta.setAttribute('aria-label', 'Everything you remember');
    ta.placeholder = 'Start anywhere…';
    ta.spellcheck = false;
    ta.value = st.text || '';
    page.appendChild(ta);
    body.appendChild(page);
    root.appendChild(body);

    var foot = el('div', 'bl-foot');
    var meta = el('span', 'bl-meta');
    var past = history(st.source.slug, st.source.chapterTitle);
    var prev = past[past.length - 1];
    function metaText() {
      var n = wordCount(ta.value);
      var bits = [n + (n === 1 ? ' word' : ' words')];
      if (prev) bits.push('last time ' + prev.score + '% ' + ago(prev.at));
      else bits.push('first blurt of this chapter');
      if (st.discardArmed) bits = ['Close again to throw this page away'];
      return bits.join(' · ');
    }
    meta.textContent = metaText();
    foot.appendChild(meta);
    var compare = btn('bl-btn bl-primary', 'Open my notes and compare', function () { toCompare(ta.value); }, '⌘↵');
    compare.disabled = !wordCount(ta.value);
    foot.appendChild(compare);
    root.appendChild(foot);

    ta.addEventListener('input', function () {
      st.text = ta.value;
      st.discardArmed = false;
      if (!st.startedAt && ta.value.trim()) startClock(line, clock);
      compare.disabled = !wordCount(ta.value);
      meta.textContent = metaText();
    });
    st.refreshMeta = function () { meta.textContent = metaText(); };
    setTimeout(function () { ta.focus(); }, 0);
  }

  function startClock(line, clock) {
    st.startedAt = Date.now();
    var chips = root.querySelector('.bl-chips');
    if (chips) chips.style.display = 'none';
    if (!st.len) { clock.textContent = '0:00'; }
    function tick() {
      if (!st || st.phase !== 'write') return;
      var gone = Date.now() - st.startedAt;
      if (!st.len) { clock.textContent = fmt(gone); return; }
      var total = st.len * 60000;
      var left = total - gone;
      line.style.width = Math.min(100, 100 * gone / total) + '%';
      if (left <= 0) {
        clock.textContent = 'Time';
        root.classList.add('bl-over');
        stopClock();
        return;
      }
      clock.textContent = fmt(left);
    }
    tick();
    st.timer = setInterval(tick, 500);
  }
  function stopClock() { if (st && st.timer) { clearInterval(st.timer); st.timer = null; } }

  function tryClose() {
    if (st.phase === 'write' && wordCount(st.text) >= 3 && !st.discardArmed) {
      st.discardArmed = true;
      if (st.refreshMeta) st.refreshMeta();
      return;
    }
    close();
  }

  function toCompare(text) {
    if (!wordCount(text)) return;
    stopClock();
    var spentMs = st.startedAt ? Date.now() - st.startedAt : 0;
    var r = analyse(st.source, text);
    var past = history(st.source.slug, st.source.chapterTitle);
    var prev = past[past.length - 1] || null;
    var best = past.reduce(function (m, a) { return Math.max(m, a.score); }, -1);
    remember(st.source.slug, st.source.chapterTitle, {
      at: Date.now(), score: r.score, ideas: r.ideas.length, got: r.got, part: r.part,
      terms: r.terms.length, termsGot: r.termsGot, words: wordCount(text), secs: Math.round(spentMs / 1000),
    });
    var missed = r.terms.filter(function (t) { return !t.got; }).map(function (t) { return t.front; });
    feedRecall(st.source.slug, missed);
    renderCompare(text, r, prev, best, missed);
  }

  function verdict(score) {
    if (score >= 85) return 'You know this chapter.';
    if (score >= 65) return 'Most of it is there.';
    if (score >= 40) return 'The bones are there. Fill in the gaps.';
    if (score >= 15) return 'A start. Read the highlighted parts, then try again.';
    return 'This one needs another read before it will stick.';
  }

  function renderCompare(text, r, prev, best, missed) {
    st.phase = 'compare';
    root.classList.remove('bl-over');
    root.textContent = '';

    var bar = topBar('Blurt · compare');
    var x = btn('bl-x', '×', close);
    x.setAttribute('aria-label', 'Close');
    bar.appendChild(x);
    root.appendChild(bar);

    var body = el('div', 'bl-body');
    var wrap = el('div', 'bl-result');

    var head = el('div', 'bl-head');
    var score = el('div', 'bl-score', String(r.score));
    score.appendChild(el('small', null, '%'));
    head.appendChild(score);
    var v = el('p', 'bl-verdict', verdict(r.score));
    if (prev) {
      var d = r.score - prev.score;
      var delta = el('span', 'bl-delta' + (d > 0 ? ' up' : ''), (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d));
      delta.title = 'Since ' + ago(prev.at) + ' (' + prev.score + '%)';
      v.appendChild(delta);
    }
    head.appendChild(v);
    var bits = [r.got + ' of ' + r.ideas.length + ' ideas recalled'];
    if (r.part) bits.push(r.part + ' partly');
    if (r.terms.length) bits.push(r.termsGot + ' of ' + r.terms.length + ' key terms');
    if (prev) bits.push('last time ' + prev.score + '% ' + ago(prev.at));
    if (best >= 0 && r.score > best) bits.push('your best on this chapter');
    head.appendChild(el('p', 'bl-detail', bits.join(' · ')));
    wrap.appendChild(head);

    var strip = el('div', 'bl-strip');
    strip.setAttribute('aria-hidden', 'true');
    r.ideas.forEach(function (s) { strip.appendChild(el('span', 'bl-seg ' + s.state)); });
    wrap.appendChild(strip);
    var legend = el('div', 'bl-legend');
    [['got', 'Recalled'], ['part', 'Partly'], ['miss', 'Missed']].forEach(function (p) {
      var item = el('span');
      item.appendChild(el('i', p[0]));
      item.appendChild(document.createTextNode(p[1]));
      legend.appendChild(item);
    });
    wrap.appendChild(legend);

    if (r.terms.length) {
      var terms = el('div', 'bl-terms');
      var lab = el('span', 'bl-kicker', 'Key terms');
      lab.style.marginRight = '4px';
      terms.appendChild(lab);
      r.terms.forEach(function (t) {
        var chip = el('span', 'bl-term ' + (t.got ? 'got' : 'miss'), t.front);
        chip.title = t.front + ' — ' + t.back;
        chip.appendChild(el('small', null, t.got ? 'got it' : 'missed'));
        terms.appendChild(chip);
      });
      wrap.appendChild(terms);
    }

    var cols = el('div', 'bl-cols');
    var mine = el('div', 'bl-col');
    mine.appendChild(el('h3', null, 'What you wrote'));
    var mineText = el('div', 'bl-mine');
    paint(mineText, text, r.chapterKeys);
    mine.appendChild(mineText);
    cols.appendChild(mine);

    var notes = el('div', 'bl-col bl-notes');
    notes.appendChild(el('h3', null, 'Your notes'));
    r.paragraphs.forEach(function (list) {
      var p = el('p');
      list.forEach(function (s) {
        var span = el('span', 'bl-s ' + s.state);
        paint(span, s.text, r.have);
        p.appendChild(span);
      });
      notes.appendChild(p);
    });
    cols.appendChild(notes);
    wrap.appendChild(cols);

    var note = el('p', 'bl-note', 'Matched on the words you used, not on whether the explanation is right — read the highlighted sentences, not just the number.'
      + (missed.length ? ' ' + (missed.length === 1 ? 'The term you missed comes' : 'The ' + missed.length + ' terms you missed come') + ' up first in Recall next time.' : ''));
    wrap.appendChild(note);
    body.appendChild(wrap);
    root.appendChild(body);

    var foot = el('div', 'bl-foot');
    foot.appendChild(el('span', 'bl-meta', wordCount(text) + ' words'));
    foot.appendChild(btn('bl-btn', 'Back to the notebook', close, 'esc'));
    var again = btn('bl-btn bl-primary', 'Blurt it again', function () { st.text = ''; renderWrite(); });
    foot.appendChild(again);
    root.appendChild(foot);
    again.focus();
  }

  function onKey(e) {
    if (!root) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (st.phase === 'write') tryClose(); else close();
      return;
    }
    if (st.phase === 'write' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      toCompare(st.text);
      return;
    }
    // Keep the page's own shortcuts (Jump's Cmd+K, Recall's keys) from firing
    // underneath while the blank page is up.
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); e.stopPropagation(); }
  }

  window.notivloBlurt = {
    open: open,
    close: close,
    available: available,
    isOpen: function () { return !!root; },
    // Exposed for blurt-test.js.
    _analyse: analyse,
    _keysOf: keysOf,
  };
})();
