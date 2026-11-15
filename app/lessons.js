/* Lesson bank — international A level.
 *
 * A lesson is a short teaching sequence a student can sit down with: a few
 * pages that explain the idea, a worked example, exercises they answer in
 * their own words, and an exam-style test at the end. Everything they type is
 * written into the notebook it was opened from, so the lesson leaves a record
 * in their own pages rather than in a store only this screen can read.
 *
 * Content is pitched at Cambridge International AS & A Level, whose syllabus
 * content is shared closely enough with Edexcel International A Level that the
 * same lesson serves both; `board` and `code` are labels shown on screen, not
 * logic. They are written against the 2023–2025 syllabuses — worth checking
 * against the current one for the student's exam year before leaning on a
 * paper reference in a report.
 *
 * ---------------------------------------------------------------------------
 * Shape of a lesson
 * ---------------------------------------------------------------------------
 *   id         stable string; progress is stored under it, so never reuse one
 *   subject    key into LESSONS
 *   title      what the student sees in the lesson list
 *   board      e.g. 'Cambridge International AS & A Level'
 *   code       syllabus number, e.g. '9709'
 *   paper      which paper this sits on
 *   topic      syllabus section
 *   minutes    rough sitting time, shown before starting
 *   objectives what they should be able to do afterwards
 *   terms      [{ term, meaning }] — written into the chapter as Definition
 *              notes, which is what makes them turn up in Recall afterwards
 *   teach      [{ heading, body: [para], example: { prompt, steps: [line] } }]
 *   exercises  [{ ask, marks, hint, answer, scheme: [line], why }]
 *   test       { heading, questions: [{ ask, marks, answer, scheme: [line] }] }
 *
 * Any string in `body`, `ask`, `answer`, `scheme`, `steps` or `why` may carry
 * LaTeX between dollar signs — `$x^2 + 3x$`. The notebook renders those through
 * its own converter, so maths in a lesson looks like maths the student wrote
 * with the formula key.
 *
 * ---------------------------------------------------------------------------
 * Where an AI model would plug in
 * ---------------------------------------------------------------------------
 * `generate` is the one seam. It is null here, and the notebook falls back to
 * this bank whenever it is null or throws, so the app works with no network and
 * no key. To make lessons personal, set it to a function with this contract:
 *
 *   window.notivloLessons.generate = function (request) {
 *     // request: { subject, title, code, level, after: [lessonId], notes: [string] }
 *     // resolve with one lesson object in the shape above, or null to fall back
 *     return Promise.resolve(lesson);
 *   };
 *
 * It must not hold a model key. This app ships as a file:// bundle inside the
 * Mac and iOS wrappers, so anything in these files travels with the app and can
 * be read out of it; its CSP also allows connect-src only to self and this
 * project's own Supabase host. Both point the same way: an Edge Function that holds
 * the key server-side, checks the signed-in user, and returns validated JSON.
 * Validate on the way back in — a lesson is rendered as text, but `marks` is
 * arithmetic and a missing `scheme` would leave a student self-marking against
 * nothing.
 */
(function () {
  'use strict';

  // Notebook slugs and titles that mean the same subject. Setup slugifies
  // whatever the student tapped, so 'Maths' arrives as 'maths' and has to find
  // the mathematics lessons; a notebook they named themselves is matched on the
  // words in its title.
  var ALIASES = {
    mathematics: 'mathematics', maths: 'mathematics', math: 'mathematics',
    'further-mathematics': 'mathematics', 'further-maths': 'mathematics',
    'pure-mathematics': 'mathematics', 'linear-algebra': 'mathematics',
    physics: 'physics',
    chemistry: 'chemistry', 'organic-chemistry': 'chemistry',
    biology: 'biology',
    economics: 'economics', macroeconomics: 'economics', microeconomics: 'economics',
    'english-literature': 'english-literature', english: 'english-literature',
    literature: 'english-literature',
    'computer-science': 'computer-science', computing: 'computer-science',
    'computer-studies': 'computer-science',
  };

  var TITLE_WORDS = [
    [/further\s*math|pure\s*math|\bmath|mathematic|algebra|calculus|statistic/i, 'mathematics'],
    [/physic|mechanic/i, 'physics'],
    [/chemist/i, 'chemistry'],
    [/biolog/i, 'biology'],
    [/econom/i, 'economics'],
    [/literature|english/i, 'english-literature'],
    [/comput|programming|\bcs\b/i, 'computer-science'],
  ];

  var CIE = 'Cambridge International AS & A Level';

  var LESSONS = {

    /* ------------------------------------------------------------------ */
    mathematics: [{
      id: 'math-quadratics',
      subject: 'mathematics',
      title: 'Quadratics: completed square and the discriminant',
      board: CIE,
      code: '9709',
      paper: 'Paper 1 — Pure Mathematics 1',
      topic: '1.1 Quadratics',
      minutes: 25,
      objectives: [
        'Write any quadratic in completed-square form and read its vertex straight off',
        'Use the discriminant to say how many real roots an equation has',
        'Turn "does this line meet this curve?" into a discriminant question',
      ],
      terms: [
        { term: 'Discriminant', meaning: 'the quantity $b^2 - 4ac$ for $ax^2+bx+c=0$; its sign gives the number of real roots' },
        { term: 'Completed square form', meaning: '$a(x+p)^2 + q$; the vertex is at $(-p,\\ q)$ and $q$ is the least value when $a>0$' },
      ],
      teach: [{
        heading: 'Completing the square',
        body: [
          'Every quadratic can be written as $a(x+p)^2 + q$. That form is worth the algebra because it answers three questions at once: where the vertex is, what the least (or greatest) value is, and what the roots are — without a formula.',
          'The method is always the same. Take the $a$ out of the first two terms, halve the coefficient of $x$ inside the bracket, square the bracket and subtract what you added by squaring.',
        ],
        example: {
          prompt: 'Solve $x^2 - 6x + 4 = 0$ by completing the square.',
          steps: [
            'Half of $-6$ is $-3$, so the bracket is $(x-3)^2$.',
            '$(x-3)^2 = x^2 - 6x + 9$, which is $9$ too much, so $x^2 - 6x + 4 = (x-3)^2 - 9 + 4 = (x-3)^2 - 5$.',
            'Set it to zero: $(x-3)^2 = 5$.',
            'Square root both sides, keeping both signs: $x - 3 = \\pm\\sqrt{5}$, so $x = 3 \\pm \\sqrt{5}$.',
          ],
        },
      }, {
        heading: 'What the discriminant tells you',
        body: [
          'For $ax^2+bx+c=0$ the discriminant is $b^2-4ac$. If it is positive there are two distinct real roots; if it is zero there is one repeated root; if it is negative there are no real roots at all.',
          'Notice what each of those means on a graph: two roots is a curve cutting the $x$-axis twice, a repeated root is a curve touching it once — which is what "tangent" means — and a negative discriminant is a curve that misses the axis entirely.',
        ],
        example: {
          prompt: 'The equation $x^2 + kx + 4 = 0$ has two distinct real roots. Find the possible values of $k$.',
          steps: [
            'Two distinct real roots means $b^2 - 4ac > 0$.',
            'Here $a=1$, $b=k$, $c=4$, so $k^2 - 16 > 0$.',
            '$k^2 > 16$, so $k > 4$ or $k < -4$.',
          ],
        },
      }, {
        heading: 'Lines meeting curves',
        body: [
          'A question that asks whether a line meets a curve, cuts it twice, or is a tangent to it is a discriminant question in disguise. Set the two expressions equal, collect everything on one side, and look at the sign of $b^2-4ac$ for the quadratic you are left with.',
          'Write the conclusion out in words at the end. The marks are for the deduction — "the discriminant is negative, so there are no real solutions and the line does not meet the curve" — not for the number on its own.',
        ],
        example: {
          prompt: 'Show that the line $y = x - 4$ is a tangent to the curve $y = x^2 - 3x$.',
          steps: [
            'Equate them: $x^2 - 3x = x - 4$.',
            'Collect: $x^2 - 4x + 4 = 0$.',
            'Discriminant: $(-4)^2 - 4(1)(4) = 16 - 16 = 0$.',
            'A zero discriminant means one repeated root, so the line meets the curve exactly once — it is a tangent.',
          ],
        },
      }],
      exercises: [{
        ask: 'Express $2x^2 + 8x + 5$ in the form $a(x+b)^2 + c$.',
        marks: 3,
        hint: 'Take the 2 out of the first two terms before you halve anything.',
        answer: '$2(x+2)^2 - 3$',
        scheme: [
          'B1 — $a = 2$ and $b = 2$ (from $2(x^2+4x)$ and halving $4$)',
          'M1 — subtracting what the bracket added: $2[(x+2)^2 - 4] + 5$',
          'A1 — $c = -3$, giving $2(x+2)^2 - 3$',
        ],
        why: '$2x^2+8x+5 = 2(x^2+4x)+5$. Inside the bracket, $(x+2)^2 = x^2+4x+4$, so $x^2+4x = (x+2)^2 - 4$. Then $2[(x+2)^2-4]+5 = 2(x+2)^2 - 8 + 5 = 2(x+2)^2 - 3$.',
      }, {
        ask: 'Find the values of $k$ for which $x^2 + kx + 9 = 0$ has a repeated root.',
        marks: 3,
        hint: 'Repeated root is the one case where the discriminant is exactly zero.',
        answer: '$k = 6$ or $k = -6$',
        scheme: [
          'M1 — using $b^2 - 4ac = 0$',
          'A1 — $k^2 - 36 = 0$',
          'A1 — both values, $k = \\pm 6$',
        ],
        why: 'With $a=1$, $b=k$, $c=9$ the discriminant is $k^2-36$. Setting it to zero gives $k^2=36$, so $k=\\pm 6$. Dropping the negative value is the usual lost mark here.',
      }, {
        ask: 'The curve $y = 3 + 4x - x^2$ has a greatest value. Find that value and the value of $x$ at which it occurs.',
        marks: 4,
        hint: 'The coefficient of $x^2$ is negative, so factor out $-1$ first and expect a maximum.',
        answer: 'Greatest value $7$, at $x = 2$',
        scheme: [
          'M1 — $-(x^2 - 4x) + 3$, taking out the $-1$',
          'M1 — $-[(x-2)^2 - 4] + 3$',
          'A1 — $7 - (x-2)^2$',
          'A1 — greatest value $7$ when $x = 2$',
        ],
        why: '$3 + 4x - x^2 = -(x^2-4x)+3 = -[(x-2)^2-4]+3 = 7-(x-2)^2$. Since $(x-2)^2$ is never negative, the most $y$ can be is $7$, reached when $(x-2)^2 = 0$, i.e. $x = 2$.',
      }, {
        ask: 'Show that the line $y = 2x + 1$ does not intersect the curve $y = x^2 + 3x + 4$.',
        marks: 4,
        hint: 'Equate, collect, then look at the sign of the discriminant — and say what the sign means.',
        answer: 'The resulting equation $x^2 + x + 3 = 0$ has discriminant $-11 < 0$, so there are no real solutions and the line and curve do not meet.',
        scheme: [
          'M1 — equating: $x^2 + 3x + 4 = 2x + 1$',
          'A1 — $x^2 + x + 3 = 0$',
          'M1 — discriminant $1^2 - 4(1)(3)$',
          'A1 — $= -11 < 0$, no real roots, so no intersection (conclusion stated)',
        ],
        why: 'Equating gives $x^2 + x + 3 = 0$, whose discriminant is $1 - 12 = -11$. A negative discriminant means no real $x$ satisfies the equation, so there is no point lying on both graphs. The final mark is for writing that sentence, not for the $-11$.',
      }],
      test: {
        heading: 'Exam-style check — 10 marks',
        questions: [{
          ask: 'Solve $3x^2 - 7x + 2 = 0$.',
          marks: 3,
          answer: '$x = \\frac{1}{3}$ or $x = 2$',
          scheme: ['M1 — factorising to $(3x-1)(x-2)$ or correct use of the formula', 'A1 — $x = \\frac{1}{3}$', 'A1 — $x = 2$'],
        }, {
          ask: 'Find the values of $k$ for which the line $y = kx - 2$ is a tangent to the curve $y = x^2 + 3$.',
          marks: 4,
          answer: '$k = \\pm 2\\sqrt{5}$',
          scheme: [
            'M1 — equating and collecting: $x^2 - kx + 5 = 0$',
            'M1 — setting the discriminant to zero: $k^2 - 20 = 0$',
            'A1 — $k^2 = 20$',
            'A1 — $k = 2\\sqrt{5}$ and $k = -2\\sqrt{5}$',
          ],
        }, {
          ask: 'Express $5 - 6x - x^2$ in the form $a - (x+b)^2$ and hence state the greatest value of the expression.',
          marks: 3,
          answer: '$14 - (x+3)^2$; greatest value $14$',
          scheme: ['B1 — $b = 3$', 'B1 — $a = 14$', 'B1 — greatest value $14$ (at $x = -3$)'],
        }],
      },
    }],

    /* ------------------------------------------------------------------ */
    physics: [{
      id: 'phys-kinematics',
      subject: 'physics',
      title: 'Uniform acceleration and projectile motion',
      board: CIE,
      code: '9702',
      paper: 'Paper 2 — AS Level Structured Questions',
      topic: '2.1 Equations of motion',
      minutes: 30,
      objectives: [
        'Choose the right equation of motion from what a question gives you',
        'Treat horizontal and vertical motion of a projectile separately',
        'Say what changes, and why, once air resistance is not ignored',
      ],
      terms: [
        { term: 'Uniform acceleration', meaning: 'acceleration that is constant in size and direction — the only case in which the suvat equations hold' },
        { term: 'Projectile', meaning: 'a body moving freely under gravity alone, so that $a_x = 0$ and $a_y = g$ downwards' },
      ],
      teach: [{
        heading: 'The four equations, and when they apply',
        body: [
          'For motion in a straight line with constant acceleration: $v = u + at$, $s = ut + \\frac{1}{2}at^2$, $v^2 = u^2 + 2as$, and $s = \\frac{(u+v)}{2}t$.',
          'Each leaves out one quantity — the first has no $s$, the second no $v$, the third no $t$, the fourth no $a$. So the quickest route through a question is to list $s$, $u$, $v$, $a$, $t$, mark which three you know, and pick the equation that avoids the one you neither know nor want.',
          'They hold only while the acceleration is constant. A braking car whose brakes are then released, or a ball during its bounce, needs the motion split into stages.',
        ],
        example: {
          prompt: 'A train accelerates uniformly from $6.0\\ \\text{m s}^{-1}$ to $24\\ \\text{m s}^{-1}$ over $300\\ \\text{m}$. Find its acceleration.',
          steps: [
            'Known: $u = 6.0$, $v = 24$, $s = 300$. Wanted: $a$. Missing: $t$ — so use $v^2 = u^2 + 2as$.',
            '$24^2 = 6.0^2 + 2a(300)$',
            '$576 - 36 = 600a$, so $a = 0.90\\ \\text{m s}^{-2}$.',
          ],
        },
      }, {
        heading: 'Projectiles: two motions at once',
        body: [
          'Once a body is in flight with only gravity acting, its horizontal velocity never changes and its vertical velocity changes at $9.81\\ \\text{m s}^{-2}$ downwards. The two are independent and share only one thing: the time of flight.',
          'So resolve the launch velocity once, at the start — $u_x = u\\cos\\theta$ and $u_y = u\\sin\\theta$ — then keep two columns of working and never mix them.',
          'At the highest point the vertical velocity is zero, not the speed: the body is still travelling horizontally at $u_x$.',
        ],
        example: {
          prompt: 'A ball is thrown horizontally at $15\\ \\text{m s}^{-1}$ from a cliff $20\\ \\text{m}$ high. How far from the base does it land? Take $g = 9.81\\ \\text{m s}^{-2}$.',
          steps: [
            'Vertical, to find the time: $s = ut + \\frac{1}{2}at^2$ with $u_y = 0$, so $20 = \\frac{1}{2}(9.81)t^2$.',
            '$t^2 = 4.077$, so $t = 2.02\\ \\text{s}$.',
            'Horizontal, with no acceleration: $x = u_x t = 15 \\times 2.02 = 30.3\\ \\text{m}$.',
          ],
        },
      }, {
        heading: 'What air resistance does to the picture',
        body: [
          'Air resistance acts against the direction of motion and grows with speed. Horizontally it means $u_x$ is no longer constant, so the range is shorter; vertically it means the body decelerates faster going up than it accelerates coming down.',
          'The result is a trajectory that is no longer symmetrical: the descent is steeper than the ascent, the peak is reached earlier than halfway through the flight, and the landing speed is less than the launch speed.',
          'Questions ask for these as explanations, so each statement needs its reason attached — "the range is smaller because the horizontal velocity decreases during the flight" scores where "the range is smaller" does not.',
        ],
      }],
      exercises: [{
        ask: 'A car accelerates uniformly from $8.0\\ \\text{m s}^{-1}$ to $20\\ \\text{m s}^{-1}$ in $6.0\\ \\text{s}$. Calculate (i) the acceleration and (ii) the distance travelled.',
        marks: 4,
        hint: 'For the distance, the average-velocity equation avoids squaring anything.',
        answer: '(i) $2.0\\ \\text{m s}^{-2}$  (ii) $84\\ \\text{m}$',
        scheme: [
          'C1 — $a = \\frac{(v-u)}{t} = \\frac{(20-8.0)}{6.0}$',
          'A1 — $a = 2.0\\ \\text{m s}^{-2}$',
          'C1 — $s = \\frac{(u+v)}{2}t = \\frac{(8.0+20)}{2}\\times 6.0$',
          'A1 — $s = 84\\ \\text{m}$',
        ],
        why: 'The acceleration is the velocity change over the time, $12/6.0 = 2.0\\ \\text{m s}^{-2}$. For the distance, the mean velocity is $14\\ \\text{m s}^{-1}$ because the acceleration is uniform, and $14 \\times 6.0 = 84\\ \\text{m}$.',
      }, {
        ask: 'A stone is dropped from rest into a well and hits the water $1.8\\ \\text{s}$ later. Calculate the depth of the well and the speed of the stone on impact. Take $g = 9.81\\ \\text{m s}^{-2}$.',
        marks: 4,
        hint: 'Dropped from rest means $u = 0$, which simplifies both equations.',
        answer: 'Depth $15.9\\ \\text{m}$; impact speed $17.7\\ \\text{m s}^{-1}$',
        scheme: [
          'C1 — $s = \\frac{1}{2}at^2 = \\frac{1}{2}(9.81)(1.8)^2$',
          'A1 — $s = 15.9\\ \\text{m}$ (accept $16\\ \\text{m}$)',
          'C1 — $v = at = 9.81 \\times 1.8$',
          'A1 — $v = 17.7\\ \\text{m s}^{-1}$',
        ],
        why: 'With $u=0$, $s = \\frac{1}{2}at^2 = \\frac{1}{2}(9.81)(3.24) = 15.9\\ \\text{m}$ and $v = u + at = 17.7\\ \\text{m s}^{-1}$. Using $v^2 = u^2+2as$ with the rounded depth gives the same answer and is equally acceptable.',
      }, {
        ask: 'A ball is projected at $25\\ \\text{m s}^{-1}$ at $30^\\circ$ above the horizontal from level ground. Air resistance is negligible. Calculate the maximum height reached and the horizontal range.',
        marks: 5,
        hint: 'Resolve first. At the top, $v_y = 0$; the range needs the whole time of flight, not half of it.',
        answer: 'Maximum height $7.96\\ \\text{m}$; range $55.2\\ \\text{m}$',
        scheme: [
          'C1 — $u_y = 25\\sin 30^\\circ = 12.5\\ \\text{m s}^{-1}$ and $u_x = 25\\cos 30^\\circ = 21.7\\ \\text{m s}^{-1}$',
          'C1 — $0 = u_y^2 - 2gh$ at the top',
          'A1 — $h = 7.96\\ \\text{m}$',
          'C1 — time of flight $t = \\frac{2u_y}{g} = 2.55\\ \\text{s}$',
          'A1 — range $= u_x t = 55.2\\ \\text{m}$',
        ],
        why: 'Resolving gives $u_y = 12.5$ and $u_x = 21.65$. Vertically, $v^2 = u^2 - 2gh$ with $v = 0$ gives $h = 12.5^2/(2\\times 9.81) = 7.96\\ \\text{m}$. The flight lasts $2u_y/g = 2.55\\ \\text{s}$, and the horizontal velocity is unchanged throughout, so the range is $21.65 \\times 2.55 = 55.2\\ \\text{m}$.',
      }, {
        ask: 'Explain why, when air resistance is taken into account, the ball in the previous question travels a shorter horizontal distance and its path is no longer symmetrical.',
        marks: 3,
        hint: 'Say what the force does to each component of the velocity, then what that does to the shape.',
        answer: 'Air resistance acts opposite to the motion, so the horizontal velocity falls during the flight and less horizontal distance is covered. Going up, resistance and weight both act downwards, so the ball decelerates more quickly and rises for less time than it falls; coming down resistance opposes the weight, so the descent is slower and steeper than the ascent, making the path asymmetrical.',
        scheme: [
          'B1 — horizontal velocity is no longer constant, so the range is reduced',
          'B1 — on the way up, resistance acts with the weight; on the way down, against it',
          'B1 — so the time up is less than the time down / the descent is steeper, giving an asymmetrical path',
        ],
        why: 'Three separate statements are needed, each with its cause. The common loss is describing the shape ("it is squashed on one side") without naming the force that makes it so.',
      }],
      test: {
        heading: 'Exam-style check — 10 marks',
        questions: [{
          ask: 'A cyclist travelling at $12\\ \\text{m s}^{-1}$ brakes uniformly and stops in $15\\ \\text{m}$. Calculate the deceleration.',
          marks: 3,
          answer: '$4.8\\ \\text{m s}^{-2}$ (a deceleration, i.e. $a = -4.8\\ \\text{m s}^{-2}$)',
          scheme: ['C1 — using $v^2 = u^2 + 2as$ with $v = 0$', 'C1 — $0 = 144 + 30a$', 'A1 — $a = -4.8\\ \\text{m s}^{-2}$, deceleration $4.8\\ \\text{m s}^{-2}$'],
        }, {
          ask: 'A projectile is launched horizontally from a height of $45\\ \\text{m}$ and lands $60\\ \\text{m}$ from the base of the launch point. Calculate its initial speed. Take $g = 9.81\\ \\text{m s}^{-2}$.',
          marks: 4,
          answer: '$19.8\\ \\text{m s}^{-1}$',
          scheme: [
            'C1 — vertical: $45 = \\frac{1}{2}(9.81)t^2$',
            'A1 — $t = 3.03\\ \\text{s}$',
            'C1 — horizontal: $u = \\frac{60}{t}$',
            'A1 — $u = 19.8\\ \\text{m s}^{-1}$ (accept $19.8$–$19.9$)',
          ],
        }, {
          ask: 'A ball is thrown vertically upwards and caught again at the same height. Describe its velocity–time graph and state what the area between the graph and the time axis represents.',
          marks: 3,
          answer: 'A straight line of constant negative gradient, starting at $+u$, crossing zero at the highest point and reaching $-u$ on return. The area between graph and axis is the displacement: the two triangles are equal and opposite, so the total is zero, while their combined magnitude gives the total distance.',
          scheme: [
            'B1 — straight line, constant negative gradient equal to $-g$',
            'B1 — crosses the time axis at the highest point, finishing at $-u$',
            'B1 — area represents displacement (zero overall; twice the rise in magnitude)',
          ],
        }],
      },
    }],

    /* ------------------------------------------------------------------ */
    chemistry: [{
      id: 'chem-moles-titration',
      subject: 'chemistry',
      title: 'Moles, concentration and titration calculations',
      board: CIE,
      code: '9701',
      paper: 'Paper 2 — AS Level Structured Questions',
      topic: '1 Atoms, molecules and stoichiometry',
      minutes: 30,
      objectives: [
        'Move between mass, moles, concentration and gas volume without hesitating',
        'Use a balanced equation to get from one substance to another',
        'Explain how a practical slip changes the titre and the answer that follows from it',
      ],
      terms: [
        { term: 'Concordant titres', meaning: 'titres agreeing within $0.10\\ \\text{cm}^3$; only these are averaged, because the rest are not repeats of the same measurement' },
        { term: 'Molar gas volume', meaning: 'the volume of one mole of any gas, $24.0\\ \\text{dm}^3$ at room temperature and pressure' },
      ],
      teach: [{
        heading: 'Three routes into moles',
        body: [
          'Almost every calculation in this topic starts by turning something measurable into moles. From a mass, $n = \\frac{m}{M}$. From a solution, $n = \\frac{cV}{1000}$ with $V$ in $\\text{cm}^3$. From a gas at r.t.p., $n = \\frac{V}{24.0}$ with $V$ in $\\text{dm}^3$.',
          'Units cause more lost marks here than chemistry does. Decide at the start whether you are working in $\\text{cm}^3$ or $\\text{dm}^3$ and write the unit next to every number.',
        ],
        example: {
          prompt: 'Calculate the number of moles in $4.00\\ \\text{g}$ of $\\text{NaOH}$ ($M_r = 40.0$).',
          steps: ['$n = \\frac{m}{M} = \\frac{4.00}{40.0}$', '$n = 0.100\\ \\text{mol}$'],
        },
      }, {
        heading: 'Across the equation, then back out',
        body: [
          'The balanced equation is the only bridge between two different substances. The pattern is always: measurable quantity → moles of A → moles of B using the ratio → whatever the question asks for.',
          'Write the ratio down explicitly before using it. A $1:2$ ratio used upside down is the single most common error in this topic, and it is invisible in the final line of working.',
        ],
        example: {
          prompt: '$25.0\\ \\text{cm}^3$ of $\\text{NaOH}$ is exactly neutralised by $22.50\\ \\text{cm}^3$ of $0.100\\ \\text{mol dm}^{-3}$ $\\text{H}_2\\text{SO}_4$. Find the concentration of the $\\text{NaOH}$.',
          steps: [
            '$n(\\text{H}_2\\text{SO}_4) = \\frac{0.100 \\times 22.50}{1000} = 2.25\\times 10^{-3}\\ \\text{mol}$',
            '$\\text{H}_2\\text{SO}_4 + 2\\text{NaOH} \\rightarrow \\text{Na}_2\\text{SO}_4 + 2\\text{H}_2\\text{O}$, so the ratio is $1:2$',
            '$n(\\text{NaOH}) = 4.50\\times 10^{-3}\\ \\text{mol}$',
            '$c = \\frac{n \\times 1000}{V} = \\frac{4.50\\times 10^{-3}\\times 1000}{25.0} = 0.180\\ \\text{mol dm}^{-3}$',
          ],
        },
      }, {
        heading: 'Why the practical detail is examined',
        body: [
          'A titration answer is only as good as the titre, so questions ask what a particular mistake would do to it. Work it through in two steps: does the mistake add or remove moles of the solution in the burette, and therefore is the titre too large or too small?',
          'Then follow it into the arithmetic. A titre that is too large makes $n$ in the burette look larger, which makes the calculated concentration of the substance in the flask look larger too.',
          'Rinsing the conical flask with the solution to be titrated, rather than with distilled water, is the classic example: it leaves extra moles in the flask, so more is needed from the burette, so the titre and the final concentration both come out too high.',
        ],
      }],
      exercises: [{
        ask: 'Calculate the mass of $0.250\\ \\text{mol}$ of calcium carbonate, $\\text{CaCO}_3$ ($M_r = 100.1$).',
        marks: 2,
        hint: 'One rearrangement, no equation needed.',
        answer: '$25.0\\ \\text{g}$',
        scheme: ['M1 — $m = n \\times M = 0.250 \\times 100.1$', 'A1 — $25.0\\ \\text{g}$ (3 s.f.)'],
        why: '$m = nM = 0.250 \\times 100.1 = 25.025$, which is $25.0\\ \\text{g}$ to three significant figures.',
      }, {
        ask: '$2.00\\ \\text{g}$ of impure calcium carbonate reacts with excess hydrochloric acid, producing $0.400\\ \\text{dm}^3$ of carbon dioxide at r.t.p. Calculate the percentage purity of the sample. ($M_r$ of $\\text{CaCO}_3 = 100.1$, molar gas volume $= 24.0\\ \\text{dm}^3\\ \\text{mol}^{-1}$)',
        marks: 4,
        hint: 'Gas volume to moles, across a 1:1 ratio, back to a mass — then compare with 2.00 g.',
        answer: '$83.4\\%$',
        scheme: [
          'M1 — $n(\\text{CO}_2) = \\frac{0.400}{24.0} = 1.67\\times 10^{-2}\\ \\text{mol}$',
          'M1 — ratio $1:1$, so $n(\\text{CaCO}_3) = 1.67\\times 10^{-2}\\ \\text{mol}$',
          'M1 — $m(\\text{CaCO}_3) = 1.67\\times 10^{-2} \\times 100.1 = 1.67\\ \\text{g}$',
          'A1 — purity $= \\frac{1.67}{2.00}\\times 100 = 83.4\\%$',
        ],
        why: '$\\text{CaCO}_3 + 2\\text{HCl} \\rightarrow \\text{CaCl}_2 + \\text{H}_2\\text{O} + \\text{CO}_2$ is $1:1$ in carbonate and carbon dioxide. $0.400/24.0 = 0.01667\\ \\text{mol}$ of gas means the same number of moles of carbonate, a mass of $1.669\\ \\text{g}$, and so $83.4\\%$ of the $2.00\\ \\text{g}$ sample.',
      }, {
        ask: '$20.0\\ \\text{cm}^3$ of $0.0500\\ \\text{mol dm}^{-3}$ sodium carbonate solution is exactly neutralised by $18.70\\ \\text{cm}^3$ of hydrochloric acid. Calculate the concentration of the acid.',
        marks: 3,
        hint: 'Write the equation out — the ratio is not 1:1.',
        answer: '$0.107\\ \\text{mol dm}^{-3}$',
        scheme: [
          'M1 — $n(\\text{Na}_2\\text{CO}_3) = \\frac{0.0500\\times 20.0}{1000} = 1.00\\times 10^{-3}\\ \\text{mol}$',
          'M1 — ratio $1:2$, so $n(\\text{HCl}) = 2.00\\times 10^{-3}\\ \\text{mol}$',
          'A1 — $c = \\frac{2.00\\times 10^{-3}\\times 1000}{18.70} = 0.107\\ \\text{mol dm}^{-3}$',
        ],
        why: '$\\text{Na}_2\\text{CO}_3 + 2\\text{HCl} \\rightarrow 2\\text{NaCl} + \\text{H}_2\\text{O} + \\text{CO}_2$, so each mole of carbonate takes two of acid. $1.00\\times10^{-3}$ becomes $2.00\\times10^{-3}\\ \\text{mol}$ in $18.70\\ \\text{cm}^3$, which is $0.107\\ \\text{mol dm}^{-3}$.',
      }, {
        ask: 'A student rinses the conical flask with the alkali to be titrated instead of with distilled water. Explain the effect on the titre and on the calculated concentration of the alkali.',
        marks: 3,
        hint: 'Count the moles in the flask before the titration starts.',
        answer: 'The rinsing leaves extra alkali in the flask, so more acid is needed to reach the end point and the titre is larger than it should be. A larger titre gives a larger calculated number of moles of alkali, so the concentration found is too high.',
        scheme: [
          'B1 — extra moles of alkali are present in the flask',
          'B1 — so the titre is too large',
          'B1 — so the calculated concentration of the alkali is too high',
        ],
        why: 'Three marks, three steps: more moles present, larger titre, higher calculated concentration. Answers that stop at "it would be inaccurate" earn none of them.',
      }],
      test: {
        heading: 'Exam-style check — 8 marks',
        questions: [{
          ask: '$0.0250\\ \\text{mol}$ of $\\text{H}_2\\text{SO}_4$ is dissolved in water and made up to $250\\ \\text{cm}^3$. Calculate the concentration in $\\text{mol dm}^{-3}$.',
          marks: 2,
          answer: '$0.100\\ \\text{mol dm}^{-3}$',
          scheme: ['M1 — $c = \\frac{n}{V}$ with $V = 0.250\\ \\text{dm}^3$', 'A1 — $0.100\\ \\text{mol dm}^{-3}$'],
        }, {
          ask: 'Calculate the volume of $0.200\\ \\text{mol dm}^{-3}$ potassium hydroxide needed to neutralise $25.0\\ \\text{cm}^3$ of $0.150\\ \\text{mol dm}^{-3}$ sulfuric acid.',
          marks: 3,
          answer: '$37.5\\ \\text{cm}^3$',
          scheme: [
            'M1 — $n(\\text{H}_2\\text{SO}_4) = 3.75\\times 10^{-3}\\ \\text{mol}$',
            'M1 — ratio $1:2$, so $n(\\text{KOH}) = 7.50\\times 10^{-3}\\ \\text{mol}$',
            'A1 — $V = 37.5\\ \\text{cm}^3$',
          ],
        }, {
          ask: 'A burette is filled with acid but an air bubble in the tip escapes during the titration. State and explain the effect on the titre.',
          marks: 3,
          answer: 'The titre is too large: the volume reading includes the space the bubble occupied, so the burette appears to have delivered more acid than actually reached the flask. The calculated concentration of the substance in the flask is therefore too high.',
          scheme: ['B1 — titre too large', 'B1 — because the bubble’s volume is counted as delivered acid', 'B1 — calculated concentration too high'],
        }],
      },
    }],

    /* ------------------------------------------------------------------ */
    biology: [{
      id: 'bio-enzymes',
      subject: 'biology',
      title: 'Enzymes: mode of action, rate and inhibition',
      board: CIE,
      code: '9700',
      paper: 'Paper 2 — AS Level Structured Questions',
      topic: '3 Enzymes',
      minutes: 25,
      objectives: [
        'Explain specificity from the structure of the active site',
        'Account for the shape of rate graphs against temperature, pH and substrate concentration',
        'Distinguish competitive from non-competitive inhibition by their effect on the rate',
      ],
      terms: [
        { term: 'Active site', meaning: 'a depression on the enzyme whose shape and charge are complementary to the substrate, formed by the tertiary structure' },
        { term: 'Denaturation', meaning: 'loss of the tertiary structure as hydrogen and ionic bonds break, so the active site is no longer complementary to the substrate' },
      ],
      teach: [{
        heading: 'Why one enzyme takes one substrate',
        body: [
          'The active site is held in shape by the tertiary structure of the protein — hydrogen bonds, ionic bonds and disulfide bridges between parts of the chain. Its shape and charge distribution are complementary to one substrate, so only that substrate forms an enzyme–substrate complex.',
          'The induced-fit model adds that the site is not rigid: it changes shape slightly as the substrate approaches, moulding around it. That final fit puts strain on the substrate’s bonds, which is how the enzyme lowers the activation energy rather than simply holding the molecule still.',
          'Marks here are for the chain of reasoning — complementary shape, enzyme–substrate complex, lowered activation energy — not for the word "specific".',
        ],
      }, {
        heading: 'Temperature, pH and the shape of the curve',
        body: [
          'Raising the temperature gives molecules more kinetic energy, so collisions between enzyme and substrate are more frequent and successful, and the rate rises to an optimum. Past the optimum the extra energy breaks the hydrogen and ionic bonds holding the tertiary structure, the active site is no longer complementary, and the rate falls steeply — denaturation, which is not reversed by cooling.',
          'pH works through charge rather than energy. Away from the optimum, excess $\\text{H}^+$ or $\\text{OH}^-$ ions interfere with the ionic and hydrogen bonds in the active site, changing its shape and reducing the rate; a small change may be reversible, a large one not.',
          'Against substrate concentration the curve rises in proportion at first — substrate is the limiting factor — then levels off at $V_{max}$ once every active site is occupied, so enzyme concentration becomes limiting.',
        ],
        example: {
          prompt: 'A rate graph against substrate concentration flattens. What single change would raise the plateau?',
          steps: [
            'The plateau is set by how many active sites there are, not by substrate.',
            'So adding more enzyme raises $V_{max}$; adding more substrate does nothing.',
          ],
        },
      }, {
        heading: 'Two kinds of inhibitor',
        body: [
          'A competitive inhibitor has a shape similar to the substrate and binds in the active site, blocking it. Substrate and inhibitor compete, so the effect depends on their relative concentrations: adding plenty of substrate out-competes the inhibitor and the same $V_{max}$ is reached, just at a higher substrate concentration.',
          'A non-competitive inhibitor binds elsewhere on the enzyme and changes the shape of the active site, so the substrate no longer fits. More substrate cannot help, and $V_{max}$ is lowered.',
          'The distinguishing question in an exam is therefore always "what happens to $V_{max}$?" — unchanged means competitive, reduced means non-competitive.',
        ],
      }],
      exercises: [{
        ask: 'Explain why the rate of an enzyme-controlled reaction falls sharply at temperatures above the optimum.',
        marks: 3,
        hint: 'Name the bonds that break and the consequence for the active site.',
        answer: 'The increased kinetic energy breaks hydrogen and ionic bonds holding the tertiary structure, so the enzyme changes shape. The active site is no longer complementary to the substrate, fewer enzyme–substrate complexes form, and the enzyme is denatured so the change is not reversed by cooling.',
        scheme: [
          'B1 — hydrogen / ionic bonds in the tertiary structure break',
          'B1 — the active site is no longer complementary, so fewer enzyme–substrate complexes form',
          'B1 — the enzyme is denatured / the change is permanent',
        ],
        why: '"The enzyme is denatured" alone is one mark at most. The marks are for what breaks, what that does to the active site, and the fact that it does not recover.',
      }, {
        ask: 'Explain the shape of a graph of reaction rate against substrate concentration, from low concentrations to the plateau.',
        marks: 3,
        hint: 'Name what is limiting in each part of the curve.',
        answer: 'At low concentrations the rate is proportional to substrate concentration because substrate is the limiting factor — active sites are free and more substrate means more collisions and more enzyme–substrate complexes. As concentration rises the increase tails off, and at the plateau every active site is occupied, so the enzyme concentration is now limiting and the rate cannot rise further.',
        scheme: [
          'B1 — rate proportional at first; substrate is limiting',
          'B1 — more complexes form as collisions become more frequent',
          'B1 — plateau because all active sites are occupied / enzyme concentration is now limiting',
        ],
        why: 'The plateau is the part most often explained wrongly as "the enzyme is denatured" or "the substrate is used up". Neither is true: the enzyme is working flat out.',
      }, {
        ask: 'A competitive inhibitor is added to a reaction already at a low substrate concentration. Describe and explain the effect on the rate and on $V_{max}$.',
        marks: 3,
        hint: 'Think about what the inhibitor is competing for, and what enough substrate can overcome.',
        answer: 'The rate falls, because the inhibitor has a shape similar to the substrate and binds in the active site, blocking it so fewer enzyme–substrate complexes form. $V_{max}$ is unchanged: substrate and inhibitor compete for the same site, so a high enough substrate concentration still occupies all the active sites and the original maximum rate is reached.',
        scheme: [
          'B1 — rate falls; inhibitor binds in the active site because its shape is similar to the substrate',
          'B1 — fewer enzyme–substrate complexes form',
          'B1 — $V_{max}$ unchanged but reached at a higher substrate concentration',
        ],
        why: 'The contrast to hold on to: competitive inhibition delays $V_{max}$, non-competitive inhibition lowers it.',
      }, {
        ask: 'Explain why the initial rate of reaction is used when comparing enzyme activity under different conditions, rather than the rate measured later on.',
        marks: 2,
        hint: 'What has changed by the time the reaction has been running a while?',
        answer: 'As the reaction proceeds the substrate concentration falls, so the rate decreases and no longer reflects the condition being tested; product may also accumulate and inhibit the enzyme. Only the initial rate is measured with the substrate concentration still at its intended value, so it is the only fair comparison between conditions.',
        scheme: [
          'B1 — substrate concentration falls as the reaction proceeds, so the rate decreases',
          'B1 — the initial rate is the only measurement made under the stated conditions, so comparisons are valid',
        ],
        why: 'Any later rate is a measurement of a different substrate concentration, which is exactly the variable a well-designed experiment is holding constant.',
      }],
      test: {
        heading: 'Exam-style check — 9 marks',
        questions: [{
          ask: 'Explain, in terms of molecular structure, why an enzyme catalyses only one reaction.',
          marks: 3,
          answer: 'The tertiary structure of the enzyme gives the active site a specific shape and charge distribution, complementary to one substrate only. Only that substrate can bind to form an enzyme–substrate complex, so only its reaction is catalysed.',
          scheme: ['B1 — active site shape determined by tertiary structure', 'B1 — complementary to one substrate', 'B1 — only that substrate forms an enzyme–substrate complex'],
        }, {
          ask: 'Describe how you would investigate the effect of pH on the rate of an enzyme-controlled reaction, including the variables you would control.',
          marks: 4,
          answer: 'Use a series of buffer solutions covering a range of pH, keeping enzyme concentration, substrate concentration, volumes and temperature constant with a water bath. Measure the same indicator of rate each time — for example the time taken for a fixed volume of product to be collected, or for a colour change — and calculate the initial rate. Repeat each pH at least three times and take a mean, then plot rate against pH.',
          scheme: [
            'B1 — buffers used to set a range of pH values',
            'B1 — enzyme and substrate concentration, volume and temperature controlled',
            'B1 — a stated, measurable indicator of initial rate',
            'B1 — repeats and a mean / plot of rate against pH',
          ],
        }, {
          ask: 'State the effect of a non-competitive inhibitor on $V_{max}$ and explain why adding more substrate does not restore the original rate.',
          marks: 2,
          answer: '$V_{max}$ is reduced. The inhibitor binds away from the active site and changes its shape, so the substrate no longer fits; since the two are not competing for the same site, extra substrate cannot displace the inhibitor.',
          scheme: ['B1 — $V_{max}$ reduced', 'B1 — inhibitor binds elsewhere and alters the active site, so substrate cannot out-compete it'],
        }],
      },
    }],

    /* ------------------------------------------------------------------ */
    economics: [{
      id: 'econ-ped',
      subject: 'economics',
      title: 'Price elasticity of demand and total revenue',
      board: CIE,
      code: '9708',
      paper: 'Paper 2 — AS Level Data Response and Essays',
      topic: '2.4 Price, income and cross elasticities of demand',
      minutes: 25,
      objectives: [
        'Calculate PED and interpret both its size and its sign',
        'Explain what makes demand for a good elastic or inelastic',
        'Use PED to predict what a price change does to total revenue',
      ],
      terms: [
        { term: 'Price elasticity of demand', meaning: 'the responsiveness of quantity demanded to a change in price: $PED = \\frac{\\%\\Delta Q_d}{\\%\\Delta P}$' },
        { term: 'Inelastic demand', meaning: '$|PED| < 1$: quantity demanded changes proportionally less than price, so a price rise raises total revenue' },
      ],
      teach: [{
        heading: 'Calculating and reading PED',
        body: [
          '$PED = \\frac{\\%\\Delta Q_d}{\\%\\Delta P}$, and for a normal demand curve it is negative because the two move in opposite directions. Examiners expect the sign to be there and then the size to be discussed in absolute terms.',
          'If $|PED| > 1$ demand is elastic — quantity responds proportionally more than price. If $|PED| < 1$ it is inelastic. Exactly $1$ is unit elastic, $0$ perfectly inelastic, and infinite perfectly elastic.',
          'Always show the percentage changes, not just the final number: the method marks are in the two percentages.',
        ],
        example: {
          prompt: 'Price falls from $\\$2.00$ to $\\$1.80$ and weekly sales rise from $400$ to $500$ units. Calculate PED and comment.',
          steps: [
            '$\\%\\Delta P = \\frac{-0.20}{2.00}\\times 100 = -10\\%$',
            '$\\%\\Delta Q_d = \\frac{100}{400}\\times 100 = +25\\%$',
            '$PED = \\frac{+25}{-10} = -2.5$',
            '$|PED| > 1$, so demand is elastic: quantity responded two and a half times as strongly as price.',
          ],
        },
      }, {
        heading: 'What makes demand elastic',
        body: [
          'The number and closeness of substitutes matters most: the more alternatives, the easier it is to switch and the more elastic demand is. A branded soft drink is elastic; water as a whole is not.',
          'Then whether the good is a necessity or a luxury, the proportion of income it takes up, whether consumption is habitual or addictive, and how long the consumer has had to adjust. Over time, more substitutes can be found, so demand is usually more elastic in the long run.',
          'In an answer, name the determinant and then apply it to the good in the question. "Petrol has few close substitutes in the short run, so demand is inelastic" is the shape that scores.',
        ],
      }, {
        heading: 'The link to total revenue',
        body: [
          'Total revenue is price times quantity, so a price change pulls the two in opposite directions and PED says which pull wins.',
          'Where demand is elastic, the quantity effect dominates: cutting price raises total revenue, raising price lowers it. Where demand is inelastic, the price effect dominates: raising price raises total revenue.',
          'This is why a firm with inelastic demand is advised to raise price, and why governments tax goods with inelastic demand — such as cigarettes or fuel — when the aim is revenue rather than a large fall in consumption.',
        ],
        example: {
          prompt: 'Check the revenue conclusion against the worked example above.',
          steps: [
            'Before: $400 \\times \\$2.00 = \\$800$.',
            'After: $500 \\times \\$1.80 = \\$900$.',
            'Revenue rose after a price cut, which is exactly what elastic demand predicts.',
          ],
        },
      }],
      exercises: [{
        ask: 'The price of a good rises from $\\$5.00$ to $\\$5.50$ and quantity demanded falls from $200$ to $170$ units per week. Calculate the PED and comment on the effect on total revenue.',
        marks: 4,
        hint: 'Percentages first, then compare revenue before and after.',
        answer: '$PED = -1.5$: demand is elastic. Total revenue falls from $\\$1000$ to $\\$935$, which is consistent — with elastic demand a price rise reduces revenue.',
        scheme: [
          'M1 — $\\%\\Delta Q_d = \\frac{-30}{200}\\times 100 = -15\\%$',
          'M1 — $\\%\\Delta P = \\frac{0.50}{5.00}\\times 100 = +10\\%$',
          'A1 — $PED = -1.5$, elastic',
          'A1 — revenue falls from $\\$1000$ to $\\$935$, consistent with elastic demand',
        ],
        why: 'Quantity fell proportionally more ($15\\%$) than price rose ($10\\%$), so revenue had to fall. The last mark is for linking the number to the revenue outcome, not for the arithmetic.',
      }, {
        ask: 'Explain two determinants of the price elasticity of demand for petrol, and state whether demand is likely to be elastic or inelastic in the short run.',
        marks: 4,
        hint: 'Pick determinants that actually apply to petrol, and apply them to petrol.',
        answer: 'Petrol has few close substitutes in the short run — a driver cannot easily switch fuel or replace a vehicle — so quantity demanded changes little when price changes. It is also a necessity for most users, needed for commuting and deliveries regardless of price. Demand is therefore price inelastic in the short run.',
        scheme: [
          'B1 — few close substitutes, with application to petrol',
          'B1 — necessity / derived demand for travel, with application',
          'B1 — consumers cannot adjust quickly (vehicle stock fixed in the short run)',
          'B1 — conclusion: demand is price inelastic',
        ],
        why: 'Any two well-applied determinants plus the conclusion will reach the marks. Listing four determinants with no reference to petrol will not.',
      }, {
        ask: 'A firm finds that the demand for its product is price inelastic. Advise the firm on how to change its price in order to increase total revenue, and justify your advice.',
        marks: 4,
        hint: 'Which effect dominates when demand is inelastic?',
        answer: 'The firm should raise its price. With inelastic demand the percentage fall in quantity demanded is smaller than the percentage rise in price, so the price effect outweighs the quantity effect and total revenue increases. The firm should note that this holds only over the range where demand stays inelastic, and that repeated rises may encourage substitutes to appear.',
        scheme: [
          'B1 — advice: raise price',
          'B1 — $\\%\\Delta Q_d$ is smaller than $\\%\\Delta P$',
          'B1 — so total revenue rises (price effect dominates)',
          'B1 — a limitation: elasticity varies along the curve / substitutes may emerge / costs and profit are a separate question',
        ],
        why: 'The fourth mark in "advise" questions is almost always for a qualification. Revenue is also not profit — worth a sentence if the question leaves room.',
      }, {
        ask: 'Explain why the price elasticity of demand for a good is usually greater in the long run than in the short run.',
        marks: 3,
        hint: 'What can a consumer do with more time that they cannot do immediately?',
        answer: 'Given more time consumers can search for and switch to substitutes, and can change the equipment or habits that tie them to the good — replacing a car, insulating a house, changing a routine. Producers can also bring new substitutes to market. More of the quantity response therefore happens in the long run, so demand is more elastic.',
        scheme: [
          'B1 — time allows consumers to find substitutes',
          'B1 — habits / complementary durable goods can be changed',
          'B1 — so the quantity response to a given price change is larger, making demand more elastic',
        ],
        why: 'Petrol again is the clean illustration: inelastic this month, considerably more elastic over five years.',
      }],
      test: {
        heading: 'Exam-style check — 10 marks',
        questions: [{
          ask: 'Define price elasticity of demand and state the formula used to calculate it.',
          marks: 2,
          answer: 'Price elasticity of demand measures the responsiveness of quantity demanded to a change in the price of the good, other things being equal. $PED = \\frac{\\%\\Delta Q_d}{\\%\\Delta P}$.',
          scheme: ['B1 — responsiveness of quantity demanded to a change in price', 'B1 — correct formula'],
        }, {
          ask: 'The PED for a good is $-0.4$. Its price rises by $20\\%$. Calculate the percentage change in quantity demanded and state, with reasoning, the effect on total revenue.',
          marks: 4,
          answer: 'Quantity demanded falls by $8\\%$. Demand is inelastic, so the $20\\%$ price rise outweighs the $8\\%$ quantity fall and total revenue rises.',
          scheme: [
            'M1 — $\\%\\Delta Q_d = PED \\times \\%\\Delta P = -0.4 \\times 20$',
            'A1 — $-8\\%$',
            'B1 — demand is inelastic as $|PED| < 1$',
            'B1 — total revenue rises because the price effect outweighs the quantity effect',
          ],
        }, {
          ask: 'Explain, using price elasticity of demand, why a government seeking tax revenue might choose to tax cigarettes.',
          marks: 4,
          answer: 'Demand for cigarettes is price inelastic because the product is addictive and has few close substitutes, so a tax that raises the price causes a proportionally smaller fall in quantity demanded. Most of the tax is therefore paid rather than avoided, and revenue rises. The same inelasticity means the tax is a weak tool for cutting consumption, which is why it is often paired with other measures.',
          scheme: [
            'B1 — demand is inelastic: addictive, few substitutes',
            'B1 — the quantity demanded falls proportionally less than the price rises',
            'B1 — so tax revenue is high / the burden falls largely on consumers',
            'B1 — evaluation: consumption falls little, so revenue and health aims pull apart',
          ],
        }],
      },
    }],

    /* ------------------------------------------------------------------ */
    'english-literature': [{
      id: 'eng-unseen-poetry',
      subject: 'english-literature',
      title: 'Writing about an unseen poem',
      board: CIE,
      code: '9695',
      paper: 'Paper 1 — Poetry and Prose',
      topic: 'Unseen / passage-based response',
      minutes: 30,
      objectives: [
        'Read a poem for what it does before writing about how it does it',
        'Write a paragraph that moves from a precise observation to its effect',
        'Tell form from structure, and use both as evidence',
      ],
      terms: [
        { term: 'Volta', meaning: 'the turn in a poem where its argument, mood or direction changes — in a sonnet, often at line 9 or in the final couplet' },
        { term: 'Form', meaning: 'the kind of poem and its fixed features — sonnet, dramatic monologue, free verse — as distinct from structure, which is how the material is ordered within it' },
      ],
      teach: [{
        heading: 'What the marks are actually for',
        body: [
          'An unseen response is assessed on close reading, informed personal response, and the ability to discuss how form, structure and language shape meaning. Nothing is awarded for biography, period background, or for naming a device without saying what it does.',
          'So the unit of a good answer is not the device but the effect: what changes in the reader’s understanding because the poet chose this word, this line-break, this form.',
          'Before writing, read twice. First for the situation — who is speaking, to whom, about what, and where the poem turns. Only then for the language that carries it.',
        ],
      }, {
        heading: 'A paragraph that works',
        body: [
          'Point, evidence, analysis, effect. The point is an argument about the poem, not a summary. The evidence is short — a few words, embedded in your own sentence, not a dropped-in line. The analysis is on the specific word or feature. The effect returns to the whole poem.',
          'Weak: "The poet uses imagery to show sadness." It names a category, quotes nothing, and could be said of a thousand poems.',
          'Stronger: "The speaker’s grief arrives in domestic detail rather than declaration — the unwashed cup left ‘where he set it down’ — so that loss is measured in small unchanged things, and the reader feels its permanence before the poem ever names it."',
        ],
        example: {
          prompt: 'Turn "the poem uses a sad tone at the end" into an analytical sentence.',
          steps: [
            'Name what creates the tone, not the tone itself: a shortened final line, a flat monosyllable, a rhyme that fails to arrive.',
            'Quote the smallest unit that proves it.',
            'Say what the reader is left with: "the half-rhyme refuses the closure the couplet promises, leaving the consolation sounding rehearsed."',
          ],
        },
      }, {
        heading: 'Form and structure as evidence',
        body: [
          'Form is the kind of poem: sonnet, villanelle, dramatic monologue, free verse. Structure is the ordering within it: where the volta falls, how stanzas shorten, whether the syntax runs over the line-ends or stops at them.',
          'Both carry argument. A sonnet that resolves in its couplet asserts that the problem is answerable; one whose couplet contradicts the twelve lines before it does the opposite. Shakespeare’s "Shall I compare thee to a summer’s day?" sets up its claim for twelve lines and then banks everything on two, so the couplet has to be read as the argument’s proof rather than its decoration.',
          'Enjambment is worth a mention only when you can say what running over the line does — hurrying the voice past a word it might have dwelt on, or landing a noun at the start of a line where it carries weight.',
        ],
      }],
      exercises: [{
        ask: 'Rewrite this sentence so that it would earn marks: "The poet uses imagery to show that the speaker is sad about the past."',
        marks: 3,
        hint: 'Name a specific image, quote two or three words, and finish with the effect on the reader.',
        answer: 'A model answer: "The past reaches the speaker as something physical rather than remembered — the ‘cold print’ of a letter still held — so that grief is presented as an object she cannot put down, and the reader understands her stillness as inability rather than choice."',
        scheme: [
          'B1 — a specific feature identified rather than a category ("imagery")',
          'B1 — brief embedded quotation',
          'B1 — effect on the reader’s understanding stated',
        ],
        why: 'Any rewrite with those three moves is doing the job. The test is whether the sentence could be written about any other poem — if it could, it is still too general.',
      }, {
        ask: 'A sonnet spends its first twelve lines praising a city and its last two describing the same streets at night, in flat monosyllables. Explain the effect of this structure.',
        marks: 3,
        hint: 'Where is the volta, and what does the reader do with the twelve lines once they have read the two?',
        answer: 'The volta falls at the couplet, so the praise is complete before it is undercut. Because the final lines are flat and monosyllabic against the expansive language before them, the shift reads as a correction rather than an addition, and the reader is made to re-read the earlier praise as partial — admiration that held only while the light did.',
        scheme: [
          'B1 — volta identified at the couplet',
          'B1 — contrast in diction / rhythm noted as the means of the shift',
          'B1 — effect: the earlier lines are retrospectively qualified',
        ],
        why: 'The mark that candidates miss is the third. A turn is only worth writing about if you say what it does to the lines on either side of it.',
      }, {
        ask: 'Explain the difference between form and structure, giving one example of each.',
        marks: 2,
        hint: 'One is what kind of poem it is; the other is the order of the material inside it.',
        answer: 'Form is the type of poem and its conventions — a sonnet, with fourteen lines and a turn. Structure is the arrangement of material within the poem — stanzas that shorten towards the end, or a volta placed at line 9 rather than the couplet.',
        scheme: ['B1 — form defined with a valid example', 'B1 — structure defined with a valid example'],
        why: 'Using the two words interchangeably costs marks in the "how" strand of every mark scheme in this paper.',
      }, {
        ask: 'Write one paragraph (4–6 sentences) analysing the effect of the final couplet of Shakespeare’s Sonnet 18, in which the speaker claims the poem itself will keep the subject alive.',
        marks: 5,
        hint: 'Argue something about the couplet, prove it with two or three words, and finish on the reader.',
        answer: 'A model answer: "The couplet shifts the poem’s claim from description to action: having spent twelve lines conceding that everything fair declines, the speaker stakes immortality not on the subject’s beauty but on the verse recording it. The turn is carried by the conditional ‘so long as’, which makes the promise contingent on readers rather than on nature, and by the move into the future tense after a poem largely in the present. The effect is to enlist the reader: the lines are only true while they are being read, so each reading performs the preservation it describes. What looks like praise of the subject is therefore also a claim for the poem, and the confidence of the closing rhyme makes that claim sound already proven."',
        scheme: [
          'B1 — a clear argument about the couplet, not a summary',
          'B1 — brief embedded quotation used as evidence',
          'B1 — analysis of a specific linguistic or formal choice',
          'B1 — effect on the reader stated',
          'B1 — the point is connected back to the poem as a whole',
        ],
        why: 'Compare your paragraph against the five bullets one at a time. Most answers that feel thin are missing the last one: the paragraph analyses two lines but never says what they do to the twelve before them.',
      }],
      test: {
        heading: 'Exam-style check — 8 marks',
        questions: [{
          ask: 'Explain what is meant by the tone of a poem and name two features that create it.',
          marks: 3,
          answer: 'Tone is the attitude the poem takes towards its subject or listener, as conveyed by the voice rather than stated outright. It is created by features such as diction — the connotations of the words chosen — and rhythm or line length, which control the pace and emphasis of the speaking voice. Punctuation and sound patterning also contribute.',
          scheme: ['B1 — tone defined as attitude conveyed by the voice', 'B1 — one feature named with its contribution', 'B1 — a second feature named with its contribution'],
        }, {
          ask: 'A candidate devotes a paragraph to the poet’s biography. Explain why this earns few marks.',
          marks: 2,
          answer: 'The assessment rewards close reading of the text and a personal response to it, so a paragraph about the poet’s life offers no evidence drawn from the poem. It also tends to replace analysis with explanation of cause, asserting what the poet meant rather than showing what the words do.',
          scheme: ['B1 — biography is not textual evidence / not rewarded by the criteria', 'B1 — it substitutes intention for analysis of effect'],
        }, {
          ask: 'In a poem about a departure, the sentence runs over the line-ending so that the word "leaving" begins the next line. Analyse the effect.',
          marks: 3,
          answer: 'The enjambment denies the line the pause its ending promises, so the voice is carried forward against the shape of the verse, enacting the departure it describes. Placing "leaving" at the start of the line gives it the stress position, isolating the act from the explanation that follows it. The reader therefore meets the fact of the departure before its reason, which is the order in which it is experienced.',
          scheme: ['B1 — enjambment identified and its effect on pace / voice', 'B1 — effect of the word’s position at the line opening', 'B1 — link to meaning: form enacts the departure'],
        }],
      },
    }],

    /* ------------------------------------------------------------------ */
    'computer-science': [{
      id: 'cs-number-systems',
      subject: 'computer-science',
      title: 'Binary, hexadecimal and two’s complement',
      board: CIE,
      code: '9618',
      paper: 'Paper 1 — Theory Fundamentals',
      topic: '1.1 Data representation',
      minutes: 25,
      objectives: [
        'Convert between denary, binary and hexadecimal in both directions',
        'Represent a negative integer in two’s complement and state the range for a given word length',
        'Add binary numbers and recognise overflow',
      ],
      terms: [
        { term: 'Two’s complement', meaning: 'a representation for signed integers: negate by inverting every bit and adding 1, leaving the most significant bit as a sign bit' },
        { term: 'Overflow', meaning: 'a result that cannot be held in the available number of bits, so the value stored is wrong rather than merely rounded' },
      ],
      teach: [{
        heading: 'Place values in both directions',
        body: [
          'An eight-bit binary number has place values $128, 64, 32, 16, 8, 4, 2, 1$. Converting to denary is addition; converting from denary is repeated subtraction of the largest place value that fits.',
          'Hexadecimal is base 16, with $A$ to $F$ standing for $10$ to $15$. Its usefulness is that one hex digit is exactly four bits, so conversion is done in nibbles with no arithmetic: split the byte in two, convert each half.',
        ],
        example: {
          prompt: 'Convert denary $77$ to binary and then to hexadecimal.',
          steps: [
            '$77 = 64 + 8 + 4 + 1$, so the bits set are $64$, $8$, $4$ and $1$: $0100\\ 1101$.',
            'Split into nibbles: $0100 = 4$ and $1101 = 13 = D$.',
            'So $77$ is $0100\\ 1101$ in binary and $4D$ in hex.',
          ],
        },
      }, {
        heading: 'Negative numbers: invert and add one',
        body: [
          'In two’s complement the most significant bit carries a negative weight, so for eight bits it is worth $-128$. That gives a range of $-128$ to $+127$ — asymmetric, because zero takes one of the positive patterns.',
          'To write a negative number: express the magnitude in binary, invert every bit, then add 1. To read a negative pattern back, do exactly the same operation again.',
          'For a word length of $n$ bits the range is $-2^{n-1}$ to $2^{n-1}-1$. Stating it is a common one-mark question, and the $-1$ on the positive end is where it is lost.',
        ],
        example: {
          prompt: 'Represent $-45$ in eight-bit two’s complement.',
          steps: [
            '$45 = 32 + 8 + 4 + 1 = 0010\\ 1101$.',
            'Invert every bit: $1101\\ 0010$.',
            'Add 1: $1101\\ 0011$.',
          ],
        },
      }, {
        heading: 'Addition and overflow',
        body: [
          'Binary addition carries whenever a column reaches 2: $1+1$ is $0$ carry $1$, and $1+1+1$ is $1$ carry $1$.',
          'Overflow is not the same as a carry out of the most significant column. In unsigned arithmetic a carry out of the top bit means the result does not fit. In signed two’s complement arithmetic, overflow is when adding two positives gives a negative pattern, or two negatives give a positive one.',
          'So the same eight-bit addition can be correct read as unsigned and wrong read as signed — which is why a question will always say which interpretation it wants.',
        ],
        example: {
          prompt: 'Add $0101\\ 1100$ and $0011\\ 0110$ in eight bits and comment.',
          steps: [
            'Column by column the sum is $1001\\ 0010$.',
            'As unsigned: $92 + 54 = 146$, and $1001\\ 0010$ is $146$ — correct, with no carry out of the byte.',
            'As signed two’s complement: two positive numbers have produced a pattern whose sign bit is 1, i.e. $-110$. That is overflow, because $146$ is outside $-128$ to $+127$.',
          ],
        },
      }],
      exercises: [{
        ask: 'Convert the binary number $0110\\ 1011$ to denary and to hexadecimal.',
        marks: 3,
        hint: 'Add the place values for the denary; split into nibbles for the hex.',
        answer: 'Denary $107$; hexadecimal $6B$',
        scheme: [
          'M1 — place values identified: $64 + 32 + 8 + 2 + 1$',
          'A1 — $107$',
          'A1 — $6B$ (from $0110 = 6$ and $1011 = B$)',
        ],
        why: '$0110\\ 1011$ sets $64$, $32$, $8$, $2$ and $1$, which total $107$. The nibbles $0110$ and $1011$ are $6$ and $11$, and $11$ is $B$, so the hex is $6B$.',
      }, {
        ask: 'Represent denary $-45$ in eight-bit two’s complement form, showing your working.',
        marks: 3,
        hint: 'Magnitude, invert, add one.',
        answer: '$1101\\ 0011$',
        scheme: [
          'M1 — $45 = 0010\\ 1101$',
          'M1 — inversion: $1101\\ 0010$',
          'A1 — add 1: $1101\\ 0011$',
        ],
        why: 'The working is worth two of the three marks, so show the inverted value as its own line. A single final answer with no working caps the score even when it is right.',
      }, {
        ask: 'Add the eight-bit numbers $0101\\ 1100$ and $0011\\ 0110$. State whether overflow occurs if the numbers are interpreted as unsigned integers, and whether it occurs if they are interpreted as two’s complement signed integers.',
        marks: 3,
        hint: 'One sum, two interpretations — the answer differs between them.',
        answer: 'The sum is $1001\\ 0010$. Unsigned: $92 + 54 = 146$, which fits in eight bits, so there is no overflow. Signed: two positive values have given a result with the sign bit set, so overflow has occurred — $146$ is outside the range $-128$ to $+127$.',
        scheme: [
          'M1 — correct addition: $1001\\ 0010$',
          'A1 — no overflow when unsigned (no carry out of bit 7; $146 \\le 255$)',
          'A1 — overflow when signed (positive + positive gives a negative pattern)',
        ],
        why: 'The point of the question is that overflow is a property of the interpretation, not of the bit pattern. Answering only "no overflow" or only "overflow" scores one of the two available marks.',
      }, {
        ask: 'State and explain one reason why programmers often use hexadecimal rather than binary.',
        marks: 2,
        hint: 'Compare how much a person has to hold in their head.',
        answer: 'Hexadecimal is far shorter and easier to read: one hex digit stands for exactly four bits, so a byte is two characters rather than eight. That makes values quicker to write and transcription errors easier to spot, while conversion to binary remains straightforward because the mapping is nibble by nibble.',
        scheme: ['B1 — shorter / easier to read or write, fewer transcription errors', 'B1 — because one hex digit maps to exactly four bits, so conversion is direct'],
        why: 'The second mark is for the reason behind the convenience. "It is easier" alone is one mark.',
      }],
      test: {
        heading: 'Exam-style check — 7 marks',
        questions: [{
          ask: 'Convert the hexadecimal value $B7$ to denary and to eight-bit binary.',
          marks: 3,
          answer: 'Denary $183$; binary $1011\\ 0111$',
          scheme: ['M1 — $B = 11$, so $11 \\times 16 + 7$', 'A1 — $183$', 'A1 — $1011\\ 0111$'],
        }, {
          ask: 'Represent denary $-100$ in eight-bit two’s complement form.',
          marks: 2,
          answer: '$1001\\ 1100$',
          scheme: ['M1 — $100 = 0110\\ 0100$, inverted to $1001\\ 1011$', 'A1 — add 1 to give $1001\\ 1100$'],
        }, {
          ask: 'State the range of integers that can be represented in 16-bit two’s complement form, and explain why the range is not symmetrical about zero.',
          marks: 2,
          answer: '$-32768$ to $+32767$. The range is asymmetrical because one of the $2^{16}$ available patterns is used for zero, and zero is grouped with the non-negative values, leaving one fewer pattern for the positives than for the negatives.',
          scheme: ['B1 — $-32768$ to $32767$', 'B1 — zero occupies one of the positive patterns, so $-2^{15}$ to $2^{15}-1$'],
        }],
      },
    }],
  };

  /* --------------------------------------------------------------------- */

  function slugify(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // Which subject's lessons belong to a notebook. Slug first, since the seeded
  // notebooks and anything setup made have a dependable one; then the title, so
  // a notebook the student named "AS Physics" still finds its lessons.
  function subjectFor(slug, title) {
    var key = ALIASES[slugify(slug)];
    if (key) return key;
    var t = String(title || '') + ' ' + String(slug || '');
    for (var i = 0; i < TITLE_WORDS.length; i++) {
      if (TITLE_WORDS[i][0].test(t)) return TITLE_WORDS[i][1];
    }
    return null;
  }

  function forNotebook(slug, title) {
    var key = subjectFor(slug, title);
    return key && LESSONS[key] ? LESSONS[key].slice() : [];
  }

  function byId(id) {
    var keys = Object.keys(LESSONS);
    for (var i = 0; i < keys.length; i++) {
      var found = LESSONS[keys[i]].filter(function (l) { return l.id === id; })[0];
      if (found) return found;
    }
    return null;
  }

  function totalMarks(lesson) {
    var ex = (lesson.exercises || []).reduce(function (n, e) { return n + (e.marks || 0); }, 0);
    var te = ((lesson.test && lesson.test.questions) || []).reduce(function (n, q) { return n + (q.marks || 0); }, 0);
    return { exercises: ex, test: te, all: ex + te };
  }

  /* ---- Is this lesson fit to sit? -------------------------------------- */
  /* Only generated lessons reach this: the written bank above is held to the
   * same rules by lessons-test.js, which fails the build instead of the page.
   *
   * supabase/functions/generate-lesson/index.ts checks the same things before
   * it returns anything, and that is the check that matters — it is the one
   * the student's own device cannot be talked out of running. This copy exists
   * because the page is what renders a lesson, and a lesson can reach the page
   * from a cache, an older function, or a response that was fine when it was
   * written and is not now. Two copies of one rule is the cost of that; the
   * rule itself is short, and both say so.
   *
   * Returns the reasons it is not fit. Empty means it is. */
  function validate(lesson) {
    var bad = [];
    if (!lesson || typeof lesson !== 'object') return ['not a lesson'];

    var str = function (v, min) { return typeof v === 'string' && v.length >= min; };
    var arr = function (v) { return Array.isArray(v); };

    if (!str(lesson.id, 1)) bad.push('no id');
    if (!str(lesson.title, 6)) bad.push('no usable title');
    if (!arr(lesson.objectives) || lesson.objectives.length < 2) bad.push('fewer than two objectives');
    if (!arr(lesson.teach) || !lesson.teach.length) bad.push('nothing taught before the exercises');
    else if (lesson.teach.some(function (t) { return !t || !str(t.heading, 1) || !arr(t.body) || !t.body.length; })) {
      bad.push('a teaching page with no heading or no body');
    }
    if (!arr(lesson.exercises) || lesson.exercises.length < 3) bad.push('fewer than three exercises');
    if (!lesson.test || !arr(lesson.test.questions) || lesson.test.questions.length < 2) {
      bad.push('fewer than two questions in the check');
    }
    if (!(lesson.minutes > 0 && lesson.minutes <= 120)) bad.push('an implausible sitting time');

    var marked = [];
    (lesson.exercises || []).forEach(function (e, i) { marked.push(['exercise ' + (i + 1), e]); });
    ((lesson.test && lesson.test.questions) || []).forEach(function (q, i) {
      marked.push(['check question ' + (i + 1), q]);
    });

    marked.forEach(function (pair) {
      var where = pair[0], item = pair[1];
      if (!item || typeof item !== 'object') { bad.push(where + ': missing'); return; }
      var m = item.marks;
      if (typeof m !== 'number' || m !== Math.floor(m) || m < 1 || m > 10) {
        bad.push(where + ': marks out of range');
      } else if (!arr(item.scheme) || item.scheme.length !== m) {
        // The one that matters. A student marking themselves against a scheme
        // with the wrong number of points has no way to tell it is wrong.
        bad.push(where + ': ' + m + ' marks but ' + ((item.scheme || []).length) + ' scheme lines');
      }
      if (!str(item.ask, 10)) bad.push(where + ': nothing really asked');
      if (!str(item.answer, 2)) bad.push(where + ': no model answer');
    });

    var claimed = /(\d+)\s*marks?/i.exec((lesson.test && lesson.test.heading) || '');
    var held = ((lesson.test && lesson.test.questions) || []).reduce(function (n, q) {
      return n + ((q && q.marks) || 0);
    }, 0);
    if (claimed && Number(claimed[1]) !== held) {
      bad.push('the check claims ' + claimed[1] + ' marks but holds ' + held);
    }

    // An unclosed dollar sign leaves raw LaTeX in the middle of a sentence.
    var unbalanced = 0;
    lessonStrings(lesson).forEach(function (s) {
      if ((s.replace(/\\\$/g, '').match(/\$/g) || []).length % 2 !== 0) unbalanced++;
    });
    if (unbalanced) bad.push(unbalanced + ' string(s) with an unclosed dollar sign');

    return bad;
  }

  // Every string in a lesson that is rendered as text, for the dollar check.
  function lessonStrings(l) {
    var out = [];
    var push = function (v) { if (typeof v === 'string') out.push(v); };
    push(l.title); push(l.topic); push(l.paper);
    (l.objectives || []).forEach(push);
    (l.terms || []).forEach(function (t) { if (t) { push(t.term); push(t.meaning); } });
    (l.teach || []).forEach(function (t) {
      if (!t) return;
      push(t.heading);
      (t.body || []).forEach(push);
      if (t.example) { push(t.example.prompt); (t.example.steps || []).forEach(push); }
    });
    (l.exercises || []).forEach(function (e) {
      if (!e) return;
      push(e.ask); push(e.answer); push(e.hint); push(e.why);
      (e.scheme || []).forEach(push);
    });
    if (l.test) {
      push(l.test.heading);
      (l.test.questions || []).forEach(function (q) {
        if (!q) return;
        push(q.ask); push(q.answer);
        (q.scheme || []).forEach(push);
      });
    }
    return out;
  }

  /* ---- Progress ------------------------------------------------------- */
  // Kept apart from the notebook's own store: this is a record of sittings,
  // and the student's actual work lives in their chapters, which is the copy
  // that matters. Losing this loses a score, not any writing.
  var PROGRESS_KEY = 'folio_lessons_v1';

  function readProgress() {
    try {
      var raw = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) { return {}; }
  }

  function writeProgress(id, record) {
    if (!id) return;
    var all = readProgress();
    all[id] = record;
    // A bound, so a long-running install can't fill its storage with sittings.
    var keys = Object.keys(all);
    if (keys.length > 200) {
      keys.sort(function (a, b) { return (all[a].at || 0) - (all[b].at || 0); });
      keys.slice(0, keys.length - 200).forEach(function (k) { delete all[k]; });
    }
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)); } catch (e) {}
  }

  /* ---- Text with maths in it ------------------------------------------ */
  // Lesson strings carry LaTeX between dollar signs. Splitting is done here so
  // the notebook and anything else that renders a lesson agree on what counts
  // as maths. A lone dollar sign is left as text rather than swallowing the
  // rest of the sentence.
  function texSplit(str) {
    var out = [];
    var s = String(str == null ? '' : str);
    var i = 0;
    while (i < s.length) {
      var open = s.indexOf('$', i);
      if (open < 0) { out.push({ tex: false, text: s.slice(i) }); break; }
      var close = s.indexOf('$', open + 1);
      if (close < 0) { out.push({ tex: false, text: s.slice(i) }); break; }
      if (open > i) out.push({ tex: false, text: s.slice(i, open) });
      out.push({ tex: true, text: s.slice(open + 1, close) });
      i = close + 1;
    }
    return out.filter(function (p) { return p.text !== ''; });
  }

  // Lesson text as plain text, for the places that take no markup — a note in
  // the chapter rail, say. The LaTeX is reduced to something readable rather
  // than dropped, since a definition with its formula cut out of it is worse
  // than one with a slash in it.
  var TEX_PLAIN = [
    [/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)'],
    [/\\sqrt\s*\{([^{}]*)\}/g, '√($1)'],
    [/\\(?:text|mathrm|textrm|operatorname)\s*\{([^{}]*)\}/g, '$1'],
    [/\\times/g, '×'], [/\\div/g, '÷'], [/\\pm/g, '±'],
    [/\\cdot/g, '·'], [/\\le(?:q)?\b/g, '≤'], [/\\ge(?:q)?\b/g, '≥'],
    [/\\neq\b/g, '≠'], [/\\approx\b/g, '≈'], [/\\infty\b/g, '∞'],
    [/\\rightarrow\b|\\to\b/g, '→'], [/\\Delta\b/g, 'Δ'],
    [/\\delta\b/g, 'δ'], [/\\theta\b/g, 'θ'], [/\\pi\b/g, 'π'],
    [/\\circ\b/g, '°'], [/\\%/g, '%'], [/\\\$/g, '$'],
    [/\\[a-zA-Z]+/g, ''], [/[{}]/g, ''], [/\\\s/g, ' '],
  ];

  function plainText(str) {
    return texSplit(str).map(function (p) {
      if (!p.tex) return p.text;
      var t = p.text;
      TEX_PLAIN.forEach(function (rule) { t = t.replace(rule[0], rule[1]); });
      return t.replace(/\s+/g, ' ').trim();
    }).join('').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Lesson text as editor HTML. Maths becomes the same formula span the
  // notebook's own formula key produces, so the sanitiser rebuilds it from the
  // LaTeX on the way in and it is editable afterwards like anything else the
  // student wrote.
  function textToEditorHtml(str) {
    return texSplit(str).map(function (p) {
      return p.tex
        ? '<span class="nb-formula" data-latex="' + escapeHtml(p.text) + '"></span>'
        : escapeHtml(p.text);
    }).join('');
  }

  // What gets written into the notebook. `work` is
  // { answers: { <index>: { text, awarded, marks } }, test: {...}, score, marks }
  // and only the parts the student actually reached are included, so leaving
  // halfway still leaves a usable record.
  function chapterHtml(lesson, work) {
    var h = [];
    var t = textToEditorHtml;
    h.push('<h2>' + escapeHtml(lesson.title) + '</h2>');
    h.push('<p><em>' + escapeHtml([lesson.board, lesson.code, lesson.paper, lesson.topic]
      .filter(Boolean).join(' · ')) + '</em></p>');

    if (lesson.objectives && lesson.objectives.length) {
      h.push('<h3>What this lesson covered</h3><ul>');
      lesson.objectives.forEach(function (o) { h.push('<li>' + t(o) + '</li>'); });
      h.push('</ul>');
    }

    var answers = (work && work.answers) || {};
    var exercises = lesson.exercises || [];
    var answered = Object.keys(answers);
    if (answered.length) {
      h.push('<h3>Exercises</h3>');
      exercises.forEach(function (ex, i) {
        var a = answers[i];
        if (!a) return;
        h.push('<p><strong>' + (i + 1) + '. ' + t(ex.ask) + '</strong> [' + ex.marks + ']</p>');
        h.push('<p>My answer: <mark>' + (a.text ? t(a.text) : '<em>left blank</em>') + '</mark></p>');
        h.push('<p>Model answer: ' + t(ex.answer) + '</p>');
        if (ex.scheme && ex.scheme.length) {
          h.push('<p><em>Mark scheme</em></p><ul>');
          ex.scheme.forEach(function (line) { h.push('<li>' + t(line) + '</li>'); });
          h.push('</ul>');
        }
        h.push('<p><em>Self-marked ' + a.awarded + ' of ' + ex.marks + '</em></p>');
      });
    }

    var testWork = (work && work.test) || {};
    var questions = (lesson.test && lesson.test.questions) || [];
    if (Object.keys(testWork).length) {
      h.push('<h3>' + escapeHtml((lesson.test && lesson.test.heading) || 'Exam-style check') + '</h3>');
      questions.forEach(function (q, i) {
        var a = testWork[i];
        if (!a) return;
        h.push('<p><strong>' + (i + 1) + '. ' + t(q.ask) + '</strong> [' + q.marks + ']</p>');
        h.push('<p>My answer: <mark>' + (a.text ? t(a.text) : '<em>left blank</em>') + '</mark></p>');
        h.push('<p>Model answer: ' + t(q.answer) + '</p>');
        if (q.scheme && q.scheme.length) {
          h.push('<p><em>Mark scheme</em></p><ul>');
          q.scheme.forEach(function (line) { h.push('<li>' + t(line) + '</li>'); });
          h.push('</ul>');
        }
        h.push('<p><em>Self-marked ' + a.awarded + ' of ' + q.marks + '</em></p>');
      });
    }

    if (work && work.marks) {
      h.push('<blockquote><p>Sitting total: ' + work.score + ' of ' + work.marks
        + ' marks, ' + new Date().toLocaleDateString() + '.</p></blockquote>');
    }
    return h.join('');
  }

  window.notivloLessons = {
    forNotebook: forNotebook,
    subjectFor: subjectFor,
    byId: byId,
    totalMarks: totalMarks,
    validate: validate,
    texSplit: texSplit,
    plainText: plainText,
    textToEditorHtml: textToEditorHtml,
    chapterHtml: chapterHtml,
    readProgress: readProgress,
    writeProgress: writeProgress,
    // The AI seam. See the note at the top of this file: set it to a function
    // returning a promise for one lesson, and the notebook will offer whatever
    // it returns ahead of the bank above. Null means "use the bank".
    generate: null,
  };
})();
