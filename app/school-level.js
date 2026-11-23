/* Where a student is at school, and what their notebooks start with because of it.
 *
 * The first screen of the setup guide asks two things: which school system
 * the student is in, and which year of it. School years are named
 * differently in every country — Year 12, Grade 11, Class 11, JC1, Première,
 * Form 5 — so the question is asked in the student's own system's words and
 * then mapped onto one of three LEVELS, which are what the app actually uses:
 *
 *   foundation  the years before A level (IGCSE / GCSE stage, roughly 14–16)
 *   as          the first year of A level (AS, roughly 16–17)
 *   a2          the final year of A level (roughly 17–18)
 *
 * The mapping is by age: a grade lands on the level a student of that age
 * would be at in a Cambridge school. That is the only thing the systems
 * reliably share, and it is close enough for choosing which notes a notebook
 * opens on. It is not a statement about what the student's own curriculum
 * covers.
 *
 * What a level changes
 * --------------------
 * Only the text an untouched notebook starts with (see `leveled`):
 *
 *   foundation  IGCSE-stage chapters, ending with a "Bridge to AS" chapter
 *               that says what comes next — written in this file for the
 *               seven subjects Notebook.dc.html carries, and in
 *               subject-notes.js for every other subject on the guide's list
 *   as          the notebook's AS chapters only
 *   a2          every chapter, AS ones kept as revision, opening on the
 *               first A Level chapter
 *
 * A notebook the student has written in keeps what they wrote: the page reads
 * saved chapters first and only falls back to this when there are none.
 *
 * Where the answer lives
 * ----------------------
 * `folio_prefs.school` — { system, grade, level, account }. folio_prefs is
 * synced (as the preferences row's `extra`), so a notebook opened on a second
 * device starts at the same level. The record is stamped with the signed-in
 * address because folio_prefs outlives sign-out on a shared device; a record
 * stamped for someone else is ignored.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.notivloSchool = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var PREFS_KEY = 'folio_prefs';
  var SESSION_KEY = 'folio_session';
  var SETUP_KEY = 'folio_setup_v1';

  var LEVELS = {
    foundation: {
      id: 'foundation',
      label: 'Building up to A level',
      short: 'IGCSE stage',
      effect: 'Your notebooks will start with IGCSE-stage notes — the ideas A level builds on, in plain steps — and a chapter on what comes next at AS.',
    },
    as: {
      id: 'as',
      label: 'First year of A level',
      short: 'AS',
      effect: 'Your notebooks will start with AS notes: the first-year topics, in the order you are likely to meet them.',
    },
    a2: {
      id: 'a2',
      label: 'Final year of A level',
      short: 'A Level',
      effect: 'Your notebooks will open on the A Level topics, with the AS chapters kept alongside for revision.',
    },
  };

  // Each system lists the years worth asking about — the ones before A level
  // through to the end of school — under the names that system uses. The
  // first grade in each list sweeps up everyone younger. `regions` are the
  // ISO country codes whose browsers default to it; the student can always
  // change the system, so a wrong guess costs one tap.
  function g(id, label, level) { return { id: id, label: label, level: level }; }

  var SYSTEMS = [
    {
      id: 'cambridge', label: 'International school (Cambridge, Edexcel)',
      regions: [],
      grades: [
        g('pre-igcse', 'Before IGCSE', 'foundation'),
        g('igcse-1', 'IGCSE, first year', 'foundation'),
        g('igcse-2', 'IGCSE, second year', 'foundation'),
        g('as', 'AS Level', 'as'),
        g('a2', 'A Level (A2)', 'a2'),
      ],
    },
    {
      id: 'uk', label: 'England, Wales or Northern Ireland',
      regions: ['GB', 'IM', 'JE', 'GG', 'GI'],
      grades: [
        g('y9', 'Year 9 or below', 'foundation'),
        g('y10', 'Year 10', 'foundation'),
        g('y11', 'Year 11', 'foundation'),
        g('y12', 'Year 12 (Lower Sixth)', 'as'),
        g('y13', 'Year 13 (Upper Sixth)', 'a2'),
      ],
    },
    {
      id: 'scotland', label: 'Scotland',
      regions: [],
      grades: [
        g('s3', 'S3 or below', 'foundation'),
        g('s4', 'S4', 'foundation'),
        g('s5', 'S5', 'as'),
        g('s6', 'S6', 'a2'),
      ],
    },
    {
      id: 'ireland', label: 'Ireland',
      regions: ['IE'],
      grades: [
        g('y3', 'Third Year or below', 'foundation'),
        g('ty', 'Transition Year', 'foundation'),
        g('y5', 'Fifth Year', 'as'),
        g('y6', 'Sixth Year', 'a2'),
      ],
    },
    {
      id: 'grades', label: 'Grades 1–12 (US, Canada, the Gulf, the Philippines…)',
      regions: ['US', 'CA', 'PH', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'LK', 'KR', 'MX', 'BR', 'CO', 'CL', 'PE', 'AR', 'TH', 'VN', 'ID'],
      grades: [
        g('g8', 'Grade 8 or below', 'foundation'),
        g('g9', 'Grade 9', 'foundation'),
        g('g10', 'Grade 10', 'foundation'),
        g('g11', 'Grade 11', 'as'),
        g('g12', 'Grade 12', 'a2'),
      ],
    },
    {
      id: 'classes', label: 'Classes 1–12 (India, Pakistan, Bangladesh, Nepal)',
      regions: ['IN', 'PK', 'BD', 'NP'],
      grades: [
        g('c8', 'Class 8 or below', 'foundation'),
        g('c9', 'Class 9', 'foundation'),
        g('c10', 'Class 10', 'foundation'),
        g('c11', 'Class 11', 'as'),
        g('c12', 'Class 12', 'a2'),
      ],
    },
    {
      id: 'australia', label: 'Australia',
      regions: ['AU'],
      grades: [
        g('y9', 'Year 9 or below', 'foundation'),
        g('y10', 'Year 10', 'foundation'),
        g('y11', 'Year 11', 'as'),
        g('y12', 'Year 12', 'a2'),
      ],
    },
    {
      id: 'nz', label: 'New Zealand',
      regions: ['NZ'],
      grades: [
        g('y10', 'Year 10 or below', 'foundation'),
        g('y11', 'Year 11 (NCEA Level 1)', 'foundation'),
        g('y12', 'Year 12 (NCEA Level 2)', 'as'),
        g('y13', 'Year 13 (NCEA Level 3)', 'a2'),
      ],
    },
    {
      id: 'singapore', label: 'Singapore',
      regions: ['SG'],
      grades: [
        g('sec3', 'Secondary 3 or below', 'foundation'),
        g('sec4', 'Secondary 4', 'foundation'),
        g('jc1', 'JC1', 'as'),
        g('jc2', 'JC2', 'a2'),
      ],
    },
    {
      id: 'forms', label: 'Forms (Malaysia, Hong Kong, Brunei)',
      regions: ['MY', 'HK', 'BN', 'MO'],
      grades: [
        g('f3', 'Form 3 or below', 'foundation'),
        g('f4', 'Form 4', 'foundation'),
        g('f5', 'Form 5', 'foundation'),
        g('l6', 'Form 6 lower / first pre-university year', 'as'),
        g('u6', 'Form 6 upper / second pre-university year', 'a2'),
      ],
    },
    {
      id: 'west-africa', label: 'Nigeria, Ghana and West Africa',
      regions: ['NG', 'GH', 'SL', 'GM', 'LR', 'CM'],
      grades: [
        g('jss3', 'JSS 3 / JHS 3 or below', 'foundation'),
        g('ss1', 'SS 1 / SHS 1', 'foundation'),
        g('ss2', 'SS 2 / SHS 2', 'as'),
        g('ss3', 'SS 3 / SHS 3', 'a2'),
      ],
    },
    {
      id: 'east-africa', label: 'Kenya, Uganda, Tanzania',
      regions: ['KE', 'UG', 'TZ', 'RW', 'ZM', 'ZW', 'MW'],
      grades: [
        g('form2', 'Form 2 or below', 'foundation'),
        g('form3', 'Form 3', 'foundation'),
        g('form4', 'Form 4', 'foundation'),
        g('form5', 'Form 5 / Senior 5', 'as'),
        g('form6', 'Form 6 / Senior 6', 'a2'),
      ],
    },
    {
      id: 'ib', label: 'International Baccalaureate',
      regions: [],
      grades: [
        g('myp3', 'MYP 3 or below', 'foundation'),
        g('myp4', 'MYP 4', 'foundation'),
        g('myp5', 'MYP 5', 'foundation'),
        g('dp1', 'Diploma, first year', 'as'),
        g('dp2', 'Diploma, second year', 'a2'),
      ],
    },
    {
      id: 'france', label: 'France',
      regions: ['FR', 'MC', 'LU', 'MA', 'TN', 'DZ', 'SN', 'CI'],
      grades: [
        g('3e', 'Troisième or below', 'foundation'),
        g('2de', 'Seconde', 'foundation'),
        g('1re', 'Première', 'as'),
        g('tle', 'Terminale', 'a2'),
      ],
    },
    {
      id: 'germany', label: 'Germany, Austria, Switzerland',
      regions: ['DE', 'AT', 'CH', 'LI'],
      grades: [
        g('k9', 'Klasse 9 or below', 'foundation'),
        g('k10', 'Klasse 10', 'foundation'),
        g('k11', 'Klasse 11', 'as'),
        g('k12', 'Klasse 12', 'a2'),
        g('k13', 'Klasse 13', 'a2'),
      ],
    },
    {
      id: 'spain', label: 'Spain',
      regions: ['ES', 'AD'],
      grades: [
        g('eso3', '3º ESO or below', 'foundation'),
        g('eso4', '4º ESO', 'foundation'),
        g('bach1', '1º Bachillerato', 'as'),
        g('bach2', '2º Bachillerato', 'a2'),
      ],
    },
    {
      // For anyone whose system is not listed, or who would rather not work
      // out what theirs is called. Age at the start of the school year.
      id: 'age', label: 'None of these — go by my age',
      regions: [],
      grades: [
        g('14', '14 or younger', 'foundation'),
        g('15', '15', 'foundation'),
        g('16', '16', 'as'),
        g('17', '17', 'a2'),
        g('18', '18 or older', 'a2'),
      ],
    },
  ];

  var DEFAULT_SYSTEM = 'cambridge';

  function systemById(id) {
    for (var i = 0; i < SYSTEMS.length; i++) if (SYSTEMS[i].id === id) return SYSTEMS[i];
    return null;
  }

  function gradeIn(system, gradeId) {
    if (!system) return null;
    for (var i = 0; i < system.grades.length; i++) if (system.grades[i].id === gradeId) return system.grades[i];
    return null;
  }

  function levelFor(systemId, gradeId) {
    var grade = gradeIn(systemById(systemId), gradeId);
    return grade ? grade.level : '';
  }

  // The system a browser's language settings point at, e.g. 'en-GB' → uk.
  // Only the region part means anything; a bare 'en' says nothing about
  // where someone goes to school, and nor does a language alone.
  function guessSystem(locales) {
    var list = Array.isArray(locales) ? locales : [locales];
    for (var i = 0; i < list.length; i++) {
      var m = /^[a-z]{2,3}(?:-[A-Za-z]{4})?-([A-Za-z]{2})\b/.exec(String(list[i] || ''));
      if (!m) continue;
      var region = m[1].toUpperCase();
      for (var j = 0; j < SYSTEMS.length; j++) {
        if (SYSTEMS[j].regions.indexOf(region) !== -1) return SYSTEMS[j].id;
      }
    }
    return DEFAULT_SYSTEM;
  }

  function browserLocales() {
    try {
      var nav = typeof navigator !== 'undefined' ? navigator : null;
      if (!nav) return [];
      return nav.languages && nav.languages.length ? nav.languages : [nav.language];
    } catch (e) { return []; }
  }

  // --- storage ------------------------------------------------------------
  var injected = null;
  function _useStorage(s) { injected = s; }
  function ls() {
    if (injected) return injected;
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }
  function readJson(key) {
    try {
      var s = ls();
      var v = s ? JSON.parse(s.getItem(key)) : null;
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch (e) { return null; }
  }
  function sessionEmail() {
    var s = readJson(SESSION_KEY);
    return s ? String(s.email || '').trim().toLowerCase() : '';
  }

  // { system, grade, level } as last answered by this account, or empty
  // strings throughout when there is no answer — including one left on this
  // device by somebody else.
  function read() {
    var none = { system: '', grade: '', level: '' };
    var prefs = readJson(PREFS_KEY);
    var rec = prefs && prefs.school;
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return none;
    var owner = typeof rec.account === 'string' ? rec.account : '';
    var me = sessionEmail();
    if (owner && me && owner !== me) return none;
    var system = systemById(rec.system);
    var grade = gradeIn(system, rec.grade);
    if (!grade) return none;
    // The level is worked out again rather than trusted, so a grade that
    // moves to a different level in a later build moves with it.
    return { system: system.id, grade: grade.id, level: grade.level };
  }

  // Records an answer. An unknown system or grade clears it instead, which
  // is how "I'd rather not say" is undone. Returns what read() now gives.
  function write(systemId, gradeId) {
    var s = ls();
    if (!s) return read();
    var prefs = readJson(PREFS_KEY) || {};
    var system = systemById(systemId);
    var grade = gradeIn(system, gradeId);
    if (grade) {
      prefs.school = { system: system.id, grade: grade.id, level: grade.level, account: sessionEmail() };
    } else {
      delete prefs.school;
    }
    try { s.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {}
    return read();
  }

  // --- the goal --------------------------------------------------------------
  // The setup guide's first screen also asks what the student is here to do.
  // The guide uses the answer for its own wording (setup-content.js, GOALS);
  // what it means for lessons is here, because the notebook page — which
  // never loads the guide's files — is where lessons are sat and written.
  //
  //   label      the goal as the guide words it (the test keeps them equal)
  //   make       the notebook's "write a lesson" button
  //   note       what that lesson will be, said before it is paid for; {ch}
  //              is the open chapter's title, or "the topic this notebook
  //              covers next" when it has none worth naming
  //   list       a line above the lesson list
  //   topic      'chapter' sends the open chapter as the lesson's topic; ''
  //              leaves the choice to the writer
  //   straightToCheck  offer each lesson's exam-style check on its own
  //
  // Only goals that change what a lesson should be are listed with lesson
  // wording. "Get organised" is about where things live, not how to learn
  // them, so its lessons are written the ordinary way.
  var GOALS = {
    'exams': {
      id: 'exams', label: 'Prepare for my exams',
      make: 'Write me an exam practice lesson',
      note: 'Written for your goal of preparing for your exams: a topic that is examined often, taught briefly, then exam-style questions with marks and a mark scheme — aimed at what you have been getting wrong.',
      list: 'You are preparing for exams, so each lesson can go straight to its exam-style check.',
      topic: '', straightToCheck: true,
    },
    'keep-up': {
      id: 'keep-up', label: 'Keep on top of my lessons',
      make: 'Turn this chapter into a lesson',
      note: 'Written for your goal of keeping on top of your lessons: a lesson on {ch}, to fix it while it is fresh — what it is, a worked example, then questions that check you understood it.',
      list: 'You are keeping on top of your lessons: sit a lesson soon after the class it goes with.',
      topic: 'chapter', straightToCheck: false,
    },
    'catch-up': {
      id: 'catch-up', label: 'Catch up on what I missed',
      make: 'Help me catch up on this chapter',
      note: 'Written for your goal of catching up: {ch}, built up from the basics, with every worked step shown and questions that start easy and finish at exam standard.',
      list: 'You are catching up, so start each lesson from its teaching pages — they build the topic from the beginning.',
      topic: 'chapter', straightToCheck: false,
    },
    'organised': {
      id: 'organised', label: 'Get organised',
      make: '', note: '', list: '', topic: '', straightToCheck: false,
    },
  };

  function goalById(id) { return own(GOALS, id) ? GOALS[id] : null; }

  // The goal this account gave, or null. Kept in folio_prefs beside the year,
  // so it syncs; an account that finished the guide before that was the case
  // still has it in the guide's own record, which is read as a fallback.
  function readGoal() {
    var me = sessionEmail();
    var mine = function (rec) {
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return null;
      var owner = typeof rec.account === 'string' ? rec.account.toLowerCase() : '';
      if (owner && me && owner !== me) return null;
      return goalById(rec.id != null ? rec.id : rec.goal);
    };
    var prefs = readJson(PREFS_KEY);
    if (prefs && Object.prototype.hasOwnProperty.call(prefs, 'goal')) return mine(prefs.goal);
    return mine(readJson(SETUP_KEY));
  }

  // Records the goal; an unknown id (or '') clears it. Returns readGoal().
  function writeGoal(id) {
    var s = ls();
    if (!s) return readGoal();
    var prefs = readJson(PREFS_KEY) || {};
    var g = goalById(id);
    // Cleared is written as null rather than deleted, so an old answer in the
    // guide's record does not come back as the fallback.
    prefs.goal = g ? { id: g.id, account: sessionEmail() } : null;
    try { s.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {}
    return readGoal();
  }

  // --- the IGCSE-stage notebooks -------------------------------------------
  // Original notes, one notebook per subject the app ships example chapters
  // for, keyed on the same slugs. Pitched at Cambridge IGCSE (whose syllabus
  // numbers are on the subject line): the core ideas the AS chapters assume,
  // in plain language, then a last chapter that says what AS does with them.
  function ch(title, unit, unitName, paragraphs, notes) {
    return { title: title, unit: unit, unitName: unitName, paragraphs: paragraphs, notes: notes };
  }
  function def(text) { return { type: 'def', label: 'Definition', text: text }; }
  function tip(text) { return { type: 'tip', label: 'Tip', text: text }; }
  function rem(text) { return { type: 'reminder', label: 'Reminder', text: text }; }

  var CORE = 'IGCSE stage · Core ideas';

  var FOUNDATION = {
    'mathematics': { igcse: '0580', chapters: [
      ch('Expanding & Factorising', 1, CORE, [
        'Expanding removes brackets: every term inside is multiplied by the term outside, so 3(x + 4) = 3x + 12. With two brackets, each term in the first multiplies each term in the second, so (x + 2)(x + 5) = x² + 7x + 10.',
        'Factorising is the same step run backwards. For x² + 7x + 10, look for two numbers that multiply to 10 and add to 7 — 2 and 5 — and write (x + 2)(x + 5). Expanding your answer again is a quick way to check it.',
      ], [
        def('Factorise — write an expression as a product of brackets; the reverse of expanding.'),
        tip('Take out a common factor first: 2x² + 14x + 20 becomes 2(x² + 7x + 10) before anything else.'),
      ]),
      ch('Solving Equations', 1, CORE, [
        'Whatever you do to one side of an equation, do to the other. To solve 5x − 3 = 17, add 3 to both sides to get 5x = 20, then divide both sides by 5 to get x = 4.',
        'A quadratic such as x² − 5x + 6 = 0 is solved by factorising it to (x − 2)(x − 3) = 0 and setting each bracket equal to zero, so x = 2 or x = 3. A quadratic usually has two answers, so look for both.',
      ], [
        def('Quadratic equation — an equation whose highest power of x is x², such as x² − 5x + 6 = 0.'),
        rem('Put your answer back into the original equation. If both sides come out equal, it is right.'),
      ]),
      ch('Straight-Line Graphs', 1, CORE, [
        'Every straight line can be written as y = mx + c. The number m is the gradient — how far the line goes up for each 1 across — and c is where it crosses the y-axis.',
        'To find a gradient from two points, divide the change in y by the change in x. From (1, 3) to (4, 9) the gradient is (9 − 3) ÷ (4 − 1) = 2.',
      ], [
        def('Gradient — the change in y divided by the change in x; it measures how steep a line is.'),
        tip('Parallel lines have the same gradient. A negative gradient slopes downwards from left to right.'),
      ]),
      ch('Looking Ahead: Quadratics at AS', 2, 'Bridge to AS · Pure Mathematics 1', [
        'At AS, quadratics are studied as curves as well as equations. Completing the square rewrites x² + 6x + 5 as (x + 3)² − 4, which shows straight away that the lowest point of the curve is at (−3, −4).',
        'The discriminant, b² − 4ac, tells you how many solutions a quadratic has before you solve it. Everything earlier in this notebook — factorising, solving, gradients — is used constantly in that work.',
      ], [
        tip('If factorising still feels slow, practise it now. It is the IGCSE skill AS Mathematics leans on most.'),
      ]),
    ]},

    'physics': { igcse: '0625', chapters: [
      ch('Speed, Distance & Time', 1, CORE, [
        'Speed is the distance covered each second: speed = distance ÷ time. A cyclist who travels 300 m in 60 s has an average speed of 5 m/s.',
        'On a distance–time graph a steeper line means a faster speed, and a flat line means the object has stopped. On a speed–time graph the slope is the acceleration and the area under the line is the distance travelled.',
      ], [
        def('Acceleration — how quickly velocity changes: change in velocity ÷ time taken, measured in m/s².'),
        tip('Write the units at every step. If the units come out wrong, the method usually is too.'),
      ]),
      ch('Forces & Motion', 1, CORE, [
        'A force is a push or a pull, measured in newtons (N). When the forces on an object are balanced it stays still or keeps moving at a steady speed; when they are unbalanced it speeds up, slows down or changes direction.',
        'The resultant force and the acceleration it causes are linked by F = ma. A 2 kg trolley with a resultant force of 6 N on it accelerates at 3 m/s².',
      ], [
        def('Resultant force — the single force that has the same effect as all the forces on an object together.'),
        rem('Weight is a force, W = mg, measured in newtons. Mass is the amount of matter, measured in kilograms.'),
      ]),
      ch('Electric Circuits', 1, CORE, [
        'Current is the flow of charge, measured in amps with an ammeter placed in series. Potential difference (voltage) is measured in volts with a voltmeter placed in parallel across a component.',
        'Resistance links the two: V = IR. A 12 V supply driving 2 A through a lamp means the lamp has a resistance of 6 Ω.',
      ], [
        def('Resistance — how much a component opposes the flow of current, measured in ohms (Ω).'),
        tip('In a series circuit the current is the same everywhere; in a parallel circuit the voltage across each branch is the same.'),
      ]),
      ch('Looking Ahead: Kinematics at AS', 2, 'Bridge to AS · Papers 1–2', [
        'At AS, motion is described with vectors — quantities with a direction as well as a size — and with the equations of uniformly accelerated motion, such as v = u + at.',
        'The graphs you already know carry straight over: the gradient of a velocity–time graph is still acceleration, and the area under it is still displacement.',
      ], [
        tip('Get used to rearranging equations like v = u + at now. At AS you will do it in almost every question.'),
      ]),
    ]},

    'chemistry': { igcse: '0620', chapters: [
      ch('Atoms & the Periodic Table', 1, CORE, [
        'An atom has a small nucleus of protons and neutrons, with electrons arranged in shells around it. The number of protons — the atomic number — decides which element it is.',
        'Elements in the same group of the Periodic Table have the same number of electrons in their outer shell, which is why they react in similar ways. The Group 1 metals all have one outer electron, and all react with water.',
      ], [
        def('Isotopes — atoms of the same element with the same number of protons but different numbers of neutrons.'),
        tip('The first shell holds up to 2 electrons and the next two up to 8 each, so sodium, with 11 electrons, is 2,8,1.'),
      ]),
      ch('Bonding', 1, CORE, [
        'A metal and a non-metal usually form an ionic bond: the metal loses electrons and becomes a positive ion, the non-metal gains them and becomes a negative ion, and the opposite charges attract.',
        'Two non-metals form covalent bonds instead, sharing pairs of electrons so that each atom has a full outer shell. A water molecule, H₂O, has two covalent bonds.',
      ], [
        def('Ion — an atom or group of atoms that has gained or lost electrons, and so carries a charge.'),
        rem('Ionic compounds conduct electricity when molten or dissolved in water, but not as solids.'),
      ]),
      ch('Moles & Equations', 1, CORE, [
        'A balanced equation has the same number of each type of atom on both sides. In 2H₂ + O₂ → 2H₂O there are four hydrogen atoms and two oxygen atoms on each side.',
        'Chemists count particles in moles. One mole of a substance has a mass equal to its relative formula mass in grams, so 18 g of water is one mole, and moles = mass ÷ molar mass.',
      ], [
        def('Mole — the amount of substance containing 6.02 × 10²³ particles.'),
        tip('When balancing, change only the big numbers in front of formulas — never the small ones inside them.'),
      ]),
      ch('Looking Ahead: Stoichiometry at AS', 2, 'Bridge to AS · Papers 1–2', [
        'AS Chemistry opens by taking moles further, into gases, solutions and reacting masses: concentration = moles ÷ volume in dm³, and one mole of any gas takes up 24 dm³ at room temperature and pressure.',
        'Electron shells are split into subshells — s, p and d — which explain the shape of the Periodic Table in more detail than the 2,8,8 pattern does.',
      ], [
        tip('Mole calculations are the most-used skill in AS Chemistry. Make them automatic now.'),
      ]),
    ]},

    'biology': { igcse: '0610', chapters: [
      ch('Cells', 1, CORE, [
        'Animal and plant cells both have a nucleus, cytoplasm, a cell membrane, mitochondria and ribosomes. Plant cells also have a cell wall, a large permanent vacuole and chloroplasts.',
        'Specialised cells are adapted to their job. A red blood cell has no nucleus, leaving more room for haemoglobin to carry oxygen; a root hair cell has a long extension that gives a large surface area for taking in water.',
      ], [
        def('Mitochondria — where aerobic respiration happens, releasing energy for the cell.'),
        tip('When asked how a cell is adapted, name the feature and then say what it lets the cell do.'),
      ]),
      ch('Movement In & Out of Cells', 1, CORE, [
        'Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration. It needs no energy from the cell; oxygen enters cells this way.',
        'Osmosis is the diffusion of water across a partially permeable membrane, from a dilute solution to a more concentrated one. Active transport moves substances against a concentration gradient and does need energy from respiration.',
      ], [
        def('Partially permeable membrane — a membrane that lets some molecules through, such as water, but not others.'),
        rem('Diffusion and osmosis are passive. Only active transport uses energy.'),
      ]),
      ch('Enzymes', 1, CORE, [
        'Enzymes are proteins that act as biological catalysts: they speed up reactions without being used up. Each enzyme has an active site whose shape fits only its own substrate.',
        'Enzymes work fastest at an optimum temperature. Too hot, and the active site changes shape so the substrate no longer fits — the enzyme is denatured.',
      ], [
        def('Denatured — an enzyme whose active site has permanently changed shape, so it can no longer work.'),
        tip('Write that the active site changes shape, not that the enzyme is killed. Enzymes are not alive.'),
      ]),
      ch('Looking Ahead: Biological Molecules at AS', 2, 'Bridge to AS · Papers 1–2', [
        'AS Biology looks inside the molecules you met at IGCSE: how amino acids join to make proteins, why a protein’s folded shape matters, and how carbohydrates and lipids are built.',
        'Cells are studied under the electron microscope too, which shows organelles such as the endoplasmic reticulum and the Golgi body that a light microscope cannot.',
      ], [
        tip('Learn the IGCSE cell structures thoroughly now. AS adds detail to each of them rather than replacing them.'),
      ]),
    ]},

    'economics': { igcse: '0455', chapters: [
      ch('Scarcity & Choice', 1, CORE, [
        'Resources are limited but wants are not, so every person, firm and government has to choose. That is the basic economic problem.',
        'Choosing one thing means giving up the next best alternative. If you spend Saturday working, the opportunity cost might be the match you could have gone to.',
      ], [
        def('Opportunity cost — the next best alternative given up when a choice is made.'),
        tip('Name the specific alternative given up, rather than writing "something else".'),
      ]),
      ch('Demand & Supply', 1, CORE, [
        'Demand is how much consumers are willing and able to buy at each price. As the price rises the quantity demanded usually falls, so a demand curve slopes downwards.',
        'Supply is how much producers are willing and able to sell. Where the two curves cross is the equilibrium price: the price at which the amount people want to buy equals the amount firms want to sell.',
      ], [
        def('Equilibrium price — the price at which quantity demanded equals quantity supplied.'),
        rem('A change in price is a movement along a curve. A change in anything else, such as income, shifts the whole curve.'),
      ]),
      ch('Government & the Economy', 1, CORE, [
        'Governments aim for economic growth, low unemployment, stable prices and a healthy balance of payments — and cannot always have all four at once.',
        'Taxes and government spending are their main tools. Cutting taxes leaves people more to spend, which can create jobs but may also push prices up.',
      ], [
        def('Inflation — a sustained rise in the general level of prices.'),
        tip('In a "discuss" answer, give the effect and then a reason it might not happen. That balance is where the higher marks are.'),
      ]),
      ch('Looking Ahead: Elasticity at AS', 2, 'Bridge to AS · Papers 1–2', [
        'At AS you measure how strongly demand responds to a change in price. Price elasticity of demand compares the percentage change in quantity demanded with the percentage change in price.',
        'It explains why a firm selling a necessity can raise its price and still earn more, while a firm selling a luxury may lose sales. Demand and supply diagrams stay the core tool throughout.',
      ], [
        tip('Draw a demand and supply diagram for every topic you revise, labelling the axes, the curves and the equilibrium each time.'),
      ]),
    ]},

    'english-literature': { igcse: '0475', chapters: [
      ch('Reading a Poem Closely', 1, CORE, [
        'Start with what the poem is about, in a sentence of your own. Then look at how it says it: the words it chooses, the pictures it builds and how it sounds read aloud.',
        'A good point names a technique, quotes a short piece of the poem as evidence and explains its effect on the reader. "The poet uses a metaphor" earns little; saying what the metaphor makes us see or feel earns the marks.',
      ], [
        def('Imagery — language that creates a picture in the reader’s mind, often by appealing to the senses.'),
        tip('Keep quotations short — a few words, worked into your own sentence.'),
      ]),
      ch('Character & Theme', 1, CORE, [
        'Characters are made by a writer, so write about them as creations: what the writer shows us through what a character says and does, and how others react to them.',
        'A theme is a big idea a text keeps coming back to, such as power, love or guilt. Track where it appears and how it changes between the beginning and the end.',
      ], [
        def('Theme — a central idea a text explores, such as ambition or loss.'),
        rem('Use the writer’s name — "Shakespeare presents Macbeth as…" — to keep the focus on the writer’s choices.'),
      ]),
      ch('Writing a Literature Essay', 1, CORE, [
        'Answer the question in your first sentence, so the examiner knows your argument from the start. Each paragraph then makes one point that supports it.',
        'Make the point, give a short quotation as evidence, explain what it shows, and end the paragraph by linking back to the question.',
      ], [
        tip('Spend five minutes planning. A short plan stops an essay drifting away from the question halfway through.'),
      ]),
      ch('Looking Ahead: Unseen Poetry at AS', 2, 'Bridge to AS · Paper 1 Poetry & Prose', [
        'At AS you write about poems you have never seen before, against the clock. The habits in this notebook — a clear argument, short quotations, effects explained — carry straight over.',
        'What changes is the depth: AS asks how form and structure shape meaning, such as why a poem is a sonnet or where its tone turns.',
      ], [
        tip('Read poems on your own now. Every one you read makes an unseen poem in the exam feel less unfamiliar.'),
      ]),
    ]},

    'computer-science': { igcse: '0478', chapters: [
      ch('Binary & Data', 1, CORE, [
        'Computers store everything in binary, as 1s and 0s. Each binary digit is a bit, and 8 bits make a byte, which can hold 256 different values, from 0 to 255.',
        'To convert binary to denary, add up the place values wherever there is a 1. From the right, the place values are 1, 2, 4, 8, 16, 32, 64 and 128, so 00001101 is 8 + 4 + 1 = 13.',
      ], [
        def('Bit — a single binary digit, either 0 or 1.'),
        tip('Write the place values above the binary number before you convert it. It prevents most mistakes.'),
      ]),
      ch('Algorithms', 1, CORE, [
        'An algorithm is a set of step-by-step instructions that solves a problem. It can be written as pseudocode or drawn as a flowchart.',
        'Three building blocks make up every algorithm: sequence (steps in order), selection (IF a condition holds, do this) and iteration (repeat steps in a loop).',
      ], [
        def('Iteration — repeating a set of instructions with a FOR, WHILE or REPEAT loop.'),
        tip('Check an algorithm by tracing it by hand in a trace table, one row per step.'),
      ]),
      ch('Networks & the Internet', 1, CORE, [
        'A network connects devices so they can share data and resources. A LAN covers a small area such as a school; a WAN covers a large one, and the internet is the largest WAN of all.',
        'Data crosses a network in packets. Each packet carries part of the data and a header with the destination address, and packets can take different routes before being put back together in order.',
      ], [
        def('Packet — a small unit of data sent across a network, with a header saying where it is going.'),
        rem('The internet is the network itself; the World Wide Web is the collection of web pages reached through it.'),
      ]),
      ch('Looking Ahead: Data Representation at AS', 2, 'Bridge to AS · Papers 1–2', [
        'AS Computer Science extends binary to negative numbers with two’s complement, and to hexadecimal, which writes each group of four bits as a single character from 0 to F.',
        'Algorithms become more formal too: you write them in Cambridge pseudocode and study searching and sorting methods in detail.',
      ], [
        tip('Practise binary-to-denary conversions until they are quick. AS questions build on them from the first week.'),
      ]),
    ]},
  };

  // The rest of the subjects on the guide's list live in subject-notes.js,
  // which the pages load beside this file. Looked up when asked for rather
  // than at load, so the order the two scripts load in does not matter.
  var injectedNotes = null;
  function _useNotes(n) { injectedNotes = n; }
  function notes() {
    if (injectedNotes) return injectedNotes;
    try { return (typeof window !== 'undefined' && window.notivloSubjectNotes) || null; } catch (e) { return null; }
  }
  function own(obj, key) { return !!obj && Object.prototype.hasOwnProperty.call(obj, key); }

  function foundationFor(slug) {
    if (own(FOUNDATION, slug)) return FOUNDATION[slug];
    var n = notes();
    return n && own(n.FOUNDATION, slug) ? n.FOUNDATION[slug] : null;
  }

  // The A level notebook subject-notes.js has for this slug, or null. The
  // seven subjects the notebook page carries itself are not in here.
  function base(slug) {
    var n = notes();
    return n && own(n.BASE, slug) ? n.BASE[slug] : null;
  }

  // Whether a notebook with this slug starts with notes rather than a blank
  // chapter — at any level. Every subject with an A level notebook has an
  // IGCSE-stage one too, so FOUNDATION is the whole list.
  function hasNotes(slug) { return !!foundationFor(slug); }

  // "Cambridge IGCSE 0470 → 9489": the IGCSE the notes sit on, then the A
  // level the notebook leads to. The A level number goes last because the
  // notebook takes the last four-digit number on the line as the syllabus to
  // ask for a written lesson on.
  function foundationSubject(f, baseNb) {
    var codes = String((baseNb && baseNb.subject) || '').match(/\d{4}/g);
    var to = codes ? codes[codes.length - 1] : '';
    if (f.igcse) return 'Cambridge IGCSE ' + f.igcse + (to ? ' → ' + to : '');
    return to ? 'Before A level → Cambridge ' + to : 'Before A level';
  }

  function copyChapters(list) {
    return list.map(function (c) {
      return {
        title: c.title, unit: c.unit, unitName: c.unitName,
        paragraphs: c.paragraphs.slice(),
        notes: c.notes.map(function (n) { return { type: n.type, label: n.label, text: n.text }; }),
      };
    });
  }

  // A built-in notebook as a student at `level` should first see it. `base`
  // is the page's own example notebook — { title, subject, activeIdx,
  // chapters } with AS chapters in unit 1 and A Level ones in unit 2. With
  // no level, or nothing written for this subject at that level, `base`
  // comes back unchanged, which is the notebook every student saw before
  // levels existed.
  function leveled(slug, base, level) {
    if (!base || !LEVELS[level]) return base;
    var chapters = Array.isArray(base.chapters) ? base.chapters : [];
    if (level === 'foundation') {
      var f = foundationFor(slug);
      if (!f) return base;
      return { title: base.title, subject: foundationSubject(f, base), activeIdx: 0, chapters: copyChapters(f.chapters), level: level };
    }
    if (level === 'as') {
      var asOnly = chapters.filter(function (c) { return c && c.unit === 1; });
      if (!asOnly.length) return base;
      return { title: base.title, subject: base.subject, activeIdx: 0, chapters: asOnly, level: level };
    }
    // a2: everything, opened on the first A Level chapter.
    var first = -1;
    for (var i = 0; i < chapters.length; i++) if (chapters[i] && chapters[i].unit === 2) { first = i; break; }
    return {
      title: base.title, subject: base.subject,
      activeIdx: first >= 0 ? first : (base.activeIdx || 0),
      chapters: chapters, level: level,
    };
  }

  return {
    LEVELS: LEVELS,
    SYSTEMS: SYSTEMS,
    GOALS: GOALS,
    goalById: goalById,
    readGoal: readGoal,
    writeGoal: writeGoal,
    DEFAULT_SYSTEM: DEFAULT_SYSTEM,
    FOUNDATION: FOUNDATION,
    systemById: systemById,
    levelFor: levelFor,
    guessSystem: guessSystem,
    browserLocales: browserLocales,
    read: read,
    write: write,
    leveled: leveled,
    base: base,
    hasNotes: hasNotes,
    _useStorage: _useStorage,
    _useNotes: _useNotes,
  };
}));
