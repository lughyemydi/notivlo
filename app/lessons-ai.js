/* Lessons written to order.
 *
 * This fills the one seam lessons.js leaves open. With it loaded and a backend
 * configured, a notebook can ask for a lesson on something the written bank
 * does not cover, or one aimed at what the student has been getting wrong.
 * Without it — or with no backend, or signed out, or offline — nothing
 * changes: lessons.js keeps `generate` null and the notebook offers the bank.
 *
 * No key lives here. This file ships inside the app, so anything in it can be
 * read out of it; the model key is a secret of the Edge Function, which checks
 * the caller is signed in before it spends anything. See
 * supabase/functions/generate-lesson/index.ts.
 *
 * ---------------------------------------------------------------------------
 * What it sends
 *
 * The subject and syllabus code, which lessons the student has already sat,
 * and — this is the part worth the round trip — what they lost marks on. Both
 * of those the app already knows: `folio_lessons_v1` holds the score of every
 * sitting, and `folio_recall_v1` holds how many times each card has been
 * missed. Nothing else goes: not the student's name, not their email, not a
 * line of what they have written in their notebooks.
 *
 * ---------------------------------------------------------------------------
 * What it costs
 *
 * One lesson credit. This is the only part of notivlo that is not free, and
 * the reasoning is in supabase/PAID-TIER.md: everything else costs nothing per
 * use and works with no backend, while this spends a real model call per
 * lesson. billing.js holds the balance; the server holds the one that counts,
 * and checks it in a locked transaction on every call. When there is nothing
 * left, the function answers 402 with a sentence written for a student, and
 * that sentence is what the notebook shows.
 *
 * `generate` is still set when a signed-in student has no credits, on purpose.
 * Setting it to null would make the notebook hide the whole panel, and a
 * student who cannot see a feature cannot decide whether to pay for it. The
 * notebook asks billing.js separately whether the button should be a button or
 * an explanation — see `lessonCanMake` and `lessonHasCredits` in
 * Notebook.dc.html.
 *
 * ---------------------------------------------------------------------------
 * What comes back
 *
 * A lesson in the shape lessons.js documents, already checked by the function.
 * It is checked again here, because the page is what renders it, and a lesson
 * can arrive from a cache or an older deployment. A lesson that fails is
 * dropped with a reason in the console and the notebook falls back to the
 * bank — the student is told it could not be written, not handed something
 * they would mark themselves against wrongly.
 */
(function () {
  'use strict';

  var PATH = '/functions/v1/generate-lesson';

  // A generated lesson is kept for the session that asked for it, so stepping
  // back to the lesson list and into it again does not pay for it twice. Not
  // stored: it has not been sat yet, and a lesson nobody opened is not worth
  // the space in a store the sync layer would then have to carry.
  var made = {};

  function api() { return window.notivloLessons || null; }

  function ready() {
    var sb = window.notivloSupabase;
    return !!(api() && sb && sb.ready() && sb.isSignedIn());
  }

  /* ---- What the student has been getting wrong ------------------------- */

  // Recall keeps its misses as { <slug>: { "<kind>|<label>": count } }, where
  // the label is the term or chapter title the card asked about. The ones
  // missed more than once are the plainest statement of where a student is
  // weak that this app holds, and they cost nothing to read.
  function weakFromRecall(slug, limit) {
    var out = [];
    if (!slug) return out;
    try {
      var all = JSON.parse(localStorage.getItem('folio_recall_v1')) || {};
      var book = all && typeof all === 'object' ? all[slug] : null;
      if (!book || typeof book !== 'object') return out;
      Object.keys(book).forEach(function (key) {
        var count = book[key];
        if (typeof count !== 'number' || count < 2) return;
        var label = String(key).slice(String(key).indexOf('|') + 1).trim();
        if (label.length > 3) out.push({ label: label, count: count });
      });
    } catch (e) { return out; }
    out.sort(function (a, b) { return b.count - a.count; });
    return out.slice(0, limit || 6).map(function (x) { return x.label; });
  }

  // A sitting scored well under its total says the topic did not land, which
  // is worth telling the next lesson even when Recall has nothing.
  function weakFromSittings(limit) {
    var out = [];
    try {
      var all = api().readProgress();
      Object.keys(all).forEach(function (id) {
        var rec = all[id];
        if (!rec || !rec.marks) return;
        if (rec.score / rec.marks >= 0.7) return;
        var lesson = api().byId(id);
        if (lesson) out.push(lesson.title + ' (scored ' + rec.score + ' of ' + rec.marks + ')');
      });
    } catch (e) { return out; }
    return out.slice(0, limit || 4);
  }

  function alreadySat(subject) {
    var out = [];
    try {
      var all = api().readProgress();
      Object.keys(all).forEach(function (id) {
        var lesson = api().byId(id);
        if (lesson && (!subject || lesson.subject === subject)) out.push(lesson.title);
      });
      // A lesson generated earlier this session is not in the bank, so byId
      // does not know it; its title still belongs in "do not repeat these".
      Object.keys(made).forEach(function (k) {
        if (made[k] && made[k].title) out.push(made[k].title);
      });
    } catch (e) { return out; }
    return out.slice(0, 12);
  }

  /* ---- The call -------------------------------------------------------- */

  function generate(request) {
    var req = request || {};
    if (!ready()) return Promise.resolve(null);

    var slug = req.slug || '';
    var cacheKey = [req.subject || '', req.code || '', req.topic || '', slug].join('|');
    if (made[cacheKey]) return Promise.resolve(made[cacheKey]);

    var weak = (req.weak && req.weak.length ? req.weak : weakFromRecall(slug))
      .concat(weakFromSittings())
      .slice(0, 10);

    return window.notivloSupabase.authed(PATH, {
      method: 'POST',
      body: {
        subject: req.subject || req.title || '',
        code: req.code || '',
        topic: req.topic || '',
        after: req.after && req.after.length ? req.after : alreadySat(req.subjectKey),
        weak: weak,
      },
    }).then(function (res) {
      if (res.error) {
        // 402 is "no credits left", and the function's own wording for it is
        // already written for a student. The balance is re-read either way:
        // a 402 means the panel is showing a number that is too high, and
        // anything else may have spent a credit and refunded it, which also
        // changes what the panel should say.
        if (window.notivloBilling) window.notivloBilling.refresh(true);

        // The notebook shows `message` as it stands, so it has to read as a
        // sentence to a student rather than as a status line.
        var message = res.error.message
          || 'The lesson could not be written just now.';
        var err = new Error(message);
        err.notivlo = res.error;
        throw err;
      }
      var lesson = res.data && res.data.lesson;
      if (!lesson) throw new Error('The lesson came back empty.');

      var bad = api().validate(lesson);
      if (bad.length) {
        // Not shown to the student: there is nothing they can do about a
        // scheme line count, and the fallback already tells them the useful
        // part. It goes where whoever deployed the function can find it.
        console.error('notivlo: a generated lesson was dropped — ' + bad.join('; '));
        throw new Error('The lesson that came back would not have marked fairly.');
      }

      // `subject` is what the notebook matches a lesson to a notebook on, so a
      // generated lesson keeps the key of the notebook that asked for it
      // rather than whatever the model wrote.
      if (req.subjectKey) lesson.subject = req.subjectKey;
      made[cacheKey] = lesson;

      // A credit has just been spent. The function returns what is left, which
      // saves a round trip, but the authority is the database — so the
      // response's number is used immediately and then confirmed.
      if (window.notivloBilling) window.notivloBilling.refresh(true);
      return lesson;
    });
  }

  // Only ever set when there is something behind it. Left null, the notebook
  // does not offer to write a lesson at all, which is the right thing on a
  // build with no backend — an offer that always fails is worse than no offer.
  if (api()) {
    api().generate = ready() ? generate : null;

    // Signing in is what makes this possible, and it happens after this file
    // has run. Signing out takes it away again.
    if (window.notivloSupabase && window.notivloSupabase.onChange) {
      window.notivloSupabase.onChange(function () {
        api().generate = ready() ? generate : null;
      });
    }

    // Read the balance once, now, if there is one to read — the panel has to
    // know whether to show a button or an explanation before the student gets
    // there, and the alternative is a button that changes under their finger.
    //
    // Guarded on `ready()` so an unconfigured build, or a signed-out one,
    // still makes no request at all because this file was loaded. billing.js
    // re-reads on its own when a session begins.
    if (ready() && window.notivloBilling) window.notivloBilling.refresh(false);
  }
})();
