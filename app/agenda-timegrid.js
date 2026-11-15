/* The agenda's time grid: turning an agenda's free-text times into a day
 * laid out on a clock.
 *
 * The week runs 06:00 to 23:00. An hour at full height is tall enough to read
 * a block in; seventeen of those is a wall of mostly-empty space, so hours
 * with nothing in them shrink. They do not snap between two sizes, which
 * reads as a glitch — each hour's height falls off smoothly with its distance
 * from the nearest hour that holds something, so the space tapers away from
 * your commitments and closes up over a long empty stretch without ever
 * collapsing to nothing.
 *
 * That makes the minutes-to-pixels mapping piecewise linear rather than
 * constant, which is the whole reason this is a module and not a stylesheet:
 * every position on the grid has to come from the same `yFor`, or the hour
 * lines and the blocks drift apart.
 *
 * The scale is built once for the whole week, not per day, so 2pm is at the
 * same height in all seven columns and the days can be read across.
 *
 * No DOM here, and no framework. The page renders what this returns, and
 * agenda-timegrid-test.js checks the arithmetic on its own.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.notivloTimeGrid = api;
})(typeof self !== 'undefined' ? self : null, function () {
  'use strict';

  var START_HOUR = 6;
  var END_HOUR = 23;
  var WINDOW_START = START_HOUR * 60;
  var WINDOW_END = END_HOUR * 60;

  /* Row heights in px: full for an hour that holds something, tapering to a
   * floor as you move away from one. These are the agenda's own sizes; a
   * caller with less room — the week strip on the home page — passes its own
   * through `opts` and gets the same clock at a smaller scale. */
  var ROW_FULL = 62;
  var ROW_FLOOR = 20;
  var ROW_FALLOFF = 0.45;

  /* A deadline is a moment, not a stretch, but it still needs enough height
   * to read and enough span that two deadlines at the same minute don't land
   * on top of each other. */
  var POINT_SPAN = 30;
  var MIN_BLOCK = 24;
  var DEFAULT_BLOCK = 60;

  /* Below this, a hole between two things is just breathing room and saying
   * "9 minutes free" about it is noise. */
  var GAP_MIN = 45;

  /* How much of a block is spent on everything that is not the title — its
   * padding and the row holding the time — and how tall one line of title is.
   * Used to work out how many lines actually fit, because a block clips what
   * does not, and half a line of text looks like a bug. Both are overridable
   * for a caller drawing at a different size. */
  var BLOCK_OVERHEAD = 18;
  var BLOCK_LINE = 14.4;
  var MAX_TITLE_LINES = 3;

  /* Types that mark a moment rather than occupy a stretch of the day. */
  var POINT_TYPES = { assignment: true, task: true };

  function clamp(min, lo, hi) { return min < lo ? lo : min > hi ? hi : min; }

  function sizes(opts) {
    opts = opts || {};
    var full = opts.rowFull > 0 ? opts.rowFull : ROW_FULL;
    var floor = opts.rowFloor > 0 ? opts.rowFloor : ROW_FLOOR;
    var overhead = opts.blockOverhead >= 0 ? opts.blockOverhead : BLOCK_OVERHEAD;
    var line = opts.blockLine > 0 ? opts.blockLine : BLOCK_LINE;
    // A floor above the full height would turn the taper upside down.
    if (floor > full) floor = full;
    return {
      full: full,
      floor: floor,
      falloff: opts.falloff > 0 && opts.falloff < 1 ? opts.falloff : ROW_FALLOFF,
      overhead: overhead,
      line: line,
      // Whatever the caller asked for, a block is never shorter than one
      // line of title plus its chrome — below that it clips the only thing
      // on it, which looks like a rendering fault rather than a small block.
      minBlock: Math.max(
        opts.minBlock > 0 ? opts.minBlock : MIN_BLOCK,
        Math.ceil(overhead + line),
      ),
    };
  }

  // How many lines of title a block of this height can show without clipping
  // one in half. Always at least one: a block with no title at all is worse
  // than a tight one.
  function titleLines(height, size) {
    var fits = Math.floor((height - size.overhead) / size.line);
    return clamp(fits, 1, MAX_TITLE_LINES);
  }

  /* ---------- reading the time off an entry ----------------------------
   *
   * The time field is whatever the reader typed. Everything here has turned
   * up in a real agenda: '9:00 AM', '4:00–5:30 PM' (one meridiem, covering
   * both ends), '11:00–1:00 PM' (one meridiem, and the start is on the other
   * side of noon), '14:00', '17:30-19:00', 'Any time', ''.
   */

  function clockTokens(text) {
    var out = [];
    var re = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/gi;
    var m;
    while ((m = re.exec(text)) !== null) {
      if (m.index === re.lastIndex) re.lastIndex++;
      var h = parseInt(m[1], 10);
      var mm = m[2] ? parseInt(m[2], 10) : 0;
      if (!isFinite(h) || h > 23 || mm > 59) continue;
      var mer = m[3] ? m[3].toLowerCase().charAt(0) : null;   // 'a' | 'p' | null
      out.push({ h: h, m: mm, mer: mer });
      if (out.length >= 2) break;
    }
    return out;
  }

  function toMinutes(tok, inherit) {
    var h = tok.h;
    var mer = tok.mer || inherit;
    if (mer === 'a') { if (h === 12) h = 0; }
    else if (mer === 'p') { if (h !== 12) h += 12; }
    // No meridiem anywhere: read it as a 24-hour clock, which is what
    // '14:00' already is and what '9' may as well be.
    return h * 60 + tok.m;
  }

  // -> { start, end } in minutes from midnight, end null when it is a moment,
  //    or null when there is no time in the text at all ('Any time').
  function parseTimeRange(text) {
    if (typeof text !== 'string' || !/\d/.test(text)) return null;
    var toks = clockTokens(text);
    if (!toks.length) return null;
    if (toks.length === 1) return { start: toMinutes(toks[0], null), end: null };

    var end = toMinutes(toks[1], null);
    var start = toMinutes(toks[0], toks[1].mer);
    if (start >= end && !toks[0].mer && toks[1].mer) {
      // '11:00–1:00 PM': the start is before noon, not after it.
      var alt = toMinutes(toks[0], toks[1].mer === 'p' ? 'a' : 'p');
      if (alt < end) start = alt;
    }
    return { start: start, end: end > start ? end : null };
  }

  /* What an entry occupies on the grid, in minutes, clamped into the window.
   * `pinned` records that the real time fell outside 06:00–23:00 and the
   * block has been pulled to the edge — the label still says 11:59 PM. */
  function spanFor(item) {
    var range = parseTimeRange(item && item.time);
    if (!range) return null;

    var isPoint = !!POINT_TYPES[item.type] && range.end == null;
    var rawStart = range.start;
    var rawEnd = range.end != null ? range.end : rawStart + (isPoint ? POINT_SPAN : DEFAULT_BLOCK);

    var start = clamp(rawStart, WINDOW_START, WINDOW_END);
    var end = clamp(rawEnd, WINDOW_START, WINDOW_END);
    if (end <= start) {
      // Pinned against an edge: keep a sliver so it is still a target.
      if (start >= WINDOW_END) start = WINDOW_END - POINT_SPAN;
      end = start + POINT_SPAN;
    }
    return {
      start: start,
      end: end,
      point: isPoint,
      pinned: rawStart < WINDOW_START || rawStart > WINDOW_END,
    };
  }

  /* ---------- the scale ------------------------------------------------- */

  function hoursTouched(span) {
    var first = Math.floor(span.start / 60);
    var last = Math.ceil(span.end / 60) - 1;
    if (last < first) last = first;
    return { first: first, last: last };
  }

  // days: [{ items: [...] }] — one pass over the week to find which hours
  // hold anything at all, so all seven columns share one scale.
  function busyHoursFor(days) {
    var busy = {};
    (days || []).forEach(function (day) {
      ((day && day.items) || []).forEach(function (item) {
        var span = spanFor(item);
        if (!span) return;
        var range = hoursTouched(span);
        for (var h = range.first; h <= range.last; h++) busy[h] = true;
      });
    });
    return busy;
  }

  function rowHeight(distance, size) {
    if (distance <= 0) return size.full;
    return Math.round(size.floor + (size.full - size.floor) * Math.pow(size.falloff, distance));
  }

  function hourLabel(h) {
    var suffix = h < 12 ? 'am' : 'pm';
    var display = h % 12 === 0 ? 12 : h % 12;
    return display + ' ' + suffix;
  }

  function buildScale(busy, opts) {
    var size = sizes(opts);
    var hours = [];
    for (var h = START_HOUR; h < END_HOUR; h++) hours.push(h);

    var rows = [];
    var top = 0;
    hours.forEach(function (h) {
      // Distance to the nearest hour that holds something. With nothing in
      // the whole week every row sits on the floor, which is the right answer
      // — an empty week should be a short grid, not a tall one.
      var distance = Infinity;
      hours.forEach(function (other) {
        if (busy[other]) distance = Math.min(distance, Math.abs(other - h));
      });
      var height = rowHeight(distance === Infinity ? hours.length : distance, size);
      rows.push({
        hour: h,
        label: hourLabel(h),
        top: top,
        height: height,
        quiet: !busy[h],
        // How far this row is from full height, for the page to fade the
        // label and thin the line with.
        density: size.full === size.floor ? 1 : (height - size.floor) / (size.full - size.floor),
      });
      top += height;
    });

    function yFor(minutes) {
      var m = clamp(minutes, WINDOW_START, WINDOW_END);
      var idx = Math.floor(m / 60) - START_HOUR;
      if (idx < 0) return 0;
      if (idx >= rows.length) return top;
      var row = rows[idx];
      return row.top + ((m - row.hour * 60) / 60) * row.height;
    }

    return { rows: rows, height: top, yFor: yFor, size: size, minBlock: size.minBlock };
  }

  /* ---------- side by side when two things clash ------------------------ */

  // Lowest free lane per entry, and the lane count of the cluster it belongs
  // to, so two overlapping blocks each take half the column and three take a
  // third rather than every block in the day being narrowed by the worst case.
  function packLanes(blocks) {
    var sorted = blocks.slice().sort(function (a, b) {
      return a.span.start - b.span.start || a.span.end - b.span.end;
    });

    var cluster = [];
    var clusterEnd = -1;
    var laneEnds = [];

    function closeCluster() {
      var lanes = laneEnds.length || 1;
      cluster.forEach(function (b) { b.lanes = lanes; });
      cluster = [];
      laneEnds = [];
      clusterEnd = -1;
    }

    sorted.forEach(function (b) {
      if (clusterEnd >= 0 && b.span.start >= clusterEnd) closeCluster();
      var lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] > b.span.start) lane++;
      laneEnds[lane] = b.span.end;
      b.lane = lane;
      cluster.push(b);
      clusterEnd = Math.max(clusterEnd, b.span.end);
    });
    closeCluster();

    return sorted;
  }

  /* ---------- the free time between things ------------------------------ */

  function formatDuration(minutes) {
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    if (h && m) return h + 'h ' + m + 'm';
    if (h) return h + 'h';
    return m + 'm';
  }

  // The holes between what is booked — the point of the whole exercise is
  // being able to see these without doing the arithmetic yourself.
  function gapsFor(blocks, scale) {
    if (!blocks.length) return [];
    var merged = [];
    blocks.slice()
      .sort(function (a, b) { return a.span.start - b.span.start; })
      .forEach(function (b) {
        var last = merged[merged.length - 1];
        if (last && b.span.start <= last.end) last.end = Math.max(last.end, b.span.end);
        else merged.push({ start: b.span.start, end: b.span.end });
      });

    var gaps = [];
    for (var i = 0; i < merged.length - 1; i++) {
      var from = merged[i].end;
      var to = merged[i + 1].start;
      var length = to - from;
      if (length < GAP_MIN) continue;
      var top = scale.yFor(from);
      gaps.push({
        start: from,
        end: to,
        minutes: length,
        label: formatDuration(length) + ' free',
        top: top,
        height: scale.yFor(to) - top,
      });
    }
    return gaps;
  }

  /* ---------- the whole week -------------------------------------------- */

  // days: [{ ...anything, items: [...] }]
  // opts: { rowFull, rowFloor, falloff, minBlock } — all optional, for a
  // caller that wants the same clock drawn smaller.
  // Each day comes back with the same fields plus `timed`, `untimed` and
  // `gaps`; `rows` and `height` describe the shared scale the page draws.
  function layoutWeek(days, opts) {
    var scale = buildScale(busyHoursFor(days), opts);

    var laidOut = (days || []).map(function (day) {
      var timed = [];
      var untimed = [];

      ((day && day.items) || []).forEach(function (item) {
        var span = spanFor(item);
        if (!span) { untimed.push(item); return; }
        timed.push({ item: item, span: span });
      });

      packLanes(timed).forEach(function (b) {
        var top = scale.yFor(b.span.start);
        var height = Math.max(scale.minBlock, scale.yFor(b.span.end) - top);
        // A block against the bottom of the window — an 11:59pm deadline,
        // say — can be given a minimum height that reaches past the last
        // line. It moves up to sit on the edge rather than hanging off it.
        if (height > scale.height) height = scale.height;
        if (top + height > scale.height) top = scale.height - height;
        b.top = top;
        b.height = height;
        b.lines = titleLines(height, scale.size);
        b.point = b.span.point;
        b.pinned = b.span.pinned;
        b.widthPct = 100 / b.lanes;
        b.leftPct = (100 / b.lanes) * b.lane;
      });

      return Object.assign({}, day, {
        timed: timed.sort(function (a, b) { return a.span.start - b.span.start; }),
        untimed: untimed,
        gaps: gapsFor(timed, scale),
      });
    });

    return { rows: scale.rows, height: scale.height, yFor: scale.yFor, days: laidOut };
  }

  return {
    START_HOUR: START_HOUR,
    END_HOUR: END_HOUR,
    ROW_FULL: ROW_FULL,
    ROW_FLOOR: ROW_FLOOR,
    parseTimeRange: parseTimeRange,
    spanFor: spanFor,
    buildScale: buildScale,
    busyHoursFor: busyHoursFor,
    packLanes: packLanes,
    formatDuration: formatDuration,
    titleLines: titleLines,
    layoutWeek: layoutWeek,
    hourLabel: hourLabel,
  };
});
