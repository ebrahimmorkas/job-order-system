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

After `maxLoginAttempts` wrong passwords in a row (WebsiteMaster, default 5),
that login is locked for `loginLockoutMinutes` (default 15).
