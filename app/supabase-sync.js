/* Mirroring the app's stores to the account they belong to.
 *
 * The pages are unchanged by this file: they go on reading and writing
 * localStorage, which stays the copy the UI renders from. This runs beside
 * them and keeps the server's copy in step, so an account can be signed in to
 * on a second device, and a cleared browser is an inconvenience rather than
 * the loss of every notebook.
 *
 *   folio_notebooks_v1      -> public.notebooks          (key: slug)
 *   folio_nb_state:<slug>   -> public.chapters           (key: notebook + position)
 *   folio_agenda_v2         -> public.agenda_items       (key: the UI's own item id)
 *   folio_study_minutes     -> public.study_minutes      (key: day)
 *   folio_prefs             -> public.preferences        (one row)
 *
 * What this is and is not:
 *
 *   It is a mirror with a merge on the way in. A record present in both
 *   places is taken from the server; a record only this device has is kept
 *   and sent up. Records deleted here are deleted there on the next push.
 *
 *   It is not live multi-device sync. Two devices editing the same notebook
 *   between syncs will not be merged chapter by chapter — the one that syncs
 *   later overwrites that chapter. And because a pull merges rather than
 *   replaces, a notebook deleted on one device can come back from another
 *   that had not synced since. Both are deliberate: of the two ways to be
 *   wrong, duplicating a notebook is the one that does not lose work.
 *
 *   Per-record timestamps in the stores themselves are what would fix it, and
 *   that is a change to the pages, not to this file.
 */
(function () {
  var sb = window.notivloSupabase;
  var backend = window.notivloBackend || { configured: function () { return false; } };

  var KEYS = {
    notebooks: 'folio_notebooks_v1',
    agenda: 'folio_agenda_v2',
    study: 'folio_study_minutes',
    prefs: 'folio_prefs',
    chapterPrefix: 'folio_nb_state:',
    meta: 'folio_sync_meta',
  };

  // Written by a dead feature (a photo scanner that used Google Cloud Vision)
  // and still sitting in some installs' preferences. It is a live credential:
  // it does not go to the server any more than it goes into an export.
  var PREF_BLOCKLIST = ['visionApiKey'];

  var SLUG = /^[a-z0-9-]{1,80}$/;
  var ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
  var AGENDA_KINDS = { class: 1, assignment: 1, study: 1, task: 1 };
  var THEMES = { system: 1, light: 1, dark: 1 };
  var SIZES = { compact: 1, 'default': 1, large: 1, largest: 1 };
  var SORTS = { recent: 1, name: 1, progress: 1 };

  // How often a device with nothing of its own to send looks for work done
  // elsewhere. Pulling on every page load would be five requests each time;
  // never pulling again after the first sign-in would mean a second device
  // only ever sees the account as it was the moment it signed in. This is the
  // compromise, and `sync({ pull: true })` overrides it.
  var PULL_INTERVAL_MS = 2 * 60 * 1000;

  var running = null;

  /* ---------- localStorage ---------------------------------------------- */

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function readArray(key) {
    var v = read(key, []);
    return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object' && !Array.isArray(x); }) : [];
  }

  function readObject(key) {
    var v = read(key, {});
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }

  // The stores that belong to an account rather than to the device. Theme
  // and text size are not here, the same ones wipeLocal() keeps: they are
  // this screen's settings, not this account's.
  function clearContentStores() {
    var keys = [KEYS.notebooks, KEYS.agenda, KEYS.study];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(KEYS.chapterPrefix) === 0) keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  function localNotebooks() {
    return readArray(KEYS.notebooks).filter(function (nb) { return SLUG.test(String(nb.slug || '')); });
  }

  function localChapters(slug) {
    var state = readObject(KEYS.chapterPrefix + slug);
    return Array.isArray(state.chapters) ? state.chapters : [];
  }

  /* ---------- records in, rows out -------------------------------------- */

  // Anything this schema does not have a column for travels in `extra` and
  // comes back out on the way down, so a store that grows a field in the
  // pages is not quietly truncated by passing through here.
  function rest(record, known) {
    var extra = {};
    for (var k in record) {
      if (!Object.prototype.hasOwnProperty.call(record, k)) continue;
      if (known.indexOf(k) >= 0) continue;
      extra[k] = record[k];
    }
    return extra;
  }

  function merge(record, extra) {
    var out = {};
    var e = extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {};
    for (var k in e) { if (Object.prototype.hasOwnProperty.call(e, k)) out[k] = e[k]; }
    for (var j in record) { if (Object.prototype.hasOwnProperty.call(record, j)) out[j] = record[j]; }
    return out;
  }

  function int(v, fallback) {
    var n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  }

  var NOTEBOOK_KNOWN = ['title', 'slug', 'subject', 'category', 'cover', 'coverCss',
    'done', 'total', 'minutesAgo', 'tagClass', 'userCreated'];

  function notebookToRow(nb, userId, position) {
    // 'minutesAgo' is relative to whenever the page last rendered, which is
    // meaningless to another device an hour later — it is stored as the
    // moment it refers to and turned back on the way down.
    var ago = int(nb.minutesAgo, null);
    return {
      user_id: userId,
      slug: String(nb.slug),
      title: String(nb.title || 'Untitled Notebook').slice(0, 200),
      subject: nb.subject == null ? null : String(nb.subject).slice(0, 200),
      category: nb.category == null ? null : String(nb.category).slice(0, 80),
      cover_css: nb.coverCss != null ? String(nb.coverCss)
        : (typeof nb.cover === 'string' ? nb.cover : null),
      tag_class: nb.tagClass == null ? null : String(nb.tagClass).slice(0, 80),
      done: Math.max(0, int(nb.done, 0)),
      total: Math.max(0, int(nb.total, 0)),
      user_created: nb.userCreated !== false,
      position: position,
      last_opened_at: ago == null ? null : new Date(Date.now() - ago * 60000).toISOString(),
      extra: rest(nb, NOTEBOOK_KNOWN),
    };
  }

  function notebookFromRow(row) {
    var record = {
      title: row.title,
      slug: row.slug,
      done: row.done,
      total: row.total,
      userCreated: row.user_created,
    };
    if (row.subject != null) record.subject = row.subject;
    if (row.category != null) record.category = row.category;
    if (row.tag_class != null) record.tagClass = row.tag_class;
    if (row.cover_css != null) record.coverCss = row.cover_css;
    if (row.last_opened_at) {
      var ms = Date.now() - new Date(row.last_opened_at).getTime();
      record.minutesAgo = Math.max(0, Math.round(ms / 60000));
    }
    return merge(record, row.extra);
  }

  var CHAPTER_KNOWN = ['title', 'paragraphs', 'notes', 'unit', 'contentHtml'];

  function chapterToRow(ch, notebookId, userId, position) {
    return {
      notebook_id: notebookId,
      user_id: userId,
      position: position,
      unit: ch.unit == null ? null : int(ch.unit, null),
      title: String(ch.title || '').slice(0, 200),
      paragraphs: Array.isArray(ch.paragraphs) ? ch.paragraphs.map(String) : [],
      notes: Array.isArray(ch.notes) ? ch.notes : [],
      content_html: ch.contentHtml == null ? null : String(ch.contentHtml),
      extra: rest(ch, CHAPTER_KNOWN),
    };
  }

  function chapterFromRow(row) {
    var record = {
      title: row.title || '',
      paragraphs: Array.isArray(row.paragraphs) ? row.paragraphs : [],
      notes: Array.isArray(row.notes) ? row.notes : [],
    };
    if (row.unit != null) record.unit = row.unit;
    if (row.content_html != null) record.contentHtml = row.content_html;
    return merge(record, row.extra);
  }

  var AGENDA_KNOWN = ['id', 'date', 'type', 'title', 'time', 'done', 'notebookSlug', 'nbCh'];

  function agendaToRow(item, userId) {
    var slug = String(item.notebookSlug || '');
    var extra = rest(item, AGENDA_KNOWN);
    // Recorded, not discarded: agendaFromRow puts it back, so a store with a
    // type this schema has not caught up with round-trips unchanged instead
    // of coming back as a task.
    if (item.type != null && !AGENDA_KINDS[item.type]) extra.type = item.type;
    return {
      user_id: userId,
      client_id: String(item.id).slice(0, 80),
      due_date: String(item.date),
      // An unrecognised type would be rejected by the table's check
      // constraint and take the whole batch with it; a stray one becomes a
      // plain task, with the original kept in `extra`.
      kind: AGENDA_KINDS[item.type] ? item.type : 'task',
      title: String(item.title || '').slice(0, 300) || 'Untitled',
      time_label: String(item.time || 'Any time').slice(0, 40),
      done: item.done === true,
      notebook_slug: SLUG.test(slug) ? slug : null,
      chapter_index: item.nbCh == null ? null : int(item.nbCh, null),
      extra: extra,
    };
  }

  function agendaFromRow(row) {
    var extra = row.extra && typeof row.extra === 'object' ? row.extra : {};
    var record = {
      id: row.client_id,
      date: row.due_date,
      // The client's own value wins over the normalised one, for the reason
      // in agendaToRow.
      type: extra.type || row.kind,
      title: row.title,
      time: row.time_label,
      done: row.done,
    };
    if (row.notebook_slug) record.notebookSlug = row.notebook_slug;
    if (row.chapter_index != null) record.nbCh = row.chapter_index;
    return merge(record, row.extra);
  }

  var PREF_KNOWN = ['theme', 'textSize', 'defaultSort'];

  function prefsToRow(prefs, userId) {
    var extra = rest(prefs, PREF_KNOWN);
    for (var i = 0; i < PREF_BLOCKLIST.length; i++) delete extra[PREF_BLOCKLIST[i]];
    return {
      user_id: userId,
      theme: THEMES[prefs.theme] ? prefs.theme : 'system',
      text_size: SIZES[prefs.textSize] ? prefs.textSize : 'default',
      default_sort: SORTS[prefs.defaultSort] ? prefs.defaultSort : 'recent',
      extra: extra,
    };
  }

  function prefsFromRow(row, local) {
    // The local copy wins for anything the server has no column for, so a
    // preference set on this device is not dropped by a pull.
    var record = merge({
      theme: row.theme,
      textSize: row.text_size,
      defaultSort: row.default_sort,
    }, row.extra);
    for (var k in local) {
      if (!Object.prototype.hasOwnProperty.call(local, k)) continue;
      if (PREF_KNOWN.indexOf(k) >= 0) continue;
      if (!Object.prototype.hasOwnProperty.call(record, k)) record[k] = local[k];
    }
    for (var i = 0; i < PREF_BLOCKLIST.length; i++) {
      if (local && local[PREF_BLOCKLIST[i]] !== undefined) record[PREF_BLOCKLIST[i]] = local[PREF_BLOCKLIST[i]];
    }
    return record;
  }

  /* ---------- a cheap "has anything changed" ---------------------------- */

  // The stores carry no timestamps, so change is detected by hashing what
  // they currently hold. FNV-1a over the serialised stores: fast enough to
  // run on every sync tick, and a change anywhere moves it.
  function fingerprint() {
    var parts = [
      localStorage.getItem(KEYS.notebooks) || '',
      localStorage.getItem(KEYS.agenda) || '',
      localStorage.getItem(KEYS.study) || '',
      localStorage.getItem(KEYS.prefs) || '',
    ];
    var books = localNotebooks();
    for (var i = 0; i < books.length; i++) {
      parts.push(localStorage.getItem(KEYS.chapterPrefix + books[i].slug) || '');
    }
    var s = parts.join('\u0000');
    var h = 0x811c9dc5;
    for (var j = 0; j < s.length; j++) {
      h ^= s.charCodeAt(j);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16) + ':' + s.length;
  }

  function meta() { return readObject(KEYS.meta); }
  function setMeta(patch) {
    var m = meta();
    for (var k in patch) { if (Object.prototype.hasOwnProperty.call(patch, k)) m[k] = patch[k]; }
    write(KEYS.meta, m);
  }

  /* ---------- push ------------------------------------------------------ */

  function chunked(rows, size) {
    var out = [];
    for (var i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
    return out;
  }

  // Chapters hold the body text of every note, so they go up in small
  // batches: one oversized request is the difference between a slow sync and
  // a failed one.
  function upsertAll(table, rows, onConflict, size) {
    var batches = chunked(rows, size || 100);
    var i = 0;
    function step() {
      if (i >= batches.length) return Promise.resolve({ error: null });
      return sb.upsert(table, batches[i++], onConflict).then(function (res) {
        return res.error ? res : step();
      });
    }
    return step();
  }

  function pushAll(user) {
    var userId = user.id;
    var books = localNotebooks();
    var agenda = readArray(KEYS.agenda).filter(function (it) { return it.id && ISO_DAY.test(String(it.date || '')); });
    var study = readObject(KEYS.study);
    var prefs = readObject(KEYS.prefs);

    var studyRows = [];
    for (var day in study) {
      if (!ISO_DAY.test(day)) continue;
      var minutes = Number(study[day]);
      if (!isFinite(minutes) || minutes < 0) continue;
      studyRows.push({ user_id: userId, day: day, minutes: Math.min(1440, minutes) });
    }

    return upsertAll('notebooks', books.map(function (nb, i) { return notebookToRow(nb, userId, i); }), 'user_id,slug', 50)
      .then(function (res) {
        if (res.error) return res;
        // Notebooks removed on this device go too, and their chapters with
        // them by cascade. `not.in` needs the list quoted PostgREST-style.
        var slugs = books.map(function (nb) { return nb.slug; });
        return slugs.length
          ? sb.remove('notebooks', { user_id: 'eq.' + userId, slug: 'not.in.(' + slugs.join(',') + ')' })
          : sb.remove('notebooks', { user_id: 'eq.' + userId });
      })
      .then(function (res) {
        if (res.error) return res;
        // Chapters need their notebook's id, which only the server knows.
        return sb.select('notebooks', { select: 'id,slug', user_id: 'eq.' + userId });
      })
      .then(function (res) {
        if (res.error) return res;
        var ids = {};
        (res.data || []).forEach(function (row) { ids[row.slug] = row.id; });

        var rows = [];
        var trims = [];
        books.forEach(function (nb) {
          var id = ids[nb.slug];
          if (!id) return;
          var chapters = localChapters(nb.slug);
          chapters.forEach(function (ch, i) {
            if (ch && typeof ch === 'object') rows.push(chapterToRow(ch, id, userId, i));
          });
          trims.push({ id: id, count: chapters.length });
        });

        return upsertAll('chapters', rows, 'notebook_id,position', 25).then(function (r) {
          if (r.error) return r;
          // A notebook that lost chapters leaves rows at positions past the
          // end of the local array; those are the deletions.
          var i = 0;
          function trim() {
            if (i >= trims.length) return Promise.resolve({ error: null });
            var t = trims[i++];
            return sb.remove('chapters', {
              notebook_id: 'eq.' + t.id,
              position: 'gte.' + t.count,
            }).then(function (d) { return d.error ? d : trim(); });
          }
          return trim();
        });
      })
      .then(function (res) {
        if (res.error) return res;
        return upsertAll('agenda_items', agenda.map(function (it) { return agendaToRow(it, userId); }), 'user_id,client_id', 100);
      })
      .then(function (res) {
        if (res.error) return res;
        var ids = agenda.map(function (it) { return String(it.id); });
        return ids.length
          ? sb.remove('agenda_items', { user_id: 'eq.' + userId, client_id: 'not.in.(' + ids.map(quote).join(',') + ')' })
          : sb.remove('agenda_items', { user_id: 'eq.' + userId });
      })
      .then(function (res) {
        if (res.error) return res;
        return studyRows.length
          ? upsertAll('study_minutes', studyRows, 'user_id,day', 200)
          : { error: null };
      })
      .then(function (res) {
        if (res.error) return res;
        return sb.upsert('preferences', prefsToRow(prefs, userId), 'user_id');
      })
      .then(function (res) {
        if (res.error) return { ok: false, error: res.error };
        setMeta({ email: user.email, hash: fingerprint(), lastPushAt: Date.now() });
        return { ok: true, pushed: true };
      });
  }

  // PostgREST's in-list treats commas as separators, so a value containing
  // one has to be quoted. The app's own ids never do, but a hand-edited store
  // is not worth a corrupted delete filter.
  function quote(v) {
    return '"' + String(v).replace(/"/g, '""') + '"';
  }

  /* ---------- pull ------------------------------------------------------ */

  function pullAll(user, options) {
    var userId = user.id;
    var opts = options || {};

    // Someone signing in where the last account's notebooks are still
    // sitting. They are not this account's to merge with and emphatically
    // not this account's to push, so they go first — before anything is
    // read, so that an account with nothing on the server still starts
    // clean here rather than inheriting the last one's work.
    //
    // Only ever reached when those stores are fully synced: sync() refuses
    // outright when they are not. So this removes a copy of something the
    // other account can still sign in and get back, not the only copy.
    if (opts.replace) clearContentStores();

    return Promise.all([
      sb.select('notebooks', { select: '*', user_id: 'eq.' + userId, order: 'position.asc.nullslast,title.asc' }),
      sb.select('agenda_items', { select: '*', user_id: 'eq.' + userId }),
      sb.select('study_minutes', { select: '*', user_id: 'eq.' + userId }),
      sb.select('preferences', { select: '*', user_id: 'eq.' + userId }),
    ]).then(function (res) {
      for (var i = 0; i < res.length; i++) {
        if (res[i].error) return { ok: false, error: res[i].error };
      }
      var remoteBooks = res[0].data || [];
      var remoteAgenda = res[1].data || [];
      var remoteStudy = res[2].data || [];
      var remotePrefs = (res[3].data || [])[0] || null;

      if (!remoteBooks.length && !remoteAgenda.length && !remoteStudy.length && !remotePrefs) {
        // Nothing up there yet — the account was created on this device, or
        // on another that has not synced. The push that follows is what
        // fills it. `lastPullAt` is still recorded: the question "has this
        // device ever looked?" has now been answered, and without it every
        // later sync would pull again on the way past.
        setMeta({ email: user.email, lastPullAt: Date.now() });
        return { ok: true, empty: true };
      }

      /* notebooks: the server's copy wins per slug, local-only slugs stay */
      var localBooks = localNotebooks();
      var bySlug = {};
      localBooks.forEach(function (nb) { bySlug[nb.slug] = nb; });
      var mergedBooks = remoteBooks.map(function (row) {
        delete bySlug[row.slug];
        return notebookFromRow(row);
      });
      localBooks.forEach(function (nb) { if (bySlug[nb.slug]) mergedBooks.push(nb); });
      write(KEYS.notebooks, mergedBooks);

      /* agenda: same rule, keyed by the item id the UI generated */
      var localAgenda = readArray(KEYS.agenda);
      var byId = {};
      localAgenda.forEach(function (it) { byId[String(it.id)] = it; });
      var mergedAgenda = remoteAgenda.map(function (row) {
        delete byId[String(row.client_id)];
        return agendaFromRow(row);
      });
      localAgenda.forEach(function (it) { if (byId[String(it.id)]) mergedAgenda.push(it); });
      write(KEYS.agenda, mergedAgenda);

      /* study minutes: the larger count for a day, since both are real time
         spent and neither device saw the other's */
      var study = readObject(KEYS.study);
      remoteStudy.forEach(function (row) {
        var day = String(row.day).slice(0, 10);
        var mine = Number(study[day]) || 0;
        var theirs = Number(row.minutes) || 0;
        study[day] = Math.max(mine, theirs);
      });
      write(KEYS.study, study);

      if (remotePrefs) write(KEYS.prefs, prefsFromRow(remotePrefs, readObject(KEYS.prefs)));

      /* chapters, one notebook at a time */
      var withIds = remoteBooks.filter(function (row) { return SLUG.test(row.slug); });
      var i = 0;
      function nextNotebook() {
        if (i >= withIds.length) return Promise.resolve({ ok: true });
        var row = withIds[i++];
        return sb.select('chapters', {
          select: '*', notebook_id: 'eq.' + row.id, order: 'position.asc',
        }).then(function (r) {
          if (r.error) return { ok: false, error: r.error };
          var chapters = (r.data || []).map(chapterFromRow);
          // An empty remote notebook does not blank out a local one that has
          // chapters: there is nothing here to prefer over them.
          if (chapters.length) write(KEYS.chapterPrefix + row.slug, { chapters: chapters });
          return nextNotebook();
        });
      }

      return nextNotebook().then(function (r) {
        if (!r.ok) return r;
        setMeta({ email: user.email, hash: fingerprint(), lastPullAt: Date.now() });
        return { ok: true, pulled: true };
      });
    });
  }

  /* ---------- the one call a page makes --------------------------------- */

  // Pull first on a device that has not synced this account (a second device,
  // or a reinstall), push when this device's stores have changed since the
  // last sync. Calls while one is already running join it rather than
  // starting a second.
  function sync(options) {
    var opts = options || {};
    if (!sb || !backend.configured()) return Promise.resolve({ ok: false, skipped: 'not-configured' });
    if (running) return running;

    var user = sb.user();
    if (!user || !user.id) return Promise.resolve({ ok: false, skipped: 'signed-out' });

    var m = meta();
    var dirty = fingerprint() !== m.hash;

    // These stores were last synced by a different account — someone signed
    // out on this device and someone else signed in. Signing out leaves the
    // notebooks where they are, deliberately, which makes this the moment
    // they have to be dealt with: merging them into this account would file
    // one person's notebooks under another's name on the server.
    var otherAccount = !!(m.email && m.email !== user.email);

    // And if that account had work it never sent, there is no good move
    // left: replacing loses it and pushing misfiles it. So this device syncs
    // nothing until a human settles it — by signing back in as them with a
    // connection, or by erasing in Settings → Danger zone.
    if (otherAccount && dirty) {
      return Promise.resolve({
        ok: false, skipped: 'other-account-unsynced', account: m.email,
      });
    }

    // Either this device has never synced this account — a second device, a
    // reinstall, a cleared browser — or it has.
    var firstTimeHere = m.email !== user.email || !m.lastPullAt;
    var stale = !m.lastPullAt || (Date.now() - m.lastPullAt) > PULL_INTERVAL_MS;

    // Pulling while this device has unsent changes is the one order that can
    // lose work: the merge would write a new fingerprint over the one that
    // says "there is something here to send". So a dirty device sends first
    // and reads on a later pass, which is also the common case — the reader
    // is typing, and what they typed is the newest thing anywhere.
    var pulling = firstTimeHere || opts.pull === true || (!dirty && stale);

    running = (pulling ? pullAll(user, { replace: otherAccount }) : Promise.resolve({ ok: true, skipped: 'no-pull' }))
      .then(function (res) {
        if (res.ok === false) return res;
        // Re-read: a pull merges into the stores and moves the fingerprint.
        var changed = fingerprint() !== meta().hash;
        // `pulled` is what tells a page its stores changed underneath it and
        // the state it read at construction is now stale.
        var pulled = !!res.pulled;
        // A first sync normally pushes as well, to send anything this device
        // had before it signed in. After a handover there is nothing of this
        // account's to send that did not just come down.
        if (!changed && !opts.force && (!firstTimeHere || otherAccount)) {
          return { ok: true, pulled: pulled, skipped: pulled ? 'pulled' : 'unchanged' };
        }
        return pushAll(user).then(function (r) {
          if (r && r.ok) r.pulled = pulled;
          return r;
        });
      })
      .then(function (res) {
        running = null;
        if (res.ok === false && res.error) {
          // Offline is the expected case, not a failure worth shouting about:
          // the next sync picks it up, because the fingerprint has not moved.
          return { ok: false, offline: !!res.error.offline, error: res.error };
        }
        return res;
      }, function (e) {
        running = null;
        return { ok: false, error: { message: String((e && e.message) || e), code: 'sync_failed' } };
      });

    return running;
  }

  /* ---------- leaving ---------------------------------------------------- */

  // Not called on sign-out. That is settled, not an oversight: the stores
  // are this device's working copy, and someone who signs out on a flaky
  // connection should not find their notebooks gone.
  //
  // What that leaves — the next person to sign in here seeing the last
  // account's notebooks — is handled where it actually matters, in sync():
  // stores belonging to another account are never merged into this one and
  // never pushed under its name. They are replaced once this account's own
  // copy comes down, and only when the other account had nothing unsent.
  // So the exposure is to whoever is sitting at the device, which is what
  // Settings → Danger zone → Reset data is for.
  function wipeLocal() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        // Everything the app owns except the preferences: light or dark and
        // the text size are this device's, not the account's, and resetting
        // them would repaint the window from under whoever is sitting there.
        // 'folio_sync_meta' does go, so the next account to sign in here is
        // treated as a first-timer and pulls before it pushes anything.
        if (k && k.indexOf('folio_') === 0 && k !== 'folio_prefs') keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { return false; }
    return true;
  }

  window.notivloSync = {
    enabled: function () { return !!(sb && backend.configured()); },
    sync: sync,
    push: function () {
      var user = sb && sb.user();
      return user ? pushAll(user) : Promise.resolve({ ok: false, skipped: 'signed-out' });
    },
    pull: function () {
      var user = sb && sb.user();
      return user ? pullAll(user) : Promise.resolve({ ok: false, skipped: 'signed-out' });
    },
    status: function () {
      var m = meta();
      return {
        account: m.email || '',
        lastPushAt: m.lastPushAt || 0,
        lastPullAt: m.lastPullAt || 0,
        dirty: fingerprint() !== m.hash,
        running: !!running,
      };
    },
    wipeLocal: wipeLocal,
    KEYS: KEYS,
  };
})();
