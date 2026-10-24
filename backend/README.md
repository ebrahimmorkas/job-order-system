# Job Order - backend

Node.js + Express + MongoDB (Mongoose). Redis is optional (`IS_REDIS_SERVER_ON`).

## Run it

```sh
npm install
cp .env.example .env   # then fill it in - never commit .env
npm run dev            # http://localhost:5000, restarts on file changes
```

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

## Masters

A master is a vendor's own dropdown list for the job order form, e.g. "My
Services" with the values Polishing, Cutting, Edging.

- Master: `name` (unique per vendor, ignoring capital letters), `shortName`
  (optional, unique the same way), `isMultiselectAllowed`, `isRequired` (a
  job order can't be saved without a value picked), `isRoleProvided` ("Role
  will be provided for this master": a master role can use it; it can't be
  unticked, and the master can't be deleted, while a role uses it),
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
`textfield`, `textarea`, `checkbox` (one tick box) or `radio` group.

- Every control: `label` (the question; for a checkbox its own text - unique
  per vendor, ignoring capital letters), `isRequired`, `precedence` (order on
  the job order form). Text controls: `placeholder`, `defaultText`. Text field
  only: `isPrice` (the answer is an amount - no minus, at most 2 decimals, also
  the default - added to the job order total) and `isPriceIncludedInTax` (tax is
  charged on it; only with `isPrice`, and only while tax is available to the
  vendor - the tax feature on and the tax details of at least one country
  filled in; while it isn't, the tick is hidden and an edited control keeps
  the one it had). Checkbox:
  `defaultChecked`. Radio: `options` (at least 2, in order, each with its own
  `_id`) and `defaultOptionId` (optional). The type never changes.
- Active / inactive, deleted softly (`status: 'D'`); a deleted label can be used again.
- CompanyMaster (set by the platform owner; empty = no limit):
  - `assignedControls` - which types the vendor gets: `null` = all, `[]` =
    none (the Controls menu is hidden), otherwise only those listed. Controls
    of a type taken away are hidden everywhere and come back if it is given again.
  - `numberOfControlsAllowed.{textfield,textarea,checkbox,radio}` - per type
    (active + inactive).
  - `maxLengthOfTextfieldControl`, `maxLengthOfTextareaControl` - longest text
    typed on the job order (and the default text).
  - `maxLengthOfRadioButtonText` (one choice), `maxLengthOfCheckboxText`,
    `numberOfRadioButtonsAllowedInGroup`.
  - `maxTextForLabelInTextfieldControl`, `maxTextForPlaceholderInTextfieldControl`,
    `maxTextForLabelInTextareaControl`, `maxTextForPlaceholderInTextareaControl`,
    `maxTextForLabelInRadioButtonControl` - longest label / placeholder the
    vendor may set (a checkbox's label: `maxLengthOfCheckboxText`).

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
  is removed.

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
    role). Deleted values leave it; a master used here can't be deleted or
    unticked.
  While the bit is off, saving a user leaves their extras untouched.
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
  `masters.values.assignedTo`. An edit of the job order keeps everyone's
  progress; someone given the work again starts fresh.
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
- The job order list returns `work: { people, completed, onHold, started }`
  (null when no work was given); the job order view has everyone's steps.

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
- Saved: `jobOrderNumber`, the customer address, every master picked and
  control answered, `currency`, `subtotal`, `tax` (`isApplied`, `reason` when
  not, rate, `components`, `taxableAmount`, `amount`) and `total`. Names are
  copied in, so an old job order still shows what was picked that day.
- Assigning work (`services/workAssignmentService.js`): each picked value of
  a master ticked "Role will be provided" can be given to any number of
  people (optional, at most 20). Offered (form data: `workers`, each value's
  `workerIds`, `canAssignWork`) are active users who have that value today:
  through an active master role naming the value or "Whole master", or
  through their own extra access (only while
  `isRoleAssignmentOnUserModuleAllowed` is on). Users with module roles only
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
- Cancel = soft delete (`status: 'D'`): hidden from the list, kept in the
  database with its images.
- Images (`images: [{ imageId, url }]`, each an `ImageAsset` with module
  `jobOrder`, stored like the logo - see Image storage):
  - On only while `isImageUploadFeatureOn` is on in WebsiteMaster AND the
    vendor's CompanyMaster.
  - CompanyMaster limits (null = no limit of the vendor's own; the server
    still takes at most 50 images per job order and 20 MB per image):
    `numberOfImageUploadAllowed` (per job order), `maxImageUploadSizeMB` (the
    same limit as the logo) and `imageFormatsAllowed` (some of `jpeg`, `png`,
    `webp`, `gif`; checked by the file's real content).
  - Sent with Create / Save as multipart: the job order JSON in `data`, new
    files in `images`; on edit `keepImageIds` lists the saved images to keep.
    Every file is checked before any is stored; if storing or saving fails,
    what was stored is removed again. Images taken off are deleted from the
    storage after the save. With the feature off, saved images can still be
    removed but none added.

## Layout Master

Print layouts for job orders (`models/Layout.js`), made by the owner in a
designer; any logged-in user can print a job order with an active one.

- A layout has a `name` (unique per vendor), `paper` (`A3`, `A4`, `A5`,
  `Letter`, `Legal` portrait / landscape, or `custom` 50 - 1500 mm each way;
  `widthMm` / `heightMm` are saved as printed), `labelDefault` (`none`,
  `masters`, `controls`, `both` - which dropped fields show "name: value")
  and up to 300 `elements`. Sizes and places are in millimetres from the
  page's top-left; font sizes in points.
- Elements: `field` (a master, a control, or a job order / company field:
  number, date, customer address, subtotal, tax, total, company name,
  address, tax numbers; `showLabel`, `labelText`), `text`, `line`,
  `rectangle`, `circle`, `table` (up to 30 x 10 cells, each typed text or
  a field) and `logo` (the Company Settings logo). Every element must be on
  the page and every master / control must still exist.
- Text `style` (font, size, bold, italic, underline, alignment, colour) is
  kept only while CompanyMaster `isControlFeatureInLayoutOn` is on.
- The first layout (or the first while none is the default) becomes the
  default; the default is picked first when printing. Deactivating or
  deleting the default leaves no default until one is chosen.
- `numberOfLayoutsAllowed` (null = no limit) caps the layouts.
- Printing (`/for-print`) gives the layout with the master / control names,
  the company name, logo, and address and tax numbers per country (the job
  order's tax country, else its customer's country), and whether master short
  names are used on print.

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
| POST | `/api/auth/login` | anyone - username, email or phone + password |
| POST | `/api/auth/refresh-token` | the refresh-token cookie |
| POST | `/api/auth/logout` | the refresh-token cookie |
| GET | `/api/company-settings` | owner - company name, login tagline, logo, job order settings |
| PUT | `/api/company-settings/general` | owner - `{ companyName, loginTagline }` |
| PUT | `/api/company-settings/job-order` | owner - `{ isJobOrderNumberAutoGenerated, askCustomerAddress, useShortNamesOn, workTimeStartsOn, workTimeChangeCountsFrom }` |
| PUT | `/api/company-settings/logo` | owner - multipart, image in the `logo` field |
| GET | `/api/company-settings/tax` | owner, tax on - every assigned country with its fields, states, cities, current rates, currency and saved details |
| PUT | `/api/company-settings/tax/:countryId` | owner, tax on - `{ address, isTaxRegistered, taxFieldValues, defaultTaxId }` of one country |
| GET | `/api/feature-access` | logged in - which features are on |
| GET | `/api/access` | logged in - `{ isOwner, modules: { key: [permissions] }, hasWork, userId }` |
| GET | `/api/my-work` | user, RBAC on - the job orders given to them, newest first (search, page, limit), each with their work |
| GET | `/api/my-work/:id` | user, RBAC on - one of them, read only, without money, with their work, history and the vendor's `steps` |
| PATCH | `/api/my-work/:id/step` | user, RBAC and steps on - `{ valueId, stepKey, percent (In progress), holdReason (Hold) }` |
| GET | `/api/masters/for-job-order` | logged in - active masters with their active values and default, for the job order form |
| GET / POST | `/api/masters` | owner - list (search, status, page, limit) / create with values |
| GET / PUT / DELETE | `/api/masters/:id` | owner - one master with its values / save details and the full values list / delete |
| PATCH | `/api/masters/:id/status` | owner - `{ isActive }` |
| POST | `/api/masters/bulk` | owner - `{ action: activate|deactivate|delete, ids }` |
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
| GET | `/api/job-orders/form-data` | owner (users: Create or Edit) - everything the job order form needs (see Job orders) |
| GET / POST | `/api/job-orders` | owner - list, newest first (search number or customer place, page, limit) / create |
| GET / PUT / DELETE | `/api/job-orders/:id` | owner - one job order / save it (worked out again) / cancel it |

`POST` / `PUT /api/job-orders` take `{ jobOrderNumber, customer: { countryId,
stateId, cityId, postalCode, address }, masters: [{ masterId, valueIds,
assignments: [{ valueId, userIds, completeIn: { amount, unit } | null }] }],
controls: [{ controlId, text | checked | optionId }], taxId, keepImageIds }`
(`taxId` null = the vendor's default rate) as JSON, or as multipart with that
JSON in `data` and new images in `images`. Field errors are named
`jobOrderNumber`, `customer.<field>`, `masters.<id>`, `controls.<id>`, `taxId`
and `images`.

`POST` / `PUT /api/layouts` take `{ name, paper: { size, orientation } | { size:
'custom', widthMm, heightMm }, labelDefault, elements }`. Field errors are
named `name`, `paper.*` and `elements.<elementId>` (an item off the page or a
master / control that is gone).

`POST` / `PUT /api/roles` take `{ name, type (create only), modules: [{ module,
permissions }] }` or `{ ..., masters: [{ masterId, isWholeMaster, valueIds }] }`.
Field errors are named `name`, `modules`, `masters`, `modules.<key>` and
`masters.<masterId>`.

`POST` / `PUT /api/users` take `{ name, username, password, email, phone,
address, roles: [{ roleId, startDate, endDate }], extraModules: [{ module,
permission, startDate, endDate }], extraMasters: [{ masterId, isWholeMaster,
valueIds, startDate, endDate }] }`. Field errors are named after the details,
`roles`, `roles.<roleId>`, `extraModules.<module>.<permission>` and
`extraMasters.<masterId>`.

`PUT /api/masters/:id` takes `{ name, shortName, isMultiselectAllowed, isRoleProvided, values }`.
`values` is the whole list in order: `{ _id, name, status, isDefault }` for a
value that already exists, `{ name, status, isDefault }` for a new one. At most
one value is `isDefault`, and it must be active. Existing values left out are
deleted. Everything is checked first, then saved together.

After `maxLoginAttempts` wrong passwords in a row (WebsiteMaster, default 5),
that login is locked for `loginLockoutMinutes` (default 15).
