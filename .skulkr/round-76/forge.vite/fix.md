Suggested title for a file matching no export fails its own check (A): fixed f4839323b4. The report now says "no title fits: name the file for '<folder>' or one of its exports". No changeset, since this code only feeds the repo's `check:forge-titles`.

Native story built by a member call or a non-function binding is dropped from the index (A): fixed 25ffae616e, narrowed in c7d587f6b6. `Object.assign` copies, a namespace import's `story`, and a function returned by another call now stay in the index. A method of a literal or of a global (`Array.from`) stays out. I made that call myself: `docs/unruled.md` has no ruling on it.

foreignStories depth-limit memo depends on visit order (A): fixed 9adbe7390b (with its test's type fix in 09d967eddd). The memo is now keyed by depth as well.

foreignStories deadlocks on mutually recursive imported functions (B): fixed 9adbe7390b. It is the same memo as the item above. A walk now only asks about deeper keys, so it never waits on its own pending answer.

Capture box has no upper bound (A+B): fixed d4c023c618. A box past 16384 device pixels on either side (`box × dpr`) gets a 400. This is a strict call, recorded in `docs/unruled.md` under a new "Audit round seventy-six" section.

`serveCapture.close()` leaves a Chromium launched during close (A): fixed c7d118fb43. Once closing, the endpoint answers 503 and launches nothing.

`export *` cycles grow exponentially in trace.ts and bindings.ts (B): fixed a9fec72d65. Each lookup keeps a visited set of (file, name). Before the fix, three barrels took 393,213 visits for one name.

`closeServer` is not a vite plugin hook (B): not a defect. Vite 8.3.8 declares `closeServer` (`node_modules/vite/dist/node/index.d.ts:2218`), and the existing endpoint test sees `browser.close` called on `server.close()`.

`folderTitleReport`'s default `root = ''` makes the check pass without checking (B): fixed 78522268be. `root` is now required in both title reports, and paths are read with `path.relative`.

warnOnce and the capture endpoint import packages that resolve only to dist (B): fixed 8485311880, plus a part-cache allowlist entry in 31c6f9398a. The new `sourceImports.test.ts` walks the plugin's import graph and fails on any runtime `@weasel-js/` import.

Extra: 02ecf994ff shortens three of my changeset titles to under 140 characters. It is a tidy-up, not a defect.

Checks:
- `folderTitles.test.ts` pass
- `titleReport.test.ts` pass
- `indexFile.test.ts` pass
- `indexFile.pbt.test.ts` pass
- `nativeExports.test.ts` pass
- `trace.test.ts` pass
- `bindings.test.ts` pass
- `foreignStories.test.ts` pass
- `indexStory.test.ts` pass
- `capture/payload.test.ts` pass
- `capture/endpoint.test.ts` pass
- `sourceImports.test.ts` pass
- `plugin.test.ts` pass
- `forgeTest.test.ts` pass
- `componentGraph.test.ts` pass
- `storyIndex.test.ts` pass
- `shellTitle.test.ts` pass
- `npm run checks:gate`: first run "3 of 33 failed" (typecheck, typecheck:packages, check:part-caches); after the fixes, "checks:gate: all 33 passed"
- `npm run check:changesets`: OK, with no warnings on the forge changesets
- `npm run check:size`: pass
- `npm run lint -w @weasel-js/forge`: not run, because forge has no `lint` script ("Missing script: lint"). Eslint on every changed `.ts` file instead: pass.

tally: 10 of 11 fixed, 0 extra fixed