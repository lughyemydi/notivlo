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
 * The exam, and how they are schooled
 * -----------------------------------
 * Since 25 November 2026 the student also says, on its own page straight
 * after sign-up (School.dc.html), whether they are at a public or private
 * school or homeschooled, and which exam they are working towards — the bac,
 * GCSEs, a US diploma, A levels… (QUALS, below). The exam is what practice
 * papers (exam-bank.js), marks (SCALES / markOn) and AI lessons follow; the
 * level above still only picks where the built-in notebooks start.
 *
 * Where the answer lives
 * ----------------------
 * `folio_prefs.school` — { system, grade, level, account }, and
 * `folio_prefs.schooling` — { type, qual, account }. folio_prefs is
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

  // Each system lists the years worth asking about — the ones before the
  // final school exams through to the end of school — under the names that
  // system uses. The first grade in each list sweeps up everyone younger.
  // `regions` are the ISO country codes whose browsers default to it; the
  // student can always change the system, so a wrong guess costs one tap.
  //
  // `quals` are the system's own exams, in the order a student meets them
  // (see QUALS below); the international ones are offered to everyone on top.
  // A grade's fourth field is the exam a student in that year is most likely
  // working towards, which the "about your schooling" page picks for them
  // until they pick something else: a French Seconde is aiming at the bac,
  // because the brevet is already behind them.
  function g(id, label, level, target) { return { id: id, label: label, level: level, target: target || '' }; }

  var SYSTEMS = [
    {
      id: 'cambridge', label: 'International school (Cambridge, Edexcel)',
      regions: [],
      quals: ['igcse', 'o-level', 'as-level', 'a-level'],
      grades: [
        g('pre-igcse', 'Before IGCSE', 'foundation', 'igcse'),
        g('igcse-1', 'IGCSE, first year', 'foundation', 'igcse'),
        g('igcse-2', 'IGCSE, second year', 'foundation', 'igcse'),
        g('as', 'AS Level', 'as', 'a-level'),
        g('a2', 'A Level (A2)', 'a2', 'a-level'),
      ],
    },
    {
      id: 'uk', label: 'England, Wales or Northern Ireland',
      regions: ['GB', 'IM', 'JE', 'GG', 'GI'],
      quals: ['gcse', 'a-level'],
      grades: [
        g('y9', 'Year 9 or below', 'foundation', 'gcse'),
        g('y10', 'Year 10', 'foundation', 'gcse'),
        g('y11', 'Year 11', 'foundation', 'gcse'),
        g('y12', 'Year 12 (Lower Sixth)', 'as', 'a-level'),
        g('y13', 'Year 13 (Upper Sixth)', 'a2', 'a-level'),
      ],
    },
    {
      id: 'scotland', label: 'Scotland',
      regions: [],
      quals: ['nat5', 'higher', 'adv-higher'],
      grades: [
        g('s3', 'S3 or below', 'foundation', 'nat5'),
        g('s4', 'S4', 'foundation', 'nat5'),
        g('s5', 'S5', 'as', 'higher'),
        g('s6', 'S6', 'a2', 'adv-higher'),
      ],
    },
    {
      id: 'ireland', label: 'Ireland',
      regions: ['IE'],
      quals: ['junior-cycle', 'leaving-cert'],
      grades: [
        g('y3', 'Third Year or below', 'foundation', 'junior-cycle'),
        g('ty', 'Transition Year', 'foundation', 'leaving-cert'),
        g('y5', 'Fifth Year', 'as', 'leaving-cert'),
        g('y6', 'Sixth Year', 'a2', 'leaving-cert'),
      ],
    },
    {
      id: 'us', label: 'United States',
      regions: ['US', 'PR', 'GU', 'VI', 'AS', 'MP'],
      quals: ['us-diploma', 'sat', 'act', 'ap', 'ged'],
      grades: [
        g('g8', 'Grade 8 or below', 'foundation', 'us-diploma'),
        g('g9', 'Grade 9 (Freshman)', 'foundation', 'us-diploma'),
        g('g10', 'Grade 10 (Sophomore)', 'foundation', 'us-diploma'),
        g('g11', 'Grade 11 (Junior)', 'as', 'us-diploma'),
        g('g12', 'Grade 12 (Senior)', 'a2', 'us-diploma'),
      ],
    },
    {
      id: 'canada', label: 'Canada',
      regions: ['CA'],
      quals: ['ca-diploma'],
      grades: [
        g('g8', 'Grade 8 or below', 'foundation', 'ca-diploma'),
        g('g9', 'Grade 9', 'foundation', 'ca-diploma'),
        g('g10', 'Grade 10', 'foundation', 'ca-diploma'),
        g('g11', 'Grade 11', 'as', 'ca-diploma'),
        g('g12', 'Grade 12', 'a2', 'ca-diploma'),
      ],
    },
    {
      // Kept under its old id: accounts that answered "grades" before the US
      // and Canada had their own entries still read back correctly.
      id: 'grades', label: 'Grades 1–12 (the Gulf, the Philippines, Latin America…)',
      regions: ['PH', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'LK', 'CO', 'CL', 'PE', 'AR', 'UY', 'EC', 'BO', 'PY', 'VE', 'TH', 'ID'],
      quals: ['national-leaving'],
      grades: [
        g('g8', 'Grade 8 or below', 'foundation', 'national-leaving'),
        g('g9', 'Grade 9', 'foundation', 'national-leaving'),
        g('g10', 'Grade 10', 'foundation', 'national-leaving'),
        g('g11', 'Grade 11', 'as', 'national-leaving'),
        g('g12', 'Grade 12', 'a2', 'national-leaving'),
      ],
    },
    {
      id: 'classes', label: 'India or Nepal',
      regions: ['IN', 'NP'],
      quals: ['cbse-10', 'cbse-12', 'icse', 'isc', 'state-board', 'jee', 'neet', 'np-see', 'np-neb'],
      grades: [
        g('c8', 'Class 8 or below', 'foundation', 'cbse-10'),
        g('c9', 'Class 9', 'foundation', 'cbse-10'),
        g('c10', 'Class 10', 'foundation', 'cbse-10'),
        g('c11', 'Class 11', 'as', 'cbse-12'),
        g('c12', 'Class 12', 'a2', 'cbse-12'),
      ],
    },
    {
      id: 'pakistan', label: 'Pakistan',
      regions: ['PK'],
      quals: ['pk-ssc', 'pk-hssc', 'mdcat'],
      grades: [
        g('c8', 'Class 8 or below', 'foundation', 'pk-ssc'),
        g('c9', 'Class 9 (Matric, part 1)', 'foundation', 'pk-ssc'),
        g('c10', 'Class 10 (Matric)', 'foundation', 'pk-ssc'),
        g('c11', 'First year (FSc / FA, part 1)', 'as', 'pk-hssc'),
        g('c12', 'Second year (FSc / FA, part 2)', 'a2', 'pk-hssc'),
      ],
    },
    {
      id: 'bangladesh', label: 'Bangladesh',
      regions: ['BD'],
      quals: ['bd-ssc', 'bd-hsc'],
      grades: [
        g('c8', 'Class 8 or below', 'foundation', 'bd-ssc'),
        g('c9', 'Class 9', 'foundation', 'bd-ssc'),
        g('c10', 'Class 10 (SSC)', 'foundation', 'bd-ssc'),
        g('c11', 'Class 11 (HSC, first year)', 'as', 'bd-hsc'),
        g('c12', 'Class 12 (HSC)', 'a2', 'bd-hsc'),
      ],
    },
    {
      id: 'australia', label: 'Australia',
      regions: ['AU'],
      quals: ['atar'],
      grades: [
        g('y9', 'Year 9 or below', 'foundation', 'atar'),
        g('y10', 'Year 10', 'foundation', 'atar'),
        g('y11', 'Year 11', 'as', 'atar'),
        g('y12', 'Year 12', 'a2', 'atar'),
      ],
    },
    {
      id: 'nz', label: 'New Zealand',
      regions: ['NZ'],
      quals: ['ncea-1', 'ncea-2', 'ncea-3'],
      grades: [
        g('y10', 'Year 10 or below', 'foundation', 'ncea-1'),
        g('y11', 'Year 11 (NCEA Level 1)', 'foundation', 'ncea-1'),
        g('y12', 'Year 12 (NCEA Level 2)', 'as', 'ncea-2'),
        g('y13', 'Year 13 (NCEA Level 3)', 'a2', 'ncea-3'),
      ],
    },
    {
      id: 'singapore', label: 'Singapore',
      regions: ['SG'],
      quals: ['sg-o', 'sg-a'],
      grades: [
        g('sec3', 'Secondary 3 or below', 'foundation', 'sg-o'),
        g('sec4', 'Secondary 4', 'foundation', 'sg-o'),
        g('jc1', 'JC1', 'as', 'sg-a'),
        g('jc2', 'JC2', 'a2', 'sg-a'),
      ],
    },
    {
      // Old id, from when Hong Kong shared it.
      id: 'forms', label: 'Malaysia or Brunei',
      regions: ['MY', 'BN'],
      quals: ['spm', 'stpm'],
      grades: [
        g('f3', 'Form 3 or below', 'foundation', 'spm'),
        g('f4', 'Form 4', 'foundation', 'spm'),
        g('f5', 'Form 5 (SPM)', 'foundation', 'spm'),
        g('l6', 'Form 6 lower / first pre-university year', 'as', 'stpm'),
        g('u6', 'Form 6 upper / second pre-university year', 'a2', 'stpm'),
      ],
    },
    {
      id: 'hong-kong', label: 'Hong Kong or Macau',
      regions: ['HK', 'MO'],
      quals: ['hkdse'],
      grades: [
        g('s3', 'S3 or below', 'foundation', 'hkdse'),
        g('s4', 'S4', 'foundation', 'hkdse'),
        g('s5', 'S5', 'as', 'hkdse'),
        g('s6', 'S6', 'a2', 'hkdse'),
      ],
    },
    {
      id: 'china', label: 'China (mainland)',
      regions: ['CN'],
      quals: ['zhongkao', 'gaokao'],
      grades: [
        g('cz3', 'Junior 3 (初三) or below', 'foundation', 'zhongkao'),
        g('gz1', 'Senior 1 (高一)', 'foundation', 'gaokao'),
        g('gz2', 'Senior 2 (高二)', 'as', 'gaokao'),
        g('gz3', 'Senior 3 (高三)', 'a2', 'gaokao'),
      ],
    },
    {
      id: 'japan', label: 'Japan',
      regions: ['JP'],
      quals: ['jp-hs-entrance', 'jp-common-test'],
      grades: [
        g('c3', 'Junior high 3 (中学3年) or below', 'foundation', 'jp-hs-entrance'),
        g('k1', 'High school 1 (高校1年)', 'foundation', 'jp-common-test'),
        g('k2', 'High school 2 (高校2年)', 'as', 'jp-common-test'),
        g('k3', 'High school 3 (高校3年)', 'a2', 'jp-common-test'),
      ],
    },
    {
      id: 'korea', label: 'South Korea',
      regions: ['KR'],
      quals: ['csat'],
      grades: [
        g('m3', 'Middle school 3 (중3) or below', 'foundation', 'csat'),
        g('h1', 'High school 1 (고1)', 'foundation', 'csat'),
        g('h2', 'High school 2 (고2)', 'as', 'csat'),
        g('h3', 'High school 3 (고3)', 'a2', 'csat'),
      ],
    },
    {
      id: 'vietnam', label: 'Vietnam',
      regions: ['VN'],
      quals: ['vn-grade10', 'vn-thpt'],
      grades: [
        g('l9', 'Lớp 9 or below', 'foundation', 'vn-grade10'),
        g('l10', 'Lớp 10', 'foundation', 'vn-thpt'),
        g('l11', 'Lớp 11', 'as', 'vn-thpt'),
        g('l12', 'Lớp 12', 'a2', 'vn-thpt'),
      ],
    },
    {
      id: 'west-africa', label: 'Nigeria, Ghana and West Africa',
      regions: ['NG', 'GH', 'SL', 'GM', 'LR', 'CM'],
      quals: ['bece', 'wassce', 'neco', 'utme'],
      grades: [
        g('jss3', 'JSS 3 / JHS 3 or below', 'foundation', 'bece'),
        g('ss1', 'SS 1 / SHS 1', 'foundation', 'wassce'),
        g('ss2', 'SS 2 / SHS 2', 'as', 'wassce'),
        g('ss3', 'SS 3 / SHS 3', 'a2', 'wassce'),
      ],
    },
    {
      id: 'east-africa', label: 'Kenya, Uganda, Tanzania',
      regions: ['KE', 'UG', 'TZ', 'RW', 'ZM', 'ZW', 'MW'],
      quals: ['kcse', 'uce', 'uace', 'csee', 'acsee'],
      grades: [
        g('form2', 'Form 2 or below', 'foundation', 'kcse'),
        g('form3', 'Form 3', 'foundation', 'kcse'),
        g('form4', 'Form 4', 'foundation', 'kcse'),
        g('form5', 'Form 5 / Senior 5', 'as', 'uace'),
        g('form6', 'Form 6 / Senior 6', 'a2', 'uace'),
      ],
    },
    {
      id: 'south-africa', label: 'South Africa',
      regions: ['ZA', 'NA', 'BW', 'LS', 'SZ'],
      quals: ['za-nsc', 'za-ieb'],
      grades: [
        g('gr9', 'Grade 9 or below', 'foundation', 'za-nsc'),
        g('gr10', 'Grade 10', 'foundation', 'za-nsc'),
        g('gr11', 'Grade 11', 'as', 'za-nsc'),
        g('gr12', 'Grade 12 (Matric)', 'a2', 'za-nsc'),
      ],
    },
    {
      id: 'egypt', label: 'Egypt',
      regions: ['EG'],
      quals: ['eg-thanaweya'],
      grades: [
        g('p3', 'Third preparatory or below', 'foundation', 'eg-thanaweya'),
        g('s1', 'First secondary', 'foundation', 'eg-thanaweya'),
        g('s2', 'Second secondary', 'as', 'eg-thanaweya'),
        g('s3', 'Third secondary (Thanaweya Amma)', 'a2', 'eg-thanaweya'),
      ],
    },
    {
      id: 'ib', label: 'International Baccalaureate',
      regions: [],
      quals: ['ib-myp', 'ib-dp'],
      grades: [
        g('myp3', 'MYP 3 or below', 'foundation', 'ib-myp'),
        g('myp4', 'MYP 4', 'foundation', 'ib-myp'),
        g('myp5', 'MYP 5', 'foundation', 'ib-myp'),
        g('dp1', 'Diploma, first year', 'as', 'ib-dp'),
        g('dp2', 'Diploma, second year', 'a2', 'ib-dp'),
      ],
    },
    {
      id: 'france', label: 'France (and French schools abroad)',
      regions: ['FR', 'MC', 'LU', 'MA', 'TN', 'DZ', 'SN', 'CI', 'RE', 'GP', 'MQ', 'GF', 'YT', 'NC', 'PF'],
      quals: ['brevet', 'bac', 'bac-pro'],
      grades: [
        g('3e', 'Troisième or below', 'foundation', 'brevet'),
        g('2de', 'Seconde', 'foundation', 'bac'),
        g('1re', 'Première', 'as', 'bac'),
        g('tle', 'Terminale', 'a2', 'bac'),
      ],
    },
    {
      id: 'germany', label: 'Germany',
      regions: ['DE'],
      quals: ['msa', 'abitur'],
      grades: [
        g('k9', 'Klasse 9 or below', 'foundation', 'msa'),
        g('k10', 'Klasse 10', 'foundation', 'msa'),
        g('k11', 'Klasse 11', 'as', 'abitur'),
        g('k12', 'Klasse 12', 'a2', 'abitur'),
        g('k13', 'Klasse 13', 'a2', 'abitur'),
      ],
    },
    {
      id: 'austria', label: 'Austria',
      regions: ['AT'],
      quals: ['matura-at'],
      grades: [
        g('k5', '5. Klasse (9. Schulstufe) or below', 'foundation', 'matura-at'),
        g('k6', '6. Klasse', 'foundation', 'matura-at'),
        g('k7', '7. Klasse', 'as', 'matura-at'),
        g('k8', '8. Klasse (Maturaklasse)', 'a2', 'matura-at'),
      ],
    },
    {
      id: 'switzerland', label: 'Switzerland or Liechtenstein',
      regions: ['CH', 'LI'],
      quals: ['matura-ch'],
      grades: [
        g('y9', '9th school year (11H) or below', 'foundation', 'matura-ch'),
        g('y10', '10th school year', 'foundation', 'matura-ch'),
        g('y11', '11th school year', 'as', 'matura-ch'),
        g('y12', '12th school year (Maturajahr)', 'a2', 'matura-ch'),
      ],
    },
    {
      id: 'spain', label: 'Spain',
      regions: ['ES', 'AD'],
      quals: ['eso', 'pau'],
      grades: [
        g('eso3', '3º ESO or below', 'foundation', 'eso'),
        g('eso4', '4º ESO', 'foundation', 'eso'),
        g('bach1', '1º Bachillerato', 'as', 'pau'),
        g('bach2', '2º Bachillerato', 'a2', 'pau'),
      ],
    },
    {
      id: 'italy', label: 'Italy',
      regions: ['IT', 'SM', 'VA'],
      quals: ['licenza-media', 'maturita'],
      grades: [
        g('m3', 'Terza media or below', 'foundation', 'licenza-media'),
        g('s1', 'Primo anno di superiori', 'foundation', 'maturita'),
        g('s2', 'Secondo anno', 'foundation', 'maturita'),
        g('s3', 'Terzo anno', 'as', 'maturita'),
        g('s4', 'Quarto anno', 'a2', 'maturita'),
        g('s5', 'Quinto anno (Maturità)', 'a2', 'maturita'),
      ],
    },
    {
      id: 'portugal', label: 'Portugal',
      regions: ['PT'],
      quals: ['pt-9', 'pt-sec'],
      grades: [
        g('a9', '9.º ano or below', 'foundation', 'pt-9'),
        g('a10', '10.º ano', 'foundation', 'pt-sec'),
        g('a11', '11.º ano', 'as', 'pt-sec'),
        g('a12', '12.º ano', 'a2', 'pt-sec'),
      ],
    },
    {
      id: 'netherlands', label: 'Netherlands',
      regions: ['NL'],
      quals: ['nl-vmbo', 'nl-havo', 'nl-vwo'],
      grades: [
        g('k3', 'Klas 3 or below', 'foundation', 'nl-havo'),
        g('k4', 'Klas 4', 'foundation', 'nl-havo'),
        g('k5', 'Klas 5', 'as', 'nl-havo'),
        g('k6', 'Klas 6 (vwo)', 'a2', 'nl-vwo'),
      ],
    },
    {
      id: 'poland', label: 'Poland',
      regions: ['PL'],
      quals: ['pl-e8', 'pl-matura'],
      grades: [
        g('k8', 'Klasa 8 (szkoła podstawowa) or below', 'foundation', 'pl-e8'),
        g('l1', 'Liceum, klasa 1', 'foundation', 'pl-matura'),
        g('l2', 'Liceum, klasa 2', 'as', 'pl-matura'),
        g('l3', 'Liceum, klasa 3', 'a2', 'pl-matura'),
        g('l4', 'Liceum, klasa 4', 'a2', 'pl-matura'),
      ],
    },
    {
      id: 'russia', label: 'Russia or Belarus',
      regions: ['RU', 'BY'],
      quals: ['oge', 'ege'],
      grades: [
        g('k8', '8th grade (8 класс) or below', 'foundation', 'oge'),
        g('k9', '9th grade (9 класс)', 'foundation', 'oge'),
        g('k10', '10th grade (10 класс)', 'as', 'ege'),
        g('k11', '11th grade (11 класс)', 'a2', 'ege'),
      ],
    },
    {
      id: 'turkey', label: 'Türkiye',
      regions: ['TR'],
      quals: ['lgs', 'yks'],
      grades: [
        g('s8', '8. sınıf or below', 'foundation', 'lgs'),
        g('s9', '9. sınıf', 'foundation', 'yks'),
        g('s10', '10. sınıf', 'foundation', 'yks'),
        g('s11', '11. sınıf', 'as', 'yks'),
        g('s12', '12. sınıf', 'a2', 'yks'),
      ],
    },
    {
      id: 'brazil', label: 'Brazil',
      regions: ['BR'],
      quals: ['enem'],
      grades: [
        g('ef9', '9º ano (Ensino Fundamental) or below', 'foundation', 'enem'),
        g('em1', '1ª série (Ensino Médio)', 'foundation', 'enem'),
        g('em2', '2ª série', 'as', 'enem'),
        g('em3', '3ª série', 'a2', 'enem'),
      ],
    },
    {
      id: 'mexico', label: 'Mexico',
      regions: ['MX'],
      quals: ['mx-exani'],
      grades: [
        g('s3', '3º de secundaria or below', 'foundation', 'mx-exani'),
        g('p1', '1º de preparatoria / bachillerato', 'foundation', 'mx-exani'),
        g('p2', '2º de preparatoria', 'as', 'mx-exani'),
        g('p3', '3º de preparatoria', 'a2', 'mx-exani'),
      ],
    },
    {
      // For anyone whose system is not listed, or who would rather not work
      // out what theirs is called. Age at the start of the school year.
      id: 'age', label: 'None of these — go by my age',
      regions: [],
      quals: ['national-leaving'],
      grades: [
        g('14', '14 or younger', 'foundation', ''),
        g('15', '15', 'foundation', ''),
        g('16', '16', 'as', ''),
        g('17', '17', 'a2', ''),
        g('18', '18 or older', 'a2', ''),
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

  // --- how the student is schooled, and the exam they are aiming at ---------
  // The page straight after sign-up (School.dc.html) asks three things before
  // anything else: what kind of school, which system, and which exam. The
  // exam is the one that matters most: it is what the student's practice
  // papers are written for, what their marks are converted to, and what an
  // AI lesson is pitched at. A French Seconde student aiming at the bac sees
  // bac papers marked out of 20; a homeschooled student aiming at A levels
  // sees A level papers marked A* to U.

  var SCHOOLING = [
    { id: 'public', label: 'A public (state) school',
      note: 'We start from your country’s national exams.' },
    { id: 'private', label: 'A private or international school',
      note: 'National exams and international ones — pick whichever your school prepares you for.' },
    { id: 'home', label: 'I’m homeschooled',
      note: 'You can sit most of these as a private candidate, wherever you live — pick the one you are working towards.' },
  ];

  function schoolingById(id) {
    for (var i = 0; i < SCHOOLING.length; i++) if (SCHOOLING[i].id === id) return SCHOOLING[i];
    return null;
  }

  /* Marking scales. A paper is marked in raw marks; the result is then shown
   * the way the student's own exam reports it. Every conversion here is
   * indicative — real boundaries move every session — and the page says so.
   *
   *   bands   [label, minimum %] from the top; `below` for anything lower
   *   score   a number from min to max, rounded to `step`, with optional
   *           `bands` naming ranges of that score (mentions, levels…) and a
   *           `pass` mark
   */
  function bands(list, below, pass) { return { kind: 'bands', bands: list, below: below, pass: pass }; }
  function score(min, max, step, opts) {
    var o = opts || {};
    return { kind: 'score', min: min, max: max, step: step, pass: o.pass, bands: o.bands || null, suffix: o.suffix || '', below: o.below || '' };
  }

  var SCALES = {
    'a-level':  bands([['A*', 90], ['A', 80], ['B', 70], ['C', 60], ['D', 50], ['E', 40]], 'U', 'E'),
    'as-level': bands([['A', 80], ['B', 70], ['C', 60], ['D', 50], ['E', 40]], 'U', 'E'),
    'igcse':    bands([['A*', 90], ['A', 80], ['B', 70], ['C', 60], ['D', 50], ['E', 40], ['F', 30], ['G', 20]], 'U', 'C'),
    'nine-one': bands([['9', 88], ['8', 79], ['7', 70], ['6', 61], ['5', 52], ['4', 43], ['3', 32], ['2', 21], ['1', 10]], 'U', '4'),
    'scot':     bands([['A', 70], ['B', 60], ['C', 50], ['D', 40]], 'No award', 'C'),
    'irl-lc':   bands([['H1', 90], ['H2', 80], ['H3', 70], ['H4', 60], ['H5', 50], ['H6', 40], ['H7', 30]], 'H8', 'H6'),
    'irl-jc':   bands([['Distinction', 90], ['Higher Merit', 75], ['Merit', 55], ['Achieved', 40], ['Partially Achieved', 20]], 'Not Graded', 'Achieved'),
    'letter':   bands([['A', 90], ['B', 80], ['C', 70], ['D', 60]], 'F', 'D'),
    'ap':       bands([['5', 75], ['4', 60], ['3', 45], ['2', 30]], '1', '3'),
    'sat':      score(200, 800, 10, { suffix: ' (section score)' }),
    'act':      score(1, 36, 1, { suffix: ' (ACT scale)' }),
    'ged':      score(100, 200, 1, { pass: 145 }),
    'percent':  score(0, 100, 1, { suffix: '%' }),
    'pct-33':   score(0, 100, 1, { suffix: '%', pass: 33 }),
    'pct-40':   score(0, 100, 1, { suffix: '%', pass: 40 }),
    'pct-50':   score(0, 100, 1, { suffix: '%', pass: 50 }),
    'cbse':     bands([['A1', 91], ['A2', 81], ['B1', 71], ['B2', 61], ['C1', 51], ['C2', 41], ['D', 33]], 'E', 'D'),
    'pk':       bands([['A1', 80], ['A', 70], ['B', 60], ['C', 50], ['D', 40], ['E', 33]], 'F', 'E'),
    'bd-gpa':   bands([['A+ (5.00)', 80], ['A (4.00)', 70], ['A− (3.50)', 60], ['B (3.00)', 50], ['C (2.00)', 40], ['D (1.00)', 33]], 'F', 'D (1.00)'),
    'np-gpa':   bands([['A+ (4.0)', 90], ['A (3.6)', 80], ['B+ (3.2)', 70], ['B (2.8)', 60], ['C+ (2.4)', 50], ['C (2.0)', 40], ['D (1.6)', 35]], 'NG', 'D (1.6)'),
    'atar':     bands([['Band 6', 90], ['Band 5', 80], ['Band 4', 70], ['Band 3', 60], ['Band 2', 50]], 'Band 1', 'Band 2'),
    'ncea':     bands([['Excellence', 80], ['Merit', 65], ['Achieved', 50]], 'Not Achieved', 'Achieved'),
    'sg-o':     bands([['A1', 75], ['A2', 70], ['B3', 65], ['B4', 60], ['C5', 55], ['C6', 50], ['D7', 45], ['E8', 40]], 'F9', 'C6'),
    'sg-a':     bands([['A', 70], ['B', 60], ['C', 55], ['D', 50], ['E', 45], ['S', 40]], 'U', 'E'),
    'spm':      bands([['A+', 90], ['A', 80], ['A−', 70], ['B+', 65], ['B', 60], ['C+', 55], ['C', 50], ['D', 45], ['E', 40]], 'G', 'E'),
    'stpm':     bands([['A', 80], ['A−', 75], ['B+', 70], ['B', 65], ['B−', 60], ['C+', 55], ['C', 50], ['C−', 45], ['D+', 40], ['D', 35]], 'F', 'C'),
    'hkdse':    bands([['5**', 85], ['5*', 78], ['5', 70], ['4', 58], ['3', 45], ['2', 33], ['1', 20]], 'U', '2'),
    'waec':     bands([['A1', 75], ['B2', 70], ['B3', 65], ['C4', 60], ['C5', 55], ['C6', 50], ['D7', 45], ['E8', 40]], 'F9', 'C6'),
    'bece':     bands([['Grade 1', 80], ['Grade 2', 70], ['Grade 3', 60], ['Grade 4', 55], ['Grade 5', 50], ['Grade 6', 45], ['Grade 7', 40], ['Grade 8', 35]], 'Grade 9', 'Grade 6'),
    'jamb':     score(0, 400, 1, { pass: 160, suffix: ' / 400' }),
    'kcse':     bands([['A', 80], ['A−', 75], ['B+', 70], ['B', 65], ['B−', 60], ['C+', 55], ['C', 50], ['C−', 45], ['D+', 40], ['D', 35], ['D−', 30]], 'E', 'C+'),
    'ug-uce':   bands([['D1', 80], ['D2', 75], ['C3', 70], ['C4', 65], ['C5', 60], ['C6', 55], ['P7', 50], ['P8', 45]], 'F9', 'P8'),
    'ug-uace':  bands([['A', 80], ['B', 70], ['C', 60], ['D', 50], ['E', 40], ['O', 35]], 'F', 'E'),
    'tz':       bands([['A', 75], ['B', 65], ['C', 45], ['D', 30]], 'F', 'D'),
    'za-nsc':   bands([['Level 7', 80], ['Level 6', 70], ['Level 5', 60], ['Level 4', 50], ['Level 3', 40], ['Level 2', 30]], 'Level 1', 'Level 2'),
    'ib7':      bands([['7', 80], ['6', 70], ['5', 60], ['4', 50], ['3', 40], ['2', 25]], '1', '4'),
    'fr20':     score(0, 20, 0.5, { pass: 10, suffix: '/20', bands: [['mention Très bien', 16], ['mention Bien', 14], ['mention Assez bien', 12], ['admis', 10], ['oral de rattrapage', 8]], below: 'non admis' }),
    'fr-brevet': score(0, 20, 0.5, { pass: 10, suffix: '/20', bands: [['mention Très bien', 16], ['mention Bien', 14], ['mention Assez bien', 12], ['admis', 10]], below: 'non admis' }),
    'de-abi':   bands([['15 Punkte (1+)', 95], ['14 Punkte (1)', 90], ['13 Punkte (1−)', 85], ['12 Punkte (2+)', 80], ['11 Punkte (2)', 75], ['10 Punkte (2−)', 70], ['9 Punkte (3+)', 65], ['8 Punkte (3)', 60], ['7 Punkte (3−)', 55], ['6 Punkte (4+)', 50], ['5 Punkte (4)', 45], ['4 Punkte (4−)', 40], ['3 Punkte (5+)', 33], ['2 Punkte (5)', 27], ['1 Punkt (5−)', 20]], '0 Punkte (6)', '5 Punkte (4)'),
    'de-note':  bands([['1 (sehr gut)', 87], ['2 (gut)', 73], ['3 (befriedigend)', 59], ['4 (ausreichend)', 45], ['5 (mangelhaft)', 18]], '6 (ungenügend)', '4 (ausreichend)'),
    'at5':      bands([['1 (Sehr gut)', 89], ['2 (Gut)', 76], ['3 (Befriedigend)', 63], ['4 (Genügend)', 50]], '5 (Nicht genügend)', '4 (Genügend)'),
    'ch6':      score(1, 6, 0.5, { pass: 4 }),
    'es10':     score(0, 10, 0.1, { pass: 5, suffix: '/10', bands: [['Sobresaliente', 9], ['Notable', 7], ['Bien', 6], ['Suficiente', 5]], below: 'Insuficiente' }),
    'it10':     score(0, 10, 1, { pass: 6, suffix: '/10' }),
    'it100':    score(0, 100, 1, { pass: 60, suffix: '/100' }),
    'pt20':     score(0, 20, 1, { pass: 10, suffix: '/20' }),
    'pt5':      score(1, 5, 1, { pass: 3, suffix: ' (nível)' }),
    'nl10':     score(1, 10, 0.1, { pass: 5.5 }),
    'pl-pct':   score(0, 100, 1, { pass: 30, suffix: '%' }),
    'ru-oge':   bands([['5 (отлично)', 80], ['4 (хорошо)', 60], ['3 (удовлетворительно)', 35]], '2 (неудовлетворительно)', '3 (удовлетворительно)'),
    'ru-ege':   score(0, 100, 1, { suffix: ' / 100 (test score)' }),
    'tr-net':   score(0, 100, 1, { suffix: '% correct' }),
    'enem':     score(300, 900, 1, { suffix: ' (ENEM-style score)' }),
    'mx':       score(700, 1300, 1, { suffix: ' (EXANI-II-style score)' }),
    'gaokao':   score(0, 150, 1, { pass: 90, suffix: ' / 150' }),
    'zhongkao': score(0, 120, 1, { pass: 72, suffix: ' / 120' }),
    'jp100':    score(0, 100, 1, { suffix: ' / 100' }),
    'kr9':      bands([['1등급', 90], ['2등급', 80], ['3등급', 70], ['4등급', 60], ['5등급', 50], ['6등급', 40], ['7등급', 30], ['8등급', 20]], '9등급', '4등급'),
    'vn10':     score(0, 10, 0.25, { pass: 5, suffix: '/10' }),
    'eg-pct':   score(0, 100, 1, { pass: 50, suffix: '%' }),
    'ca-pct':   score(0, 100, 1, { pass: 50, suffix: '%', bands: [['Level 4', 80], ['Level 3', 70], ['Level 2', 60], ['Level 1', 50]], below: 'below Level 1' }),
    'myp7':     bands([['7', 85], ['6', 72], ['5', 60], ['4', 48], ['3', 36], ['2', 20]], '1', '4'),
  };

  // A score of `pct` per cent on a paper, as the scale reports it:
  // { grade, mention, passed, text }. `text` is what the page prints.
  function markOn(scaleId, pct) {
    var sc = SCALES[scaleId] || SCALES['a-level'];
    var p = Math.max(0, Math.min(100, Number(pct) || 0));
    if (sc.kind === 'bands') {
      for (var i = 0; i < sc.bands.length; i++) {
        if (p >= sc.bands[i][1]) {
          var passIdx = -1;
          for (var j = 0; j < sc.bands.length; j++) if (sc.bands[j][0] === sc.pass) passIdx = j;
          return { grade: sc.bands[i][0], mention: '', passed: passIdx === -1 || i <= passIdx, text: sc.bands[i][0] };
        }
      }
      return { grade: sc.below, mention: '', passed: false, text: sc.below };
    }
    var raw = sc.min + (sc.max - sc.min) * p / 100;
    var val = Math.round(raw / sc.step) * sc.step;
    var digits = sc.step < 1 ? (String(sc.step).split('.')[1] || '').length : 0;
    var shown = digits ? val.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '') : String(Math.round(val));
    var mention = '';
    if (sc.bands) {
      mention = sc.below || '';
      for (var k = 0; k < sc.bands.length; k++) if (val >= sc.bands[k][1]) { mention = sc.bands[k][0]; break; }
    }
    var passed = sc.pass == null ? true : val >= sc.pass;
    return { grade: shown + sc.suffix, mention: mention, passed: passed, text: shown + sc.suffix + (mention ? ' · ' + mention : '') };
  }

  // How a scale reports a result, in a few words: "graded A* to U",
  // "marked out of 20, with mentions".
  function scaleSummary(scaleId) {
    var sc = SCALES[scaleId];
    if (!sc) return '';
    if (sc.kind === 'bands') return 'graded ' + sc.bands[0][0] + ' to ' + sc.below;
    var words = sc.min === 0 ? 'marked out of ' + sc.max : 'scored ' + sc.min + '–' + sc.max;
    if (scaleId === 'fr20' || scaleId === 'fr-brevet') return words + ', with mentions';
    if (sc.bands) return words + ' (' + sc.bands.map(function (b) { return b[0]; }).slice(0, 3).join(', ') + '…)';
    return words;
  }

  /* The exams themselves.
   *
   *   label    the name a student would recognise
   *   short    a few words, for buttons and paper headers
   *   body     who sets it
   *   stage    'lower' (around 15–16) or 'upper' (the end of school)
   *   scale    key into SCALES
   *   paper    one line on what a real paper looks like — shown before a
   *            practice paper, and sent to the lesson writer so its
   *            exam-style questions take the same shape
   *   lang     the language its papers are set in, when that is not English;
   *            practice papers written for it are in that language
   *   intl     offered to students in any system (they are sat worldwide)
   */
  function q(id, label, short, body, stage, scale, paper, extra) {
    var o = { id: id, label: label, short: short, body: body, stage: stage, scale: scale, paper: paper, lang: 'en', intl: false };
    for (var k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  }

  var QUALS_LIST = [
    // International — sat in every country, by schools and private candidates
    q('igcse', 'IGCSE (Cambridge or Edexcel International GCSE)', 'IGCSE', 'Cambridge / Pearson Edexcel', 'lower', 'igcse',
      'Structured and extended written papers, 1½–2½ hours, Core or Extended tier.', { intl: true }),
    q('o-level', 'Cambridge O Level', 'O Level', 'Cambridge International', 'lower', 'igcse',
      'Structured written papers, 1½–2½ hours each.', { intl: true }),
    q('as-level', 'AS Level only', 'AS Level', 'Cambridge / Pearson Edexcel / AQA / OCR', 'upper', 'as-level',
      'Structured questions with marks in brackets, 1¼–2 hours per paper.', { intl: true }),
    q('a-level', 'A Levels', 'A Level', 'Cambridge / Pearson Edexcel / AQA / OCR', 'upper', 'a-level',
      'Structured and essay papers with marks in brackets, point-marked schemes, 1½–3 hours each.', { intl: true }),
    q('ib-myp', 'IB Middle Years Programme', 'IB MYP', 'International Baccalaureate', 'lower', 'myp7',
      'Criterion-based on-screen eAssessments, 2 hours.', { intl: true }),
    q('ib-dp', 'IB Diploma', 'IB Diploma', 'International Baccalaureate', 'upper', 'ib7',
      'Paper 1 / 2 / 3 per subject at SL or HL, 1–3 hours, graded 1–7.', { intl: true }),
    q('ap', 'AP exams (Advanced Placement)', 'AP', 'College Board', 'upper', 'ap',
      'A multiple-choice section, then free-response questions, about 3 hours, scored 1–5.', { intl: true }),
    q('sat', 'SAT', 'SAT', 'College Board', 'upper', 'sat',
      'Digital, adaptive: Reading and Writing, then Math, scored 400–1600.', { intl: true }),
    q('act', 'ACT', 'ACT', 'ACT', 'upper', 'act',
      'Multiple-choice English, Math, Reading (and optional Science), scored 1–36.'),

    // United Kingdom and Ireland
    q('gcse', 'GCSEs', 'GCSE', 'AQA / Edexcel / OCR / WJEC', 'lower', 'nine-one',
      'Written papers of 1½–2 hours, Foundation or Higher tier, graded 9–1.'),
    q('nat5', 'National 5', 'National 5', 'SQA', 'lower', 'scot',
      'A question paper of 1½–2½ hours plus coursework, graded A–D.'),
    q('higher', 'Highers', 'Higher', 'SQA', 'upper', 'scot',
      'Question papers of 2–3 hours plus coursework, graded A–D.'),
    q('adv-higher', 'Advanced Highers', 'Advanced Higher', 'SQA', 'upper', 'scot',
      'A 3-hour question paper plus a project, graded A–D.'),
    q('junior-cycle', 'Junior Cycle', 'Junior Cycle', 'SEC', 'lower', 'irl-jc',
      'A 2-hour final exam per subject plus classroom assessments.'),
    q('leaving-cert', 'Leaving Certificate', 'Leaving Cert', 'SEC', 'upper', 'irl-lc',
      'Higher or Ordinary level papers of 2–3 hours, graded H1–H8 / O1–O8.'),

    // North America
    q('us-diploma', 'High school diploma (graduate high school)', 'High school', 'Your state and school district', 'upper', 'letter',
      'Unit tests and end-of-course exams set by your school or state, graded A–F; a mix of multiple choice and free response.'),
    q('ged', 'GED (high school equivalency)', 'GED', 'GED Testing Service', 'upper', 'ged',
      'Four computer-based tests, scored 100–200; 145 passes each.'),
    q('ca-diploma', 'Provincial high school diploma (OSSD, BC Dogwood, DES…)', 'High school', 'Your province', 'upper', 'ca-pct',
      'Course tests and final exams, reported as a percentage and an achievement level.'),

    // South Asia
    q('cbse-10', 'Class 10 board exams (CBSE / state board)', 'Class 10 boards', 'CBSE or your state board', 'lower', 'cbse',
      'A 3-hour paper of 80 marks: objective, short- and long-answer and case-based sections.'),
    q('cbse-12', 'Class 12 board exams (CBSE / state board)', 'Class 12 boards', 'CBSE or your state board', 'upper', 'cbse',
      'A 3-hour paper of 70–80 marks: objective, short- and long-answer and case-based sections.'),
    q('icse', 'ICSE (Class 10)', 'ICSE', 'CISCE', 'lower', 'pct-33',
      'A 2-hour paper: compulsory Section A, then a choice of Section B questions.'),
    q('isc', 'ISC (Class 12)', 'ISC', 'CISCE', 'upper', 'pct-33',
      'A 3-hour paper of 70–80 marks with section choices.'),
    q('state-board', 'State board exams', 'State board', 'Your state board', 'upper', 'pct-33',
      'A 3-hour written paper set by your state board, marked as a percentage.'),
    q('jee', 'JEE Main / Advanced', 'JEE', 'NTA / IITs', 'upper', 'percent',
      'Computer-based multiple-choice and numerical-answer questions in Physics, Chemistry and Maths, with negative marking.'),
    q('neet', 'NEET-UG', 'NEET', 'NTA', 'upper', 'percent',
      'Multiple-choice Physics, Chemistry and Biology, 3 hours 20 minutes, with negative marking.'),
    q('np-see', 'SEE (Grade 10)', 'SEE', 'National Examinations Board, Nepal', 'lower', 'np-gpa',
      'A 3-hour paper per subject, graded A+ to NG.'),
    q('np-neb', 'NEB Grade 12', 'NEB', 'National Examinations Board, Nepal', 'upper', 'np-gpa',
      'A 3-hour paper per subject, graded A+ to NG.'),
    q('pk-ssc', 'Matric (SSC)', 'Matric', 'Your BISE / FBISE', 'lower', 'pk',
      'An objective (MCQ) part and a subjective part per subject, marked as a percentage and a grade.'),
    q('pk-hssc', 'Intermediate (HSSC — FSc / FA / ICS)', 'Intermediate', 'Your BISE / FBISE', 'upper', 'pk',
      'An objective (MCQ) part and a subjective part per subject, marked as a percentage and a grade.'),
    q('mdcat', 'MDCAT', 'MDCAT', 'PMDC', 'upper', 'percent',
      'Multiple-choice Biology, Chemistry, Physics, English and logical reasoning.'),
    q('bd-ssc', 'SSC', 'SSC', 'Your education board', 'lower', 'bd-gpa',
      'MCQ and creative (structured) questions per subject, graded on GPA 5.'),
    q('bd-hsc', 'HSC', 'HSC', 'Your education board', 'upper', 'bd-gpa',
      'MCQ and creative (structured) questions per subject, graded on GPA 5.'),

    // Asia-Pacific
    q('atar', 'Year 12 certificate and ATAR (HSC, VCE, QCE, WACE, SACE)', 'Year 12 / ATAR', 'Your state’s board', 'upper', 'atar',
      'A 2–3 hour written exam per subject, reported in bands, feeding your ATAR.'),
    q('ncea-1', 'NCEA Level 1', 'NCEA 1', 'NZQA', 'lower', 'ncea',
      'Achievement standards assessed internally and in end-of-year exams: Not Achieved to Excellence.'),
    q('ncea-2', 'NCEA Level 2', 'NCEA 2', 'NZQA', 'upper', 'ncea',
      'Achievement standards assessed internally and in end-of-year exams: Not Achieved to Excellence.'),
    q('ncea-3', 'NCEA Level 3 (and University Entrance)', 'NCEA 3', 'NZQA', 'upper', 'ncea',
      'Achievement standards assessed internally and in end-of-year exams: Not Achieved to Excellence.'),
    q('sg-o', 'GCE O Level / SEC', 'O Level', 'SEAB and Cambridge', 'lower', 'sg-o',
      'Written papers of 1½–2½ hours, graded A1–F9.'),
    q('sg-a', 'GCE A Level (H1, H2, H3)', 'A Level', 'SEAB and Cambridge', 'upper', 'sg-a',
      'Structured and essay papers of 2–3 hours, graded A–U.'),
    q('spm', 'SPM', 'SPM', 'Malaysian Examinations Board', 'lower', 'spm',
      'Objective and subjective papers per subject, graded A+ to G.'),
    q('stpm', 'STPM / Matriculation', 'STPM', 'Malaysian Examinations Council', 'upper', 'stpm',
      'Three terms of written papers per subject, graded A to F.'),
    q('hkdse', 'HKDSE', 'HKDSE', 'HKEAA', 'upper', 'hkdse',
      'Paper 1 and Paper 2 per subject, multiple choice and long questions, graded 5** to 1.'),
    q('zhongkao', 'Zhongkao (中考)', 'Zhongkao', 'Your city or province', 'lower', 'zhongkao',
      'A written paper per subject, about 2 hours, usually out of 120.', { lang: 'zh' }),
    q('gaokao', 'Gaokao (高考)', 'Gaokao', 'Ministry of Education / your province', 'upper', 'gaokao',
      'Two-hour papers: Chinese, Mathematics and a foreign language out of 150 each, plus elective subjects.', { lang: 'zh' }),
    q('jp-hs-entrance', 'High school entrance exams (高校入試)', 'High school entrance', 'Your prefecture or school', 'lower', 'jp100',
      'A 50-minute paper per subject, out of 100.', { lang: 'ja' }),
    q('jp-common-test', 'University entrance: Common Test (共通テスト)', 'Common Test', 'National Center for University Entrance Examinations', 'upper', 'jp100',
      'Mark-sheet (multiple-choice) papers, 60–90 minutes per subject, out of 100 or 200.', { lang: 'ja' }),
    q('csat', 'CSAT — Suneung (수능)', 'Suneung', 'KICE', 'upper', 'kr9',
      'Multiple-choice and short-answer sections, 70–107 minutes each, graded in stanines 1–9.', { lang: 'ko' }),
    q('vn-grade10', 'Grade 10 entrance exam (thi vào lớp 10)', 'Grade 10 entrance', 'Your province', 'lower', 'vn10',
      'Written papers in Maths, Literature and English, 90–120 minutes, out of 10.', { lang: 'vi' }),
    q('vn-thpt', 'National high school graduation exam (thi tốt nghiệp THPT)', 'THPT exam', 'Ministry of Education and Training', 'upper', 'vn10',
      'Multiple-choice papers (Literature is written), 50–120 minutes, out of 10.', { lang: 'vi' }),

    // Africa and the Middle East
    q('bece', 'BECE', 'BECE', 'WAEC / NECO', 'lower', 'bece',
      'An objective paper and a theory paper per subject.'),
    q('wassce', 'WASSCE', 'WASSCE', 'WAEC', 'upper', 'waec',
      'Paper 1 objective, Paper 2 theory (and practicals), graded A1–F9.'),
    q('neco', 'NECO SSCE', 'NECO', 'NECO', 'upper', 'waec',
      'An objective paper and an essay paper per subject, graded A1–F9.'),
    q('utme', 'JAMB UTME', 'UTME', 'JAMB', 'upper', 'jamb',
      'Computer-based multiple choice in four subjects, scored out of 400.'),
    q('kcse', 'KCSE', 'KCSE', 'KNEC', 'lower', 'kcse',
      'Two or three papers per subject, structured and essay questions, graded A to E.'),
    q('uce', 'UCE (O Level)', 'UCE', 'UNEB', 'lower', 'ug-uce',
      'Written papers per subject, graded D1–F9.'),
    q('uace', 'UACE (A Level)', 'UACE', 'UNEB', 'upper', 'ug-uace',
      'Two or three papers per principal subject, graded A–F.'),
    q('csee', 'CSEE (Form 4)', 'CSEE', 'NECTA', 'lower', 'tz',
      'Written papers per subject, graded A–F.'),
    q('acsee', 'ACSEE (Form 6)', 'ACSEE', 'NECTA', 'upper', 'tz',
      'Written papers per subject, graded A–F.'),
    q('za-nsc', 'National Senior Certificate (Matric)', 'Matric', 'DBE', 'upper', 'za-nsc',
      'Paper 1 and Paper 2 per subject, 2–3 hours, reported as a percentage and a level 1–7.'),
    q('za-ieb', 'IEB National Senior Certificate', 'IEB Matric', 'IEB', 'upper', 'za-nsc',
      'Paper 1 and Paper 2 per subject, 2–3 hours, reported as a percentage and a level 1–7.'),
    q('eg-thanaweya', 'Thanaweya Amma (الثانوية العامة)', 'Thanaweya Amma', 'Ministry of Education', 'upper', 'eg-pct',
      'A 2–3 hour paper per subject, multiple choice and written questions, marked as a percentage.', { lang: 'ar' }),

    // Europe
    q('brevet', 'Diplôme national du brevet', 'Brevet', 'Éducation nationale', 'lower', 'fr-brevet',
      'Épreuves écrites de français, mathématiques, histoire-géographie-EMC et sciences, plus un oral ; noté sur 20, avec mentions.', { lang: 'fr' }),
    q('bac', 'Baccalauréat (général ou technologique)', 'Bac', 'Éducation nationale', 'upper', 'fr20',
      'Épreuves écrites de 4 heures en spécialité et en philosophie, le grand oral, et l’épreuve anticipée de français en Première ; noté sur 20, avec mentions.', { lang: 'fr' }),
    q('bac-pro', 'Baccalauréat professionnel', 'Bac pro', 'Éducation nationale', 'upper', 'fr20',
      'Épreuves écrites et pratiques, notées sur 20.', { lang: 'fr' }),
    q('msa', 'Mittlerer Schulabschluss (MSA / Realschulabschluss)', 'MSA', 'Your Land', 'lower', 'de-note',
      'Written exams in Deutsch, Mathematik and English, 2–3 hours, graded 1–6.', { lang: 'de' }),
    q('abitur', 'Abitur', 'Abitur', 'Your Land', 'upper', 'de-abi',
      'Written exams of 4–5 hours in your Leistungskurse plus an oral, marked in Punkte 0–15.', { lang: 'de' }),
    q('matura-at', 'Matura (Reifeprüfung)', 'Matura', 'BMBWF', 'upper', 'at5',
      'Standardised written exams of 4–5 hours and oral exams, graded 1–5.', { lang: 'de' }),
    q('matura-ch', 'Maturität (Matura / maturité)', 'Matura', 'Your canton', 'upper', 'ch6',
      'Written and oral exams set by your school, graded 1–6 (4 passes).', { lang: 'de' }),
    q('eso', 'Graduado en ESO', 'ESO', 'Your comunidad autónoma', 'lower', 'es10',
      'Course exams set by your school, marked out of 10.', { lang: 'es' }),
    q('pau', 'Bachillerato and PAU (Selectividad / EBAU)', 'PAU', 'Your university district', 'upper', 'es10',
      '90-minute papers per subject with a choice of questions, marked out of 10.', { lang: 'es' }),
    q('licenza-media', 'Esame di terza media', 'Terza media', 'Ministero dell’Istruzione', 'lower', 'it10',
      'Prove scritte di italiano, matematica e lingue, poi un colloquio orale; voto in decimi.', { lang: 'it' }),
    q('maturita', 'Esame di Maturità', 'Maturità', 'Ministero dell’Istruzione', 'upper', 'it100',
      'Prima prova di italiano (6 ore), seconda prova di indirizzo, colloquio; voto in centesimi.', { lang: 'it' }),
    q('pt-9', 'Provas finais do 9.º ano', '9.º ano', 'IAVE', 'lower', 'pt5',
      'Provas de Português e Matemática, 90 minutos, níveis 1–5.', { lang: 'pt' }),
    q('pt-sec', 'Exames nacionais do secundário', 'Exames nacionais', 'IAVE', 'upper', 'pt20',
      'Provas de 120–150 minutos, classificadas de 0 a 20.', { lang: 'pt' }),
    q('nl-vmbo', 'VMBO eindexamen', 'VMBO', 'CvTE', 'lower', 'nl10',
      'Central written exams of 2 hours, graded 1–10.', { lang: 'nl' }),
    q('nl-havo', 'HAVO eindexamen', 'HAVO', 'CvTE', 'upper', 'nl10',
      'Central written exams of 3 hours, graded 1–10.', { lang: 'nl' }),
    q('nl-vwo', 'VWO eindexamen', 'VWO', 'CvTE', 'upper', 'nl10',
      'Central written exams of 3 hours, graded 1–10.', { lang: 'nl' }),
    q('pl-e8', 'Egzamin ósmoklasisty', 'Egzamin 8-klasisty', 'CKE', 'lower', 'pl-pct',
      'Polish, Mathematics and a foreign language, 100–150 minutes, scored as a percentage.', { lang: 'pl' }),
    q('pl-matura', 'Matura', 'Matura', 'CKE', 'upper', 'pl-pct',
      'Basic and extended level papers, 170–180 minutes, scored as a percentage (30% passes).', { lang: 'pl' }),
    q('oge', 'OGE (ОГЭ, 9th grade)', 'OGE', 'FIPI / Rosobrnadzor', 'lower', 'ru-oge',
      'Short-answer then extended-answer parts, about 4 hours, graded 2–5.', { lang: 'ru' }),
    q('ege', 'EGE (ЕГЭ, 11th grade)', 'EGE', 'FIPI / Rosobrnadzor', 'upper', 'ru-ege',
      'Short-answer then extended-answer parts, 3–4 hours, scored out of 100.', { lang: 'ru' }),
    q('lgs', 'LGS', 'LGS', 'MEB', 'lower', 'tr-net',
      'Multiple-choice verbal and numerical sessions.', { lang: 'tr' }),
    q('yks', 'YKS (TYT / AYT)', 'YKS', 'ÖSYM', 'upper', 'tr-net',
      'Multiple-choice sessions with a penalty for wrong answers.', { lang: 'tr' }),

    // Latin America
    q('enem', 'ENEM', 'ENEM', 'INEP', 'upper', 'enem',
      'Two days of multiple-choice questions plus an essay (redação).', { lang: 'pt' }),
    q('mx-exani', 'Bachillerato and EXANI-II / university entrance', 'EXANI-II', 'CENEVAL / your university', 'upper', 'mx',
      'Multiple-choice sections in reasoning, maths, language and your chosen field.', { lang: 'es' }),

    // Anything else
    q('national-leaving', 'My country’s school-leaving exam', 'School-leaving exam', 'Your country', 'upper', 'percent',
      'Written papers in your country’s format — we mark them as a percentage.'),
  ];

  var QUALS = {};
  QUALS_LIST.forEach(function (x) { QUALS[x.id] = x; });

  // Never an exam: a student who is not working towards one right now.
  var NO_EXAM = { id: 'none', label: 'Not working towards an exam right now', short: 'No exam', body: '', stage: '', scale: 'percent', paper: '', lang: 'en', intl: true };

  function qualById(id) {
    if (id === 'none') return NO_EXAM;
    return own(QUALS, id) ? QUALS[id] : null;
  }

  // The exams worth offering a student, in two groups: their system's own,
  // then the international ones (minus any already in the first group).
  function qualsFor(systemId) {
    var sy = systemById(systemId);
    var national = (sy ? sy.quals : []).map(qualById).filter(Boolean);
    var seen = {};
    national.forEach(function (x) { seen[x.id] = true; });
    var intl = QUALS_LIST.filter(function (x) { return x.intl && !seen[x.id]; });
    return { national: national, international: intl };
  }

  // The exam a student in that year is most likely working towards.
  function suggestQual(systemId, gradeId) {
    var sy = systemById(systemId);
    var gr = gradeIn(sy, gradeId);
    if (gr && gr.target && qualById(gr.target)) return gr.target;
    if (sy && sy.quals && sy.quals.length) {
      var upper = sy.quals.filter(function (id) { var x = qualById(id); return x && x.stage === 'upper'; });
      return upper[0] || sy.quals[0];
    }
    return '';
  }

  // { schooling, qual } as this account last answered, or empty strings.
  function readSchooling() {
    var none = { schooling: '', qual: '' };
    var prefs = readJson(PREFS_KEY);
    var rec = prefs && prefs.schooling;
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return none;
    var owner = typeof rec.account === 'string' ? rec.account.toLowerCase() : '';
    var me = sessionEmail();
    if (owner && me && owner !== me) return none;
    return {
      schooling: schoolingById(rec.type) ? rec.type : '',
      qual: qualById(rec.qual) ? rec.qual : '',
    };
  }

  function writeSchooling(type, qualId) {
    var s = ls();
    if (!s) return readSchooling();
    var prefs = readJson(PREFS_KEY) || {};
    var t = schoolingById(type) ? type : '';
    var qq = qualById(qualId) ? qualId : '';
    if (t || qq) prefs.schooling = { type: t, qual: qq, account: sessionEmail() };
    else delete prefs.schooling;
    try { s.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {}
    return readSchooling();
  }

  // Everything the app knows about where this student is and where they are
  // headed, in one read. `complete` is what decides whether the "about your
  // schooling" page still has to be shown.
  function profile() {
    var sc = read();
    var sg = readSchooling();
    var qual = qualById(sg.qual);
    return {
      schooling: sg.schooling,
      system: sc.system,
      grade: sc.grade,
      level: sc.level,
      qual: qual ? qual.id : '',
      qualification: qual,
      scale: qual ? qual.scale : 'a-level',
      complete: !!(sg.schooling && sc.system && sc.grade && qual),
    };
  }

  // The exam the student is aiming at, or null — what papers, marks and
  // lessons follow. A student who has not said gets the A level behaviour the
  // app always had.
  function qualification() {
    try { return profile().qualification; } catch (e) { return null; }
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
    SCHOOLING: SCHOOLING,
    schoolingById: schoolingById,
    QUALS: QUALS,
    QUALS_LIST: QUALS_LIST,
    NO_EXAM: NO_EXAM,
    qualById: qualById,
    qualsFor: qualsFor,
    suggestQual: suggestQual,
    readSchooling: readSchooling,
    writeSchooling: writeSchooling,
    profile: profile,
    qualification: qualification,
    SCALES: SCALES,
    markOn: markOn,
    scaleSummary: scaleSummary,
    _useStorage: _useStorage,
    _useNotes: _useNotes,
  };
}));
