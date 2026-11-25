/* The test papers.
 *
 * A notebook's Test button needs something to hand the printer, and this is
 * it: papers written to the shape of a Cambridge International AS & A Level
 * paper — the same command words, the same mark notation, the same
 * mark-scheme-by-mark-point — for the four syllabuses the app's notebooks
 * cover.
 *
 * These are NOT past papers. A real 9701 or 9709 paper belongs to Cambridge
 * Assessment and is not ours to ship, so every question below was written for
 * this app. What is borrowed is the form, which is the part that matters when
 * the point is to practise sitting one: a question that says "Explain, in
 * terms of electron pairs, why..." for [3] teaches a student to answer in
 * three marked points, whoever wrote it.
 *
 * Kept out of Notebook.dc.html on purpose. The page is already long, and a
 * paper is content rather than behaviour — someone adding a question should
 * not have to scroll past a contentEditable to find where to put it.
 *
 * ---------------------------------------------------------------------------
 * Shape of a paper
 *
 *   id         stable, and stored in a result — never renumber one in place,
 *              because a sitting from March still points at it.
 *   subject    syllabus code, keys into SUBJECTS.
 *   kind       'section' for the 25-mark ones a student can take any evening,
 *              'full' for the mock that comes due weekly or monthly.
 *   tex        true only where the paper writes LaTeX between dollar signs.
 *              It has to be opt-in because the renderer pairs dollars blindly:
 *              in an Economics paper "$2.00 to $3.00" would otherwise be read
 *              as the formula "2.00 to " and both figures would vanish. Maths
 *              and Physics set it; everything else is rendered as plain text,
 *              where a dollar is just a dollar.
 *   minutes    what the timer counts down. Cambridge allots roughly a minute
 *              and a half per mark on structured papers, and these follow it.
 *   marks      the total. Checked against the parts at load; see verifyBank().
 *   questions  [{ n, topic, stem?, parts: [{ ref, text, marks, command,
 *              scheme: [...], note? }] }]
 *
 * `scheme` is one string per available mark, which is what makes self-marking
 * honest: a student awarding themselves 2 of 3 has to point at the point they
 * missed. `note` carries the examiner's aside — what is condoned, what is not
 * accepted — because that is where most of the learning in a mark scheme is.
 *
 * `topic` is the hinge of the whole feature. It tags the question, it groups
 * the breakdown after marking, and it keys into EXERCISES to decide what the
 * student is told to work on. A question without a real topic is a question
 * that can only ever produce a score.
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  var CIE = 'Cambridge International AS & A Level';

  /* Subjects are keyed by lessons.js's own names, not by syllabus code.
   *
   * That file already answers "what subject is this notebook?" for seven
   * subjects, including the alias table that turns a slug the student invented
   * into a known one, and a notebook must not be able to resolve to chemistry
   * lessons and mathematics papers. So this bank defers to it and keeps the
   * syllabus code as a label, exactly as lessons.js does. */
  var SUBJECTS = {
    chemistry:   { name: 'Chemistry',   board: CIE, code: '9701' },
    mathematics: { name: 'Mathematics', board: CIE, code: '9709' },
    economics:   { name: 'Economics',   board: CIE, code: '9708' },
    history:     { name: 'History',     board: CIE, code: '9489' },
    physics:     { name: 'Physics',     board: CIE, code: '9702' },
    biology:     { name: 'Biology',     board: CIE, code: '9700' },
  };

  /* History is the one subject here that lessons.js does not know, so it is
   * the only thing this file has to resolve for itself. Everything else goes
   * through notivloLessons.subjectFor() — see resolveSubject() below. A
   * notebook that resolves to nothing is told so plainly rather than offered
   * someone else's subject: Studio Art has no written paper, and pretending
   * otherwise would be worse than the gap. */
  var OWN_ALIASES = {
    history: 'history',
    'modern-european-history': 'history',
    'european-history': 'history',
    'world-history': 'history',
    'modern-history': 'history',
  };

  var OWN_TITLE_WORDS = [[/histor/i, 'history']];

  /* Topic labels, shared by the breakdown and the exercise list. */
  var TOPICS = {
    // 9701
    'atomic-structure':   'Atomic structure',
    'bonding':            'Chemical bonding and shapes',
    'moles':              'Moles and stoichiometry',
    'energetics':         'Enthalpy changes',
    'equilibria':         'Equilibria and rates',
    'functional-groups':  'Functional groups',
    'mechanisms':         'Reaction mechanisms',
    // 9709
    'vectors':            'Vectors',
    'matrices':           'Matrices and transformations',
    'differentiation':    'Differentiation',
    'integration':        'Integration',
    'quadratics':         'Quadratics and functions',
    'trigonometry':       'Trigonometry',
    // 9708
    'elasticity':         'Elasticity',
    'market-failure':     'Market failure',
    'ad-as':              'Aggregate demand and supply',
    'macro-policy':       'Macroeconomic policy',
    'inflation':          'Inflation and unemployment',
    'trade':              'Trade and the balance of payments',
    // 9702
    'measurement':        'Physical quantities and uncertainties',
    'kinematics':         'Kinematics',
    'dynamics':           'Dynamics and momentum',
    'forces':             'Forces, density and pressure',
    'energy':             'Work, energy and power',
    'waves':              'Waves and superposition',
    'electricity':        'Current of electricity',
    'dc-circuits':        'D.C. circuits',
    // 9700
    'cell-structure':     'Cell structure',
    'biological-molecules': 'Biological molecules',
    'enzymes':            'Enzymes',
    'cell-membranes':     'Cell membranes and transport',
    'mitosis':            'The cell cycle and mitosis',
    'nucleic-acids':      'Nucleic acids and protein synthesis',
    'transport-plants':   'Transport in plants',
    'gas-exchange':       'Gas exchange',
    'infectious-disease': 'Infectious disease and immunity',
    // 9489
    'vienna':             'The Congress of Vienna',
    'revolutions-1848':   'The revolutions of 1848',
    'unification':        'Italian and German unification',
    'ww1-origins':        'The origins of the First World War',
    'source-analysis':    'Source analysis',
    // Topics the papers for other exams (bac, brevet, Algebra II, GCSE) add
    'sequences':          'Sequences',
    'exponentials':       'Exponentials and logarithms',
    'probability':        'Probability',
    'geometry':           'Geometry and measures',
    'arithmetic':         'Number, fractions and percentages',
    'statistics':         'Statistics',
  };

  /* Indicative grade boundaries, as a percentage of the paper.
   *
   * Real Cambridge boundaries are set per session against how the cohort
   * actually did, and move a few marks either way every series. These are the
   * middle of where they tend to land, and the UI says as much — a student
   * should read a C here as "around a C", not as a result. */
  var BOUNDARIES = [
    { grade: 'A*', pct: 90 },
    { grade: 'A',  pct: 80 },
    { grade: 'B',  pct: 70 },
    { grade: 'C',  pct: 60 },
    { grade: 'D',  pct: 50 },
    { grade: 'E',  pct: 40 },
  ];

  var PAPERS = [];

  /* =======================================================================
     9701 Chemistry
     ======================================================================= */

  PAPERS.push({
    id: 'chem-sec-structure',
    subject: 'chemistry',
    kind: 'section',
    title: 'Atomic structure and bonding',
    component: 'AS Level, structured questions',
    minutes: 35,
    questions: [
      {
        n: 1, topic: 'atomic-structure',
        parts: [
          { ref: '(a)', command: 'State', marks: 1,
            text: 'State the number of electrons, protons and neutrons in one atom of ⁵⁵Mn.',
            scheme: ['25 electrons, 25 protons and 30 neutrons — all three required for the mark.'],
            note: 'Do not award if the candidate gives nucleon number as the proton count.' },
          { ref: '(b)', command: 'Write', marks: 2,
            text: 'Write the full electronic configuration of a manganese atom, and of the Mn²⁺ ion.',
            scheme: ['Mn: 1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵ 4s²',
                     'Mn²⁺: 1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵'],
            note: 'The 4s electrons are lost before the 3d. A candidate removing 3d electrons scores the first mark only.' },
          { ref: '(c)', command: 'Explain', marks: 3,
            text: 'Explain why the first ionisation energy of magnesium is higher than that of sodium, but the first ionisation energy of aluminium is lower than that of magnesium.',
            scheme: ['Mg has one more proton than Na, so greater nuclear charge over the same shell — the outer electron is held more tightly.',
                     'Al’s outer electron is in a 3p subshell, which is higher in energy than Mg’s 3s.',
                     'The 3p electron is therefore more easily removed, outweighing Al’s extra proton.'],
            note: 'Shielding alone is not enough for the third mark; the subshell must be named.' },
        ],
      },
      {
        n: 2, topic: 'bonding',
        stem: 'The molecules SF₄, BF₃ and NH₃ all contain a central atom bonded to three or four other atoms.',
        parts: [
          { ref: '(a)', command: 'Draw', marks: 3,
            text: 'Draw the shape of each of the three molecules, and name each shape.',
            scheme: ['SF₄: see-saw (trigonal bipyramidal with one lone pair).',
                     'BF₃: trigonal planar.',
                     'NH₃: trigonal pyramidal.'],
            note: 'The name alone, without a diagram, scores the mark. "Pyramidal" is accepted for NH₃.' },
          { ref: '(b)', command: 'Explain', marks: 3,
            text: 'Explain, in terms of electron pairs, why the bond angle in NH₃ is smaller than the bond angle in BF₃.',
            scheme: ['Electron pairs repel and arrange themselves to be as far apart as possible.',
                     'NH₃ has a lone pair on the nitrogen; BF₃ has none.',
                     'A lone pair repels more strongly than a bonding pair, closing the H–N–H angle to about 107° against BF₃’s 120°.'],
            note: 'Quoted angles are not required, but a candidate giving 107° and 120° with no reasoning scores one mark only.' },
          { ref: '(c)', command: 'Suggest', marks: 2,
            text: 'BF₃ is a non-polar molecule although each B–F bond is polar. Suggest why.',
            scheme: ['Fluorine is more electronegative than boron, so each bond carries a dipole.',
                     'The three dipoles are equal and symmetrically arranged at 120°, so they cancel and the molecule has no overall dipole.'],
            note: 'Symmetry must be linked to cancellation. "It is symmetrical" alone scores one.' },
        ],
      },
      {
        n: 3, topic: 'bonding',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 4,
            text: 'Water boils at 100 °C whereas hydrogen sulfide, H₂S, boils at −60 °C, although H₂S has the greater relative molecular mass. Explain this difference.',
            scheme: ['Both are polar molecules with permanent dipole–dipole attractions between them.',
                     'In water, O is sufficiently electronegative and small that hydrogen bonds form between molecules.',
                     'Hydrogen bonding is a much stronger intermolecular force than the dipole–dipole attraction in H₂S.',
                     'More energy is therefore needed to separate water molecules, so the boiling point is higher.'],
            note: 'A candidate who says hydrogen bonds are broken within the molecule scores a maximum of 2.' },
          { ref: '(b)', command: 'Explain', marks: 2,
            text: 'Ice is less dense than liquid water. Explain this in terms of the structure of ice.',
            scheme: ['In ice, each water molecule is hydrogen bonded to four others in a fixed tetrahedral arrangement.',
                     'This open lattice holds the molecules further apart on average than in the liquid, so the same mass occupies a greater volume.'],
          },
        ],
      },
      {
        n: 4, topic: 'moles',
        parts: [
          { ref: '(a)', command: 'Calculate', marks: 3,
            text: 'A 2.50 g sample of hydrated magnesium sulfate, MgSO₄·xH₂O, is heated to constant mass. The residue of anhydrous MgSO₄ has a mass of 1.22 g. Calculate x.',
            scheme: ['Mass of water lost = 2.50 − 1.22 = 1.28 g, so n(H₂O) = 1.28 / 18.0 = 0.0711 mol.',
                     'n(MgSO₄) = 1.22 / 120.4 = 0.01013 mol.',
                     'Ratio 0.0711 / 0.01013 = 7.02, so x = 7.'],
            note: 'Award full marks for a correct x reached by a valid alternative route. An answer of 7 with no working scores 1.' },
          { ref: '(b)', command: 'Suggest', marks: 1,
            text: 'Suggest why the sample is heated to constant mass rather than for a fixed time.',
            scheme: ['Constant mass shows all the water of crystallisation has been driven off, so the dehydration is complete.'],
          },
          { ref: '(c)', command: 'Explain', marks: 1,
            text: 'Explain why the crucible must be allowed to cool before each weighing.',
            scheme: ['A hot crucible sets up convection currents over the balance pan and reads low, so the recorded mass would be inaccurate.'],
          },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'chem-sec-organic',
    subject: 'chemistry',
    kind: 'section',
    title: 'Functional groups and mechanisms',
    component: 'AS Level, structured questions',
    minutes: 35,
    questions: [
      {
        n: 1, topic: 'functional-groups',
        stem: 'Compound P has the structural formula CH₃CH(OH)CH₂CHO.',
        parts: [
          { ref: '(a)', command: 'Identify', marks: 2,
            text: 'Identify the two functional groups present in P, and give the systematic name of P.',
            scheme: ['Alcohol (hydroxyl, –OH) and aldehyde (–CHO).',
                     '3-hydroxybutanal.'],
            note: 'Accept "hydroxy" for the group. The name must number from the aldehyde carbon.' },
          { ref: '(b)', command: 'State', marks: 2,
            text: 'State the reagent and the observation for a test that would distinguish the aldehyde group in P from a ketone.',
            scheme: ['Fehling’s solution (or Tollens’ reagent), warmed.',
                     'A red precipitate of copper(I) oxide forms with Fehling’s (or a silver mirror with Tollens’); a ketone gives no change.'],
            note: 'Acidified dichromate is not accepted here — it oxidises the alcohol group too.' },
          { ref: '(c)', command: 'Predict', marks: 3,
            text: 'P is warmed with excess acidified potassium dichromate(VI). Predict the structure of the organic product and explain how both functional groups are affected.',
            scheme: ['The secondary alcohol is oxidised to a ketone (C=O at carbon 3).',
                     'The aldehyde is oxidised to a carboxylic acid (–COOH).',
                     'Product: CH₃COCH₂COOH, 3-oxobutanoic acid.'],
          },
        ],
      },
      {
        n: 2, topic: 'mechanisms',
        stem: '2-bromo-2-methylpropane reacts with aqueous sodium hydroxide to give 2-methylpropan-2-ol.',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 4,
            text: 'Describe the mechanism of this reaction. Use curly arrows and name the mechanism.',
            scheme: ['Sₙ¹1 — nucleophilic substitution, unimolecular.',
                     'Heterolytic fission of the C–Br bond: curly arrow from the bond to the bromine, forming Br⁻ and a tertiary carbocation.',
                     'Curly arrow from a lone pair on the oxygen of OH⁻ to the positively charged carbon.',
                     'The product is 2-methylpropan-2-ol.'],
            note: 'An arrow drawn from the H of hydroxide, or from the carbon to the nucleophile, loses that mark.' },
          { ref: '(b)', command: 'Explain', marks: 3,
            text: 'Explain why 2-bromo-2-methylpropane reacts by this mechanism whereas 1-bromopropane reacts by Sₙ².',
            scheme: ['The tertiary carbocation from 2-bromo-2-methylpropane is stabilised by the electron-releasing effect of three alkyl groups.',
                     'A primary carbocation from 1-bromopropane would be much less stable, so that route is not available.',
                     'The primary carbon is also less sterically hindered, so the nucleophile can attack it directly in a single step.'],
          },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'The rate of the reaction of 2-bromo-2-methylpropane with hydroxide ions is unchanged when the concentration of hydroxide ions is doubled. Explain this observation.',
            scheme: ['The rate-determining step is the loss of Br⁻ to form the carbocation, which involves only the halogenoalkane.',
                     'Hydroxide does not appear in the rate equation, so its concentration does not affect the rate.'],
          },
        ],
      },
      {
        n: 3, topic: 'mechanisms',
        parts: [
          { ref: '(a)', command: 'State', marks: 2,
            text: 'Ethene reacts with bromine at room temperature. State the type of this reaction and name the product.',
            scheme: ['Electrophilic addition.',
                     '1,2-dibromoethane.'],
          },
          { ref: '(b)', command: 'Explain', marks: 3,
            text: 'Explain how a non-polar bromine molecule is able to act as an electrophile towards ethene.',
            scheme: ['The π electrons of the C=C double bond are concentrated above and below the plane of the molecule and are readily polarised.',
                     'As bromine approaches, the π electron density induces a dipole in the Br–Br bond.',
                     'The Brδ⁺ end is attracted to the double bond and accepts the electron pair, so bromine behaves as an electrophile.'],
          },
        ],
      },
      {
        n: 4, topic: 'energetics',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define the term standard enthalpy change of combustion.',
            scheme: ['The enthalpy change when one mole of a substance is burned completely in oxygen.',
                     'All reactants and products in their standard states under standard conditions (298 K, 100 kPa).'],
          },
          { ref: '(b)', command: 'Calculate', marks: 2,
            text: 'Using the standard enthalpy changes of combustion ΔHᶜ(C) = −394, ΔHᶜ(H₂) = −286 and ΔHᶜ(CH₄) = −890 kJ mol⁻¹, calculate the standard enthalpy change of formation of methane.',
            scheme: ['ΔHᶠ = ΔHᶜ(C) + 2ΔHᶜ(H₂) − ΔHᶜ(CH₄) = −394 + 2(−286) − (−890).',
                     '= −76 kJ mol⁻¹.'],
            note: 'Correct answer with no working scores 1. The sign must be negative for the second mark.' },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'chem-full-as',
    subject: 'chemistry',
    kind: 'full',
    title: 'AS Level Chemistry — structured questions',
    component: 'AS Level, structured questions',
    minutes: 75,
    questions: [
      {
        n: 1, topic: 'atomic-structure',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 3,
            text: 'Explain why the first ionisation energies of the Period 3 elements show a general increase from sodium to argon.',
            scheme: ['Nuclear charge increases across the period as protons are added.',
                     'Electrons are added to the same outer shell, so shielding and atomic radius change little.',
                     'The outer electrons are therefore held more strongly and more energy is needed to remove one.'],
          },
          { ref: '(b)', command: 'Sketch', marks: 3,
            text: 'Sketch a graph of the successive ionisation energies of silicon against the number of the electron removed, and explain the shape in terms of the shells occupied.',
            scheme: ['A general rise from the 1st to the 14th electron, with the energies plotted on a rising curve.',
                     'Large jumps after the 4th and after the 12th electron removed.',
                     'The jumps occur where the next electron comes from a shell closer to the nucleus (4 electrons in shell 3, 8 in shell 2, 2 in shell 1).'],
            note: 'A sketch showing jumps in the right places scores the first two marks even if the axes are unlabelled.' },
          { ref: '(c)', command: 'Calculate', marks: 2,
            text: 'Chlorine has two isotopes, ³⁵Cl and ³⁷Cl, with relative abundances of 75.8% and 24.2%. Calculate the relative atomic mass of chlorine to three significant figures.',
            scheme: ['(35 × 75.8 + 37 × 24.2) / 100.',
                     '= 35.5.'],
          },
        ],
      },
      {
        n: 2, topic: 'bonding',
        stem: 'Sodium chloride, silicon dioxide and iodine are all solids at room temperature.',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 3,
            text: 'Describe the structure and bonding in each of the three solids.',
            scheme: ['NaCl: giant ionic lattice of Na⁺ and Cl⁻ ions held by electrostatic attraction.',
                     'SiO₂: giant covalent (macromolecular) lattice, each Si covalently bonded to four O atoms.',
                     'I₂: simple molecular lattice of I₂ molecules held by induced dipole–induced dipole forces.'],
          },
          { ref: '(b)', command: 'Explain', marks: 3,
            text: 'Explain why silicon dioxide has a much higher melting point than iodine.',
            scheme: ['Melting SiO₂ requires strong covalent bonds throughout the lattice to be broken.',
                     'Melting iodine requires only the weak forces between I₂ molecules to be overcome; the covalent I–I bonds remain intact.',
                     'Covalent bonds are far stronger than intermolecular forces, so much more energy is needed.'],
          },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why molten sodium chloride conducts electricity but solid sodium chloride does not.',
            scheme: ['In the molten state the ions are free to move and can carry charge to the electrodes.',
                     'In the solid the ions are held in fixed positions in the lattice and cannot move.'],
          },
        ],
      },
      {
        n: 3, topic: 'moles',
        stem: 'A student determines the concentration of a solution of ethanedioic acid, H₂C₂O₄, by titration against 0.0200 mol dm⁻³ potassium manganate(VII) in excess dilute sulfuric acid. 25.0 cm³ of the acid required 18.60 cm³ of the manganate(VII) solution.',
        parts: [
          { ref: '(a)', command: 'Construct', marks: 2,
            text: 'Construct the balanced equation for the reaction, given that manganate(VII) is reduced to Mn²⁺ and ethanedioic acid is oxidised to carbon dioxide.',
            scheme: ['2MnO₄⁻ + 5H₂C₂O₄ + 6H⁺ → 2Mn²⁺ + 10CO₂ + 8H₂O.',
                     'Correct balancing of both charge and atoms.'],
            note: 'Award one mark for correct species with incorrect balancing.' },
          { ref: '(b)', command: 'Calculate', marks: 3,
            text: 'Calculate the concentration of the ethanedioic acid solution in mol dm⁻³.',
            scheme: ['n(MnO₄⁻) = 0.0200 × 18.60/1000 = 3.72 × 10⁻⁴ mol.',
                     'n(H₂C₂O₄) = 3.72 × 10⁻⁴ × 5/2 = 9.30 × 10⁻⁴ mol.',
                     'Concentration = 9.30 × 10⁻⁴ / 0.0250 = 0.0372 mol dm⁻³.'],
            note: 'Allow error carried forward from an incorrect ratio in (a).' },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why no indicator is needed in this titration.',
            scheme: ['Manganate(VII) is self-indicating — it is deep purple and is decolourised as it reacts.',
                     'The end point is the first permanent pale pink colour, when manganate(VII) is no longer being reduced.'],
          },
        ],
      },
      {
        n: 4, topic: 'equilibria',
        stem: 'Ammonia is manufactured by the Haber process: N₂(g) + 3H₂(g) ⇌ 2NH₃(g), ΔH = −92 kJ mol⁻¹.',
        parts: [
          { ref: '(a)', command: 'State', marks: 2,
            text: 'State and explain the effect of increasing the temperature on the equilibrium yield of ammonia.',
            scheme: ['The yield decreases.',
                     'The forward reaction is exothermic, so by Le Chatelier’s principle the equilibrium shifts in the endothermic (reverse) direction to absorb the added heat.'],
          },
          { ref: '(b)', command: 'Explain', marks: 2,
            text: 'Explain why a temperature of about 450 °C is used industrially despite your answer to (a).',
            scheme: ['A low temperature would give a higher yield but an unacceptably slow rate.',
                     '450 °C is a compromise giving an acceptable yield in an economic time.'],
          },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain the effect of adding a catalyst on the position of this equilibrium and on the time taken to reach it.',
            scheme: ['The position of equilibrium is unchanged — a catalyst speeds up the forward and reverse reactions equally.',
                     'Equilibrium is reached in a shorter time.'],
          },
          { ref: '(d)', command: 'Write', marks: 2,
            text: 'Write an expression for Kᶜ for this equilibrium and state its units.',
            scheme: ['Kᶜ = [NH₃]² / ([N₂][H₂]³).',
                     'Units: mol⁻² dm⁶.'],
          },
        ],
      },
      {
        n: 5, topic: 'functional-groups',
        stem: 'Compound Q, C₄H₈O, does not decolourise bromine water, gives an orange precipitate with 2,4-dinitrophenylhydrazine, and gives no reaction with Fehling’s solution.',
        parts: [
          { ref: '(a)', command: 'Deduce', marks: 3,
            text: 'Deduce the functional group present in Q and give its structure and systematic name.',
            scheme: ['The 2,4-DNPH result shows a carbonyl group; the negative Fehling’s result shows it is a ketone rather than an aldehyde.',
                     'No reaction with bromine water shows there is no C=C.',
                     'Q is CH₃COCH₂CH₃, butanone.'],
          },
          { ref: '(b)', command: 'Describe', marks: 2,
            text: 'Describe what you would observe when Q is warmed with alkaline aqueous iodine, and state what this tells you about its structure.',
            scheme: ['A pale yellow precipitate with an antiseptic smell (tri-iodomethane) forms.',
                     'This confirms a CH₃CO– group adjacent to the carbonyl.'],
          },
          { ref: '(c)', command: 'Suggest', marks: 2,
            text: 'Suggest a reagent that would reduce Q, and give the name of the organic product.',
            scheme: ['NaBH₄ in aqueous solution (or LiAlH₄ in dry ether).',
                     'Butan-2-ol.'],
          },
        ],
      },
      {
        n: 6, topic: 'mechanisms',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 4,
            text: 'Bromoethane is heated with ethanolic potassium cyanide. Describe the mechanism of the reaction, naming it and using curly arrows.',
            scheme: ['Sₙ² — nucleophilic substitution, bimolecular.',
                     'Curly arrow from a lone pair on the carbon of CN⁻ to the δ⁺ carbon of the C–Br bond.',
                     'Curly arrow from the C–Br bond to the bromine, with the two changes shown simultaneously through a transition state.',
                     'Products: propanenitrile, CH₃CH₂CN, and Br⁻.'],
          },
          { ref: '(b)', command: 'Explain', marks: 2,
            text: 'Explain why this reaction is useful in organic synthesis.',
            scheme: ['It lengthens the carbon chain by one carbon.',
                     'The nitrile can be hydrolysed to a carboxylic acid or reduced to an amine, opening further routes.'],
          },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why iodoethane reacts faster than bromoethane with cyanide ions.',
            scheme: ['The C–I bond is weaker than the C–Br bond (longer, with poorer orbital overlap).',
                     'Less energy is needed to break it, so the activation energy is lower and the rate is higher.'],
            note: 'An answer based on electronegativity alone scores 0 — bond enthalpy is the determining factor.' },
        ],
      },
      {
        n: 7, topic: 'energetics',
        stem: 'A student adds 50.0 cm³ of 1.00 mol dm⁻³ hydrochloric acid to 50.0 cm³ of 1.00 mol dm⁻³ sodium hydroxide solution in a polystyrene cup. The temperature rises by 6.4 °C.',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define the term standard enthalpy change of neutralisation.',
            scheme: ['The enthalpy change when an acid and a base react to form one mole of water.',
                     'Under standard conditions, with all substances in their standard states.'] },
          { ref: '(b)', command: 'Calculate', marks: 3,
            text: 'Calculate the enthalpy change of neutralisation, in kJ mol⁻¹. Take the specific heat capacity of the mixture to be 4.18 J g⁻¹ K⁻¹ and its density to be 1.00 g cm⁻³.',
            scheme: ['q = mcΔT = 100 × 4.18 × 6.4 = 2675 J.',
                     'n(H₂O) formed = 0.0500 mol.',
                     'ΔH = −2675 / 0.0500 = −53.5 kJ mol⁻¹ (allow −53 to −54).'],
            note: 'The total mass is 100 g, not 50 g. A candidate using 50 g scores the later marks only by error carried forward. The sign must be negative.' },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'The data book value is −57.1 kJ mol⁻¹. Explain why the student’s value is less exothermic.',
            scheme: ['Heat was lost to the surroundings and to the cup and thermometer rather than all of it raising the temperature of the mixture.',
                     'The measured temperature rise is therefore smaller than the true one, giving a less exothermic value.'],
            note: 'Do not accept "experimental error" unqualified.' },
        ],
      },
      {
        n: 8, topic: 'equilibria',
        stem: 'The decomposition of hydrogen peroxide is catalysed by manganese(IV) oxide.',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 3,
            text: 'Explain, in terms of the Boltzmann distribution, why raising the temperature increases the rate of a reaction.',
            scheme: ['Raising the temperature increases the mean kinetic energy of the molecules, flattening the distribution and shifting it to the right.',
                     'A greater proportion of molecules then have energy equal to or greater than the activation energy.',
                     'More collisions are therefore successful per unit time, so the rate increases.'],
            note: 'An answer relying only on more frequent collisions scores a maximum of 1 — the proportion exceeding Ea is the dominant effect.' },
          { ref: '(b)', command: 'Explain', marks: 2,
            text: 'Explain, with reference to activation energy, how manganese(IV) oxide increases the rate of this decomposition.',
            scheme: ['It provides an alternative reaction pathway of lower activation energy.',
                     'A greater proportion of molecules has sufficient energy for that pathway, so the rate increases.'],
          },
          { ref: '(c)', command: 'Suggest', marks: 2,
            text: 'Suggest how the progress of this reaction could be followed, and sketch the shape of the graph you would expect.',
            scheme: ['Collect the oxygen evolved in a gas syringe and record its volume at regular intervals.',
                     'A curve rising steeply at first and levelling off to a plateau as the hydrogen peroxide is used up.'],
          },
        ],
      },
    ],
  });

  /* The second mock. Deliberately not a reshuffle of the first: it leans on
     the calculation topics the first paper only touches — the ideal gas
     equation, bond enthalpies, Kc — so that alternating between them over two
     months actually covers the syllabus rather than asking the same things
     twice in different words. */
  PAPERS.push({
    id: 'chem-full-as-2',
    subject: 'chemistry',
    kind: 'full',
    title: 'AS Level Chemistry — calculations and equilibria',
    component: 'AS Level, structured questions',
    minutes: 75,
    questions: [
      {
        n: 1, topic: 'atomic-structure',
        stem: 'The mass spectrum of a sample of zirconium shows five isotopes with the following abundances: ⁹⁰Zr 51.5%, ⁹¹Zr 11.2%, ⁹²Zr 17.1%, ⁹⁴Zr 17.4%, ⁹⁶Zr 2.8%.',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define the term relative isotopic mass.',
            scheme: ['The mass of one atom of an isotope compared with one twelfth of the mass of one atom of carbon-12.',
                     'It is a ratio and therefore has no units.'] },
          { ref: '(b)', command: 'Calculate', marks: 3,
            text: 'Calculate the relative atomic mass of this sample of zirconium, giving your answer to three significant figures.',
            scheme: ['Multiplying each isotopic mass by its abundance and summing.',
                     '(90 × 51.5 + 91 × 11.2 + 92 × 17.1 + 94 × 17.4 + 96 × 2.8) = 9131.8.',
                     'Dividing by 100 gives 91.3.'],
            note: 'Allow 91.3 to 91.4. An answer that divides by 5 rather than by the total abundance scores the first mark only.' },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why the isotopes of zirconium have identical chemical properties but different physical properties.',
            scheme: ['Chemical properties depend on the number and arrangement of electrons, which is the same for every isotope.',
                     'Physical properties such as density and rate of diffusion depend on mass, which differs because the number of neutrons differs.'] },
        ],
      },
      {
        n: 2, topic: 'moles',
        parts: [
          { ref: '(a)', command: 'State', marks: 2,
            text: 'State the ideal gas equation and give the units of each quantity in it when SI units are used.',
            scheme: ['pV = nRT.',
                     'p in Pa, V in m³, n in mol, R in J K⁻¹ mol⁻¹ and T in K.'] },
          { ref: '(b)', command: 'Calculate', marks: 3,
            text: 'Calculate the volume, in dm³, occupied by 4.40 g of carbon dioxide at 298 K and 100 kPa. [R = 8.31 J K⁻¹ mol⁻¹]',
            scheme: ['n(CO₂) = 4.40 / 44.0 = 0.100 mol.',
                     'V = nRT/p = (0.100 × 8.31 × 298) / 100000.',
                     '= 2.48 × 10⁻³ m³ = 2.48 dm³.'],
            note: 'A candidate who leaves the answer in m³ loses the final mark only. Using 100 rather than 100000 for the pressure is a power-of-ten error and scores the first two marks.' },
          { ref: '(c)', command: 'Calculate', marks: 3,
            text: 'A sample of 0.310 g of a gaseous oxide occupies 120 cm³ at 298 K and 100 kPa. Calculate its relative molecular mass and suggest its identity.',
            scheme: ['n = pV/RT = (100000 × 1.20 × 10⁻⁴) / (8.31 × 298) = 4.85 × 10⁻³ mol.',
                     'Mᵣ = 0.310 / 4.85 × 10⁻³ = 64.0.',
                     'The gas is sulfur dioxide, SO₂.'] },
        ],
      },
      {
        n: 3, topic: 'energetics',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define the term bond enthalpy.',
            scheme: ['The energy required to break one mole of a specified covalent bond.',
                     'With all species in the gaseous state.'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'Use the bond enthalpies C–H 412, O=O 496, C=O 805 and O–H 463 kJ mol⁻¹ to calculate the enthalpy change for CH₄(g) + 2O₂(g) → CO₂(g) + 2H₂O(g).',
            scheme: ['Bonds broken: 4(412) + 2(496) = 2640 kJ mol⁻¹.',
                     'Bonds formed: 2(805) + 4(463) = 3462 kJ mol⁻¹.',
                     'ΔH = bonds broken − bonds formed = 2640 − 3462.',
                     '= −822 kJ mol⁻¹.'],
            note: 'The sign must be negative. Reversing the subtraction gives +822 and loses the final two marks.' },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why a value calculated from bond enthalpies differs from the value measured experimentally.',
            scheme: ['Bond enthalpies are mean values averaged over many different compounds containing that bond.',
                     'The actual bond enthalpy depends on the rest of the molecule, and the calculation also assumes all species are gaseous.'] },
        ],
      },
      {
        n: 4, topic: 'equilibria',
        stem: 'Hydrogen and iodine react according to H₂(g) + I₂(g) ⇌ 2HI(g). 1.00 mol of hydrogen and 1.00 mol of iodine are placed in a sealed vessel of volume 2.00 dm³ and allowed to reach equilibrium, at which point 1.60 mol of hydrogen iodide is present.',
        parts: [
          { ref: '(a)', command: 'Write', marks: 2,
            text: 'Write the expression for Kᶜ for this equilibrium and deduce its units.',
            scheme: ['Kᶜ = [HI]² / ([H₂][I₂]).',
                     'The concentration terms cancel, so Kᶜ has no units.'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'Calculate the value of Kᶜ at this temperature.',
            scheme: ['Forming 1.60 mol HI uses 0.80 mol of each reactant.',
                     'At equilibrium n(H₂) = n(I₂) = 0.20 mol and n(HI) = 1.60 mol.',
                     'Dividing by 2.00 dm³: [H₂] = [I₂] = 0.10 and [HI] = 0.80 mol dm⁻³.',
                     'Kᶜ = 0.80² / (0.10 × 0.10) = 64.'],
            note: 'Omitting the division by volume is the commonest error. Because the concentration terms cancel here it gives the same answer, so award the final mark only if the volume step is seen.' },
          { ref: '(c)', command: 'State', marks: 3,
            text: 'State and explain the effect on the value of Kᶜ of adding a catalyst, and of raising the temperature given that the forward reaction is exothermic.',
            scheme: ['A catalyst has no effect on Kᶜ — it speeds both directions equally.',
                     'Raising the temperature decreases Kᶜ.',
                     'The equilibrium shifts in the endothermic (reverse) direction, so there is proportionally less product at equilibrium.'],
            note: 'Kᶜ is changed by temperature alone. A candidate saying pressure or concentration changes Kᶜ has the central idea wrong.' },
        ],
      },
      {
        n: 5, topic: 'bonding',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 2,
            text: 'Describe the bonding in a metal such as sodium.',
            scheme: ['A lattice of positive metal ions in a sea of delocalised electrons.',
                     'The bonding is the electrostatic attraction between the positive ions and the delocalised electrons.'] },
          { ref: '(b)', command: 'Explain', marks: 3,
            text: 'Explain why the melting points of the Period 3 metals increase from sodium to aluminium.',
            scheme: ['The charge on the metal ion increases from 1+ to 3+ across the three.',
                     'Each atom contributes more delocalised electrons, and the ionic radius decreases.',
                     'The attraction between the ions and the delocalised electrons is therefore stronger and more energy is needed to melt the lattice.'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why magnesium oxide has a much higher melting point than phosphorus(V) oxide.',
            scheme: ['MgO is a giant ionic lattice; melting it requires strong electrostatic attractions between Mg²⁺ and O²⁻ to be overcome.',
                     'P₄O₁₀ is simple molecular; only weak intermolecular forces between the molecules need to be overcome.'] },
        ],
      },
      {
        n: 6, topic: 'functional-groups',
        parts: [
          { ref: '(a)', command: 'Classify', marks: 2,
            text: 'Classify butan-1-ol, butan-2-ol and 2-methylpropan-2-ol as primary, secondary or tertiary, and state how the classification is decided.',
            scheme: ['Butan-1-ol primary, butan-2-ol secondary, 2-methylpropan-2-ol tertiary.',
                     'The class is decided by the number of carbon atoms bonded to the carbon carrying the –OH group.'] },
          { ref: '(b)', command: 'State', marks: 4,
            text: 'Ethanol is warmed with ethanoic acid in the presence of a few drops of concentrated sulfuric acid. State the type of reaction, name and give the structure of the organic product, and state the role of the sulfuric acid.',
            scheme: ['Esterification (condensation).',
                     'The product is ethyl ethanoate.',
                     'CH₃COOCH₂CH₃.',
                     'The sulfuric acid is a catalyst, and removes water to shift the equilibrium towards the ester.'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why ethyl ethanoate has a lower boiling point than ethanoic acid, although their relative molecular masses are similar.',
            scheme: ['Ethanoic acid molecules hydrogen bond to one another, forming dimers.',
                     'The ester has no O–H group so cannot hydrogen bond to itself; only weaker dipole–dipole forces operate, so less energy is needed to separate the molecules.'] },
        ],
      },
      {
        n: 7, topic: 'mechanisms',
        parts: [
          { ref: '(a)', command: 'State', marks: 2,
            text: '2-bromobutane can undergo either substitution or elimination with potassium hydroxide. State the conditions that favour each.',
            scheme: ['Substitution is favoured by aqueous potassium hydroxide, warmed.',
                     'Elimination is favoured by potassium hydroxide dissolved in ethanol, heated under reflux.'],
            note: 'The solvent is the discriminator and must be stated; "heat" alone is not enough.' },
          { ref: '(b)', command: 'Describe', marks: 4,
            text: 'Describe the mechanism of the elimination reaction of 2-bromobutane with ethanolic potassium hydroxide, using curly arrows.',
            scheme: ['Curly arrow from a lone pair on the hydroxide oxygen to a hydrogen on a carbon adjacent to the C–Br carbon.',
                     'Curly arrow from that C–H bond to form the C=C double bond.',
                     'Curly arrow from the C–Br bond to the bromine.',
                     'Products are the alkene, water and Br⁻.'],
            note: 'Hydroxide acts here as a base, not a nucleophile. An arrow drawn to the carbon rather than to the hydrogen is substitution and scores nothing for the first mark.' },
          { ref: '(c)', command: 'Name', marks: 1,
            text: 'Name the two alkenes that can be formed, and state which is the major product.',
            scheme: ['But-1-ene and but-2-ene, with but-2-ene the major product as the more substituted alkene.'] },
        ],
      },
      {
        n: 8, topic: 'moles',
        parts: [
          { ref: '(a)', command: 'Determine', marks: 3,
            text: 'A compound contains 40.0% carbon, 6.7% hydrogen and 53.3% oxygen by mass. Determine its empirical formula.',
            scheme: ['Dividing each percentage by the relevant Aᵣ: C 40.0/12.0 = 3.33, H 6.7/1.0 = 6.7, O 53.3/16.0 = 3.33.',
                     'Dividing through by the smallest, 3.33, gives 1 : 2 : 1.',
                     'Empirical formula CH₂O.'] },
          { ref: '(b)', command: 'Calculate', marks: 3,
            text: 'A reaction is expected to give 0.250 mol of a product of Mᵣ 60.0, but only 11.4 g is isolated. Calculate the percentage yield.',
            scheme: ['Theoretical mass = 0.250 × 60.0 = 15.0 g.',
                     'Percentage yield = (11.4 / 15.0) × 100.',
                     '= 76.0%.'] },
        ],
      },
    ],
  });

  /* =======================================================================
     9709 Mathematics

     A note on where this content actually sits in the syllabus, because it
     matters if a student is checking their revision against it: quadratics,
     trigonometry, differentiation and integration below are Pure Mathematics 1
     (Paper 1). Vectors are Pure Mathematics 3 (Paper 3). Matrices are not in
     9709 at all — they are Further Mathematics 9231 — and they are here because
     the notebook this subject is mapped to is a linear algebra one, and a
     student revising linear algebra should be asked about matrices. Each paper
     says which component its questions come from.

     Mark schemes use Cambridge's own notation, since a student who learns to
     read M1/A1 is reading real mark schemes: M for a method mark, awarded for
     a correct approach whatever the arithmetic does afterwards; A for an
     accuracy mark, which depends on the M before it; B for an independent
     mark. This is why method is worth writing down — the structure of the
     scheme is itself the lesson.
     ======================================================================= */

  PAPERS.push({
    id: 'math-sec-vectors',
    subject: 'mathematics',
    tex: true,
    kind: 'section',
    title: 'Vectors and matrices',
    component: 'Pure Mathematics 3, and Further Mathematics for the matrices',
    minutes: 35,
    questions: [
      {
        n: 1, topic: 'vectors',
        stem: 'The vectors $\\mathbf{a}$ and $\\mathbf{b}$ are given by $\\mathbf{a} = 2\\mathbf{i} - 3\\mathbf{j} + \\mathbf{k}$ and $\\mathbf{b} = \\mathbf{i} + 4\\mathbf{j} - 2\\mathbf{k}$.',
        parts: [
          { ref: '(a)', command: 'Find', marks: 3,
            text: 'Find $\\mathbf{a} + \\mathbf{b}$ and show that $|\\mathbf{a} + \\mathbf{b}| = \\sqrt{11}$.',
            scheme: ['B1 — $\\mathbf{a} + \\mathbf{b} = 3\\mathbf{i} + \\mathbf{j} - \\mathbf{k}$',
                     'M1 — $|\\mathbf{a} + \\mathbf{b}| = \\sqrt{3^2 + 1^2 + (-1)^2}$',
                     'A1 — $= \\sqrt{11}$'] },
          { ref: '(b)', command: 'Find', marks: 4,
            text: 'Find the angle between $\\mathbf{a}$ and $\\mathbf{b}$, giving your answer in degrees to one decimal place.',
            scheme: ['M1 — $\\mathbf{a} \\cdot \\mathbf{b} = 2(1) + (-3)(4) + (1)(-2) = -12$',
                     'B1 — $|\\mathbf{a}| = \\sqrt{14}$ and $|\\mathbf{b}| = \\sqrt{21}$',
                     'M1 — $\\cos\\theta = \\frac{-12}{\\sqrt{14}\\sqrt{21}} = -0.6999$',
                     'A1 — $\\theta = 134.4\\degree$'],
            note: 'An answer of $45.6\\degree$ (the acute angle) scores a maximum of 3 — a negative scalar product means the angle is obtuse.' },
          { ref: '(c)', command: 'State', marks: 1,
            text: 'State what the sign of $\\mathbf{a} \\cdot \\mathbf{b}$ tells you about the directions of $\\mathbf{a}$ and $\\mathbf{b}$.',
            scheme: ['B1 — a negative scalar product means the angle between them is obtuse'] },
        ],
      },
      {
        n: 2, topic: 'matrices',
        stem: 'The matrix $M$ has first row $3,\\ 1$ and second row $2,\\ 4$.',
        parts: [
          { ref: '(a)', command: 'Find', marks: 3,
            text: 'Find $\\det M$ and hence find $M^{-1}$.',
            scheme: ['B1 — $\\det M = (3)(4) - (1)(2) = 10$',
                     'M1 — adjugate has first row $4,\\ -1$ and second row $-2,\\ 3$',
                     'A1 — $M^{-1} = \\frac{1}{10}$ times that matrix'],
            note: 'A candidate who negates the leading diagonal instead of the off-diagonal loses the accuracy mark.' },
          { ref: '(b)', command: 'Solve', marks: 3,
            text: 'Use $M^{-1}$ to solve the simultaneous equations $3x + y = 5$ and $2x + 4y = 10$.',
            scheme: ['M1 — writing the system as $M\\mathbf{x} = \\mathbf{b}$ and pre-multiplying by $M^{-1}$',
                     'M1 — $\\frac{1}{10}(4(5) - 1(10),\\ -2(5) + 3(10)) = \\frac{1}{10}(10,\\ 20)$',
                     'A1 — $x = 1$, $y = 2$'],
            note: 'The correct answer by elimination rather than the inverse scores 1 — the question specifies the method.' },
          { ref: '(c)', command: 'Find', marks: 3,
            text: 'Find the eigenvalues of $M$.',
            scheme: ['M1 — $\\det(M - \\lambda I) = 0$ giving $(3 - \\lambda)(4 - \\lambda) - 2 = 0$',
                     'A1 — $\\lambda^2 - 7\\lambda + 10 = 0$',
                     'A1 — $\\lambda = 2$ and $\\lambda = 5$'] },
        ],
      },
      {
        n: 3, topic: 'matrices',
        parts: [
          { ref: '(a)', command: 'Write down', marks: 2,
            text: 'Write down the matrix $R$ representing a rotation of $90\\degree$ anticlockwise about the origin, and the matrix $S$ representing a reflection in the line $y = x$.',
            scheme: ['B1 — $R$ has first row $0,\\ -1$ and second row $1,\\ 0$',
                     'B1 — $S$ has first row $0,\\ 1$ and second row $1,\\ 0$'] },
          { ref: '(b)', command: 'Find', marks: 3,
            text: 'Find the single matrix representing the rotation $R$ followed by the reflection $S$, and describe the resulting transformation geometrically.',
            scheme: ['M1 — the composite is $SR$, with $S$ on the left',
                     'A1 — $SR$ has first row $1,\\ 0$ and second row $0,\\ -1$',
                     'A1 — this is a reflection in the $x$-axis'],
            note: '$RS$ rather than $SR$ scores the method mark only; order matters and the question gives it.' },
          { ref: '(c)', command: 'Explain', marks: 3,
            text: 'The determinant of $S$ is $-1$. Explain what the sign and the magnitude of a determinant tell you about the transformation it represents.',
            scheme: ['B1 — the magnitude is the area scale factor of the transformation',
                     'B1 — here it is $1$, so area is preserved',
                     'B1 — a negative determinant means orientation is reversed, which is what a reflection does'] },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'math-sec-calculus',
    subject: 'mathematics',
    tex: true,
    kind: 'section',
    title: 'Differentiation and integration',
    component: 'Pure Mathematics 1',
    minutes: 35,
    questions: [
      {
        n: 1, topic: 'differentiation',
        parts: [
          { ref: '(a)', command: 'Differentiate', marks: 2,
            text: 'Differentiate $y = (2x + 1)^5$ with respect to $x$.',
            scheme: ['M1 — chain rule: $5(2x + 1)^4 \\times 2$',
                     'A1 — $\\frac{dy}{dx} = 10(2x + 1)^4$'] },
          { ref: '(b)', command: 'Find', marks: 3,
            text: 'Find $\\frac{dy}{dx}$ when $y = \\frac{x^2}{x + 1}$, simplifying your answer.',
            scheme: ['M1 — quotient rule with $u = x^2$ and $v = x + 1$',
                     'A1 — $\\frac{2x(x + 1) - x^2(1)}{(x + 1)^2}$',
                     'A1 — $= \\frac{x^2 + 2x}{(x + 1)^2}$'] },
          { ref: '(c)', command: 'Find', marks: 4,
            text: 'Find the coordinates of the stationary points of the curve $y = x^3 - 6x^2 + 9x$ and determine the nature of each.',
            scheme: ['M1 — $\\frac{dy}{dx} = 3x^2 - 12x + 9 = 3(x - 1)(x - 3)$, set to zero',
                     'A1 — stationary points at $(1,\\ 4)$ and $(3,\\ 0)$',
                     'M1 — $\\frac{d^2y}{dx^2} = 6x - 12$, evaluated at each point',
                     'A1 — $(1,\\ 4)$ is a maximum since $-6 < 0$; $(3,\\ 0)$ is a minimum since $6 > 0$'] },
        ],
      },
      {
        n: 2, topic: 'integration',
        parts: [
          { ref: '(a)', command: 'Find', marks: 2,
            text: 'Find $\\int (3x^2 - 4x + 1)\\,dx$.',
            scheme: ['M1 — raising each power by one and dividing by the new power',
                     'A1 — $x^3 - 2x^2 + x + c$'],
            note: 'Omitting the constant of integration loses the accuracy mark.' },
          { ref: '(b)', command: 'Evaluate', marks: 3,
            text: 'Evaluate $\\int_1^4 \\frac{1}{\\sqrt{x}}\\,dx$.',
            scheme: ['M1 — writing the integrand as $x^{-1/2}$',
                     'A1 — integrating to $2x^{1/2}$',
                     'A1 — $2\\sqrt{4} - 2\\sqrt{1} = 2$'],
            note: 'The negative index must be seen for the method mark — a candidate who cannot rewrite the surd scores nothing here.' },
          { ref: '(c)', command: 'Find', marks: 4,
            text: 'The curve $y = 4x - x^2$ meets the $x$-axis at two points. Find the area of the region enclosed between the curve and the $x$-axis.',
            scheme: ['B1 — roots at $x = 0$ and $x = 4$',
                     'M1 — area $= \\int_0^4 (4x - x^2)\\,dx$',
                     'A1 — $= [2x^2 - \\frac{x^3}{3}]_0^4$',
                     'A1 — $= 32 - \\frac{64}{3} = \\frac{32}{3}$'] },
        ],
      },
      {
        n: 3, topic: 'integration',
        parts: [
          { ref: '(a)', command: 'Find', marks: 4,
            text: 'The region bounded by the curve $y = \\sqrt{x}$, the $x$-axis and the line $x = 4$ is rotated completely about the $x$-axis. Find the exact volume of the solid formed.',
            scheme: ['M1 — using $V = \\pi\\int y^2\\,dx$',
                     'A1 — squaring $y$ correctly to give $\\pi\\int_0^4 x\\,dx$',
                     'M1 — integrating to $\\pi[\\frac{x^2}{2}]_0^4$',
                     'A1 — $= 8\\pi$'] },
          { ref: '(b)', command: 'Find', marks: 3,
            text: 'The radius of a circle is increasing at a constant rate of $0.2$ cm s$^{-1}$. Find the rate at which its area is increasing at the instant when the radius is $5$ cm.',
            scheme: ['B1 — $A = \\pi r^2$ so $\\frac{dA}{dr} = 2\\pi r$',
                     'M1 — $\\frac{dA}{dt} = \\frac{dA}{dr} \\times \\frac{dr}{dt} = 2\\pi(5)(0.2)$',
                     'A1 — $= 2\\pi \\approx 6.28$ cm$^2$ s$^{-1}$'],
            note: 'The chain rule must be seen for the method mark. Units are not required.' },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'math-full-p1',
    subject: 'mathematics',
    tex: true,
    kind: 'full',
    title: 'Pure Mathematics — structured questions',
    component: 'Pure Mathematics 1, with vectors and matrices',
    minutes: 90,
    questions: [
      {
        n: 1, topic: 'quadratics',
        stem: 'The function $f$ is given by $f(x) = 2x^2 - 8x + 11$.',
        parts: [
          { ref: '(a)', command: 'Express', marks: 3,
            text: 'Express $f(x)$ in the form $a(x + b)^2 + c$, stating the values of $a$, $b$ and $c$.',
            scheme: ['M1 — taking out the factor $2$: $2(x^2 - 4x) + 11$',
                     'M1 — completing the square inside: $2[(x - 2)^2 - 4] + 11$',
                     'A1 — $2(x - 2)^2 + 3$, so $a = 2$, $b = -2$, $c = 3$'] },
          { ref: '(b)', command: 'State', marks: 2,
            text: 'State the coordinates of the minimum point of the curve $y = f(x)$ and the range of $f$.',
            scheme: ['B1 — minimum point $(2,\\ 3)$',
                     'B1 — range $f(x) \\ge 3$'] },
          { ref: '(c)', command: 'State', marks: 2,
            text: 'The function $g$ is defined as $g(x) = f(x)$ for $x \\ge k$. State the least value of $k$ for which $g$ has an inverse, and explain your answer.',
            scheme: ['B1 — $k = 2$',
                     'B1 — for $x \\ge 2$ the function is one-one, so an inverse exists; below $2$ it is many-one'] },
        ],
      },
      {
        n: 2, topic: 'trigonometry',
        parts: [
          { ref: '(a)', command: 'Solve', marks: 5,
            text: 'Solve the equation $3\\sin^2 x + 2\\cos x = 2$ for $0\\degree \\le x \\le 360\\degree$.',
            scheme: ['M1 — using $\\sin^2 x = 1 - \\cos^2 x$ to write the equation in $\\cos x$ only',
                     'A1 — $3 - 3\\cos^2 x + 2\\cos x = 2$, so $3\\cos^2 x - 2\\cos x - 1 = 0$',
                     'M1 — factorising: $(3\\cos x + 1)(\\cos x - 1) = 0$',
                     'A1 — $\\cos x = 1$ gives $x = 0\\degree$ and $360\\degree$',
                     'A1 — $\\cos x = -\\frac{1}{3}$ gives $x = 109.5\\degree$ and $250.5\\degree$'],
            note: 'Candidates losing the solutions at the ends of the interval are penalised once only.' },
          { ref: '(b)', command: 'Prove', marks: 3,
            text: 'Prove the identity $\\frac{1 - \\cos^2\\theta}{\\sin\\theta\\cos\\theta} = \\tan\\theta$.',
            scheme: ['M1 — replacing $1 - \\cos^2\\theta$ with $\\sin^2\\theta$',
                     'M1 — $\\frac{\\sin^2\\theta}{\\sin\\theta\\cos\\theta} = \\frac{\\sin\\theta}{\\cos\\theta}$',
                     'A1 — $= \\tan\\theta$, as required'],
            note: 'A proof working on both sides at once is accepted provided each step is reversible.' },
        ],
      },
      {
        n: 3, topic: 'differentiation',
        stem: 'A curve has equation $y = \\frac{3x - 1}{x + 2}$.',
        parts: [
          { ref: '(a)', command: 'Show', marks: 3,
            text: 'Show that $\\frac{dy}{dx} = \\frac{7}{(x + 2)^2}$.',
            scheme: ['M1 — quotient rule with $u = 3x - 1$ and $v = x + 2$',
                     'A1 — $\\frac{3(x + 2) - (3x - 1)(1)}{(x + 2)^2}$',
                     'A1 — numerator simplifies to $7$, giving the required result'] },
          { ref: '(b)', command: 'Find', marks: 3,
            text: 'Find the equation of the tangent to the curve at the point where $x = 1$, giving your answer in the form $ay = bx + c$.',
            scheme: ['B1 — at $x = 1$, $y = \\frac{2}{3}$ and $\\frac{dy}{dx} = \\frac{7}{9}$',
                     'M1 — $y - \\frac{2}{3} = \\frac{7}{9}(x - 1)$',
                     'A1 — $9y = 7x - 1$'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why this curve has no stationary points.',
            scheme: ['B1 — a stationary point requires $\\frac{dy}{dx} = 0$',
                     'B1 — $\\frac{7}{(x + 2)^2}$ has a non-zero constant numerator, so it is never zero for any $x$ in the domain'] },
        ],
      },
      {
        n: 4, topic: 'integration',
        parts: [
          { ref: '(a)', command: 'Find', marks: 2,
            text: 'Find $\\int (2x + 3)^4\\,dx$.',
            scheme: ['M1 — raising the power and dividing by the new power and by the coefficient of $x$',
                     'A1 — $\\frac{(2x + 3)^5}{10} + c$'] },
          { ref: '(b)', command: 'Evaluate', marks: 3,
            text: 'Evaluate $\\int_1^2 \\left(x + \\frac{1}{x^2}\\right)dx$.',
            scheme: ['M1 — integrating $x$ to $\\frac{x^2}{2}$ and $\\frac{1}{x^2}$ to $-\\frac{1}{x}$',
                     'M1 — substituting the limits: $(2 - \\frac{1}{2}) - (\\frac{1}{2} - 1)$',
                     'A1 — $= 2$'],
            note: 'The integral of $x^{-2}$ is $-x^{-1}$; a sign slip here costs the final mark only.' },
          { ref: '(c)', command: 'Find', marks: 3,
            text: 'Find the area of the region enclosed between the curve $y = x^2$ and the line $y = 2x$.',
            scheme: ['B1 — intersections at $x = 0$ and $x = 2$',
                     'M1 — area $= \\int_0^2 (2x - x^2)\\,dx$, line minus curve',
                     'A1 — $= [x^2 - \\frac{x^3}{3}]_0^2 = \\frac{4}{3}$'],
            note: 'Curve minus line gives $-\\frac{4}{3}$; award the method mark but not the answer mark.' },
        ],
      },
      {
        n: 5, topic: 'vectors',
        stem: 'The points $A$, $B$ and $C$ have position vectors $A(1,\\ 2,\\ -1)$, $B(3,\\ -1,\\ 2)$ and $C(0,\\ 4,\\ 1)$.',
        parts: [
          { ref: '(a)', command: 'Find', marks: 3,
            text: 'Find the vector $\\overline{AB}$ and its magnitude.',
            scheme: ['M1 — subtracting position vectors in the order $B - A$',
                     'A1 — $\\overline{AB} = (2,\\ -3,\\ 3)$',
                     'A1 — $|\\overline{AB}| = \\sqrt{22} \\approx 4.69$'],
            note: '$A - B$ rather than $B - A$ scores the method mark only.' },
          { ref: '(b)', command: 'Find', marks: 5,
            text: 'Find the angle $BAC$, giving your answer in degrees to one decimal place.',
            scheme: ['B1 — $\\overline{AC} = (-1,\\ 2,\\ 2)$',
                     'M1 — $\\overline{AB} \\cdot \\overline{AC} = 2(-1) + (-3)(2) + 3(2) = -2$',
                     'B1 — $|\\overline{AC}| = 3$',
                     'M1 — $\\cos(BAC) = \\frac{-2}{3\\sqrt{22}}$',
                     'A1 — angle $BAC = 98.2\\degree$'],
            note: 'Both vectors must start at $A$. Using $\\overline{BA}$ and $\\overline{AC}$ gives the supplement and scores a maximum of 3.' },
        ],
      },
      {
        n: 6, topic: 'matrices',
        stem: 'The matrix $A$ has first row $4,\\ 3$ and second row $1,\\ 2$.',
        parts: [
          { ref: '(a)', command: 'Find', marks: 3,
            text: 'Find $\\det A$ and $A^{-1}$.',
            scheme: ['B1 — $\\det A = (4)(2) - (3)(1) = 5$',
                     'M1 — adjugate has first row $2,\\ -3$ and second row $-1,\\ 4$',
                     'A1 — $A^{-1} = \\frac{1}{5}$ times that matrix'] },
          { ref: '(b)', command: 'Solve', marks: 3,
            text: 'Hence solve the simultaneous equations $4x + 3y = 18$ and $x + 2y = 7$.',
            scheme: ['M1 — pre-multiplying $(18,\\ 7)$ by $A^{-1}$',
                     'M1 — $\\frac{1}{5}(2(18) - 3(7),\\ -1(18) + 4(7)) = \\frac{1}{5}(15,\\ 10)$',
                     'A1 — $x = 3$, $y = 2$'] },
          { ref: '(c)', command: 'State', marks: 2,
            text: 'State the effect of the transformation represented by $A$ on the area of a shape, and justify your answer.',
            scheme: ['B1 — areas are multiplied by $5$',
                     'B1 — because the area scale factor of a transformation is the magnitude of its determinant'] },
        ],
      },
      {
        n: 7, topic: 'trigonometry',
        parts: [
          { ref: '(a)', command: 'Sketch', marks: 4,
            text: 'Sketch the graph of $y = 2\\sin 3x$ for $0 \\le x \\le 2\\pi$, and state the amplitude and the period of the curve.',
            scheme: ['B1 — a sine curve of the correct shape starting at the origin',
                     'B1 — three complete cycles shown across the interval',
                     'B1 — amplitude $2$',
                     'B1 — period $\\frac{2\\pi}{3}$'] },
          { ref: '(b)', command: 'State', marks: 3,
            text: 'Hence state the number of solutions of the equation $2\\sin 3x = 1$ in the interval $0 \\le x \\le 2\\pi$, and explain how your sketch shows this.',
            scheme: ['B1 — the equation becomes $\\sin 3x = \\frac{1}{2}$',
                     'M1 — the line $y = 1$ crosses the curve twice in each of the three cycles',
                     'A1 — so there are $6$ solutions'] },
        ],
      },
      {
        n: 8, topic: 'differentiation',
        stem: 'A closed cylindrical can of radius $r$ cm and height $h$ cm has a volume of $500$ cm$^3$.',
        parts: [
          { ref: '(a)', command: 'Show', marks: 2,
            text: 'Show that the total surface area $A$ cm$^2$ of the can is given by $A = 2\\pi r^2 + \\frac{1000}{r}$.',
            scheme: ['M1 — from $\\pi r^2 h = 500$, $h = \\frac{500}{\\pi r^2}$',
                     'A1 — $A = 2\\pi r^2 + 2\\pi r h = 2\\pi r^2 + \\frac{1000}{r}$ on substituting'] },
          { ref: '(b)', command: 'Find', marks: 4,
            text: 'Find the value of $r$ for which $A$ is a minimum, giving your answer to three significant figures, and show that your value gives a minimum.',
            scheme: ['M1 — $\\frac{dA}{dr} = 4\\pi r - \\frac{1000}{r^2}$',
                     'M1 — setting to zero: $4\\pi r^3 = 1000$, so $r^3 = \\frac{250}{\\pi}$',
                     'A1 — $r = 4.30$ cm',
                     'A1 — $\\frac{d^2A}{dr^2} = 4\\pi + \\frac{2000}{r^3} > 0$ for $r > 0$, so $A$ is a minimum'],
            note: 'The second-derivative test must be shown; asserting a minimum without justification loses the final mark.' },
        ],
      },
    ],
  });

  /* Second mock. The first leans on technique; this one leans on the places
     technique is not enough — the discriminant as a question about whether a
     line meets a curve at all, a repeated root read geometrically, a volume
     where the squaring has to happen before the integration. */
  PAPERS.push({
    id: 'math-full-p2',
    subject: 'mathematics',
    tex: true,
    kind: 'full',
    title: 'Pure Mathematics — curves, lines and solids',
    component: 'Pure Mathematics 1, with vectors and matrices',
    minutes: 90,
    questions: [
      {
        n: 1, topic: 'quadratics',
        parts: [
          { ref: '(a)', command: 'Find', marks: 2,
            text: 'Find the discriminant of $2x^2 - 5x + 4$ and state what it tells you about the roots of $2x^2 - 5x + 4 = 0$.',
            scheme: ['B1 — $b^2 - 4ac = 25 - 32 = -7$',
                     'B1 — negative, so the equation has no real roots'] },
          { ref: '(b)', command: 'Find', marks: 4,
            text: 'The line $y = mx + 2$ is a tangent to the curve $y = x^2 + 3x + 6$. Find the two possible values of $m$.',
            scheme: ['M1 — equating: $x^2 + 3x + 6 = mx + 2$, so $x^2 + (3 - m)x + 4 = 0$',
                     'M1 — a tangent means the discriminant is zero: $(3 - m)^2 - 16 = 0$',
                     'A1 — $3 - m = \\pm 4$',
                     'A1 — $m = -1$ and $m = 7$'],
            note: 'Candidates who set the discriminant greater than zero have answered a different question and score the first mark only.' },
          { ref: '(c)', command: 'State', marks: 2,
            text: 'Hence state the set of values of $k$ for which the line $y = kx + 2$ does not meet the curve $y = x^2 + 3x + 6$.',
            scheme: ['M1 — no intersection requires $(3 - k)^2 < 16$',
                     'A1 — $-1 < k < 7$'] },
        ],
      },
      {
        n: 2, topic: 'trigonometry',
        parts: [
          { ref: '(a)', command: 'Solve', marks: 5,
            text: 'Solve the equation $3\\cos x = 2\\sin^2 x$ for $0\\degree \\le x \\le 360\\degree$.',
            scheme: ['M1 — using $\\sin^2 x = 1 - \\cos^2 x$ to write the equation in $\\cos x$ only',
                     'A1 — $2\\cos^2 x + 3\\cos x - 2 = 0$',
                     'M1 — factorising: $(2\\cos x - 1)(\\cos x + 2) = 0$',
                     'A1 — $\\cos x = \\frac{1}{2}$, rejecting $\\cos x = -2$ as impossible',
                     'A1 — $x = 60\\degree$ and $x = 300\\degree$'],
            note: 'The rejection of $\\cos x = -2$ must be seen or implied for the fourth mark.' },
          { ref: '(b)', command: 'Prove', marks: 3,
            text: 'Prove the identity $\\tan\\theta + \\frac{1}{\\tan\\theta} = \\frac{1}{\\sin\\theta\\cos\\theta}$.',
            scheme: ['M1 — writing the left side as $\\frac{\\sin\\theta}{\\cos\\theta} + \\frac{\\cos\\theta}{\\sin\\theta}$',
                     'M1 — over a common denominator: $\\frac{\\sin^2\\theta + \\cos^2\\theta}{\\sin\\theta\\cos\\theta}$',
                     'A1 — using $\\sin^2\\theta + \\cos^2\\theta = 1$ to give the required result'] },
        ],
      },
      {
        n: 3, topic: 'differentiation',
        stem: 'A curve has equation $y = x^3 - 3x^2 + 4$.',
        parts: [
          { ref: '(a)', command: 'Find', marks: 4,
            text: 'Find the equation of the normal to the curve at the point where $x = 1$, giving your answer in the form $ay = x + c$.',
            scheme: ['B1 — at $x = 1$, $y = 2$',
                     'M1 — $\\frac{dy}{dx} = 3x^2 - 6x$, which is $-3$ at $x = 1$',
                     'M1 — the normal gradient is $\\frac{1}{3}$, the negative reciprocal',
                     'A1 — $3y = x + 5$'],
            note: 'Using the tangent gradient rather than the normal gradient scores a maximum of 2.' },
          { ref: '(b)', command: 'Find', marks: 4,
            text: 'Find the coordinates of the stationary points of the curve and determine the nature of each.',
            scheme: ['M1 — setting $3x(x - 2) = 0$',
                     'A1 — stationary points at $(0,\ 4)$ and $(2,\ 0)$',
                     'M1 — $\\frac{d^2y}{dx^2} = 6x - 6$, evaluated at each point',
                     'A1 — $(0,\ 4)$ is a maximum since $-6 < 0$; $(2,\ 0)$ is a minimum since $6 > 0$'] },
        ],
      },
      {
        n: 4, topic: 'integration',
        parts: [
          { ref: '(a)', command: 'Find', marks: 4,
            text: 'Find the area of the region enclosed between the curve $y = x^2$ and the line $y = x + 2$.',
            scheme: ['B1 — intersections where $x^2 - x - 2 = 0$, so $x = -1$ and $x = 2$',
                     'M1 — area $= \\int_{-1}^{2} (x + 2 - x^2)\,dx$, line minus curve',
                     'A1 — $= [\\frac{x^2}{2} + 2x - \\frac{x^3}{3}]_{-1}^{2}$',
                     'A1 — $= \\frac{10}{3} - (-\\frac{7}{6}) = \\frac{9}{2}$'],
            note: 'Accept $4.5$. A negative answer means curve minus line and loses the final mark.' },
          { ref: '(b)', command: 'Find', marks: 4,
            text: 'The region bounded by the curve $y = x^2 + 1$, the $x$-axis and the lines $x = 0$ and $x = 1$ is rotated completely about the $x$-axis. Find the exact volume of the solid formed.',
            scheme: ['M1 — $V = \\pi\\int_0^1 (x^2 + 1)^2\,dx$',
                     'A1 — expanding the square first: $\\pi\\int_0^1 (x^4 + 2x^2 + 1)\,dx$',
                     'M1 — integrating to $\\pi[\\frac{x^5}{5} + \\frac{2x^3}{3} + x]_0^1$',
                     'A1 — $= \\frac{28\\pi}{15}$'],
            note: 'Integrating before squaring is the standard error here and scores the first mark only.' },
        ],
      },
      {
        n: 5, topic: 'vectors',
        stem: 'The vectors $\\mathbf{a}$ and $\\mathbf{b}$ are given by $\\mathbf{a} = 3\\mathbf{i} + \\mathbf{j} - 2\\mathbf{k}$ and $\\mathbf{b} = 2\\mathbf{i} - 4\\mathbf{j} + \\mathbf{k}$.',
        parts: [
          { ref: '(a)', command: 'Show', marks: 2,
            text: 'Show that $\\mathbf{a}$ and $\\mathbf{b}$ are perpendicular.',
            scheme: ['M1 — $\\mathbf{a} \\cdot \\mathbf{b} = 3(2) + 1(-4) + (-2)(1)$',
                     'A1 — $= 0$, and a zero scalar product means the vectors are perpendicular'],
            note: 'The conclusion must be stated; a correct value of 0 alone scores the method mark.' },
          { ref: '(b)', command: 'Find', marks: 3,
            text: 'Find a unit vector in the direction of $\\mathbf{a}$.',
            scheme: ['M1 — $|\\mathbf{a}| = \\sqrt{3^2 + 1^2 + (-2)^2}$',
                     'A1 — $= \\sqrt{14}$',
                     'A1 — unit vector $= \\frac{1}{\\sqrt{14}}(3\\mathbf{i} + \\mathbf{j} - 2\\mathbf{k})$'] },
          { ref: '(c)', command: 'Find', marks: 3,
            text: 'Find $\\mathbf{a} + 2\\mathbf{b}$ and give its magnitude in exact form.',
            scheme: ['M1 — $\\mathbf{a} + 2\\mathbf{b} = (3 + 4)\\mathbf{i} + (1 - 8)\\mathbf{j} + (-2 + 2)\\mathbf{k}$',
                     'A1 — $= 7\\mathbf{i} - 7\\mathbf{j}$',
                     'A1 — magnitude $= \\sqrt{98} = 7\\sqrt{2}$'] },
        ],
      },
      {
        n: 6, topic: 'matrices',
        stem: 'The matrix $A$ has first row $2,\ 1$ and second row $1,\ 3$.',
        parts: [
          { ref: '(a)', command: 'Find', marks: 3,
            text: 'Find $\\det A$ and $A^{-1}$.',
            scheme: ['B1 — $\\det A = (2)(3) - (1)(1) = 5$',
                     'M1 — adjugate has first row $3,\ -1$ and second row $-1,\ 2$',
                     'A1 — $A^{-1} = \\frac{1}{5}$ times that matrix'] },
          { ref: '(b)', command: 'Solve', marks: 3,
            text: 'Hence solve the simultaneous equations $2x + y = 7$ and $x + 3y = 11$.',
            scheme: ['M1 — pre-multiplying $(7,\ 11)$ by $A^{-1}$',
                     'M1 — $\\frac{1}{5}(3(7) - 1(11),\ -1(7) + 2(11)) = \\frac{1}{5}(10,\ 15)$',
                     'A1 — $x = 2$, $y = 3$'] },
          { ref: '(c)', command: 'State', marks: 2,
            text: 'State the effect of the transformation represented by $A$ on area, and say whether it preserves orientation.',
            scheme: ['B1 — areas are multiplied by $5$, the magnitude of the determinant',
                     'B1 — the determinant is positive, so orientation is preserved'] },
        ],
      },
      {
        n: 7, topic: 'quadratics',
        parts: [
          { ref: '(a)', command: 'Solve', marks: 4,
            text: 'Solve the simultaneous equations $y = x^2 - 4x + 7$ and $y = 2x - 2$.',
            scheme: ['M1 — eliminating $y$: $x^2 - 4x + 7 = 2x - 2$',
                     'A1 — $x^2 - 6x + 9 = 0$',
                     'M1 — factorising: $(x - 3)^2 = 0$',
                     'A1 — $x = 3$ and $y = 4$'] },
          { ref: '(b)', command: 'Explain', marks: 2,
            text: 'Explain what the nature of the root in part (a) tells you about the line and the curve.',
            scheme: ['B1 — the root is repeated, so there is exactly one point of contact',
                     'B1 — the line is therefore a tangent to the curve, touching it at $(3,\ 4)$'] },
        ],
      },
      {
        n: 8, topic: 'trigonometry',
        parts: [
          { ref: '(a)', command: 'Sketch', marks: 4,
            text: 'Sketch the graph of $y = 3\\cos\\frac{x}{2}$ for $0\\degree \\le x \\le 720\\degree$, and state the amplitude and the period.',
            scheme: ['B1 — a cosine curve of the correct shape starting at its maximum',
                     'B1 — exactly one complete cycle across the interval',
                     'B1 — amplitude $3$',
                     'B1 — period $720\\degree$'] },
          { ref: '(b)', command: 'State', marks: 2,
            text: 'Hence state the number of solutions of $3\\cos\\frac{x}{2} = 1$ in the interval $0\\degree \\le x \\le 720\\degree$, and explain how your sketch shows this.',
            scheme: ['M1 — the equation becomes $\\cos\\frac{x}{2} = \\frac{1}{3}$, and the line $y = 1$ is drawn across the sketch',
                     'A1 — the line crosses the single cycle twice, so there are $2$ solutions'] },
        ],
      },
    ],
  });

  /* =======================================================================
     9708 Economics

     Two kinds of mark scheme live from here on, because the real papers have
     two kinds. Short parts are point-marked — one mark, one creditable point,
     and `scheme` has a line per mark as in Chemistry. Longer parts are
     level-marked: the examiner reads the answer whole and places it in a band,
     and no amount of correct points lifts an answer out of Level 1 if it never
     evaluates. Those parts carry `levels` instead of `scheme`.

     This distinction is the single most useful thing a student can learn from
     a mark scheme, and it is why self-marking here asks them to place their own
     answer in a band rather than count ticks. An essay that lists six
     advantages and no judgement is a Level 2 answer however long it is.
     ======================================================================= */

  PAPERS.push({
    id: 'econ-sec-adas',
    subject: 'economics',
    kind: 'section',
    title: 'Aggregate demand and supply',
    component: 'AS Level, data response and essay',
    minutes: 40,
    questions: [
      {
        n: 1, topic: 'ad-as',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define aggregate demand and state its components.',
            scheme: ['The total planned expenditure on an economy’s goods and services at a given price level over a period of time.',
                     'AD = C + I + G + (X − M): consumption, investment, government spending and net exports.'] },
          { ref: '(b)', command: 'Explain', marks: 4,
            text: 'Explain two factors, other than a change in the price level, that could cause the aggregate demand curve to shift to the right.',
            scheme: ['A fall in the rate of interest.',
                     'Explanation: borrowing becomes cheaper and saving less attractive, raising consumption and investment.',
                     'A rise in consumer confidence, or a fall in income tax, or a depreciation of the currency.',
                     'Explanation linking the named factor to a rise in one of the components of AD.'],
            note: 'A factor named but not explained scores half the available credit. A change in the price level is explicitly excluded — that is a movement along AD, not a shift.' },
          { ref: '(c)', command: 'Explain', marks: 4,
            text: 'Using an AD/AS diagram, explain the effect of an increase in aggregate demand on the price level and on real output in an economy with considerable spare capacity.',
            scheme: ['Diagram with AD shifting right and axes correctly labelled price level and real output.',
                     'AS drawn with a shallow or horizontal section at low output.',
                     'Real output rises substantially.',
                     'The price level rises only slightly, because firms can raise output without bidding up the price of scarce factors.'] },
        ],
      },
      {
        n: 2, topic: 'ad-as',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 5,
            text: 'Explain the difference between a movement along the aggregate supply curve and a shift of the aggregate supply curve.',
            scheme: ['A movement along AS is caused by a change in the price level.',
                     'Firms respond to a higher price level by supplying more in the short run.',
                     'A shift of AS is caused by a change in the conditions of supply at every price level.',
                     'Examples: a change in wage costs, productivity, technology or the quantity of factors available.',
                     'A correct worked contrast between the two, rather than two separate descriptions.'] },
          { ref: '(b)', command: 'Assess', marks: 10,
            text: 'Assess whether an increase in aggregate demand will always lead to inflation.',
            levels: [
              { band: 'Level 3', marks: '8–10',
                descriptor: 'Analyses both cases with AD/AS reasoning — inflationary when the economy is near full capacity and AS is steep, largely non-inflationary where spare capacity exists — and reaches a supported judgement that depends on the state of the economy, the size of the increase and the time period. Diagrams are used to carry the argument rather than to decorate it.' },
              { band: 'Level 2', marks: '5–7',
                descriptor: 'Sound analysis of how an AD increase can raise the price level, with some reference to capacity or to the shape of AS, but the judgement is asserted rather than argued, or only one case is developed.' },
              { band: 'Level 1', marks: '1–4',
                descriptor: 'Describes aggregate demand or inflation with limited analysis. May assert that more demand always means higher prices with no reference to supply conditions.' },
            ],
            note: 'The question is "always", so an answer that argues only one side cannot reach Level 3 however well written. Demand-pull inflation identified by name is worth credit but is not by itself evaluation.' },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'econ-sec-policy',
    subject: 'economics',
    kind: 'section',
    title: 'Macroeconomic policy',
    component: 'AS Level, data response and essay',
    minutes: 40,
    questions: [
      {
        n: 1, topic: 'macro-policy',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define contractionary fiscal policy and give one example of it.',
            scheme: ['A deliberate reduction in government spending or an increase in taxation, intended to reduce aggregate demand.',
                     'Example: raising the rate of income tax, or cutting public investment.'] },
          { ref: '(b)', command: 'Explain', marks: 4,
            text: 'Explain the transmission mechanism by which a rise in the central bank’s interest rate is intended to reduce inflation.',
            scheme: ['A higher interest rate raises the cost of borrowing and the reward for saving.',
                     'Consumption falls as borrowing-financed spending becomes dearer and disposable income falls for those with variable-rate debt.',
                     'Investment falls because fewer projects clear the higher required return.',
                     'Aggregate demand therefore falls, reducing demand-pull pressure on the price level.'],
            note: 'Credit an answer that routes the effect through an appreciating exchange rate reducing import prices.' },
          { ref: '(c)', command: 'Explain', marks: 6,
            text: 'Explain three limitations of using monetary policy to bring an economy out of a deep recession.',
            scheme: ['Interest rates may already be close to zero, leaving little room to cut further.',
                     'Development of the zero lower bound point.',
                     'Low confidence means firms may not invest however cheap borrowing becomes.',
                     'Development: expected returns, not the interest rate, are the binding constraint.',
                     'Time lags mean the effect arrives well after the decision, possibly after recovery has begun.',
                     'Banks may not pass on the cut, or may restrict lending to repair their own balance sheets.'],
            note: 'Three distinct limitations are required. Two limitations developed well score a maximum of 4.' },
        ],
      },
      {
        n: 2, topic: 'inflation',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 5,
            text: 'Explain, with examples, the difference between demand-pull and cost-push inflation.',
            scheme: ['Demand-pull inflation arises from excess aggregate demand relative to the economy’s capacity.',
                     'Example: a credit boom or a large fiscal expansion near full employment.',
                     'Cost-push inflation arises from a rise in the costs of production shifting AS to the left.',
                     'Example: a rise in oil prices or in wages above productivity growth.',
                     'The two are distinguished by what happens to real output: it rises with demand-pull and falls with cost-push.'],
            note: 'The final mark is for the contrast in output, which is what makes the distinction matter for policy.' },
          { ref: '(b)', command: 'Discuss', marks: 8,
            text: 'Discuss whether fiscal policy or monetary policy is the more effective means of reducing unemployment.',
            levels: [
              { band: 'Level 3', marks: '7–8',
                descriptor: 'Analyses both policies against the type of unemployment in question — cyclical unemployment responds to demand-side policy, structural unemployment does not — and weighs them on specific criteria such as speed, targeting, time lags, the state of the public finances and the zero lower bound. Reaches a judgement that is conditional rather than absolute.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Explains how each policy could reduce unemployment with some comparison, but the criteria for judging effectiveness are implicit, or the type of unemployment is not distinguished.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'Describes fiscal and monetary policy with little or no comparison, or addresses only one of the two.' },
            ],
            note: 'An answer that never asks what kind of unemployment is being tackled is capped at Level 2, however good its policy description.' },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'econ-full-as',
    subject: 'economics',
    kind: 'full',
    title: 'AS Level Economics — data response and essays',
    component: 'Section A data response, Section B essays',
    minutes: 90,
    instructions: 'Answer Question 1 in Section A and both questions in Section B.',
    questions: [
      {
        n: 1, topic: 'elasticity', section: 'Section A — Data response',
        stem: 'Study the data below and answer the parts that follow.\n\nThe government of a country raised the specific tax on cigarettes from $2.00 to $3.00 per packet in 2024. The table shows what happened over the following year.\n\n   Average price per packet:   2023 $6.00   |   2024 $6.80\n   Packets sold (millions):    2023  420    |   2024  386\n   Tax revenue ($m):           2023  840    |   2024 1158\n   Smoking rate, adults (%):   2023 18.4    |   2024 17.6',
        parts: [
          { ref: '(a)', command: 'Calculate', marks: 3,
            text: 'Calculate the price elasticity of demand for cigarettes over this period, and state what your answer shows.',
            scheme: ['Percentage change in quantity = (386 − 420)/420 = −8.1%.',
                     'Percentage change in price = (6.80 − 6.00)/6.00 = +13.3%.',
                     'PED = −8.1/13.3 = −0.61, so demand is price inelastic.'],
            note: 'Accept −0.6 to −0.62. The sign may be omitted provided "inelastic" is stated. A value given without the interpretation scores 2.' },
          { ref: '(b)', command: 'Explain', marks: 4,
            text: 'Using your answer to (a), explain why the tax increase raised tax revenue.',
            scheme: ['Because demand is inelastic, quantity fell proportionately less than the price rose.',
                     'The tax per packet rose by 50% while sales fell by only 8.1%.',
                     'Revenue per packet therefore rose by more than the volume lost.',
                     'Tax revenue rose from $840m to $1158m, an increase of 38%.'] },
          { ref: '(c)', command: 'Explain', marks: 5,
            text: 'Explain two reasons why the demand for cigarettes is price inelastic.',
            scheme: ['Cigarettes are addictive, so consumption is not readily reduced in response to price.',
                     'Development: the habit makes demand insensitive at least in the short run.',
                     'There are few close substitutes for the product.',
                     'Development: consumers cannot switch to an alternative that satisfies the same want.',
                     'Cigarettes take a small proportion of income for many consumers, so a price rise is absorbed.'],
            note: 'Two developed reasons reach full marks. Three reasons merely named score 3.' },
          { ref: '(d)', command: 'Discuss', marks: 8,
            text: 'Discuss whether taxation is the most effective way for a government to reduce smoking.',
            levels: [
              { band: 'Level 3', marks: '7–8',
                descriptor: 'Uses the inelasticity established in the data to argue that taxation raises revenue efficiently but changes behaviour only modestly — the smoking rate fell 0.8 percentage points — and compares it with alternatives such as advertising bans, health education, plain packaging or age restrictions. Considers regressiveness and the risk of a black market, and reaches a judgement supported by the data.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Explains how taxation discourages consumption and refers to at least one alternative policy, with some use of the data, but the comparison is undeveloped or the judgement is asserted.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'General comments on taxation or smoking with little use of the data and no real comparison of policies.' },
            ],
            note: 'An answer making no use of the data cannot reach Level 3. The 0.8 percentage point fall is the key evidence — it shows the tax worked, but weakly.' },
        ],
      },
      {
        n: 2, topic: 'market-failure', section: 'Section B — Essays',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 8,
            text: 'Explain, using examples, how negative externalities of consumption cause market failure.',
            levels: [
              { band: 'Level 3', marks: '7–8',
                descriptor: 'Explains that private marginal benefit exceeds social marginal benefit, so the free market over-consumes relative to the social optimum, with a correct diagram showing the welfare loss triangle and the divergence between MPB and MSB. Examples are apt and used to illustrate the analysis.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Explains the idea of a third-party cost with a reasonable example, and may attempt a diagram, but the divergence between private and social benefit is not clearly established or the welfare loss is not identified.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'Describes pollution or a similar example as a bad thing, without the analytical framework of private and social costs or benefits.' },
            ],
            note: 'Externalities of consumption, not production — an answer using factory pollution throughout has answered a different question and is capped at Level 2.' },
          { ref: '(b)', command: 'Assess', marks: 12,
            text: 'Assess whether government intervention can correct market failure without creating new inefficiencies.',
            levels: [
              { band: 'Level 4', marks: '10–12',
                descriptor: 'Analyses at least two forms of intervention — taxation, subsidy, regulation, tradable permits, provision — against specific sources of government failure: imperfect information about the size of the externality, unintended consequences, administrative cost, regulatory capture, and the political incentive to favour visible over efficient measures. Reaches a judgement that intervention improves on the free market in some cases without achieving the optimum, and says what it depends on.' },
              { band: 'Level 3', marks: '7–9',
                descriptor: 'Analyses intervention and identifies real sources of government failure, with an attempt at judgement, but the two sides are not fully weighed or the conclusion does not follow closely from the analysis.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Explains how intervention is intended to work and mentions that it may fail, with limited development of why.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'Describes types of intervention with little analysis and no evaluation.' },
            ] },
        ],
      },
      {
        n: 3, topic: 'trade', section: 'Section B — Essays',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 8,
            text: 'Explain the main components of the current account of the balance of payments, and what is meant by a current account deficit.',
            levels: [
              { band: 'Level 3', marks: '7–8',
                descriptor: 'Correctly identifies trade in goods, trade in services, primary income and secondary income, explains what each records, and defines a deficit as currency outflows on the current account exceeding inflows over a period. Distinguishes the current account from the financial account.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Identifies trade in goods and services and defines a deficit broadly as importing more than exporting, with the income components missing or confused.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'Vague description of imports and exports without the structure of the account.' },
            ] },
          { ref: '(b)', command: 'Discuss', marks: 12,
            text: 'Discuss whether a persistent current account deficit should be a matter of concern for a government.',
            levels: [
              { band: 'Level 4', marks: '10–12',
                descriptor: 'Analyses both cases rigorously — a deficit financing productive investment and matched by financial account inflows need not be a problem, while one reflecting lost competitiveness, financed by short-term borrowing, risks currency depreciation, rising external debt and a deflationary policy response. Distinguishes cause from size, considers the exchange rate regime, and reaches a conditional judgement.' },
              { band: 'Level 3', marks: '7–9',
                descriptor: 'Analyses both sides with some specific consequences and an attempt at judgement, but does not clearly distinguish the causes of the deficit from its size.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Explains some consequences of a deficit, mostly one-sided, with an asserted conclusion.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'Asserts that a deficit is bad, or lists features of the balance of payments, with no analysis.' },
            ],
            note: 'The strongest answers notice that the deficit must be matched by a financial account surplus, and ask what that inflow is buying.' },
        ],
      },
    ],
  });

  /* Second mock. The first paper's data response is a tax on an inelastic
     good; this one is a congestion charge, which is the same economics seen
     from the other side — an externality corrected rather than a revenue
     raised — and it pushes the essays onto the macro half of the syllabus. */
  PAPERS.push({
    id: 'econ-full-as-2',
    subject: 'economics',
    kind: 'full',
    title: 'AS Level Economics — externalities and macro policy',
    component: 'Section A data response, Section B essays',
    minutes: 90,
    instructions: 'Answer Question 1 in Section A and both questions in Section B.',
    questions: [
      {
        n: 1, topic: 'market-failure', section: 'Section A — Data response',
        stem: 'Study the data below and answer the parts that follow.\n\nA city introduced a charge of $12 per day on vehicles entering the central zone at the start of 2024. The table shows the year before and the year after.\n\n   Vehicles entering the zone (000s per day):   2023  195    |   2024  168\n   Average traffic speed in the zone (km/h):    2023 14.2    |   2024 17.6\n   Bus passengers in the zone (000s per day):   2023  410    |   2024  476\n   Roadside particulates, PM2.5 (μg/m³):         2023 18.4    |   2024 16.1\n   Charge revenue ($m per year):                2023    —    |   2024   285',
        parts: [
          { ref: '(a)', command: 'Calculate', marks: 3,
            text: 'Calculate the percentage change in the number of vehicles entering the zone, and the percentage change in average traffic speed.',
            scheme: ['Vehicles: (168 − 195)/195 × 100 = −13.8%.',
                     'Speed: (17.6 − 14.2)/14.2 × 100 = +23.9%.',
                     'Both signs correct and both to one decimal place.'],
            note: 'Allow −13.8 to −13.9 and +23.9 to +24.0.' },
          { ref: '(b)', command: 'Explain', marks: 4,
            text: 'Using a diagram, explain how a charge of this kind is intended to correct the market failure caused by road congestion.',
            scheme: ['Driving into the centre generates negative externalities — congestion, pollution — so marginal social cost exceeds marginal private cost.',
                     'Without the charge, drivers consider only their private cost and the market over-provides journeys relative to the social optimum.',
                     'Diagram showing MSC above MPC with the welfare loss identified.',
                     'The charge internalises the externality by adding the external cost to the private cost, shifting the effective cost curve and reducing journeys towards the optimum.'] },
          { ref: '(c)', command: 'Explain', marks: 5,
            text: 'Explain two limitations of using a charge of this kind to correct market failure.',
            scheme: ['The government cannot know the monetary value of the externality precisely.',
                     'Development: the charge is therefore unlikely to be set at exactly the socially optimal level.',
                     'A flat charge is regressive, taking a larger share of income from poorer drivers.',
                     'Development: those with least ability to pay are priced off the road first, regardless of how valuable their journey is.',
                     'Traffic and its externalities may be displaced to roads just outside the zone rather than removed.'],
            note: 'Two developed limitations reach full marks. Three merely named score 3.' },
          { ref: '(d)', command: 'Discuss', marks: 8,
            text: 'Discuss, using the data, whether the congestion charge should be judged a success.',
            levels: [
              { band: 'Level 3', marks: '7–8',
                descriptor: 'Judges the scheme against stated criteria and uses the data throughout: traffic down 13.8% and speed up 23.9% are substantial, bus use rising 16% suggests genuine substitution rather than suppressed journeys, and particulates fell. Sets against this that $285m of revenue is a transfer rather than a welfare gain, that the fall in PM2.5 is modest, that the charge is regressive, and that none of the data shows what happened outside the zone. Reaches a judgement that depends on the criterion chosen.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Uses the data to argue the scheme worked, with some acknowledgement of costs or limitations, but the criteria for success are implicit or only one side is developed.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'Describes the changes in the table with little analysis and no real evaluation.' },
            ],
            note: 'The best answers notice that revenue is not a benefit in welfare terms, and that the displacement of traffic outside the zone is exactly what the data cannot show.' },
        ],
      },
      {
        n: 2, topic: 'macro-policy', section: 'Section B — Essays',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 8,
            text: 'Explain how an increase in government spending can raise national income by more than the initial injection.',
            levels: [
              { band: 'Level 3', marks: '7–8',
                descriptor: 'Explains the multiplier process as successive rounds of spending becoming income becoming spending, links its size to the marginal propensity to consume and to the withdrawals of saving, taxation and imports, and states the multiplier formula correctly. May illustrate with an AD shift larger than the initial injection.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Describes the idea that one person’s spending is another’s income with some reference to further rounds, but the determinants of the multiplier’s size are vague or the withdrawals are incomplete.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'Asserts that government spending raises national income without explaining the multiplier process.' },
            ] },
          { ref: '(b)', command: 'Assess', marks: 12,
            text: 'Assess whether expansionary fiscal policy is an effective response to a recession.',
            levels: [
              { band: 'Level 4', marks: '10–12',
                descriptor: 'Analyses the case for — idle capacity means the multiplier works with little inflationary cost, and private demand is unlikely to recover on its own — against crowding out, time lags, the state of the public finances, leakage into imports, and the question of whether the recession is a demand-side one at all. Distinguishes short run from long run and reaches a conditional judgement with the conditions named.' },
              { band: 'Level 3', marks: '7–9',
                descriptor: 'Analyses both sides with real limitations identified and an attempt at judgement, though the conditions on which effectiveness depends are not fully drawn out.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Explains how expansionary fiscal policy is meant to work and mentions that it may not, with limited development.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'Describes fiscal policy with no evaluation.' },
            ],
            note: 'Whether the recession is demand-side or supply-side is the point that separates the top band: fiscal expansion against a supply shock is a different proposition entirely.' },
        ],
      },
      {
        n: 3, topic: 'inflation', section: 'Section B — Essays',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 8,
            text: 'Explain how the rate of inflation is measured, and two difficulties in measuring it accurately.',
            levels: [
              { band: 'Level 3', marks: '7–8',
                descriptor: 'Explains a consumer price index built from a representative basket weighted by expenditure patterns, with the rate as the annual percentage change in that index. Identifies two real difficulties with development — the basket dates as spending patterns change, quality improvements are hard to separate from price rises, the weights are not representative of every household, and the sample of prices is partial.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Describes a price index and a basket of goods with one difficulty, or two difficulties merely named.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'States that inflation is rising prices with little on measurement.' },
            ] },
          { ref: '(b)', command: 'Discuss', marks: 12,
            text: 'Discuss whether a low and stable rate of inflation should be a government’s main macroeconomic objective.',
            levels: [
              { band: 'Level 4', marks: '10–12',
                descriptor: 'Argues the case — price stability protects real incomes and savings, preserves competitiveness, and gives firms the certainty to invest, which serves the other objectives in turn — against the cost of pursuing it, particularly unemployment through the short-run Phillips trade-off, and against the claim of growth, employment or the current account to primacy. Distinguishes low inflation from zero inflation and notes the dangers of deflation. Judgement follows from the analysis.' },
              { band: 'Level 3', marks: '7–9',
                descriptor: 'Analyses the benefits of low inflation and at least one competing objective with an attempt at judgement, though the trade-offs are not fully weighed.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Explains why inflation is undesirable, largely one-sided, with an asserted conclusion.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'Lists costs of inflation or macroeconomic objectives with no argument.' },
            ],
            note: 'An answer that treats zero inflation as the ideal has missed why targets are set at around 2%, and is capped at Level 3.' },
        ],
      },
    ],
  });

  /* =======================================================================
     9489 History

     The source question needs sources, and this is the one place in the bank
     where that raises a question of honesty rather than copyright. Quoting a
     real 1815 memorandum would be fine — it is long out of copyright — but
     putting invented words in Metternich's mouth would not be, however
     convenient for a question, because a student revising from it would carry
     the fabrication into an exam.

     So the sources below are written for this paper, say so in their own
     attribution, and carry `synthetic: true` so the surface can print the same
     warning on the paper itself. They are composed to represent positions that
     were genuinely held — the Austrian case for the settlement, the liberal
     nationalist case against it — which is what a source-comparison question
     is actually testing. The history is accurate; the wording is ours.
     ======================================================================= */

  PAPERS.push({
    id: 'hist-sec-vienna',
    subject: 'history',
    kind: 'section',
    title: 'The Congress of Vienna',
    component: 'AS Level, Modern Europe 1789–1917',
    minutes: 40,
    questions: [
      {
        n: 1, topic: 'vienna',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 5,
            text: 'Describe the main territorial decisions reached at the Congress of Vienna in 1815.',
            scheme: ['The Austrian Netherlands were united with the Dutch Republic to form the Kingdom of the Netherlands.',
                     'Prussia gained the Rhineland and roughly two-fifths of Saxony.',
                     'Austria gained Lombardy and Venetia in northern Italy.',
                     'Russia gained the greater part of Poland as a kingdom under the Tsar.',
                     'The Holy Roman Empire was not restored; a German Confederation of 39 states replaced it, and France was returned to its pre-revolutionary frontiers.'],
            note: 'Any five accurate territorial points score full marks. Credit Sardinia-Piedmont gaining Genoa, or the restoration of the Bourbon, Papal and Spanish thrones.' },
          { ref: '(b)', command: 'Explain', marks: 5,
            text: 'Explain why the great powers chose not to impose a harsh punitive settlement on France in 1815.',
            scheme: ['A restored Bourbon monarchy was seen as a legitimate government that should not be weakened.',
                     'A resentful France was thought more likely to turn revolutionary again.',
                     'France was needed as a counterweight within the balance of power, particularly against Russia.',
                     'Talleyrand exploited the divisions between the powers over Poland and Saxony to secure better terms.',
                     'The powers distinguished the Napoleonic regime from the French nation, blaming the former.'],
            note: 'The second Treaty of Paris after Waterloo was harsher than the first; an answer noting this distinction is credited.' },
        ],
      },
      {
        n: 2, topic: 'vienna',
        parts: [
          { ref: '(a)', command: 'Assess', marks: 15,
            text: '‘The Vienna settlement was a success.’ How far do you agree, with reference to the years 1815 to 1848?',
            levels: [
              { band: 'Level 5', marks: '13–15',
                descriptor: 'A sustained argument that confronts the question of what success means for a settlement of this kind. Judges it against its own aims — containing France, preventing general war, restoring legitimate monarchy — on which it largely succeeded, and against the forces it ignored, nationalism and liberalism, which broke through in 1830 and 1848. Precise supporting detail throughout, and a clear, consistent judgement.' },
              { band: 'Level 4', marks: '10–12',
                descriptor: 'A clear argument on both sides with accurate supporting detail and a judgement, but the criteria for success are less sharply established or one side is thinner than the other.' },
              { band: 'Level 3', marks: '7–9',
                descriptor: 'Explains successes and failures of the settlement with some accurate detail, but the material is organised as two lists rather than as an argument, and the judgement is asserted at the end.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Describes the settlement with limited explanation of its consequences, and little or no judgement.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'A few accurate points about 1815 with no argument.' },
            ],
            note: 'The strongest discriminator at the top of the mark range is whether the candidate sets up a criterion for success before judging it. No general European war until 1854 is the single strongest point for the settlement; 1848 is the strongest against.' },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'hist-sec-unification',
    subject: 'history',
    kind: 'section',
    title: 'Nationalism and unification',
    component: 'AS Level, Modern Europe 1789–1917',
    minutes: 40,
    questions: [
      {
        n: 1, topic: 'revolutions-1848',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 5,
            text: 'Describe the part played by Cavour in the unification of Italy.',
            scheme: ['As Prime Minister of Piedmont from 1852 he modernised its economy, army and finances.',
                     'He secured French support through the Plombières agreement of 1858.',
                     'He provoked war with Austria in 1859, gaining Lombardy.',
                     'He organised plebiscites that brought the central Italian duchies into Piedmont in 1860.',
                     'He moved to contain and then absorb Garibaldi’s conquest of the south, bringing it under Piedmontese control.'] },
          { ref: '(b)', command: 'Explain', marks: 5,
            text: 'Explain why the revolutions of 1848 failed in the German states.',
            scheme: ['The Frankfurt Parliament had no army and no revenue of its own, so it could not enforce its decisions.',
                     'Liberals and radicals divided over the form a united Germany should take, including the grossdeutsch and kleindeutsch question.',
                     'The middle-class liberals feared social revolution more than they wanted reform, and drew back from the workers.',
                     'Frederick William IV refused the imperial crown offered by the Parliament in 1849.',
                     'The Austrian and Prussian armies remained loyal to their rulers and were used to disperse the revolution.'],
            note: 'The absence of coercive power behind the Frankfurt Parliament is the central point and should be credited wherever it appears.' },
        ],
      },
      {
        n: 2, topic: 'unification',
        parts: [
          { ref: '(a)', command: 'Assess', marks: 15,
            text: '‘German unification was the achievement of Prussian military power rather than of German nationalism.’ Assess this view.',
            levels: [
              { band: 'Level 5', marks: '13–15',
                descriptor: 'Weighs both explanations against each other with precise detail — the reformed Prussian army and the three wars of 1864, 1866 and 1870 against the Zollverein, the growth of national feeling since 1848, and the role of Bismarck’s diplomacy in isolating Austria and France. Recognises that the two factors were connected rather than alternatives: nationalism supplied the goal and Prussia the means, and unification came on Prussian terms because of it. Sustained judgement.' },
              { band: 'Level 4', marks: '10–12',
                descriptor: 'A clear two-sided argument with accurate detail and a judgement, though the interaction between military power and nationalism is less fully developed.' },
              { band: 'Level 3', marks: '7–9',
                descriptor: 'Explains the military and the nationalist cases with accurate detail, but as separate accounts rather than a weighed comparison.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Narrates the wars of unification with limited explanation and little attention to nationalism, or vice versa.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'A few accurate points about Bismarck or 1871 with no argument.' },
            ],
            note: 'An answer that treats the two factors as mutually exclusive is capped at Level 4 however detailed — the best answers see that the question sets up a false opposition.' },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'hist-full-as',
    subject: 'history',
    kind: 'full',
    title: 'AS Level History — source analysis and essays',
    component: 'Section A document question, Section B essays',
    minutes: 90,
    instructions: 'Answer Question 1 in Section A and both questions in Section B.',
    questions: [
      {
        n: 1, topic: 'source-analysis', section: 'Section A — Document question',
        stem: 'Read the two sources and answer both parts of the question.',
        sources: [
          { ref: 'Source A', synthetic: true,
            attribution: 'From a memorandum circulated among the Austrian delegation at Vienna, 1815. Written for this paper to represent the Austrian position; it is not a quotation from a real document.',
            text: 'The peace we are building must rest on what is lawful, not on what is popular. Those who speak for the nations would have us redraw the map according to language and sentiment, as though a frontier were a matter of feeling. But sentiment shifts with the season, while a treaty between sovereigns endures. Twenty-five years of war have taught us what follows when the passions of a people are permitted to decide the fate of states. Our task is to restore the authority of legitimate princes and to arrange their territories so that none may dominate the rest. If this settlement disappoints the enthusiasts, that is the measure of its wisdom.' },
          { ref: 'Source B', synthetic: true,
            attribution: 'From a pamphlet published by a German liberal in exile, 1832. Written for this paper to represent the liberal nationalist position; it is not a quotation from a real document.',
            text: 'At Vienna the princes divided us as a farmer divides a field, without once asking what the Germans themselves desired. We were promised a nation and given a Confederation of thirty-nine courts, each with its censor and its police. They call this the balance of power; we call it the balance of thrones, weighed against the people on both scales. A settlement that must forbid a free press and a public meeting in order to survive has already confessed what it is. It will hold only so long as the fear holds, and fear is a poor mortar.' },
        ],
        parts: [
          { ref: '(a)', command: 'Compare', marks: 10,
            text: 'Compare and contrast the views expressed in Sources A and B about the Vienna settlement.',
            levels: [
              { band: 'Level 4', marks: '9–10',
                descriptor: 'Compares the sources point by point rather than describing each in turn, grounding every comparison in quoted or closely paraphrased content. Identifies the genuine contrast over the basis of legitimacy — treaty between sovereigns against the will of the nation — and the shared recognition that the settlement deliberately set popular feeling aside. Notes that both treat the suppression of nationalism as central, differing only on whether it is wisdom or confession.' },
              { band: 'Level 3', marks: '6–8',
                descriptor: 'Makes valid comparisons and contrasts supported from the sources, but some of the answer describes the sources sequentially, or a point of similarity is missed.' },
              { band: 'Level 2', marks: '3–5',
                descriptor: 'Summarises each source separately with an attempt at comparison, mostly asserted rather than grounded in the text.' },
              { band: 'Level 1', marks: '1–2',
                descriptor: 'Paraphrases one or both sources with no comparison.' },
            ],
            note: 'Candidates who write about the Congress from their own knowledge rather than from the sources are capped at Level 2, however accurate. The question is about the sources.' },
          { ref: '(b)', command: 'Assess', marks: 15,
            text: '‘The Vienna settlement was designed above all to suppress nationalism.’ How far do Sources A and B, and your own knowledge, support this view?',
            levels: [
              { band: 'Level 5', marks: '13–15',
                descriptor: 'Uses both sources as evidence rather than as illustration, evaluating their provenance — an internal Austrian memorandum defending the settlement, a liberal pamphlet attacking it seventeen years later — and weighing what each is therefore likely to emphasise. Sets the sources against own knowledge: the Carlsbad Decrees and Metternich’s system support the view, while the primary purpose of containing France and preventing general war qualifies it. Reaches a supported judgement on "above all".' },
              { band: 'Level 4', marks: '10–12',
                descriptor: 'Uses both sources and own knowledge to argue both sides with a judgement, but provenance is handled briefly or the weighing of "above all" is incomplete.' },
              { band: 'Level 3', marks: '7–9',
                descriptor: 'Uses the sources and some own knowledge with explanation on both sides, but the sources are treated as straightforwardly true and the judgement is asserted.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Relies mainly on own knowledge or mainly on the sources, with limited argument.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'A few relevant points with no sustained use of the sources.' },
            ],
            note: 'The phrase "above all" is the hinge of the question. An answer showing only that the settlement did suppress nationalism, without weighing that against containing France, cannot reach Level 5.' },
        ],
      },
      {
        n: 2, topic: 'revolutions-1848', section: 'Section B — Essays',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 20,
            text: 'Why did the Concert of Europe fail to prevent revolution in 1848?',
            levels: [
              { band: 'Level 5', marks: '17–20',
                descriptor: 'Explains the failure through linked causes rather than a list: the Concert was designed to coordinate monarchs against external aggression and revolution from without, and had no instrument against simultaneous internal risings; the powers had already divided over intervention in the 1820s; Britain had withdrawn from the congress system; and the economic crisis of 1846–47 produced pressures the system was never built to address. Prioritises the causes and sustains a judgement about which mattered most.' },
              { band: 'Level 4', marks: '13–16',
                descriptor: 'Explains several valid causes with accurate detail and some prioritisation, though the links between them are less developed.' },
              { band: 'Level 3', marks: '9–12',
                descriptor: 'Explains causes with accurate supporting material, organised as a list without prioritisation.' },
              { band: 'Level 2', marks: '5–8',
                descriptor: 'Describes the events of 1848 with limited explanation of the Concert’s failure.' },
              { band: 'Level 1', marks: '1–4',
                descriptor: 'A few accurate points with no explanation.' },
            ],
            note: 'The structural point — that the Concert was built against revolution from without and faced revolution from within — is what separates the top two levels.' },
        ],
      },
      {
        n: 3, topic: 'unification', section: 'Section B — Essays',
        parts: [
          { ref: '(a)', command: 'Assess', marks: 15,
            text: 'How important was Bismarck’s diplomacy, as opposed to Prussia’s economic strength, in the unification of Germany?',
            levels: [
              { band: 'Level 5', marks: '13–15',
                descriptor: 'Weighs the two factors with precise detail — the isolation of Austria in 1866 and of France in 1870, the Alvensleben Convention and the Ems telegram against the Zollverein, Prussian coal, steel and railways, and the fiscal capacity that paid for the army. Argues the relationship between them rather than ranking them in isolation, and sustains a judgement.' },
              { band: 'Level 4', marks: '10–12',
                descriptor: 'Argues both factors with accurate detail and a judgement, with the interaction between them less fully developed.' },
              { band: 'Level 3', marks: '7–9',
                descriptor: 'Explains both factors accurately but as separate accounts, with an asserted judgement.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Narrative of unification with limited analytical focus on the question’s comparison.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'A few accurate points with no argument.' },
            ] },
        ],
      },
    ],
  });

  /* A short paper on the origins of the war. Added because the topic had
     exercises, chapter hints and a place in the breakdown but no question
     anywhere in the bank — so it could never be the thing a student was told
     to work on, however badly they would have done on it. */
  PAPERS.push({
    id: 'hist-sec-ww1',
    subject: 'history',
    kind: 'section',
    title: 'The origins of the First World War',
    component: 'AS Level, Modern Europe 1789–1917',
    minutes: 40,
    questions: [
      {
        n: 1, topic: 'ww1-origins',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 5,
            text: 'Describe the system of alliances in Europe as it stood in 1914.',
            scheme: ['The Triple Alliance of 1882 bound Germany, Austria-Hungary and Italy.',
                     'The Franco-Russian Alliance of 1894 committed each to aid the other against German attack.',
                     'The Entente Cordiale of 1904 settled colonial differences between Britain and France.',
                     'The Anglo-Russian Convention of 1907 completed the Triple Entente.',
                     'Britain’s commitment was the loosest of these — an understanding rather than a binding military alliance.'],
            note: 'Credit the point that Italy did not in the event fight alongside its Triple Alliance partners.' },
          { ref: '(b)', command: 'Explain', marks: 5,
            text: 'Explain why the Balkans were a source of international tension in the years before 1914.',
            scheme: ['Ottoman decline left a vacuum that Austria-Hungary and Russia both sought to fill.',
                     'Serbian nationalism threatened Austria-Hungary, whose empire contained many Slavs.',
                     'Russia posed as the protector of the Slav peoples, putting it directly against Austria-Hungary.',
                     'The Bosnian crisis of 1908 humiliated Russia and hardened its resolve not to give way again.',
                     'The Balkan Wars of 1912–13 strengthened Serbia and left Austria-Hungary more alarmed still.'] },
        ],
      },
      {
        n: 2, topic: 'ww1-origins',
        parts: [
          { ref: '(a)', command: 'Assess', marks: 15,
            text: '‘The First World War was caused above all by the ambitions of Germany.’ Assess this view.',
            levels: [
              { band: 'Level 5', marks: '13–15',
                descriptor: 'Weighs the case against Germany — Weltpolitik, the naval race, the blank cheque to Austria-Hungary, and a Schlieffen Plan that made a Balkan quarrel into a war with France — against the responsibility of others: Austria-Hungary’s determination to crush Serbia, Russia’s mobilisation, and the structural pressures of alliance and timetable that constrained every government. Distinguishes responsibility for the July crisis from responsibility for the long-term conditions, and sustains a judgement on "above all".' },
              { band: 'Level 4', marks: '10–12',
                descriptor: 'A clear two-sided argument with accurate detail and a judgement, though the distinction between the crisis and its background is less firmly drawn.' },
              { band: 'Level 3', marks: '7–9',
                descriptor: 'Explains German policy and other causes accurately, but as a list rather than a weighed argument, with the judgement asserted at the end.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Narrates the July crisis or describes the alliances with limited explanation.' },
              { band: 'Level 1', marks: '1–4',
                descriptor: 'A few accurate points with no argument.' },
            ],
            note: 'The strongest discriminator is whether the candidate separates the question of who wanted a war from the question of whose decisions brought one about in July 1914.' },
        ],
      },
    ],
  });

  /* Second mock. The first turns on the Vienna settlement; this one turns on
     1848 and on 1914, so the two together cover the century rather than
     circling the same decade. The sources are written for this paper on the
     same terms as those in the first — see the note at the head of this
     subject. */
  PAPERS.push({
    id: 'hist-full-as-2',
    subject: 'history',
    kind: 'full',
    title: 'AS Level History — revolution, war and the old order',
    component: 'Section A document question, Section B essays',
    minutes: 90,
    instructions: 'Answer Question 1 in Section A and both questions in Section B.',
    questions: [
      {
        n: 1, topic: 'source-analysis', section: 'Section A — Document question',
        stem: 'Read the two sources and answer both parts of the question.',
        sources: [
          { ref: 'Source A', synthetic: true,
            attribution: 'From a report by a Prussian official to his minister, late 1849. Written for this paper to represent the conservative position; it is not a quotation from a real document.',
            text: 'The lesson of the past eighteen months is not that the people are ungovernable, but that they were never united. The lawyers at Frankfurt debated a constitution for a nation that did not yet exist, while the weavers wanted bread and the peasants wanted their dues abolished. Each of these parties feared the others more than it feared us. We had only to wait, keep the army in hand, and let the professors discover that a resolution is not a regiment. When the King declined their crown there was no one left to insist, because the men who had offered it could not agree on what they had offered.' },
          { ref: 'Source B', synthetic: true,
            attribution: 'From the memoir of a delegate to the Frankfurt Parliament, published 1861. Written for this paper to represent the liberal position; it is not a quotation from a real document.',
            text: 'They say we talked while the moment passed. It is easily said by men who had soldiers. We had no treasury, no courts that would heed us, and no power to raise a single company; what we had was a mandate, and we believed a mandate was worth something. Our error was not that we debated but that we debated as though the princes had truly given way, when in truth they had only stepped back to see which way we would run. I do not think the cause was wrong. I think we mistook the retreat of our enemies for their defeat.' },
        ],
        parts: [
          { ref: '(a)', command: 'Compare', marks: 10,
            text: 'Compare and contrast the explanations given in Sources A and B for the failure of the 1848 revolutions in the German states.',
            levels: [
              { band: 'Level 4', marks: '9–10',
                descriptor: 'Compares point by point from the content of both sources rather than describing each in turn. Identifies the genuine agreement — both say the Frankfurt Parliament lacked coercive power and that the princes were never truly beaten — and the real contrast, which is where the blame falls: Source A on the divisions among the revolutionaries, Source B on the absence of any means to enforce a mandate. Notes that both treat the refusal of the crown as the decisive moment.' },
              { band: 'Level 3', marks: '6–8',
                descriptor: 'Valid comparisons and contrasts supported from the sources, though part of the answer treats them sequentially or a point of agreement is missed.' },
              { band: 'Level 2', marks: '3–5',
                descriptor: 'Summarises each source with an attempt at comparison, largely asserted rather than grounded in the text.' },
              { band: 'Level 1', marks: '1–2',
                descriptor: 'Paraphrases one or both sources with no comparison.' },
            ],
            note: 'Answers written from own knowledge rather than from the sources are capped at Level 2 however accurate.' },
          { ref: '(b)', command: 'Assess', marks: 15,
            text: '‘The revolutions of 1848 failed because the revolutionaries were divided among themselves.’ How far do Sources A and B, and your own knowledge, support this view?',
            levels: [
              { band: 'Level 5', marks: '13–15',
                descriptor: 'Uses both sources as evidence and weighs their provenance — an official reporting a success to his minister has every reason to stress the enemy’s divisions, a delegate writing twelve years later has every reason to stress what was beyond his control. Sets them against own knowledge: the grossdeutsch and kleindeutsch split and the liberals’ fear of the workers support the view, while the survival of the Austrian and Prussian armies and Frederick William IV’s refusal point to the loyalty of armed force as the deeper cause. Judges "because" rather than listing causes.' },
              { band: 'Level 4', marks: '10–12',
                descriptor: 'Uses both sources and own knowledge on both sides with a judgement, but provenance is handled briefly or the weighing is incomplete.' },
              { band: 'Level 3', marks: '7–9',
                descriptor: 'Uses the sources and some own knowledge with explanation, but takes the sources at face value and asserts the judgement.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'Relies mainly on own knowledge or mainly on the sources, with limited argument.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'A few relevant points with no sustained use of the sources.' },
            ] },
        ],
      },
      {
        n: 2, topic: 'ww1-origins', section: 'Section B — Essays',
        parts: [
          { ref: '(a)', command: 'Assess', marks: 20,
            text: 'How far was the alliance system responsible for turning the crisis of July 1914 into a general European war?',
            levels: [
              { band: 'Level 5', marks: '17–20',
                descriptor: 'Argues how the alliances converted a local quarrel into a continental one — Austria-Hungary emboldened by German support, Russia committed to Serbia, France bound to Russia — while recognising that alliances are not self-executing: Italy did not fight with its partners, Britain’s obligation was the loosest and turned on Belgium, and it was the mobilisation timetables and the Schlieffen Plan that removed the room to negotiate. Prioritises the causes and sustains a judgement.' },
              { band: 'Level 4', marks: '13–16',
                descriptor: 'Explains the role of the alliances with accurate detail and some prioritisation against other factors, though the limits of alliance obligation are less developed.' },
              { band: 'Level 3', marks: '9–12',
                descriptor: 'Explains the alliances and other causes accurately as a list, with an asserted judgement.' },
              { band: 'Level 2', marks: '5–8',
                descriptor: 'Narrates the July crisis or describes the alliance blocs with limited explanation.' },
              { band: 'Level 1', marks: '1–4',
                descriptor: 'A few accurate points with no explanation.' },
            ],
            note: 'That Italy stayed out is the sharpest single piece of evidence against the alliance system as a sufficient explanation, and the best answers use it.' },
        ],
      },
      {
        n: 3, topic: 'vienna', section: 'Section B — Essays',
        parts: [
          { ref: '(a)', command: 'Assess', marks: 15,
            text: 'Assess the importance of Metternich in maintaining the European order between 1815 and 1848.',
            levels: [
              { band: 'Level 5', marks: '13–15',
                descriptor: 'Weighs Metternich’s personal contribution — the congress system, the Carlsbad Decrees, the Troppau Protocol and intervention in Naples and Piedmont — against the structural reasons the order held: the exhaustion of Europe after 1815, the shared interest of the powers in avoiding general war, and Austria’s own weakness, which meant he depended on others to act. Notes that the order outlasted neither 1830 nor 1848 and judges importance accordingly.' },
              { band: 'Level 4', marks: '10–12',
                descriptor: 'Argues his importance with accurate detail and a judgement, with the structural factors less fully developed.' },
              { band: 'Level 3', marks: '7–9',
                descriptor: 'Describes his policies accurately with some explanation of their effect, judgement asserted.' },
              { band: 'Level 2', marks: '4–6',
                descriptor: 'A narrative of Metternich’s career with limited focus on the question.' },
              { band: 'Level 1', marks: '1–3',
                descriptor: 'A few accurate points with no argument.' },
            ],
            note: 'Candidates who treat the system as Metternich’s personal creation, without noticing how far he depended on Russian and Prussian willingness to act, are capped at Level 4.' },
        ],
      },
    ],
  });

  /* =======================================================================
     9702 Physics

     Mark codes follow the real physics schemes, and lessons.js uses the same
     set in its kinematics lesson, so a student meets one convention across
     both features: C1 for a creditable step of working, A1 for the answer
     that depends on it, B1 for a mark standing on its own, M1 for a method
     that must be seen. The distinction earns its place here — C1 is why
     writing the substitution down is worth marks even when the arithmetic
     then goes wrong, which is the single most useful habit in a physics exam.

     Units are written as LaTeX so they set properly: $\\text{m s}^{-2}$ rather
     than a string of superscript characters.
     ======================================================================= */

  PAPERS.push({
    id: 'phys-sec-motion',
    subject: 'physics',
    tex: true,
    kind: 'section',
    title: 'Kinematics and dynamics',
    component: 'AS Level, structured questions',
    minutes: 35,
    questions: [
      {
        n: 1, topic: 'kinematics',
        parts: [
          { ref: '(a)', command: 'Distinguish', marks: 2,
            text: 'Distinguish between distance and displacement, and between speed and velocity.',
            scheme: ['B1 — distance and speed are scalars, having magnitude only',
                     'B1 — displacement and velocity are vectors, having both magnitude and direction'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'A car starts from rest and accelerates uniformly at $2.5\\ \\text{m s}^{-2}$ for $8.0\\ \\text{s}$. It then travels at constant velocity for a further $12\\ \\text{s}$. Calculate the total distance travelled.',
            scheme: ['C1 — $v = at = 2.5 \\times 8.0 = 20\\ \\text{m s}^{-1}$',
                     'C1 — first stage: $s = \\frac{1}{2}at^2 = \\frac{1}{2} \\times 2.5 \\times 8.0^2 = 80\\ \\text{m}$',
                     'C1 — second stage: $s = vt = 20 \\times 12 = 240\\ \\text{m}$',
                     'A1 — total distance $= 320\\ \\text{m}$'],
            note: 'Using the full 20 s in a single suvat equation treats the whole journey as uniformly accelerated and scores no marks beyond the first.' },
          { ref: '(c)', command: 'Sketch', marks: 3,
            text: 'Sketch a velocity–time graph for the whole journey, and state what the gradient and the area under such a graph represent.',
            scheme: ['B1 — straight line from the origin rising to $20\\ \\text{m s}^{-1}$ at $8.0\\ \\text{s}$, then horizontal to $20\\ \\text{s}$',
                     'B1 — the gradient represents acceleration',
                     'B1 — the area under the graph represents displacement'] },
        ],
      },
      {
        n: 2, topic: 'dynamics',
        parts: [
          { ref: '(a)', command: 'State', marks: 2,
            text: 'State Newton’s second law in terms of momentum, and show that $F = ma$ follows from it when mass is constant.',
            scheme: ['B1 — the resultant force is proportional to the rate of change of momentum, and acts in the same direction',
                     'B1 — $F = \\frac{\\Delta(mv)}{\\Delta t} = m\\frac{\\Delta v}{\\Delta t} = ma$ when $m$ is constant'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'A ball of mass $0.20\\ \\text{kg}$ travelling at $6.0\\ \\text{m s}^{-1}$ strikes a wall and rebounds along the same line at $4.0\\ \\text{m s}^{-1}$. The contact lasts $0.15\\ \\text{s}$. Calculate the change in momentum of the ball and the average force exerted on it.',
            scheme: ['C1 — taking the initial direction as positive, $\\Delta p = m(v - u) = 0.20(-4.0 - 6.0)$',
                     'A1 — $\\Delta p = -2.0\\ \\text{N s}$, a magnitude of $2.0\\ \\text{N s}$',
                     'C1 — $F = \\frac{\\Delta p}{\\Delta t} = \\frac{2.0}{0.15}$',
                     'A1 — $F = 13\\ \\text{N}$'],
            note: 'Treating the rebound speed as positive gives $\\Delta p = -0.4\\ \\text{N s}$ and is the standard error; the sign convention must be applied to both velocities.' },
          { ref: '(c)', command: 'Explain', marks: 3,
            text: 'Use Newton’s third law to explain why the total momentum of two colliding bodies is conserved.',
            scheme: ['B1 — the force on each body due to the other is equal in magnitude and opposite in direction',
                     'B1 — the two forces act for the same time, so the impulses are equal and opposite',
                     'B1 — the changes in momentum are therefore equal and opposite and cancel, leaving the total unchanged'] },
        ],
      },
      {
        n: 3, topic: 'kinematics',
        stem: 'A ball is projected horizontally at $15\\ \\text{m s}^{-1}$ from the top of a cliff $20\\ \\text{m}$ above level ground. Air resistance is negligible and $g = 9.81\\ \\text{m s}^{-2}$.',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 2,
            text: 'Explain why the horizontal and vertical motions of the ball can be treated independently.',
            scheme: ['B1 — the only force acting is the weight, which is vertical, so there is no horizontal acceleration',
                     'B1 — the horizontal and vertical components are perpendicular, so a change in one does not affect the other'] },
          { ref: '(b)', command: 'Calculate', marks: 5,
            text: 'Calculate the time taken for the ball to reach the ground and its horizontal distance from the base of the cliff when it lands.',
            scheme: ['C1 — vertically: $s = \\frac{1}{2}gt^2$, so $20 = \\frac{1}{2} \\times 9.81 \\times t^2$',
                     'C1 — $t^2 = \\frac{40}{9.81} = 4.08$',
                     'A1 — $t = 2.0\\ \\text{s}$',
                     'C1 — horizontally: $s = vt = 15 \\times 2.02$',
                     'A1 — $s = 30\\ \\text{m}$'],
            note: 'Using the projection speed in the vertical equation is the commonest error and scores nothing in the first three marks.' },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'phys-sec-electricity',
    subject: 'physics',
    tex: true,
    kind: 'section',
    title: 'Electricity and d.c. circuits',
    component: 'AS Level, structured questions',
    minutes: 35,
    questions: [
      {
        n: 1, topic: 'electricity',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define electric current, and define the coulomb.',
            scheme: ['B1 — current is the rate of flow of charge, $I = \\frac{Q}{t}$',
                     'B1 — one coulomb is the charge passing a point when a current of one ampere flows for one second'] },
          { ref: '(b)', command: 'Calculate', marks: 3,
            text: 'A current of $0.25\\ \\text{A}$ flows for $2.0$ minutes. Calculate the charge that passes and the number of electrons this represents. [$e = 1.60 \\times 10^{-19}\\ \\text{C}$]',
            scheme: ['C1 — $Q = It = 0.25 \\times 120$',
                     'A1 — $Q = 30\\ \\text{C}$',
                     'A1 — $n = \\frac{30}{1.60 \\times 10^{-19}} = 1.9 \\times 10^{20}$'],
            note: 'Using 2.0 rather than 120 for the time is the usual lost mark here.' },
          { ref: '(c)', command: 'Calculate', marks: 4,
            text: 'A wire of length $1.5\\ \\text{m}$ and uniform cross-sectional area $0.20\\ \\text{mm}^2$ has a resistance of $0.13\\ \\Omega$. Calculate the resistivity of the metal and suggest what the metal is.',
            scheme: ['C1 — $\\rho = \\frac{RA}{L}$',
                     'C1 — converting the area: $A = 0.20 \\times 10^{-6}\\ \\text{m}^2$',
                     'A1 — $\\rho = \\frac{0.13 \\times 0.20 \\times 10^{-6}}{1.5} = 1.7 \\times 10^{-8}\\ \\Omega\\ \\text{m}$',
                     'B1 — the metal is copper'],
            note: 'Leaving the area in $\\text{mm}^2$ gives an answer a million times too large and loses both the conversion and the answer mark.' },
        ],
      },
      {
        n: 2, topic: 'dc-circuits',
        parts: [
          { ref: '(a)', command: 'State', marks: 2,
            text: 'State Kirchhoff’s two laws, and name the conservation law that each expresses.',
            scheme: ['B1 — the sum of the currents into a junction equals the sum of the currents out of it; conservation of charge',
                     'B1 — round any closed loop the sum of the e.m.f.s equals the sum of the p.d.s; conservation of energy'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'A $6.0\\ \\Omega$ resistor and a $3.0\\ \\Omega$ resistor are connected in parallel, and this combination is in series with a $4.0\\ \\Omega$ resistor across a supply of $12\\ \\text{V}$ of negligible internal resistance. Calculate the total resistance, the current drawn from the supply, and the p.d. across the parallel combination.',
            scheme: ['C1 — parallel combination: $\\frac{6.0 \\times 3.0}{6.0 + 3.0} = 2.0\\ \\Omega$',
                     'A1 — total resistance $= 2.0 + 4.0 = 6.0\\ \\Omega$',
                     'C1 — $I = \\frac{12}{6.0} = 2.0\\ \\text{A}$',
                     'A1 — p.d. across the parallel pair $= 2.0 \\times 2.0 = 4.0\\ \\text{V}$'],
            note: 'Adding the parallel resistors directly to give $9.0\\ \\Omega$ scores nothing beyond the final structure of the method.' },
          { ref: '(c)', command: 'Calculate', marks: 3,
            text: 'A potential divider is made from an $8.0\\ \\text{k}\\Omega$ resistor in series with a $4.0\\ \\text{k}\\Omega$ resistor across a $12\\ \\text{V}$ supply, the output being taken across the $4.0\\ \\text{k}\\Omega$ resistor. Calculate the output p.d., and state how it would change if the $4.0\\ \\text{k}\\Omega$ resistor were replaced by a thermistor whose resistance falls as temperature rises.',
            scheme: ['C1 — $V_{out} = 12 \\times \\frac{4.0}{8.0 + 4.0}$',
                     'A1 — $V_{out} = 4.0\\ \\text{V}$',
                     'B1 — as the temperature rises the thermistor resistance falls, so it takes a smaller share of the supply and the output p.d. falls'] },
        ],
      },
      {
        n: 3, topic: 'dc-circuits',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define electromotive force, and explain how it differs from potential difference.',
            scheme: ['B1 — e.m.f. is the energy converted from other forms into electrical energy per unit charge',
                     'B1 — p.d. is the energy converted from electrical energy into other forms per unit charge'] },
          { ref: '(b)', command: 'Calculate', marks: 3,
            text: 'A cell of e.m.f. $1.5\\ \\text{V}$ has a terminal p.d. of $1.2\\ \\text{V}$ when supplying a current of $0.30\\ \\text{A}$. Calculate the internal resistance of the cell and the power dissipated within it.',
            scheme: ['C1 — lost volts $= 1.5 - 1.2 = 0.3\\ \\text{V}$, so $r = \\frac{0.3}{0.30}$',
                     'A1 — $r = 1.0\\ \\Omega$',
                     'A1 — $P = I^2r = 0.30^2 \\times 1.0 = 0.090\\ \\text{W}$'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why the terminal p.d. of a cell falls as the current drawn from it increases.',
            scheme: ['B1 — a greater p.d. is dropped across the internal resistance as the current rises',
                     'B1 — since $V = E - Ir$, the terminal p.d. falls linearly as $I$ increases'] },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'phys-full-as',
    subject: 'physics',
    tex: true,
    kind: 'full',
    title: 'AS Level Physics — structured questions',
    component: 'AS Level, structured questions',
    minutes: 75,
    questions: [
      {
        n: 1, topic: 'measurement',
        parts: [
          { ref: '(a)', command: 'State', marks: 2,
            text: 'State what is meant by a base quantity, and give three base quantities with their SI units.',
            scheme: ['B1 — a base quantity is one that is defined independently and not in terms of any other quantity',
                     'B1 — any three of: mass (kg), length (m), time (s), current (A), temperature (K), amount of substance (mol)'] },
          { ref: '(b)', command: 'Show', marks: 3,
            text: 'Show that the SI base units of pressure are $\\text{kg}\\ \\text{m}^{-1}\\ \\text{s}^{-2}$.',
            scheme: ['C1 — pressure is force per unit area, $p = \\frac{F}{A}$',
                     'C1 — force has base units $\\text{kg}\\ \\text{m}\\ \\text{s}^{-2}$ from $F = ma$',
                     'A1 — dividing by $\\text{m}^2$ gives $\\text{kg}\\ \\text{m}^{-1}\\ \\text{s}^{-2}$'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why an equation that is homogeneous with respect to units may still be incorrect.',
            scheme: ['B1 — homogeneity only checks that both sides have the same units',
                     'B1 — a dimensionless constant may be wrong or missing, and that does not affect the units'] },
        ],
      },
      {
        n: 2, topic: 'kinematics',
        stem: 'A stone is thrown vertically upwards from ground level with a speed of $12\\ \\text{m s}^{-1}$. Air resistance is negligible and $g = 9.81\\ \\text{m s}^{-2}$.',
        parts: [
          { ref: '(a)', command: 'Calculate', marks: 3,
            text: 'Calculate the maximum height reached by the stone and the time taken to reach it.',
            scheme: ['C1 — at the highest point $v = 0$, so $v^2 = u^2 - 2gs$ gives $0 = 12^2 - 2(9.81)s$',
                     'A1 — $s = 7.3\\ \\text{m}$',
                     'A1 — $t = \\frac{u}{g} = \\frac{12}{9.81} = 1.2\\ \\text{s}$'] },
          { ref: '(b)', command: 'Sketch', marks: 3,
            text: 'Sketch a velocity–time graph for the stone from release until it returns to the ground, and explain the significance of the sign of the velocity.',
            scheme: ['B1 — a straight line of constant negative gradient',
                     'B1 — crossing the time axis at $1.2\\ \\text{s}$ and reaching $-12\\ \\text{m s}^{-1}$ at $2.4\\ \\text{s}$',
                     'B1 — the change of sign shows the direction of travel has reversed, not that the stone has slowed'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'State and explain the effect of air resistance on the maximum height reached.',
            scheme: ['B1 — the maximum height would be lower',
                     'B1 — air resistance acts downwards on the way up, adding to the weight, so the deceleration is greater'] },
        ],
      },
      {
        n: 3, topic: 'dynamics',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define linear momentum and state the principle of conservation of momentum.',
            scheme: ['B1 — momentum is the product of mass and velocity, and is a vector',
                     'B1 — in the absence of a resultant external force, the total momentum of a system is constant'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'A trolley of mass $2.0\\ \\text{kg}$ moving at $3.0\\ \\text{m s}^{-1}$ collides with a stationary trolley of mass $1.0\\ \\text{kg}$ and the two move off together. Calculate their common velocity, and show by calculation that the collision is inelastic.',
            scheme: ['C1 — $2.0 \\times 3.0 = (2.0 + 1.0)v$',
                     'A1 — $v = 2.0\\ \\text{m s}^{-1}$',
                     'C1 — kinetic energy before $= \\frac{1}{2}(2.0)(3.0)^2 = 9.0\\ \\text{J}$; after $= \\frac{1}{2}(3.0)(2.0)^2 = 6.0\\ \\text{J}$',
                     'A1 — $3.0\\ \\text{J}$ of kinetic energy is lost, so the collision is inelastic'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain how momentum can be conserved in this collision although kinetic energy is not.',
            scheme: ['B1 — momentum is conserved because the forces between the trolleys are internal, equal and opposite',
                     'B1 — kinetic energy is converted into other forms such as internal energy and sound, which is not forbidden by any conservation law'] },
        ],
      },
      {
        n: 4, topic: 'forces',
        stem: 'A uniform beam of length $4.0\\ \\text{m}$ and weight $120\\ \\text{N}$ rests horizontally on supports at each end. A load of $200\\ \\text{N}$ is placed $1.0\\ \\text{m}$ from the left-hand support.',
        parts: [
          { ref: '(a)', command: 'State', marks: 2,
            text: 'State the two conditions necessary for the beam to be in equilibrium.',
            scheme: ['B1 — the resultant force in any direction must be zero',
                     'B1 — the resultant moment about any point must be zero'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'Calculate the force exerted by each support on the beam.',
            scheme: ['C1 — taking moments about the left-hand support: $R \\times 4.0 = 120 \\times 2.0 + 200 \\times 1.0$',
                     'C1 — $R \\times 4.0 = 440$',
                     'A1 — right-hand support $= 110\\ \\text{N}$',
                     'A1 — left-hand support $= 320 - 110 = 210\\ \\text{N}$'],
            note: 'The weight of a uniform beam acts at its centre, $2.0\\ \\text{m}$ from either end; placing it elsewhere loses the first mark.' },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why taking moments about one of the supports is a convenient choice.',
            scheme: ['B1 — the force at that support has no moment about that point, because its distance from it is zero',
                     'B1 — that unknown is therefore eliminated and the remaining equation has only one unknown in it'] },
        ],
      },
      {
        n: 5, topic: 'energy',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define the work done by a force, and state a situation in which a force acts but does no work.',
            scheme: ['B1 — work done is the product of the force and the distance moved in the direction of the force',
                     'B1 — no work is done when the displacement is perpendicular to the force, as for the tension in a string whirling a mass in a circle'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'A car of mass $1200\\ \\text{kg}$ travelling at $20\\ \\text{m s}^{-1}$ is brought to rest in a distance of $50\\ \\text{m}$. Calculate its initial kinetic energy and the average braking force.',
            scheme: ['C1 — $E_k = \\frac{1}{2}mv^2 = \\frac{1}{2}(1200)(20)^2$',
                     'A1 — $E_k = 2.4 \\times 10^5\\ \\text{J}$',
                     'C1 — the work done by the braking force equals the kinetic energy lost, so $F \\times 50 = 2.4 \\times 10^5$',
                     'A1 — $F = 4800\\ \\text{N}$'] },
          { ref: '(c)', command: 'Calculate', marks: 2,
            text: 'A pump raises $2.0\\ \\text{kg}$ of water each second through a height of $15\\ \\text{m}$. Calculate the useful output power of the pump.',
            scheme: ['C1 — $P = \\frac{mgh}{t} = 2.0 \\times 9.81 \\times 15$',
                     'A1 — $P = 290\\ \\text{W}$'] },
        ],
      },
      {
        n: 6, topic: 'waves',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define the wavelength and the frequency of a progressive wave, and state the relationship between them and the wave speed.',
            scheme: ['B1 — wavelength is the distance between adjacent points oscillating in phase; frequency is the number of complete oscillations per unit time',
                     'B1 — $v = f\\lambda$'] },
          { ref: '(b)', command: 'Calculate', marks: 3,
            text: 'A sound wave of frequency $256\\ \\text{Hz}$ travels at $340\\ \\text{m s}^{-1}$. Calculate its wavelength, and the phase difference between two points $0.33\\ \\text{m}$ apart along the direction of travel.',
            scheme: ['C1 — $\\lambda = \\frac{v}{f} = \\frac{340}{256}$',
                     'A1 — $\\lambda = 1.33\\ \\text{m}$',
                     'A1 — phase difference $= \\frac{0.33}{1.33} \\times 360 = 90\\degree$'] },
          { ref: '(c)', command: 'Explain', marks: 3,
            text: 'Explain the difference between transverse and longitudinal waves, and state why only one of them can be polarised.',
            scheme: ['B1 — in a transverse wave the oscillations are perpendicular to the direction of energy transfer',
                     'B1 — in a longitudinal wave the oscillations are parallel to the direction of energy transfer',
                     'B1 — only transverse waves can be polarised, because only they have more than one possible plane of oscillation to restrict'] },
        ],
      },
      {
        n: 7, topic: 'electricity',
        parts: [
          { ref: '(a)', command: 'Sketch', marks: 3,
            text: 'Sketch the current–voltage characteristic of a filament lamp and explain its shape.',
            scheme: ['B1 — a curve through the origin that becomes less steep as the voltage increases',
                     'B1 — as the current increases the filament gets hotter',
                     'B1 — the lattice ions vibrate more, impeding the electrons, so the resistance rises'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'A $12\\ \\text{V}$ supply drives a current of $2.0\\ \\text{A}$ through a lamp. Calculate the resistance of the lamp, the power it dissipates, and the energy it converts in $5.0$ minutes.',
            scheme: ['C1 — $R = \\frac{V}{I} = \\frac{12}{2.0} = 6.0\\ \\Omega$',
                     'A1 — $P = VI = 12 \\times 2.0 = 24\\ \\text{W}$',
                     'C1 — $E = Pt = 24 \\times 300$',
                     'A1 — $E = 7200\\ \\text{J}$'] },
        ],
      },
      {
        n: 8, topic: 'dc-circuits',
        parts: [
          { ref: '(a)', command: 'Calculate', marks: 4,
            text: 'Two resistors of $12\\ \\Omega$ and $6.0\\ \\Omega$ are connected in parallel across a battery of e.m.f. $9.0\\ \\text{V}$ and internal resistance $1.0\\ \\Omega$. Calculate the current drawn from the battery and the terminal p.d.',
            scheme: ['C1 — parallel combination $= \\frac{12 \\times 6.0}{18} = 4.0\\ \\Omega$',
                     'C1 — total circuit resistance $= 4.0 + 1.0 = 5.0\\ \\Omega$',
                     'A1 — $I = \\frac{9.0}{5.0} = 1.8\\ \\text{A}$',
                     'A1 — terminal p.d. $= 9.0 - (1.8 \\times 1.0) = 7.2\\ \\text{V}$'] },
          { ref: '(b)', command: 'Explain', marks: 2,
            text: 'State and explain what happens to the terminal p.d. if a third resistor is connected in parallel with the other two.',
            scheme: ['B1 — the terminal p.d. falls',
                     'B1 — the external resistance decreases so the current increases, and more p.d. is lost across the internal resistance'] },
        ],
      },
    ],
  });

  /* Second mock. The first is weighted towards motion and energy; this one
     towards uncertainties, waves and circuits, so the pair cover the AS
     content between them rather than testing mechanics twice. */
  PAPERS.push({
    id: 'phys-full-as-2',
    subject: 'physics',
    tex: true,
    kind: 'full',
    title: 'AS Level Physics — waves, circuits and matter',
    component: 'AS Level, structured questions',
    minutes: 75,
    questions: [
      {
        n: 1, topic: 'measurement',
        parts: [
          { ref: '(a)', command: 'Distinguish', marks: 2,
            text: 'Distinguish between the precision and the accuracy of a set of measurements.',
            scheme: ['B1 — precision describes how closely repeated readings agree with one another',
                     'B1 — accuracy describes how close a reading is to the true value'],
            note: 'A precise set of readings can be systematically wrong; candidates who treat the two words as synonyms score nothing.' },
          { ref: '(b)', command: 'Calculate', marks: 3,
            text: 'The sides of a rectangular sheet are measured as $25.0 \\pm 0.5\\ \\text{mm}$ and $10.0 \\pm 0.5\\ \\text{mm}$. Calculate the area and its percentage uncertainty.',
            scheme: ['C1 — area $= 25.0 \\times 10.0 = 250\\ \\text{mm}^2$',
                     'C1 — percentage uncertainties are added when quantities are multiplied: $\\frac{0.5}{25.0} \\times 100 = 2\\%$ and $\\frac{0.5}{10.0} \\times 100 = 5\\%$',
                     'A1 — total percentage uncertainty $= 7\\%$'],
            note: 'Adding the absolute uncertainties is the standard error. Absolute uncertainties add only when the quantities themselves are added or subtracted.' },
          { ref: '(c)', command: 'State', marks: 2,
            text: 'Hence state the area with its absolute uncertainty, to an appropriate number of significant figures.',
            scheme: ['C1 — absolute uncertainty $= 7\\% \\times 250 = 17.5\\ \\text{mm}^2$',
                     'A1 — area $= 250 \\pm 20\\ \\text{mm}^2$, the uncertainty quoted to one significant figure'] },
        ],
      },
      {
        n: 2, topic: 'forces',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define density and define pressure.',
            scheme: ['B1 — density is mass per unit volume',
                     'B1 — pressure is force acting normally per unit area'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'A diver is $25\\ \\text{m}$ below the surface of sea water of density $1030\\ \\text{kg}\\ \\text{m}^{-3}$. Calculate the pressure on the diver due to the water alone, and the total pressure on the diver. [Atmospheric pressure $= 1.01 \\times 10^5\\ \\text{Pa}$]',
            scheme: ['C1 — $p = h\\rho g = 25 \\times 1030 \\times 9.81$',
                     'A1 — $p = 2.53 \\times 10^5\\ \\text{Pa}$',
                     'C1 — total pressure is the sum of the water pressure and atmospheric pressure',
                     'A1 — total $= 3.54 \\times 10^5\\ \\text{Pa}$'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain, in terms of pressure, why the diver experiences an upthrust.',
            scheme: ['B1 — pressure in a fluid increases with depth, so the pressure on the bottom of the diver exceeds that on the top',
                     'B1 — this pressure difference acting over the area gives a net upward force'] },
        ],
      },
      {
        n: 3, topic: 'energy',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define power, and define the efficiency of a device.',
            scheme: ['B1 — power is the rate of doing work, or the rate of transfer of energy',
                     'B1 — efficiency is the useful output energy (or power) divided by the total input energy (or power)'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'An electric motor raises a load of mass $50\\ \\text{kg}$ through a height of $8.0\\ \\text{m}$ in $12\\ \\text{s}$, while drawing $400\\ \\text{W}$ from the supply. Calculate the useful output power and the efficiency of the motor.',
            scheme: ['C1 — useful work done $= mgh = 50 \\times 9.81 \\times 8.0 = 3924\\ \\text{J}$',
                     'C1 — useful output power $= \\frac{3924}{12}$',
                     'A1 — $= 327\\ \\text{W}$',
                     'A1 — efficiency $= \\frac{327}{400} = 0.82$, or $82\\%$'] },
          { ref: '(c)', command: 'State', marks: 2,
            text: 'State what becomes of the remaining input power, naming two forms.',
            scheme: ['B1 — it is transferred to the surroundings rather than to the load',
                     'B1 — as internal energy through resistive heating in the windings, and as sound and internal energy through friction in the bearings'] },
        ],
      },
      {
        n: 4, topic: 'waves',
        parts: [
          { ref: '(a)', command: 'State', marks: 3,
            text: 'State the principle of superposition, and state the two conditions necessary for two sources to produce an observable interference pattern.',
            scheme: ['B1 — where two waves meet, the resultant displacement is the vector sum of the individual displacements',
                     'B1 — the sources must be coherent, having a constant phase difference and therefore the same frequency',
                     'B1 — the waves must have similar amplitudes, and for transverse waves be polarised in the same plane'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'In a double-slit experiment the slits are $0.50\\ \\text{mm}$ apart and the screen is $2.0\\ \\text{m}$ away. The fringes are measured to be $2.4\\ \\text{mm}$ apart. Calculate the wavelength of the light and state its colour.',
            scheme: ['C1 — $\\lambda = \\frac{ax}{D}$',
                     'C1 — $\\lambda = \\frac{(0.50 \\times 10^{-3})(2.4 \\times 10^{-3})}{2.0}$',
                     'A1 — $\\lambda = 6.0 \\times 10^{-7}\\ \\text{m}$, or $600\\ \\text{nm}$',
                     'B1 — orange or red light'] },
          { ref: '(c)', command: 'State', marks: 2,
            text: 'State and explain the effect on the fringe spacing of increasing the separation of the slits.',
            scheme: ['B1 — the fringe spacing decreases',
                     'B1 — because $x = \\frac{\\lambda D}{a}$, so the spacing is inversely proportional to the slit separation'] },
        ],
      },
      {
        n: 5, topic: 'electricity',
        parts: [
          { ref: '(a)', command: 'State', marks: 2,
            text: 'State Ohm’s law and explain what is meant by an ohmic conductor.',
            scheme: ['B1 — the current through a conductor is proportional to the p.d. across it, provided physical conditions such as temperature are constant',
                     'B1 — an ohmic conductor is one that obeys this relationship, so its resistance is constant and its $I$–$V$ graph is a straight line through the origin'] },
          { ref: '(b)', command: 'Deduce', marks: 3,
            text: 'A uniform wire has resistance $R$. Deduce the resistance of a second wire of the same material whose length is twice as great and whose diameter is twice as great.',
            scheme: ['C1 — $R = \\frac{\\rho L}{A}$, so doubling the length alone doubles the resistance',
                     'C1 — doubling the diameter multiplies the cross-sectional area by four, dividing the resistance by four',
                     'A1 — the net effect is $\\frac{2R}{4} = \\frac{R}{2}$, so the resistance is halved'],
            note: 'Treating the diameter as if it were the area is the usual error and gives $R$ unchanged.' },
          { ref: '(c)', command: 'Sketch', marks: 3,
            text: 'Sketch the current–voltage characteristic of a semiconductor diode and explain its shape.',
            scheme: ['B1 — in forward bias almost no current until about $0.6\\ \\text{V}$, then a steeply rising curve',
                     'B1 — in reverse bias the current is negligible',
                     'B1 — the diode conducts in one direction only, its resistance being very high in reverse bias and falling sharply above the threshold in forward bias'] },
        ],
      },
      {
        n: 6, topic: 'dc-circuits',
        stem: 'A light-dependent resistor (LDR) is connected in series with a fixed $2.0\\ \\text{k}\\Omega$ resistor across a $12\\ \\text{V}$ supply of negligible internal resistance. The output is taken across the fixed resistor.',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 2,
            text: 'Explain how a potential divider produces an output p.d. smaller than the supply p.d.',
            scheme: ['B1 — the two resistors in series share the supply p.d.',
                     'B1 — each takes a share in proportion to its resistance, so the output across one of them is a fraction of the total'] },
          { ref: '(b)', command: 'Calculate', marks: 4,
            text: 'The resistance of the LDR is $500\\ \\Omega$ in bright light and $10\\ \\text{k}\\Omega$ in darkness. Calculate the output p.d. in each case.',
            scheme: ['C1 — in bright light: $V_{out} = 12 \\times \\frac{2000}{2000 + 500}$',
                     'A1 — $V_{out} = 9.6\\ \\text{V}$',
                     'C1 — in darkness: $V_{out} = 12 \\times \\frac{2000}{2000 + 10000}$',
                     'A1 — $V_{out} = 2.0\\ \\text{V}$'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why connecting a voltmeter of resistance $2.0\\ \\text{k}\\Omega$ across the fixed resistor would give a misleading reading.',
            scheme: ['B1 — the voltmeter is in parallel with the fixed resistor, reducing that part of the divider to $1.0\\ \\text{k}\\Omega$',
                     'B1 — the fixed resistor then takes a smaller share of the supply, so the measured p.d. is lower than the p.d. present before the meter was connected'] },
        ],
      },
      {
        n: 7, topic: 'dynamics',
        stem: 'A ball of mass $0.50\\ \\text{kg}$ moving at $4.0\\ \\text{m s}^{-1}$ makes a head-on elastic collision with a second, stationary ball of the same mass.',
        parts: [
          { ref: '(a)', command: 'State', marks: 2,
            text: 'State what is meant by an elastic collision and by an inelastic collision.',
            scheme: ['B1 — in an elastic collision the total kinetic energy is the same before and after',
                     'B1 — in an inelastic collision kinetic energy is lost, although momentum is still conserved'] },
          { ref: '(b)', command: 'Deduce', marks: 3,
            text: 'Deduce the velocity of each ball immediately after the collision.',
            scheme: ['C1 — momentum: $0.50 \\times 4.0 = 0.50v_1 + 0.50v_2$',
                     'C1 — kinetic energy: $\\frac{1}{2}(0.50)(4.0)^2 = \\frac{1}{2}(0.50)v_1^2 + \\frac{1}{2}(0.50)v_2^2$',
                     'A1 — the first ball stops and the second moves off at $4.0\\ \\text{m s}^{-1}$'],
            note: 'For equal masses in a head-on elastic collision the velocities are exchanged; a candidate quoting that result with justification gains full credit.' },
          { ref: '(c)', command: 'Show', marks: 2,
            text: 'Show by calculation that kinetic energy is conserved in this collision.',
            scheme: ['C1 — before: $\\frac{1}{2}(0.50)(4.0)^2 = 4.0\\ \\text{J}$',
                     'A1 — after: $\\frac{1}{2}(0.50)(4.0)^2 = 4.0\\ \\text{J}$, so kinetic energy is unchanged'] },
        ],
      },
      {
        n: 8, topic: 'kinematics',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 3,
            text: 'A skydiver falls from rest and eventually reaches terminal velocity. Explain, in terms of the forces acting, how terminal velocity is reached.',
            scheme: ['B1 — initially the weight exceeds the air resistance, so there is a resultant downward force and the skydiver accelerates',
                     'B1 — as the speed increases the air resistance increases',
                     'B1 — when the air resistance equals the weight there is no resultant force, so the acceleration is zero and the velocity stays constant'] },
          { ref: '(b)', command: 'Sketch', marks: 2,
            text: 'Sketch a velocity–time graph for the skydiver from release until terminal velocity is reached, and state how the acceleration can be read from it.',
            scheme: ['B1 — a curve from the origin of decreasing gradient, levelling off to a horizontal line',
                     'B1 — the acceleration at any instant is the gradient of the curve at that point'] },
        ],
      },
    ],
  });

  /* =======================================================================
     9700 Biology

     Point-marked in prose with no mark codes, as the Chemistry papers are and
     as the real schemes largely are: a biology scheme is a list of creditable
     marking points, any of which earns its mark. The codes are kept for
     Mathematics and Physics, where the distinction between a method mark and
     the accuracy mark that depends on it is real and worth teaching.

     Almost nothing here needs LaTeX. Where a symbol is wanted — the psi of
     water potential — it is written as the character itself.
     ======================================================================= */

  PAPERS.push({
    id: 'bio-sec-cells',
    subject: 'biology',
    kind: 'section',
    title: 'Cell structure and membranes',
    component: 'AS Level, structured questions',
    minutes: 35,
    questions: [
      {
        n: 1, topic: 'cell-structure',
        parts: [
          { ref: '(a)', command: 'State', marks: 3,
            text: 'State three structural differences between a prokaryotic cell and a eukaryotic cell.',
            scheme: ['A prokaryote has no nucleus; its DNA lies free in the cytoplasm, while a eukaryote has DNA enclosed in a nuclear envelope.',
                     'A prokaryote has no membrane-bound organelles such as mitochondria or endoplasmic reticulum.',
                     'A prokaryote has 70S ribosomes and a peptidoglycan cell wall, against 80S ribosomes and no peptidoglycan in a eukaryote.'],
            note: 'Size alone is not a structural difference and scores nothing.' },
          { ref: '(b)', command: 'Describe', marks: 4,
            text: 'Describe the structure of a mitochondrion and of rough endoplasmic reticulum, and relate each structure to its function.',
            scheme: ['The mitochondrion has a double membrane, the inner one folded into cristae.',
                     'The cristae give a large surface area for the electron transport chain, so more ATP can be produced.',
                     'Rough ER consists of flattened membrane sacs studded with ribosomes.',
                     'Proteins made on those ribosomes enter the sacs to be modified and transported, so rough ER is abundant in secretory cells.'] },
          { ref: '(c)', command: 'State', marks: 2,
            text: 'State one advantage and one limitation of an electron microscope compared with a light microscope.',
            scheme: ['Advantage: far higher resolution, so much finer detail can be distinguished.',
                     'Limitation: specimens must be dead and in a vacuum, so living processes cannot be observed, and artefacts may be introduced in preparation.'] },
        ],
      },
      {
        n: 2, topic: 'cell-membranes',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 3,
            text: 'Describe the fluid mosaic model of membrane structure.',
            scheme: ['A bilayer of phospholipids with hydrophilic heads outwards and hydrophobic tails inwards.',
                     'Proteins are embedded in it, some spanning the bilayer and some on one surface only.',
                     'It is fluid because the phospholipids move laterally, and a mosaic because the proteins are scattered irregularly through it; cholesterol and glycoproteins are also present.'] },
          { ref: '(b)', command: 'Compare', marks: 4,
            text: 'Compare simple diffusion, facilitated diffusion and active transport.',
            scheme: ['All three move substances across the membrane, but only active transport can move them against a concentration gradient.',
                     'Simple diffusion requires no protein; facilitated diffusion uses channel or carrier proteins.',
                     'Active transport uses carrier proteins and requires ATP, while the two forms of diffusion are passive.',
                     'Diffusion is driven by the concentration gradient alone and stops at equilibrium; active transport does not.'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why oxygen crosses the cell surface membrane freely but glucose requires a transport protein.',
            scheme: ['Oxygen is a small non-polar molecule, so it dissolves in and passes through the hydrophobic interior of the bilayer.',
                     'Glucose is larger and polar, so it cannot pass through the hydrophobic tails and must use a channel or carrier protein.'] },
        ],
      },
      {
        n: 3, topic: 'cell-structure',
        parts: [
          { ref: '(a)', command: 'Calculate', marks: 3,
            text: 'A mitochondrion measures 30 mm in length on an electron micrograph taken at a magnification of ×15 000. Calculate its actual length in μm.',
            scheme: ['Actual size = image size ÷ magnification = 30 ÷ 15 000 mm.',
                     '= 0.002 mm.',
                     '= 2 μm.'],
            note: 'An answer left in mm scores two of the three marks; the question asks for μm.' },
          { ref: '(b)', command: 'Define', marks: 2,
            text: 'Define magnification and resolution.',
            scheme: ['Magnification is the number of times larger an image is than the actual object.',
                     'Resolution is the smallest distance between two points that can still be seen as two separate points.'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why an electron microscope achieves a higher resolution than a light microscope.',
            scheme: ['Resolution is limited by the wavelength of the radiation used.',
                     'Electrons have a far shorter wavelength than visible light, so two points much closer together can still be resolved.'] },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'bio-sec-molecules',
    subject: 'biology',
    kind: 'section',
    title: 'Biological molecules and enzymes',
    component: 'AS Level, structured questions',
    minutes: 35,
    questions: [
      {
        n: 1, topic: 'biological-molecules',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 3,
            text: 'Describe what happens when two glucose molecules join, naming the reaction and the bond formed.',
            scheme: ['A condensation reaction takes place.',
                     'A molecule of water is removed.',
                     'A glycosidic bond forms between the two monosaccharides, giving the disaccharide maltose.'] },
          { ref: '(b)', command: 'Compare', marks: 4,
            text: 'Compare the structure and function of starch, glycogen and cellulose.',
            scheme: ['Starch and glycogen are both polymers of α-glucose and act as energy stores; cellulose is a polymer of β-glucose and is structural.',
                     'Starch consists of unbranched amylose and branched amylopectin; glycogen is more highly branched still, so it can be hydrolysed more rapidly.',
                     'In cellulose alternate glucose molecules are inverted, giving straight chains.',
                     'Those straight chains hydrogen bond to one another to form microfibrils of great tensile strength, which is why cellulose makes a cell wall and starch does not.'] },
          { ref: '(c)', command: 'Describe', marks: 2,
            text: 'Describe a test that would distinguish a reducing sugar from a non-reducing sugar.',
            scheme: ['Heat with Benedict’s solution: a reducing sugar gives a brick-red precipitate while a non-reducing sugar stays blue.',
                     'Boil a fresh sample with dilute acid, neutralise, then repeat the Benedict’s test; a non-reducing sugar is hydrolysed and now gives a positive result.'] },
        ],
      },
      {
        n: 2, topic: 'enzymes',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 3,
            text: 'Explain the induced fit model of enzyme action, and state how it differs from the lock and key model.',
            scheme: ['The substrate binds to the active site, which is initially not quite complementary to it.',
                     'The active site changes shape slightly as the substrate binds, so that it becomes complementary and the enzyme–substrate complex forms.',
                     'In the lock and key model the active site is already exactly complementary and does not change shape.'] },
          { ref: '(b)', command: 'Explain', marks: 4,
            text: 'Explain the effect of increasing temperature on the rate of an enzyme-controlled reaction, both below and above the optimum.',
            scheme: ['Below the optimum, raising the temperature gives the molecules more kinetic energy.',
                     'There are therefore more frequent successful collisions between enzyme and substrate, so more enzyme–substrate complexes form per unit time and the rate rises.',
                     'Above the optimum, the hydrogen and ionic bonds holding the tertiary structure begin to break.',
                     'The active site is no longer complementary to the substrate, so fewer complexes form and the rate falls sharply; the enzyme is denatured.'],
            note: 'Saying the enzyme is "killed" scores nothing. Denaturation is a change of shape, and an enzyme is not alive.' },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why a change in pH away from the optimum reduces the rate of an enzyme-controlled reaction.',
            scheme: ['A change in hydrogen ion concentration disrupts the ionic and hydrogen bonds maintaining the tertiary structure.',
                     'The shape of the active site is altered so that it is less complementary to the substrate, and fewer enzyme–substrate complexes form.'] },
        ],
      },
      {
        n: 3, topic: 'enzymes',
        parts: [
          { ref: '(a)', command: 'Compare', marks: 4,
            text: 'Compare competitive and non-competitive inhibition, including the effect of each on the maximum rate of reaction.',
            scheme: ['A competitive inhibitor has a shape similar to the substrate and binds to the active site itself.',
                     'A non-competitive inhibitor binds elsewhere on the enzyme and changes the shape of the active site indirectly.',
                     'Competitive inhibition can be overcome by raising the substrate concentration, so the maximum rate is unchanged.',
                     'Non-competitive inhibition cannot be overcome in that way, so the maximum rate is reduced.'] },
          { ref: '(b)', command: 'Describe', marks: 3,
            text: 'Describe how you would investigate the effect of substrate concentration on the rate of an enzyme-controlled reaction, identifying the variables you would control.',
            scheme: ['Prepare a series of substrate concentrations and add the same volume and concentration of enzyme to each, measuring the product formed or substrate used in a fixed time.',
                     'Control temperature with a water bath and pH with a buffer, since both affect the shape of the active site.',
                     'Repeat each concentration and take a mean, and plot rate against substrate concentration.'] },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'bio-full-as',
    subject: 'biology',
    kind: 'full',
    title: 'AS Level Biology — cells, molecules and the genome',
    component: 'AS Level, structured questions',
    minutes: 75,
    questions: [
      {
        n: 1, topic: 'cell-structure',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 4,
            text: 'Describe the structure and function of the nucleus, the Golgi apparatus, lysosomes and ribosomes.',
            scheme: ['Nucleus: enclosed by a double membrane with pores, containing chromatin; it holds the genetic material and controls the cell’s activities.',
                     'Golgi apparatus: a stack of flattened sacs that modifies and packages proteins and forms lysosomes.',
                     'Lysosome: a membrane-bound vesicle of hydrolytic enzymes that digests worn-out organelles and ingested material.',
                     'Ribosome: made of RNA and protein, with no membrane; it is the site of protein synthesis.'] },
          { ref: '(b)', command: 'Explain', marks: 2,
            text: 'Explain why a cell that secretes large amounts of protein has extensive rough endoplasmic reticulum and many Golgi bodies.',
            scheme: ['The rough ER carries the ribosomes on which the secreted proteins are made and transports them through the cell.',
                     'The Golgi modifies and packages those proteins into vesicles for secretion, so a high rate of secretion requires a great deal of both.'] },
          { ref: '(c)', command: 'State', marks: 2,
            text: 'State two structures found in a plant cell that are not found in an animal cell, and give the function of each.',
            scheme: ['A cellulose cell wall, which gives support and prevents the cell bursting when turgid.',
                     'Chloroplasts, which are the site of photosynthesis; a permanent large vacuole maintaining turgor is also accepted.'] },
        ],
      },
      {
        n: 2, topic: 'biological-molecules',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 4,
            text: 'Describe the four levels of protein structure, naming the bonds responsible for each.',
            scheme: ['Primary: the sequence of amino acids, joined by peptide bonds.',
                     'Secondary: α-helices and β-pleated sheets, held by hydrogen bonds between parts of the backbone.',
                     'Tertiary: the overall three-dimensional folding, held by hydrogen bonds, ionic bonds, hydrophobic interactions and disulfide bridges.',
                     'Quaternary: two or more polypeptide chains associated together, as in haemoglobin.'] },
          { ref: '(b)', command: 'Explain', marks: 2,
            text: 'Explain why a change in a single amino acid can abolish the function of an enzyme.',
            scheme: ['The primary structure determines how the chain folds, so one changed amino acid can alter the bonds formed in the tertiary structure.',
                     'If that changes the shape of the active site it is no longer complementary to the substrate, and no enzyme–substrate complexes form.'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain two properties of water that make it important to living organisms.',
            scheme: ['It is a polar solvent, so it dissolves ions and polar molecules and acts as the medium for metabolic reactions and transport.',
                     'It has a high specific heat capacity, so bodies of water and organisms resist rapid temperature change; high latent heat of vaporisation and cohesion are equally acceptable.'] },
        ],
      },
      {
        n: 3, topic: 'enzymes',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 3,
            text: 'Explain, in terms of activation energy, how an enzyme increases the rate of a reaction.',
            scheme: ['An enzyme provides an alternative route for the reaction with a lower activation energy.',
                     'The substrate binds to the active site, forming an enzyme–substrate complex that strains or orientates the bonds to be broken.',
                     'A greater proportion of molecules therefore has enough energy to react, so the rate increases.'] },
          { ref: '(b)', command: 'Explain', marks: 3,
            text: 'Explain the shape of a graph of reaction rate against substrate concentration for a fixed quantity of enzyme.',
            scheme: ['At low substrate concentration the rate is proportional to it, because active sites are available and substrate is the limiting factor.',
                     'As the concentration rises the increase in rate falls away, as more active sites become occupied.',
                     'At high concentration the rate plateaus because all active sites are occupied; the enzyme concentration is now the limiting factor.'] },
          { ref: '(c)', command: 'Suggest', marks: 2,
            text: 'Suggest why many enzymes within a cell are held within membrane-bound organelles rather than free in the cytoplasm.',
            scheme: ['It keeps the enzymes and their substrates close together at high concentration, so the reaction proceeds rapidly.',
                     'It also separates potentially damaging enzymes, such as the hydrolases in lysosomes, from the rest of the cell.'] },
        ],
      },
      {
        n: 4, topic: 'cell-membranes',
        parts: [
          { ref: '(a)', command: 'Define', marks: 2,
            text: 'Define water potential, and state the water potential of pure water.',
            scheme: ['Water potential (Ψ) is the tendency of water molecules to move from one place to another by osmosis.',
                     'Pure water at standard temperature and pressure has a water potential of zero, and all solutions therefore have negative values.'] },
          { ref: '(b)', command: 'Predict', marks: 4,
            text: 'A plant cell with a water potential of −600 kPa is placed in a solution of water potential −350 kPa. Predict and explain what happens to the cell.',
            scheme: ['Water moves from a less negative to a more negative water potential, so water enters the cell.',
                     'The cell takes up water by osmosis through the partially permeable cell surface membrane.',
                     'The protoplast swells and presses against the cell wall, raising the pressure potential.',
                     'The cell becomes turgid; it does not burst, because the cellulose cell wall is inelastic and resists further expansion.'],
            note: 'Candidates who reverse the direction of movement have misread the sign and score at most the final mark.' },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain what would happen to an animal cell placed in the same solution, and why the outcome differs.',
            scheme: ['Water would enter the animal cell by osmosis in the same way and the cell would swell.',
                     'Having no cell wall to resist the expansion, it could burst — lysis — whereas the plant cell is protected by its wall.'] },
        ],
      },
      {
        n: 5, topic: 'mitosis',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 4,
            text: 'Describe what happens to the chromosomes in each of the four stages of mitosis.',
            scheme: ['Prophase: chromosomes condense and become visible as two sister chromatids joined at a centromere; the nuclear envelope breaks down.',
                     'Metaphase: chromosomes line up on the equator of the spindle, attached by their centromeres.',
                     'Anaphase: the centromeres divide and the sister chromatids are pulled to opposite poles by the spindle fibres.',
                     'Telophase: the chromatids reach the poles, decondense, and a nuclear envelope re-forms round each group.'] },
          { ref: '(b)', command: 'Explain', marks: 2,
            text: 'Explain why the two daughter cells produced by mitosis are genetically identical to each other and to the parent cell.',
            scheme: ['DNA is replicated semi-conservatively during interphase, so each chromosome consists of two identical sister chromatids.',
                     'One chromatid of each pair goes to each pole, so each daughter nucleus receives an identical copy of every chromosome.'] },
          { ref: '(c)', command: 'State', marks: 2,
            text: 'State two roles of mitosis in a multicellular organism.',
            scheme: ['Growth, by increasing the number of cells.',
                     'Repair and replacement of damaged or worn-out cells; asexual reproduction is also accepted.'] },
        ],
      },
      {
        n: 6, topic: 'nucleic-acids',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 3,
            text: 'Describe the structure of a DNA molecule.',
            scheme: ['Two polynucleotide strands, each nucleotide made of deoxyribose, a phosphate group and a nitrogenous base.',
                     'Nucleotides within a strand are joined by phosphodiester bonds between the sugar of one and the phosphate of the next.',
                     'The two strands are antiparallel and wound into a double helix, held together by hydrogen bonds between complementary bases — A with T by two, C with G by three.'] },
          { ref: '(b)', command: 'Explain', marks: 3,
            text: 'Explain what is meant by semi-conservative replication, and state the evidence that distinguishes it from conservative replication.',
            scheme: ['The double helix unwinds and each original strand acts as a template for a new complementary strand.',
                     'Each daughter molecule therefore contains one original strand and one newly made strand.',
                     'Conservative replication would have produced one wholly original and one wholly new molecule, giving two separate density bands rather than the single intermediate band that is observed.'] },
          { ref: '(c)', command: 'Describe', marks: 2,
            text: 'Describe the role of messenger RNA and transfer RNA in protein synthesis.',
            scheme: ['mRNA carries a copy of the base sequence of a gene from the nucleus to a ribosome in the cytoplasm.',
                     'tRNA carries a specific amino acid and has an anticodon that pairs with the complementary codon on the mRNA, bringing the amino acids into the correct order.'] },
        ],
      },
      {
        n: 7, topic: 'cell-structure',
        parts: [
          { ref: '(a)', command: 'Calculate', marks: 3,
            text: 'A cell appears 48 mm wide on a photomicrograph taken at a magnification of ×400. Calculate the actual width of the cell in μm.',
            scheme: ['Actual size = image size ÷ magnification = 48 ÷ 400 mm.',
                     '= 0.12 mm.',
                     '= 120 μm.'] },
          { ref: '(b)', command: 'Explain', marks: 3,
            text: 'Explain why the surface area to volume ratio of a cell limits its size.',
            scheme: ['Exchange of substances takes place across the surface, while the demand for them depends on the volume.',
                     'As a cell grows, volume increases faster than surface area, so the ratio falls.',
                     'Beyond a certain size the surface cannot supply the volume quickly enough by diffusion, so cells stay small or develop folded surfaces.'] },
        ],
      },
      {
        n: 8, topic: 'biological-molecules',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 3,
            text: 'Describe the structure of a triglyceride and explain why lipids are a more efficient energy store than carbohydrates.',
            scheme: ['A triglyceride is one glycerol molecule joined to three fatty acids by ester bonds, formed in condensation reactions.',
                     'Lipids contain proportionally more carbon–hydrogen bonds and less oxygen than carbohydrates.',
                     'They therefore release about twice as much energy per gram on oxidation, and being insoluble they do not affect water potential when stored.'] },
          { ref: '(b)', command: 'Describe', marks: 3,
            text: 'Describe how you would test a sample for the presence of lipid and for the presence of protein.',
            scheme: ['Lipid: the emulsion test — shake the sample with ethanol, then add water; a white emulsion indicates lipid.',
                     'Protein: the biuret test — add sodium hydroxide then dilute copper(II) sulfate.',
                     'A purple or lilac colour indicates protein, against a blue negative result.'] },
        ],
      },
    ],
  });

  /* Second mock. The first stays inside the cell; this one goes to the whole
     organism — transport, gas exchange and disease — so the two together
     cover the AS content instead of asking about membranes twice. */
  PAPERS.push({
    id: 'bio-full-as-2',
    subject: 'biology',
    kind: 'full',
    title: 'AS Level Biology — transport, exchange and disease',
    component: 'AS Level, structured questions',
    minutes: 75,
    questions: [
      {
        n: 1, topic: 'transport-plants',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 4,
            text: 'Describe the pathway taken by water from the soil to the xylem of a root, naming the tissues it passes through.',
            scheme: ['Water is absorbed from the soil through the root hair cells, which have a large surface area.',
                     'It crosses the cortex by the apoplast pathway through the cell walls, and by the symplast pathway through the cytoplasm and plasmodesmata.',
                     'At the endodermis the Casparian strip blocks the apoplast pathway, forcing all water through the cell membranes.',
                     'This allows the plant to control what enters, and the water then passes into the xylem.'] },
          { ref: '(b)', command: 'Explain', marks: 3,
            text: 'Explain how water is moved up the xylem from the root to the leaves.',
            scheme: ['Water evaporates from the mesophyll cells and diffuses out through the stomata, which is transpiration.',
                     'This lowers the water potential of the mesophyll and creates tension, pulling water up the xylem.',
                     'Cohesion between water molecules by hydrogen bonding holds the column together, and adhesion to the xylem walls assists; this is the cohesion–tension theory.'] },
          { ref: '(c)', command: 'Compare', marks: 2,
            text: 'Compare xylem and phloem with respect to the direction of transport and whether energy is required.',
            scheme: ['Xylem carries water and mineral ions upwards only, and the movement is passive, driven by transpiration pull.',
                     'Phloem carries assimilates such as sucrose both up and down the plant, and translocation requires ATP for active loading at the source.'] },
        ],
      },
      {
        n: 2, topic: 'gas-exchange',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 3,
            text: 'Describe the features of an alveolus that make it an efficient surface for gas exchange.',
            scheme: ['A very large total surface area, since there are many millions of alveoli.',
                     'A wall one squamous epithelial cell thick, giving a short diffusion distance.',
                     'A dense capillary network maintaining a steep concentration gradient, and a moist lining in which gases dissolve.'] },
          { ref: '(b)', command: 'Explain', marks: 3,
            text: 'Explain how ventilation and the circulation of blood maintain a steep diffusion gradient at the alveolus.',
            scheme: ['Ventilation continually replaces the alveolar air, keeping the oxygen concentration high and the carbon dioxide concentration low.',
                     'Blood flow continually removes oxygenated blood and brings deoxygenated blood with a low oxygen concentration.',
                     'The difference in concentration across the surface is therefore maintained, so net diffusion continues at a high rate.'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain, with reference to the lungs, why large active animals cannot rely on diffusion across the body surface alone.',
            scheme: ['A large organism has a small surface area to volume ratio, so the body surface cannot supply the volume of tissue.',
                     'Diffusion distances are also too great, so a specialised exchange surface with a transport system is required.'] },
        ],
      },
      {
        n: 3, topic: 'infectious-disease',
        parts: [
          { ref: '(a)', command: 'State', marks: 3,
            text: 'For cholera, tuberculosis and malaria, state the pathogen responsible and the method of transmission.',
            scheme: ['Cholera: the bacterium Vibrio cholerae, transmitted in water or food contaminated with faeces.',
                     'Tuberculosis: the bacterium Mycobacterium tuberculosis, transmitted in airborne droplets.',
                     'Malaria: the protoctist Plasmodium, transmitted by the bite of an infected female Anopheles mosquito.'],
            note: 'Naming malaria’s pathogen as the mosquito is a common error — the mosquito is the vector.' },
          { ref: '(b)', command: 'Explain', marks: 4,
            text: 'Explain why the secondary immune response to a pathogen is faster and greater than the primary response.',
            scheme: ['During the primary response, memory B and memory T cells are produced and persist in the body.',
                     'On re-infection these memory cells recognise the antigen immediately.',
                     'They divide rapidly by mitosis to form plasma cells without the delay of clonal selection from a few naive cells.',
                     'Antibody is therefore produced sooner, in greater quantity and for longer, so the pathogen is destroyed before symptoms appear.'] },
          { ref: '(c)', command: 'Distinguish', marks: 2,
            text: 'Distinguish between active and passive immunity, giving one example of each.',
            scheme: ['Active immunity results from the body making its own antibodies after exposure to an antigen, as after an infection or a vaccination, and is long-lasting because memory cells are formed.',
                     'Passive immunity results from receiving antibodies made elsewhere, as across the placenta or in an antivenom, and is short-lived because no memory cells are made.'] },
        ],
      },
      {
        n: 4, topic: 'cell-membranes',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 3,
            text: 'Explain how the sodium–potassium pump moves ions against their concentration gradients.',
            scheme: ['The pump is a carrier protein spanning the membrane with a site that binds sodium ions inside the cell.',
                     'ATP is hydrolysed and the phosphate group attaches to the protein, causing it to change shape and release the sodium ions outside.',
                     'Potassium ions then bind, the phosphate is released, the protein reverts to its original shape and the potassium ions enter the cell.'] },
          { ref: '(b)', command: 'Suggest', marks: 3,
            text: 'Suggest why cells that carry out a great deal of active transport contain large numbers of mitochondria.',
            scheme: ['Active transport requires ATP to change the shape of the carrier proteins.',
                     'Mitochondria are the site of aerobic respiration, which produces most of the cell’s ATP.',
                     'A high rate of active transport therefore demands a high rate of ATP production, which many mitochondria supply.'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain the effect on the rate of active transport of adding a respiratory inhibitor such as cyanide.',
            scheme: ['ATP production by aerobic respiration stops or falls sharply.',
                     'Without ATP the carrier proteins cannot change shape, so active transport slows or ceases, although simple diffusion continues.'] },
        ],
      },
      {
        n: 5, topic: 'nucleic-acids',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 4,
            text: 'Describe the process of transcription.',
            scheme: ['The DNA double helix unwinds and the hydrogen bonds between the bases of the gene are broken.',
                     'One strand acts as the template, and free RNA nucleotides align opposite their complementary bases — uracil pairing with adenine.',
                     'RNA polymerase joins the nucleotides by phosphodiester bonds to form the mRNA molecule.',
                     'The mRNA detaches and leaves the nucleus through a nuclear pore, and the DNA rewinds.'] },
          { ref: '(b)', command: 'Explain', marks: 2,
            text: 'Explain what is meant by the genetic code being degenerate, and why this matters.',
            scheme: ['Most amino acids are coded for by more than one triplet of bases.',
                     'A change in the third base of a triplet may therefore still code for the same amino acid, so some mutations have no effect on the protein.'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain why a substitution mutation may have no effect on an organism, while a deletion mutation usually does.',
            scheme: ['A substitution changes one triplet only, and because the code is degenerate it may still specify the same amino acid.',
                     'A deletion shifts the reading frame, so every triplet after it is altered and the whole polypeptide beyond that point is wrong.'] },
        ],
      },
      {
        n: 6, topic: 'mitosis',
        parts: [
          { ref: '(a)', command: 'Describe', marks: 3,
            text: 'Describe what happens during interphase and explain why it is not a resting stage.',
            scheme: ['During G1 the cell grows and makes new organelles and proteins.',
                     'During S phase the DNA is replicated, so each chromosome comes to consist of two identical sister chromatids.',
                     'During G2 the cell continues to grow and prepares for division; the cell is metabolically very active throughout, so it is not resting.'] },
          { ref: '(b)', command: 'Explain', marks: 3,
            text: 'Explain the role of the spindle in ensuring that each daughter cell receives a complete set of chromosomes.',
            scheme: ['Spindle fibres of microtubules attach to the centromere of each chromosome at metaphase.',
                     'They align the chromosomes on the equator so that each pair of chromatids is attached to both poles.',
                     'At anaphase the fibres shorten and pull one chromatid of each pair to each pole, so each new nucleus receives one copy of every chromosome.'] },
          { ref: '(c)', command: 'Explain', marks: 2,
            text: 'Explain how uncontrolled mitosis can lead to the formation of a tumour.',
            scheme: ['Mutations in the genes controlling the cell cycle remove the normal checkpoints on division.',
                     'Cells then divide repeatedly without regulation, producing a mass of cells that is a tumour.'] },
        ],
      },
      {
        n: 7, topic: 'biological-molecules',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 3,
            text: 'Explain how the structure of haemoglobin is related to its function.',
            scheme: ['Haemoglobin has a quaternary structure of four polypeptide chains, each with a haem group containing iron.',
                     'Each haem group binds one oxygen molecule, so one molecule can carry four.',
                     'Binding of the first oxygen changes the shape of the molecule so that the remaining sites bind more readily, which is cooperative binding and gives the sigmoid dissociation curve.'] },
          { ref: '(b)', command: 'State', marks: 2,
            text: 'State two ways in which the structure of a globular protein differs from that of a fibrous protein.',
            scheme: ['A globular protein folds into a compact roughly spherical shape with hydrophilic groups outermost, so it is soluble; a fibrous protein forms long strands and is insoluble.',
                     'A globular protein has a precise tertiary structure giving it a specific function such as catalysis; a fibrous protein has a repetitive sequence and a structural role.'] },
        ],
      },
      {
        n: 8, topic: 'cell-structure',
        parts: [
          { ref: '(a)', command: 'Explain', marks: 3,
            text: 'Explain why mitochondria and chloroplasts are thought to have originated as free-living prokaryotes.',
            scheme: ['Both have their own circular DNA, not enclosed in a nuclear envelope.',
                     'Both contain 70S ribosomes, the size found in prokaryotes rather than the 80S of eukaryotes.',
                     'Both are surrounded by a double membrane and divide independently of the cell by binary fission.'] },
          { ref: '(b)', command: 'State', marks: 2,
            text: 'State the function of the cytoskeleton and name the protein filaments of which it is made.',
            scheme: ['It maintains cell shape, anchors and moves organelles, and is involved in cell movement and division.',
                     'It is made of microtubules of tubulin, together with microfilaments of actin and intermediate filaments.'] },
        ],
      },
    ],
  });

  /* =======================================================================
     What to work on.

     A score on its own is the least useful thing an exam can give you, and the
     breakdown by topic is only slightly better — "you got 4/9 on mechanisms"
     tells a student where they are weak without telling them what to do on
     Tuesday evening. So every topic carries exercises: specific, finishable
     things, each one chosen because it attacks the usual reason marks are lost
     in that topic rather than just saying "revise mechanisms".

     Each is meant to be doable in one sitting. A student who has just sat a
     paper and marked it honestly has limited appetite, and three concrete
     tasks they will actually do beat a revision plan they will not.
     ======================================================================= */

  /* =======================================================================
     Papers for other exams
     =======================================================================

     The papers above are written to the Cambridge International AS & A Level
     format, and every subject has them. The ones below are written to the
     format of another exam — the French bac and brevet, a US high school
     Algebra II course, GCSE — and are offered instead to a student whose
     chosen exam (school-level.js, "about your schooling") is that one.

     `qual` lists the exams a paper is written for. A paper without one is an
     A level paper. When a student's exam has no paper of a kind (section or
     full) for a subject, they are given the A level paper of that kind, and
     the page says so rather than dressing it up — see paperSetFor().

     `lang` is the language the paper is set in. A French student sitting a
     bac paper reads it in French, as they would on the day. Like everything
     in this file these are originals, never past papers. */

  // ---- Baccalauréat — spécialité mathématiques ---------------------------

  PAPERS.push({
    id: 'bac-math-sec-suites',
    subject: 'mathematics',
    qual: ['bac'],
    lang: 'fr',
    tex: true,
    kind: 'section',
    title: 'Exercice — Suites numériques',
    component: 'Spécialité mathématiques, Terminale',
    instructions: 'La calculatrice en mode examen est autorisée. Toute trace de recherche, même incomplète, sera prise en compte.',
    minutes: 55,
    questions: [
      {
        n: 1, topic: 'sequences',
        stem: 'On considère la suite $(u_n)$ définie par $u_0 = 2$ et, pour tout entier naturel $n$, $u_{n+1} = \\frac{1}{2}u_n + 3$.',
        parts: [
          { ref: '1.', command: 'Calculer', marks: 1,
            text: 'Calculer $u_1$ et $u_2$.',
            scheme: ['$u_1 = 4$ et $u_2 = 5$ — les deux valeurs exactes'] },
          { ref: '2.', command: 'Démontrer', marks: 2,
            text: 'Démontrer par récurrence que, pour tout entier naturel $n$, $u_n \\le u_{n+1} \\le 6$.',
            scheme: ['Initialisation : $u_0 = 2 \\le u_1 = 4 \\le 6$',
                     'Hérédité : si $u_n \\le u_{n+1} \\le 6$, en multipliant par $\\frac{1}{2}$ puis en ajoutant $3$ on obtient $u_{n+1} \\le u_{n+2} \\le 6$ ; conclusion rédigée'],
            note: 'L’hérédité sans la phrase de conclusion ne rapporte pas le second point.' },
          { ref: '3.', command: 'En déduire', marks: 1,
            text: 'En déduire que la suite $(u_n)$ est convergente.',
            scheme: ['La suite est croissante et majorée par $6$, donc elle converge (théorème de convergence monotone)'] },
          { ref: '4. a)', command: 'Montrer', marks: 2,
            text: 'On pose, pour tout entier naturel $n$, $v_n = u_n - 6$. Montrer que $(v_n)$ est une suite géométrique dont on précisera la raison et le premier terme.',
            scheme: ['$v_{n+1} = \\frac{1}{2}u_n + 3 - 6 = \\frac{1}{2}(u_n - 6) = \\frac{1}{2}v_n$',
                     'Raison $q = \\frac{1}{2}$ et premier terme $v_0 = -4$'] },
          { ref: '4. b)', command: 'Exprimer', marks: 1,
            text: 'Exprimer $u_n$ en fonction de $n$.',
            scheme: ['$u_n = 6 - 4\\left(\\frac{1}{2}\\right)^n$'] },
          { ref: '4. c)', command: 'Déterminer', marks: 1,
            text: 'Déterminer la limite de la suite $(u_n)$.',
            scheme: ['$\\left(\\frac{1}{2}\\right)^n \\to 0$ car $0 < \\frac{1}{2} < 1$, donc $u_n \\to 6$'] },
          { ref: '5.', command: 'Déterminer', marks: 1,
            text: 'Déterminer le plus petit entier $n$ tel que $u_n > 5{,}99$.',
            scheme: ['$4\\left(\\frac{1}{2}\\right)^n < 0{,}01$, soit $2^n > 400$, donc $n = 9$'],
            note: 'Accepter une résolution par la calculatrice (tableau de valeurs) si $u_8 \\approx 5{,}984$ et $u_9 \\approx 5{,}992$ sont donnés.' },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'bac-math-full-1',
    subject: 'mathematics',
    qual: ['bac'],
    lang: 'fr',
    tex: true,
    kind: 'full',
    title: 'Sujet d’entraînement n° 1',
    component: 'Épreuve écrite de spécialité mathématiques, Terminale',
    instructions: 'Le sujet comporte quatre exercices indépendants. La calculatrice en mode examen est autorisée. La qualité de la rédaction, la clarté et la précision des raisonnements entrent pour une part importante dans l’appréciation des copies.',
    minutes: 240,
    questions: [
      {
        n: 1, topic: 'exponentials',
        stem: 'Exercice 1 — Questionnaire à choix multiples. Pour chaque question, une seule des quatre réponses est exacte. Indiquer la réponse choisie ; aucune justification n’est demandée.',
        parts: [
          { ref: '1.', command: 'Choisir', marks: 1,
            text: 'La solution de l’équation $e^{2x} = 3$ est : (a) $\\frac{3}{2}$ (b) $\\ln\\frac{3}{2}$ (c) $\\frac{\\ln 3}{2}$ (d) $2\\ln 3$.',
            scheme: ['(c) $\\frac{\\ln 3}{2}$'] },
          { ref: '2.', command: 'Choisir', marks: 1,
            text: 'Soit $f$ définie sur $\\mathbb{R}$ par $f(x) = x e^{-x}$. Alors $f\'(x) =$ (a) $e^{-x}$ (b) $(1 - x)e^{-x}$ (c) $-xe^{-x}$ (d) $(1 + x)e^{-x}$.',
            scheme: ['(b) $(1 - x)e^{-x}$'] },
          { ref: '3.', command: 'Choisir', marks: 1,
            text: '$\\ln\\left(e^2 \\times \\sqrt{e}\\right)$ est égal à : (a) $2$ (b) $\\frac{5}{2}$ (c) $e^{5/2}$ (d) $1$.',
            scheme: ['(b) $\\frac{5}{2}$'] },
          { ref: '4.', command: 'Choisir', marks: 1,
            text: '$\\lim_{n \\to +\\infty} \\frac{3n^2 + 1}{n^2 - n}$ est égale à : (a) $0$ (b) $1$ (c) $3$ (d) $+\\infty$.',
            scheme: ['(c) $3$'] },
        ],
      },
      {
        n: 2, topic: 'probability',
        stem: 'Exercice 2. Dans un lycée, 60 % des élèves pratiquent un sport. Parmi ceux qui pratiquent un sport, 70 % dorment plus de huit heures par nuit ; parmi ceux qui n’en pratiquent pas, 45 % dorment plus de huit heures. On choisit un élève au hasard et on note $S$ l’événement « l’élève pratique un sport » et $H$ l’événement « l’élève dort plus de huit heures ».',
        parts: [
          { ref: '1.', command: 'Représenter', marks: 1,
            text: 'Représenter la situation par un arbre pondéré.',
            scheme: ['Arbre complet : $P(S) = 0{,}6$, $P_S(H) = 0{,}7$, $P_{\\overline{S}}(H) = 0{,}45$ et les probabilités complémentaires'] },
          { ref: '2.', command: 'Calculer', marks: 1,
            text: 'Calculer $P(S \\cap H)$.',
            scheme: ['$P(S \\cap H) = 0{,}6 \\times 0{,}7 = 0{,}42$'] },
          { ref: '3.', command: 'Montrer', marks: 1,
            text: 'Montrer que $P(H) = 0{,}6$.',
            scheme: ['Formule des probabilités totales : $0{,}42 + 0{,}4 \\times 0{,}45 = 0{,}42 + 0{,}18 = 0{,}6$'] },
          { ref: '4.', command: 'Calculer', marks: 1,
            text: 'L’élève choisi dort plus de huit heures. Quelle est la probabilité qu’il pratique un sport ?',
            scheme: ['$P_H(S) = \\frac{0{,}42}{0{,}6} = 0{,}7$'] },
          { ref: '5.', command: 'Calculer', marks: 2,
            text: 'On choisit dix élèves au hasard ; le nombre d’élèves est assez grand pour assimiler ce choix à un tirage avec remise. On note $X$ le nombre d’élèves parmi eux qui dorment plus de huit heures. Préciser la loi de $X$, puis calculer $P(X \\ge 8)$ arrondie au millième.',
            scheme: ['$X$ suit la loi binomiale de paramètres $n = 10$ et $p = 0{,}6$ (répétition de dix épreuves de Bernoulli identiques et indépendantes)',
                     '$P(X \\ge 8) \\approx 0{,}167$'] },
        ],
      },
      {
        n: 3, topic: 'differentiation',
        stem: 'Exercice 3. Soit $f$ la fonction définie sur $[0 ; +\\infty[$ par $f(x) = (2x + 1)e^{-x}$.',
        parts: [
          { ref: '1.', command: 'Déterminer', marks: 1,
            text: 'Déterminer la limite de $f$ en $+\\infty$.',
            scheme: ['$f(x) = 2xe^{-x} + e^{-x}$ ; par croissances comparées $xe^{-x} \\to 0$, donc $f(x) \\to 0$'] },
          { ref: '2.', command: 'Montrer', marks: 2,
            text: 'Montrer que, pour tout $x \\ge 0$, $f\'(x) = (1 - 2x)e^{-x}$.',
            scheme: ['Dérivée d’un produit : $f\'(x) = 2e^{-x} - (2x + 1)e^{-x}$',
                     '$f\'(x) = (1 - 2x)e^{-x}$'] },
          { ref: '3.', command: 'Étudier', marks: 2,
            text: 'Étudier les variations de $f$ sur $[0 ; +\\infty[$ et donner la valeur exacte de son maximum.',
            scheme: ['$e^{-x} > 0$, donc $f\'(x)$ a le signe de $1 - 2x$',
                     '$f$ croissante sur $[0 ; \\frac{1}{2}]$, décroissante sur $[\\frac{1}{2} ; +\\infty[$ ; maximum $f(\\frac{1}{2}) = 2e^{-1/2}$'] },
          { ref: '4.', command: 'Vérifier', marks: 2,
            text: 'Vérifier que la fonction $F$ définie par $F(x) = (-2x - 3)e^{-x}$ est une primitive de $f$, puis calculer $\\int_0^1 f(x)\\,dx$.',
            scheme: ['$F\'(x) = -2e^{-x} + (2x + 3)e^{-x} = (2x + 1)e^{-x} = f(x)$',
                     '$\\int_0^1 f(x)\\,dx = F(1) - F(0) = 3 - 5e^{-1} \\approx 1{,}16$'] },
        ],
      },
      {
        n: 4, topic: 'vectors',
        stem: 'Exercice 4. L’espace est muni d’un repère orthonormé. On considère les points $A(1 ; 0 ; 2)$, $B(3 ; 1 ; 0)$ et $C(0 ; 2 ; 1)$, et la droite $d$ de représentation paramétrique $x = 1 + t$, $y = 2t$, $z = 2 - t$ ($t \\in \\mathbb{R}$).',
        parts: [
          { ref: '1.', command: 'Montrer', marks: 1,
            text: 'Montrer que les points $A$, $B$ et $C$ ne sont pas alignés.',
            scheme: ['$\\vec{AB}(2 ; 1 ; -2)$ et $\\vec{AC}(-1 ; 2 ; -1)$ ne sont pas colinéaires'] },
          { ref: '2.', command: 'Montrer', marks: 2,
            text: 'Montrer que le vecteur $\\vec{n}(3 ; 4 ; 5)$ est normal au plan $(ABC)$, puis en déduire une équation cartésienne de ce plan.',
            scheme: ['$\\vec{n} \\cdot \\vec{AB} = 6 + 4 - 10 = 0$ et $\\vec{n} \\cdot \\vec{AC} = -3 + 8 - 5 = 0$',
                     '$3x + 4y + 5z - 13 = 0$'] },
          { ref: '3.', command: 'Déterminer', marks: 2,
            text: 'Déterminer les coordonnées du point d’intersection de la droite $d$ et du plan $(ABC)$.',
            scheme: ['En remplaçant : $3(1 + t) + 8t + 5(2 - t) - 13 = 6t = 0$',
                     '$t = 0$ : le point est $(1 ; 0 ; 2)$, c’est-à-dire $A$'] },
        ],
      },
    ],
  });

  // ---- Diplôme national du brevet — mathématiques ------------------------

  PAPERS.push({
    id: 'brevet-math-sec-1',
    subject: 'mathematics',
    qual: ['brevet'],
    lang: 'fr',
    tex: true,
    kind: 'section',
    title: 'Trois exercices : pourcentages, Pythagore, probabilités',
    component: 'Épreuve de mathématiques, Troisième',
    instructions: 'La calculatrice est autorisée. Toutes les réponses doivent être justifiées.',
    minutes: 35,
    questions: [
      {
        n: 1, topic: 'arithmetic',
        stem: 'Un article coûte 45 €. Son prix augmente de 20 %, puis le nouveau prix baisse de 20 %.',
        parts: [
          { ref: '1.', command: 'Calculer', marks: 1,
            text: 'Calculer le prix de l’article après l’augmentation.',
            scheme: ['$45 \\times 1{,}2 = 54$ €'] },
          { ref: '2.', command: 'Calculer', marks: 1,
            text: 'Calculer le prix final de l’article.',
            scheme: ['$54 \\times 0{,}8 = 43{,}20$ €'] },
          { ref: '3.', command: 'Justifier', marks: 2,
            text: 'Paul affirme : « Le prix final est égal au prix de départ. » A-t-il raison ? Justifier.',
            scheme: ['Non : $43{,}20 \\neq 45$',
                     'Coefficient global $1{,}2 \\times 0{,}8 = 0{,}96$, soit une baisse de 4 %'] },
        ],
      },
      {
        n: 2, topic: 'geometry',
        stem: 'Une échelle de 5 m est appuyée contre un mur vertical. Son pied est posé sur le sol horizontal, à 1,4 m du mur.',
        parts: [
          { ref: '1.', command: 'Calculer', marks: 2,
            text: 'À quelle hauteur l’échelle touche-t-elle le mur ?',
            scheme: ['Le triangle est rectangle (mur perpendiculaire au sol) ; théorème de Pythagore : $h^2 = 5^2 - 1{,}4^2 = 23{,}04$',
                     '$h = \\sqrt{23{,}04} = 4{,}8$ m'] },
          { ref: '2.', command: 'Justifier', marks: 2,
            text: 'Pour être stable, l’angle entre l’échelle et le sol doit être compris entre 65° et 75°. L’échelle est-elle stable ?',
            scheme: ['$\\cos \\alpha = \\frac{1{,}4}{5} = 0{,}28$',
                     '$\\alpha \\approx 74°$, compris entre 65° et 75° : l’échelle est stable'] },
        ],
      },
      {
        n: 3, topic: 'probability',
        stem: 'Un sac contient 5 boules rouges, 3 boules vertes et 2 boules bleues, indiscernables au toucher. On tire une boule au hasard.',
        parts: [
          { ref: '1.', command: 'Calculer', marks: 1,
            text: 'Quelle est la probabilité de tirer une boule verte ?',
            scheme: ['$\\frac{3}{10}$'] },
          { ref: '2.', command: 'Calculer', marks: 1,
            text: 'Quelle est la probabilité de ne pas tirer une boule rouge ?',
            scheme: ['$\\frac{5}{10} = \\frac{1}{2}$'] },
          { ref: '3.', command: 'Déterminer', marks: 2,
            text: 'On ajoute $n$ boules vertes dans le sac. Combien faut-il en ajouter pour que la probabilité de tirer une boule verte soit égale à $\\frac{1}{2}$ ?',
            scheme: ['Équation $\\frac{3 + n}{10 + n} = \\frac{1}{2}$',
                     '$6 + 2n = 10 + n$, donc $n = 4$'],
            note: 'Accepter une recherche par essais successifs correctement justifiée.' },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'brevet-math-full-1',
    subject: 'mathematics',
    qual: ['brevet'],
    lang: 'fr',
    tex: true,
    kind: 'full',
    title: 'Sujet d’entraînement n° 1',
    component: 'Épreuve de mathématiques du brevet',
    instructions: 'Le sujet comporte cinq exercices indépendants. La calculatrice est autorisée. Toute réponse doit être justifiée ; une trace de recherche, même incomplète, sera prise en compte.',
    minutes: 120,
    questions: [
      {
        n: 1, topic: 'arithmetic',
        stem: 'Exercice 1.',
        parts: [
          { ref: '1.', command: 'Calculer', marks: 1,
            text: 'Calculer $\\frac{2}{3} + \\frac{5}{6}$ et donner le résultat sous forme de fraction irréductible.',
            scheme: ['$\\frac{4}{6} + \\frac{5}{6} = \\frac{9}{6} = \\frac{3}{2}$'] },
          { ref: '2.', command: 'Décomposer', marks: 1,
            text: 'Décomposer 252 en produit de facteurs premiers.',
            scheme: ['$252 = 2^2 \\times 3^2 \\times 7$'] },
          { ref: '3.', command: 'Déterminer', marks: 2,
            text: 'Un fleuriste dispose de 252 roses et 180 tulipes. Il veut réaliser le plus grand nombre possible de bouquets identiques en utilisant toutes ses fleurs. Combien de bouquets peut-il faire, et quelle est la composition de chacun ?',
            scheme: ['$180 = 2^2 \\times 3^2 \\times 5$, donc le plus grand diviseur commun est $36$',
                     '36 bouquets, chacun de 7 roses et 5 tulipes'] },
        ],
      },
      {
        n: 2, topic: 'quadratics',
        stem: 'Exercice 2. On considère les fonctions $f$ et $g$ définies par $f(x) = 3x - 2$ et $g(x) = -x + 6$.',
        parts: [
          { ref: '1.', command: 'Calculer', marks: 1,
            text: 'Calculer l’image de 4 par la fonction $f$.',
            scheme: ['$f(4) = 3 \\times 4 - 2 = 10$'] },
          { ref: '2.', command: 'Déterminer', marks: 1,
            text: 'Déterminer l’antécédent de 0 par la fonction $g$.',
            scheme: ['$-x + 6 = 0$, donc $x = 6$'] },
          { ref: '3.', command: 'Résoudre', marks: 2,
            text: 'Résoudre l’équation $f(x) = g(x)$. Que représente la solution pour les droites représentant $f$ et $g$ ?',
            scheme: ['$3x - 2 = -x + 6$, donc $4x = 8$ et $x = 2$',
                     'Les deux droites se coupent au point de coordonnées $(2 ; 4)$'] },
        ],
      },
      {
        n: 3, topic: 'geometry',
        stem: 'Exercice 3. Les droites $(BD)$ et $(CE)$ se coupent en $A$ ; les points $A$, $B$, $D$ sont alignés, ainsi que $A$, $C$, $E$, et les droites $(BC)$ et $(DE)$ sont parallèles. On donne $AB = 4$ cm, $AD = 10$ cm, $BC = 3$ cm et $AC = 5$ cm.',
        parts: [
          { ref: '1.', command: 'Calculer', marks: 2,
            text: 'Calculer la longueur $DE$.',
            scheme: ['Théorème de Thalès : $\\frac{AB}{AD} = \\frac{BC}{DE}$',
                     '$DE = \\frac{3 \\times 10}{4} = 7{,}5$ cm'] },
          { ref: '2.', command: 'Justifier', marks: 1,
            text: 'Le triangle $ABC$ est-il rectangle ? Justifier.',
            scheme: ['$AB^2 + BC^2 = 16 + 9 = 25 = AC^2$ : d’après la réciproque du théorème de Pythagore, $ABC$ est rectangle en $B$'] },
        ],
      },
      {
        n: 4, topic: 'statistics',
        stem: 'Exercice 4. Voici les notes obtenues par Léa aux sept contrôles du trimestre : 12 ; 15 ; 8 ; 14 ; 11 ; 16 ; 9.',
        parts: [
          { ref: '1.', command: 'Calculer', marks: 1,
            text: 'Calculer la moyenne de ces notes, arrondie au dixième.',
            scheme: ['$\\frac{85}{7} \\approx 12{,}1$'] },
          { ref: '2.', command: 'Déterminer', marks: 1,
            text: 'Déterminer la médiane de cette série.',
            scheme: ['Série rangée : 8 ; 9 ; 11 ; 12 ; 14 ; 15 ; 16 — médiane 12'] },
          { ref: '3.', command: 'Calculer', marks: 1,
            text: 'Calculer l’étendue de la série.',
            scheme: ['$16 - 8 = 8$'] },
          { ref: '4.', command: 'Déterminer', marks: 2,
            text: 'Quelle note Léa doit-elle obtenir au huitième contrôle pour que sa moyenne soit exactement 12,5 ?',
            scheme: ['Total nécessaire : $12{,}5 \\times 8 = 100$',
                     'Note : $100 - 85 = 15$'] },
        ],
      },
      {
        n: 5, topic: 'geometry',
        stem: 'Exercice 5. Un aquarium a la forme d’un pavé droit de dimensions intérieures 60 cm × 30 cm × 40 cm. On rappelle que 1 L = 1 dm³.',
        parts: [
          { ref: '1.', command: 'Calculer', marks: 1,
            text: 'Calculer le volume de l’aquarium, en litres.',
            scheme: ['$60 \\times 30 \\times 40 = 72\\,000$ cm³ $= 72$ L'] },
          { ref: '2.', command: 'Calculer', marks: 2,
            text: 'On le remplit aux trois quarts avec un robinet dont le débit est de 6 L par minute. Combien de temps faut-il ?',
            scheme: ['$\\frac{3}{4} \\times 72 = 54$ L',
                     '$54 \\div 6 = 9$ minutes'] },
        ],
      },
    ],
  });

  // ---- United States — high school Algebra II ----------------------------
  // What a student working towards their diploma actually sits: a course's
  // unit tests and its final, multiple choice then free response, graded A–F.

  PAPERS.push({
    id: 'us-alg2-sec-1',
    subject: 'mathematics',
    qual: ['us-diploma', 'ged'],
    kind: 'section',
    title: 'Unit test — quadratic and exponential functions',
    component: 'Algebra II',
    instructions: 'A graphing calculator is allowed. For free-response questions, show your work: an answer with no work earns at most one point.',
    minutes: 30,
    questions: [
      {
        n: 1, topic: 'quadratics',
        stem: 'Multiple choice. Write the letter of the correct answer.',
        parts: [
          { ref: '(a)', command: 'Choose', marks: 1,
            text: 'What is the vertex of y = (x − 3)² + 2?   A. (−3, 2)   B. (3, 2)   C. (3, −2)   D. (2, 3)',
            scheme: ['B. (3, 2)'] },
          { ref: '(b)', command: 'Choose', marks: 1,
            text: 'What are the solutions of x² − 5x + 6 = 0?   A. 2 and 3   B. −2 and −3   C. 1 and 6   D. −1 and 6',
            scheme: ['A. 2 and 3'] },
        ],
      },
      {
        n: 2, topic: 'quadratics',
        stem: 'A ball is thrown upward from a platform. Its height in feet after t seconds is h(t) = −16t² + 48t + 4.',
        parts: [
          { ref: '(a)', command: 'Find', marks: 2,
            text: 'Find the maximum height of the ball and when it is reached.',
            scheme: ['t = −b/(2a) = −48/(−32) = 1.5 seconds',
                     'h(1.5) = 40 feet'] },
          { ref: '(b)', command: 'Find', marks: 2,
            text: 'To the nearest hundredth of a second, when does the ball hit the ground?',
            scheme: ['Sets h(t) = 0 and uses the quadratic formula: t = (12 ± √160) / 8 (or equivalent)',
                     't ≈ 3.08 seconds, rejecting the negative root'] },
        ],
      },
      {
        n: 3, topic: 'exponentials',
        stem: 'A deposit of $2,000 earns 5% interest compounded once a year.',
        parts: [
          { ref: '(a)', command: 'Write', marks: 1,
            text: 'Write a function B(t) for the balance after t years.',
            scheme: ['B(t) = 2000(1.05)^t'] },
          { ref: '(b)', command: 'Find', marks: 1,
            text: 'Find the balance after 10 years, to the nearest cent.',
            scheme: ['$3,257.79'] },
          { ref: '(c)', command: 'Find', marks: 2,
            text: 'After how many full years will the balance first be more than $5,000?',
            scheme: ['1.05^t > 2.5, so t > log 2.5 / log 1.05 ≈ 18.8 (or a table of values)',
                     '19 years'] },
          { ref: '(d)', command: 'State', marks: 1,
            text: 'Is B(t) exponential growth or decay? State the growth or decay factor.',
            scheme: ['Growth, with factor 1.05'] },
        ],
      },
    ],
  });

  PAPERS.push({
    id: 'us-alg2-full-1',
    subject: 'mathematics',
    qual: ['us-diploma', 'ged'],
    kind: 'full',
    title: 'Final exam — practice',
    component: 'Algebra II',
    instructions: 'Part I is multiple choice; Part II is free response. A graphing calculator is allowed. Show your work on Part II.',
    minutes: 90,
    questions: [
      {
        n: 1, topic: 'quadratics',
        stem: 'Part I — multiple choice.',
        parts: [
          { ref: '(a)', command: 'Choose', marks: 1,
            text: 'Which is equivalent to (2x + 3)(x − 4)?   A. 2x² − 5x − 12   B. 2x² + 5x − 12   C. 2x² − 11x − 12   D. 2x² − 5x + 12',
            scheme: ['A. 2x² − 5x − 12'] },
          { ref: '(b)', command: 'Choose', marks: 1,
            text: 'Which is equivalent to √(−49)?   A. −7   B. 7i   C. −7i   D. 49i',
            scheme: ['B. 7i'] },
          { ref: '(c)', command: 'Choose', marks: 1,
            text: 'What is the discriminant of 2x² + 3x + 5 = 0?   A. 49   B. −31   C. 31   D. −49',
            scheme: ['B. −31'] },
          { ref: '(d)', command: 'Choose', marks: 1,
            text: 'If f(x) = 2x − 1 and g(x) = x², what is f(g(3))?   A. 25   B. 17   C. 18   D. 35',
            scheme: ['B. 17'] },
        ],
      },
      {
        n: 2, topic: 'exponentials',
        stem: 'Part I — multiple choice, continued.',
        parts: [
          { ref: '(a)', command: 'Choose', marks: 1,
            text: 'What is log₂ 32?   A. 4   B. 5   C. 16   D. 6',
            scheme: ['B. 5'] },
          { ref: '(b)', command: 'Choose', marks: 1,
            text: 'Solve 3^(x + 1) = 81.   A. 3   B. 4   C. 2   D. 27',
            scheme: ['A. 3'] },
        ],
      },
      {
        n: 3, topic: 'quadratics',
        stem: 'Part II — free response.',
        parts: [
          { ref: '', command: 'Solve', marks: 3,
            text: 'Solve x² + 4x − 21 = 0 by completing the square.',
            scheme: ['x² + 4x = 21',
                     '(x + 2)² = 25',
                     'x = 3 or x = −7'] },
        ],
      },
      {
        n: 4, topic: 'exponentials',
        stem: 'A town has 12,000 residents, and its population falls by 3% each year.',
        parts: [
          { ref: '(a)', command: 'Write', marks: 1,
            text: 'Write a function P(t) for the population after t years.',
            scheme: ['P(t) = 12000(0.97)^t'] },
          { ref: '(b)', command: 'Find', marks: 1,
            text: 'Find the population after 5 years, to the nearest person.',
            scheme: ['10,305'] },
          { ref: '(c)', command: 'Find', marks: 2,
            text: 'After how many full years will the population first be below 9,000?',
            scheme: ['0.97^t < 0.75, so t > log 0.75 / log 0.97 ≈ 9.4',
                     '10 years'] },
        ],
      },
      {
        n: 5, topic: 'trigonometry',
        stem: 'The unit circle.',
        parts: [
          { ref: '(a)', command: 'Convert', marks: 1,
            text: 'Convert 150° to radians, in terms of π.',
            scheme: ['5π/6'] },
          { ref: '(b)', command: 'Find', marks: 2,
            text: 'Find the exact values of sin(5π/6) and cos(5π/6).',
            scheme: ['sin(5π/6) = 1/2',
                     'cos(5π/6) = −√3/2'] },
        ],
      },
      {
        n: 6, topic: 'statistics',
        stem: 'Scores on a state test are normally distributed with mean 70 and standard deviation 8.',
        parts: [
          { ref: '(a)', command: 'Estimate', marks: 1,
            text: 'About what percent of students scored between 62 and 78?',
            scheme: ['About 68% (within one standard deviation of the mean)'] },
          { ref: '(b)', command: 'Find', marks: 1,
            text: 'How many standard deviations above the mean is a score of 86?',
            scheme: ['(86 − 70) / 8 = 2'] },
        ],
      },
    ],
  });

  // ---- GCSE mathematics, Higher tier ------------------------------------

  PAPERS.push({
    id: 'gcse-math-sec-higher-1',
    subject: 'mathematics',
    qual: ['gcse'],
    tex: true,
    kind: 'section',
    title: 'Algebra, number, trigonometry and probability',
    component: 'Higher tier, calculator',
    instructions: 'You may use a calculator. Show your working: marks may be given for a correct method even if the answer is wrong.',
    minutes: 30,
    questions: [
      {
        n: 1, topic: 'quadratics',
        parts: [
          { ref: '(a)', command: 'Solve', marks: 2,
            text: 'Solve $x^2 - 2x - 15 = 0$.',
            scheme: ['M1 — $(x - 5)(x + 3) = 0$',
                     'A1 — $x = 5$ or $x = -3$'] },
          { ref: '(b)', command: 'Solve', marks: 3,
            text: 'Solve the simultaneous equations $3x + 2y = 12$ and $x - y = -1$.',
            scheme: ['M1 — eliminates one variable, e.g. $2(x - y) = -2$ added to the first equation: $5x = 10$',
                     'A1 — $x = 2$',
                     'A1 — $y = 3$'] },
        ],
      },
      {
        n: 2, topic: 'arithmetic',
        parts: [
          { ref: '(a)', command: 'Write', marks: 2,
            text: 'Write $0.\\dot{3}\\dot{6}$ as a fraction in its simplest form.',
            scheme: ['M1 — $100x - x = 36$ (or equivalent)',
                     'A1 — $\\frac{4}{11}$'] },
          { ref: '(b)', command: 'Work out', marks: 2,
            text: 'Work out $(2.4 \\times 10^5) \\times (5 \\times 10^{-2})$. Give your answer in standard form.',
            scheme: ['M1 — $12 \\times 10^3$ seen',
                     'A1 — $1.2 \\times 10^4$'] },
          { ref: '(c)', command: 'Evaluate', marks: 2,
            text: 'Evaluate $8^{\\frac{2}{3}}$ and $27^{-\\frac{1}{3}}$.',
            scheme: ['B1 — $8^{\\frac{2}{3}} = 4$',
                     'B1 — $27^{-\\frac{1}{3}} = \\frac{1}{3}$'] },
        ],
      },
      {
        n: 3, topic: 'geometry',
        stem: 'Triangle $ABC$ has a right angle at $B$. $AB = 7$ cm and angle $BAC = 35°$.',
        parts: [
          { ref: '', command: 'Calculate', marks: 3,
            text: 'Calculate the length of $BC$. Give your answer to 1 decimal place.',
            scheme: ['M1 — $\\tan 35° = \\frac{BC}{7}$',
                     'M1 — $BC = 7\\tan 35°$',
                     'A1 — $4.9$ cm'] },
        ],
      },
      {
        n: 4, topic: 'probability',
        stem: 'A bag contains 4 red counters and 6 blue counters. Two counters are taken at random, without replacement.',
        parts: [
          { ref: '', command: 'Work out', marks: 3,
            text: 'Work out the probability that both counters are the same colour.',
            scheme: ['M1 — $\\frac{4}{10} \\times \\frac{3}{9}$ or $\\frac{6}{10} \\times \\frac{5}{9}$',
                     'M1 — adds the two products',
                     'A1 — $\\frac{42}{90} = \\frac{7}{15}$'] },
        ],
      },
    ],
  });

  var EXERCISES = {
    'atomic-structure': [
      'Write out the full electronic configuration of every element from H to Kr from memory, then check the two that break the pattern — chromium and copper.',
      'Sketch successive ionisation energies for an element in Period 3 and mark where the jumps fall. The jump locations are the marks; the curve is not.',
      'Write the three sentences that explain an ionisation energy trend — nuclear charge, shielding and distance, then the conclusion — and reuse that structure every time.',
    ],
    'bonding': [
      'Draw the eight shapes on the syllabus with their bond angles, then cover the angles and redo them. Linear, trigonal planar, tetrahedral, trigonal pyramidal, bent, trigonal bipyramidal, see-saw, octahedral.',
      'For five molecules, write out the full lone-pair reasoning for the bond angle. The mark is for "a lone pair repels more than a bonding pair", not for the number.',
      'Practise the hydrogen bonding answer until you never write that hydrogen bonds break within the molecule — the commonest way to lose two marks on a boiling point question.',
    ],
    'moles': [
      'Do five titration calculations end to end, writing the mole ratio from the equation as a separate line every time.',
      'Work three water-of-crystallisation problems and check each answer is a whole number. If it is not, you have divided the wrong way round.',
      'Take one calculation you got wrong and redo it writing units on every line. Most lost marks here are a volume in cm³ used as dm³.',
    ],
    'energetics': [
      'Build three Hess cycles from enthalpies of combustion, drawing the arrows before putting any numbers in.',
      'Do four mcΔT calculations where the two solutions are mixed, and use the combined mass every time. Using only one volume is the standard error.',
      'Write the explanation for why an experimental enthalpy is less exothermic than the data book value, in two marked points.',
    ],
    'equilibria': [
      'For five equilibria, state and explain the effect of temperature, pressure and concentration. Say which way and why, in that order.',
      'Draw the Boltzmann distribution twice, once for a temperature rise and once for a catalyst, and write the three-mark explanation under each.',
      'Write four Kc expressions with their units. The units are a mark on their own and are the part most often left out.',
    ],
    'functional-groups': [
      'Draw the syllabus functional groups from memory, then write the reagent, condition and observation for the test that identifies each.',
      'Take five molecules with two functional groups and predict what excess acidified dichromate does to each group separately.',
      'Do a round of deduction questions — given three test results, name the compound. This is the question type that rewards knowing the tests cold.',
    ],
    'mechanisms': [
      'Draw Sn1 and Sn2 side by side for the same halogenoalkane and label every curly arrow with where it starts and where it ends.',
      'Check ten curly arrows you have drawn: each must start at a bond or a lone pair, never at an atom. This single habit is worth marks on every mechanism question.',
      'Write the carbocation stability argument once, properly, then reuse it — primary against tertiary is the reason behind most "why this mechanism" questions.',
    ],
    'vectors': [
      'Do five scalar product questions and state whether the angle is acute or obtuse before calculating it. The sign tells you, and it catches the standard error.',
      'Practise angle-at-a-point questions where both vectors must start from the same point. Using BA instead of AB gives the supplement and loses the answer mark.',
      'Work three questions on magnitudes and unit vectors, leaving answers in surd form until the last line.',
    ],
    'matrices': [
      'Invert six 2×2 matrices, swapping the leading diagonal and negating the off-diagonal. Getting these the wrong way round is the commonest lost mark.',
      'Solve three simultaneous systems by the inverse method specifically, even where elimination would be faster — when a question names the method, the method is the marks.',
      'Write down the matrices for rotation, reflection and enlargement, then practise composites. Remember the second transformation goes on the left.',
    ],
    'differentiation': [
      'Do ten chain, product and quotient rule differentiations mixed together, so you have to choose the rule rather than being told it.',
      'Work five stationary point questions all the way to the nature of each point. The second derivative test is a mark and is the one most often skipped.',
      'Do three optimisation questions where you must derive the formula first. Getting to the single-variable expression is where most of the marks are.',
    ],
    'integration': [
      'Integrate ten expressions and write "+ c" every time. It is a free accuracy mark and it is routinely dropped.',
      'Do four area questions between a curve and a line, writing "upper minus lower" before integrating. The wrong order gives a negative area.',
      'Work three volume of revolution questions, squaring y before integrating rather than after.',
    ],
    'quadratics': [
      'Complete the square on eight quadratics, including four where the coefficient of x² is not 1.',
      'For five completed squares, state the vertex, the range and the line of symmetry straight from the form.',
      'Practise the one-one argument for inverses — the least value of k is always the x-coordinate of the vertex, and the explanation is the second mark.',
    ],
    'trigonometry': [
      'Solve eight trigonometric equations over a full interval, listing every solution including those at the ends. Lost end solutions are the standard error.',
      'Use the identity sin²x + cos²x = 1 to reduce five mixed equations to one function before solving.',
      'Sketch y = a sin(bx) and y = a cos(bx) for four different a and b, stating amplitude and period each time.',
    ],
    'elasticity': [
      'Calculate PED, PES, YED and XED from five data sets, and write what each value means in words rather than just stating the number.',
      'For three goods, explain why demand is elastic or inelastic using substitutes, necessity and proportion of income.',
      'Work out what happens to a firm’s revenue and to tax revenue when price rises, for an elastic and an inelastic good. Which way revenue moves is the whole point of elasticity.',
    ],
    'market-failure': [
      'Draw the negative externality diagram for production and for consumption separately, and label the welfare loss on each. The two are different and questions specify which.',
      'For three market failures, name an intervention and then name the government failure it risks. Evaluation marks live in the second half.',
      'Write a 12-mark plan on whether intervention corrects market failure, with two forms of intervention and three specific sources of government failure.',
    ],
    'ad-as': [
      'Draw AD/AS with spare capacity and at full capacity, and shift AD right on both. The different outcome is the answer to most AD questions.',
      'List the components of AD and, for each, two things that shift it. Then check you can tell a shift from a movement along.',
      'Write the evaluation sentence for "will an AD increase cause inflation" — it depends on capacity, the size of the increase and the time period.',
    ],
    'macro-policy': [
      'Write the full transmission mechanism for an interest rate change, in four linked steps from the rate to the price level.',
      'For fiscal and monetary policy, list three limitations each, with a developed reason rather than a label.',
      'Match each type of unemployment to the policy that addresses it. Demand-side policy does nothing for structural unemployment, and noticing that is what lifts a policy essay a level.',
    ],
    'inflation': [
      'Draw demand-pull and cost-push inflation on AD/AS diagrams and note what happens to real output in each. That contrast is the distinction.',
      'Explain three costs of inflation and two costs of deflation, with a reason each rather than a list.',
      'Practise the difference between a fall in inflation and a fall in the price level. Confusing the two is a reliable way to lose marks.',
    ],
    'trade': [
      'Write out the four components of the current account and what each records.',
      'Argue both sides of whether a current account deficit matters, distinguishing the cause of the deficit from its size.',
      'Trace what a depreciation does to the current account, including why the effect is slow. The J-curve is worth knowing by name.',
    ],
    'measurement': [
      'Write out the seven SI base units and derive the units of force, pressure, energy and power from them. Deriving beats memorising, and it is the mark.',
      'Check five equations for homogeneity. An equation can be homogeneous and still wrong, and knowing why is worth a mark on its own.',
      'Combine uncertainties for five quantities: add absolute uncertainties when adding, add percentage uncertainties when multiplying or dividing, multiply by the power when raising to one.',
    ],
    'kinematics': [
      'Do ten suvat problems writing out u, v, a, s and t as a list before picking an equation. Choosing the right equation is most of the method mark.',
      'Sketch displacement–time and velocity–time graphs for the same motion and label what the gradient and the area mean on each.',
      'Work five projectile questions treating the horizontal and vertical motions separately. Mixing them is the standard way to lose every mark on the question.',
    ],
    'dynamics': [
      'State Newton’s second law as rate of change of momentum, not as F = ma, and use it on three problems where mass changes.',
      'Do five collision questions, writing the momentum conservation equation before any numbers, and say each time whether kinetic energy is conserved.',
      'Draw free-body diagrams for five situations. Every force needs a named agent — if you cannot say what is pushing, the arrow should not be there.',
    ],
    'forces': [
      'Resolve forces for five equilibrium problems and write both equations: horizontal and vertical components balanced, and moments balanced.',
      'Take moments about three different points in the same problem and confirm you get the same answer. Choosing the point that eliminates an unknown is the skill.',
      'Work three upthrust and pressure problems from first principles with p = hρg rather than from a remembered result.',
    ],
    'energy': [
      'Do five problems converting between gravitational potential energy and kinetic energy, stating where energy is lost and to what.',
      'Practise the work–energy relationship on three problems where a force acts at an angle, remembering the cosine.',
      'Calculate efficiency and wasted power for three machines, and give the answer as a percentage with the energy input clearly identified.',
    ],
    'waves': [
      'For five waves, state frequency, wavelength, amplitude, period and speed, and check v = fλ each time.',
      'Draw the superposition of two waves for constructive and destructive interference, and write the path difference condition for each.',
      'Work three double-slit and three diffraction grating problems. Getting the right equation for the right set-up is where the marks are.',
    ],
    'electricity': [
      'Do five charge, current and time calculations, converting minutes to seconds every time. That conversion is the commonest dropped mark here.',
      'Work three resistivity problems and convert the area to m² before substituting. A cross-section in mm² is a factor of a million out.',
      'Sketch the I–V characteristics of an ohmic conductor, a filament lamp and a diode, and explain the shape of each.',
    ],
    'dc-circuits': [
      'Practise combining resistors in series and parallel until you can do a mixed network without writing a diagram.',
      'Do five potential divider problems, including one with a thermistor or LDR, and say which way the output moves as conditions change.',
      'Work three e.m.f. and internal resistance problems using E = I(R + r), and explain why terminal p.d. falls as current rises.',
    ],
    'cell-structure': [
      'Draw and label a prokaryotic and a eukaryotic cell side by side, then list every difference. The comparison is what questions ask for.',
      'For ten organelles, write the structure and the function in one line each. Questions ask you to link the two, not to recite one.',
      'Do five magnification calculations with the formula actual size = image size / magnification, converting mm to μm before you start.',
    ],
    'biological-molecules': [
      'Draw the condensation reaction forming a glycosidic, peptide and ester bond, and the hydrolysis that reverses each.',
      'Compare starch, glycogen and cellulose on structure and function, linking each property to the bond arrangement.',
      'Write the four levels of protein structure with the bonds that hold each one, then say which are broken by heat.',
    ],
    'enzymes': [
      'Explain the effect of temperature, pH and substrate concentration on rate, each in terms of collisions, active site shape and saturation.',
      'Draw rate graphs for competitive and non-competitive inhibition and write what happens to Vmax and Km on each.',
      'Practise the denaturation answer until it names the bonds — hydrogen and ionic in the tertiary structure — rather than saying the enzyme "dies".',
    ],
    'cell-membranes': [
      'Draw the fluid mosaic model labelled with every component, and give each one a function.',
      'Compare simple diffusion, facilitated diffusion, osmosis and active transport on four criteria: direction, proteins, energy and selectivity.',
      'Do three water potential problems and get the signs right. Water moves from less negative to more negative, and sign errors are the usual loss.',
    ],
    'mitosis': [
      'Draw the four stages of mitosis in order and state what happens to the chromosomes in each.',
      'Explain the significance of mitosis for growth, repair and asexual reproduction, and say why the daughter cells are genetically identical.',
      'Write the difference between a chromosome, a chromatid and a homologous pair. Confusing these costs marks across the whole topic.',
    ],
    'nucleic-acids': [
      'Draw a nucleotide and then a short stretch of double-stranded DNA, labelling the phosphodiester and hydrogen bonds.',
      'Write out transcription and translation as numbered steps, naming every molecule involved including each type of RNA.',
      'Explain semi-conservative replication and the evidence for it. Saying what the alternative model would have predicted is what earns the top mark.',
    ],
    'transport-plants': [
      'Trace the path of water from soil to leaf, naming every tissue and both routes through the root.',
      'Explain transpiration pull in terms of cohesion, adhesion and tension, and say why the column does not break.',
      'Compare xylem and phloem on structure, contents, direction of flow and whether energy is required.',
    ],
    'gas-exchange': [
      'List the features of an efficient gas exchange surface and point to where each one is found in the lung.',
      'Draw the path of air from trachea to alveolus, naming the tissues and what each contributes.',
      'Explain how the alveolar structure maintains a steep diffusion gradient, referring to Fick’s law.',
    ],
    'infectious-disease': [
      'For four named diseases, write the pathogen, the method of transmission and one method of control.',
      'Explain the difference between the primary and secondary immune response, and why the second is faster and larger.',
      'Compare active and passive immunity, and natural and artificial, with one example in each of the four boxes.',
    ],
    'vienna': [
      'Draw the 1815 map from memory and mark the five main territorial changes. Precise territory is what separates a Level 2 answer from a Level 4.',
      'Write a criterion for success before you argue about the settlement — against its own aims, or against the forces it ignored. Setting up the criterion is the top-level skill.',
      'Make a two-column table of successes to 1848 and failures to 1848, with a date and a place in every cell.',
    ],
    'revolutions-1848': [
      'List five causes of the 1848 revolutions and rank them, then write one paragraph defending your ranking. Prioritisation is the Level 5 discriminator.',
      'Write the explanation for why the Frankfurt Parliament failed, leading with the fact that it had no army and no revenue.',
      'For three countries, note what the revolution achieved and what was reversed. Specificity about outcomes is where the marks are.',
    ],
    'unification': [
      'Build a timeline of 1859–1871 for Italy and Germany side by side, with the wars, treaties and plebiscites dated.',
      'Practise the argument that two named factors interacted rather than competed. Questions here routinely set up a false opposition, and saying so is worth a level.',
      'Write an opening paragraph that states your judgement before the evidence. Examiners reward a sustained argument, and sustaining one means starting it.',
    ],
    'ww1-origins': [
      'Separate long-term causes from the July crisis and write one paragraph on how the two connect.',
      'For three powers, state what they wanted and what they feared in 1914.',
      'Practise weighing a named factor against "the alliance system" without narrating the month of July.',
    ],
    'source-analysis': [
      'Take any two sources and write five comparisons, each quoting from both. Describing the sources one after the other is the commonest way to cap an answer at Level 2.',
      'For five sources, write one sentence on provenance that changes how you read the content. Who wrote it, to whom, and when, and therefore what they would emphasise.',
      'Practise answering a source question using only the sources, then again adding own knowledge. Knowing which the question wants is half the mark.',
    ],
    'sequences': [
      'For six recurrence relations, compute the first four terms by hand, then say whether the sequence looks increasing, decreasing or neither before proving it.',
      'Write out three full proofs by induction — initialisation, heredity, conclusion — and check each heredity step uses the hypothesis exactly once.',
      'For four sequences of the form u(n+1) = a·u(n) + b, find the fixed point and show that u(n) minus it is geometric.',
    ],
    'exponentials': [
      'Solve eight equations and inequalities with e and ln, taking logs of both sides and checking the domain each time.',
      'Learn the five laws of logarithms and use each one twice on simplification questions.',
      'For three growth or decay situations, write the model, then find when it first passes a given value — both with logs and with a table of values.',
    ],
    'probability': [
      'Draw tree diagrams for four two-stage situations, labelling every branch, and check each set of branches adds to 1.',
      'Do six conditional probability questions, writing the event you are conditioning on before you calculate.',
      'For three binomial situations, justify the model in one sentence (independent, identical trials), then find P(X = k) and P(X ≥ k).',
    ],
    'geometry': [
      'Work through eight right-angled triangle questions, choosing Pythagoras or sine, cosine or tangent and saying why before you calculate.',
      'Do four Thales (intercept theorem / similar triangles) questions, writing the equal ratios out in full before substituting.',
      'Practise unit conversions for area and volume — cm³ to litres, m² to cm² — until you can do them without a calculator.',
    ],
    'arithmetic': [
      'Do ten percentage change questions using multipliers, including two successive changes and one reverse percentage.',
      'Practise fraction arithmetic and prime factorisation, then use it for highest common factor and lowest common multiple word problems.',
      'Convert six recurring decimals to fractions and six numbers to standard form, and multiply two in standard form each time.',
    ],
    'statistics': [
      'For five small data sets, find the mean, median, mode and range, then say which average best describes each and why.',
      'Practise "what score is needed for a mean of …" questions: work from the total, not the mean.',
      'For the normal distribution, learn the 68–95–99.7 rule and use it on six questions about percentages within 1, 2 and 3 standard deviations.',
    ],
  };

  /* Words that suggest a notebook chapter covers a topic.
   *
   * Used to put "revisit this chapter" next to an exercise, so the student is
   * sent back to their own notes rather than only to a task list. Matched case
   * insensitively against chapter titles, so a hint only has to be a stem —
   * 'bond' catches "Bonding & Molecular Geometry" and "Bond enthalpies". */
  var TOPIC_HINTS = {
    'atomic-structure': ['atom', 'electron', 'shell', 'ionisation', 'ionization', 'periodic'],
    'bonding':          ['bond', 'molecul', 'geometry', 'vsepr', 'shape', 'intermolecular'],
    'moles':            ['mole', 'stoichiometry', 'titration', 'formula', 'equation'],
    'energetics':       ['energet', 'enthalpy', 'thermo', 'hess', 'calorimet'],
    'equilibria':       ['equilibr', 'rate', 'kinetic', 'catalys', 'le chatelier'],
    'functional-groups':['functional', 'alcohol', 'carbonyl', 'aldehyde', 'ketone', 'carboxyl', 'organic'],
    'mechanisms':       ['mechanis', 'nucleophil', 'electrophil', 'substitution', 'addition', 'reaction'],
    'vectors':          ['vector', 'scalar', 'dot product', 'cross product'],
    'matrices':         ['matri', 'determinant', 'eigen', 'transformation', 'linear'],
    'differentiation':  ['differentiat', 'derivative', 'gradient', 'tangent', 'stationary'],
    'integration':      ['integrat', 'area under', 'volume of revolution'],
    'quadratics':       ['quadratic', 'function', 'complete the square', 'inverse'],
    'trigonometry':     ['trig', 'sine', 'cosine', 'radian', 'identit'],
    'elasticity':       ['elastic', 'demand', 'supply', 'price'],
    'market-failure':   ['market failure', 'externalit', 'public good', 'intervention', 'merit good'],
    'ad-as':            ['aggregate', 'ad/as', 'national income', 'output', 'circular flow'],
    'macro-policy':     ['polic', 'fiscal', 'monetary', 'interest rate', 'central bank'],
    'inflation':        ['inflation', 'unemploy', 'phillips', 'price level', 'deflation'],
    'trade':            ['trade', 'balance of payments', 'current account', 'exchange rate', 'tariff'],
    'measurement':      ['unit', 'quantit', 'uncertaint', 'measur', 'si base', 'precision'],
    'kinematics':       ['kinematic', 'motion', 'velocit', 'acceler', 'projectile', 'suvat'],
    'dynamics':         ['dynamic', 'newton', 'momentum', 'collision', 'force and motion'],
    'forces':           ['force', 'moment', 'equilibri', 'pressure', 'densit', 'upthrust'],
    'energy':           ['energy', 'work', 'power', 'efficien', 'kinetic', 'potential'],
    'waves':            ['wave', 'superposition', 'interferenc', 'diffract', 'stationary', 'sound', 'light'],
    'electricity':      ['electric', 'current', 'charge', 'resistiv', 'ohm', 'potential difference'],
    'dc-circuits':      ['circuit', 'kirchhoff', 'resistor', 'potential divider', 'e.m.f', 'emf', 'internal resistance'],
    'cell-structure':   ['cell structure', 'organelle', 'prokaryot', 'eukaryot', 'microscop', 'magnification'],
    'biological-molecules': ['biological molecule', 'carbohydrate', 'protein', 'lipid', 'water', 'polymer'],
    'enzymes':          ['enzyme', 'active site', 'inhibit', 'catalys', 'denatur'],
    'cell-membranes':   ['membrane', 'osmosis', 'diffusion', 'active transport', 'water potential', 'fluid mosaic'],
    'mitosis':          ['mitosis', 'cell cycle', 'chromosom', 'nuclear division', 'replication of cells'],
    'nucleic-acids':    ['dna', 'rna', 'nucleic', 'protein synthesis', 'transcription', 'translation', 'gene'],
    'transport-plants': ['transport in plant', 'xylem', 'phloem', 'transpiration', 'translocation', 'root'],
    'gas-exchange':     ['gas exchange', 'lung', 'alveol', 'breathing', 'respiratory'],
    'infectious-disease': ['disease', 'patho', 'immun', 'antibod', 'vaccin', 'antibiotic', 'infection'],
    'vienna':           ['vienna', 'congress', 'metternich', 'balance of power', '1815', 'settlement'],
    'revolutions-1848': ['1848', 'revolution', 'frankfurt', 'liberal'],
    'unification':      ['unification', 'bismarck', 'cavour', 'garibaldi', 'italy', 'german', 'prussia'],
    'ww1-origins':      ['first world war', 'ww1', 'july crisis', 'alliance', '1914'],
    'source-analysis':  ['source', 'document', 'historiograph', 'evidence'],
    'sequences':        ['sequence', 'suite', 'series', 'recurren', 'induction', 'récurrence'],
    'exponentials':     ['exponent', 'logarithm', 'growth', 'decay', 'logarithme'],
    'probability':      ['probab', 'chance', 'binomial', 'random'],
    'geometry':         ['geometr', 'géométr', 'pythag', 'thalès', 'thales', 'triangle', 'volume', 'area', 'aire'],
    'arithmetic':       ['number', 'nombre', 'fraction', 'percent', 'pourcentage', 'arithmeti', 'calcul'],
    'statistics':       ['statisti', 'mean', 'median', 'moyenne', 'médiane', 'data'],
  };

  /* -----------------------------------------------------------------------
     Load-time checks.

     A paper is data, and data that is slightly wrong about itself is worse
     than data that is missing: a paper whose parts add to 58 while it claims
     60 silently gives every student who sits it the wrong percentage, and
     nothing anywhere complains. So totals are derived here rather than
     written down — twice during the writing of this file a declared total
     drifted from the parts, which is the whole argument for computing it.

     The remaining invariants cannot be derived, so they are asserted and
     reported to the console. They are warnings rather than throws on purpose:
     a malformed mark scheme should not stop a student sitting the paper.
     ----------------------------------------------------------------------- */
  function verifyBank() {
    var problems = [];
    PAPERS.forEach(function (paper) {
      var total = 0;
      if (!SUBJECTS[paper.subject]) problems.push(paper.id + ': unknown subject ' + paper.subject);
      paper.questions.forEach(function (q) {
        if (!TOPICS[q.topic]) problems.push(paper.id + ' Q' + q.n + ': unknown topic "' + q.topic + '"');
        q.parts.forEach(function (part) {
          total += part.marks;
          var pointMarked = Array.isArray(part.scheme);
          var levelMarked = Array.isArray(part.levels);
          if (pointMarked === levelMarked) {
            problems.push(paper.id + ' Q' + q.n + part.ref + ': needs exactly one of scheme or levels');
          } else if (pointMarked && part.scheme.length !== part.marks) {
            // One line per available mark is the contract self-marking relies
            // on: a student awarding 2 of 3 has to point at the point missed.
            problems.push(paper.id + ' Q' + q.n + part.ref + ': ' + part.marks +
                          ' marks but ' + part.scheme.length + ' scheme lines');
          }
        });
      });
      paper.marks = total;
    });
    Object.keys(TOPICS).forEach(function (id) {
      if (!EXERCISES[id]) problems.push('topic "' + id + '" has no exercises');
    });
    if (problems.length && window.console && console.warn) {
      console.warn('exam-bank: ' + problems.length + ' problem(s)\n  ' + problems.join('\n  '));
    }
    return problems;
  }

  var problems = verifyBank();

  /* Which lesson teaches a topic.
   *
   * The payoff of sharing subject keys with lessons.js: a student who loses
   * marks on moles can be sent to the lesson on moles rather than only to a
   * list of exercises. The bank there is one lesson per subject today, so most
   * topics have none and the surface falls back to the exercises above — which
   * is why this is a sparse map and not a required field. */
  var TOPIC_LESSON = {
    'moles': 'chem-moles-titration',
    'quadratics': 'math-quadratics',
    'elasticity': 'econ-ped',
    'kinematics': 'phys-kinematics',
    'enzymes': 'bio-enzymes',
  };

  /* Resolve a notebook to a subject.
   *
   * lessons.js first, so the two features can never disagree about what a
   * notebook is, then this file's own table for history. Wrapped because
   * lessons.js is loaded from <head> and a page that fails to load it should
   * lose lesson links, not papers. */
  function resolveSubject(slug, title) {
    var key = null;
    try {
      if (window.notivloLessons && window.notivloLessons.subjectFor) {
        key = window.notivloLessons.subjectFor(slug, title);
      }
    } catch (e) { key = null; }
    if (key && SUBJECTS[key]) return key;

    var s = String(slug || '').toLowerCase();
    if (OWN_ALIASES[s]) return OWN_ALIASES[s];
    var t = String(title || '');
    for (var i = 0; i < OWN_TITLE_WORDS.length; i++) {
      if (OWN_TITLE_WORDS[i][0].test(t) || OWN_TITLE_WORDS[i][1] === s) return OWN_TITLE_WORDS[i][1];
    }
    return null;
  }

  /* The exams whose papers are the A level ones above: asking for any of
   * them is asking for the default set. */
  var A_LEVEL_LIKE = ['a-level', 'as-level', 'sg-a'];

  function currentQualId() {
    try {
      var q = window.notivloSchool && window.notivloSchool.qualification && window.notivloSchool.qualification();
      return q ? q.id : '';
    } catch (e) { return ''; }
  }

  window.notivloExamBank = {
    currentQualId: currentQualId,
    SUBJECTS: SUBJECTS,
    TOPIC_LESSON: TOPIC_LESSON,
    TOPICS: TOPICS,
    TOPIC_HINTS: TOPIC_HINTS,
    BOUNDARIES: BOUNDARIES,
    EXERCISES: EXERCISES,
    PAPERS: PAPERS,
    problems: problems,

    // --- lookups the page uses ------------------------------------------

    subjectKeyFor: resolveSubject,

    subjectForSlug: function (slug, title) {
      var key = resolveSubject(slug, title);
      if (!key) return null;
      var subj = SUBJECTS[key];
      return subj ? { key: key, name: subj.name, board: subj.board, code: subj.code } : null;
    },

    /* Which papers a student gets, given the exam they are working towards.
     *
     * For each kind — sections and full mocks — the papers written for their
     * exam if there are any, otherwise the A level ones. So a bac student
     * sits bac papers in Mathematics and A level papers in Chemistry, and a
     * GCSE student with a section paper but no GCSE mock yet still gets a
     * mock. `native` says whether the student's own exam has papers here at
     * all, so the page can say so honestly when it does not.
     *
     * `qualId` defaults to the student's own (school-level.js); with none, or
     * with an exam whose papers are the A level ones anyway, this is the A
     * level set the app always had. */
    paperSetFor: function (slug, title, qualId) {
      var key = resolveSubject(slug, title);
      var qid = qualId === undefined ? currentQualId() : (qualId || '');
      var out = { papers: [], native: false, qual: qid, nativeKinds: {} };
      if (!key) return out;
      var order = {};
      PAPERS.forEach(function (p, i) { order[p.id] = i; });
      var mine = PAPERS.filter(function (p) { return p.subject === key; });
      var aLevel = mine.filter(function (p) { return !p.qual; });
      var forQual = qid && A_LEVEL_LIKE.indexOf(qid) === -1
        ? mine.filter(function (p) { return p.qual && p.qual.indexOf(qid) !== -1; })
        : [];
      var picked = [];
      ['section', 'full'].forEach(function (kind) {
        var own = forQual.filter(function (p) { return p.kind === kind; });
        if (own.length) out.nativeKinds[kind] = true;
        picked = picked.concat(own.length ? own : aLevel.filter(function (p) { return p.kind === kind; }));
      });
      out.native = forQual.length > 0 || !qid || A_LEVEL_LIKE.indexOf(qid) !== -1;
      out.papers = picked.sort(function (a, b) {
        if (a.kind !== b.kind) return a.kind === 'section' ? -1 : 1;
        return order[a.id] - order[b.id];
      });
      return out;
    },

    /* Sections first, then the mocks: the order the picker shows them in, and
     * the order a student is likely to want them.
     *
     * Within a kind the order is the order they are written above, not
     * alphabetical. That matters because nextMock() offers the first unsat
     * paper, and sorting by title made that an accident of wording — a
     * student who had sat nothing was handed the second Chemistry mock purely
     * because "calculations" precedes "structured". Declaration order puts
     * that back in the hands of whoever writes the papers. */
    papersForSlug: function (slug, title, qualId) {
      return this.paperSetFor(slug, title, qualId).papers;
    },

    // The exam a paper was written for, as school-level.js describes it, or
    // null for the A level papers.
    paperQual: function (paper) {
      if (!paper || !paper.qual || !paper.qual.length) return null;
      var school = window.notivloSchool;
      var mine = currentQualId();
      var id = paper.qual.indexOf(mine) !== -1 ? mine : paper.qual[0];
      try { return school && school.qualById ? school.qualById(id) : null; } catch (e) { return null; }
    },

    /* Which mock to offer when one falls due.
     *
     * There is more than one full paper per subject, and offering the same one
     * every month would turn the mock into a memory test — the second sitting
     * would measure how well the student remembered their own marked answers.
     * So: anything never sat comes first, and after that the one sat longest
     * ago. With two papers and a monthly cadence that alternates; the moment a
     * third is written it falls into the rotation with no further change here.
     *
     * `results` is the notebook's own history, newest first, which is the
     * order exam-session.js stores it in. */
    nextMock: function (slug, title, results) {
      var fulls = this.papersForSlug(slug, title).filter(function (p) { return p.kind === 'full'; });
      if (!fulls.length) return null;

      var lastSat = {};
      (results || []).forEach(function (r) {
        if (r && r.paperId && !lastSat[r.paperId]) lastSat[r.paperId] = String(r.when || '');
      });

      var never = fulls.filter(function (p) { return !lastSat[p.id]; });
      if (never.length) return never[0];

      return fulls.slice().sort(function (a, b) {
        return lastSat[a.id].localeCompare(lastSat[b.id]);
      })[0];
    },

    // The lesson that teaches a topic, if there is one.
    lessonForTopic: function (topicId) {
      var id = TOPIC_LESSON[topicId];
      if (!id) return null;
      try {
        var lesson = window.notivloLessons && window.notivloLessons.byId && window.notivloLessons.byId(id);
        return lesson || null;
      } catch (e) { return null; }
    },

    paperById: function (id) {
      for (var i = 0; i < PAPERS.length; i++) if (PAPERS[i].id === id) return PAPERS[i];
      return null;
    },

    topicLabel: function (id) { return TOPICS[id] || id; },

    exercisesFor: function (topicId) { return EXERCISES[topicId] || []; },

    // Which of a notebook's own chapters look like they cover a topic.
    // Returns [{ idx, title }] so the surface can link straight to one.
    chaptersFor: function (topicId, chapters) {
      var hints = TOPIC_HINTS[topicId] || [];
      var out = [];
      (chapters || []).forEach(function (c, idx) {
        var title = String((c && c.title) || '').toLowerCase();
        if (!title) return;
        for (var i = 0; i < hints.length; i++) {
          if (title.indexOf(hints[i]) >= 0) { out.push({ idx: idx, title: c.title }); return; }
        }
      });
      return out;
    },

    // Indicative only, and the surface says so where it is shown. Reported on
    // the scale of the student's own exam — /20 with a mention for the bac,
    // 9–1 for GCSE, A–F for a US course — and on the A level boundaries above
    // when they have not said, or school-level.js is not on the page.
    gradeFor: function (earned, total, qualId) {
      if (!total) return { grade: '—', pct: 0 };
      var pct = (earned / total) * 100;
      var school = window.notivloSchool;
      var qid = qualId === undefined ? currentQualId() : qualId;
      var qual = null;
      try { qual = school && school.qualById ? school.qualById(qid) : null; } catch (e) { qual = null; }
      if (qual && school.markOn) {
        var r = school.markOn(qual.scale, pct);
        return { grade: r.text, pct: pct, scale: qual.scale, qual: qual.id, passed: r.passed };
      }
      for (var i = 0; i < BOUNDARIES.length; i++) {
        if (pct >= BOUNDARIES[i].pct) return { grade: BOUNDARIES[i].grade, pct: pct };
      }
      return { grade: 'U', pct: pct };
    },
  };
})();
