# Job Order - frontend

React 19 + Vite + Tailwind CSS 4.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

The backend must be running too (`cd ../backend && npm run dev`, port 5000).
In development, Vite forwards every `/api` request (and `/uploads`, the
images stored on the server itself, such as logos) to it.

## What the app shows

- **Login page** - the company name, login tagline and logo come from the
  vendor's Company Settings (`GET /api/public/branding`); nothing about the
  company is written in the code. The company name is also the browser tab
  title, and the logo the tab icon. Without a logo, the first letter of the
  name is shown instead.
- **After login** - the sidebar (company name + logo, the user, logout) and
  the dashboard. Menu items of features switched off for the vendor are
  hidden; items whose page is not built yet show "coming soon".
- **Masters** - the vendor's own dropdown lists for the job order: list with
  Sr. No. (with up / down arrows to change the order), search, status filter,
  pages, a status switch and bulk actions; clicking the values count opens the
  values (move up / down, mark active / inactive, delete - saved at once); create, copy and
  edit, where every change waits for Save and leaving with unsaved changes
  asks first.
- An unknown host name shows "No account is set up for this domain".

## Vendors in local development

The backend decides which vendor a request belongs to from the host name in
the address bar. `localhost` is the vendor the seeds create by default.

To try a second vendor on the same computer:

1. Give it a host name. Either add a line to the hosts file
   (`C:\Windows\System32\drivers\etc\hosts`, opened as administrator):

   ```
   127.0.0.1 localhost1
   ```

   or use a `*.localhost` name such as `vendor1.localhost`, which needs no
   hosts-file entry. New names must also be added to `allowedHosts` in
   `vite.config.js`.
2. Seed it: `cd ../backend && SEED_VENDOR_DOMAIN=localhost1 SEED_COMPANY_NAME="Company name" npm run seed`
   (`SEED_LOGIN_TAGLINE` is optional).
3. Open `http://localhost1:5173`.

## Folders

- `src/components/common/` - the reusable building blocks every module uses:
  Accordion, Alert, Autocomplete, Avatar, Badge, Breadcrumbs, BulkActionBar,
  Button, Card, Checkbox, ConfirmDialog, DatePicker, Divider, Dropdown, EmptyState,
  FileUpload, Form, HtmlEditor, InputField, Menu, Modal, Pagination,
  ProgressBar, Radio, SearchInput, Skeleton, Slider, Spinner, Stepper, Switch,
  Table, Tabs, TextArea, Toast, UnsavedChanges (asks before leaving a page with
  unsaved changes - `useUnsavedChanges(isDirty)`). Reuse these; when something is missing, add it
  here as a new reusable component rather than inside one module.
- `src/components/ui/Sidebar/` - the app's left-hand menu (menu items in
  `navItems.jsx`).
- `src/components/errors/` - the error screens (404, status errors, and the
  full-page 500 shown for any unexpected server error).
- `src/features/<feature>/` - one folder per feature: its `api/`, `context/`,
  `hooks/`, `pages/` and `components/`. `auth` (session, login page),
  `branding` (company name / tagline / logo, loaded once per page load),
  `featureAccess` (which features are on), `dashboard` and `masters`.
- `src/layouts/AppShell.jsx` - the logged-in layout: sidebar + current page.
- `src/utils/apiClient.js` - every API call goes through it (access token,
  refresh on 401, error handling).
- `src/utils/validations.js` - field validators for InputField/TextArea/Form
  (email, Indian mobile number, PIN code, password strength...).
- `src/utils/searchFilter.js` - the matching used by SearchInput lists.
- `src/utils/useDebouncedValue.js` - waits for typing to pause (server-side search).
- `src/utils/scrollLock.js` - the page-scroll lock shared by Modal and the
  mobile Sidebar.
