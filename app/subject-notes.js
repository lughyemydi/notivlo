/* Starter notes for every subject on the setup guide's list that the notebook
 * page has no example chapters of its own for.
 *
 * Notebook.dc.html ships example chapters for seven subjects (its NOTEBOOKS
 * table). Everything else a student can pick in the guide — History, Business,
 * French, Music and the rest — used to open on a blank "Chapter 1". This file
 * gives each of them the same three levels the seven have:
 *
 *   BASE[slug]        the A level notebook: AS chapters in unit 1, A Level
 *                     chapters in unit 2, against the Cambridge International
 *                     syllabus whose number is on the subject line
 *   FOUNDATION[slug]  the IGCSE-stage notebook a younger student starts with,
 *                     ending on a "Bridge to AS" chapter; `igcse` is the
 *                     Cambridge IGCSE syllabus it sits on, or '' where there is
 *                     no matching IGCSE
 *
 * school-level.js chooses between them (see `leveled` there): AS students get
 * unit 1, final-year students get everything opened on unit 2, and younger
 * students get FOUNDATION. Slugs are what setup-store.js's slugify makes of
 * the names in setup-content.js's SUBJECTS — "Design & Technology" becomes
 * 'design-technology' — so the two lists must stay in step; the tests check.
 *
 * All of it is original teaching text written to the syllabus, not taken from
 * any past paper or textbook. Paper labels are kept general ("AS · Papers
 * 1–2") so a syllabus revision does not make them wrong.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.notivloSubjectNotes = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var BASE = {};
  var FOUNDATION = {};

  var AS = 'AS · Papers 1–2';
  var AL = 'A Level · Papers 3–4';
  var CORE = 'IGCSE stage · Core ideas';
  var BRIDGE = 'Bridge to AS';

  function ch(title, unit, unitName, paragraphs, notes) {
    return { title: title, unit: unit, unitName: unitName, paragraphs: paragraphs, notes: notes || [] };
  }
  function D(text) { return { type: 'def', label: 'Definition', text: text }; }
  function T(text) { return { type: 'tip', label: 'Tip', text: text }; }
  function R(text) { return { type: 'reminder', label: 'Reminder', text: text }; }

  // One subject: its A level notebook and its IGCSE-stage one.
  function subject(slug, title, code, igcse, chapters, foundation) {
    BASE[slug] = { title: title, subject: 'Cambridge ' + code, activeIdx: 0, chapters: chapters };
    FOUNDATION[slug] = { igcse: igcse, chapters: foundation };
  }

  // ---------------------------------------------------------------------------
  // Mathematics, computing and technology
  // ---------------------------------------------------------------------------

  // 9231 has no AS of its own; its first pure paper is where students start.
  subject('further-mathematics', 'Further Mathematics', '9231', '0606', [
    ch('Roots of Polynomial Equations', 1, 'Paper 1 · Further Pure Mathematics 1', [
      'For a quadratic ax² + bx + c = 0 with roots α and β, the sum α + β = −b/a and the product αβ = c/a. A cubic with roots α, β and γ has α + β + γ = −b/a, αβ + βγ + γα = c/a and αβγ = −d/a.',
      'These relations give expressions such as α² + β² = (α + β)² − 2αβ without solving the equation, and they let you build a new equation whose roots are related to the old ones by a substitution.',
    ], [
      D('Symmetric function of the roots — an expression unchanged when the roots are swapped, such as α² + β² or 1/α + 1/β.'),
      T('For an equation with roots 2α, 2β, 2γ, substitute x = y/2 into the original instead of working out each coefficient.'),
    ]),
    ch('Matrices & Transformations', 1, 'Paper 1 · Further Pure Mathematics 1', [
      'A 2 × 2 matrix represents a transformation of the plane: its columns are the images of the unit vectors i and j. Multiplying matrices combines transformations, applied from right to left.',
      'The determinant is the area scale factor, and a negative determinant means the orientation is reversed. A matrix with determinant zero has no inverse, because it squashes the plane onto a line or a point.',
    ], [
      D('Invariant line — a line whose points are all mapped to points on the same line.'),
      R('AB means apply B first, then A.'),
    ]),
    ch('Complex Numbers', 2, 'Paper 2 · Further Pure Mathematics 2', [
      'De Moivre’s theorem, (cos θ + i sin θ)ⁿ = cos nθ + i sin nθ, turns powers of complex numbers into multiples of angles. Expanding the left side binomially and comparing real and imaginary parts gives cos nθ and sin nθ in powers of cos θ and sin θ.',
      'The n nth roots of a complex number lie equally spaced on a circle in the Argand diagram, 2π/n apart, so finding one root gives all the others.',
    ], [
      D('Modulus–argument form — z = r(cos θ + i sin θ), where r is the modulus and θ the argument.'),
      T('The nth roots of unity always add up to zero — a quick check on any set you find.'),
    ]),
    ch('Second-Order Differential Equations', 2, 'Paper 2 · Further Pure Mathematics 2', [
      'An equation a d²y/dx² + b dy/dx + cy = f(x) with constant coefficients is solved in two parts: the complementary function, from the auxiliary equation am² + bm + c = 0, and a particular integral that fits f(x).',
      'The general solution is their sum, and the boundary or initial conditions then fix the two arbitrary constants.',
    ], [
      D('Auxiliary equation — am² + bm + c = 0; whether its roots are distinct, repeated or complex decides the form of the complementary function.'),
      T('If your trial particular integral already appears in the complementary function, multiply it by x.'),
    ]),
  ], [
    ch('Functions', 1, CORE, [
      'A function sends each input to exactly one output. f(x) = 2x + 3 sends 4 to 11, and its inverse, f⁻¹(x) = (x − 3)/2, sends 11 back to 4.',
      'A composite function applies one function and then another: fg(x) means apply g first, then f. Following an input through each step gives both the formula and the domain.',
    ], [
      D('Inverse function — the function that undoes f, so that f⁻¹(f(x)) = x.'),
      T('The graph of f⁻¹ is the reflection of the graph of f in the line y = x.'),
    ]),
    ch('First Steps in Calculus', 1, CORE, [
      'Differentiation finds the gradient of a curve at any point. For y = xⁿ, dy/dx = nxⁿ⁻¹, so y = x³ has gradient 3x², which is 12 when x = 2.',
      'Setting dy/dx = 0 finds the turning points, where the curve is momentarily flat. Integration reverses differentiation and finds the area under a curve.',
    ], [
      D('Derivative — the rate of change of y with respect to x; the gradient of the curve at a point.'),
    ]),
    ch('Looking Ahead: Further Mathematics', 2, BRIDGE + ' · Further Pure Mathematics 1', [
      'Further Mathematics is taken alongside A level Mathematics and assumes it. Roots of polynomials, matrices and proof by induction come early, built on the algebra of Additional Mathematics.',
      'The habit that matters most is careful algebra over many lines: Further Mathematics questions are long, and an early slip carries all the way through.',
    ], [
      T('Get fluent with the binomial expansion, surds and indices now. Further Mathematics uses them without stopping to explain.'),
    ]),
  ]);

  subject('information-technology', 'Information Technology', '9626', '0417', [
    ch('Data, Information & Quality', 1, AS, [
      'Data is raw facts and figures with no context; information is data that has been processed and given meaning. "37.5" is data; "the patient’s temperature is 37.5 °C" is information.',
      'The quality of information depends on its accuracy, relevance, age, completeness, level of detail and presentation. Answers are expected to apply these factors to the scenario in the question, not just list them.',
    ], [
      D('Validation — a check by the computer that data is reasonable, such as a range check. It cannot tell whether the data is correct.'),
      T('Validation checks data is sensible; verification checks it was entered or copied correctly. Keep the two words apart.'),
    ]),
    ch('Spreadsheets & Modelling', 1, AS, [
      'A spreadsheet model uses formulas to represent a real situation, so that changing an input shows what would happen. Absolute references such as $A$1 stay fixed when a formula is copied; relative references move with it.',
      'Functions such as IF, VLOOKUP and COUNTIF let a model make decisions and look values up instead of relying on numbers typed in by hand.',
    ], [
      D('What-if analysis — changing the inputs of a model to see the effect on its results.'),
    ]),
    ch('Emerging Technologies', 2, AL, [
      'Technologies such as artificial intelligence, robotics, computer-assisted translation and the Internet of Things are examined through their uses and their impact on individuals, organisations and society.',
      'Higher marks go to answers that weigh benefits against drawbacks for the context in the question and then reach a conclusion.',
    ], [
      T('In an "evaluate" answer, finish with a judgement: which point matters more here, and why.'),
    ]),
    ch('Project Management & the System Life Cycle', 2, AL, [
      'Large IT projects are planned with Gantt charts and critical path analysis, which show which tasks depend on others and how long the whole project must take.',
      'The system life cycle runs from analysis through design, development and testing to implementation, documentation and evaluation. Each way of implementing — direct, parallel, pilot or phased — trades risk against cost.',
    ], [
      D('Critical path — the longest chain of dependent tasks, which sets the shortest possible length of the project.'),
    ]),
  ], [
    ch('Hardware & Software', 1, CORE, [
      'Hardware is the physical parts of a computer system; software is the programs that run on it. System software, such as an operating system, runs the computer; application software, such as a word processor, does a job for the user.',
      'Input devices bring data in, output devices present results, and storage devices keep data when the power is off. Questions usually ask for the right device for a situation, and why.',
    ], [
      D('Operating system — system software that manages the hardware and lets other programs run.'),
    ]),
    ch('Spreadsheets', 1, CORE, [
      'A cell is named by its column and row, such as B4. A formula starts with = and can refer to other cells, so =B4*C4 updates automatically when either cell changes.',
      'Functions such as SUM, AVERAGE, MAX and IF save time and reduce errors. When a formula is copied down a column, its cell references change to match each new row.',
    ], [
      T('Put cell references in formulas, not typed numbers, so the sheet stays right when the data changes.'),
    ]),
    ch('Looking Ahead: IT at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Information Technology goes deeper into the same areas — data quality, validation, spreadsheets and databases — and asks you to explain and evaluate as well as describe.',
      'The practical paper tests the applications directly, so regular hands-on practice matters as much as revision notes.',
    ], [
      T('Practise formulas with absolute references now; AS assumes you can use them without thinking.'),
    ]),
  ]);

  subject('design-technology', 'Design & Technology', '9705', '0445', [
    ch('The Design Process', 1, AS, [
      'Design starts from a need. A brief states the problem, and a specification lists measurable requirements the product must meet, such as size, cost, materials and the needs of its users.',
      'Ideas are developed through sketches, models and testing, with each change justified against the specification. Examiners reward development that shows why a decision was made, not only what it was.',
    ], [
      D('Specification — a list of precise, testable requirements a design must meet.'),
    ]),
    ch('Materials & Their Properties', 1, AS, [
      'Materials are chosen for their properties: tensile strength, hardness, toughness, ductility, density and cost among them. A material can be strong but brittle, or tough but easily scratched.',
      'Timbers, metals, polymers and composites each have families with typical uses. A thermoplastic can be reheated and reshaped; a thermosetting plastic cannot.',
    ], [
      D('Toughness — the ability to absorb energy and resist cracking under impact.'),
      R('Hardness and toughness are different properties. Glass is hard but not tough.'),
    ]),
    ch('Manufacturing Processes', 2, AL, [
      'The right process depends on the material, the shape and how many are needed. Injection moulding suits long runs of plastic parts: the mould is expensive, but each cycle is fast and cheap.',
      'The scale of production — one-off, batch or mass — changes the economics of every choice, from tooling to labour.',
    ], [
      D('Batch production — making a set number of identical products before changing over to another.'),
    ]),
    ch('Design & Society', 2, AL, [
      'Products affect people and the environment beyond their users. Designers weigh sustainability, ethics and culture, including how a product will be repaired, recycled or disposed of.',
      'Life cycle assessment follows a product from raw materials through manufacture and use to disposal, to judge its environmental impact at each stage.',
    ], [
      T('Use a named product as an example in every extended answer. A well-chosen case beats general points.'),
    ]),
  ], [
    ch('Designing for People', 1, CORE, [
      'Good design begins with the user. Find out who will use a product, where and how, before drawing anything.',
      'Annotated sketches explain ideas: notes around a drawing say what each feature is for and why it was chosen.',
    ], [
      T('Annotate with reasons, not labels — "rounded corners so it is safe for young children", not just "rounded corners".'),
    ]),
    ch('Materials & Tools', 1, CORE, [
      'Woods, metals and plastics are worked in different ways. Wood is cut, shaped and jointed; metal can be cut, bent and joined by welding or brazing; many plastics can be line bent or vacuum formed once heated.',
      'Working safely is part of the skill: the right tool, the right protective equipment and a firmly held workpiece every time.',
    ], [
      D('Thermoplastic — a plastic that softens when heated and can be reshaped.'),
    ]),
    ch('Looking Ahead: Design & Technology at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Design & Technology expects more precise knowledge of material properties and manufacturing, and written answers that justify design decisions.',
      'The project rewards a clear trail from need, to specification, to a tested product.',
    ], [
      T('Keep a sketchbook page of products you think are well designed, with a note on why. It builds the vocabulary AS expects.'),
    ]),
  ]);

  // ---------------------------------------------------------------------------
  // Sciences outside the original seven
  // ---------------------------------------------------------------------------

  // 8291 is examined at AS only, so its notebook has no A Level unit; a
  // final-year student simply opens it at the start.
  subject('environmental-management', 'Environmental Management', '8291', '0680', [
    ch('Ecosystems & Biodiversity', 1, 'AS · Papers 1–2', [
      'Ecosystems are shaped by the interactions between living things and their physical environment. Energy flows through food chains and is lost at each step, while nutrients such as carbon and nitrogen cycle.',
      'Biodiversity is threatened by habitat loss, pollution, invasive species and climate change, and protected through reserves, legislation and sustainable use of resources.',
    ], [
      D('Biodiversity — the variety of life in an area, including genetic, species and ecosystem diversity.'),
    ]),
    ch('Water & Pollution', 1, 'AS · Papers 1–2', [
      'Fresh water is unevenly distributed, and demand from farming, industry and homes can outstrip supply.',
      'Management combines increasing supply, through reservoirs, groundwater and desalination, with reducing demand and preventing pollution.',
    ], [
      T('Evaluate a strategy with specific advantages and disadvantages in a named place.'),
    ]),
    ch('Energy & Climate', 1, 'AS · Papers 1–2', [
      'Fossil fuels are reliable and energy-dense but release greenhouse gases. Renewable sources produce less carbon but are often intermittent and depend on location.',
      'Energy choices balance cost, reliability, environmental impact and energy security, and different countries weigh those differently.',
    ], [
      D('Energy security — reliable access to affordable energy.'),
    ]),
  ], [
    ch('Resources & Sustainability', 1, CORE, [
      'Natural resources are renewable, like solar and wind energy, or non-renewable, like oil and coal. Using them sustainably means meeting today’s needs without harming the ability of future generations to meet theirs.',
      'Human activity changes the environment through farming, mining, building and waste — and good management reduces that harm.',
    ], [
      D('Sustainable development — development that meets present needs without compromising the ability of future generations to meet their own.'),
    ]),
    ch('Fieldwork & Data', 1, CORE, [
      'Environmental management relies on data: measuring, sampling and recording accurately.',
      'Random and systematic sampling reduce bias, and repeating measurements makes results more reliable.',
    ], [
      T('For any investigation, say how you would make it fair and how you would reduce error.'),
    ]),
    ch('Looking Ahead: Environmental Management at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Environmental Management covers the same systems in more depth, with more data to interpret and strategies to evaluate.',
      'Case studies with named places and figures carry much of the credit in longer answers.',
    ], [
      T('Start a list of environmental case studies from the news, with one figure for each.'),
    ]),
  ]);

  subject('marine-science', 'Marine Science', '9693', '', [
    ch('Marine Ecosystems', 1, AS, [
      'Marine ecosystems — coral reefs, rocky shores, mangroves and the open ocean — depend on producers such as phytoplankton, which carry out most of the photosynthesis in the sea.',
      'Physical factors such as light, temperature, salinity and wave action decide which organisms can live where.',
    ], [
      D('Phytoplankton — microscopic photosynthetic organisms that drift near the ocean surface.'),
    ]),
    ch('The Ocean & Its Water', 1, AS, [
      'The salinity, temperature and density of seawater vary with depth and place, and those differences drive currents and layering in the ocean.',
      'Tides are caused mainly by the Moon’s gravitational pull, with the Sun strengthening or weakening them as the two line up or not.',
    ], [
      D('Salinity — the concentration of dissolved salts in water.'),
    ]),
    ch('Fisheries & Aquaculture', 2, AL, [
      'Fisheries management aims to catch fish without depleting stocks, using quotas, closed seasons, gear restrictions and protected areas.',
      'Aquaculture can reduce pressure on wild stocks but brings its own problems, including disease, escapes and pollution.',
    ], [
      D('Maximum sustainable yield — the largest catch that can be taken from a stock indefinitely.'),
    ]),
    ch('Human Impacts on the Ocean', 2, AL, [
      'Pollution, overfishing, coastal development and climate change all affect marine ecosystems. Ocean acidification threatens organisms that build shells and skeletons from calcium carbonate.',
      'Evaluation weighs economic benefits against ecological costs, and asks who should manage waters that many countries share.',
    ], [
      T('Use named locations and data in extended answers.'),
    ]),
  ], [
    ch('Life in the Sea', 1, CORE, [
      'The ocean covers most of Earth’s surface and holds a huge range of life, from microscopic plankton to whales.',
      'Food webs in the sea begin with phytoplankton, which use sunlight to make food, just as plants do on land.',
    ], [
      D('Food web — a diagram showing how energy passes between organisms through feeding.'),
    ]),
    ch('Oceans & Climate', 1, CORE, [
      'The oceans absorb heat and carbon dioxide and carry heat around the planet in currents.',
      'Warmer water causes coral bleaching, and more dissolved carbon dioxide makes seawater more acidic.',
    ], [
      D('Coral bleaching — when corals expel the algae living in them, usually because the water is too warm.'),
    ]),
    ch('Looking Ahead: Marine Science at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Marine Science builds on IGCSE Biology and Geography: ecosystems, the physical ocean and how organisms are adapted to it.',
      'Practical and data questions are common, so interpreting graphs and describing methods matter.',
    ], [
      T('Revise photosynthesis, respiration and food chains from IGCSE Biology — AS starts from them.'),
    ]),
  ]);

  subject('physical-education', 'Physical Education', '9396', '0413', [
    ch('Anatomy & Physiology', 1, AS, [
      'The skeletal, muscular, cardiovascular and respiratory systems work together during exercise. Heart rate, stroke volume and breathing rate all rise to deliver more oxygen to working muscles.',
      'Cardiac output is stroke volume multiplied by heart rate, and it can rise several times over from rest to maximal exercise.',
    ], [
      D('Cardiac output — the volume of blood pumped by the heart per minute.'),
    ]),
    ch('Skill Acquisition', 1, AS, [
      'Skills are classified on continua — open to closed, gross to fine, discrete to continuous — which guides how each is best taught.',
      'Practice can be massed or distributed, whole or part, and feedback can come from the performer’s own senses or from a coach.',
    ], [
      T('Give a sporting example for every classification you explain.'),
    ]),
    ch('Exercise Physiology', 2, AL, [
      'Energy for exercise comes from three systems — ATP-PC, anaerobic glycolysis and aerobic — used in different proportions depending on the intensity and duration of the activity.',
      'Training adapts these systems, and recovery restores them, including the extra oxygen used after exercise.',
    ], [
      D('EPOC — excess post-exercise oxygen consumption: the extra oxygen used after exercise to return the body to its resting state.'),
    ]),
    ch('Sport Psychology', 2, AL, [
      'Motivation, anxiety, arousal and confidence all affect performance. The inverted-U theory suggests performance is best at a moderate level of arousal.',
      'Strategies such as imagery, relaxation and goal setting help performers manage their mental state.',
    ], [
      T('Link every theory to a strategy a coach could actually use.'),
    ]),
  ], [
    ch('The Body in Exercise', 1, CORE, [
      'During exercise, muscles need more oxygen, so heart rate and breathing rate increase.',
      'Regular training makes the heart stronger, so it pumps more blood with each beat and the resting heart rate falls.',
    ], [
      D('Aerobic exercise — exercise that uses oxygen, sustained at a moderate intensity.'),
    ]),
    ch('Principles of Training', 1, CORE, [
      'Training works through specificity, progression, overload and reversibility: train for your activity, build up gradually, work harder than usual, and expect fitness to fade if you stop.',
      'Methods such as continuous, interval, circuit and weight training suit different components of fitness.',
    ], [
      T('Remember SPOR: specificity, progression, overload, reversibility.'),
    ]),
    ch('Looking Ahead: Physical Education at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Physical Education explains the body and the mind in sport in more scientific detail, from the heart’s conduction system to theories of learning.',
      'Your own performance is assessed too, so keep training and keep a record of it.',
    ], [
      T('Learn the names of the main bones and muscles now; AS questions use them from the start.'),
    ]),
  ]);

  // ---------------------------------------------------------------------------
  // Business and the social sciences
  // ---------------------------------------------------------------------------

  subject('business', 'Business', '9609', '0450', [
    ch('Business & Its Environment', 1, AS, [
      'A business exists to add value: to turn inputs into outputs customers will pay more for. Businesses range from sole traders to public limited companies, and the form of ownership affects liability, control and access to finance.',
      'Stakeholders — owners, employees, customers, suppliers, the local community and government — each want something different from a business, and their aims can conflict.',
    ], [
      D('Limited liability — owners can lose only what they invested, not their personal assets.'),
      T('Name the stakeholder group and say exactly what it wants in the case in front of you.'),
    ]),
    ch('Marketing', 1, AS, [
      'The marketing mix — product, price, promotion and place — has to fit together and fit the target market. A premium product sold cheaply sends mixed signals.',
      'Market research is primary, collected first-hand, or secondary, already published. Each has costs, and each can be biased or out of date.',
    ], [
      D('Market segmentation — dividing a market into groups of consumers with similar needs or characteristics.'),
    ]),
    ch('Strategic Management', 2, AL, [
      'Strategy is about long-term direction. SWOT, PEST, Porter’s Five Forces and the Ansoff matrix help a business analyse where it stands and choose where to grow.',
      'Each tool has limits: an analysis is only as good as its information, and it can go out of date quickly.',
    ], [
      T('Apply each tool to the case. A SWOT built from the case’s own facts earns analysis marks; a generic one does not.'),
    ]),
    ch('Finance & Investment Appraisal', 2, AL, [
      'Ratio analysis compares figures from the accounts: profitability ratios, liquidity ratios such as the current ratio, and efficiency ratios such as inventory turnover.',
      'Payback, average rate of return and net present value help choose between projects, but none of them captures qualitative factors such as brand image or staff morale.',
    ], [
      D('Net present value — the value today of a project’s future cash flows, minus its initial cost.'),
    ]),
  ], [
    ch('Types of Business', 1, CORE, [
      'Businesses are grouped by sector: primary (extracting raw materials), secondary (manufacturing) and tertiary (services). As economies develop, the tertiary sector usually grows.',
      'Sole traders, partnerships and limited companies differ in who owns them, who controls them and what happens to the owners if the business fails.',
    ], [
      D('Sole trader — a business owned and run by one person, who has unlimited liability.'),
    ]),
    ch('Profit & Cash', 1, CORE, [
      'Revenue is the money from sales; profit is what is left after costs. A business can be profitable on paper and still fail if it runs out of cash to pay its bills.',
      'A cash-flow forecast predicts the money coming in and going out each month, so a shortfall can be spotted and planned for.',
    ], [
      R('Profit and cash are not the same thing.'),
    ]),
    ch('Looking Ahead: Business at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Business uses the same ideas with more analysis: you explain the chain of effects that follows a decision, not just name it.',
      'Case studies are central, so every answer has to use the business in front of you.',
    ], [
      T('Follow one real business in the news this year and apply each topic to it.'),
    ]),
  ]);

  subject('accounting', 'Accounting', '9706', '0452', [
    ch('Double Entry & the Trial Balance', 1, AS, [
      'Every transaction has two effects, recorded as a debit in one account and a credit in another. Assets and expenses increase with debits; liabilities, capital and income increase with credits.',
      'A trial balance lists every balance to check that total debits equal total credits. It catches arithmetic slips, but not errors of omission, commission or principle.',
    ], [
      D('Error of principle — an entry made in the wrong class of account, such as recording a non-current asset as an expense.'),
      T('DEAD CLIC: Debits are Expenses, Assets and Drawings; Credits are Liabilities, Income and Capital.'),
    ]),
    ch('Financial Statements & Adjustments', 1, AS, [
      'The income statement shows the profit for a period; the statement of financial position shows assets, liabilities and capital at a single date.',
      'Adjustments for accruals, prepayments, depreciation and irrecoverable debts make the statements follow the matching principle: income and expenses belong to the period they relate to.',
    ], [
      D('Accrual — an expense incurred in the period but not yet paid.'),
    ]),
    ch('Limited Company Accounts', 2, AL, [
      'Companies raise capital through shares and debentures, and their statements show share capital, reserves and the movements between them, following international accounting standards.',
      'A statement of cash flows explains why cash changed during the year, separating operating, investing and financing activities.',
    ], [
      T('In a statement of cash flows, add depreciation back: it reduced profit but involved no cash.'),
    ]),
    ch('Costing & Budgeting', 2, AL, [
      'Marginal costing separates fixed and variable costs, which makes it useful for decisions such as whether to accept a special order. Absorption costing spreads overheads across products using absorption rates.',
      'Budgets and standard costs let managers compare what happened with what was planned; variances are then analysed to find out why.',
    ], [
      D('Variance — the difference between a budgeted or standard figure and the actual result.'),
    ]),
  ], [
    ch('The Accounting Equation', 1, CORE, [
      'Assets = Capital + Liabilities. Everything a business owns was paid for either by the owner or by borrowing, so the two sides always balance.',
      'Every transaction changes the equation but keeps it balanced: buying equipment for cash swaps one asset for another.',
    ], [
      D('Liability — an amount the business owes to someone else.'),
    ]),
    ch('Books of Prime Entry & Ledgers', 1, CORE, [
      'Transactions are first recorded in books of prime entry, such as the sales journal and the cash book, and then posted to accounts in the ledger.',
      'Each ledger account has a debit side on the left and a credit side on the right, and is balanced at the end of each period.',
    ], [
      T('Write the name of the other account in the details column. It is how anyone can follow the double entry.'),
    ]),
    ch('Looking Ahead: Accounting at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Accounting treats double entry as automatic and moves on to adjustments, partnerships and incomplete records.',
      'Layout earns marks: statements are expected in the standard formats, with full headings and dates.',
    ], [
      T('Practise drawing up a full income statement and statement of financial position from a trial balance until the layout is second nature.'),
    ]),
  ]);

  subject('psychology', 'Psychology', '9990', '', [
    ch('Research Methods', 1, AS, [
      'Experiments manipulate an independent variable and measure its effect on a dependent variable while controlling everything else. Observations, self-reports and case studies trade some of that control for depth or realism.',
      'Every method is judged on validity, reliability, generalisability and ethics, and questions often ask you to apply these to a named study.',
    ], [
      D('Ecological validity — how far findings apply to real-life settings.'),
      T('Learn each core study with its method, sample, results, and one strength and one weakness.'),
    ]),
    ch('Core Studies & Approaches', 1, AS, [
      'The core studies are examined in detail: what was done, what was found, and what each shows about the approach it represents.',
      'The biological approach explains behaviour through the brain, hormones and genes; the cognitive approach through mental processes such as memory and attention; the learning and social approaches through experience and other people.',
    ], [
      R('Evaluate a study using issues and debates — nature versus nurture, or how useful its findings are.'),
    ]),
    ch('Clinical Psychology', 2, AL, [
      'Clinical psychology covers how disorders such as schizophrenia, depression and anxiety are diagnosed, explained and treated.',
      'Explanations are biological, cognitive or behavioural, and treatments follow from them: drug therapy targets brain chemistry, cognitive behavioural therapy targets patterns of thinking.',
    ], [
      D('Diagnosis — identifying a disorder from its symptoms, using a classification system such as DSM or ICD.'),
    ]),
    ch('Evaluation & Debates', 2, AL, [
      'A Level essays are judged on evaluation: comparing explanations, weighing evidence and applying issues such as reductionism, determinism and cultural bias.',
      'Each evaluation point counts for more when it is explained in context than when it is listed.',
    ], [
      T('Build each evaluation point as: the issue, an example from a study, and what it means for the explanation.'),
    ]),
  ], [
    ch('What Psychology Studies', 1, CORE, [
      'Psychology is the scientific study of mind and behaviour. Psychologists ask why we forget, how children learn and why people obey authority — and test their answers with evidence.',
      'Because it is a science, a claim in psychology needs a study behind it. Opinions and anecdotes are where research starts, not where it ends.',
    ], [
      D('Hypothesis — a precise, testable prediction about what a study will find.'),
    ]),
    ch('How Studies Are Done', 1, CORE, [
      'An experiment changes one thing and measures its effect on another, keeping everything else the same. A questionnaire or interview asks people directly about their thoughts and behaviour.',
      'Researchers must protect participants: they need their consent, must let them withdraw, and must tell them the real purpose of the study afterwards.',
    ], [
      T('For any study, ask: what was changed, what was measured, and who took part?'),
    ]),
    ch('Looking Ahead: Psychology at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Psychology is built around core studies from four approaches — biological, cognitive, learning and social — each examined in detail.',
      'You will describe and evaluate research methods precisely, so the vocabulary of variables, samples and validity is worth learning early.',
    ], [
      T('Start a glossary of research methods terms now. Every paper uses it.'),
    ]),
  ]);

  subject('sociology', 'Sociology', '9699', '0495', [
    ch('Socialisation & Identity', 1, AS, [
      'Socialisation is how people learn the norms and values of their society, first through the family and then through school, peers, the media and religion.',
      'Sociologists disagree about how far identity is shaped by society and how far individuals shape it themselves — the structure and action debate.',
    ], [
      D('Norms — the unwritten rules of behaviour expected in a society or group.'),
    ]),
    ch('Research Methods', 1, AS, [
      'Positivists favour quantitative methods such as surveys and official statistics, aiming for reliable, generalisable data. Interpretivists favour qualitative methods such as unstructured interviews and participant observation, aiming for validity and meaning.',
      'The choice of method also depends on practical issues, ethics and the topic being studied.',
    ], [
      T('For any method, give one practical, one ethical and one theoretical point.'),
    ]),
    ch('Education', 2, AL, [
      'Functionalists see education as passing on shared values and sorting people into suitable roles; Marxists see it as reproducing class inequality.',
      'Differences in achievement by class, gender and ethnicity are explained by factors inside school, such as labelling and setting, and outside it, such as material and cultural deprivation.',
    ], [
      D('Labelling — attaching a fixed identity to a pupil, which can become a self-fulfilling prophecy.'),
    ]),
    ch('Globalisation & the Media', 2, AL, [
      'Globalisation is the growing interconnection of societies through trade, technology, migration and culture.',
      'Sociologists debate whether it spreads opportunity or deepens inequality, and whether global media make cultures more alike or more varied.',
    ], [
      T('Use current examples alongside named sociologists. Both carry marks.'),
    ]),
  ], [
    ch('Thinking Sociologically', 1, CORE, [
      'Sociology studies how society shapes the way people live — in families, schools, work and crime — and how people shape society in return.',
      'Sociologists look for patterns across groups, such as differences by social class, gender or ethnicity, rather than explaining one person’s choices.',
    ], [
      D('Social class — a group of people in a similar economic position, judged by income, wealth or occupation.'),
    ]),
    ch('The Family', 1, CORE, [
      'Family types vary: nuclear, extended, lone-parent and reconstituted families are all common, and the patterns differ between societies and over time.',
      'Sociologists ask what the family does for society and for its members, and whether roles within it are shared equally.',
    ], [
      T('Support a claim about change with evidence, such as a trend in marriage or divorce rates.'),
    ]),
    ch('Looking Ahead: Sociology at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Sociology asks you to use theories — functionalism, Marxism, feminism and interactionism — to explain the patterns you already know.',
      'Essays reward evaluation: setting one theory against another and judging which explains the evidence better.',
    ], [
      T('Sum up each major theory in one sentence now. You will build on that sentence for two years.'),
    ]),
  ]);

  subject('law', 'Law', '9084', '', [
    ch('The English Legal System', 1, AS, [
      'Cambridge Law is based on the legal system of England and Wales. Civil cases settle disputes between individuals and are proved on the balance of probabilities; criminal cases are brought by the state and must be proved beyond reasonable doubt.',
      'The courts are arranged in a hierarchy, which matters for precedent: lower courts are bound by the decisions of higher ones.',
    ], [
      D('Precedent — the principle that judges follow earlier decisions of higher courts on similar facts.'),
    ]),
    ch('Criminal Law: Elements of a Crime', 1, AS, [
      'Most crimes need an actus reus, a guilty act or omission, and a mens rea, a guilty state of mind such as intention or recklessness, present at the same time.',
      'Causation links the act to the result: the defendant’s conduct must be both a factual and a legal cause of the harm.',
    ], [
      D('Mens rea — the mental element of a crime, such as intention or recklessness.'),
      T('In a problem question, take each element in turn: state the rule, cite a case, and apply it to the facts.'),
    ]),
    ch('Law of Contract', 2, AL, [
      'A contract needs offer, acceptance, consideration and an intention to create legal relations, and each element has its own rules and leading cases.',
      'The usual remedy for breach is damages, calculated to put the claimant where they would have been had the contract been performed.',
    ], [
      D('Consideration — something of value given by each party in return for the other’s promise.'),
    ]),
    ch('Law of Tort: Negligence', 2, AL, [
      'Negligence requires a duty of care, a breach of that duty, and damage caused by the breach that is not too remote.',
      'Defences such as contributory negligence can reduce damages, and consent can remove liability altogether.',
    ], [
      T('Use IRAC — Issue, Rule, Application, Conclusion — for every problem question.'),
    ]),
  ], [
    ch('What Law Is For', 1, CORE, [
      'Law is a set of rules enforced by the state. It keeps order, protects rights, settles disputes and sets out what happens when someone breaks the rules.',
      'Laws come from legislation passed by parliaments and from the decisions judges make in court cases.',
    ], [
      D('Legislation — law made by a parliament or another law-making body.'),
    ]),
    ch('Courts & Cases', 1, CORE, [
      'Criminal cases are brought by the state against someone accused of a crime. Civil cases are disputes between people or organisations, such as over a contract or an injury.',
      'In a criminal case the prosecution must prove guilt beyond reasonable doubt — a higher standard than in a civil case.',
    ], [
      R('A defendant is found guilty or not guilty in a criminal case, and liable or not liable in a civil one.'),
    ]),
    ch('Looking Ahead: Law at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Law teaches how the legal system works and how to answer problem questions by applying legal rules and cases to a set of facts.',
      'Learning cases by name, with a line on what each decided, is a large part of the work.',
    ], [
      T('Read news reports of court cases and note whether each is criminal or civil, and why.'),
    ]),
  ]);

  subject('history', 'History', '9489', '0470', [
    ch('Working with Sources', 1, AS, [
      'A source is evidence, and its value depends on who made it, when, why and for whom. A speech made to an audience shows what the speaker wanted heard, which is not always what they believed.',
      'Comparing sources means explaining how and why they agree or differ, using their content and their provenance together.',
    ], [
      D('Provenance — where a source comes from: its author, date, audience and purpose.'),
      T('Never call a source biased without saying how the bias affects what it can tell you.'),
    ]),
    ch('Writing a Historical Argument', 1, AS, [
      'Essay questions ask you to explain and judge — "how far", "to what extent", "why". The answer is an argument, not a narrative of events.',
      'Each paragraph should explain one factor with precise evidence and end by judging its importance against the question.',
    ], [
      T('Put your judgement in the first paragraph and keep it to the last.'),
    ]),
    ch('Interpretations', 2, AL, [
      'Historians disagree, and A Level asks why. An interpretation reflects the evidence available, the questions a historian asked and the time in which they wrote.',
      'Analyse an extract by identifying its argument, the approach behind it, and how the historian uses evidence to support it.',
    ], [
      D('Historiography — the study of how history has been written and interpreted.'),
    ]),
    ch('Depth Study Skills', 2, AL, [
      'Depth studies need detailed knowledge of a shorter period, so arguments can be backed with precise dates, names and figures.',
      'The strongest essays weigh causes or consequences against each other and explain the links between them, instead of treating each one alone.',
    ], [
      T('Build a timeline for each depth study and mark the factor each event illustrates.'),
    ]),
  ], [
    ch('Causes & Consequences', 1, CORE, [
      'History explains why things happened. Most events have several causes — long-term, short-term and a trigger — and historians judge which mattered most.',
      'Consequences can be intended or unintended, short-lived or long-lasting.',
    ], [
      D('Trigger — the immediate event that sets off a larger change.'),
    ]),
    ch('Using Sources', 1, CORE, [
      'Primary sources come from the time being studied; secondary sources are written later about it. Both can be useful, and both can be unreliable.',
      'Ask who made a source, when and why. The answers tell you what it can and cannot show.',
    ], [
      T('Support each point you make about a source with a short quotation from it.'),
    ]),
    ch('Looking Ahead: History at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS History asks for sustained argument: a clear judgement supported throughout by precise evidence.',
      'Source questions go further too, comparing sources and explaining why they differ.',
    ], [
      T('Practise turning narrative into argument: after describing an event, add a sentence on why it mattered.'),
    ]),
  ]);

  subject('geography', 'Geography', '9696', '0460', [
    ch('Hydrology & Rivers', 1, AS, [
      'A drainage basin is a system of inputs (precipitation), stores (soil, groundwater, vegetation), flows (infiltration, throughflow, runoff) and outputs (evaporation, transpiration and river discharge).',
      'A storm hydrograph shows how discharge responds to rainfall. Lag time and peak discharge depend on the basin’s size, shape, soils, rock and land use.',
    ], [
      D('Lag time — the time between peak rainfall and peak discharge.'),
      T('Explain why a factor changes the hydrograph, not only which way it changes it.'),
    ]),
    ch('Population', 1, AS, [
      'Population changes through natural change — births minus deaths — and migration. The demographic transition model describes how birth and death rates change as countries develop.',
      'Models simplify: real countries may skip or stall at stages, and the model was built from the experience of European countries.',
    ], [
      D('Natural increase — the birth rate minus the death rate.'),
    ]),
    ch('Coastal Environments', 2, AL, [
      'Coasts are shaped by waves, tides and the movement of sediment. Erosion produces cliffs and wave-cut platforms; deposition builds beaches, spits and bars.',
      'Coastal management balances hard engineering, such as sea walls, against softer approaches such as beach nourishment and managed retreat.',
    ], [
      D('Longshore drift — the movement of sediment along a coast by waves that approach at an angle.'),
    ]),
    ch('Global Interdependence', 2, AL, [
      'Trade, aid, debt and tourism link countries unequally, and patterns of trade often reflect historical relationships and the terms on which goods are exchanged.',
      'Evaluation questions ask who benefits and who loses — and the answer usually depends on scale and on which group is considered.',
    ], [
      T('Use located case studies with figures. "Tourism in Jamaica" beats "tourism in developing countries".'),
    ]),
  ], [
    ch('Rivers', 1, CORE, [
      'Rivers erode, transport and deposit material. In the upper course they cut down to form steep V-shaped valleys; lower down they widen, meander and deposit sediment on floodplains.',
      'Flooding happens when a river’s discharge is more than its channel can hold. Heavy rain, saturated ground and urban surfaces all raise the risk.',
    ], [
      D('Discharge — the volume of water flowing past a point in a river each second.'),
    ]),
    ch('Population & Migration', 1, CORE, [
      'World population is unevenly spread. People cluster where there is water, flat land, a suitable climate and work.',
      'Migration is driven by push factors where people leave, such as conflict or unemployment, and pull factors where they go, such as jobs and safety.',
    ], [
      T('Learn one case study for each topic, with place names and figures.'),
    ]),
    ch('Looking Ahead: Geography at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Geography revisits rivers and population in more detail, through systems, processes and models you are asked to evaluate.',
      'Data questions are common, so reading graphs, maps and tables accurately is a core skill.',
    ], [
      T('When describing a graph, give the overall trend first, then figures with units, then any exceptions.'),
    ]),
  ]);

  subject('global-perspectives-research', 'Global Perspectives & Research', '9239', '0457', [
    ch('Arguments & Evidence', 1, AS, [
      'Global Perspectives asks you to assess arguments on global issues: identify the claim, the reasoning and the evidence, and judge how far the evidence supports the claim.',
      'Credibility depends on a source’s expertise, vested interest, reputation and methods. A strong argument can still rest on weak evidence.',
    ], [
      D('Vested interest — a stake in an outcome that may influence what a source claims.'),
    ]),
    ch('Comparing Perspectives', 1, AS, [
      'A perspective is a coherent view of an issue, built on particular values and assumptions. Comparing perspectives means explaining why they differ, not only how.',
      'Strong answers identify the assumptions behind each perspective and assess the reasoning and evidence supporting it.',
    ], [
      T('For each perspective ask: whose view is this, and what would they need to believe for it to make sense?'),
    ]),
    ch('The Research Report', 2, 'A Level · Cambridge Research Report', [
      'The Cambridge Research Report is an extended essay on a question you design. A good question is debatable, focused and answerable with evidence you can actually find.',
      'The report compares perspectives, evaluates sources and reaches a supported conclusion.',
    ], [
      T('Narrow the question until a reader could disagree with your answer. Broad questions produce descriptive reports.'),
    ]),
    ch('Research Methods & Reflection', 2, 'A Level · Cambridge Research Report', [
      'Research draws on secondary sources and sometimes primary data. Each method should be justified and its limitations acknowledged.',
      'Reflection is assessed too: what you learned about the issue, about research, and about your own thinking.',
    ], [
      D('Research log — a record of the sources consulted, the decisions made, and how the question developed.'),
    ]),
  ], [
    ch('Global Issues', 1, CORE, [
      'Global issues — climate change, migration, poverty, conflict — cross borders and need solutions at more than one scale.',
      'Looking at an issue from local, national and global perspectives shows how differently it can affect people.',
    ], [
      D('Perspective — a point of view on an issue, shaped by values, beliefs and experience.'),
    ]),
    ch('Evaluating Sources', 1, CORE, [
      'Before trusting a source, ask who wrote it, what evidence it gives, and why it was produced.',
      'Facts can be checked; opinions and value judgements need reasons before they persuade.',
    ], [
      T('Check a surprising claim against at least one independent source.'),
    ]),
    ch('Looking Ahead: Global Perspectives at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Global Perspectives asks for sharper analysis of arguments, with precise judgements about reasoning and evidence.',
      'Research continues throughout, so habits of note-taking and referencing pay off early.',
    ], [
      T('Record full references for sources as you read. Rebuilding them later takes far longer.'),
    ]),
  ]);

  subject('divinity', 'Divinity', '9011', '0490', [
    ch('The Prophets', 1, AS, [
      'The Old Testament prophets spoke to Israel and Judah in times of crisis, calling the people back to faithfulness to the covenant and warning of judgement.',
      'Questions ask about both the content of the texts and their meaning in their historical setting, such as the Assyrian and Babylonian threats.',
    ], [
      D('Covenant — a binding agreement between God and his people, central to the Old Testament.'),
    ]),
    ch('The Gospels', 1, AS, [
      'Each Gospel presents the life and teaching of Jesus with its own emphasis and for its own audience.',
      'Answers are expected to refer closely to passages and explain their significance, rather than retell them.',
    ], [
      T('Learn short key phrases from the set passages so you can quote them accurately.'),
    ]),
    ch('The Early Church', 2, AL, [
      'The Acts of the Apostles and Paul’s letters show the early church spreading beyond Jerusalem and debating how Gentile believers should be included.',
      'Evaluation questions ask how far a text gives a reliable picture, and how its writer’s purposes shape it.',
    ], [
      D('Gentile — a person who is not Jewish.'),
    ]),
    ch('Interpretation & Evaluation', 2, AL, [
      'A Level answers weigh different interpretations of a text and explain why scholars read it differently.',
      'A clear argument with close reference to the text is rewarded more than a survey of opinions.',
    ], [
      T('End each essay with a judgement that answers the question as it was set.'),
    ]),
  ], [
    ch('Sacred Texts', 1, CORE, [
      'Religious traditions are shaped by their sacred texts, which are read, interpreted and applied to life in different ways.',
      'Understanding a passage means knowing what it says, when it was written, and how believers use it today.',
    ], [
      D('Interpretation — explaining what a text means, which can differ between readers and traditions.'),
    ]),
    ch('Beliefs & Practices', 1, CORE, [
      'Beliefs about God, life and death shape practices such as worship, festivals and rites of passage.',
      'Answers are stronger when they link a practice to the belief behind it.',
    ], [
      T('For every practice you learn, note the belief it expresses.'),
    ]),
    ch('Looking Ahead: Divinity at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Divinity studies biblical texts closely, with questions on their content, background and meaning.',
      'Accurate knowledge of the passages matters, so regular reading of the set texts is the best preparation.',
    ], [
      T('Read one set passage a week and sum it up in three sentences.'),
    ]),
  ]);

  // ---------------------------------------------------------------------------
  // English and classics
  // ---------------------------------------------------------------------------

  subject('english-language', 'English Language', '9093', '0500', [
    ch('Reading: Language & Style', 1, AS, [
      'Reading questions ask how a text creates meaning through its form, structure and language, and how those choices suit its audience and purpose.',
      'Analysis means linking a feature to its effect. Naming a technique without explaining what it does earns little.',
    ], [
      D('Register — the level of formality in language, chosen to suit audience and context.'),
      T('Use the context printed above an extract; it tells you the audience and purpose to write about.'),
    ]),
    ch('Writing: Directed & Imaginative', 1, AS, [
      'Directed writing asks for a set form, audience and purpose, often using material from a source text.',
      'Imaginative writing is judged on control: precise vocabulary, varied sentences and a structure that serves the piece.',
    ], [
      T('Plan the ending before you start. Endings are where control shows most.'),
    ]),
    ch('Language Change', 2, AL, [
      'English has changed in vocabulary, spelling, grammar and meaning over time. Texts from different periods show the changes, often alongside data such as word-frequency tables.',
      'Explaining change means linking it to causes such as technology, contact with other languages and standardisation.',
    ], [
      D('Standardisation — the process by which one agreed form of spelling and grammar becomes established.'),
    ]),
    ch('Child Language & World Englishes', 2, AL, [
      'Children acquire language in predictable stages, and theories disagree about how far this comes from an innate ability and how far from interaction with others.',
      'The spread of English has produced many varieties worldwide, raising questions about identity, ownership and attitudes to "correct" English.',
    ], [
      T('Refer to the data in front of you. Theory supports your analysis; it does not replace it.'),
    ]),
  ], [
    ch('Reading for Meaning', 1, CORE, [
      'Reading questions test explicit meaning — what the text says — and implicit meaning — what it suggests. Inference needs evidence from the text.',
      'When analysing a writer’s choices, quote a word or phrase and explain its connotations.',
    ], [
      D('Connotation — the ideas or feelings a word suggests beyond its literal meaning.'),
    ]),
    ch('Writing for a Purpose', 1, CORE, [
      'Every piece of writing has an audience and a purpose — to inform, persuade, argue, describe or narrate — and its tone and vocabulary should fit both.',
      'Paragraphs organise ideas, and varying sentence length controls pace and emphasis.',
    ], [
      T('Read your writing back as its intended reader would. It is the quickest way to catch the wrong tone.'),
    ]),
    ch('Looking Ahead: English Language at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS English Language asks for precise analysis using linguistic terms, and for writing in a wider range of forms.',
      'Wide reading of non-fiction — articles, speeches, reviews — builds both skills at once.',
    ], [
      T('Learn the main word classes and sentence types now; AS analysis uses them throughout.'),
    ]),
  ]);

  subject('classical-studies', 'Classical Studies', '9274', '', [
    ch('Epic Poetry', 1, AS, [
      'Epic poems such as Homer’s Odyssey and Virgil’s Aeneid are studied for their heroes, their gods and the values they show, and for how they were composed and first heard.',
      'Answers analyse passages closely and connect them to the whole work and its context.',
    ], [
      D('Epic — a long narrative poem about heroic deeds, often involving the gods.'),
    ]),
    ch('Ancient Historians', 1, AS, [
      'Ancient historians such as Herodotus, Thucydides and Livy wrote with aims of their own, and their accounts have to be read critically.',
      'Evidence also comes from inscriptions, coins and archaeology, which can support or challenge the written sources.',
    ], [
      T('For every claim about the ancient world, ask which source says so and how far it can be trusted.'),
    ]),
    ch('Greek Drama', 2, AL, [
      'Greek tragedy and comedy were performed at festivals in Athens, and their conventions — the chorus, masks, a small number of actors — shape how the plays work.',
      'Essays consider both text and performance, and what the plays meant to their first audience.',
    ], [
      D('Chorus — a group of performers in Greek drama who sing, dance and comment on the action.'),
    ]),
    ch('Art & Architecture', 2, AL, [
      'Classical art and buildings are evidence for religion, politics and daily life, and their styles changed over time in ways that can be dated and explained.',
      'Analysis describes form precisely and connects it to purpose and context.',
    ], [
      T('Learn named examples with dates. Precise references separate strong answers from general ones.'),
    ]),
  ], [
    ch('The Classical World', 1, CORE, [
      'Classical Studies covers ancient Greece and Rome — their history, literature, beliefs, art and ideas — without needing to read Latin or Greek.',
      'Much of what we know comes from a small number of surviving texts and objects, so reading them carefully matters.',
    ], [
      D('Primary source — evidence from the ancient world itself, such as a text, an inscription or an object.'),
    ]),
    ch('Myths & Heroes', 1, CORE, [
      'Greek and Roman myths explained the world, taught values and entertained. Heroes such as Odysseus and Aeneas show the qualities their societies admired.',
      'Many myths survive in more than one version, and the differences often show what each writer wanted to stress.',
    ], [
      T('When you meet a myth, note who tells it and what lesson it seems to teach.'),
    ]),
    ch('Looking Ahead: Classical Studies at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Classical Studies works through set texts and sources in detail, analysing passages and evaluating evidence.',
      'Reading a whole epic or play in translation before the course starts gives you a real head start.',
    ], [
      T('Read the Odyssey in a modern translation — it is the easiest way in.'),
    ]),
  ]);

  // ---------------------------------------------------------------------------
  // Languages. The A level chapters are skills the papers share — reading and
  // translation, writing, literature, discussion — with each language's own
  // grammar in them; the IGCSE-stage ones are the grammar AS takes as known.
  // ---------------------------------------------------------------------------

  subject('french', 'French', '9898', '0520', [
    ch('Reading & Translation', 1, AS, [
      'AS French tests reading comprehension and translation. Translation into French rewards accuracy: agreements, tenses and word order all carry marks.',
      'Read the whole passage first, then translate meaning rather than word by word.',
    ], [
      D('Le subjonctif — the subjunctive mood, used after expressions of wish, doubt, emotion and necessity: « il faut que tu viennes ».'),
    ]),
    ch('Writing & Grammar', 1, AS, [
      'Essays are marked on content and on the range and accuracy of language. The subjunctive, relative pronouns such as dont and lequel, and a range of tenses show control.',
      'Plan in French, with key vocabulary for the topic, so that you write in French rather than translating from English.',
    ], [
      T('Check agreements last: every adjective and past participle against its noun.'),
    ]),
    ch('Literature in French', 2, AL, [
      'A Level French includes set literary texts, with essays written in French on their themes, characters and the writer’s techniques.',
      'Short quotations in French support points about language and meaning.',
    ], [
      T('Keep quotations organised by theme rather than by chapter.'),
    ]),
    ch('Discussion & Debate', 2, AL, [
      'Speaking asks you to present and discuss topics, defending opinions with reasons and examples.',
      'Fluency comes from practised expressions for agreeing, conceding and justifying: « certes… mais », « il me semble que ».',
    ], [
      R('Use structures that need the subjunctive naturally — « bien que », « pour que » — as a clear sign of level.'),
    ]),
  ], [
    ch('Present & Past Tenses', 1, CORE, [
      'The present tense describes what happens now: je parle, tu finis, il vend. The passé composé describes completed past actions with avoir or être and a past participle: j’ai mangé, elle est partie.',
      'Verbs of movement such as aller, venir and partir, and all reflexive verbs, take être, and their past participle agrees with the subject.',
    ], [
      D('Passé composé — the perfect tense, used for single completed actions in the past.'),
    ]),
    ch('Describing & Giving Opinions', 1, CORE, [
      'Adjectives agree with their noun in gender and number: un livre intéressant, une histoire intéressante, des idées intéressantes.',
      'Opinions need reasons: « j’aime le français parce que c’est utile » scores more than « j’aime le français ».',
    ], [
      T('Learn three opinion phrases and three connectives, and use them in every piece of writing.'),
    ]),
    ch('Looking Ahead: French at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS French expects a wider range of tenses and moods, including the subjunctive, and longer, more developed writing on current issues.',
      'Reading and listening to real French — news, podcasts, films — is the best preparation.',
    ], [
      T('Read one short French news article a week and note five new words.'),
    ]),
  ]);

  subject('spanish', 'Spanish', '9844', '0530', [
    ch('Reading & Translation', 1, AS, [
      'AS Spanish tests understanding of authentic texts and translation. Agreements, the choice between ser and estar, and tenses all carry marks.',
      'Translate meaning rather than word by word, then read your Spanish back to check it sounds natural.',
    ], [
      D('El subjuntivo — the subjunctive mood, used after wishes, doubt and emotion: « espero que vengas ».'),
    ]),
    ch('Writing & Grammar', 1, AS, [
      'Essays reward a range of structures used accurately: the subjunctive, conditional sentences and object pronouns.',
      'Plan in Spanish using topic vocabulary, so you write in Spanish rather than translate.',
    ], [
      T('Check written accents last — they change meaning and tense, as in hablo and habló.'),
    ]),
    ch('Literature in Spanish', 2, AL, [
      'A Level Spanish includes set literary texts, with essays in Spanish on themes, characters and the writer’s techniques.',
      'Short quotations in Spanish support points about language and meaning.',
    ], [
      T('Keep quotations organised by theme rather than by chapter.'),
    ]),
    ch('Discussion & Debate', 2, AL, [
      'Speaking asks you to present and discuss topics, supporting opinions with reasons and examples.',
      'Practised expressions help fluency: « sin embargo », « a mi parecer », « por un lado… por otro lado ».',
    ], [
      R('Use the subjunctive where it belongs naturally — « aunque », « para que », « es importante que ».'),
    ]),
  ], [
    ch('Ser, Estar & the Present Tense', 1, CORE, [
      'Spanish has two verbs for "to be". Ser is for identity and lasting characteristics (soy estudiante); estar is for location and temporary states (estoy cansado).',
      'Present tense endings depend on the verb group: hablo, como, vivo.',
    ], [
      D('Ser — "to be" for identity, origin and permanent characteristics.'),
    ]),
    ch('Talking About the Past', 1, CORE, [
      'The preterite describes completed actions (ayer fui al cine); the imperfect describes what used to happen or was going on (cuando era pequeño, jugaba al fútbol).',
      'Many common verbs are irregular in the preterite — ir and ser even share the same forms: fui, fuiste, fue.',
    ], [
      T('Time phrases — ayer, el año pasado, cuando era pequeño — signal which past tense you need.'),
    ]),
    ch('Looking Ahead: Spanish at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Spanish expects the subjunctive, a wider range of tenses and longer writing on current issues.',
      'Reading and listening to real Spanish from different countries is the best preparation.',
    ], [
      T('Read one short Spanish news article a week and note five new words.'),
    ]),
  ]);

  subject('german', 'German', '9897', '0525', [
    ch('Reading & Translation', 1, AS, [
      'AS German tests comprehension of authentic texts and translation. Cases, word order and verb forms all carry marks.',
      'Translate meaning first, then check that every verb is in the right position.',
    ], [
      D('Konjunktiv II — the subjunctive used for hypothetical situations and polite requests: « wenn ich Zeit hätte, würde ich reisen ».'),
    ]),
    ch('Writing & Grammar', 1, AS, [
      'Essays reward varied structures: subordinate clauses, the passive, Konjunktiv II and correct adjective endings.',
      'Plan in German using topic vocabulary, so that you write in German rather than translate.',
    ], [
      T('Check adjective endings last — they depend on gender, case and the article in front.'),
    ]),
    ch('Literature in German', 2, AL, [
      'A Level German includes set literary texts, with essays in German on themes, characters and the writer’s techniques.',
      'Short quotations in German support points about language and meaning.',
    ], [
      T('Keep quotations organised by theme rather than by chapter.'),
    ]),
    ch('Discussion & Debate', 2, AL, [
      'Speaking asks you to present and discuss topics, supporting opinions with reasons and examples.',
      'Practised expressions help fluency: « einerseits… andererseits », « meiner Meinung nach », « trotzdem ».',
    ], [
      R('After weil, dass and obwohl, the verb goes to the end — even when you are speaking quickly.'),
    ]),
  ], [
    ch('Word Order', 1, CORE, [
      'In a main clause the verb is the second idea: Heute gehe ich ins Kino. After conjunctions such as weil and dass, the verb goes to the end: …, weil ich müde bin.',
      'Getting word order right is one of the clearest signs of control in German.',
    ], [
      D('Subordinate clause — a clause introduced by a conjunction such as weil or dass, which sends the verb to the end.'),
    ]),
    ch('Cases & Articles', 1, CORE, [
      'German nouns have three genders, and the article changes with case: der Hund (nominative), den Hund (accusative), dem Hund (dative).',
      'Prepositions decide the case after them — mit always takes the dative, für always the accusative.',
    ], [
      T('Learn every noun with its article and plural: der Tisch, die Tische.'),
    ]),
    ch('Looking Ahead: German at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS German expects secure cases and word order, plus the passive and Konjunktiv II, in longer writing on current issues.',
      'Reading and listening to real German — news, podcasts, films — is the best preparation.',
    ], [
      T('Read one short German news article a week and note five new words with their genders.'),
    ]),
  ]);

  subject('chinese', 'Chinese', '9868', '', [
    ch('Reading & Translation', 1, AS, [
      'AS Chinese tests reading comprehension of authentic texts and translation. Accurate characters and word order carry marks.',
      'Read for structure first — the topic, the time and the verb — before working out the detail.',
    ], [
      D('把 construction — a structure that puts the object before the verb to show what is done to it: 我把书放在桌子上。'),
    ]),
    ch('Writing', 1, AS, [
      'Essays reward a range of structures: 把 and 被 sentences, complements of result and degree, and paired connectives such as 虽然……但是.',
      'Plan in Chinese with topic vocabulary, so you write in Chinese rather than translate.',
    ], [
      T('Write characters carefully: a missing stroke can make a different character.'),
    ]),
    ch('Literature & Culture', 2, AL, [
      'A Level Chinese includes set texts, with essays in Chinese on their themes, characters and techniques.',
      'Short quotations in Chinese support points about language and meaning.',
    ], [
      T('Keep quotations organised by theme rather than by chapter.'),
    ]),
    ch('Discussion & Debate', 2, AL, [
      'Speaking asks you to present and discuss topics, supporting opinions with reasons and examples.',
      'Practised expressions help fluency: 一方面……另一方面, 我认为, 不过.',
    ], [
      R('Give a reason for every opinion — 因为…… is the simplest way to extend an answer.'),
    ]),
  ], [
    ch('Tones & Characters', 1, CORE, [
      'Mandarin has four tones and a neutral tone, and a change of tone changes the word: mā (妈, mother) and mǎ (马, horse) are different.',
      'Characters are built from components. The radical often hints at the meaning, as 氵 does in many words to do with water.',
    ], [
      D('Radical — the part of a character that often shows its meaning and is used to look it up.'),
    ]),
    ch('Sentence Patterns', 1, CORE, [
      'Basic word order is subject–verb–object, and time words come before the verb: 我明天去学校 (I am going to school tomorrow).',
      '了 after a verb marks a completed action, and 过 marks something experienced at some point.',
    ], [
      T('Learn measure words with their nouns: 一本书, 一个人, 一张纸.'),
    ]),
    ch('Looking Ahead: Chinese at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Chinese expects a wider range of structures and vocabulary, and longer writing on current issues.',
      'Reading real Chinese every week — news, short stories — builds character recognition faster than lists.',
    ], [
      T('Learn new characters in words, not alone: 学习, 学生, 学校 together.'),
    ]),
  ]);

  subject('arabic', 'Arabic', '9680', '0544', [
    ch('Reading & Translation', 1, AS, [
      'AS Arabic tests comprehension of authentic texts in Modern Standard Arabic, and translation. Agreement and verb forms carry marks.',
      'Use roots and verb patterns to work out unfamiliar words before reaching for a dictionary.',
    ], [
      D('Verb form (وزن) — one of the patterns, such as Form II فعّل, that change a root’s meaning in regular ways.'),
    ]),
    ch('Writing', 1, AS, [
      'Essays reward accurate grammar and a range of structures, including the derived verb forms and إنّ and its sisters.',
      'Plan in Arabic with topic vocabulary, so you write in Arabic rather than translate.',
    ], [
      T('Check that each adjective agrees with its noun in gender, number and definiteness.'),
    ]),
    ch('Literature & Culture', 2, AL, [
      'A Level Arabic includes set texts, with essays in Arabic on their themes, characters and techniques.',
      'Short quotations in Arabic support points about language and meaning.',
    ], [
      T('Keep quotations organised by theme rather than by chapter.'),
    ]),
    ch('Discussion & Debate', 2, AL, [
      'Speaking asks you to present and discuss topics, supporting opinions with reasons and examples.',
      'Practised expressions help fluency: من ناحية… ومن ناحية أخرى, في رأيي, ومع ذلك.',
    ], [
      R('Give a reason for every opinion — لأنّ… is the simplest way to extend an answer.'),
    ]),
  ], [
    ch('Roots & Patterns', 1, CORE, [
      'Most Arabic words are built on a root of three consonants that carries a core meaning. The root ك ت ب has to do with writing: كتب (he wrote), كتاب (book), مكتب (office or desk).',
      'Recognising the root helps you guess the meaning of words you have not met.',
    ], [
      D('Root — the three consonants that carry the basic meaning of a family of Arabic words.'),
    ]),
    ch('Verbs & Sentences', 1, CORE, [
      'Past-tense verbs change their endings for the person: كتبتُ (I wrote), كتبتَ (you wrote, to a man), كتبتْ (she wrote).',
      'A sentence can begin with the verb or with the noun; both are correct, with slightly different emphasis.',
    ], [
      T('Learn each verb in its past and present forms together: كتب / يكتب.'),
    ]),
    ch('Looking Ahead: Arabic at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Arabic expects the derived verb forms, accurate agreement and longer writing on current issues.',
      'Reading and listening to Modern Standard Arabic — news especially — is the best preparation.',
    ], [
      T('Read one short Arabic news article a week and note five new words with their roots.'),
    ]),
  ]);

  // ---------------------------------------------------------------------------
  // Arts and media
  // ---------------------------------------------------------------------------

  subject('art-design', 'Art & Design', '9479', '0400', [
    ch('Observation & Recording', 1, 'AS · Components 1–2', [
      'Recording from first-hand sources — drawing, photographing, collecting — is the foundation of every project. It shows how you see, not just what you saw.',
      'Annotations explain decisions and reflect on what worked, in the language of art: line, tone, colour, texture, form and composition.',
    ], [
      D('Composition — the arrangement of the elements within a work.'),
    ]),
    ch('Contextual Research', 1, 'AS · Components 1–2', [
      'Studying other artists gives you techniques and ideas to try in your own work — but the research only counts if it changes what you make.',
      'Analyse a work through its content, form, process and mood, then respond to it practically.',
    ], [
      T('After each artist study, make something of your own that uses one thing you learned from it.'),
    ]),
    ch('Personal Investigation', 2, 'A Level · Components 3–4', [
      'The personal investigation is a sustained project on a theme you choose, with practical work and a written element showing how your ideas developed.',
      'Strong investigations show a clear journey: research, experiment, refinement and a resolved outcome.',
    ], [
      T('Choose a theme you can live with for months — something you genuinely want to look at closely.'),
    ]),
    ch('Developing & Resolving Ideas', 2, 'A Level · Components 3–4', [
      'Development means testing ideas through media, scale and composition, and choosing the strongest to take forward.',
      'A final piece should feel like the conclusion of the work before it, not a fresh start.',
    ], [
      D('Resolved outcome — a final piece that brings together the ideas and skills developed through a project.'),
    ]),
  ], [
    ch('Drawing from Observation', 1, CORE, [
      'Drawing from life trains you to look. Measure proportions against each other, and look for the shapes of shadows rather than the outlines of objects.',
      'Tone — the range from light to dark — is what makes a drawing look three-dimensional.',
    ], [
      D('Tone — how light or dark something is.'),
    ]),
    ch('The Formal Elements', 1, CORE, [
      'Line, shape, tone, colour, texture, pattern and form are the building blocks of art.',
      'Colour theory helps: complementary colours, opposite each other on the colour wheel, make each other look stronger.',
    ], [
      T('Name the formal elements when you annotate your work.'),
    ]),
    ch('Looking Ahead: Art & Design at AS', 2, BRIDGE + ' · Components 1–2', [
      'AS Art & Design expects sustained projects with research, experiment and a clear line of development.',
      'Sketchbooks count as much as final pieces, because they show how you got there.',
    ], [
      T('Draw from life every week, even for ten minutes.'),
    ]),
  ]);

  subject('music', 'Music', '9483', '0410', [
    ch('Listening', 1, 'AS · Components 1–2', [
      'Listening questions ask you to identify and explain features of music you hear — instruments, texture, harmony, structure and style — in precise vocabulary.',
      'Set works and wider listening are compared: how one piece treats an idea differently from another.',
    ], [
      D('Texture — how the layers of sound combine: monophonic, homophonic or polyphonic.'),
    ]),
    ch('Performing', 1, 'AS · Components 1–2', [
      'Performing is assessed on accuracy, fluency, expression and understanding of style.',
      'Choose pieces that show your strengths at a level you can play securely under pressure.',
    ], [
      T('Record your practice and listen back. A recording shows what you miss while playing.'),
    ]),
    ch('Composing', 2, 'A Level · Components 3–4', [
      'Composition is assessed on how well ideas are developed and structured, and how idiomatically they are written for the instruments chosen.',
      'A short commentary explains your aims and how the piece achieves them.',
    ], [
      D('Idiomatic writing — music written to suit how an instrument or voice is actually played.'),
    ]),
    ch('Investigation & Report', 2, 'A Level · Components 3–4', [
      'The investigation explores one area of music in depth, supported by listening and score analysis.',
      'Analysis is strongest when it points to particular moments in the music, with bar numbers or timings.',
    ], [
      T('Reference the score precisely: "bar 32" beats "near the end".'),
    ]),
  ], [
    ch('Reading Music', 1, CORE, [
      'Staff notation shows pitch by a note’s position on the stave and rhythm by its shape. In 4/4, a crotchet lasts one beat and a minim two.',
      'The key signature shows which notes are sharp or flat throughout a piece.',
    ], [
      D('Time signature — the two numbers at the start of a piece that show how many beats are in a bar and what kind of beat.'),
    ]),
    ch('Listening & Describing', 1, CORE, [
      'Describe music through its elements: melody, rhythm, harmony, texture, timbre, dynamics and structure.',
      'Recognising instruments and their families by sound is the starting point for describing style.',
    ], [
      T('Listen to one piece a day and describe it in three sentences using musical terms.'),
    ]),
    ch('Looking Ahead: Music at AS', 2, BRIDGE + ' · Components 1–2', [
      'AS Music asks for more detailed listening and analysis, and for performances and compositions at a higher standard.',
      'Harmony — chords, cadences and keys — becomes central, so it is worth starting early.',
    ], [
      T('Learn the four main cadences — perfect, plagal, imperfect and interrupted — by ear.'),
    ]),
  ]);

  subject('drama', 'Drama', '9482', '0411', [
    ch('Text in Performance', 1, 'AS · Components 1–2', [
      'Set texts are studied as scripts for performance. Questions ask how you would stage a moment — through design, direction and acting — and what effect it would have on an audience.',
      'Justify every choice with reference to the text and the playwright’s intentions.',
    ], [
      D('Blocking — the planned movement and positioning of actors on stage.'),
    ]),
    ch('Devising', 1, 'AS · Components 1–2', [
      'Devising creates original theatre from a stimulus, and the process — research, improvisation, selection and refinement — is assessed alongside the performance.',
      'Keep a record of decisions and the reasons for them as you go.',
    ], [
      T('Note what you cut as well as what you kept, and why.'),
    ]),
    ch('Theatre Practitioners', 2, 'A Level · Components 3–4', [
      'Practitioners such as Stanislavski, Brecht and Artaud developed distinct approaches to acting and staging.',
      'Applying a practitioner means using their methods in practice, not just describing their ideas.',
    ], [
      D('Verfremdungseffekt — Brecht’s distancing effect, which reminds the audience they are watching a play so that they think critically.'),
    ]),
    ch('Critical Analysis', 2, 'A Level · Components 3–4', [
      'Written analysis connects text, context and performance, often comparing ways a play has been or could be staged.',
      'Strong essays use precise theatre vocabulary and specific moments from the text.',
    ], [
      T('Quote stage directions as well as dialogue — they are evidence too.'),
    ]),
  ], [
    ch('Performance Skills', 1, CORE, [
      'Voice and movement are an actor’s tools: pitch, pace, pause and volume; gesture, posture, facial expression and use of space.',
      'Every choice should tell the audience something about the character or the situation.',
    ], [
      D('Proxemics — the use of space and distance between performers to show relationships.'),
    ]),
    ch('Reading a Script', 1, CORE, [
      'A script gives dialogue and stage directions, but much is left to the director and actors. Subtext — what a character means but does not say — is where much of the drama lies.',
      'Read a scene asking what each character wants and what is stopping them getting it.',
    ], [
      T('For each character, write what they want in the scene in one sentence.'),
    ]),
    ch('Looking Ahead: Drama at AS', 2, BRIDGE + ' · Components 1–2', [
      'AS Drama combines practical work with written analysis of how plays work in performance.',
      'Seeing live theatre — any theatre — gives you examples to write about and ideas to use.',
    ], [
      T('After every play you see, note one staging choice and the effect it had on you.'),
    ]),
  ]);

  subject('media-studies', 'Media Studies', '9607', '', [
    ch('Media Language & Representation', 1, 'AS · Components 1–2', [
      'Media texts are constructed: camera, editing, sound and mise-en-scène are chosen to create meaning and to represent people, places and ideas in particular ways.',
      'Analysis links a specific technique to the meaning it creates.',
    ], [
      D('Mise-en-scène — everything placed in the frame: setting, props, costume, lighting and performance.'),
    ]),
    ch('The Production Portfolio', 1, 'AS · Components 1–2', [
      'The practical portfolio involves planning and making a media product, such as a film opening or a magazine, followed by a critical reflection on it.',
      'Research into real products in the same form shows the conventions you are using or challenging.',
    ], [
      T('Keep a production log from the first day; the reflection draws on it.'),
    ]),
    ch('Institutions & Audiences', 2, 'A Level · Components 3–4', [
      'Media are produced by institutions with economic and ideological aims, and consumed by audiences who interpret texts actively.',
      'Theories of audience — from effects models to uses and gratifications — give different answers to how much the media influence people.',
    ], [
      D('Uses and gratifications — the theory that audiences actively choose media to meet needs such as information or entertainment.'),
    ]),
    ch('Critical Perspectives', 2, 'A Level · Components 3–4', [
      'A Level asks you to apply theory to contemporary media, including digital and global media.',
      'Examples should be recent and specific: a named product, campaign or platform, with what it shows.',
    ], [
      T('Keep a file of current media examples, with one line on what each illustrates.'),
    ]),
  ], [
    ch('How Media Make Meaning', 1, CORE, [
      'Every image, video and headline is the result of choices. Camera angles, colours, words and music are selected to make an audience think or feel something.',
      'Asking "why this choice?" is the start of media analysis.',
    ], [
      D('Connotation — the associations an image, colour or word carries beyond its literal meaning.'),
    ]),
    ch('Audiences', 1, CORE, [
      'Media products are made for target audiences defined by age, interests and lifestyle.',
      'The same product can be read differently by different audiences.',
    ], [
      T('For any advert, name its target audience and three choices made to appeal to it.'),
    ]),
    ch('Looking Ahead: Media Studies at AS', 2, BRIDGE + ' · Components 1–2', [
      'AS Media Studies combines analysis of media texts with making your own, using the terms of media language precisely.',
      'Practical skills in filming, editing or layout make the portfolio far easier.',
    ], [
      T('Make something short now — a one-minute film or a magazine cover — to learn the tools before they are assessed.'),
    ]),
  ]);

  // ---------------------------------------------------------------------------
  // Applied subjects and reasoning
  // ---------------------------------------------------------------------------

  subject('travel-tourism', 'Travel & Tourism', '9395', '0471', [
    ch('The Travel & Tourism Industry', 1, AS, [
      'The industry includes transport, accommodation, tour operators, travel agents and attractions, linked through chains of distribution.',
      'Integration lets organisations control more of the chain: horizontally, by buying competitors, or vertically, by buying businesses at other stages.',
    ], [
      D('Vertical integration — when one organisation owns businesses at different stages of the chain, such as a tour operator owning an airline.'),
    ]),
    ch('Impacts of Tourism', 1, AS, [
      'Tourism brings economic, social, cultural and environmental impacts, both positive and negative.',
      'Sustainable tourism tries to increase the benefits to host communities while limiting the harm.',
    ], [
      T('Explain impacts for a named destination, and say who gains and who loses.'),
    ]),
    ch('Destination Management', 2, AL, [
      'Destinations go through stages of development. Butler’s tourism area life cycle describes exploration, involvement, development, consolidation and stagnation, followed by decline or rejuvenation.',
      'Destination management uses planning, marketing and regulation to keep a destination attractive and sustainable.',
    ], [
      D('Carrying capacity — the number of visitors a destination can take before it is damaged.'),
    ]),
    ch('Marketing & Customer Service', 2, AL, [
      'Marketing in travel and tourism uses research, segmentation and the marketing mix, adapted for services that cannot be stored or tried in advance.',
      'The quality of customer service is one of the main ways organisations compete.',
    ], [
      T('Use real organisations as examples in extended answers.'),
    ]),
  ], [
    ch('Why People Travel', 1, CORE, [
      'People travel for leisure, for business, and to visit friends and relatives.',
      'Destinations attract visitors with natural features, built attractions, culture and events.',
    ], [
      D('Domestic tourism — travel within a person’s own country.'),
    ]),
    ch('Tourism & Communities', 1, CORE, [
      'Tourism creates jobs and income, but it can also bring congestion, pollution and pressure on local culture.',
      'Responsible tourism aims to benefit local people and protect the environment.',
    ], [
      T('Give one positive and one negative impact of each type: economic, social and environmental.'),
    ]),
    ch('Looking Ahead: Travel & Tourism at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Travel & Tourism looks at the industry as a set of businesses, with more analysis of how they work and compete.',
      'Case studies of real destinations and organisations carry much of the credit.',
    ], [
      T('Choose two destinations — one near home, one far away — and follow them in the news.'),
    ]),
  ]);

  subject('thinking-skills', 'Thinking Skills', '9694', '', [
    ch('Problem Solving', 1, AS, [
      'Problem-solving questions give you data — tables, rules, timetables — and ask you to find solutions, often by organising the information systematically.',
      'The mathematics is rarely beyond IGCSE; the difficulty lies in reading carefully and choosing a method.',
    ], [
      T('Write down exactly what the question asks before calculating anything.'),
    ]),
    ch('Critical Thinking', 1, AS, [
      'Critical thinking questions ask you to analyse an argument: find its conclusion, reasons and assumptions, and identify any flaws.',
      'Common flaws include generalising from too few cases, confusing correlation with causation, and attacking a person instead of their argument.',
    ], [
      D('Assumption — an unstated step that an argument relies on.'),
    ]),
    ch('Applied Reasoning', 2, AL, [
      'Applied reasoning combines problem solving and critical thinking: modelling a situation, testing hypotheses, and judging which conclusions the data support.',
      'Good answers state their assumptions and check whether the conclusions survive when those assumptions change.',
    ], [
      T('Check every answer against the original information.'),
    ]),
    ch('Constructing Arguments', 2, AL, [
      'Writing your own argument means stating a conclusion, supporting it with reasons and evidence, and dealing with counter-arguments.',
      'An argument is strongest when its reasons are independent and each one is linked explicitly to the conclusion.',
    ], [
      D('Counter-argument — a reason against the conclusion, which a strong argument acknowledges and answers.'),
    ]),
  ], [
    ch('Reading Arguments', 1, CORE, [
      'An argument gives reasons to accept a conclusion. Finding the conclusion is the first step — words such as "therefore" and "so" often signal it.',
      'Then ask whether the reasons, if true, really support it.',
    ], [
      D('Conclusion — the claim an argument is trying to persuade you of.'),
    ]),
    ch('Solving Puzzles Systematically', 1, CORE, [
      'Many problems can be solved by listing the possibilities in an organised way, in a table, and crossing out those that break the rules.',
      'Checking your answer against every condition catches most mistakes.',
    ], [
      T('Draw a table before trying to solve a logic puzzle in your head.'),
    ]),
    ch('Looking Ahead: Thinking Skills at AS', 2, BRIDGE + ' · Papers 1–2', [
      'AS Thinking Skills sets unfamiliar problems and arguments, so the skill is method, not memorised content.',
      'Regular practice with puzzles and opinion articles builds both halves of the course.',
    ], [
      T('Pick one opinion article a week and write down its conclusion and its main reason.'),
    ]),
  ]);


  return { BASE: BASE, FOUNDATION: FOUNDATION };
}));
