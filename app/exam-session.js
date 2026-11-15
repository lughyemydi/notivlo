/* A test being sat.
 *
 * This file owns the part of the feature that has to be true even when the
 * page is not running: a student who starts a 75-minute paper, closes the lid
 * and comes back an hour later has 15 minutes left, not 75. Nothing here
 * draws anything — Notebook.dc.html does that — and nothing here decides what
 * the questions are, which is exam-bank.js. This is the clock and the ledger.
 *
 * ---------------------------------------------------------------------------
 * Why the timer is a timestamp and not a countdown
 *
 * The obvious implementation is setInterval and a number that goes down. It is
 * also wrong, in a way that only shows up in the case the feature exists for:
 * an interval stops when the app is closed, throttles when the window is in
 * the background, and drifts. A student could pause a timed paper by switching
 * away from it, which would make the timer theatre.
 *
 * So the only thing stored is when the paper started, in wall-clock time.
 * Remaining time is always computed from Date.now(), the interval in the page
 * exists only to repaint, and closing the app does not buy a single second.
 * The cost is that changing the system clock changes the timer; that is a
 * trade worth making, and it is a far stranger thing to do than closing a lid.
 *
 * ---------------------------------------------------------------------------
 * What the lock can and cannot do
 *
 * Worth being plain about, since the feature was asked for as "the student
 * cannot access the app while he is doing his test". Within the app, that is
 * enforceable and enforced: while a sitting is active every page load lands on
 * the lock surface, because the sitting lives in localStorage rather than in
 * the page. Reloading, navigating to another notebook or quitting and
 * reopening all come back to the same locked paper with the clock still
 * running.
 *
 * Outside the app it is not enforceable at all. A page cannot stop someone
 * opening a browser, picking up a phone, or quitting the app and leaving it
 * quit. Pretending otherwise would be worse than the gap, so instead the time
 * spent away from the app is recorded and shown on the marking screen. The
 * honesty is the student's; the record is the app's.
 *
 * There is also a deliberate way out. A lock with no exit is a trap, and a
 * student with a real reason to stop must be able to — so abandoning is
 * offered, costs a confirmation, and is written down as abandoned rather than
 * quietly forgotten.
 *
 * ---------------------------------------------------------------------------
 * Storage
 *
 *   folio_exam_sitting_v1    the one paper currently being sat, or absent
 *   folio_exam_results_v1    { "<slug>": [ result, ... ] }
 *   folio_exam_schedule_v1   { cadence, last: { "<slug>": "YYYY-MM-DD" } }
 *
 * None of these are in supabase-sync.js's allow-list, so they stay on the
 * device — the same bargain folio_recall_v1 makes, and for the same reason:
 * what a student got wrong on a Tuesday is theirs, and syncing it buys them
 * nothing they asked for. The one thing that does leave is the agenda item for
 * a due mock, because the agenda is already synced and a deadline the student
 * cannot see on their other device is not much of a deadline.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  var SITTING_KEY  = 'folio_exam_sitting_v1';
  var RESULTS_KEY  = 'folio_exam_results_v1';
  var SCHEDULE_KEY = 'folio_exam_schedule_v1';
  var AGENDA_KEY   = 'folio_agenda_v2';

  var RESULTS_PER_NOTEBOOK = 40;   // a bound on what one notebook can store
  var DEFAULT_CADENCE = 'monthly';

  // Matches Home.dc.html and Planner.dc.html, which share these stores.
  function pad2(n) { return String(n).padStart(2, '0'); }
  function toISODate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayISO() { return toISODate(new Date()); }
  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      var val = JSON.parse(raw);
      return val == null ? fallback : val;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }

  /* ---- the sitting ------------------------------------------------------
     Shape is checked on every read rather than trusted. What is in
     localStorage is only as good as whatever last wrote it, and the thing a
     malformed sitting would do is lock a student out of their own notebook —
     so anything that is not a well-formed sitting is treated as no sitting at
     all, which fails open. */
  var STAGES = { printing: 1, sitting: 1, marking: 1 };

  function normalizeSitting(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.slug || !raw.paperId || !STAGES[raw.stage]) return null;
    var minutes = Number(raw.minutes);
    if (!isFinite(minutes) || minutes <= 0) return null;
    var startedAt = raw.startedAt == null ? null : Number(raw.startedAt);
    if (startedAt != null && (!isFinite(startedAt) || startedAt <= 0)) return null;
    // A sitting past its stage without a start time is incoherent; drop it.
    if (raw.stage !== 'printing' && startedAt == null) return null;
    return {
      v: 1,
      slug: String(raw.slug),
      paperId: String(raw.paperId),
      stage: raw.stage,
      minutes: minutes,
      startedAt: startedAt,
      endedAt: raw.endedAt == null ? null : Number(raw.endedAt) || null,
      away: Array.isArray(raw.away) ? raw.away.filter(function (a) {
        return a && isFinite(Number(a.from)) && isFinite(Number(a.to)) && Number(a.to) >= Number(a.from);
      }) : [],
      marks: (raw.marks && typeof raw.marks === 'object') ? raw.marks : {},
      overran: !!raw.overran,
    };
  }

  function readSitting() { return normalizeSitting(readJSON(SITTING_KEY, null)); }
  function writeSitting(s) { return writeJSON(SITTING_KEY, s); }
  function clearSitting() { try { localStorage.removeItem(SITTING_KEY); } catch (e) {} }

  /* ---- the schedule -----------------------------------------------------
     "Every week or month the student has to do a full test." Due is derived
     from the date of the last full paper rather than stored as a flag, so it
     cannot get stuck on or off, and so a student who sits a mock early simply
     resets the clock. */
  function readSchedule() {
    var raw = readJSON(SCHEDULE_KEY, null) || {};
    var cadence = raw.cadence === 'weekly' ? 'weekly' : DEFAULT_CADENCE;
    return { cadence: cadence, last: (raw.last && typeof raw.last === 'object') ? raw.last : {} };
  }
  function writeSchedule(s) { return writeJSON(SCHEDULE_KEY, s); }

  function cadenceDays(cadence) { return cadence === 'weekly' ? 7 : 30; }

  /* Returns { due, cadence, lastISO, daysSince, daysUntil }.
   *
   * A notebook that has never had a mock is due immediately. That is
   * deliberate: the alternative is a feature that stays silent for a month
   * after being switched on, and a student who has never sat one is exactly
   * who should. */
  function mockStatus(slug) {
    var sched = readSchedule();
    var period = cadenceDays(sched.cadence);
    var lastISO = sched.last[slug] || null;
    var last = parseISO(lastISO);
    if (!last) {
      return { due: true, cadence: sched.cadence, lastISO: null, daysSince: null, daysUntil: 0, never: true };
    }
    var days = daysBetween(last, parseISO(todayISO()));
    return {
      due: days >= period,
      cadence: sched.cadence,
      lastISO: lastISO,
      daysSince: days,
      daysUntil: Math.max(0, period - days),
      never: false,
    };
  }

  function markMockSat(slug) {
    var sched = readSchedule();
    sched.last[slug] = todayISO();
    writeSchedule(sched);
    clearMockAgenda(slug);
  }

  function setCadence(cadence) {
    var sched = readSchedule();
    sched.cadence = cadence === 'weekly' ? 'weekly' : 'monthly';
    writeSchedule(sched);
    return sched.cadence;
  }

  /* ---- the agenda item for a due mock -----------------------------------
     The agenda is the one store this feature writes that is shared with the
     rest of the app, so it is touched as little as possible: one item per
     notebook, a deterministic id so repeated calls cannot pile up duplicates,
     and other items never read for anything or rewritten. If the store holds
     something that is not a list, it is left exactly as it is — Home owns that
     data and is better placed to complain about it. */
  function mockAgendaId(slug) { return 'mock-' + slug; }

  function ensureMockAgenda(slug, notebookTitle, subjectName) {
    var items = readJSON(AGENDA_KEY, null);
    if (!Array.isArray(items)) return false;
    var id = mockAgendaId(slug);
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].id === id) return false;   // already there
    }
    items.push({
      id: id,
      date: todayISO(),
      type: 'assignment',
      title: 'Full mock due — ' + (subjectName || notebookTitle || 'notebook'),
      time: 'Any time',
      done: false,
      notebookSlug: slug,
    });
    return writeJSON(AGENDA_KEY, items);
  }

  function clearMockAgenda(slug) {
    var items = readJSON(AGENDA_KEY, null);
    if (!Array.isArray(items)) return false;
    var id = mockAgendaId(slug);
    var kept = items.filter(function (it) { return !(it && it.id === id); });
    if (kept.length === items.length) return false;
    return writeJSON(AGENDA_KEY, kept);
  }

  /* ---- results ---------------------------------------------------------- */
  function readResults(slug) {
    var all = readJSON(RESULTS_KEY, null) || {};
    var list = all[slug];
    return Array.isArray(list) ? list : [];
  }

  function saveResult(slug, result) {
    var all = readJSON(RESULTS_KEY, null) || {};
    if (typeof all !== 'object') all = {};
    var list = Array.isArray(all[slug]) ? all[slug] : [];
    list.unshift(result);                        // newest first
    all[slug] = list.slice(0, RESULTS_PER_NOTEBOOK);
    writeJSON(RESULTS_KEY, all);
    return all[slug];
  }

  /* ---- time ------------------------------------------------------------- */
  function allowedMs(sitting) { return sitting.minutes * 60000; }

  function elapsedMs(sitting, now) {
    if (!sitting || !sitting.startedAt) return 0;
    var end = sitting.endedAt || (now == null ? Date.now() : now);
    return Math.max(0, end - sitting.startedAt);
  }

  function remainingMs(sitting, now) {
    if (!sitting || !sitting.startedAt) return allowedMs(sitting || { minutes: 0 });
    return allowedMs(sitting) - elapsedMs(sitting, now);
  }

  function formatClock(ms) {
    var neg = ms < 0;
    var total = Math.floor(Math.abs(ms) / 1000);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var out = h > 0 ? (h + ':' + pad2(m) + ':' + pad2(s)) : (m + ':' + pad2(s));
    return (neg ? '−' : '') + out;
  }

  function awaySeconds(sitting) {
    if (!sitting || !Array.isArray(sitting.away)) return 0;
    return Math.round(sitting.away.reduce(function (acc, a) {
      return acc + Math.max(0, Number(a.to) - Number(a.from));
    }, 0) / 1000);
  }

  /* ---- lifecycle -------------------------------------------------------- */

  // Printing comes before the clock. A student needs the paper in their hand
  // before any time is spent, so starting a test and starting the timer are
  // two separate acts and the gap between them is free.
  function beginPrinting(slug, paper) {
    var sitting = {
      v: 1, slug: slug, paperId: paper.id, stage: 'printing',
      minutes: paper.minutes, startedAt: null, endedAt: null,
      away: [], marks: {}, overran: false,
    };
    writeSitting(sitting);
    return sitting;
  }

  function startClock() {
    var sitting = readSitting();
    if (!sitting || sitting.stage !== 'printing') return sitting;
    sitting.stage = 'sitting';
    sitting.startedAt = Date.now();
    writeSitting(sitting);
    return sitting;
  }

  // Called when the student says they are finished, and also when the clock
  // runs out. `overran` distinguishes the two, because finishing a paper in
  // time and being stopped by the clock are different facts about the sitting
  // and both belong in the record.
  function finishSitting() {
    var sitting = readSitting();
    if (!sitting || sitting.stage !== 'sitting') return sitting;
    var now = Date.now();
    sitting.endedAt = now;
    sitting.overran = (now - sitting.startedAt) > allowedMs(sitting);
    sitting.stage = 'marking';
    writeSitting(sitting);
    return sitting;
  }

  function recordAway(from, to) {
    var sitting = readSitting();
    if (!sitting || sitting.stage !== 'sitting') return;
    // Under three seconds is a click through a dialog, not a trip to the
    // kitchen. Logging those would turn an honest record into noise.
    if (to - from < 3000) return;
    sitting.away.push({ from: from, to: to });
    if (sitting.away.length > 200) sitting.away = sitting.away.slice(-200);
    writeSitting(sitting);
  }

  function setMark(key, value) {
    var sitting = readSitting();
    if (!sitting || sitting.stage !== 'marking') return sitting;
    if (value == null) delete sitting.marks[key];
    else sitting.marks[key] = value;
    writeSitting(sitting);
    return sitting;
  }

  function abandonSitting(reasonIsTimeout) {
    var sitting = readSitting();
    clearSitting();
    return sitting ? { slug: sitting.slug, paperId: sitting.paperId, timeout: !!reasonIsTimeout } : null;
  }

  window.notivloExam = {
    // state
    readSitting: readSitting,
    beginPrinting: beginPrinting,
    startClock: startClock,
    finishSitting: finishSitting,
    abandonSitting: abandonSitting,
    clearSitting: clearSitting,
    setMark: setMark,
    recordAway: recordAway,

    // time
    allowedMs: allowedMs,
    elapsedMs: elapsedMs,
    remainingMs: remainingMs,
    formatClock: formatClock,
    awaySeconds: awaySeconds,

    // results
    readResults: readResults,
    saveResult: saveResult,

    // the mock schedule
    mockStatus: mockStatus,
    markMockSat: markMockSat,
    setCadence: setCadence,
    readSchedule: readSchedule,
    ensureMockAgenda: ensureMockAgenda,
    clearMockAgenda: clearMockAgenda,

    // exposed for the date helpers the page shares with Home/Planner
    todayISO: todayISO,
  };
})();
