# Job Order - backend

Node.js + Express + MongoDB (Mongoose). Redis is optional (`IS_REDIS_SERVER_ON`).

## Run it

```sh
npm install
cp .env.example .env   # then fill it in - never commit .env
npm run dev            # http://localhost:5000, restarts on file changes
```

## Ids are encrypted

No raw MongoDB id ever reaches a page: every id in a JSON response, a live
update (socket.io) or a login token is encoded with `common.encodeId`
(AES-256-CBC with `ID_ENCRYPTION_KEY` / `ID_ENCRYPTION_IV` from `.env` - the
same id always gives the same string, so links keep working). Pages send
those encoded ids back; `middlewares/idEncryption.js` (mounted before every
route) decodes them in the URL, the query and the body, and
`parseMultipartData` does the same for the JSON of a multipart request. So
validations, controllers and services only ever see real ids and need no
changes. The rules are in `utils/idEncryption.js`:

- out: ObjectIds anywhere, 24-hex strings under id keys (`_id`, `id`,
  `ids`, `...Id`, `...Ids`), object keys that are ids, and the ids inside
  field error names (`masters.<id>`);
- in: any encoded id is decoded; a raw id under an id key (or in the URL)
  is made invalid, so it is refused like any bad id; a tampered one is
  refused too. Passwords and the login identifier are never touched.

Set both keys before going live and never change them: a missing key falls
back to a random one per start, and every link and open page breaks on
restart. Login tokens made before this keep working until they end.

## Add a vendor

Every vendor is picked by the host name the app is opened on (`Vendor.domain`).

```sh
SEED_VENDOR_DOMAIN=vendor1.localhost SEED_COMPANY_NAME="Company name" SEED_LOGIN_TAGLINE="Optional tagline" npm run seed
```

This creates the vendor, its Company Master, its Company Settings (company
name, login tagline) and its owner login (password from `SEED_ADMIN_PASSWORD`).
Safe to re-run: an existing vendor, Company Settings or owner is left as it
is. WebsiteMaster and Company Master, however, get the seed's values again.

The seed also fills the platform-wide location and tax masters (the same for
every vendor): `seeds/seedLocationMasters.js` (currencies, countries with their
tax fields, states, cities - updated in place on a re-run) and
`seeds/seedTaxMaster.js` (tax rates - a rate already there is never changed).

## Feature switches

A feature works for a vendor only when it is on in **WebsiteMaster** (for the
whole platform) **and** in that vendor's **CompanyMaster**. While it is off on
either side, every request of that feature is refused and the frontend hides
it (`GET /api/feature-access`). The flags are listed in
`constants/featureConstants.js`.

| Feature | Flag | Also needs (CompanyMaster) |
| --- | --- | --- |
| Masters | `isMasterModuleFeatureOn` | `numberOfMastersAllowed`, `numberOfValuesAllowedInMaster` |
| Controls | `isControlsFeatureOn` | `assignedControls` (see Controls) |
| Tax | `isTaxFeatureOn` | `assignedCountries` (see Tax) |
| Job order images | `isImageUploadFeatureOn` | optional limits `numberOfImageUploadAllowed`, `maxImageUploadSizeMB`, `imageFormatsAllowed` (see Job orders) |
| Users and Role Master (RBAC) | `isRBACFeatureOn` | optional limits `numberOfRoleCreationAllowed`, `numberOfUsersAllowed`; `isAssigningSeveralRolesAllowed`, `isRoleAssignmentOnUserModuleAllowed` (see Users) |
| Layout Master (print layouts) | `isLayoutMasterFeatureOn` | optional limit `numberOfLayoutsAllowed`; `isControlFeatureInLayoutOn` for text formatting (see Layout Master) |
| Steps of assigned work | `isStepFeatureOn` | `steps` and optional limit `numberOfStepsAllowed` (see Steps of assigned work) |
| Customers | `isCustomersFeatureOn` (WebsiteMaster default on, CompanyMaster default off) | nothing (see Customers) |
| Per unit pricing | `isPerRatePricingFeatureOn` (WebsiteMaster default on, CompanyMaster default off) | nothing (see Per unit pricing) |

Not a switch: `numberOfItemsAllowedToAddInJobOrder` (CompanyMaster, default
1, at most 50) - how many items one job order may have (see Job orders).

`CompanyMaster.fetchMastersEvenWhenBitIsOff` (default false) only matters while
the vendor's `isMasterModuleFeatureOn` is off: the Masters page stays hidden and
every master action stays blocked, except `GET /api/masters/for-job-order`, so
the job order form still gets the masters. The platform-wide WebsiteMaster
switch still applies.

`CompanyMaster.fetchControlsEvenWhenBitIsOff` (default false) works the same way
for Controls: while the vendor's `isControlsFeatureOn` is off, only
`GET /api/controls/for-job-order` still works (the controls of the assigned
types). `GET /api/feature-access` returns `canFetchMastersForJobOrder` and
`canFetchControlsForJobOrder` so the job order form knows what it gets.

## Maintenance, payment and the shop closed

Set in the database by you (the seller), except the shop, which the owner
closes from Company Settings. Checked on every request after the login
(`middlewares/requireServiceOpen.js`, `services/serviceStatusService.js`),
which answers 503 with `data.block = { state, message, ... }`; the frontend
then shows a full page instead of the app.

| What | Where | Who is stopped | What they see |
| --- | --- | --- | --- |
| Maintenance for everyone | WebsiteMaster `underMaintenance` (+ optional `maintenanceMessage`) | everyone, also the login | "Under maintenance" with the message |
| Maintenance for one vendor | CompanyMaster `underMaintenance` (+ optional `maintenanceMessage`) | that vendor, also the login | the same |
| Payment not done | CompanyMaster `paymentNotDone` (+ optional `paymentMessage`) | that vendor after login | the owner: "Payment pending" with the message; users: "System unavailable, contact your owner" (never why) |
| Shop closed | CompanySettings `shopClosed`, `shopClosedMessage`, `estimatedResumeTime` | that vendor's users (the owner keeps working, with a banner) | "Shop closed" with the message and, when set, when it opens again |

With `estimatedResumeTime` the shop opens by itself at that time (the
message and time are cleared); without it the shop stays closed until the
owner opens it again. A background job (`services/serviceStatusWatcher.js`,
every 15 s) notices changes made straight in the database, clears the cache
and opens shops whose time has come. Messages are at most 500 characters.

## Masters

A master is a vendor's own dropdown list for the job order form, e.g. "My
Services" with the values Polishing, Cutting, Edging.

- Master: `name` (unique per vendor, ignoring capital letters), `shortName`
  (optional, unique the same way), `isMultiselectAllowed`, `isRequired` (a
  job order can't be saved without a value picked), `isRoleProvided` ("Role
  will be provided for this master": a master role can use it; it can't be
  unticked while a role uses it. Deleting a master roles or users use needs
  `removeFromRoles` - said yes to the alert listing them, from
  `POST /api/masters/role-usage` - and it then leaves those roles and users'
  extra / taken-away access; the roles stay, even with no master left),
  `defaultValueId`
  (the value picked in advance on a new job order - optional, one active
  value; cleared when that value is made inactive or deleted), `precedence`
  (order on the job order form).
- Values (`MasterValue`): `name` (unique inside the master), `precedence`.
- Masters and values are each active / inactive, and deleted softly
  (`status: 'D'`). Deleting a master deletes its values. A deleted name can be
  used again. A master always keeps at least one value.
- Limits come only from CompanyMaster and count active + inactive (never
  deleted). They have no default: while either is empty, nothing can be
  created.
- Needs MongoDB 6.0 or newer (the unique-name indexes).

## Controls

Fields the vendor adds to the job order form (`models/Control.js`): a
`textfield`, `textarea`, `checkbox` (one tick box), `radio` group or
`dropdown`.

- Every control: `label` (the question; for a checkbox its own text - unique
  per vendor, ignoring capital letters), `isRequired`, `precedence` (order on
  the job order form). Text controls: `placeholder`, `defaultText`. Text field
  only: `isPrice` (the answer is an amount - no minus, at most 2 decimals, also
  the default - added to the job order total) and `isPriceIncludedInTax` (tax is
  charged on it; only with `isPrice`, and only while tax is available to the
  vendor - the tax feature on and the tax details of at least one country
  filled in; while it isn't, the tick is hidden and an edited control keeps
  the one it had), and `isQuantity` (the answer is the item's quantity - a
  whole number from 1 to 999999, also the default; never with `isPrice`; only
  one control not deleted can be the quantity, another one -> 409 on
  `isQuantity`). Checkbox:
  `defaultChecked`. Radio: `options` (at least 2, in order, each with its own
  `_id`) and `defaultOptionId` (optional). Dropdown: the same with at least 1
  choice, plus `isUnit` (see Per unit pricing). A price also has `chargedBy`
  (per unit pricing). The type never changes.
- Active / inactive, deleted softly (`status: 'D'`); a deleted label can be used again.
- CompanyMaster (set by the platform owner; empty = no limit):
  - `assignedControls` - which types the vendor gets: `null` = all, `[]` =
    none (the Controls menu is hidden), otherwise only those listed. Controls
    of a type taken away are hidden everywhere and come back if it is given again.
  - `numberOfControlsAllowed.{textfield,textarea,checkbox,radio,dropdown}` - per type
    (active + inactive).
  - `maxLengthOfTextfieldControl`, `maxLengthOfTextareaControl` - longest text
    typed on the job order (and the default text).
  - `maxLengthOfRadioButtonText` (one choice), `maxLengthOfCheckboxText`,
    `numberOfRadioButtonsAllowedInGroup`; a dropdown's
    `maxLengthOfDropdownOptionText`, `numberOfOptionsAllowedInDropdown`,
    `maxTextForLabelInDropdownControl`.
  - `maxTextForLabelInTextfieldControl`, `maxTextForPlaceholderInTextfieldControl`,
    `maxTextForLabelInTextareaControl`, `maxTextForPlaceholderInTextareaControl`,
    `maxTextForLabelInRadioButtonControl` - longest label / placeholder the
    vendor may set (a checkbox's label: `maxLengthOfCheckboxText`).

## Per unit pricing

Items charged per unit of size (meter, sq ft...) instead of per piece. Only
while `isPerRatePricingFeatureOn` is on (WebsiteMaster and CompanyMaster);
off, every item is per piece and the unit dropdown is a plain dropdown (its
unit fields are kept, and come back when it is turned on again).
Constants: `constants/pricingConstants.js`; the maths:
`utils/jobOrderTotals.js` (`sizeOf`, `computeTotals`).

- The unit dropdown: a dropdown control with `isUnit` (one per vendor not
  deleted, another one -> 409 on `isUnit`). Each choice is a unit with
  `measuredAs` (`number` = length, `area` = length x width, `volume` =
  length x width x height), `rate` (filled in on the job order, still
  editable), `roundUpTo` (0.25 / 0.5 / 1 / null), `minimumSize` and
  `wastagePercent`.
- A price's `chargedBy`: `unit` (default; rate x size), `edge` (rate x
  2 x (length + width) - only for an area unit, otherwise per unit) or
  `piece` (rate only, whatever the size).
- Each item has `chargeBy` (`piece` / `unit`; CompanySettings `chargeBy` is
  the default for new items). Per unit it needs the unit picked
  ("Pick the unit") and takes `measurements { length, width, height }` (more
  than 0, at most 3 decimals; an empty one counts as 1; only those the unit
  takes are kept). Per piece the unit dropdown is not asked (not required,
  not kept).
- Size of one piece: `size` = the measurements multiplied;
  `chargeableSize` = each measurement rounded up to `roundUpTo`, multiplied,
  plus the wastage, at least `minimumSize`; `edgeLength` = 2 x (length +
  width) rounded (area units only). E.g. 2.3 x 4.1 rounded up to 0.5 =
  2.5 x 4.5 = 11.25 sq ft.
- With "Software calculates the price" a price's amount is rate x factor x
  quantity (factor: `chargeableSize`, `edgeLength` or 1); manual: the amount
  typed. Each price stores `chargedBy` and `factor`; the item stores a
  snapshot of its `unit`, the `measurements` and the sizes, so a saved job
  order never changes when the units do. The summary shows
  "Glass (5 x 11.25 sq ft x 100)" and a "Size (per piece)" row.

## Tax

Platform-wide masters, kept by the platform owner only (seeded; no screens):

- `CurrencyMaster` - code (INR, AED), symbol, decimal places.
- `CountryMaster` - code (IN, AE), phone code, currency, `taxName` (GST, VAT),
  `taxFields` (the registration numbers a business fills in, e.g. GSTIN / PAN,
  TRN: label, required, max length, pattern, `startsWithStateTaxCode`) and
  `postalCode` rules (PIN code required in India; P.O. Box optional in the UAE)
  and `interStateTaxLabel` (India: "IGST" - the one tax shown instead of the
  rate's split when the customer is in another state; null = no such rule).
  A new country needs only data, no code.
- `StateMaster` (India: every state / UT with its GST state code; UAE: the
  seven emirates) and `CityMaster` (Mumbai; the main UAE cities).
- `TaxMaster` - a country's rates, e.g. GST 18% = CGST 9% + SGST 9%. Tax is
  always worked out on `totalRate`; components only show the split. Never
  change a rate in use: close it (`applicableTo`) and add a new one.
  `isDefault` = picked in advance for a vendor without its own default.

Per vendor:

- CompanyMaster `isTaxFeatureOn` (also in WebsiteMaster) and
  `assignedCountries` (CountryMaster ids; none = no tax). The Tax tab and the
  "Include this price in tax" tick are hidden while the feature is off or no
  country is assigned.
- CompanySettings `taxDetails` - one entry per country: the business address
  there (state / city from the masters), `isTaxRegistered`, `taxFieldValues`
  (by the country's field keys, in capitals) and `defaultTaxId` (null = the
  platform default). Registered requires the address, the postal code where
  the country needs one and the required tax fields; an Indian GSTIN must
  start with the state's GST code.
- A country is "tax ready" while it is assigned and saved as registered. Only
  then is tax charged on a job order for it; a job order for a country not
  ready is made without tax.

## Role Master

Roles the vendor makes, given to users (the Users module). The owner, or a
user whose roles give Role Master permissions (see Users logging in), and
only while RBAC is on (WebsiteMaster and CompanyMaster `isRBACFeatureOn`).

- Role (`Role`): `name` (unique per vendor, ignoring capital letters), `type`
  (picked at creation, never changes) and, by type:
  - `module` - `modules: [{ module, permissions }]`. Modules are the ones
    switched on for the vendor (Job Orders, Masters, Controls, Users, Role
    Master, Company Settings - `constants/rbacConstants.js`). Permissions are
    `view` (the list), `details` (open one record, read only), `create`,
    `edit`, `delete`; Users also has `assignRole`; Company Settings has
    only `view` and `edit`. Giving anything also gives `view`, and `edit`
    also gives `details` (`IMPLIED_PERMISSIONS`) - roles saved before
    `details` existed get it with `edit` too.
  - `master` - `masters: [{ masterId, isWholeMaster, valueIds }]`: view only,
    of masters marked `isRoleProvided`, each whole or some of its values.
- Active / inactive, deleted softly. `numberOfRoleCreationAllowed` counts
  active + inactive roles (null = no limit).
- A deleted master value leaves every role; a master entry left with no value
  is removed. A deleted master leaves every role (when deleted with
  `removeFromRoles`). A master role may have no master: it then gives
  nothing until one is added.

## Users

The owner's users (`User` with `role: 'user'`; the owner is never listed or
changed here). The owner, or a user whose roles give Users permissions, and
only while RBAC is on. Roles and extra access are given only by the owner or
with Users > Assign role (`canAssignRole` in the form data; otherwise they
are ignored on create and kept on edit), and never by a user on their own
account. A user can't deactivate or delete themselves.

- Details: `name`, `username` (the login username - 3-30 characters,
  starting with a letter), `password` (bcrypt, at least 8 characters) are
  required; `email`, `phone_no`, `address` are optional. Username, email
  and phone are unique per vendor among users not deleted (the owner
  included).
- `assignedRoles: [{ roleId, startDate, endDate }]` - Role Master roles; at
  most one unless `CompanyMaster.isAssigningSeveralRolesAllowed`. An inactive
  role can't be newly given; one already given stays. A role given to users
  can't be deleted.
- With `CompanyMaster.isRoleAssignmentOnUserModuleAllowed`, extra access of the
  user's own, on top of the roles:
  - `extraModules: [{ module, permission, startDate, endDate }]` - one option
    of a module each (the same modules / options as a module role);
  - `extraMasters: [{ masterId, isWholeMaster, valueIds, startDate, endDate }]`
    - role-provided masters, whole or some values, view only (like a master
    role). Deleted values and deleted masters leave it; a master used here
    can't be unticked.
  While the bit is off, saving a user leaves their extras untouched.
- Taken away from what the roles give, for this user only (saved with or
  without extra access allowed; extras still count on top):
  - `revokedModules: [{ module, permission }]` - one option each; what needs
    it goes too (no View = the whole module, no Details = no Edit;
    `rbacConstants.withoutPermission`);
  - `revokedMasters: [{ masterId, isWholeMaster, valueIds }]` - a whole role
    master or some of its values (`accessService.withoutRevokedMasters`, used
    by `/api/access` and by who is offered work). Options no longer offered
    and masters not set for roles are dropped on save.
- The form data returns the roles with their `modules` / `masters` (shown
  ticked in the form), and the modules and role masters, whenever roles can
  be given.
- Dates are calendar days `'YYYY-MM-DD'`, both included; start empty = today,
  end empty = no end.
- `numberOfUsersAllowed` counts active + inactive users (null = no limit).
- Users log in only while RBAC is on (otherwise 403 "Logins for users are
  switched off"; the refresh token is refused too). Deactivating or deleting
  a user ends every request at once; a new password logs them out.
- A database made before the Users module needs its user indexes replaced
  once: `node scripts/syncUserIndexes.js` (shows what changes), then with
  `--apply` while the server is stopped.

## Steps of assigned work

People given a value's work move it through the vendor's steps (Start, In
progress...). Set by the platform owner in CompanyMaster (no screens):

- `steps: [{ fixedStep, name, precedence }]` - `fixedStep` is one of the app's
  steps (`start`, `inProgress` - asks the % done, `hold` - asks why,
  `completed` - no more "Overdue"; `constants/stepConstants.js`), each at
  most once, or null for a step of the vendor's own (then `name` is
  required). A fixed step without a name shows its usual name. Offered in
  `precedence` order, e.g. `[{ fixedStep: 'completed', name: 'Complete',
  precedence: 1 }, { name: 'abc', precedence: 2 }, { fixedStep: 'start',
  precedence: 3 }]`.
- `numberOfStepsAllowed` - only the first that many by precedence, fixed
  ones counted (null = no limit). Entries that make no sense are skipped
  (`services/stepService.js`).
- Each person has their own step (any step, any time), `startedAt` (their
  first step change) and `history` (newest last, at most 100), saved on
  `items.masters.values.assignedTo`. An edit of the job order keeps everyone's
  progress (an item keeps its `_id`); someone given the work again starts fresh.
- When the completion time starts - Company Settings `workTimeStartsOn`
  (only while steps are on; otherwise always when given): `onAssign` - when
  the work is given (one `dueAt` on the value); `onFirstStep` - from each
  person's first step (their own `dueAt`). Copied onto the value
  (`timeStartsOn`) when the clock starts, so changing the setting doesn't
  move work already given. With `onFirstStep`, a changed time of someone
  who already started counts from Company Settings
  `workTimeChangeCountsFrom`: `personStart` (their start, the default) or
  `change` (the moment of the edit); an edit that keeps the time keeps
  their due time. A step change doesn't change the job order's `updatedAt`.
- The job order's own step (`step`, `stepHistory` - each with `byUserId`,
  `byName`): the whole job order moved through the same steps from the Job
  Order module, by the owner or a user with Edit on job orders - for a vendor
  with no users too (only the steps feature needed, not RBAC). Apart from
  the workers' steps: their steps, due times and "Overdue" don't change, and
  nobody is notified (open screens reload). Kept on edit; not an edit
  (`updatedAt` stays). `GET /api/job-orders/:id` returns the vendor's
  `steps` (none while steps are off); the list returns each `step` and
  `isStepsOn`.
- The job order list returns `work: { people, completed, onHold, started }`
  (null when no work was given); the job order view has everyone's steps.

## Dashboard

`GET /api/dashboard` (the owner, or Dashboard - a module role can give it,
View only) reads the vendor's job orders that still have open work or a step
change in the last 14 days (`services/dashboardService.js`), in one query:

- `totals` - job orders (and new this week), open work: not started, in
  progress, on hold, overdue; completed this week
- `working` - open work, overdue first then the soonest due (50 most
  urgent; `workingTotal` all): person, job order, value, step, start, due
- `workload` - per person: not started / in progress / on hold / overdue
  (the 10 busiest; `workloadTotal` all)
- `activity` - the 15 latest step changes of the last 14 days

`GET /api/my-work/summary` (users) - the same for a user's own work:
`totals` and the 5 due next.

## Users logging in (access)

What a logged-in person may do (`services/accessService.js`,
`GET /api/access`): the owner everything; a user, while RBAC is on, the
modules and permissions of their active module roles that cover today, plus
their extra modules (only while `isRoleAssignmentOnUserModuleAllowed` is on).
Any permission of a module also gives View, and Edit gives Details; modules
whose feature is off are left out. `hasWork` is true with a master role or extra master access - the
"My work" menu.

- Every route checks it on the server (`middlewares/requirePermission.js`,
  403 "You do not have permission to do this."): GET of a list = View, GET
  of one record = Details, POST = Create, PUT / PATCH and bulk activate /
  deactivate = Edit, DELETE and bulk delete = Delete; the form data of Job
  Orders needs Create or Edit, of Users and Role Master Create, Edit or
  Details. The job order form's masters / controls lists stay open to anyone
  logged in. Layout Master stays owner only; printing needs Job Orders
  Details.
- My work (`services/myWorkService.js`, users only, RBAC on): the job orders
  where the user was given a value's work, newest first (search, pages),
  each with their work (`masterName`, `valueName`, `assignedAt`,
  `completeIn`, `dueAt`, `coWorkers`); one of them read only. No money is
  ever sent - prices, subtotal, tax and total are left out.

## Job orders

What the vendor's users fill in (`models/JobOrder.js`); the owner, or a user
whose roles give Job Orders permissions, creates, edits and cancels them.

- The form (`GET /api/job-orders/form-data`): the active masters (in order,
  each with its default) and controls (each only while its feature - or its
  "fetch even when off" switch - allows), the vendor's assigned countries with
  their states, cities, current rates, currency, `isTaxReady`, the vendor's
  default rate and business state, and the job order settings.
- Saved: `jobOrderNumber`, the customer (name, phone and email while
  Customers is on; the address while it is asked) and `customerId` (the saved
  customer, see Customers), the `items`, `currency`, `subtotal`, `tax`
  (`isApplied`, `reason` when not, rate, `components`, `taxableAmount`,
  `amount`) and `total`. Names are copied in, so an old job order still shows
  what was picked that day.
- Items: one customer, several things to do - e.g. one glass cut round and
  one cut square. Each item (`items: [{ _id, name, masters, controls, images }]`)
  has its own optional job name (at most 100 characters), masters picked,
  controls answered, images and work. At least one; at most CompanyMaster
  `numberOfItemsAllowedToAddInJobOrder` (default 1; form data
  `settings.maxItems`). A saved job order keeps its items when the limit is
  lowered, but can't get more. The subtotal, tax and total add up the prices
  of every item. An item keeps its `_id` on edit (sent back as `itemId`), so
  the work on it keeps its progress; an item left out is removed (its work
  taken away). My work, steps, notifications and the dashboard name the item
  when there are several ("Cut (Item 2 · Square glass)", `utils/jobOrderItems.js`).
  Print shows the first item for now.
- Job orders made before items: `node scripts/migrateJobOrderItems.js`
  (shows what changes), then with `--apply` - each one's masters, controls
  and images become its one item, and the work indexes are swapped. Run it
  once, with the server stopped.
- Assigning work (`services/workAssignmentService.js`): each picked value of
  a master ticked "Role will be provided" can be given to any number of
  people (optional, at most 20). Offered (form data: `workers`, each value's
  `workerIds`, `canAssignWork`) are active users who have that value today:
  through an active master role naming the value or "Whole master", or
  through their own extra access (only while
  `isRoleAssignmentOnUserModuleAllowed` is on) - less what was taken away
  from them (`revokedMasters`). Users with module roles only
  are never offered. Only while RBAC is on. Saved on each value as
  `assignedTo: [{ userId, name }]`; on edit, people already given a value may
  stay even after losing it, but nobody new without it can be added.
- Completion time (optional, one per value, for everyone doing it):
  `completeIn: { amount (1-9999), unit (seconds / minutes / hours / days /
  months / years) }`. Saved with `assignedAt` (when the work was first given)
  and `dueAt` (`utils/days.js` `addDuration`). An edit keeps the clock unless
  the time itself changes - then it restarts from now. Empty = no deadline;
  nobody given = all three null.
- Everything is checked and worked out again on the server
  (`services/jobOrderService.js`, `utils/jobOrderTotals.js`); the browser's
  summary is only a preview (`features/jobOrders/jobOrderTotals.js` - keep the
  two the same). An edit is worked out again from today's masters, controls
  and rates; answers for ones no longer active are dropped.
- Tax: only on prices ticked "Include this price in tax", in the tax country -
  the customer's country, or the vendor's only country - and only while that
  country is tax ready. Otherwise `tax.reason` says why. In India a customer
  in another state pays IGST instead of CGST + SGST; an unknown customer state
  counts as the business's own state.
- CompanySettings:
  - `isJobOrderNumberAutoGenerated` (default on): JO-0001, JO-0002... per
    vendor (`models/Counter.js`), skipping numbers already typed by hand; an
    automatic number never changes. Off: the user types it (at most 30
    characters, unique per vendor ignoring capital letters; a cancelled job
    order's number can be used again).
  - `askCustomerAddress` (default on): country, state, city, postal code and
    full address, all optional.
  - `useShortNamesOn`: `none` | `jobOrder` | `print` | `both` - where masters
    show their short name (print comes later).
  - `priceCalculation` (`constants/jobOrderConstants.js` PRICE_CALCULATIONS):
    `manual` (default) - the price typed is the price for all pieces;
    `rateTimesQuantity` - the price typed is the rate of one piece and the
    amount is rate x the item's quantity (the answer of the quantity control;
    1 when there is none or it is empty). The amount stays editable: a
    `total` sent with a price is kept instead. Stored on the job order
    (`priceCalculation`) when it is created and kept on edit, so changing
    the setting only changes new job orders (older ones without it: manual).
  - `chargeBy` (`piece` default / `unit`) - per unit pricing, the default for
    new items.
  - `roundTotalTo` (null default / 1 / 5 / 10) and `roundTotalDirection`
    (`nearest` default / `up` / `down`) - the total is rounded, the
    difference stored as `roundOff`.
  - `askDeliveryDate`, `allowDiscount`, `askAdvance` (all default on). Left
    out of the PUT = unchanged. While one is off, an edited job order keeps
    the value it was saved with and a new one gets none.
- A job order's money: subtotal, `discount { type: amount | percent, value,
  amount }` (taken off before tax - taxed prices keep their share; at most
  100% and never more than the subtotal), tax, `roundOff`, `total`,
  `advance` (never more than the total) and `balance` (total - advance,
  null without an advance). `deliveryAt` is the delivery date.
- Prices worked out as rate x quantity are stored with `rate`, `amount` and
  `isAmountEdited` (the amount isn't rate x quantity); each item keeps its
  `quantity`. The summary shows "Cutting (5 x 200)" while the amount wasn't
  typed over and the quantity is more than 1.
- Cancel = soft delete (`status: 'D'`): hidden from the list, kept in the
  database with its images.
- Images (`images: [{ imageId, url }]`, each an `ImageAsset` with module
  `jobOrder`, stored like the logo - see Image storage):
  - On only while `isImageUploadFeatureOn` is on in WebsiteMaster AND the
    vendor's CompanyMaster.
  - CompanyMaster limits (null = no limit of the vendor's own; the server
    still takes at most 50 images per job order and 20 MB per image):
    `numberOfImageUploadAllowed` (per job order, all items together), `maxImageUploadSizeMB` (the
    same limit as the logo) and `imageFormatsAllowed` (some of `jpeg`, `png`,
    `webp`, `gif`; checked by the file's real content).
  - Sent with Create / Save as multipart: the job order JSON in `data`, new
    files in `images`, item after item (each item's `newImageCount` says how
    many are its own); on edit each item's `keepImageIds` lists the saved
    images it keeps (an image may move to another item).
    Every file is checked before any is stored; if storing or saving fails,
    what was stored is removed again. Images taken off are deleted from the
    storage after the save. With the feature off, saved images can still be
    removed but none added.

## Customers

The vendor's customers (`models/Customer.js`), saved from job orders - there
is no create. Only while `isCustomersFeatureOn` is on (WebsiteMaster and
CompanyMaster); otherwise `/api/customers` is refused and job orders keep no
name, phone or email.

- The job order form asks the customer's name, phone and email (all
  optional; form data `settings.askCustomerContact`). The address still
  follows `askCustomerAddress`.
- Saving a job order with a phone or an email saves the customer
  (`customerService.saveFromJobOrder`): the customer with the same phone, or
  else the same email, gets the newest details (a name, phone or email left
  empty keeps the saved one; any address part given replaces the whole
  address). A phone or email that belongs to another customer stays with
  them. Otherwise a new customer is added. Without a phone or email nothing
  is saved and `customerId` stays null.
- One customer per phone and per email (unique indexes among live
  customers). Phone: 10 to 13 digits, optionally starting with +; the email
  is kept in small letters.
- Job orders keep a copy of the details: editing or deleting a customer
  never changes them. A deleted customer's phone or email saves a new
  customer next time.
- The job order form's search (`GET /api/customers/for-job-order`) needs Job
  Orders Create or Edit; the Customers module needs its own permissions (Role
  Master: View, Details, Edit, Delete).
- The list: latest job order first, searched by any part of the name, phone,
  email or address, each with `jobOrderCount`.
- Editing: a phone or an email stays required (errors on both); the address
  is checked like a job order's (field errors `address.<field>`); a phone or
  email of another customer -> 409.

## Layout Master

Print layouts for job orders (`models/Layout.js`), made by the owner in a
designer; any logged-in user can print a job order with an active one.

- A layout has a `name` (unique per vendor), `paper` (`A3`, `A4`, `A5`,
  `Letter`, `Legal` portrait / landscape, or `custom` 50 - 1500 mm each way;
  `widthMm` / `heightMm` are saved as printed), `labelDefault` (`none`,
  `masters`, `controls`, `both` - which dropped fields show "name: value")
  `headerHeightMm` / `footerHeightMm` (0 = none; together they must leave at
  least 20 mm of the page) and up to 300 `elements`. Sizes and places are in
  millimetres from the page's top-left; font sizes in points. Elements lying
  wholly inside the header or footer band print on every page.
- Elements: `field` (a master, a control, or a job order / company field:
  number, date, customer address, subtotal, tax, total, company name,
  address, tax numbers, work given, page number; per item: item no., job
  order name, quantity, size, item amount; `showLabel`, `labelText`), `text`,
  `line`, `rectangle`, `circle`, `table` (up to 30 x 10 cells, each typed
  text or a field; `repeatRow` - the row printed once for each item of the
  job order, null = none; `lines` `all` / `outside` / `rows` / `none`;
  `rowStyles` `[{ bold, fill }]` one per row; `hideEmptyCols` one per column:
  left out when no item has a value, otherwise "-"), `logo` (the Company Settings logo) and `image` (one of the job
  order's images: `imageNumber` 1 = its first, `fit` `contain` / `cover`;
  empty when the job order has fewer). Every element must be on the page and
  every master / control must still exist. The form-data's
  `settings.canPlaceJobOrderImages` (image upload on) says whether the
  designer offers `image`.
- Text `style` (font, size, bold, italic, underline, alignment, colour) is
  kept only while CompanyMaster `isControlFeatureInLayoutOn` is on.
- The first layout (or the first while none is the default) becomes the
  default; the default is picked first when printing. Deactivating or
  deleting the default leaves no default until one is chosen.
- `numberOfLayoutsAllowed` (null = no limit) caps the layouts.
- Printing (`/for-print`) gives the layout with the master / control names,
  the company name, logo, and address and tax numbers per country (the job
  order's tax country, else its customer's country), whether master short
  names are used on print, and `printWork`.
- The "Work given" field (`workDetails`) prints every value given to someone,
  then a line per person. Company Settings > Job orders `printWork` says what
  the line shows: `showWorkers` (name), `showStartDate`, `showDueTime`,
  `showStep` (with %) and `showHoldReason` - all on until turned off. Saving
  the job order settings without `printWork` leaves it as it was.

## Notifications and live updates

Open pages get updates at once over socket.io (`services/realtimeService.js`,
same port, path `/socket.io`). A page connects with its access token
(`auth: { token }`); like every request, the vendor comes from the host name
and the user must belong to it and be active. Switching a user off or
deleting them disconnects their pages.

| Who | Notification (saved, in the bell) |
| --- | --- |
| A user | work given to them, taken away (also a cancelled job order), its time changed - one per job order |
| The owner | someone moved their work to a step (with %), put it on hold (with the reason), completed it; work past its due time |

Besides notifications the pages hear `jobOrders:changed` (every page of the
vendor: lists and views load again), `myWork:changed` (the people given
work on that job order) and `serviceStatus:changed` (maintenance, payment
or the shop changed - the page checks at once instead of every 30 s).

Overdue work (`services/overdueWatcher.js`, every minute): work that went
past its due time in the last 24 hours and isn't completed is announced to
the owner once (a key with the due time; also safe across restarts).
Notifications delete themselves after 90 days.

The notifications are sent after the job order is saved; a failure there is
only logged (WARNING) and never fails the save.

Behind nginx, `/socket.io` needs the WebSocket headers:

```
location /socket.io/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## Image storage (logos and later images)

Where an upload goes:

1. `WebsiteMaster.enforceMainImageService` on -> always
   `WebsiteMaster.mainImageService`, with the platform's account from `.env`.
2. Otherwise the vendor's `CompanyMaster.imageService`, with the vendor's own
   account.
3. When the vendor has none -> `WebsiteMaster.mainImageService` with the
   platform's account from `.env`.

Providers: `local` (files in `uploads/`, served at `/uploads`), `cloudinary`,
`aws` (S3) and `r2` (Cloudflare R2).

A vendor's own account (several vendors may share one):

1. Copy `seeds/storageCredentials.example.json` to
   `seeds/private/storageCredentials.json` (git-ignored) and fill in only the
   providers to set.
2. `node scripts/manageVendorStorageCredentials.js set <domain>` - the secrets
   are saved encrypted with `CREDENTIALS_ENCRYPTION_KEY`.
3. Delete `seeds/private/storageCredentials.json`.
4. Set that vendor's `CompanyMaster.imageService` to the provider.

`node scripts/manageVendorStorageCredentials.js view <domain>` shows which
account each area uses (never a secret). No restart is needed after a change.

Every upload is checked by its content (not its name or the browser's type):
JPEG, PNG, WebP or GIF only, up to the vendor's `maxImageUploadSizeMB`. The
uploader's file name is never used. Replacing an image deletes the old file.

## Main endpoints

Where a row says owner, a user whose roles give that module's permission may
too (see Users logging in) - except Layout Master, which stays owner only.

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/public/branding` | anyone - company name, login tagline, logo URL |
| GET | `/api/public/status` | anyone - `{ block }`: maintenance before logging in, else null |
| GET | `/api/service-status` | logged in - `{ block, shop }` (works while blocked; the owner gets the shop's message and time) |
| PUT | `/api/service-status/shop` | owner - `{ shopClosed, shopClosedMessage, estimatedResumeTime }` (a future time or null) |
| GET | `/api/notifications` | logged in - their own, newest first (`before` a createdAt, `limit` up to 50): `{ notifications, hasMore, unreadCount }` |
| PATCH | `/api/notifications/read` | logged in - `{ ids }` of their own (none = all): `{ unreadCount }` |
| POST | `/api/auth/login` | anyone - username, email or phone + password |
| POST | `/api/auth/refresh-token` | the refresh-token cookie |
| POST | `/api/auth/logout` | the refresh-token cookie |
| GET | `/api/company-settings` | owner - company name, login tagline, logo, job order settings |
| PUT | `/api/company-settings/general` | owner - `{ companyName, loginTagline }` |
| PUT | `/api/company-settings/job-order` | owner - `{ isJobOrderNumberAutoGenerated, askCustomerAddress, useShortNamesOn, workTimeStartsOn, workTimeChangeCountsFrom, priceCalculation, chargeBy, roundTotalTo, roundTotalDirection, askDeliveryDate, allowDiscount, askAdvance, printWork }` |
| PUT | `/api/company-settings/logo` | owner - multipart, image in the `logo` field |
| GET | `/api/company-settings/tax` | owner, tax on - every assigned country with its fields, states, cities, current rates, currency and saved details |
| PUT | `/api/company-settings/tax/:countryId` | owner, tax on - `{ address, isTaxRegistered, taxFieldValues, defaultTaxId }` of one country |
| GET | `/api/feature-access` | logged in - which features are on |
| GET | `/api/access` | logged in - `{ isOwner, modules: { key: [permissions] }, hasWork, userId }` |
| GET | `/api/my-work` | user, RBAC on - the job orders given to them, newest first (search, page, limit), each with their work, and the vendor's `steps` |
| GET | `/api/my-work/summary` | user, RBAC on - their own dashboard: totals and what is due next |
| GET | `/api/dashboard` | owner (users: Dashboard) - the company dashboard (see Dashboard) |
| GET | `/api/my-work/:id` | user, RBAC on - one of them, read only, without money, with their work, history and the vendor's `steps` |
| PATCH | `/api/my-work/:id/step` | user, RBAC and steps on - `{ itemId, valueId, stepKey, percent (In progress), holdReason (Hold) }` |
| PATCH | `/api/job-orders/:id/step` | owner (users: Edit on job orders), steps on - the job order's own step `{ stepKey, percent (In progress), holdReason (Hold) }` |
| GET | `/api/masters/for-job-order` | logged in - active masters with their active values and default, for the job order form |
| GET / POST | `/api/masters` | owner - list (search, status, page, limit) / create with values |
| GET / PUT / DELETE | `/api/masters/:id` | owner - one master with its values / save details and the full values list / delete (`?removeFromRoles=true` when roles or users use it, else 409) |
| POST | `/api/masters/role-usage` | owner - `{ ids }` -> `{ roles, users }`: names of the roles / users using those masters (for the delete alert) |
| PATCH | `/api/masters/:id/status` | owner - `{ isActive }` |
| POST | `/api/masters/bulk` | owner - `{ action: activate|deactivate|delete, ids, removeFromRoles }` |
| PATCH | `/api/masters/:id/default` | owner - `{ valueId }` (null = no default), an active value |
| PATCH | `/api/masters/:id/move` | owner - `{ direction: up|down }`, one place in the whole list |
| PATCH | `/api/masters/:id/values/:valueId/move` | owner - `{ direction: up|down }`, one place inside the master |
| DELETE | `/api/masters/:id/values/:valueId` | owner - delete a value |
| PATCH | `/api/masters/:id/values/:valueId/status` | owner - `{ isActive }` |
| GET | `/api/controls/for-job-order` | logged in - active controls of the assigned types with defaults and `maxLength`, for the job order form (also while Controls is off, with `fetchControlsEvenWhenBitIsOff`) |
| GET / POST | `/api/controls` | owner - list (search, status, type, page, limit) / create |
| GET / PUT / DELETE | `/api/controls/:id` | owner - one control / save every field (same type) / delete |
| PATCH | `/api/controls/:id/status` | owner - `{ isActive }` |
| PATCH | `/api/controls/:id/move` | owner - `{ direction: up|down }` |
| POST | `/api/controls/bulk` | owner - `{ action: activate|deactivate|delete, ids }` |
| GET | `/api/roles/form-data` | owner, RBAC on - the modules and role masters (with values) a role can use, and the roles limit |
| GET / POST | `/api/roles` | owner, RBAC on - list (search, status, type, page, limit) / create |
| GET / PUT / DELETE | `/api/roles/:id` | owner, RBAC on - one role / save name and modules or masters (same type) / delete |
| PATCH | `/api/roles/:id/status` | owner, RBAC on - `{ isActive }` |
| POST | `/api/roles/bulk` | owner, RBAC on - `{ action: activate|deactivate|delete, ids }` |
| GET | `/api/users/form-data` | owner, RBAC on - roles, extra-access modules and masters (when allowed), settings, users limit, today |
| GET / POST | `/api/users` | owner, RBAC on - list (search, status, roleId, page, limit) / create |
| GET / PUT / DELETE | `/api/users/:id` | owner, RBAC on - one user (never the password) / save (password empty = unchanged) / delete |
| PATCH | `/api/users/:id/status` | owner, RBAC on - `{ isActive }` |
| POST | `/api/users/bulk` | owner, RBAC on - `{ action: activate|deactivate|delete, ids }` |
| GET | `/api/layouts/form-data` | owner, Layout Master on - masters, controls, job order fields and paper sizes a layout can use, settings, layouts limit, company name and logo |
| GET / POST | `/api/layouts` | owner, Layout Master on - list (search, status, page, limit) / create |
| GET / PUT / DELETE | `/api/layouts/:id` | owner, Layout Master on - one layout / save / delete |
| PATCH | `/api/layouts/:id/default` | owner, Layout Master on - make an active layout the default |
| PATCH | `/api/layouts/:id/status` | owner, Layout Master on - `{ isActive }` |
| POST | `/api/layouts/bulk` | owner, Layout Master on - `{ action: activate|deactivate|delete, ids }` |
| GET | `/api/layouts/for-print` | Job Orders View, Layout Master on - the active layouts, default first |
| GET | `/api/layouts/for-print/:id` | Job Orders View, Layout Master on - one active layout and what fills it besides the job order |
| GET | `/api/customers/for-job-order` | Job Orders Create or Edit, Customers on - `search`: at most 8 matching customers, latest job order first |
| GET | `/api/customers/form-data` | owner (users: Customers Details), Customers on - the countries for the address |
| GET | `/api/customers` | owner (users: Customers View), Customers on - list (search, page, limit), each with `jobOrderCount` |
| GET / PUT / DELETE | `/api/customers/:id` | owner (users: Details / Edit / Delete), Customers on - one customer / save `{ name, phone, email, address: { countryId, stateId, cityId, postalCode, address } }` / delete |
| POST | `/api/customers/bulk` | owner (users: Customers Delete), Customers on - `{ action: delete, ids }` |
| GET | `/api/job-orders/form-data` | owner (users: Create or Edit) - everything the job order form needs (see Job orders) |
| GET / POST | `/api/job-orders` | owner - list, newest first (search number, job name, customer name / phone / email or place, page, limit), each with `jobNames` / create |
| GET / PUT / DELETE | `/api/job-orders/:id` | owner - one job order / save it (worked out again) / cancel it |

`POST` / `PUT /api/job-orders` take `{ jobOrderNumber, customer: { name, phone,
email, countryId, stateId, cityId, postalCode, address }, items: [{ itemId, name,
masters: [{ masterId, valueIds, assignments: [{ valueId, userIds, completeIn: { amount, unit } | null }] }],
controls: [{ controlId, text | checked | optionId, total }], chargeBy, measurements: { length, width, height },
keepImageIds, newImageCount }], taxId, deliveryAt, discount: { type, value }, advance }`
(`itemId` null = a new item; `taxId` null = the vendor's default rate; `total` -
a price's amount typed by hand on a rate x quantity job order, null = worked
out; `deliveryAt` an ISO date; amounts as text) as JSON,
or as multipart with that JSON in `data` and new images in `images`. Field
errors are named `jobOrderNumber`, `customer.<field>`, `items`,
`items.<index>.name`, `items.<index>.masters.<id>`, `items.<index>.controls.<id>`,
`items.<index>.images`, `items.<index>.chargeBy`,
`items.<index>.measurements.<name>`, `taxId`, `deliveryAt`, `discount.value`
and `advance`. `PATCH /api/my-work/:id/step` takes
`{ itemId, valueId, stepKey, percent, holdReason }`.

`POST` / `PUT /api/layouts` take `{ name, paper: { size, orientation } | { size:
'custom', widthMm, heightMm }, labelDefault, headerHeightMm, footerHeightMm,
elements }`. Field errors are named `name`, `paper.*`, `headerHeightMm` (header
and footer leave too little room) and `elements.<elementId>` (an item off the
page or a master / control that is gone).

`POST` / `PUT /api/roles` take `{ name, type (create only), modules: [{ module,
permissions }] }` or `{ ..., masters: [{ masterId, isWholeMaster, valueIds }] }`.
Field errors are named `name`, `modules`, `masters`, `modules.<key>` and
`masters.<masterId>`.

`POST` / `PUT /api/users` take `{ name, username, password, email, phone,
address, roles: [{ roleId, startDate, endDate }], extraModules: [{ module,
permission, startDate, endDate }], extraMasters: [{ masterId, isWholeMaster,
valueIds, startDate, endDate }], revokedModules: [{ module, permission }],
revokedMasters: [{ masterId, isWholeMaster, valueIds }] }`. Field errors are named after the details,
`roles`, `roles.<roleId>`, `extraModules.<module>.<permission>` and
`extraMasters.<masterId>`.

`PUT /api/masters/:id` takes `{ name, shortName, isMultiselectAllowed, isRoleProvided, values }`.
`values` is the whole list in order: `{ _id, name, status, isDefault }` for a
value that already exists, `{ name, status, isDefault }` for a new one. At most
one value is `isDefault`, and it must be active. Existing values left out are
deleted. Everything is checked first, then saved together.

After `maxLoginAttempts` wrong passwords in a row (WebsiteMaster, default 5),
that login is locked for `loginLockoutMinutes` (default 15).
