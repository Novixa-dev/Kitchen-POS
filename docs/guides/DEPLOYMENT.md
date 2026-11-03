# Deployment

Releasing Kitchen POS onto a till.

---

## Pre-release checklist

Run all of it. None of these steps is optional before a build goes near a
customer.

```bash
# Type safety
npm run tsc   --prefix frontend
npm run build --prefix backend

# Lint
npm run lint  --prefix frontend
npm run lint  --prefix backend

# Tests
npm run test  --prefix frontend
npm run test  --prefix backend

# Production bundle
npm run build --prefix frontend
```

Then, manually, against a copy of real data:

| Check | Why it is on the list |
|---|---|
| Switch to Arabic and walk the whole app | RTL regressions do not show in tests |
| Switch to English and back | Confirms nothing is one-way |
| Take an order, send a ticket, settle a bill, reprint it | The core money path |
| Confirm the reprint matches the original | Tax regime is snapshotted per bill |
| Test print on both stations | The printer chain is environment-specific |
| Open and close a shift with a deliberate cash discrepancy | Reconciliation and the automatic note |
| Open and close a business day | Session grouping |
| Export a backup, then import it into a clean profile | The only real test of a backup |
| Confirm each migration applied — check `_migrations` | A failed migration is silent until something breaks |

---

## Versioning

Bump the version in **all three** `package.json` files; they are separate
packages and electron-builder reads the root one:

```
package.json
frontend/package.json
backend/package.json
```

Use semantic versioning. Treat **any** database migration as at least a minor
bump, since there is no downgrade path.

---

## Building installers

```bash
npm run build     # frontend + backend
npm run package   # electron-builder
```

Output lands in `dist-electron/`:

| Platform | Artefact |
|---|---|
| Windows | `Kitchen POS Setup x.y.z.exe` (NSIS) |
| macOS | `Kitchen POS-x.y.z.dmg` |

Build on the target platform. Cross-building macOS from Windows is not
supported, and cross-building Windows from macOS needs Wine and is not worth
the trouble for a release build.

### Bundled resources

`electron-builder.yml` must ship the migrations directory as an
`extraResource` — `migrate.ts` reads it from `process.resourcesPath` when
packaged. **Verify this after any change to the build config:** a packaged app
with no migrations starts against an empty database and appears to work until
the first query.

---

## Code signing

### Windows

Unsigned installers trigger SmartScreen, which in practice stops
non-technical users from installing at all. With an EV or OV certificate:

```bash
set CSC_LINK=path\to\certificate.pfx
set CSC_KEY_PASSWORD=...
npm run package
```

### macOS

Distribution outside your own machine requires signing **and** notarisation,
or Gatekeeper refuses to open the app:

```bash
export CSC_LINK=path/to/certificate.p12
export CSC_KEY_PASSWORD=...
export APPLE_ID=...
export APPLE_APP_SPECIFIC_PASSWORD=...
export APPLE_TEAM_ID=...
npm run package
```

Never commit certificates or passwords. Use CI secrets or a local environment
file that is git-ignored.

---

## Installing on a till

1. **Install the printers in the OS first** and print an OS test page from each.
   Kitchen POS prints through the OS; a printer the OS cannot reach is not
   reachable from the app.
2. Run the installer.
3. Complete the setup wizard — language first, then outlet name and admin PIN.
4. **Write the recovery code down and store it off the machine.** It is the
   only way to reset the admin PIN without the PIN.
5. Configure language, currency, tax regime, outlet details and printers.
6. Test print on both stations.
7. Turn on auto-backup, pointed at removable or synced storage — **not** a
   folder on the same disk.
8. Change the admin PIN from whatever was used during setup, and create the
   real staff accounts with their own PINs.
9. Note the app-data path for support (see
   [`INSTALL.md`](./INSTALL.md#5-where-data-lives)).

---

## Updating an existing install

1. **Take a backup through the app** and copy it off the machine. Not a file
   copy of `pos.db` — it is in WAL mode, so a live copy can be inconsistent.
2. Close the app completely. Only one instance may hold the database.
3. Run the new installer over the old one. Application data is in the user
   profile, so it is untouched.
4. Start the app. Migrations run automatically and are recorded once each.
5. Verify: take one order end to end, and reprint one historical bill.

**There is no downgrade path.** A newer build upgrades the schema in place; an
older build will not understand it. The backup from step 1 is the rollback.

---

## Rollback

1. Uninstall the newer version.
2. Install the previous version.
3. Import the backup taken before the upgrade.

Anything entered after the upgrade is lost — which is why step 1 of an update
is a backup, and why rollback is a decision to make quickly.

---

## Operational routine

| Cadence | Task |
|---|---|
| Daily | Close the business day; confirm the auto-backup ran (Settings shows the timestamp) |
| Daily | Close the shift with a cash count |
| Weekly | Copy a backup off the machine entirely |
| Monthly | Restore a backup into a spare profile and confirm it opens. An untested backup is not a backup |
| Per release | Work the pre-release checklist above |

---

## Out of scope

Recorded so nobody assumes otherwise:

- **No auto-update.** Updates are installed manually. Adding
  `electron-updater` means hosting a release feed and signing every build.
- **No multi-terminal sync.** The database is a local file; two tills do not
  share state.
- **No cloud backup.** Backups are local ZIPs; copying them off the machine is
  a manual or OS-level task.
- **No certified e-invoicing.** Receipts carry the tax number and the breakdown,
  but ZATCA Phase 2 cryptographic stamping and clearance are not implemented.
