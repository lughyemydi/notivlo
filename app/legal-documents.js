/* The Privacy Policy and Terms of Use shown under Settings → Legal.
 *
 * These are drafts, written to describe what notivlo actually does — every
 * statement about storage, network connections and security below reflects the
 * app as built. They are not legal advice. Before relying on them:
 *
 *   1. have them reviewed by someone qualified for where you operate;
 *   2. fill in `info` below;
 *   3. set `reviewed: true` — until then Settings shows a draft notice above
 *      the documents.
 *
 * If the app's behaviour changes — a new network connection, analytics, a
 * server — these documents must change with it, or they stop being true.
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
      ['p', 'This policy explains what {app} does with information about you. The short version: {app} has no servers. What you create stays on your device, and {company} never receives it.'],

      ['h', 'What stays on your device'],
      ['p', '{app} stores the following locally, in your browser\'s storage or in the app\'s own storage on Mac and iPhone:'],
      ['li', 'Your account: your name, your email address, and a one-way hash of your password (PBKDF2). Your password itself is never stored.'],
      ['li', 'Your notebooks: chapters, notes, formulas, drawings, and any images you add.'],
      ['li', 'Your agenda entries, and the study time {app} records for each day.'],
      ['li', 'Your preferences, such as light or dark appearance, text size and notebook sort order, and a count of recent failed sign-in attempts, used to slow down password guessing.'],
      ['p', 'None of this is sent to {company}. Your account exists only on this device: it isn\'t an online account, and it can\'t be used to sign in anywhere else.'],

      ['h', 'When {app} connects to the internet'],
      ['p', 'When it opens, {app} downloads software libraries it runs on (React and related code) from unpkg.com, a public code-hosting service. Like any website, that service can see your IP address and basic information about your device. No notebook content or account details are sent. This is the only connection {app} makes.'],
      ['p', '{app} has no analytics, no advertising and no tracking, and it doesn\'t use cookies.'],

      ['h', 'Exporting and deleting your data'],
      ['li', 'Settings → Data exports your notebooks, agenda and preferences to a file you keep. The export leaves out your password data.'],
      ['li', 'Settings → Danger zone can erase all notebooks and agenda entries, or delete your account along with everything stored for it.'],
      ['li', 'Deleting the app, or clearing this site\'s data in your browser, removes everything {app} has stored.'],
      ['p', 'Because nothing is stored online, {company} cannot recover lost data or restore a deleted account. Keep an export if your notes matter to you.'],

      ['h', 'Security'],
      ['p', '{app} hashes passwords, limits repeated sign-in attempts, removes unsafe content from pasted and saved notes, and blocks connections to anywhere other than the service above. Your data is still stored on your device, though, so anyone who can use your unlocked device may be able to reach it, including by resetting the {app} password, which doesn\'t require the old one. Your device\'s own passcode or login is what protects it.'],

      ['h', 'Children'],
      ['p', '{app} doesn\'t collect personal information from anyone, including children.'],

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
      ['p', '{app} is a notebook app for studying. It works on your device: accounts, notebooks and agenda entries are stored locally, not on servers run by {company}.'],

      ['h', '2. Your content'],
      ['p', 'Everything you write, draw or attach in {app} belongs to you. {company} claims no rights to it and never receives a copy.'],
      ['p', 'You are responsible for your own backups. Because {app} stores data only on your device, lost or deleted data cannot be recovered by {company}. Settings → Data lets you export a copy.'],

      ['h', '3. Using {app} responsibly'],
      ['p', 'You agree not to use {app} to break the law or to infringe anyone else\'s rights, including copyright in material you copy into your notes.'],

      ['h', '4. Third-party services'],
      ['p', '{app} loads software libraries from unpkg.com. {company} does not control that service and is not responsible for it.'],

      ['h', '5. Open-source software'],
      ['p', '{app} includes open-source components. Each is provided under its own license, listed under Licenses in this section, and that license governs your use of the component.'],

      ['h', '6. No warranty'],
      ['p', '{app} is provided "as is" and "as available", without warranties of any kind, whether express or implied, including fitness for a particular purpose and non-infringement.'],

      ['h', '7. Limitation of liability'],
      ['p', 'To the fullest extent permitted by law, {company} is not liable for any indirect, incidental, special or consequential damages, or for any loss of data, arising from your use of {app}. Nothing in these terms limits liability that the law does not allow to be limited.'],

      ['h', '8. Changes and ending use'],
      ['p', 'You can stop using {app} at any time; deleting the app or its data removes everything it stored. {company} may update these terms, and the updated version will appear here with a new effective date.'],

      ['h', '9. Governing law'],
      ['p', 'These terms are governed by the laws of {jurisdiction}, except where the law of the country you live in gives you rights that cannot be waived.'],

      ['h', '10. Contact'],
      ['p', 'Questions about these terms can be sent to {email}.'],
    ],
  },
};
