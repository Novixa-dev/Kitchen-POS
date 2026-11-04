# Installation

Covers getting Kitchen POS running from source and onto a till. For packaging
and release, see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 1. Prerequisites

| Requirement | Why |
|---|---|
| **Node.js 20+** | The build toolchain targets modern Node |
| **Git** | Cloning and version tracking |
| **A C/C++ toolchain** | `better-sqlite3` is a native module and is compiled on install |
| **Python 3** | `node-gyp` needs it to drive the native build |

### Toolchain per platform

**Windows**

Install the **Visual Studio Build Tools** with the *Desktop development with
C++* workload, then Python 3 from python.org or the Microsoft Store. A reboot
after installing the Build Tools is often needed before `node-gyp` sees them.

**macOS**

```bash
xcode-select --install
```

**Linux (Debian/Ubuntu)**

```bash
sudo apt install build-essential python3
```

---

## 2. Install dependencies

There are no npm workspaces, so each package installs on its own:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

**The root install is not optional, and the order matters.** Thirty files
under `backend/src` import `electron`, which is declared only in the root
manifest — the app is launched *by* Electron, so the root is where it belongs,
and `backend` resolves it by walking up the directory tree. Install only
`backend` and its typecheck fails with forty `Cannot find module 'electron'`
errors. The same omission in the CI workflow produced exactly that.

If you only need the types and not the 250 MB runtime — a typecheck in CI, for
instance — the binary download can be skipped while keeping the declarations,
which ship inside the npm package:

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
```

### If the native build fails

The symptom is a wall of `gyp ERR!` output while installing `better-sqlite3`.

**Option A — install the dev dependencies only, and build the native module
separately.** Useful when you only need to type-check, lint or run tests:

```bash
npm install --prefix backend --ignore-scripts
```

The TypeScript definitions are present, so `tsc`, ESLint and Vitest all work.
The app itself will not start until the native module is built.

**Option B — fix the toolchain.** Confirm each piece is visible:

```bash
node --version      # 20 or later
python --version    # 3.x
npx node-gyp --version
```

On Windows, point npm at your Python explicitly if `node-gyp` cannot find it:

```bash
npm config set python "C:\Path\To\python.exe"
```

**Option C — rebuild against Electron's own Node headers.** Required if the
module compiled against your system Node and then failed to load inside
Electron:

```bash
npx @electron/rebuild -f -w better-sqlite3
```

---

### Node ABI vs Electron ABI

`better-sqlite3` is compiled against **one** Node ABI, and Electron bundles its
own. A module built for Electron 30 reports `NODE_MODULE_VERSION 123`; a module
built for Node 24 reports `137`. Loading the wrong one fails with:

```
Error: The module '…better_sqlite3.node' was compiled against a different
Node.js version using NODE_MODULE_VERSION 123. This version of Node.js
requires NODE_MODULE_VERSION 137.
```

Consequences worth knowing:

- `npm install` builds for **Node**, which is what Vitest needs.
- `@electron/rebuild` rebuilds for **Electron**, which is what the app needs.
- You cannot have both at once from one build. The committed backend tests
  therefore exercise pure modules (tax, money, receipt rendering, path
  confinement) and never open a database, so `npm test` works regardless of
  which ABI the local binary happens to target.
- To run a script that needs the database against an Electron-ABI build, drive
  it through the Electron binary rather than `node`:

  ```bash
  ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron script.cjs
  ```

  Module resolution follows the script's own directory, so put the script
  beside the `node_modules` that holds the native binary.

### Verifying the database for real

Because the unit tests cannot open a database, the repository carries a
verification harness that does:

```bash
npm run build --prefix backend
npm run verify:db --prefix backend
```

It starts Electron against a **fresh temporary data directory**, applies every
migration, and then asserts the parts no pure unit test can reach: the schema
and indexes each migration claims to create, the `CHECK` and `UNIQUE`
constraints, the money path under both tax regimes, discount and offer caps,
usage limits, the rows written inside the billing transaction, the usage
counters, and loyalty earning then resetting.

It prints `PASS <n>` and exits 0, or lists each failure and exits 1. It never
touches your own app data, so it is safe to run at any time — and it is worth
running after **every** migration, since a migration that fails only on a
populated database fails on a customer's till rather than here.

---

## 3. Run in development

```bash
npm run build --prefix backend   # first compile of the main process
npm run dev
```

`npm run dev` starts three processes together:

1. Vite dev server on `http://localhost:5205`
2. `tsc --watch` for the main process
3. Electron, pointed at the dev server

Changes to the renderer hot-reload. Changes to the main process need Electron
restarting, because the main process is not hot-reloadable.

---

## 4. Verify the checkout

All six should pass before you consider the checkout healthy:

```bash
npm run tsc   --prefix frontend
npm run lint  --prefix frontend
npm run test  --prefix frontend
npm run build --prefix backend
npm run lint  --prefix backend
npm run test  --prefix backend
```

---

## 5. Where data lives

The database, images and automatic backups live in the per-user application
data directory — **not** next to the executable, so an app update never touches
them:

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\kitchen-pos\` |
| macOS | `~/Library/Application Support/kitchen-pos/` |
| Linux | `~/.config/kitchen-pos/` |

Inside it:

```
pos.db            SQLite database (plus -wal and -shm while running)
images/           Dish photos
config.json       Settings (electron-store)
backups/          Automatic backups, if the default folder is used
```

Migrations run automatically on startup and are recorded in a `_migrations`
table, so each applies exactly once. Starting a newer build against an older
database upgrades it in place; **there is no downgrade path**, so take a backup
before updating.

---

## 6. Installing on a till

1. Build the installer on a development machine
   (see [`DEPLOYMENT.md`](./DEPLOYMENT.md)).
2. Install the printers in the operating system first and print an OS test page
   from each. Kitchen POS prints through the OS, so a printer the OS cannot
   reach is not reachable from the app either.
3. Run the installer, complete the setup wizard, and **write down the recovery
   code**.
4. Configure language, currency, tax, outlet details and printers
   (see the [first-run checklist](../../README.md#first-run)).
5. Turn on auto-backup and point it at removable or synced storage — not a
   folder on the same disk.
6. Change the admin PIN from whatever was used during setup.

---

## 7. Common problems

| Symptom | Cause and fix |
|---|---|
| `gyp ERR!` during install | Missing C++ toolchain or Python — see §2 |
| App starts, then a blank window | The renderer failed to build. Run `npm run build --prefix frontend` and read the error |
| `Cannot find module 'better-sqlite3'` | Native build was skipped. `npx @electron/rebuild -f -w better-sqlite3` |
| `SQLITE_CANTOPEN` | The app-data directory is not writable, or antivirus is holding the file |
| Printers list is empty | None installed in the OS, or the spooler service is stopped |
| Dish images do not render | They are served over the confined `local://` scheme. Images outside the app's `images/` directory are refused by design |
| Database is locked | Another copy of the app is running. Only one instance may hold the database |
