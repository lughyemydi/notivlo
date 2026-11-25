// The only file in the guide that touches storage.
//
// Two things worth knowing before changing anything here.
//
// 1. The guide writes the app's OWN stores, in the app's own shapes — a
//    notebook made here is byte-identical to one made with Home's "New
//    notebook" button, and an agenda entry to one made in the Planner. The
//    shapes are mirrored rather than imported because the app has no shared
//    creation module to call: Home.dc.html and Planner.dc.html each build
//    their own records inline. If either shape changes, this file has to
//    follow. The test asserts the fields.
//
// 2. Home and the Planner seed example content on first open, and they do it
//    by writing their seed only when the key is ABSENT (see readStore in
//    Home.dc.html). So finishing the guide writes all three keys, even when
//    the reader added nothing — an empty list present beats an absent key,
//    and it is what stops a reader who has just named their own subjects
//    from landing on a shelf full of Organic Chemistry.
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.notivloSetupStore = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var KEYS = {
    notebooks: 'folio_notebooks_v1',
    agenda: 'folio_agenda_v2',
    studyMinutes: 'folio_study_minutes',
    chapterPrefix: 'folio_nb_state:',
    setup: 'folio_setup_v1',
    session: 'folio_session',
    shelfPick: 'notivlo_shelf_pick',
  };

  // Injectable only for the node test, which has no localStorage. In the
  // browser this is always the real thing.
  var injected = null;
  function ls() {
    if (injected) return injected;
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }
  function _useStorage(s) { injected = s; }

  function getRaw(key) {
    var s = ls();
    if (!s) return null;
    try { return s.getItem(key); } catch (e) { return null; }
  }
  function setRaw(key, value) {
    var s = ls();
    if (!s) return false;
    try { s.setItem(key, value); return true; } catch (e) { return false; }
  }
  function removeRaw(key) {
    var s = ls();
    if (!s) return;
    try { s.removeItem(key); } catch (e) {}
  }
  function has(key) { return getRaw(key) != null; }

  // Anything in storage is only as good as whatever last wrote it, so every
  // read falls back rather than throwing: a corrupt value is treated as
  // missing and left alone, never overwritten on sight.
  function readJson(key, fallback) {
    var raw = getRaw(key);
    if (raw == null) return fallback;
    try {
      var v = JSON.parse(raw);
      if (Array.isArray(fallback)) return Array.isArray(v) ? v : fallback;
      return v && typeof v === 'object' ? v : fallback;
    } catch (e) { return fallback; }
  }
  function writeJson(key, value) {
    try { return setRaw(key, JSON.stringify(value)); } catch (e) { return false; }
  }

  // --- dates ------------------------------------------------------------
  // Local dates throughout, never UTC: an agenda entry belongs to the day the
  // reader is living in, and new Date().toISOString() would move anything
  // after 11pm to tomorrow for anyone west of Greenwich.
  function pad2(n) { return String(n).padStart(2, '0'); }
  function toIso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseIso(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  function isValidIso(iso) { return !!parseIso(iso); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

  // --- whose guide this is ---------------------------------------------
  // The app's own signed-in marker, read and never written. The guide's
  // record is stamped with this address, because the record lives on the
  // device and accounts do not: without the stamp, the first person to finish
  // the guide on a device finished it for everyone who signs up there after.
  function session() {
    var s = readJson(KEYS.session, null);
    return s && !Array.isArray(s) ? s : {};
  }
  function sessionEmail() { return String(session().email || '').trim().toLowerCase(); }
  function sessionName() { return String(session().name || '').trim(); }

  // --- the guide's own state -------------------------------------------
  function blankState() {
    return {
      version: 1,
      account: '',            // the address this record belongs to
      goal: '',               // one of content.GOALS' ids, or '' when not said
      status: 'new',          // new | skipped | done
      step: 0,
      startedAt: null,
      finishedAt: null,
      subjects: [],           // what step 1 was left holding
      days: [1, 2, 3, 4, 5],  // getDay() numbers
      slot: 'after-school',
      fixed: [],              // [{ title, day, time }]
      due: null,              // { title, date }
      applied: false,         // true once the notebooks and agenda are written
      created: { notebooks: 0, blocks: 0, classes: 0, deadlines: 0 },
      checklistDismissed: false,
      inherited: [],          // slugs already on the device when this account was made
    };
  }

  function readState() {
    var s = readJson(KEYS.setup, null);
    if (!s) return blankState();
    var blank = blankState();
    // Somebody else's record. An unstamped one — written before records were
    // stamped — is taken to be the current account's, which is what it was.
    var owner = typeof s.account === 'string' ? s.account : '';
    var me = sessionEmail();
    if (owner && me && owner !== me) return blank;
    // Field by field, so a state written by an older or newer build — or by
    // hand — can never leave a missing array where the page expects one.
    return {
      version: 1,
      account: owner,
      goal: typeof s.goal === 'string' ? s.goal.slice(0, 40) : '',
      status: s.status === 'done' || s.status === 'skipped' ? s.status : 'new',
      step: typeof s.step === 'number' && s.step >= 0 && s.step <= 5 ? s.step : 0,
      startedAt: typeof s.startedAt === 'string' ? s.startedAt : null,
      finishedAt: typeof s.finishedAt === 'string' ? s.finishedAt : null,
      subjects: Array.isArray(s.subjects) ? s.subjects.filter(function (x) { return typeof x === 'string'; }) : [],
      days: Array.isArray(s.days) ? s.days.filter(function (n) { return typeof n === 'number' && n >= 0 && n <= 6; }) : blank.days,
      slot: typeof s.slot === 'string' ? s.slot : blank.slot,
      fixed: Array.isArray(s.fixed) ? s.fixed.filter(function (f) { return f && typeof f === 'object' && !Array.isArray(f); }) : [],
      due: s.due && typeof s.due === 'object' && !Array.isArray(s.due) ? s.due : null,
      applied: !!s.applied,
      created: s.created && typeof s.created === 'object' ? {
        notebooks: Number(s.created.notebooks) || 0,
        blocks: Number(s.created.blocks) || 0,
        classes: Number(s.created.classes) || 0,
        deadlines: Number(s.created.deadlines) || 0,
      } : blank.created,
      checklistDismissed: !!s.checklistDismissed,
      inherited: Array.isArray(s.inherited) ? s.inherited.filter(function (x) { return typeof x === 'string'; }) : [],
    };
  }

  function writeState(patch) {
    if (!patch) return readState();
    var next = readState();
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) next[k] = patch[k];
    var me = sessionEmail();
    if (me) next.account = me;
    writeJson(KEYS.setup, next);
    return next;
  }

  // Takes out the guide's own record and nothing else. Notebooks and agenda
  // entries it created are left behind on purpose: they are the reader's
  // work by then, not module data.
  function clearModule() { removeRaw(KEYS.setup); }

  // --- the landing page's shelf ---------------------------------------------
  // The public landing page lets a visitor pick their subjects and year before
  // they have an account, and leaves the answer here when they press "Make
  // these notebooks". Read once and removed on the spot, whatever happens to
  // it next, so it can never come back to a later account on this device.
  // localStorage rather than sessionStorage so it survives an email
  // confirmation link opening in a new tab.
  function takeShelfPick() {
    var raw = getRaw(KEYS.shelfPick);
    if (raw == null) return null;
    removeRaw(KEYS.shelfPick);
    try {
      var v = JSON.parse(raw);
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch (e) { return null; }
  }

  // --- notebooks --------------------------------------------------------
  function slugify(title) {
    return String(title || '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'notebook';
  }
  // Two notebooks with the same name would otherwise share a slug and open
  // the same page. Home suffixes duplicates the same way.
  function uniqueSlug(base, taken) {
    var slug = base, n = 2;
    while (taken.indexOf(slug) !== -1) slug = base + '-' + n++;
    return slug;
  }

  function readNotebooks() { return readJson(KEYS.notebooks, []); }
  function writeNotebooks(list) { return writeJson(KEYS.notebooks, list); }

  // The shape is Home's, from confirmAddNotebook: title, slug, minutesAgo,
  // done, total, userCreated, category — and nothing else. No chapter state
  // is written, which is also what Home does: a notebook with no stored
  // chapters opens on a ready "Chapter 1".
  function addNotebooks(titles, category) {
    var existing = readNotebooks();
    var taken = existing.map(function (nb) { return nb && nb.slug; });
    var made = [];
    (titles || []).forEach(function (raw) {
      var title = String(raw || '').trim().slice(0, 80);
      if (!title) return;
      var slug = uniqueSlug(slugify(title), taken);
      taken.push(slug);
      made.push({
        title: title,
        slug: slug,
        minutesAgo: 0,
        done: 0,
        total: 0,
        userCreated: true,
        category: category || 'School',
      });
    });
    if (!made.length) {
      // Still claim the key, so the example shelf cannot appear later.
      if (!has(KEYS.notebooks)) writeNotebooks(existing);
      return [];
    }
    var ok = writeNotebooks(existing.concat(made));
    return ok ? made : [];
  }

  // --- agenda -----------------------------------------------------------
  function readAgenda() { return readJson(KEYS.agenda, []); }
  function writeAgenda(list) { return writeJson(KEYS.agenda, list); }

  // The shape is the Planner's, from confirmAdd: id, date, title, type, time,
  // notebookSlug. Titles and times are clamped to the same lengths its inputs
  // carry, and the type is one the sync layer's allow-list knows — 'event' is
  // offered in the Planner but degrades to 'task' when it reaches the server,
  // so the guide never writes one.
  var TYPES = { class: 1, assignment: 1, study: 1, task: 1 };

  function addAgenda(entries) {
    var existing = readAgenda();
    var stamp = Date.now().toString(36);
    var made = [];
    (entries || []).forEach(function (e, i) {
      if (!e || !isValidIso(e.date)) return;
      var title = String(e.title || '').trim().slice(0, 120);
      if (!title) return;
      var item = {
        id: 'setup-' + stamp + '-' + i,
        date: e.date,
        title: title,
        type: TYPES[e.type] ? e.type : 'task',
        time: String(e.time || '').trim().slice(0, 20) || 'Any time',
        notebookSlug: e.notebookSlug || null,
      };
      if (e.nbCh != null) item.nbCh = e.nbCh;
      made.push(item);
    });
    if (!made.length) {
      if (!has(KEYS.agenda)) writeAgenda(existing);
      return [];
    }
    var ok = writeAgenda(existing.concat(made));
    return ok ? made : [];
  }

  // --- the seed, and keeping it away ------------------------------------
  // Called when the guide finishes either way. Any of the three stores the
  // app would seed on first open and that is still absent gets an empty one,
  // so the reader's app is the one they just described rather than the
  // example it ships with. A key that already holds something is never
  // touched.
  function claimStores() {
    var claimed = [];
    if (!has(KEYS.notebooks)) { writeNotebooks([]); claimed.push(KEYS.notebooks); }
    if (!has(KEYS.agenda)) { writeAgenda([]); claimed.push(KEYS.agenda); }
    if (!has(KEYS.studyMinutes)) { writeJson(KEYS.studyMinutes, {}); claimed.push(KEYS.studyMinutes); }
    return claimed;
  }

  // True once any of them has been written — by the guide, by the app's own
  // seed, or by a reader who has been using notivlo since before the guide
  // existed. That last case is the one that matters: it is how an existing
  // account avoids being shown a first-run guide.
  function hasAppData() {
    return has(KEYS.notebooks) || has(KEYS.agenda) || has(KEYS.studyMinutes);
  }

  // --- what the reader has actually done --------------------------------
  // Read-only, and derived from the app's own stores rather than from
  // anything the guide records, so the getting-started card cannot claim a
  // step the reader has not taken.
  function chapterText(slug) {
    var st = readJson(KEYS.chapterPrefix + slug, null);
    if (!st || !Array.isArray(st.chapters)) return '';
    var out = [];
    st.chapters.forEach(function (c) {
      if (!c || typeof c !== 'object') return;
      if (typeof c.contentHtml === 'string') out.push(c.contentHtml.replace(/<[^>]*>/g, ' '));
      if (Array.isArray(c.paragraphs)) out.push(c.paragraphs.join(' '));
      if (Array.isArray(c.notes)) {
        c.notes.forEach(function (n) { if (n && typeof n.text === 'string') out.push(n.text); });
      }
    });
    return out.join(' ').replace(/\s+/g, ' ').trim();
  }

  function progress() {
    var notebooks = readNotebooks();
    var agenda = readAgenda();
    var wrote = false;
    for (var i = 0; i < notebooks.length && !wrote; i++) {
      var nb = notebooks[i];
      if (nb && nb.slug && chapterText(nb.slug)) wrote = true;
    }
    return {
      notebook: notebooks.length > 0,
      write: wrote,
      plan: agenda.length > 0,
      tick: agenda.some(function (it) { return it && it.done; }),
      notebookCount: notebooks.length,
      agendaCount: agenda.length,
    };
  }

  return {
    KEYS: KEYS,
    TYPES: TYPES,
    blankState: blankState,
    readState: readState,
    writeState: writeState,
    clearModule: clearModule,
    sessionEmail: sessionEmail,
    sessionName: sessionName,
    slugify: slugify,
    uniqueSlug: uniqueSlug,
    readNotebooks: readNotebooks,
    writeNotebooks: writeNotebooks,
    addNotebooks: addNotebooks,
    readAgenda: readAgenda,
    writeAgenda: writeAgenda,
    addAgenda: addAgenda,
    claimStores: claimStores,
    hasAppData: hasAppData,
    progress: progress,
    chapterText: chapterText,
    // dates, shared with the service
    pad2: pad2,
    toIso: toIso,
    parseIso: parseIso,
    isValidIso: isValidIso,
    addDays: addDays,
    today: today,
    takeShelfPick: takeShelfPick,
    _useStorage: _useStorage,
  };
}));
