- Content script's run-once mark stops it re-injecting after a Chrome extension reload (A+B): fixed 2b7861fc60
- wakeTab stops injecting once any frame answers, so other frames never get bridged (A+B): fixed 8b5f2262aa. It now injects every frame each time. The manifest content script also gets `match_about_blank: true`, which covers A's about:blank/srcdoc case.
- A tab closed within 3 s of loading stays in the badge probe map, and a badge write on a closed tab is an unhandled rejection (A+B): fixed 3238c5428d. My test for the rejection on the `loading` clear did not fail on the old code, so I dropped it. That path is fixed but has no test.
- watchHookPresence reports `false` twice across navigations (A): fixed 4ebb62635d
- watchHookPresence with an empty `delays` probes in a tight loop (B): fixed 7a4fcb47e3. I made the strict call: it now throws a RangeError, recorded in `docs/unruled.md`.
- probeFrame trusts `roots()` to return an array, so the count can be NaN (A): fixed 0e5de8c4d0
- Each panel remount reuses request ids on the shared transport, so a late answer settles the wrong request (B): fixed c56d7b8aaf. The transport now gives requests ids that stay unique for its lifetime, maps answers back, and drops answers from before the latest `yo`.

Extra defects: none.

No changesets: `apps/devtools-extension` is not a published package, and earlier extension fixes (8db502d615, 76ee38d6e7) shipped without them.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: manifest.test.ts pass (6), background/badge.test.ts pass (5), background/wake.test.ts pass (2), content/start.test.ts pass (8), hookPresence.test.ts pass (10), panel/portTransport.test.ts pass (8), tabWeasel.test.ts pass (13). I also ran panel/PanelHost.test.tsx pass (2) and bridge.e2e.test.tsx pass (1).
- `typecheck:packages`: not applicable, since the extension is an app and not a package. Ran `npm run typecheck` instead (root and browser programs): pass.
- eslint on the changed files: pass
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1331 changeset(s)")
- Tree clean, `.skulk/` untouched.