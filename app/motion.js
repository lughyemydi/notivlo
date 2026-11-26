/* ==========================================================================
   notivlo motion
   --------------------------------------------------------------------------
   One small layer of movement shared by the app and the landing page. No
   dependency: the Web Animations API, a few custom elements, and a capture-
   phase listener for hold-to-confirm.

   Everything here follows Concrete & Signal's motion rules (concrete-signal.css
   section 13): short, linear-feeling, no bounce, no scale, and no fill mode,
   so an animation that never runs (a hidden or throttled page) leaves the
   element in its final state, never stuck invisible. Anyone whose device asks
   for less motion gets the final state straight away.

   Why custom elements: the pages are DC markup that React renders, and React
   owns every node it creates. A custom element with no children of its own in
   the markup is a box React never looks inside, so the digits, cells and
   frames drawn here survive every re-render. React only ever sets the
   element's attributes, which is exactly how it is told a value changed.

     <nv-odometer value="42%">     rolling digits (motion-primitives
                                   sliding-number)
     <nv-meter value="67">         hairline progress bar that fills on arrival
                                   (bklit bar enter)
     <nv-heatmap minutes="{…}">    12 weeks of study time, 7 rows by week
                                   (bklit heatmap)
     <nv-loader label="…">         square frames with a light sweeping round
                                   them (Kokonut UI loader, squared)
     [data-mo-hold]                hold to confirm (Kokonut UI hold button)
     [data-mo-tabs]                one indicator that slides to the active tab
                                   (Watermelon UI continuous tabs)
     [data-mo-swap]                text that changes eases in (Kokonut UI save
                                   status)
     [data-mo-edges]               a horizontal scroller whose cut-off edges
                                   blur away (motion-primitives
                                   progressive-blur)

   Adapted from MIT-licensed work: motion-primitives (Julien Thibeaut), Kokonut
   UI (kokonut-labs), Watermelon UI (WatermelonCorp) and bklit UI (bklit). The
   notices are in legal-licenses.js. None of their code is copied; the
   techniques and timings are.

   Exposed as window.notivloMotion for the landing page and the tests.
   ========================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.notivloMotion) return;

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mq && mq.matches); }

  // Concrete & Signal's one curve, and the line-draw curve bklit uses.
  var EASE = 'cubic-bezier(.2,0,0,1)';
  var EASE_DRAW = 'cubic-bezier(.85,0,.15,1)';

  // What each animated property looks like at rest, so an entrance can name
  // its end state explicitly (implicit keyframes are not everywhere yet).
  var REST = { opacity: 1, transform: 'none', translate: '0 0', filter: 'none', clipPath: 'inset(0 0 0 0)' };

  /* enter(el, from, {delay, duration, easing})
     A staggered entrance without a fill mode. The delay is folded into the
     keyframes as a held first stretch, so the element sits at `from` while it
     waits, and if the animation never plays at all it is simply at rest. The
     curve applies to the moving stretch only. */
  function enter(el, from, opts) {
    opts = opts || {};
    if (!el || !el.animate || reduced()) return null;
    var delay = Math.max(0, opts.delay || 0);
    var dur = Math.max(1, opts.duration || 300);
    var total = delay + dur;
    var to = {};
    Object.keys(from).forEach(function (k) { to[k] = k in REST ? REST[k] : ''; });
    var frames = [Object.assign({ offset: 0, easing: 'linear' }, from)];
    if (delay > 0) frames.push(Object.assign({ offset: delay / total, easing: opts.easing || EASE }, from));
    else frames[0].easing = opts.easing || EASE;
    frames.push(Object.assign({ offset: 1 }, to));
    try { return el.animate(frames, { duration: total }); } catch (e) { return null; }
  }

  /* drawIn(path, {duration, delay})
     A stroke draws itself along its length (bklit's sparkline enter: 900ms on
     cubic-bezier(.85,0,.15,1)). Works on any SVG geometry element. */
  function drawIn(path, opts) {
    opts = opts || {};
    if (!path || !path.animate || reduced()) return null;
    path.setAttribute('pathLength', '1');
    path.style.strokeDasharray = '1';
    return enter(path, { strokeDashoffset: 1 }, {
      duration: opts.duration || 900, delay: opts.delay || 0, easing: EASE_DRAW,
    });
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function define(name, cls) {
    if (!window.customElements || customElements.get(name)) return;
    try { customElements.define(name, cls); } catch (e) {}
  }

  /* ------------------------------------------------------------------------
     Odometer digits.
     Each digit is a column of 0–9 that rolls to its digit; anything else (a
     %, a colon) is printed as it is. On arrival every column rolls up from 0,
     the rightmost last (motion-primitives' sliding-number); after that a
     change rolls only the digits that changed. Translate on the system curve,
     no overshoot. Screen readers get the plain value.
     ------------------------------------------------------------------------ */
  var HTMLBase = typeof HTMLElement !== 'undefined' ? HTMLElement : function () {};

  class NvOdometer extends HTMLBase {
    static get observedAttributes() { return ['value']; }
    connectedCallback() {
      if (!this._built) {
        this._built = true;
        this._sr = document.createElement('span');
        this._sr.className = 'nv-sr';
        this._vis = document.createElement('span');
        this._vis.className = 'nv-odo';
        this._vis.setAttribute('aria-hidden', 'true');
        this.appendChild(this._sr);
        this.appendChild(this._vis);
        this._slots = [];
        this._render(true);
      }
    }
    attributeChangedCallback() { if (this._built) this._render(false); }
    _render(first) {
      var text = String(this.getAttribute('value') == null ? '' : this.getAttribute('value'));
      this._sr.textContent = text;
      var shape = text.replace(/\d/g, '0');
      if (shape !== this._shape) {
        this._shape = shape;
        this._vis.textContent = '';
        this._slots = [];
        for (var i = 0; i < text.length; i++) {
          var ch = text[i];
          if (/\d/.test(ch)) {
            var box = document.createElement('span');
            box.className = 'nv-odo-d';
            var col = document.createElement('span');
            col.className = 'nv-odo-col';
            for (var n = 0; n < 10; n++) {
              var s = document.createElement('span');
              s.textContent = String(n);
              col.appendChild(s);
            }
            box.appendChild(col);
            this._vis.appendChild(box);
            this._slots.push({ col: col, digit: first ? 0 : +ch });
            if (!first) col.style.translate = '0 ' + (-ch * 10) + '%';
          } else {
            var c = document.createElement('span');
            c.className = 'nv-odo-c';
            c.textContent = ch;
            this._vis.appendChild(c);
            this._slots.push(null);
          }
        }
      }
      var animate = !reduced();
      for (var j = 0, k = 0; j < text.length; j++) {
        var slot = this._slots[j];
        if (!slot) continue;
        var target = +text[j];
        var from = slot.digit;
        slot.digit = target;
        var end = '0 ' + (-target * 10) + '%';
        if (!animate || from === target) { slot.col.style.translate = end; k++; continue; }
        var start = '0 ' + (-from * 10) + '%';
        slot.col.style.translate = end;
        if (slot.col.animate) {
          try {
            slot.col.animate([{ translate: start }, { translate: end }], {
              duration: first ? 700 + k * 90 : 420, easing: EASE,
            });
          } catch (e) {}
        }
        k++;
      }
    }
  }

  /* ------------------------------------------------------------------------
     A hairline meter. Fills from empty when it first arrives, then follows
     its value on the system curve.
     ------------------------------------------------------------------------ */
  // The ARIA lives on an inner element, not the host: when a bound attribute
  // changes, the DC runtime rewrites the host's attribute list from the
  // markup, and anything set here on the host would be dropped. Hence
  // `label`, not aria-label, in the markup.
  class NvMeter extends HTMLBase {
    static get observedAttributes() { return ['value', 'label']; }
    connectedCallback() {
      if (this._fill) return;
      this._in = document.createElement('span');
      this._in.className = 'nv-meter-in';
      this._in.setAttribute('role', 'meter');
      this._in.setAttribute('aria-valuemin', '0');
      this._in.setAttribute('aria-valuemax', '100');
      this._fill = document.createElement('span');
      this._fill.className = 'nv-meter-fill';
      this._in.appendChild(this._fill);
      this.appendChild(this._in);
      this._apply(true);
    }
    attributeChangedCallback() { if (this._fill) this._apply(false); }
    _apply(first) {
      var v = Math.max(0, Math.min(100, parseFloat(this.getAttribute('value')) || 0));
      this._in.setAttribute('aria-valuenow', String(Math.round(v)));
      this._in.setAttribute('aria-label', this.getAttribute('label') || (Math.round(v) + '% done'));
      var end = 'translateX(' + (v - 100) + '%)';
      var was = this._v;
      this._v = v;
      this._fill.style.transform = end;
      if (reduced() || !this._fill.animate) return;
      var start = 'translateX(' + ((first ? 0 : (was || 0)) - 100) + '%)';
      if (!first && was === v) return;
      try { this._fill.animate([{ transform: start }, { transform: end }], { duration: first ? 900 : 300, easing: first ? EASE_DRAW : EASE }); } catch (e) {}
    }
  }

  /* ------------------------------------------------------------------------
     Study heatmap: the last N weeks, a column per week starting Monday, a row
     per weekday. `minutes` is the same {YYYY-MM-DD: minutes} map the Home
     page's streak reads, as JSON. Days after today are left blank.
     ------------------------------------------------------------------------ */
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // 0 for nothing, then four steps. The cut-offs are minutes in a day.
  function heatLevel(mins) {
    if (!(mins > 0)) return 0;
    if (mins < 25) return 1;
    if (mins < 50) return 2;
    if (mins < 90) return 3;
    return 4;
  }
  // The grid as data, oldest week first: [{iso, mins, level, future}] × 7 per
  // week. Pure, so the tests can check it without a DOM.
  function heatGrid(map, today, weeks) {
    var t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var dow = (t.getDay() + 6) % 7; // Monday = 0
    var monday = new Date(t); monday.setDate(t.getDate() - dow);
    var start = new Date(monday); start.setDate(monday.getDate() - (weeks - 1) * 7);
    var out = [];
    for (var w = 0; w < weeks; w++) {
      var col = [];
      for (var r = 0; r < 7; r++) {
        var d = new Date(start); d.setDate(start.getDate() + w * 7 + r);
        var key = iso(d);
        var mins = (map && +map[key]) || 0;
        col.push({ iso: key, date: d, mins: mins, level: heatLevel(mins), future: d > t });
      }
      out.push(col);
    }
    return out;
  }
  var DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  class NvHeatmap extends HTMLBase {
    static get observedAttributes() { return ['minutes', 'weeks']; }
    connectedCallback() {
      if (this._grid) return;
      this._grid = document.createElement('div');
      this._grid.className = 'nv-heat-grid';
      this.appendChild(this._grid);
      this._render(true);
    }
    attributeChangedCallback() { if (this._grid) this._render(false); }
    _render(first) {
      var map = {};
      try { map = JSON.parse(this.getAttribute('minutes') || '{}') || {}; } catch (e) {}
      var weeks = Math.max(1, Math.min(52, parseInt(this.getAttribute('weeks'), 10) || 12));
      var key = JSON.stringify(map) + '|' + weeks + '|' + iso(new Date());
      if (key === this._key) return;
      this._key = key;
      var grid = heatGrid(map, new Date(), weeks);
      var studied = 0, total = 0;
      this._grid.textContent = '';
      this._grid.style.setProperty('--nv-weeks', String(weeks));
      var self = this;
      grid.forEach(function (col, w) {
        col.forEach(function (cell) {
          var el = document.createElement('span');
          el.className = 'nv-heat-cell';
          if (cell.future) el.classList.add('is-future');
          else {
            el.setAttribute('data-level', String(cell.level));
            el.title = DAY[(cell.date.getDay() + 6) % 7] + ' ' + cell.date.getDate() + ' ' + MON[cell.date.getMonth()] + ' · '
              + (cell.mins > 0 ? Math.round(cell.mins) + ' min' : 'no study');
            if (cell.mins > 0) { studied++; total += cell.mins; }
          }
          self._grid.appendChild(el);
          if (first) enter(el, { opacity: 0 }, { delay: w * 28, duration: 220 });
        });
      });
      this._grid.setAttribute('role', 'img');
      this._grid.setAttribute('aria-label', 'Study time over the last ' + weeks + ' weeks: '
        + studied + (studied === 1 ? ' day' : ' days') + ' studied, ' + Math.round(total / 60 * 10) / 10 + ' hours in all.');
    }
  }

  /* ------------------------------------------------------------------------
     Loader. Kokonut UI's loader is four conic rings rotating at different
     speeds; Concrete & Signal allows no circles, so these are three nested
     square frames with a light sweeping round each — same speeds, same
     counter-rotating middle. The frames are drawn in CSS (motion.css).
     ------------------------------------------------------------------------ */
  class NvLoader extends HTMLBase {
    connectedCallback() {
      if (this._built) return;
      this._built = true;
      var label = this.getAttribute('label') || 'Loading';
      for (var i = 0; i < 3; i++) {
        var f = document.createElement('span');
        f.className = 'nv-loader-f nv-loader-f' + (i + 1);
        f.setAttribute('aria-hidden', 'true');
        this.appendChild(f);
      }
      var sr = document.createElement('span');
      sr.className = 'nv-sr';
      sr.setAttribute('role', 'status');
      sr.textContent = label;
      this.appendChild(sr);
    }
  }

  define('nv-odometer', NvOdometer);
  define('nv-meter', NvMeter);
  define('nv-heatmap', NvHeatmap);
  define('nv-loader', NvLoader);

  /* ------------------------------------------------------------------------
     Hold to confirm.
     Any element marked data-mo-hold (its value is the hold time in ms, 1200 by
     default, Kokonut's) refuses an ordinary click. Holding the pointer, Enter
     or Space fills it over that time; letting go early drains it back in a
     quarter of the time held. When it fills, the element is clicked for real,
     so whatever the page wired to its click runs unchanged.

     The refusing is done at the document in the capture phase, before React's
     own listener at the root sees the click — the same mechanism demo.js uses
     to keep the landing page's demo look-only.
     ------------------------------------------------------------------------ */
  var HOLD_MS = 1200;
  var hold = null;      // { el, start, ms, from, raf }
  var armed = null;     // the element whose next click is the real one

  function holdTarget(t) {
    return t && t.closest ? t.closest('[data-mo-hold]') : null;
  }
  function setHold(el, p) {
    el.style.setProperty('--mo-hold', String(p));
    el.classList.toggle('is-holding', p > 0 && p < 1);
  }
  function holdStart(el) {
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (hold && hold.el === el) return;
    holdStop(false);
    var ms = parseInt(el.getAttribute('data-mo-hold'), 10) || HOLD_MS;
    var from = parseFloat(el.style.getPropertyValue('--mo-hold')) || 0;
    if (el._moDrain) { cancelAnimationFrame(el._moDrain); el._moDrain = 0; }
    hold = { el: el, start: performance.now(), ms: ms, from: from };
    // Frames draw the fill; the timer is what finishes it, so a hold ends on
    // time even when frames are dropped or throttled.
    hold.timer = setTimeout(function () { if (hold && hold.el === el) holdDone(el); }, (1 - from) * ms);
    (function tick(now) {
      if (!hold || hold.el !== el) return;
      var p = Math.min(1, hold.from + (now - hold.start) / hold.ms);
      setHold(el, p);
      if (p >= 1) { holdDone(el); return; }
      hold.raf = requestAnimationFrame(tick);
    })(performance.now());
  }
  function holdStop() {
    if (!hold) return;
    var el = hold.el;
    cancelAnimationFrame(hold.raf);
    clearTimeout(hold.timer);
    hold = null;
    var p0 = parseFloat(el.style.getPropertyValue('--mo-hold')) || 0;
    if (p0 >= 1 || p0 <= 0) { setHold(el, 0); return; }
    // Drain over a quarter of the time it took to get here (Kokonut drains
    // over progress × 300ms; this keeps the same feel for any hold length).
    var dur = Math.max(120, p0 * 300), t0 = performance.now();
    (function drain(now) {
      var k = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      setHold(el, p0 * (1 - e));
      if (k < 1) el._moDrain = requestAnimationFrame(drain);
      else el._moDrain = 0;
    })(t0);
  }
  function holdDone(el) {
    if (hold) { cancelAnimationFrame(hold.raf); clearTimeout(hold.timer); }
    hold = null;
    setHold(el, 1);
    el.classList.add('is-held');
    armed = el;
    try { el.click(); } finally { armed = null; }
    setTimeout(function () { el.classList.remove('is-held'); setHold(el, 0); }, 900);
  }

  function wireHold() {
    document.addEventListener('click', function (e) {
      var el = holdTarget(e.target);
      if (!el || el === armed) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
    document.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var el = holdTarget(e.target);
      if (!el) return;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      holdStart(el);
    }, true);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) {
      document.addEventListener(type, function () { holdStop(); }, true);
    });
    document.addEventListener('contextmenu', function (e) {
      if (holdTarget(e.target)) e.preventDefault();
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var el = holdTarget(e.target);
      if (!el) return;
      e.preventDefault();
      if (!e.repeat) holdStart(el);
    }, true);
    document.addEventListener('keyup', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!holdTarget(e.target)) return;
      e.preventDefault();
      holdStop();
    }, true);
    window.addEventListener('blur', function () { holdStop(); });
  }

  /* ------------------------------------------------------------------------
     Sliding tab indicator, text swaps and scroller edges. All three watch the
     DOM, because the pages are re-rendered by React and the markup only says
     where; they only ever touch attributes and inline custom properties of
     the elements they are pointed at, never the children.
     ------------------------------------------------------------------------ */
  var ACTIVE = '[aria-selected="true"],[aria-current="true"],[aria-current="page"],[aria-pressed="true"],.is-active';

  // data-mo-tabs may name the page's own active-tab selector; empty means the
  // usual ARIA states.
  function placeTabs(box) {
    var sel = box.getAttribute('data-mo-tabs') || ACTIVE;
    var active = null;
    for (var i = 0; i < box.children.length; i++) {
      var c = box.children[i];
      try { if (c.matches && c.matches(sel)) { active = c; break; } } catch (e) { return; }
    }
    if (!active || !active.offsetParent) { box.classList.remove('mo-tabs-on'); return; }
    var x = active.offsetLeft, y = active.offsetTop;
    if (active.offsetParent !== box) {
      var a = active.getBoundingClientRect(), b = box.getBoundingClientRect();
      x = a.left - b.left + box.scrollLeft - box.clientLeft;
      y = a.top - b.top + box.scrollTop - box.clientTop;
    }
    var key = [x, y, active.offsetWidth, active.offsetHeight].join(',');
    // A re-render may have rewritten the container's own attributes; only
    // skip when what is on it still says where the marker is.
    if (key === box._moTabs && box.classList.contains('mo-tabs-on')
        && box.style.getPropertyValue('--mo-tab-w')) return;
    var firstTime = !box._moTabs;
    box._moTabs = key;
    box.style.setProperty('--mo-tab-x', x + 'px');
    box.style.setProperty('--mo-tab-y', y + 'px');
    box.style.setProperty('--mo-tab-w', active.offsetWidth + 'px');
    box.style.setProperty('--mo-tab-h', active.offsetHeight + 'px');
    // The first placement is not a movement: it would slide in from the corner.
    if (firstTime) {
      box.classList.add('mo-tabs-still');
      box.classList.add('mo-tabs-on');
      requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.remove('mo-tabs-still'); }); });
    } else box.classList.add('mo-tabs-on');
  }

  function swapIn(el) {
    if (reduced()) return;
    var txt = el.textContent;
    if (txt === el._moText) return;
    var had = el._moText != null;
    el._moText = txt;
    if (!had || !el.animate) return;
    // Only "Saving…" → "Saved" and back are worth a movement; the "Saved 12s
    // ago" clock ticking over is not. Compare the words, not the numbers.
    var words = txt.replace(/\d+/g, '#');
    if (words === el._moWords) return;
    el._moWords = words;
    try {
      el.animate([{ opacity: 0, translate: '0 4px' }, { opacity: 1, translate: '0 0' }], { duration: 160, easing: EASE });
    } catch (e) {}
  }

  function placeEdges(el) {
    var max = el.scrollWidth - el.clientWidth;
    var host = el.parentElement && el.parentElement.hasAttribute('data-mo-edges-host') ? el.parentElement : el;
    host.toggleAttribute('data-mo-cut-start', max > 1 && el.scrollLeft > 1);
    host.toggleAttribute('data-mo-cut-end', max > 1 && el.scrollLeft < max - 1);
  }

  function scanAll(root) {
    var r = root && root.querySelectorAll ? root : document;
    r.querySelectorAll('[data-mo-tabs]').forEach(placeTabs);
    r.querySelectorAll('[data-mo-swap]').forEach(function (el) { if (el._moText == null) { el._moText = el.textContent; el._moWords = el._moText.replace(/\d+/g, '#'); } });
    r.querySelectorAll('[data-mo-edges]').forEach(function (el) {
      if (!el._moEdges) {
        el._moEdges = true;
        el.addEventListener('scroll', function () { placeEdges(el); }, { passive: true });
      }
      placeEdges(el);
    });
  }

  function closestMarked(node, sel) {
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    return el && el.closest ? el.closest(sel) : null;
  }

  var pending = null;
  function watch() {
    if (!window.MutationObserver) return;
    var tabs = new Set(), swaps = new Set(), rescan = false;
    function flush() {
      pending = null;
      if (rescan) { rescan = false; scanAll(document); }
      tabs.forEach(placeTabs); tabs.clear();
      swaps.forEach(swapIn); swaps.clear();
    }
    var mo = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        var t = closestMarked(m.target, '[data-mo-tabs]');
        if (t) tabs.add(t);
        var s = closestMarked(m.target, '[data-mo-swap]');
        if (s) swaps.add(s);
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType === 1 && (n.matches('[data-mo-tabs],[data-mo-swap],[data-mo-edges]')
                || n.querySelector('[data-mo-tabs],[data-mo-swap],[data-mo-edges]'))) { rescan = true; break; }
          }
        }
      }
      if ((tabs.size || swaps.size || rescan) && !pending) pending = requestAnimationFrame(flush);
    });
    mo.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'aria-selected', 'aria-current', 'aria-pressed'],
    });
    var resizeT = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        document.querySelectorAll('[data-mo-tabs]').forEach(function (b) { b._moTabs = ''; b.classList.add('mo-tabs-still'); placeTabs(b); requestAnimationFrame(function () { b.classList.remove('mo-tabs-still'); }); });
        document.querySelectorAll('[data-mo-edges]').forEach(placeEdges);
      }, 120);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { scanAll(document); });
  }

  /* ------------------------------------------------------------------------
     Landing page helpers. Plain HTML there, so these build their own markup.
     ------------------------------------------------------------------------ */

  /* splitFlap(el, words, {interval})
     A departure board (Kokonut UI split-flap text). Each tile steps forward
     through the character set to its next letter — never backwards — with a
     56ms flip (28ms down, 28ms up) and a 40ms start delay per tile; a new word
     every 3.8s, only while the board is on screen. The element keeps a plain
     text label for screen readers; the tiles are hidden from them. */
  var FLAP_SET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&·-';
  function flapPath(from, to) {
    var a = FLAP_SET.indexOf(from), b = FLAP_SET.indexOf(to);
    if (a < 0) a = 0;
    if (b < 0) return [to];
    var out = [];
    for (var i = a; i !== b; i = (i + 1) % FLAP_SET.length) out.push(FLAP_SET[(i + 1) % FLAP_SET.length]);
    return out;
  }
  function splitFlap(el, words, opts) {
    opts = opts || {};
    if (!el || !words || !words.length) return null;
    words = words.map(function (w) { return String(w).toUpperCase(); });
    var len = words.reduce(function (m, w) { return Math.max(m, w.length); }, 0);
    var pad = function (w) { var s = w; while (s.length < len) s += ' '; return s; };
    el.classList.add('mo-flap');
    el.setAttribute('aria-hidden', 'true');
    el.textContent = '';
    var tiles = [];
    for (var i = 0; i < len; i++) {
      var t = document.createElement('span');
      t.className = 'mo-flap-t';
      t.innerHTML = '<span class="mo-flap-top"></span><span class="mo-flap-bot"></span>'
        + '<span class="mo-flap-ft"></span><span class="mo-flap-fb"></span>';
      el.appendChild(t);
      tiles.push({ el: t, ch: ' ', top: t.children[0], bot: t.children[1], ft: t.children[2], fb: t.children[3], q: [], busy: false });
    }
    function show(tile, ch) {
      tile.ch = ch;
      var s = ch === ' ' ? ' ' : ch;
      tile.top.textContent = s; tile.bot.textContent = s; tile.ft.textContent = s; tile.fb.textContent = s;
    }
    tiles.forEach(function (t) { show(t, ' '); });
    function flipNext(tile) {
      if (!tile.q.length) { tile.busy = false; return; }
      tile.busy = true;
      var next = tile.q.shift();
      var cur = tile.ch === ' ' ? ' ' : tile.ch;
      var nx = next === ' ' ? ' ' : next;
      tile.top.textContent = nx;          // revealed behind the falling flap
      tile.bot.textContent = cur;         // covered by the rising flap
      tile.ft.textContent = cur;
      tile.fb.textContent = nx;
      var a = tile.ft.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }],
        { duration: 28, easing: 'cubic-bezier(.5,0,.9,.6)' });
      tile.fb.style.transform = 'rotateX(90deg)';
      a.onfinish = function () {
        tile.ft.style.visibility = 'hidden';
        var b = tile.fb.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }],
          { duration: 28, easing: 'cubic-bezier(.2,.6,.3,1)' });
        tile.fb.style.transform = '';
        b.onfinish = function () {
          tile.ft.style.visibility = '';
          show(tile, next);
          flipNext(tile);
        };
      };
    }
    function setWord(w, instant) {
      var s = pad(w);
      tiles.forEach(function (tile, i) {
        var target = s[i];
        if (instant || reduced() || !tile.el.animate) { tile.q = []; show(tile, target); return; }
        var last = tile.q.length ? tile.q[tile.q.length - 1] : tile.ch;
        if (last === target) return;
        tile.q = tile.q.concat(flapPath(last, target));
        if (!tile.busy) setTimeout(function () { if (!tile.busy) flipNext(tile); }, i * 40);
      });
    }
    var idx = 0, timer = 0, visible = true;
    setWord(words[0], true);
    function loop() {
      clearTimeout(timer);
      if (reduced() || words.length < 2) return;
      timer = setTimeout(function () {
        if (visible && !document.hidden) { idx = (idx + 1) % words.length; setWord(words[idx]); }
        loop();
      }, opts.interval || 3800);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(el);
    }
    loop();
    return { set: setWord, stop: function () { clearTimeout(timer); } };
  }

  /* borderLight(cards)
     motion-primitives' spotlight follows the cursor with a soft glow; Concrete
     & Signal has no glows, so here it lights the card's own hairline instead:
     the border near the cursor turns signal. CSS in the page reads the two
     custom properties. */
  function borderLight(cards) {
    if (!cards || reduced()) return;
    Array.prototype.forEach.call(cards, function (card) {
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mo-x', (e.clientX - r.left) + 'px');
        card.style.setProperty('--mo-y', (e.clientY - r.top) + 'px');
        card.classList.add('mo-lit');
      });
      card.addEventListener('pointerleave', function () { card.classList.remove('mo-lit'); });
    });
  }

  /* checkmark(container)
     Appends a check that draws itself (Kokonut UI's hold button finish:
     M3.5 8.5 6.5 11.5 12.5 4.5 over 300ms after 100ms). Returns the svg. */
  function checkmark(container) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('class', 'mo-check');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M3.5 8.5 6.5 11.5 12.5 4.5');
    svg.appendChild(p);
    container.appendChild(svg);
    drawIn(p, { duration: 300, delay: 100 });
    return svg;
  }

  window.notivloMotion = {
    reduced: reduced,
    EASE: EASE,
    EASE_DRAW: EASE_DRAW,
    enter: enter,
    drawIn: drawIn,
    splitFlap: splitFlap,
    borderLight: borderLight,
    checkmark: checkmark,
    // For the tests.
    _heatGrid: heatGrid,
    _heatLevel: heatLevel,
    _flapPath: flapPath,
  };

  if (typeof document !== 'undefined' && document.addEventListener) {
    wireHold();
    onReady(function () { scanAll(document); watch(); });
  }
})();
