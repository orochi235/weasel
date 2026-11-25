All nine distinct findings were real and are fixed (11 as listed, two of which were the same in A and B). `npm run lint -w @weasel-js/forge` is the one check that did not run: the machine's hook refused it.

- **Story file added while it fails to parse never gets indexed** (A+B): fixed e3f16d1c4d
- **Shell config `title`/`allowOrigins` not read through an exported const** (A): fixed a22bb49657. `configOf` and `indexFile.scan` now share one reader of top-level bindings, `bindingsOf` in `ast.ts`.
- **A Chromium that crashed or disconnected is kept, failing every capture** (A+B): fixed 32888c00a1
- **One browser context per distinct DPR, never closed while in use** (A): fixed b7936e6a19. At most four stay open (`CONTEXT_CAP`) and the least recently used is closed. 76dae06ffd then moved the cache out of `launchCaptureBrowser`, because that change pushed the function past the 120-line cap.
- **Dangling symlink matching the story globs breaks the whole index** (A): fixed b1954fee79
- **A capture queued at endpoint close starts Chromium again after close** (B): fixed 78c016aa08. After `close()`, captures reject with `CAPTURE_CLOSED`. No ruling was needed, so `docs/unruled.md` has no entry.
- **`folderTitles` suggests a title its own `fits` rejects, and compares the folder name case-sensitively** (B): fixed 03193a3318. No changeset: this code only feeds the repo's `check:forge-titles` and is not exported.
- **Watch probe temp-dir failure becomes an unhandled rejection** (B): fixed e19b495394. `fileEventsArrive` now rejects instead of throwing, cleanup errors are swallowed, and `warnWhenWatchIsSilent` warns "could not check" instead of rejecting.
- **A meta's negated tags kept as literal tags** (B): fixed ccbeac113c

Extra:
- **Six copies of the `err instanceof Error ? err.message : String(err)` helper across forge**: fixed 3d04bbd0ed, folded into `packages/forge/src/messageOf.ts`.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own:
  - `storyIndex.test.ts` (new): pass
  - `shellTitle.test.ts`: pass
  - `capture/browser.test.ts`: pass
  - `capture/endpoint.test.ts`: pass
  - `capture/payload.test.ts`: pass
  - `folderTitles.test.ts`: pass
  - `watchProbe.test.ts`: pass
  - `indexFile.test.ts`: pass
  - `propControls.test.ts`: pass
  - `plugin.test.ts`: pass
  - `cli/parse.test.ts`: pass
- Each new test was also run against the pre-fix source and failed.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass
- `npm run check:size`: pass
- eslint on every changed file: pass
- `npm run lint -w @weasel-js/forge`: **unrun**. The hook refused it as "a suite-sized npm script, and this is the controller". The gate's root `npm run lint` passed.

tally: 9 of 9 fixed, 1 extra fixed