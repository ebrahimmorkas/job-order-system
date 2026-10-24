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
  values (move up / down, default, mark active / inactive, delete - saved at
  once); create, copy and
  edit, where every change waits for Save and leaving with unsaved changes
  asks first. With RBAC on, a master can be ticked "Role will be provided for
  this master".
- **Users** (only while RBAC is on) - the list (search, role and status
  filters, roles shown as chips - amber before they start, struck through once
  ended - and "+N extra", status switch, bulk actions, users usage pill) and
  the form: name, login username, password (empty on edit = unchanged),
  email, phone, address; roles from a searchable dropdown, each with start /
  end dates (one role unless several are allowed); and, when allowed, extra
  access: module options ticked one by one and master values, each with its
  own dates. Users can't log in yet.
- **Role Master** (with Users, only while RBAC is on) - the same list as
  Masters plus a type filter, an access column and the roles usage pill.
  Create (pick Module role or Master role - it can't change later), copy and
  edit: a module role adds modules from a searchable dropdown and ticks View /
  Create / Edit / Delete (Role assignment for Users; only View and Edit for
  Company Settings - ticking anything ticks View); a master role adds role
  masters, each "Whole master" or some of its values.
- **Controls** - fields the vendor adds to the job order (text field, text
  area, checkbox, radio buttons), only the types assigned to the vendor: the
  same list as Masters plus a type filter and a usage pill per limited type;
  create (pick the type), copy and edit with a live preview; radio choices
  with a default. "Include this price in tax" shows only while tax is
  available (the tax feature on and one country's tax details filled in).
- **Job Orders** - the list (newest first, search by number or customer
  place, view / edit / cancel) and the job order form: the number (only when
  typed by hand), the customer address (only when asked; the country is
  locked when the vendor has one), every master as a searchable dropdown
  (multi-select where allowed, default picked, short name when chosen in
  Company Settings, required ones starred) - under a role master, "Who does
  <value>?" for each picked value lists only the people who have that value
  (several can be picked, optional) - every control, the tax rate, and a
  summary beside it that updates as you type - every answer, the prices,
  subtotal, tax split (CGST + SGST, or IGST for another Indian state) and
  total in the country's currency, or why no tax is charged. Images (only
  with the image feature on): thumbnails with add / remove, checked for
  format, size and count, uploaded with Create / Save; the view shows them
  (click for full size). Leaving with unsaved changes asks first. With Layout
  Master on, the view has Print: pick a layout (the default first), see the
  job order in it, then Print (the page at the layout's paper size) or
  Download PDF / PNG / JPEG.
- **Layout Master** (only while the feature is on) - the list (search, status
  filter, Default badge and star to make one the default, paper, items count,
  status switch, copy / edit / delete, bulk actions, layouts usage pill). New
  layout: name, paper (A3 / A4 / A5 / Letter / Legal portrait or landscape, or
  a custom width and height) and which labels show by default. Then the
  designer: items on the left (job order fields, masters, controls, text,
  line, rectangle, circle, table, logo - drag onto the page or click), the
  page in the middle (move and resize in 1 mm steps, Alt for finer; arrows,
  Delete, Ctrl+Z / Y / D; zoom), and the selected item's settings on the
  right (place and size, label on / off and its text, table cells, line and
  fill, and - when allowed - font, size, bold, italic, underline, alignment,
  colour). Export downloads the template as PDF, PNG or JPEG. Leaving with
  unsaved changes asks first.
- **Company Settings** - tabs: General (company name, login tagline, logo -
  the menu and browser tab update at once - and Job orders: automatic
  numbers, ask the customer address, where to use master short names) and Tax (only with the tax feature
  on): one form per assigned country - business address with state / city
  dropdowns, "I am registered for GST / VAT" with that country's own fields,
  and the default tax rate. Tabs keep what was typed; leaving with unsaved
  changes asks first.
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
  ActionIcons, Button, Card, Checkbox, ColorField (colour picker with its code), ConfirmDialog, DatePicker, DefaultChoice,
  Divider, Dropdown, EmptyState, FileUpload, Form, HtmlEditor, IconButton,
  ImageUploader (a grid of images with add / remove, checking type, size and count),
  InputField, ListItemsEditor (an ordered, editable list of named items with a
  default), Menu, Modal, NumberField (a small number box with a unit), Pagination,
  ProgressBar, Radio, SearchInput, Skeleton, Slider, Spinner, Stepper, Switch,
  Table, Tabs, TextArea, Toast, UsagePill ("2 / 10 used"), UnsavedChanges (asks before leaving a page with
  unsaved changes - `useUnsavedChanges(isDirty)`). Reuse these; when something is missing, add it
  here as a new reusable component rather than inside one module.
- `src/components/ui/Sidebar/` - the app's left-hand menu (menu items in
  `navItems.jsx`).
- `src/components/errors/` - the error screens (404, status errors, and the
  full-page 500 shown for any unexpected server error).
- `src/features/<feature>/` - one folder per feature: its `api/`, `context/`,
  `hooks/`, `pages/` and `components/`. `auth` (session, login page),
  `branding` (company name / tagline / logo, loaded once per page load),
  `featureAccess` (which features are on), `dashboard`, `masters`, `controls`,
  `companySettings`, `jobOrders` and `layouts` (the designer, the drawing
  shared by the designer, printing and exports, and the PDF / image export).
- `src/layouts/AppShell.jsx` - the logged-in layout: sidebar + current page.
- `src/utils/apiClient.js` - every API call goes through it (access token,
  refresh on 401, error handling).
- `src/utils/validations.js` - field validators for InputField/TextArea/Form
  (email, Indian mobile number, PIN code, password strength...).
- `src/utils/searchFilter.js` - the matching used by SearchInput lists.
- `src/utils/useDebouncedValue.js` - waits for typing to pause (server-side search).
- `src/utils/scrollLock.js` - the page-scroll lock shared by Modal and the
  mobile Sidebar.
