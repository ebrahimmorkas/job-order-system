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
  (optional, unique the same way), `isMultiselectAllowed`, `defaultValueId`
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
  charged on it; only with `isPrice`). Checkbox:
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
| PUT | `/api/company-settings/logo` | owner - multipart, image in the `logo` field |
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

`PUT /api/masters/:id` takes `{ name, shortName, isMultiselectAllowed, values }`.
`values` is the whole list in order: `{ _id, name, status, isDefault }` for a
value that already exists, `{ name, status, isDefault }` for a new one. At most
one value is `isDefault`, and it must be active. Existing values left out are
deleted. Everything is checked first, then saved together.

After `maxLoginAttempts` wrong passwords in a row (WebsiteMaster, default 5),
that login is locked for `loginLockoutMinutes` (default 15).
