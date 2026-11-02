# Building Ledger

A small web app that replaces the paper notebook used to track monthly building
expenses. Each apartment gets a per-service amount to pay, and the treasurer
records the payments as they come in — everything is live and printable.

- **Dynamic apartments** — add, edit, archive as the building changes.
- **Dynamic services** — water, sewage, cleaning, generator, elevator… anything
  you bill for (`3` services today, `7` next year, no code changes).
- **Monthly periods** — one `YYYY-MM` document per month, with `draft → open →
  closed` lifecycle and "copy last month's amounts" helpers.
- **Payments per service** — partial payments, `cash | bank | other`, dates, notes,
  and every row can be corrected (amount, date, method, note) or deleted — the
  balance is recalculated instantly.
- **Type-to-pay grid** — an amount typed into the monthly grid is recorded as paid
  in the same step; clicking the paid figure reopens it for a correction.
- **Shared expenses** — mark a service as building-wide and enter one total per
  month; it is never charged to an apartment, it is deducted from the available
  balance.
- **Statements** — printable building statement and per-apartment statement.
- **English + Arabic (RTL)** and **JOD** (three decimals) out of the box.
- **Roles** — `admin` (treasurer) writes everything, `resident` reads only their
  own apartment.
- **Resident dashboard** — filter by month or choose **All time** to total charges,
  payments and balances across every month; printed statements follow the filter.

## Stack

| Concern    | Choice                                            |
| ---------- | ------------------------------------------------- |
| UI         | React 19 + TypeScript + Vite 6                    |
| Styling    | Tailwind CSS 3 (logical properties for RTL)       |
| Routing    | React Router 6                                    |
| Data       | Firebase Auth (phone username/password) + Cloud Firestore |
| Hosting    | Firebase Hosting (static SPA)                     |
| Tests      | Vitest (+ `@firebase/rules-unit-testing`)         |

No SMS, Cloud Functions, or hosted authentication backend are required. The app
can run on the free Spark plan, subject to Firebase's usage limits. Deleting a
resident removes their profile and building access, not their Firebase login.

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in your Firebase web config
npm run dev                    # http://localhost:5173
```

### Firebase setup

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Authentication → Sign-in method → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode).
4. **Project settings → Your apps → Web app** → copy the config values into
   `.env.local`.
5. Point `.firebaserc` at your project id.
6. Run `npm run deploy` to deploy hosting, rules, and indexes. No billing upgrade
   or Cloud Functions deployment is required.

### Phone usernames and passwords

Users sign in with a mobile number and password; no SMS or email is sent for
phone accounts. For Jordanian mobile numbers, enter 10 digits starting with
`07`, for example `0791234567`. Spaces, parentheses, hyphens, and Arabic-Indic
or Persian digits are accepted. International numbers are also supported:
enter `+` followed by 7–15 digits including the country code, without the
national trunk prefix. For example, `0791234567` and `+962791234567` identify
the same account.

Firebase's password provider requires an email-shaped identifier, so the app
maps each number to a non-deliverable address in the reserved `.invalid`
domain, such as `phone-962791234567@phone.building-ledger.invalid`. This is an
internal username, not a mailbox. **A phone number is not verified by this
scheme**: the administrator must confirm the person's identity by another
means before sharing credentials.

Administrators add residents from **Residents**, then share the displayed
temporary password privately. It is shown only once. Residents and
administrators can change their own password using the lock button beside
their account in the navigation. If a password is forgotten, a project
administrator must reset it with the local tool below; email reset links cannot
be delivered to phone accounts. For a new project with no legacy accounts, set
`VITE_ALLOW_LEGACY_EMAIL_LOGIN=false` before starting or building the app.

Administrators can delete a resident using the trash button on **Residents**.
After confirmation, the app deletes the resident's Firestore profile. Their
login can still authenticate, but without a profile they cannot access building
data. Administrator profiles and the signed-in profile cannot be deleted.
Apartments, charges, and payments remain unchanged. Deploy the Firestore rules
to enforce these protections.

**Before reusing a deleted resident's phone number**, a project administrator
must remove the old login manually:

1. Open **Firebase Console → Authentication → Users**.
2. Find the login by its internal username, for example
   `phone-962791234567@phone.building-ledger.invalid` for `0791234567`.
   Legacy accounts may still use their original email.
3. Verify that it belongs to the removed resident, then delete that login.
4. Add the resident again from the app if needed.

The confirmation, success notice, and duplicate-phone error explain this
manual cleanup. No Cloud Functions or Blaze plan are needed for this workflow.

Firebase email/password sign-up is publicly reachable. An unapproved account
has no building access without an administrator-created `users/{uid}` profile,
but someone can reserve an internal username and prevent its creation or
migration. Resolve such conflicts in Firebase Authentication only after
checking the account and its profile; do not grant access to an unknown account.

### Local administration

The local tool uses the Firebase Admin SDK and must be run only by a trusted
project administrator. It requires Node.js 22 or newer. Install the development
dependencies with `npm install` and use Application Default Credentials with
permission to manage Firebase Authentication users and read/write Firestore.
For example, with the Google Cloud CLI installed:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

The quota project is required by Firebase Authentication when using local user
credentials. The tool's `--project` option selects the Firebase project but does
not configure ADC's quota project. If setting it is denied, ask a project owner
to grant your Google account the Service Usage Consumer role, in addition to
the Authentication and Firestore permissions above.

See [Firebase Admin setup](https://firebase.google.com/docs/admin/setup) for
other credential options. Never commit service-account credentials or temporary
passwords. Replace `YOUR_PROJECT_ID` in the commands with the Firebase project
ID. The commands that display a password must run in an interactive terminal;
do not redirect their output to a file or log.

**Create the first administrator** (or another administrator):

```bash
npm run users:admin -- create-admin --project YOUR_PROJECT_ID --phone 0791234567 --name "Treasurer"
```

The tool creates the Firebase Auth account and its active `users/{uid}` admin
profile. Share the temporary password privately and sign in with the phone
number. The administrator can then add residents in the app.

**Reset a forgotten password:**

```bash
npm run users:admin -- reset --project YOUR_PROJECT_ID --phone 0791234567
```

Share the new temporary password privately and have the user change it. Firebase
revokes the account's refresh tokens after the password change; an already
issued ID token may remain valid until it expires.

### Migrate existing email accounts

Before deploying phone-only sign-in, obtain and confirm each user's unique
phone number and record their existing Firebase Auth UID. Deploy the updated
app first: legacy email sign-in and email password resets are enabled by default
so existing users can continue to sign in during migration.

Run the following command for each existing administrator and resident:

```bash
npm run users:admin -- migrate --project YOUR_PROJECT_ID --uid EXISTING_UID --phone 0791234567
```

The command changes the Firebase Auth identifier and records the phone number
on the existing profile. The UID, role, apartment, and password remain the
same; the original profile email field is retained as legacy data. Firebase
may invalidate existing sessions or send an account-change notice to the old
address when the identifier changes. Verify phone sign-in for the administrator
and each resident, then set
`VITE_ALLOW_LEGACY_EMAIL_LOGIN=false` and rebuild/deploy to disable legacy
email sign-in. A phone already assigned to another Auth account is rejected.
If the Auth update succeeds but the profile update fails, re-run the same
command to finish the migration. The same command can update an already
migrated user's phone number while keeping their UID and password.

## Local development with emulators

```bash
npm run emulators -- --project demo-building-ledger  # auth :9099, firestore :8080, UI :4000
# in another terminal
VITE_USE_EMULATORS=true VITE_FIREBASE_API_KEY=demo-test-key \
  VITE_FIREBASE_PROJECT_ID=demo-building-ledger VITE_FIREBASE_APP_ID=demo-test-app npm run dev
```

Create an emulator administrator using the same local tool. Set **both**
emulator host variables so Auth and Firestore cannot accidentally point at
different environments:

```bash
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  npm run users:admin -- create-admin --project demo-building-ledger --phone +15551234567
```

Emulator data is lost when the emulators stop unless it is exported.

The emulator suite needs a JVM. On macOS:

```bash
brew install openjdk@21
```

The `test:rules` script puts that JDK on `PATH` automatically (and silently falls
back to whatever `java` is already installed).

## Tests

```bash
npm test          # unit tests, including phone account logic
npm run test:rules  # Firestore rules against the emulator (starts/stops it for you)
npm run test:phone-auth # account lifecycle and access removal against Auth and Firestore
```

`tests/billing.test.ts` covers the arithmetic that must never drift — fils
conversion, Arabic-Indic input parsing, period shifting, and the charge/payment
matrix including archived apartments.

`tests/rules/firestore.rules.test.ts` proves the permission model:

- anonymous users are denied everywhere;
- an account without a `users/{uid}` document can read only its own (missing)
  profile, so the app can show a "no access" notice instead of an error;
- a deactivated profile loses all access;
- residents read their own apartment, charges and payments and nothing else —
  including that an unconstrained `payments` list and a collection-group `charges`
  query for someone else's apartment are both rejected;
- residents cannot write anything, cannot change their own `role`, and cannot
  reassign their own `apartmentId`;
- admins manage building data, create residents, and can delete resident
  profiles, but cannot delete their own profile or any administrator profile;
- admins may only create payments that pass the integer/positive/string-shape validation.

`tests/residentAccounts.test.ts` and `tests/residentsPage.test.ts` cover the
profile-deletion API and administrator-only controls. The phone-account
integration test verifies revoked access despite a retained login, phone reuse
only after manual Auth cleanup, and preservation of apartment billing history.

## Scripts

| Script              | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Vite dev server                                       |
| `npm run build`     | Typecheck, then production bundle into `dist/`        |
| `npm run preview`   | Serve the built bundle locally                        |
| `npm run typecheck` | `tsc --noEmit`                                        |
| `npm test`          | Unit tests, including phone account logic             |
| `npm run test:rules`| Firestore rules tests (starts the emulator)           |
| `npm run test:phone-auth` | Phone account lifecycle (starts both emulators) |
| `npm run emulators` | Firebase emulator suite                               |
| `npm run users:admin -- --help` | Local admin, migration, and recovery tool |
| `npm run deploy`    | Deploy hosting + rules + indexes                      |

## Deploying

```bash
npx firebase login
# edit .firebaserc so "default" is your project id
npm run deploy
```

`firebase.json` publishes `dist/` with an SPA rewrite (`** → /index.html`), so
deep links such as `/periods/2026-01` and `/apartments/abc/print` work.

## Data model

```
settings/building            { name, address, currency, defaultLang,
                               cashOnHandMinor, cashCountedAt }
users/{uid}                  { phone, displayName, role, apartmentId, active, createdAt, email? }
apartments/{apartmentId}     { name, floor, number, ownerName, phone, email, archived, order, createdAt }
services/{serviceId}         { nameEn, nameAr, archived, order, createdAt }
periods/{periodId}           { year, month, status: draft|open|closed, notes, createdAt, closedAt,
                               sharedAmountsMinor: { [serviceId]: total } }
periods/{periodId}/charges/{apartmentId}
                             { apartmentId, amountsMinor: { [serviceId]: fils } }
payments/{paymentId}         { periodId, apartmentId, serviceId, amountMinor,
                               paidAt, method: cash|bank|other, note, recordedBy, createdAt }
```

All money is stored as **integer minor units** (fils, `1 JOD = 1000`), never as a
float, so totals always reconcile exactly.

## Available balance (opening cash)

The building's cash did not start with this app, so the running total is
**derived, not typed in by hand**:

```
available = cashOnHandMinor + Σ (payments recorded after cashCountedAt)
```

- On the **Dashboard**, the *Available balance* card shows the derived figure and
  a breakdown ("X counted on 15 Oct + Y collected since", minus shared expenses
  paid out of that cash).
- Press **Update cash**, enter the cash you physically have in the box and the
  date you counted it, and save. Payments already in the system before that date
  are ignored; anything recorded after it is added automatically.
- Re-count whenever you like: a new count becomes the new baseline, so old
  payments are never counted twice.
- The same two fields are editable in **Settings → Available balance**.

This means you can adopt the app today with zero history: just enter the cash on
hand and carry on recording payments.

## Typing an amount marks it paid

The monthly grid is the treasurer's desk: the amount typed into a cell is what
the apartment was told to pay — and in practice it is also what they handed over.

- Typing an amount into a cell records the same amount as a **payment** for that
  apartment and service, so the row reads *Paid* (or *Partial*) instead of
  *Unpaid* without a second step. The payment carries today's date and the
  **bank transfer** method (the same default as the dialog) and shows up in the
  payments list like any other; a method or note corrected by hand is kept when
  the amount is later changed.
- Clicking the green paid figure under a cell opens that payment for editing, so a
  wrong date, amount or method is corrected right there.
- Setting the cell back to `0` removes both the charge and its mirrored payment.
- A cell that already has a payment of its own (recorded through the dialog) is
  left alone: a real receipt always wins over the mirror.
- The mirror uses a deterministic id — `cell__<period>__<apartment>__<service>` —
  so re-typing an amount updates one payment instead of piling up duplicates, and
  the date of the first entry is kept.

## Correcting a payment

Every payment row has two small buttons on the right — the pencil and the bin —
on the month page and on the apartment's payment history (the paid figure in the
grid opens the same dialog):

- **Edit** (pencil) opens the same dialog with the payment filled in. The
  amount, the date, the method and the note can be corrected; the apartment and
  the service stay fixed, because moving money between two statements silently
  changes both. Saving recomputes the grid, the totals, the statement and the
  available balance immediately.
- **Delete** (bin) asks for confirmation, then removes the payment and
  recalculates everything.
- A **closed** month stays locked, exactly like its amounts: reopen the month
  first.

Only the admin (treasurer) sees these buttons; residents read their own history.

## Shared (building-wide) expenses

Some costs belong to the building, not to one apartment — one water bill, one
generator invoice. Tick **Building-wide expense** on the service (Services page)
and the monthly billing page grows a *Shared expenses* card:

- Enter the **total** once (e.g. `70.000`).
- It is **not** charged to any apartment. A shared service gets no column in the
  billing grid, no row in the totals, and no line on a statement, resident page or
  print document — `computeBilling` filters shared services out entirely.
- It is **money the building spent**, so it is subtracted from the available
  balance (the dashboard shows it as `−70.000 paid out on shared expenses`).
  Nobody handed that money over, so it is never recorded as a payment and no
  apartment is marked collected because of a shared bill.
- Only months from the count's own month onward are subtracted — anything earlier
  is already inside the counted cash. Re-counting the drawer re-baselines the
  balance.
- Setting the total back to `0` removes the expense from the balance.
- Every month has a **Comments** box under the totals (stored as `sharedNote` on
  the period document): what the bills covered, who paid them, anything worth
  remembering. It is saved when the field loses focus and is informational only —
  it never changes an amount, a payment or the balance.
- Copying a previous month carries the totals (= the expenses) over as well.
- Older builds wrote the total into each apartment's charge and created
  `shared__…` payment documents. Opening a month now clears those leftovers once
  (`clearSharedLeftovers`), so no charge or payment row is left behind.

## Copying a previous month

**Copy amounts from <month>** repeats last month's layout in one click: every
apartment that had an amount gets the same amount, and the shared totals come
along.

The **paid state travels with the amounts**. If a cell was settled last month, the
new month gets a matching payment (deterministic `cell__…` id, bank transfer,
dated today, credited to whoever pressed the button), capped at the copied amount.
A partly paid cell is copied as partly paid. Cells that were still owed last month
stay **Unpaid**, so nothing is marked collected by accident. Deleting or editing
those copied payments afterwards works like any other payment.

## Last 6 months chart

Each bar is one month: the grey column is what the month **cost the building** —
the apartment charges **plus** the shared expenses entered for that month — and
the green part is what was actually **collected**. Both are drawn against the same
scale (the tallest bar), so heights are comparable month to month. The exact
figures sit under every bar, and the tooltip splits charged / collected / shared.

## Appearance (dark by default)

The app ships **dark**: `index.html` sets `class="dark"` on `<html>` and a tiny
inline script clears it only when the browser stored an explicit `light` choice,
so there is no light flash on load. The sun/moon button in the header switches
between the two and remembers the choice (`localStorage['theme']`); clearing site
data puts you back on dark.

The shared navigation, sign-in screen, cards, forms and tables use the same
responsive visual system in both themes. Navigation and layouts use logical
spacing so they also work in Arabic (RTL).

The markup is written with light-theme utility classes and the dark look is a
remap of those same utilities under `.dark` at the end of `src/index.css`
(surfaces, borders, slate/brand/emerald/rose/amber/sky text) plus the component
classes (`.card`, `.input`, `.label`, `.table-base`). Those overrides live inside
`@media screen`, so statements and other print documents always print on white.

## Project layout

```
src/
  api/          write operations (one module per collection)
  components/   ui/ primitives, layout, billing widgets, print documents
  context/      auth, i18n, building settings
  firebase/     app init, typed converters, collection references
  hooks/        live onSnapshot hooks
  lib/          money / period / billing math, i18n dictionaries, helpers
  pages/        screens (admin, resident, print)
  routes/       route guards
tests/          unit tests (+ rules tests under tests/rules)
```
