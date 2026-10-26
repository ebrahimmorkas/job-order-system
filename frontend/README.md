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
| `/customers`, `/customers/:id`, `/customers/:id/edit` | Customers (list, details, edit - no create) |
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
  them, newest first, with what they do on each (and on which item, when
  there are several), their step, when it is due
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
  this master". Deleting (one or several) first names the roles / users using
  the masters; saying yes takes the masters out of them (the roles stay).
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
  masters, each "Whole master" or some of its values (or none: the role then
  gives no access until one is added).
- **Controls** - fields the vendor adds to the job order (text field, text
  area, checkbox, radio buttons, dropdown), only the types assigned to the vendor: the
  same list as Masters plus a type filter and a usage pill per limited type;
  create (pick the type), copy and edit with a live preview; radio choices
  with a default. "Include this price in tax" shows only while tax is
  available (the tax feature on and one country's tax details filled in).
  A text field that isn't a price can be ticked "This is a quantity field"
  (whole numbers only; one per vendor; a "Quantity" badge in the list).
  With per unit pricing on, one dropdown can be ticked "Use this dropdown to
  pick the pricing unit" (a "Pricing unit" badge): each choice is a unit
  with how it is measured (one number / length x width / length x width x
  height), a rate, rounding of each measurement, a minimum size and
  wastage %. A price then says how it is charged: per unit, per running
  length of the edge, or per piece.
- **Job Orders** - the list (newest first, search by number, job name,
  customer or place; the Job name column shows the job name, or - with
  several items - each item's on its own line numbered "1. Round", "2. -";
  with steps on, Edit can "Change step" of a job order from its row (a
  popup); the Customer column shows name, phone and place; view / print /
  edit / cancel; Back on a print opened from the list returns to the list)
  and the job order form: the number (only when typed by hand), the
  customer - with Customers on, "Find a saved customer" (type any part of
  the name, phone, email or address; picking one fills the form) and name,
  phone, email - and the address (only when asked; the country is locked
  when the vendor has one), then the items - one card each ("Details" when
  the vendor may have one item, else "Item 1", "Item 2"... with "+ Add item"
  up to the vendor's limit and Remove on each when there are several). An
  item has its job name (optional; from the second item "Same as above"
  copies the name of the item just above, still editable), every master as a searchable dropdown
  (multi-select where allowed, default picked, short name when chosen in
  Company Settings, required ones starred) - under a role master, "Who does
  <value>?" for each picked value lists only the people who have that value
  (several can be picked, optional) and, once someone is picked, "Complete
  in" (a number and Seconds / Minutes / Hours / Days / Months / Years;
  empty = no deadline) - every control and its images. When Company Settings
  says "Software calculates the price", each price shows a Rate and a Total
  (rate x the item's quantity, still editable; emptying it goes back to rate
  x quantity); changing the quantity or a rate while a total was typed by
  hand asks "Keep my totals" or "Recalculate" (a job order keeps the way it
  was made). With per unit pricing each item has "Charged: Per piece / Per
  unit"; per unit it asks the unit (its rate fills the first per unit price
  while that rate is empty or still the previous unit's) and the size
  (Length / Width / Height as the unit takes), shows "Size 9.43 sq ft ·
  charged 11.25 sq ft · edge 14" and the rates read "Rate per sq ft" / "Rate
  per running length" / "Rate per piece"; changing the unit or size with a
  typed total asks again. Then the tax rate, "Delivery and payment" (the
  delivery date, a discount as an amount or %, the advance received - each
  as Company Settings asks; one no longer asked but saved on the job order
  shows, locked),
  and a summary beside it that updates as you type - every answer (item
  after item under its heading when there are several), the prices of all items,
  subtotal, discount, tax split (CGST + SGST, or IGST for another Indian
  state), round off, total, advance and balance due in the country's
  currency, or why no tax is charged. Images (only
  with the image feature on, per item): thumbnails with add / remove, checked for
  format, size and count (the limit counts all items together), uploaded
  with Create / Save; the view shows them by item (click for full size). With
  steps on, the view has "Job order step" - the step of the whole job order
  (who moved it, when, the history) with Step / Update step for the owner
  and users with Edit (the workers' own steps don't change) - and the list
  a Step column. Leaving with unsaved changes asks first. With Layout
  Master on, the view has Print: pick a layout (the default first), see the
  job order in it (every item: a table row set to repeat prints once per
  item, the table grows and what is below it moves down; what doesn't fit
  continues on more pages, with the header / footer and the table's heading
  rows repeated - `layouts/printFlow.js`, `layouts/usePrintedPages.jsx`),
  then Print (the pages at the layout's paper size) or Download PDF (all
  pages) / PNG / JPEG (one file per page). A field outside a table shows
  every item's value, one "1. value" line each.
- **Customers** (`features/customers`, only while the feature is on) -
  saved from job orders with a phone or an email (one per phone / email).
  The list (latest job order first, search by name, phone, email or address,
  job order count, last job order, bulk delete; no create) and the edit /
  details screen: name, phone, email (one of the two needed) and the address
  dropdowns. Job orders keep the details they were saved with.
  `components/CustomerFields.jsx` (the inputs) and `customerFields.js` (the
  checks) are shared with the job order form.
- **Layout Master** (only while the feature is on) - the list (search, status
  filter, Default badge and star to make one the default, paper, items count,
  status switch, copy / edit / delete, bulk actions, layouts usage pill). New
  layout: name, paper (A3 / A4 / A5 / Letter / Legal portrait or landscape, or
  a custom width and height) and which labels show by default. Then the
  designer: items on the left (Page: Header / Footer - click to turn the
  band on and set its height; job order fields; masters and controls - the
  active ones; text,
  line, rectangle, circle, table, logo and - with image upload on - "Job
  order image": Image 1, Image 2... each prints that image of the job order,
  so a layout with 2 prints 2 even when the job order has 4 - drag onto the
  page or click), the page in the middle (opens at real size; move and resize
  in 1 mm steps, Alt for finer; arrows, Delete, Ctrl+Z / Y / D; zoom, or drag
  any of the page's 4 edges to make it bigger or smaller on screen - a page
  bigger than its area scrolls inside it; the selected item shows how far it
  is from the left, right, top and bottom of the page, or of the table it
  sits in), and the selected item's settings on the
  right (place and size, "Print on every page" - on in the header / footer,
  off for the first / last page only; on in between = same spot on every
  page -, label on / off and its text, table cells, the row
  repeated for each item, row bold / colour, table lines, a column hidden when
  no item has a value, line and fill, and - when allowed - font, size, bold, italic, underline, alignment,
  colour). Each side panel has a fold button on its canvas side: folded, it
  becomes a slim strip (with the button to open it again) and the page gets
  the room (kept in the browser). The page settings set the header and
  footer heights (shaded bands on the page; what is inside prints on every
  page). Preview pages shows the layout printed for a chosen number of
  items. Export downloads the template as PDF, PNG or JPEG. Leaving with unsaved changes asks first.
- **Company Settings** - tabs: General (company name, login tagline, logo -
  the menu and browser tab update at once), Job Orders (automatic numbers,
  ask the customer address, where to use master short names, price on a job
  order - "I enter the price" or "Software calculates the price" (rate x
  quantity) - how you charge (per piece / per unit, with per unit pricing),
  also ask on a job order (delivery date, discount, advance), round off the
  total (to 1 / 5 / 10; nearest / always up / always down) - when the work
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
  ActionIcons, Button, Card, Checkbox, ColorField (colour picker with its code), ConfirmDialog (optional cancelLabel), DatePicker, DefaultChoice,
  Divider, Dropdown (searchable: the cursor starts in its search box), EmptyState, FileUpload, Form, HtmlEditor, IconButton,
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
  person may do), `myWork`, `dashboard`, `masters`, `controls`, `customers`,
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
