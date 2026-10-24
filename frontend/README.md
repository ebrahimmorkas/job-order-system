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

In production, the web server must answer every address that isn't a file
with `index.html` (each screen has its own address, e.g. `/users/123/edit`),
for example in nginx: `location / { try_files $uri /index.html; }`. Live
updates use a WebSocket at `/socket.io` (see the backend README for its nginx
lines; `npm run dev` forwards it to the backend).

## Page addresses

Every screen has its own address, so a refresh, or a link opened in a new
tab, stays on it:

| Address | Screen |
|---|---|
| `/` | Dashboard |
| `/my-work`, `/my-work/:id` | My work list, a job order's view |
| `/job-orders`, `/job-orders/new`, `/job-orders/:id`, `/job-orders/:id/edit`, `/job-orders/:id/print` | Job Orders |
| `/masters`, `/controls`, `/roles`, `/layouts` (+ `/new`, `/:id/edit`, `/:id/copy`) | list, create, edit, copy |
| `/users`, `/users/new`, `/users/:id/edit` | Users |
| `/company-settings`, `/company-settings/job-orders`, `/company-settings/shop`, `/company-settings/tax` | Company Settings tabs |

Logged out, any address shows the login page and logging in opens it.
A section the person can't open (or a switched-off feature) goes to the
dashboard; an unknown address shows "Page not found" beside the menu.
The browser's Back / Forward on a page with unsaved changes asks first.
Each section's code is downloaded the first time it is opened
(`utils/lazyPage.js`), so the first load stays small.

## What the app shows

- **Login page** - the company name, login tagline and logo come from the
  vendor's Company Settings (`GET /api/public/branding`); nothing about the
  company is written in the code. The company name is also the browser tab
  title, and the logo the tab icon. Without a logo, the first letter of the
  name is shown instead.
- **After login** - the sidebar (company name + logo, the user, logout) and
  the dashboard. On a computer the sidebar folds down to its icons with the
  button at its top (kept in the browser); Layout Master folds it by itself
  for the room, and leaving it brings back the person's own choice. Menu items of features switched off for the vendor are
  hidden; items whose page is not built yet show "coming soon". What the
  person may do is loaded once before the pages show (`features/access`,
  `useAccess().can(module, permission)`): a user sees only the modules their
  roles give, and buttons they can't use are hidden (New / Copy without
  Create, Edit and status switches without Edit, Delete without Delete;
  with Details but not Edit, the name and a View button open the record's
  form read only at `/<section>/:id`; with View only, nothing opens;
  Company Settings read only without Edit; roles on the user form only with
  Assign role, never on your own account). Layout Master is owner only.
- **Dashboard** (`features/dashboard`) - the owner, and a user whose roles
  give Dashboard, see the whole company: open job orders, work in progress,
  overdue (and on hold), completed this week; "Who is working on what" (the
  most urgent first - person, job order, work, step, start date and the time
  left counting down); a workload chart (each person's open work split into
  in progress / not started / on hold / overdue, with a legend and a hover
  tooltip); and the latest step changes. A user given work sees their own
  numbers and what is due next. Both load again by themselves when work
  changes. Job order numbers open the job order only with Job Orders Details.
- **My work** (users given master values' work) - the job orders given to
  them, newest first, with what they do on each, their step, when it is due
  and the time left ("Overdue", "Completed on time", "Completed late by 2
  hours", "No deadline", or not counting
  until their first step), who else does it, and a read-only view of the job
  order without any money. With steps on, the list ("Change step" under each
  piece of work) and the view move the work to a step (In progress asks the %,
  Hold asks why); the view also shows its history. The
  dashboard links to it. The owner's job order list shows how the work is
  going (done / on hold / working) and the view has a Work progress card
  with everyone's step, start, due time and history. Company Settings asks
  when the work time starts (when given, or at each person's first step) and,
  for the first step, what a changed time of started work counts from (the
  day they started, or the moment of the change).
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
  end dates (one role unless several are allowed); and Access: a table like
  Role Master (with an All column) where what the roles give comes ticked -
  untick an option to take it away from this user only (unticking View takes
  the module, Details takes Edit) - and, when allowed, more can be ticked or
  modules added as extra access, each extra option with its own dates under
  the row; the role masters' values come ticked too (untick a value, or All
  values); and, when allowed, extra master values with their own dates.
  Users log in while RBAC is on.
- **Role Master** (with Users, only while RBAC is on) - the same list as
  Masters plus a type filter, an access column and the roles usage pill.
  Create (pick Module role or Master role - it can't change later), copy and
  edit: a module role adds modules from a searchable dropdown and ticks View /
  Details / Create / Edit / Delete (Role assignment for Users; only View and
  Edit for Company Settings - ticking anything ticks View, ticking Edit ticks
  Details, unticking Details unticks Edit; All ticks every option of a
  module, the All in the header every option of every module); a master role adds role
  masters, each "Whole master" or some of its values.
- **Controls** - fields the vendor adds to the job order (text field, text
  area, checkbox, radio buttons), only the types assigned to the vendor: the
  same list as Masters plus a type filter and a usage pill per limited type;
  create (pick the type), copy and edit with a live preview; radio choices
  with a default. "Include this price in tax" shows only while tax is
  available (the tax feature on and one country's tax details filled in).
- **Job Orders** - the list (newest first, search by number or customer
  place, view / print / edit / cancel; Back on a print opened from the list
  returns to the list) and the job order form: the number (only when
  typed by hand), the customer address (only when asked; the country is
  locked when the vendor has one), every master as a searchable dropdown
  (multi-select where allowed, default picked, short name when chosen in
  Company Settings, required ones starred) - under a role master, "Who does
  <value>?" for each picked value lists only the people who have that value
  (several can be picked, optional) and, once someone is picked, "Complete
  in" (a number and Seconds / Minutes / Hours / Days / Months / Years;
  empty = no deadline) - every control, the tax rate, and a
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
  line, rectangle, circle, table, logo and - with image upload on - "Job
  order image": Image 1, Image 2... each prints that image of the job order,
  so a layout with 2 prints 2 even when the job order has 4 - drag onto the
  page or click), the page in the middle (opens at real size; move and resize
  in 1 mm steps, Alt for finer; arrows, Delete, Ctrl+Z / Y / D; zoom, or drag
  any of the page's 4 edges to make it bigger or smaller on screen - a page
  bigger than its area scrolls inside it; the selected item shows how far it
  is from the left, right, top and bottom of the page, or of the table it
  sits in), and the selected item's settings on the
  right (place and size, label on / off and its text, table cells, line and
  fill, and - when allowed - font, size, bold, italic, underline, alignment,
  colour). Each side panel has a fold button on its canvas side: folded, it
  becomes a slim strip (with the button to open it again) and the page gets
  the room (kept in the browser). Export downloads the template as PDF,
  PNG or JPEG. Leaving with unsaved changes asks first.
- **Company Settings** - tabs: General (company name, login tagline, logo -
  the menu and browser tab update at once), Job Orders (automatic numbers,
  ask the customer address, where to use master short names, when the work
  time starts with steps on, and - with Layout Master and RBAC on - what the
  printed "Work given" field shows: who does it, start date, due time, step
  and %, hold reason), Shop (the owner only: close and open the shop) and
  Tax (only with the tax feature
  on): one form per assigned country - business address with state / city
  dropdowns, "I am registered for GST / VAT" with that country's own fields,
  and the default tax rate. Tabs keep what was typed; leaving with unsaved
  changes asks first.
- An unknown host name shows "No account is set up for this domain".
- **Notifications and live updates** (`features/realtime`,
  `features/notifications`) - after logging in the app keeps one live
  connection (socket.io, loaded only then). The bell at the top of every page
  shows how many are unread and the list (newest first, "Show older", "Mark
  all as read"); a new one arrives with a toast, and opening one marks it read
  and opens its job order (the owner's job order view, or the user's My work).
  Users hear about work given, taken away and time changes; the owner about
  step changes, holds, completed and overdue work. The job order list and
  view, My work and the blocked pages load again by themselves when something
  changes; after losing the connection everything loads again once.
- **Maintenance, payment and the shop closed** (`features/serviceStatus`) -
  when the backend answers 503 with a block, a full page replaces the app:
  "Under maintenance" (also instead of the login page), "Payment pending"
  for the owner or "System unavailable" for users, and "Shop closed" with
  the owner's message and when it opens again. The page checks again every
  30 seconds and opens the app by itself at the shop's time; "Check again"
  checks at once. While the shop is closed the owner keeps working, with a
  banner on every page and an "Open shop" button. The owner closes the shop
  in Company Settings > Shop (message and an optional time to open
  again; without a time it stays closed until opened by hand).

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
  ImageUploader (a grid of images with add / remove, checking type, size and count; a usage pill when the count is limited),
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
  `featureAccess` (which features are on), `access` (what the logged-in
  person may do), `myWork`, `dashboard`, `masters`, `controls`,
  `companySettings`, `jobOrders` and `layouts` (the designer, the drawing
  shared by the designer, printing and exports, and the PDF / image export).
- `src/layouts/AppShell.jsx` - the logged-in layout: sidebar + the page of
  the address.
- `src/router/` - the page address (`useRouter()` - pathname, navigate;
  `screenOf` turns a section's address into list / create / edit / copy /
  view). No router library.
- `src/utils/lazyPage.js` - loads a page's code when first opened (reloads
  once if a new version went online); `PageLoadBoundary` in
  `components/errors` shows "Reload" if it still can't load.
- `src/utils/apiClient.js` - every API call goes through it (access token,
  refresh on 401, error handling).
- `src/utils/validations.js` - field validators for InputField/TextArea/Form
  (email, Indian mobile number, PIN code, password strength...).
- `src/utils/searchFilter.js` - the matching used by SearchInput lists.
- `src/utils/useDebouncedValue.js` - waits for typing to pause (server-side search).
- `src/utils/useNow.js` - the current time, updated every 30 seconds (time left).
- `src/utils/scrollLock.js` - the page-scroll lock shared by Modal and the
  mobile Sidebar.
