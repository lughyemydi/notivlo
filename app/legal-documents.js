/* The Privacy Policy and Terms of Use shown under Settings → Legal.
 *
 * These are drafts, written to describe what notivlo actually does — every
 * statement about storage, network connections and security below reflects the
 * app as built, for a build with the server configured (supabase-config.js
 * filled in), which is what is published. They are not legal advice. Before
 * relying on them:
 *
 *   1. have them reviewed by someone qualified for where you operate;
 *   2. fill in `info` below;
 *   3. set `reviewed: true` — until then Settings shows a draft notice above
 *      the documents.
 *
 * Where each claim comes from, so the next person can check it rather than
 * trust it:
 *
 *   accounts, sync, what is stored   supabase-auth.js, supabase-sync.js,
 *                                    supabase/migrations/*init*
 *   deleting an account              migrations/*account_functions* (a cascade
 *                                    off auth.users) and *feedback* (set null)
 *   connections the app may make     the Content-Security-Policy on each page:
 *                                    unpkg.com and the project's Supabase host
 *   lessons written to order         lessons-ai.js (what it sends) and
 *                                    supabase/PROVIDER.md (who receives it)
 *   payments                         billing.js, create-checkout, stripe-webhook
 *   feedback                         feedback.js and the feedback migration
 *
 * If the app's behaviour changes — a new network connection, analytics, a
 * new provider, a new table — these documents must change with it, or they
 * stop being true. This file was last wrong in exactly that way: it described
 * the app before it had a server.
 *
 * Blocks are [kind, text]: 'h' heading, 'p' paragraph, 'li' list item. {app},
 * {company}, {email} and {jurisdiction} are filled in from `info`.
 *
 * Loaded from <head> so the documents exist before Settings first renders.
 */
window.NOTIVLO_LEGAL_DOCS = {
  info: {
    company: '',        // the legal entity or person who publishes notivlo
    contactEmail: '',
    jurisdiction: '',   // e.g. 'France' or 'the State of California'
    effectiveDate: '',  // e.g. '1 October 2026'
    reviewed: false,
  },

  privacy: {
    title: 'Privacy Policy',
    blocks: [
      ['p', 'This policy explains what {app} does with information about you. The short version: you sign in with an account, your notebooks are saved to that account on a server so you can reach them from more than one device, and {company} does not sell your information or use it for advertising.'],

      ['h', 'What {app} stores about you'],
      ['p', 'When you create an account, and as you use {app}, the following is saved to your account on our server:'],
      ['li', 'Your account: your name, your email address, and your password. The password is stored only as a one-way hash, never as the password itself.'],
      ['li', 'Your notebooks: chapters, notes, formulas, drawings, and any images you add.'],
      ['li', 'Your agenda entries, and the study time {app} records for each day.'],
      ['li', 'Your preferences, such as light or dark appearance, text size and notebook sort order, and your progress through the setup guide.'],
      ['p', '{app} also keeps a working copy of this on your device, in your browser\'s storage or the app\'s own storage on Mac and iPhone, along with the sign-in that keeps you signed in. That copy is what the screen reads from, so {app} keeps working when you are offline and catches up with your account when you are back online.'],
      ['p', 'Our server is run for us by Supabase, which provides the database and the sign-in service. The database is set up so that each account can read and change only its own rows. As the publisher, {company} can still reach the database itself.'],

      ['h', 'When {app} connects to the internet'],
      ['li', 'Supabase, to sign you in, save and load your notebooks, and send password-reset emails.'],
      ['li', 'unpkg.com, a public code-hosting service. When {app} opens, it downloads the software libraries it runs on (React and related code) from there. Like any website, that service can see your IP address and basic information about your device. No notebook content or account details are sent to it.'],
      ['li', 'Stripe, only if you buy lesson credits. {app} sends you to Stripe\'s own checkout page to pay. Stripe collects your payment details; {app} and {company} never see your card number. We keep a record of what you bought and your credit balance, and Stripe tells us when a payment has gone through.'],
      ['li', 'An AI model provider, only if you ask {app} to write a lesson to order. See the next section.'],
      ['p', '{app} has no analytics, no advertising and no tracking, and it doesn\'t use cookies. Apart from the list above, it makes no other connections.'],

      ['h', 'Lessons written to order'],
      ['p', 'When you ask for a lesson that isn\'t in the built-in set, {app} sends a request to our server, which passes it to a third-party AI model provider that writes the lesson. The request contains the subject and syllabus code, which lessons you have already sat, and what you lost marks on. It does not contain your name, your email address or anything you have written in your notebooks.'],
      ['p', 'What you lost marks on is information about how you are doing in your studies. The provider handles the request under its own terms, which can allow it to keep requests and use them to improve its services. Don\'t ask for a lesson if you aren\'t comfortable with that. Everything else in {app}, including the built-in lessons, works without it.'],

      ['h', 'Feedback you send'],
      ['p', 'Settings includes a way to send feedback. A message you send is stored with the optional email address you type in, which build of {app} you were using (web, Mac or iPhone), its version, your browser or device description, and your account if you were signed in. Only {company} can read feedback; it isn\'t shown to anyone else. Leave the email empty if you don\'t want a reply.'],

      ['h', 'Exporting and deleting your data'],
      ['li', 'Settings → Data exports your notebooks, agenda and preferences to a file you keep. The export leaves out your password data.'],
      ['li', 'Settings → Danger zone can erase all notebooks and agenda entries. That removes them from your device and from your account.'],
      ['li', 'Settings → Danger zone can also delete your account. That permanently removes your account and everything saved to it on our server: your notebooks, agenda, study record, preferences, and your record of purchases and credits. It can\'t be undone, and {company} can\'t restore it.'],
      ['p', 'Two things remain after you delete your account. Feedback you already sent stays, but is no longer linked to your account. And Stripe keeps its own records of payments, under its own terms. Deleting the app, or clearing this site\'s data in your browser, removes the copy on your device but not the one on your account; signing in again brings your notebooks back.'],
      ['p', 'Keep an export if your notes matter to you. It is the one copy that doesn\'t depend on us.'],

      ['h', 'Security'],
      ['p', '{app} limits sign-in attempts, never stores your password in readable form, removes unsafe content from pasted and saved notes, and restricts its own connections to the services named above. Forgotten passwords are reset through a link emailed to your account\'s address. The copy kept on your device is not encrypted by {app}, though, so anyone who can use your unlocked device may be able to see it. Your device\'s own passcode or login is what protects that copy. No system is perfectly secure, and we can\'t promise that yours will never be accessed without permission.'],

      ['h', 'Children'],
      ['p', '{app} is made for students, and some of them are under 18. It asks only for a name and an email address, uses them only to run your account, and doesn\'t use anyone\'s information for advertising. Where the law of your country sets a minimum age at which you can sign up on your own, or requires a parent\'s permission, you need to meet it. If you believe a child has made an account without the permission the law requires, write to {email} and the account will be deleted.'],

      ['h', 'Changes to this policy'],
      ['p', 'If this policy changes, the updated version will appear here with a new effective date.'],

      ['h', 'Contact'],
      ['p', 'Questions about privacy can be sent to {email}.'],
    ],
  },

  terms: {
    title: 'Terms of Use',
    blocks: [
      ['p', 'These terms apply when you use {app}, provided by {company}. By using {app} you agree to them. If you don\'t agree, please don\'t use {app}.'],

      ['h', '1. What {app} is'],
      ['p', '{app} is a notebook app for studying. You sign in with an account; your notebooks and agenda are saved to that account on a server, with a working copy on your device, so they are available wherever you sign in. {app} is a beta: it can change, and it can have bugs.'],

      ['h', '2. Your account'],
      ['p', 'Give accurate details when you sign up, and keep your password to yourself. You are responsible for what happens under your account. You can delete it at any time from Settings; doing so permanently removes what is saved to it.'],

      ['h', '3. Your content'],
      ['p', 'Everything you write, draw or attach in {app} belongs to you. {company} claims no rights to it. You give {company} only the permission it needs to store it for you and to show it back to you.'],
      ['p', 'Keep your own backups. While {app} is in beta, data can be lost, and {company} may not be able to recover it. Settings → Data lets you export a copy.'],

      ['h', '4. Using {app} responsibly'],
      ['p', 'You agree not to use {app} to break the law or to infringe anyone else\'s rights, including copyright in material you copy into your notes, and not to interfere with the service or try to reach other people\'s accounts or data.'],

      ['h', '5. Lessons and credits'],
      ['p', 'Most of {app} is free. A lesson written to order is written by an AI model and costs a lesson credit, which you can buy through Stripe. An AI-written lesson can contain mistakes, including wrong facts or mark schemes, so check it against your course materials and your teacher before relying on it for an exam.'],

      ['h', '6. Third-party services'],
      ['p', '{app} relies on services run by others: Supabase for accounts and storage, unpkg.com for software libraries, Stripe for payments, and an AI model provider for written lessons. {company} does not control them and is not responsible for them. The Privacy Policy explains what each one receives.'],

      ['h', '7. Open-source software'],
      ['p', '{app} includes open-source components. Each is provided under its own license, listed under Licenses in this section, and that license governs your use of the component.'],

      ['h', '8. No warranty'],
      ['p', '{app} is provided "as is" and "as available", without warranties of any kind, whether express or implied, including fitness for a particular purpose and non-infringement.'],

      ['h', '9. Limitation of liability'],
      ['p', 'To the fullest extent permitted by law, {company} is not liable for any indirect, incidental, special or consequential damages, or for any loss of data, arising from your use of {app}. Nothing in these terms limits liability that the law does not allow to be limited.'],

      ['h', '10. Changes and ending use'],
      ['p', 'You can stop using {app} at any time. {company} may update these terms, and the updated version will appear here with a new effective date.'],

      ['h', '11. Governing law'],
      ['p', 'These terms are governed by the laws of {jurisdiction}, except where the law of the country you live in gives you rights that cannot be waived.'],

      ['h', '12. Contact'],
      ['p', 'Questions about these terms can be sent to {email}.'],
    ],
  },
};
