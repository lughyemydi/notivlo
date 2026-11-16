// The guide's single door. Setup.dc.html, Home.dc.html, Welcome.dc.html and
// SignUp.dc.html talk to this and nothing else — no page reads a storage key or builds a
// record of its own, so the shapes the app depends on are all written in one
// place (setup-store.js) and decided in one place (here).
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./setup-store.js'), require('./setup-content.js'));
  } else {
    root.notivloSetup = factory(root.notivloSetupStore, root.notivloSetupContent);
  }
}(typeof window !== 'undefined' ? window : this, function (store, content) {
  'use strict';

  // The steps, by name, so no page counts on its fingers. The rail shows the
  // four in the middle; the offer before them and the summary after are not
  // steps the reader is asked to do anything in.
  var STEPS = { INTRO: 0, GOAL: 1, SUBJECTS: 2, WEEK: 3, LOOK: 4, DONE: 5 };
  var LAST_STEP = STEPS.DONE;

  function flagOn() {
    try {
      return !(typeof window !== 'undefined' && window.notivloSetupFlag) ||
        window.notivloSetupFlag.enabled();
    } catch (e) { return true; }
  }

  // --- reading ----------------------------------------------------------
  function state() { return store.readState(); }

  // Welcome, Sign in and Home all ask this to decide where a signed-in
  // reader goes. The answer is yes for an account that has neither finished
  // nor skipped the guide AND has no notebooks: the second half is what
  // leaves alone an account that was using notivlo before the guide existed,
  // or one whose notebooks have just come down from another device.
  function shouldOffer() {
    if (!flagOn()) return false;
    var s = store.readState();
    if (s.status !== 'new') return false;
    return store.readNotebooks().length === 0;
  }

  // Sign up calls this the moment an account is created. A new account has
  // by definition not been through the guide, whatever the last person to
  // use this device did.
  function startFresh() {
    if (!flagOn()) return;
    store.clearModule();
  }

  function isDone() {
    var s = store.readState();
    return s.status === 'done' || s.status === 'skipped';
  }

  // --- the steps --------------------------------------------------------
  function begin() {
    var s = store.readState();
    return store.writeState({
      step: 1,
      startedAt: s.startedAt || new Date().toISOString(),
    });
  }

  function goTo(step) {
    var n = Math.max(0, Math.min(LAST_STEP, Number(step) || 0));
    return store.writeState({ step: n });
  }

  function goalById(id) {
    var found = null;
    content.GOALS.forEach(function (g) { if (g.id === id) found = g; });
    return found;
  }

  // '' is an answer too: the question is optional, and tapping the chosen
  // goal again takes it back.
  function setGoal(id) {
    return store.writeState({ goal: goalById(id) ? id : '' });
  }

  // The chosen goal's entry from content.GOALS, or null.
  function goal() { return goalById(store.readState().goal); }

  // The study techniques with the one that suits the goal moved to the
  // front and marked. Nothing is added or removed, only reordered.
  function techniques() {
    var g = goal();
    var list = content.TECHNIQUES.map(function (t) {
      return { id: t.id, title: t.title, body: t.body, lead: !!(g && g.technique === t.id) };
    });
    return list.filter(function (t) { return t.lead; })
      .concat(list.filter(function (t) { return !t.lead; }));
  }

  // The first notebook the guide made, for the "open it" button on the last
  // screen. Looked up on the shelf rather than remembered, so a notebook
  // deleted in the meantime is not offered.
  function firstNotebook() {
    var s = store.readState();
    if (!s.applied || !s.subjects.length) return null;
    var want = s.subjects[0].toLowerCase();
    var found = null;
    store.readNotebooks().forEach(function (nb) {
      if (!found && nb && nb.userCreated && String(nb.title || '').toLowerCase() === want) found = nb;
    });
    return found;
  }

  function setSubjects(list) {
    var clean = [];
    (list || []).forEach(function (raw) {
      var t = String(raw || '').trim().slice(0, 80);
      // Case-insensitively unique: two notebooks called "Maths" and "maths"
      // would be two notebooks, which is never what was meant.
      if (!t) return;
      var seen = clean.some(function (x) { return x.toLowerCase() === t.toLowerCase(); });
      if (!seen) clean.push(t);
    });
    return store.writeState({ subjects: clean });
  }

  function setDays(days) {
    var clean = (days || [])
      .map(Number)
      .filter(function (n) { return n >= 0 && n <= 6; })
      .filter(function (n, i, a) { return a.indexOf(n) === i; })
      .sort();
    return store.writeState({ days: clean });
  }

  function setSlot(id) {
    var known = content.SLOTS.some(function (s) { return s.id === id; });
    return store.writeState({ slot: known ? id : content.SLOTS[0].id });
  }

  function addFixed(entry) {
    var title = String((entry && entry.title) || '').trim().slice(0, 120);
    if (!title) return null;
    var day = Number(entry && entry.day);
    if (!(day >= 0 && day <= 6)) return null;
    var s = store.readState();
    if (s.fixed.length >= 12) return null;   // a week, not a timetable import
    var next = s.fixed.concat([{
      title: title,
      day: day,
      time: String((entry && entry.time) || '').trim().slice(0, 20),
    }]);
    return store.writeState({ fixed: next });
  }

  function removeFixed(index) {
    var s = store.readState();
    return store.writeState({
      fixed: s.fixed.filter(function (_, i) { return i !== index; }),
    });
  }

  function setDue(entry) {
    if (!entry) return store.writeState({ due: null });
    var title = String(entry.title || '').trim().slice(0, 120);
    if (!title || !store.isValidIso(entry.date)) return store.writeState({ due: null });
    return store.writeState({ due: { title: title, date: entry.date } });
  }

  // --- the plan ---------------------------------------------------------
  // Pure: same arguments in, same entries out, no clock and no storage. The
  // caller passes today's date, which is what makes this testable.
  //
  // The agenda has no repeating entry, so a "weekly" study slot is written as
  // one entry per matching day across the window. The UI counts them out loud
  // before this is called, because a fortnight of blocks appearing unannounced
  // in someone's week would be a surprise, not a feature.
  function planEntries(opts) {
    var o = opts || {};
    var start = store.parseIso(o.todayIso);
    if (!start) return [];
    var weeks = Math.max(1, Math.min(8, Number(o.weeks) || content.WEEKS_AHEAD));
    var days = (o.days || []).slice();
    var notebooks = o.notebooks || [];
    var entries = [];

    var slot = null;
    content.SLOTS.forEach(function (s) { if (s.id === o.slot) slot = s; });
    if (!slot) slot = content.SLOTS[0];

    var span = weeks * 7;
    var turn = 0;

    for (var i = 0; i < span; i++) {
      var d = store.addDays(start, i);
      var iso = store.toIso(d);
      var dow = d.getDay();

      if (days.indexOf(dow) !== -1) {
        // Each block points at one notebook, taken in turn, so a fortnight
        // covers every subject rather than hammering the first one. With no
        // notebooks at all it is still a block — just an unlinked one.
        var nb = notebooks.length ? notebooks[turn % notebooks.length] : null;
        turn++;
        entries.push({
          date: iso,
          type: 'study',
          title: nb ? 'Study block — ' + nb.title : 'Study block',
          time: slot.time,
          notebookSlug: nb ? nb.slug : null,
          nbCh: nb ? 0 : null,
          kind: 'block',
        });
      }

      (o.fixed || []).forEach(function (f) {
        if (!f || Number(f.day) !== dow) return;
        entries.push({
          date: iso,
          type: 'class',
          title: f.title,
          time: f.time || 'Any time',
          notebookSlug: null,
          kind: 'class',
        });
      });
    }

    if (o.due && store.isValidIso(o.due.date)) {
      entries.push({
        date: o.due.date,
        type: 'assignment',
        title: o.due.title,
        time: 'Any time',
        notebookSlug: null,
        kind: 'deadline',
      });
    }

    return entries;
  }

  // What step 2 shows before it writes anything.
  function preview() {
    var s = store.readState();
    var entries = planEntries({
      todayIso: store.toIso(store.today()),
      days: s.days,
      slot: s.slot,
      weeks: content.WEEKS_AHEAD,
      notebooks: s.subjects.map(function (t) { return { title: t, slug: store.slugify(t) }; }),
      fixed: s.fixed,
      due: s.due,
    });
    var count = function (kind) {
      return entries.filter(function (e) { return e.kind === kind; }).length;
    };
    return {
      notebooks: s.subjects.length,
      blocks: count('block'),
      classes: count('class'),
      deadlines: count('deadline'),
      total: entries.length,
      weeks: content.WEEKS_AHEAD,
    };
  }

  // Writes the notebooks and the agenda. Writes once: coming back to the week
  // step and going forward again must not double everything, so the state
  // carries a flag and this returns the counts it recorded the first time.
  function apply() {
    var s = store.readState();
    if (s.applied) return s.created;

    // Nothing chosen means the stores are not touched at all — not even
    // claimed — so "Skip setup" from here still leaves the examples it
    // promises.
    var made = s.subjects.length ? store.addNotebooks(s.subjects, 'School') : [];
    var entries = planEntries({
      todayIso: store.toIso(store.today()),
      days: s.days,
      slot: s.slot,
      weeks: content.WEEKS_AHEAD,
      notebooks: made,
      fixed: s.fixed,
      due: s.due,
    });
    var written = entries.length ? store.addAgenda(entries) : [];

    var tally = function (kind) {
      // Matched on the draft list, not the written one: addAgenda drops the
      // `kind` field, which is the guide's bookkeeping and not part of the
      // app's agenda shape.
      return entries.filter(function (e) { return e.kind === kind; }).length;
    };
    var created = {
      notebooks: made.length,
      blocks: written.length ? tally('block') : 0,
      classes: written.length ? tally('class') : 0,
      deadlines: written.length ? tally('deadline') : 0,
    };
    // Only something actually written closes the door behind it. Someone who
    // skipped both steps — or whose write failed — has made nothing, and must
    // still be able to go back and pick subjects after all.
    var wrote = made.length > 0 || written.length > 0;
    if (wrote) {
      // Claimed now, not at the end: someone who closes the app on the tour
      // comes back to Home with their notebooks, and a store still absent
      // then would be filled with the examples alongside them.
      store.claimStores();
    }
    store.writeState({ applied: wrote, created: created });
    return created;
  }

  // Finishing. Completing claims the three stores the app would otherwise
  // seed with examples; skipping does not, because a skip is a reader asking
  // for the examples.
  function complete() {
    store.claimStores();
    return store.writeState({
      status: 'done',
      step: LAST_STEP,
      finishedAt: new Date().toISOString(),
    });
  }

  function skip() {
    return store.writeState({
      status: 'skipped',
      finishedAt: new Date().toISOString(),
    });
  }

  // --- the getting-started card ----------------------------------------
  function checklist() {
    var p = store.progress();
    var items = content.CHECKLIST.map(function (item) {
      return {
        id: item.id,
        label: item.label,
        hint: item.hint,
        href: item.href,
        done: !!p[item.id],
      };
    });
    var doneCount = items.filter(function (i) { return i.done; }).length;
    return {
      items: items,
      done: doneCount,
      total: items.length,
      allDone: doneCount === items.length,
      progress: p,
    };
  }

  // Home asks this. It is not shown to an account that has never met the
  // guide, and it retires itself once every item is ticked.
  function showChecklist() {
    if (!flagOn()) return false;
    var s = store.readState();
    // Someone who made their notebooks and then closed the tab before the
    // last screen has met the guide as surely as someone who finished it.
    if (s.status === 'new' && !s.applied) return false;
    if (s.checklistDismissed) return false;
    return !checklist().allDone;
  }

  function dismissChecklist() { return store.writeState({ checklistDismissed: true }); }

  return {
    LAST_STEP: LAST_STEP,
    STEPS: STEPS,
    startFresh: startFresh,
    setGoal: setGoal,
    goal: goal,
    techniques: techniques,
    firstNotebook: firstNotebook,
    content: content,
    store: store,
    state: state,
    shouldOffer: shouldOffer,
    isDone: isDone,
    begin: begin,
    goTo: goTo,
    setSubjects: setSubjects,
    setDays: setDays,
    setSlot: setSlot,
    addFixed: addFixed,
    removeFixed: removeFixed,
    setDue: setDue,
    planEntries: planEntries,
    preview: preview,
    apply: apply,
    complete: complete,
    skip: skip,
    checklist: checklist,
    showChecklist: showChecklist,
    dismissChecklist: dismissChecklist,
  };
}));
