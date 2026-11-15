/* Jump — one box that gets you anywhere.
 *
 * Cmd/Ctrl+K (or "/" when you are not typing) opens a list of every notebook,
 * every chapter you have opened, the pages, and the handful of things you do
 * most. Type a few letters, press Enter. With nothing typed it leads with
 * whatever is due next and the notebook you touched last, so "carry on where
 * I was" is two keystrokes from any page.
 *
 * Deliberately plain DOM, outside the DC tree: the pages re-render their own
 * roots, and anything injected inside one would be thrown away. It reads the
 * same localStorage keys the pages write and never writes to them, except
 * the theme, which goes through theme.js.
 *
 * It refuses to open over a dialog. A test in progress is a dialog, and a
 * palette that can open your notes mid-paper would defeat the lock.
 */
(function () {
  'use strict';
  if (window.notivloJump) return;

  var NOTEBOOKS_KEY = 'folio_notebooks_v1';
  var AGENDA_KEY = 'folio_agenda_v2';
  var STATE_PREFIX = 'folio_nb_state:';
  var MAX_ROWS = 9;

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function isoToday() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function dayLabel(iso) {
    var today = isoToday();
    if (iso === today) return 'Today';
    var d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    var diff = Math.round((d - new Date(today + 'T12:00:00')) / 86400000);
    if (diff === 1) return 'Tomorrow';
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function notebookHref(nb, ch) {
    return 'Notebook.dc.html?nb=' + nb.slug
      + (nb.userCreated ? '&title=' + encodeURIComponent(nb.title) : '')
      + (ch != null ? '&ch=' + ch : '');
  }

  var here = (location.pathname.split('/').pop() || '').toLowerCase();

  /* ---------- what there is to jump to --------------------------------- */

  function gather() {
    var out = { next: [], notebooks: [], chapters: [], go: [], act: [] };
    var notebooks = read(NOTEBOOKS_KEY);
    if (!Array.isArray(notebooks)) notebooks = [];
    notebooks = notebooks.filter(function (nb) { return nb && nb.slug && nb.title; });
    var bySlug = {};
    notebooks.forEach(function (nb) { bySlug[nb.slug] = nb; });

    // Due next: open deadlines and tasks from today on, soonest first.
    var agenda = read(AGENDA_KEY);
    var today = isoToday();
    if (Array.isArray(agenda)) {
      agenda.filter(function (it) {
        return it && it.title && it.date >= today && !it.done
          && (it.type === 'assignment' || it.type === 'task' || it.type === 'exam');
      }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; })
        .slice(0, 3).forEach(function (it) {
          var nb = it.notebookSlug && bySlug[it.notebookSlug];
          out.next.push({
            label: it.title,
            hint: dayLabel(it.date) + (it.time && it.time !== 'Any time' ? ' · ' + it.time : ''),
            href: nb ? notebookHref(nb, it.nbCh != null ? it.nbCh : null) : 'Planner.dc.html',
            kind: 'Due',
          });
        });
    }

    notebooks.slice().sort(function (a, b) { return (a.minutesAgo || 0) - (b.minutesAgo || 0); })
      .forEach(function (nb, i) {
        out.notebooks.push({
          label: nb.title,
          hint: i === 0 ? 'Last opened' : (nb.subject || ''),
          href: notebookHref(nb, null),
          kind: 'Notebook',
        });
        var st = read(STATE_PREFIX + nb.slug);
        if (st && Array.isArray(st.chapters)) {
          st.chapters.forEach(function (ch, idx) {
            if (!ch || !ch.title) return;
            out.chapters.push({ label: ch.title, hint: nb.title, href: notebookHref(nb, idx), kind: 'Chapter' });
          });
        }
      });

    out.go = [
      { label: 'Home', hint: 'Notebooks and this week', href: 'Home.dc.html', kind: 'Go to', keys: 'shelf start' },
      { label: 'Agenda', hint: 'Deadlines, classes, study blocks', href: 'Planner.dc.html', kind: 'Go to', keys: 'planner calendar week schedule' },
      { label: 'Settings', hint: 'Profile and preferences', href: 'Settings.dc.html', kind: 'Go to', keys: 'account profile' },
      { label: 'Appearance and text size', hint: 'Settings', href: 'Settings.dc.html?section=preferences', kind: 'Go to', keys: 'preferences font theme' },
      { label: 'Export my data', hint: 'Settings', href: 'Settings.dc.html?section=data', kind: 'Go to', keys: 'backup storage download' },
      { label: 'Send feedback', hint: 'Report a bug or ask for something', href: 'Settings.dc.html?section=feedback', kind: 'Go to', keys: 'bug report help contact' },
    ].filter(function (g) { return g.href.toLowerCase().split('?')[0] !== here || g.href.indexOf('?') > -1; });

    var theme = window.currentTheme ? window.currentTheme().resolved : null;
    out.act = [
      { label: 'New notebook', hint: 'Start a subject', href: 'Home.dc.html?new=1', kind: 'Do', keys: 'create add subject' },
      { label: 'Add a deadline or event', hint: 'Agenda', href: 'Planner.dc.html?add=1', kind: 'Do', keys: 'create new task class exam study assignment' },
    ];
    if (theme && window.saveTheme) {
      var to = theme === 'dark' ? 'light' : 'dark';
      out.act.push({
        label: 'Switch to ' + to + ' mode', hint: 'Appearance', kind: 'Do', keys: 'theme dark light night appearance',
        run: function () { window.saveTheme(to); },
      });
    }
    return out;
  }

  /* ---------- matching --------------------------------------------------
     Every word typed has to appear somewhere in the row. A row scores higher
     when a word starts the label or starts a word in it, so "ki" finds
     Kinematics before it finds "Practical Skills". */
  function score(item, words) {
    var label = item.label.toLowerCase();
    var hay = label + ' ' + (item.hint || '').toLowerCase() + ' ' + (item.keys || '') + ' ' + item.kind.toLowerCase();
    var total = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var at = hay.indexOf(w);
      if (at === -1) return 0;
      if (label.indexOf(w) === 0) total += 6;
      else if (label.indexOf(' ' + w) > -1) total += 4;
      else if (label.indexOf(w) > -1) total += 3;
      else total += 1;
    }
    return total;
  }

  function resultsFor(query) {
    var g = gather();
    var words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      return []
        .concat(g.next)
        .concat(g.notebooks.slice(0, 3))
        .concat(g.act.slice(0, 2))
        .concat(g.go.slice(0, 2))
        .slice(0, MAX_ROWS);
    }
    var all = g.notebooks.concat(g.chapters, g.act, g.go, g.next);
    return all.map(function (it, i) { return { it: it, s: score(it, words), i: i }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s || a.i - b.i; })
      .slice(0, MAX_ROWS)
      .map(function (r) { return r.it; });
  }

  /* ---------- the box ---------------------------------------------------- */

  var css = [
    '.qj-launch{position:fixed;right:16px;bottom:16px;z-index:45;display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;',
    'background:var(--cs-surface-raised,#f6f4ef);color:var(--cs-ink,#14161b);border:2px solid var(--cs-rule,#14161b);',
    'font:700 12px/1 var(--cs-mono,ui-monospace,Menlo,monospace);cursor:pointer}',
    '.qj-launch kbd{font:inherit;font-weight:400;opacity:.65}',
    '.qj-launch:hover{background:var(--cs-ink,#14161b);color:var(--cs-surface,#e6e3dc)}',
    'body:has([role="dialog"]) .qj-launch{display:none}',
    '@media (max-width:760px){.qj-launch kbd{display:none}.qj-launch{right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px))}}',
    '@media print{.qj-launch,.qj-scrim{display:none !important}}',
    '.qj-scrim{position:fixed;inset:0;z-index:5000;background:rgb(20 22 27 / .55);display:flex;justify-content:center;align-items:flex-start;padding:12vh 16px 16px}',
    ':root[data-theme="dark"] .qj-scrim{background:rgb(0 0 0 / .62)}',
    '.qj-box{width:min(580px,100%);max-height:76vh;display:flex;flex-direction:column;background:var(--cs-surface-raised,#f6f4ef);color:var(--cs-ink,#14161b);border:2px solid var(--cs-rule,#14161b)}',
    '.qj-in{flex:none;width:100%;box-sizing:border-box;height:54px;padding:0 18px;border:0;border-bottom:2px solid var(--cs-rule,#14161b);background:transparent;color:inherit;',
    'font:16px/1 var(--cs-sans,system-ui,sans-serif);outline:none !important}',
    '.qj-in::placeholder{color:var(--cs-ink-soft,#2b2d33);opacity:.7}',
    '.qj-list{flex:1;overflow-y:auto;margin:0;padding:6px 0;list-style:none}',
    '.qj-row{display:flex;align-items:baseline;gap:12px;padding:10px 18px;cursor:pointer}',
    '.qj-kind{flex:none;width:68px;font:11px/1.4 var(--cs-mono,ui-monospace,Menlo,monospace);opacity:.7}',
    '.qj-label{flex:1;min-width:0;font:600 15px/1.35 var(--cs-sans,system-ui,sans-serif);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.qj-hint{flex:none;max-width:42%;font:12px/1.4 var(--cs-sans,system-ui,sans-serif);opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.qj-row[aria-selected="true"]{background:var(--cs-signal,#ff5a1f);color:var(--cs-on-signal,#14161b)}',
    '.qj-row[aria-selected="true"] .qj-kind,.qj-row[aria-selected="true"] .qj-hint{opacity:.85}',
    '.qj-none{padding:18px;font:14px/1.5 var(--cs-sans,system-ui,sans-serif);opacity:.75}',
    '.qj-foot{flex:none;display:flex;gap:16px;padding:9px 18px;border-top:2px solid var(--cs-rule-faint,rgb(20 22 27 / .22));font:11px/1 var(--cs-mono,ui-monospace,Menlo,monospace);opacity:.7}',
    '@media (max-width:760px){.qj-scrim{padding-top:8vh}.qj-kind{display:none}.qj-foot{display:none}}',
  ].join('');

  var scrim = null, input = null, list = null, rows = [], selected = 0, lastFocus = null;

  function blocked() {
    return !!document.querySelector('[role="dialog"]:not(.qj-box)');
  }

  function render() {
    rows = resultsFor(input.value);
    if (selected >= rows.length) selected = Math.max(0, rows.length - 1);
    list.textContent = '';
    if (!rows.length) {
      var none = document.createElement('li');
      none.className = 'qj-none';
      none.textContent = 'Nothing matches "' + input.value.trim() + '". Try a notebook or chapter name.';
      list.appendChild(none);
      return;
    }
    rows.forEach(function (it, i) {
      var li = document.createElement('li');
      li.className = 'qj-row';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === selected ? 'true' : 'false');
      var kind = document.createElement('span'); kind.className = 'qj-kind'; kind.textContent = it.kind;
      var label = document.createElement('span'); label.className = 'qj-label'; label.textContent = it.label;
      var hint = document.createElement('span'); hint.className = 'qj-hint'; hint.textContent = it.hint || '';
      li.appendChild(kind); li.appendChild(label); li.appendChild(hint);
      li.addEventListener('mousemove', function () { if (selected !== i) { selected = i; mark(); } });
      li.addEventListener('click', function () { selected = i; go(); });
      list.appendChild(li);
    });
  }

  function mark() {
    var els = list.querySelectorAll('.qj-row');
    for (var i = 0; i < els.length; i++) {
      els[i].setAttribute('aria-selected', i === selected ? 'true' : 'false');
      if (i === selected && els[i].scrollIntoView) els[i].scrollIntoView({ block: 'nearest' });
    }
  }

  function go() {
    var it = rows[selected];
    if (!it) return;
    close();
    if (it.run) it.run();
    else if (it.href) window.location.href = it.href;
  }

  function open() {
    if (scrim || blocked()) return;
    lastFocus = document.activeElement;
    scrim = document.createElement('div');
    scrim.className = 'qj-scrim';
    scrim.addEventListener('mousedown', function (e) { if (e.target === scrim) close(); });

    var box = document.createElement('div');
    box.className = 'qj-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Jump to');

    input = document.createElement('input');
    input.className = 'qj-in';
    input.type = 'text';
    input.placeholder = 'Jump to a notebook, chapter or page…';
    input.setAttribute('aria-label', 'Jump to');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.addEventListener('input', function () { selected = 0; render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (rows.length) { selected = (selected + 1) % rows.length; mark(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (rows.length) { selected = (selected - 1 + rows.length) % rows.length; mark(); } }
      else if (e.key === 'Enter') { e.preventDefault(); go(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    });

    list = document.createElement('ul');
    list.className = 'qj-list';
    list.setAttribute('role', 'listbox');

    var foot = document.createElement('div');
    foot.className = 'qj-foot';
    foot.textContent = '↑↓ move   ↵ open   esc close';

    box.appendChild(input); box.appendChild(list); box.appendChild(foot);
    scrim.appendChild(box);
    document.body.appendChild(scrim);
    selected = 0;
    render();
    input.focus();
  }

  function close() {
    if (!scrim) return;
    scrim.remove();
    scrim = input = list = null;
    rows = [];
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* gone */ } }
  }

  function typingInField(t) {
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
  }

  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && k === 'k') {
      e.preventDefault();
      if (scrim) close(); else open();
      return;
    }
    if (k === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !scrim && !typingInField(e.target)) {
      e.preventDefault();
      open();
    }
  }, true);

  function mount() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qj-launch';
    btn.setAttribute('aria-label', 'Jump to a notebook, chapter or page');
    btn.appendChild(document.createTextNode('Jump'));
    var kbd = document.createElement('kbd');
    kbd.textContent = mac ? '⌘K' : 'Ctrl K';
    btn.appendChild(kbd);
    btn.addEventListener('click', open);
    document.body.appendChild(btn);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  window.notivloJump = { open: open, close: close, resultsFor: resultsFor };
})();
