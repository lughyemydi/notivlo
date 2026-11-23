// Everything the guide says, and the suggestions it offers — copy and data,
// no logic. Kept apart from the service so wording can be changed without
// reading a line of code.
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.notivloSetupContent = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // Subjects offered at international A level, named as the syllabuses name
  // them — "Mathematics" rather than "Maths", so a notebook made here matches
  // the subject line on a past paper and finds its lessons in lessons.js. The
  // order runs sciences, maths, humanities, languages, then the rest; the
  // grouping is never shown. Nothing here is required: the free-text field
  // takes anything, including a subject no board offers.
  var SUBJECTS = [
    'Mathematics', 'Further Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Computer Science', 'Information Technology', 'Design & Technology',
    'Economics', 'Business', 'Accounting', 'Psychology', 'Sociology', 'Law',
    'History', 'Geography', 'Global Perspectives & Research', 'Divinity',
    'English Literature', 'English Language', 'Classical Studies',
    'French', 'Spanish', 'German', 'Chinese', 'Arabic',
    'Art & Design', 'Music', 'Drama', 'Media Studies',
    'Environmental Management', 'Marine Science', 'Physical Education',
    'Travel & Tourism', 'Thinking Skills',
  ];

  // Step 1: what the reader is here for. One answer, optional. Each goal has
  // to earn its place by changing something the reader can see:
  //   `does`      said under the cards the moment it is chosen
  //   `subjects`  the line above the subject list in step 2
  //   `technique` the study technique (by id, below) moved to the top of
  //               the look round and marked as theirs
  //   `start`     the "start here" on the last screen
  //   `card`      the few words beside "Getting started" on the home page
  // No goal is a promise. They are directions, not outcomes.
  var GOALS = [
    {
      id: 'exams',
      label: 'Prepare for my exams',
      note: 'Revision that builds up to exam season',
      does: 'The guide will lead with timed practice, and suggest which chapter to start revising.',
      subjects: 'Tap the subjects you are sitting papers in. Each one becomes a notebook to revise from.',
      technique: 'clock',
      start: 'Pick the chapter you would least like to be asked about. Write what you remember of it, then answer questions on it against a timer.',
      card: 'Preparing for exams',
    },
    {
      id: 'keep-up',
      label: 'Keep on top of my lessons',
      note: 'Notes written up as the course goes',
      does: 'The guide will lead with short, regular study blocks, so each lesson is written up while it is fresh.',
      subjects: 'Tap the subjects you have lessons in. Each one becomes a notebook to write them up in.',
      technique: 'blocks',
      start: 'After your next lesson, write it up as a chapter the same day. Half an hour is enough.',
      card: 'Keeping on top of lessons',
    },
    {
      id: 'catch-up',
      label: 'Catch up on what I missed',
      note: 'Fill the gaps, one topic at a time',
      does: 'The guide will lead with writing from memory, which is the quickest way to find where the gaps are.',
      subjects: 'Tap the subjects you want to catch up in. Start with one or two; more can be added any time.',
      technique: 'memory',
      start: 'Make the topic you are least sure of your first chapter. Write what you do know, and the gaps become the list to work through.',
      card: 'Catching up',
    },
    {
      id: 'organised',
      label: 'Get organised',
      note: 'One place for notes and deadlines',
      does: 'The guide will lead with keeping things where you can see them: notes beside the text, deadlines in the agenda.',
      subjects: 'Tap everything you study. Each one becomes a notebook, so nothing lives in a loose file again.',
      technique: 'visible',
      start: 'Put this week\u2019s deadlines in the agenda and point each one at its notebook.',
      card: 'Getting organised',
    },
  ];

  // The categories Home's own "New notebook" form offers. Kept identical so a
  // notebook made here is indistinguishable from one made there.
  var CATEGORIES = ['School', 'Work', 'Personal', 'Research', 'Other'];

  // Day chips in step 2. `index` is JavaScript's own getDay(), so Sunday is 0.
  var WEEKDAYS = [
    { index: 1, short: 'Mon', label: 'Monday' },
    { index: 2, short: 'Tue', label: 'Tuesday' },
    { index: 3, short: 'Wed', label: 'Wednesday' },
    { index: 4, short: 'Thu', label: 'Thursday' },
    { index: 5, short: 'Fri', label: 'Friday' },
    { index: 6, short: 'Sat', label: 'Saturday' },
    { index: 0, short: 'Sun', label: 'Sunday' },
  ];

  // `time` is written into the agenda entry as-is. The en dash and the single
  // trailing meridiem are what agenda-timegrid.js parses to place a block on
  // the week clock — '4:00-5:30 PM' with a hyphen would show as text with no
  // block, so these strings are not free-form.
  var SLOTS = [
    { id: 'morning', label: 'Mornings', note: '9:00–10:30 AM', time: '9:00–10:30 AM' },
    { id: 'afternoon', label: 'Afternoons', note: '2:00–3:30 PM', time: '2:00–3:30 PM' },
    { id: 'after-school', label: 'After school', note: '4:00–5:30 PM', time: '4:00–5:30 PM' },
    { id: 'evening', label: 'Evenings', note: '7:00–8:30 PM', time: '7:00–8:30 PM' },
  ];

  // How far ahead step 2 writes. The agenda has no notion of a repeating
  // entry, so a "weekly" slot is really this many copies — small enough that
  // the first fortnight is filled without burying whatever the reader adds
  // themselves, and the UI says the number out loud before writing it.
  var WEEKS_AHEAD = 2;

  // Step 3, left column: what each part of the app is for. `href` is where
  // "Show me" goes; the guide opens it in the same tab, so each card is a
  // place to come back to rather than a one-time slide.
  var TOUR = [
    {
      id: 'notebooks',
      title: 'Notebooks hold your subjects',
      body: 'One notebook per subject. Inside, chapters sit in volumes, and each chapter is a page you write on. "Add chapter" starts a new one; "Add unit" starts a new volume.',
      href: 'Home.dc.html',
      cta: 'Your notebooks',
    },
    {
      id: 'notes',
      title: 'Definitions, tips and reminders',
      body: 'Beside the writing, a chapter takes short labelled notes — a definition to learn, a tip from a teacher, a reminder about an exam. They stay pinned next to the text rather than lost inside it.',
      href: '',
      cta: '',
    },
    {
      id: 'agenda',
      title: 'The agenda is your week on a clock',
      body: 'Classes, deadlines, tasks and study blocks, laid out across seven days. A deadline or a task has a checkbox; a class or a study block is just there to show where your time already went.',
      href: 'Planner.dc.html',
      cta: 'Open the agenda',
    },
    {
      id: 'link',
      title: 'Join the two together',
      body: 'An agenda entry can point at a notebook, and at one chapter inside it. Tap the entry and you land on the page you need, which is the whole point of writing the plan down.',
      href: '',
      cta: '',
    },
    {
      id: 'settings',
      title: 'Make it yours',
      body: 'Light or dark, and how big everything reads, are in Settings along with the sort order of your shelf. Signing in on another device brings your notebooks with you.',
      href: 'Settings.dc.html',
      cta: 'Open settings',
    },
  ];

  // Step 3, right column. Study technique, not promises: each one is a thing
  // to do this week. No claim about grades, no claim about replacing a
  // teacher, no claim about what any of it is worth.
  var TECHNIQUES = [
    {
      id: 'memory',
      title: 'Write it from memory first',
      body: 'Close the notebook and write down what you remember of a chapter. Then open it and fill the gaps in a different colour. The gaps are the revision list.',
    },
    {
      id: 'spacing',
      title: 'Come back to it on a widening gap',
      body: 'A chapter read once fades. Revisit it the next day, then three days later, then a week later. Short visits, spaced out, beat one long one.',
    },
    {
      id: 'blocks',
      title: 'Work in blocks you will actually finish',
      body: '30 to 45 minutes on one chapter, then a real break. Put the block in the agenda before the day starts, so the decision is already made.',
    },
    {
      id: 'clock',
      title: 'Answer questions under the clock',
      body: 'Past questions with a timer tell you what reading cannot: whether you can produce the answer, in the time, without the book open.',
    },
    {
      id: 'visible',
      title: 'Keep the hard things visible',
      body: 'A definition you keep forgetting belongs in a note on the chapter, not in your head. Anything you cannot explain out loud is not learned yet.',
    },
  ];

  // The getting-started card on Home. Each item is answered by looking at the
  // app's own stores — nothing here is ticked by hand, so the card cannot
  // claim something the reader has not actually done. `id` is matched in
  // setup-service.js, so the two lists stay in step.
  var CHECKLIST = [
    { id: 'notebook', label: 'Make a notebook', hint: 'One per subject', href: 'Home.dc.html' },
    { id: 'write', label: 'Write something in a chapter', hint: 'Open a notebook and start typing', href: 'Home.dc.html' },
    { id: 'plan', label: 'Put this week in the agenda', hint: 'A deadline, a class, a study block', href: 'Planner.dc.html' },
    { id: 'tick', label: 'Tick one thing off', hint: 'Deadlines and tasks have a checkbox', href: 'Planner.dc.html' },
  ];

  var COPY = {
    // Step 0
    introKicker: 'First time here',
    introHeading: 'Shall we set it up together?',
    introBody: 'Four short steps, about two minutes. You finish with your own notebooks on the shelf and your own week in the agenda. Nothing here is permanent — everything can be renamed, moved or deleted afterwards.',
    // The four steps, said before they are asked for.
    introPlan: [
      { title: 'Your year and goal', note: 'Where you are at school, and what you are here to do' },
      { title: 'Your subjects', note: 'Each one becomes a notebook' },
      { title: 'Your week', note: 'When you can study, and what is due' },
      { title: 'A look round', note: 'What is where, and how to use it' },
    ],
    introGo: 'Set it up with me',
    introSkip: 'Skip — fill it with examples',
    introSkipNote: 'Skipping leaves the example A level notebooks and agenda in place, so there is something to poke at. Delete them whenever you like.',

    // The goal
    goalKicker: 'Your year and goal',
    goalHeading: 'Where are you, and what are you here to do?',
    goalBody: 'Two quick questions. Your year decides what your notebooks start with; your goal shapes what the guide shows you first. Neither locks anything.',
    goalQuestion: 'What are you here to do?',
    goalNone: 'Not sure? Skip this one — the guide works the same without it.',

    // The year at school, on the same screen. Systems and years are in
    // school-level.js, with what each level puts in a notebook.
    yearHeading: 'What year are you in?',
    yearBody: 'Pick where you go to school, then your year as your school names it. Your notebooks come with notes written for that stage.',
    systemLabel: 'Where you go to school',
    yearNone: 'Pick your year and your notebooks will start at your level. Skip it and they start with the full A level set.',

    // Step 1
    step1Kicker: 'Your subjects',
    step1Heading: 'What are you studying?',
    step1Body: 'Tap the subjects you take, or type anything that is not listed. Every subject on the list becomes a notebook that starts with notes at your level \u2014 and the ones with lessons will offer those too. Anything you type in starts blank.',
    step1Empty: 'Your notebooks will appear here as you pick subjects.',
    shelfHeading: 'Your shelf',
    lessonsTag: 'Lessons included',
    notesTag: 'Starts with notes at your level',
    notesLessonsTag: 'Notes at your level, and lessons',
    plainTag: 'Blank, ready to write in',
    step1Skip: 'I will add them later',

    // Step 2
    step2Kicker: 'Your week',
    step2Heading: 'When do you work?',
    step2Body: 'Pick the days you can study and roughly when. That writes study blocks into your agenda for the next fortnight — move or delete any of them later.',
    step2FixedHeading: 'Anything fixed in your week?',
    step2FixedBody: 'Lessons, a tutor, a club. Added to the same fortnight.',
    step2DueHeading: 'Anything due soon?',
    step2DueBody: 'One deadline to start you off. Optional.',
    step2Skip: 'My week is not that regular',

    // Step 3
    step3Kicker: 'A look round',
    step3Heading: 'How the app works, and how to use it',
    step3Body: 'The left is the app. The right is what to do with it. Both stay here — the guide is in the top bar whenever you want it again.',

    // Done
    doneKicker: 'Ready',
    doneHeading: 'That is everything',
    doneBody: 'Your notebooks and your week are waiting on the home page. The getting-started card there tracks the first few things worth doing, and it goes away once they are done.',
    doneGo: 'Take me in',
    startHeading: 'A good place to start',
    startFallback: 'Open one notebook and write what you covered most recently. A first chapter does not need to be tidy.',
  };

  return {
    GOALS: GOALS,
    SUBJECTS: SUBJECTS,
    CATEGORIES: CATEGORIES,
    WEEKDAYS: WEEKDAYS,
    SLOTS: SLOTS,
    WEEKS_AHEAD: WEEKS_AHEAD,
    TOUR: TOUR,
    TECHNIQUES: TECHNIQUES,
    CHECKLIST: CHECKLIST,
    COPY: COPY,
  };
}));
