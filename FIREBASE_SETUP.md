# GovtPrep Firebase setup

GovtPrep uses the Firebase modular Web SDK directly from Google's CDN. It does
not use MySQL, PHP, or a separate application backend. Its current cloud-data
integration uses **Cloud Firestore**; Realtime Database is not used by the
frontend. The Firebase web app
configuration is public client configuration; Firestore Security Rules and
Firebase Authentication provide the access controls. Never put service-account
credentials in this frontend.

## 1. Create and configure a Firebase project

1. Open the `govtprep-1f2be` project in [Firebase Console](https://console.firebase.google.com/).
2. The provided web app configuration is already in `firebase-config.js`. If
   you use a different Firebase project, replace those settings with its Web
   app configuration.
3. In **Authentication → Sign-in method**, enable **Google**. Google sign-in
   handles both new account creation and returning student sign-in; the app
   does not ask users to enter an email address or password.
4. Create a **Cloud Firestore** database. Choose the production/locked mode.
5. In Firestore **Rules**, publish the contents of `firestore.rules`.
6. Add the domain used to host GovtPrep to **Authentication → Settings →
   Authorized domains**. For local testing, serve the folder over HTTP, for
   example with `py -m http.server 8000`, and open `http://localhost:8000`.
   ES modules and Firebase Auth do not work reliably from a `file://` URL.

## 2. Configure the secure AI study assistant

The assistant calls a Firebase callable Cloud Function in `functions/index.js`.
The function requires a signed-in Firebase user, limits each account to 40 AI
requests per UTC day, validates generated content, and keeps the provider key
in Firebase Secret Manager. The browser does not receive the AI API key.

1. Use Node.js 20 and install the Firebase CLI: `npm install -g firebase-tools`.
   Sign in with `firebase login` and make sure the CLI can access
   `govtprep-1f2be`.
2. Create an API key with your AI provider and set it as a Firebase secret from
   the project folder with `firebase functions:secrets:set OPENAI_API_KEY --project govtprep-1f2be`.
   Enter the key at the CLI prompt; do not put it in `app.js`,
   `firebase-config.js`, or any checked-in file.
3. Install the function dependencies: `npm --prefix functions install`.
4. Deploy the callable: `firebase deploy --project govtprep-1f2be --only functions:generateStudyContent`.
5. Publish the owner-scoped Firestore rules: `firebase deploy --project govtprep-1f2be --only firestore:rules`.

The function uses OpenAI's Chat Completions API and defaults to `gpt-4o-mini`.
The Cloud Functions project must have billing enabled for deployment and
outbound requests. Set provider spending limits and Firebase budget alerts in
their respective consoles. The per-user daily limit is a usage guard, not a
provider-wide spending cap. Provider and callable errors are shown in the
assistant without substituting sample or hardcoded answers.

The assistant stores data only under the signed-in UID:

- `aiChats/{uid}/conversations/{conversationId}/messages/{messageId}` stores
  chat turns; the conversation document stores its title and timestamps.
- `aiQuestions/{uid}/items/{questionId}` stores generated question sets.
- `aiBookmarks/{uid}/items/{bookmarkId}` stores saved explanations.
- `_privateAiUsage/{uid}` is written only by the Cloud Function to enforce the
  daily request limit and is not readable by browser clients.

Cloud Function deployment and Firestore rules are separate from hosting the
static website. Deploy both before trying AI features; Google sign-in must also
be enabled. The chat, generator, and personalized recommendations require a
signed-in student and an active provider API key.

## 3. Optional: Firebase Realtime Database rules

If you also create a Firebase Realtime Database, `database.rules.json` contains
an owner-scoped ruleset for the equivalent student data paths and admin-only
catalog writes. In Firebase Console, open **Realtime Database → Rules**, replace
the editor contents with this file, and publish. These rules do not switch the
existing frontend from Firestore to Realtime Database; that would require
changing the app's database calls and data layout as well.

The Realtime Database rules require the documented fields and validate their
values. They do not enforce an exact child count: Realtime Database rules do not
support `numChildren()`. Add explicit `$other` validation rules if a data path
must reject fields beyond its documented schema.

The Realtime Database sample expects student-owned data at
`students/{uid}`, `profiles/{uid}`, `testResults/{uid}/{resultId}`,
`studyPlans/{uid}/{planId}`, and `bookmarks/{uid}/{questionId}`. Catalog paths
are `exams`, `questions`, and `jobNotifications`. Keep the Firestore rules
published separately while the frontend continues using Firestore.

## 4. Firestore data layout

Private data is scoped under the authenticated Firebase UID:

- `students/{uid}`: account summary created at registration.
- `profiles/{uid}`: display name, target exam and study goal.
- `testResults/{uid}/results/{resultId}`: practice and mock-test results.
- `studyPlans/{uid}/plans/{day}`: per-day checklist and study goal.
- `bookmarks/{uid}/items/{questionId}`: a student's saved questions.
- `learningProgress/{uid}/items/{videoId}`: per-student video bookmarks and
   completed lesson state. The matching owner-only validation is in
   `firestore.rules`.
- `paperAttempts/{uid}/attempts/{attemptId}`: immutable previous-paper scores,
   selected answers, attempt time and elapsed time.

The public-to-signed-in-students, read-only catalogs are `exams/{examId}`,
`questions/{questionId}`, and `jobNotifications/{jobId}`. Catalog writes require
an `admin: true` custom auth claim set by trusted server-side administration.
The current frontend keeps its sample catalogs locally; no admin publishing UI
is included. After a student signs in, it reads up to 100 documents from each
catalog collection and uses valid cloud entries in place of its local sample
catalog for that type. Seed catalogs in the Firebase Console or from a trusted
admin environment. Do not loosen client write rules to let browser clients
publish exam questions or vacancy notices.

Expected catalog document fields:

- `exams/{examId}`: `name`, `area`, `date`, `icon`, `mode` (`graduate` or
  `12th`), and `detail`.
- `questions/{questionId}`: `subject` (`aptitude`, `reasoning`, `english`,
  `gk`, `science`, or `computer`), `prompt`, `options` (exactly four strings),
  `answer` (zero-based integer from 0 to 3), and `explanation`.
- `jobNotifications/{jobId}`: `title`, `organization`, `logo`, `eligibility`,
  `posts`, `deadline`, `category`, and `detail`.

When a signed-in student opens **Job notifications**, the app refreshes the
latest published Firestore catalog (up to 100 entries). The page also has a
manual **Refresh** button. Keep this catalog current through trusted admin
publishing; the frontend does not scrape or invent vacancy notices.

The client validates these fields and ignores malformed catalog documents.

The `students` and `profiles` documents are initialized after Firebase Auth
creates the account. Passwords are handled only by Firebase Authentication and
are never written to Firestore.

## 5. Previous Year Papers

The paper catalog intentionally starts empty. GovtPrep does not fabricate
previous-year questions or PDFs. The page lists official source portals for SSC,
IBPS, SBI, RRB, APPSC and AP SLPRB; it shows an unavailable state until a
verified paper is published.

Enable **Firebase Storage** in the existing project. Paper metadata and online
questions are stored in Firestore:

- `previousYearPapers/{paperId}`: exam, category, year, subject, title,
   official source, PDF paths/URLs, answer-key URL, question count and publish
   state.
- `previousYearPapers/{paperId}/questions/{questionId}`: question, exactly
   four options, correct option index, English explanation and optional
   Telugu-English explanation.
- `paperAttempts/{uid}/attempts/{attemptId}`: student-owned score, correct,
   incorrect and unanswered totals, selected answers, attempt timestamp and
   elapsed seconds.
- `previousYearPapers/{paperId}/question-paper.pdf` and
   `previousYearPapers/{paperId}/answer-key.pdf`: uploaded PDFs in Storage.

To enable admin management, assign the `admin: true` custom claim from a
trusted server using the Firebase Admin SDK. Never put service-account
credentials in the browser. Example server-side assignment:

```js
const user = await getAuth().getUser(uid);
await getAuth().setCustomUserClaims(uid, { ...user.customClaims, admin: true });
```

The admin signs out and back in after the claim is assigned. The papers page
then shows the upload/edit/remove panel. Admins must add the official source
name and HTTPS URL, upload the authentic PDF, and enter sourced questions and
answer explanations before online practice becomes available. PDFs are limited
to 25 MB. Regular students can only read published entries; attempts are
readable only by their owner.

Deploy the updated security rules:

```sh
firebase deploy --project govtprep-1f2be --only firestore:rules
firebase deploy --project govtprep-1f2be --only storage
```

## 6. Run and verify

Serve the project directory using any static HTTP server. With Python installed,
run `py -m http.server 8000` from this folder and visit
`http://localhost:8000`. Register a test student, sign out, sign in, reset the
password, complete a practice or mock test, and verify that the profile,
results, bookmarks and study plan persist after reloading.

Then sign in and open **AI study assistant**. Test an English and Telugu
question, generate a question set for each difficulty, check recommendations
after completing tests in multiple subjects, bookmark an explanation, clear a
conversation, and reload to verify the chat history and bookmarks remain.

For Previous Year Papers, sign in as an admin, publish a source-verified paper
and answer key, add its genuine questions, then test PDF viewing/download,
filters, timed practice, score review, and dashboard attempt history. Sign in as
a regular student to confirm management controls are hidden and another
student's attempts are not visible.

If `firebase-config.js` still contains placeholders, GovtPrep intentionally
remains in its local demo mode. After entering a real configuration, Firebase
Auth and Firestore errors are shown in the interface; inspect the browser
console for initialization diagnostics.

Review the rules before production deployment and configure recovery/contact
details and any project-specific retention policies in Firebase Console.
