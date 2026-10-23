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

Roles the vendor makes, given to users later (the Users module). Owner only,
and only while RBAC is on (WebsiteMaster and CompanyMaster `isRBACFeatureOn`).

- Role (`Role`): `name` (unique per vendor, ignoring capital letters), `type`
  (picked at creation, never changes) and, by type:
  - `module` - `modules: [{ module, permissions }]`. Modules are the ones
    switched on for the vendor (Job Orders, Masters, Controls, Users, Role
    Master, Company Settings - `constants/rbacConstants.js`). Permissions are
    `view`, `create`, `edit`, `delete`; Users also has `assignRole`;
    Company Settings has only `view` and `edit`. Giving anything also gives
    `view`.
  - `master` - `masters: [{ masterId, isWholeMaster, valueIds }]`: view only,
    of masters marked `isRoleProvided`, each whole or some of its values.
- Active / inactive, deleted softly. `numberOfRoleCreationAllowed` counts
  active + inactive roles (null = no limit).
- A deleted master value leaves every role; a master entry left with no value
  is removed.

## Users

The owner's users (`User` with `role: 'user'`; the owner is never listed or
changed here). Owner only, and only while RBAC is on.

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
- **Users can't log in yet** - login answers 403 until their roles are applied
  to what they can see (the next RBAC step). Deactivating or deleting a user
  ends every request at once; a new password logs them out.
- A database made before the Users module needs its user indexes replaced
  once: `node scripts/syncUserIndexes.js` (shows what changes), then with
  `--apply` while the server is stopped.

## Job orders

What the vendor's users fill in (`models/JobOrder.js`); any logged-in user of
the vendor can create, edit and cancel them.

- The form (`GET /api/job-orders/form-data`): the active masters (in order,
  each with its default) and controls (each only while its feature - or its
  "fetch even when off" switch - allows), the vendor's assigned countries with
  their states, cities, current rates, currency, `isTaxReady`, the vendor's
  default rate and business state, and the job order settings.
- Saved: `jobOrderNumber`, the customer address, every master picked and
  control answered, `currency`, `subtotal`, `tax` (`isApplied`, `reason` when
  not, rate, `components`, `taxableAmount`, `amount`) and `total`. Names are
  copied in, so an old job order still shows what was picked that day.
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

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/public/branding` | anyone - company name, login tagline, logo URL |
| POST | `/api/auth/login` | anyone - username, email or phone + password |
| POST | `/api/auth/refresh-token` | the refresh-token cookie |
| POST | `/api/auth/logout` | the refresh-token cookie |
| GET | `/api/company-settings` | owner - company name, login tagline, logo, job order settings |
| PUT | `/api/company-settings/general` | owner - `{ companyName, loginTagline }` |
| PUT | `/api/company-settings/job-order` | owner - `{ isJobOrderNumberAutoGenerated, askCustomerAddress, useShortNamesOn }` |
| PUT | `/api/company-settings/logo` | owner - multipart, image in the `logo` field |
| GET | `/api/company-settings/tax` | owner, tax on - every assigned country with its fields, states, cities, current rates, currency and saved details |
| PUT | `/api/company-settings/tax/:countryId` | owner, tax on - `{ address, isTaxRegistered, taxFieldValues, defaultTaxId }` of one country |
| GET | `/api/feature-access` | logged in - which features are on |
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
| GET | `/api/job-orders/form-data` | logged in - everything the job order form needs (see Job orders) |
| GET / POST | `/api/job-orders` | logged in - list, newest first (search number or customer place, page, limit) / create |
| GET / PUT / DELETE | `/api/job-orders/:id` | logged in - one job order / save it (worked out again) / cancel it |

`POST` / `PUT /api/job-orders` take `{ jobOrderNumber, customer: { countryId,
stateId, cityId, postalCode, address }, masters: [{ masterId, valueIds }],
controls: [{ controlId, text | checked | optionId }], taxId, keepImageIds }`
(`taxId` null = the vendor's default rate) as JSON, or as multipart with that
JSON in `data` and new images in `images`. Field errors are named
`jobOrderNumber`, `customer.<field>`, `masters.<id>`, `controls.<id>`, `taxId`
and `images`.

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
