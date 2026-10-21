# Job Order - frontend

React 19 + Vite + Tailwind CSS 4.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

The backend must be running too (`cd ../backend && npm run dev`, port 5000).
In development, Vite forwards every `/api` request to it.

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
2. Seed it: `cd ../backend && SEED_VENDOR_DOMAIN=localhost1 npm run seed`
3. Open `http://localhost1:5173`.

## Folders

- `src/components/errors/` - the error screens (404, status errors, and the
  full-page 500 shown for any unexpected server error).
- `src/features/<feature>/` - one folder per feature: its `api/`, `context/`
  and `hooks/`.
- `src/utils/apiClient.js` - every API call goes through it (access token,
  refresh on 401, error handling).
