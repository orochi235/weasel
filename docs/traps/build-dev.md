# Build and dev-server traps

Things in package exports, typings, vite and the dev servers that pass every test and are still wrong.

**A `declare module` augmentation merges through one re-export hop, not two.** TS merges into
the module where the interface is *declared*; aimed at a module that only re-exports it, it
declares a fresh one in that module's scope instead. One hop survives — a consumer augmenting
`'@weasel-js/core'` reaches `DepSchema` declared in `@weasel-js/routing`'s barrel. Two does not:
put the declaration in a submodule the barrel re-exports and the shadowed alias poisons every
`DepSchema[K]`, reported as TS2536 inside routing's own source, nowhere near the augmentation
that caused it. So the interface has to sit in the barrel core re-exports from.
`scripts/smoke-consumer-bundle.mjs`'s `smokeDep` check is the guard, and it has to run against
the *published* `.d.ts` — in-repo typechecks resolve to source and cannot see the flattening.

**A bare `export type { X } from '…'` does not bring `X` into the file's own scope.** Replacing a
local declaration with a re-export leaves every use of the name in that same file unresolved — and
if a DOM global answers to it, silently wrong rather than an error. `SelectionMode` is one:
lib.dom declares `"select" | "start" | "end" | "preserve"`, so `mode: 'multi'` started failing in
eleven demos while the file that lost the declaration compiled clean. Write `import type { X } …`
then `export type { X };`.

**The consumer smoke test cannot catch an undeclared dependency.** It packs every `@weasel-js`
package into the tree, so a bare specifier resolves whether or not the importer declared it.
`npm run check:imports` is the check that works: it compares each package's source imports with
its manifest. `check:manifests` reads no imports, only that advertised paths exist in the tarball.

**opentype.js runs 2.0.0 and is typed by `@types/opentype.js@1.3.10`.** 2.0.0 ships
no typings, so TS resolves the module to the DefinitelyTyped package for the 1.x API.
Harmless while `outline/opentypeParser.ts` keeps its narrow surface — every point it
touches exists in both majors — but the failure would be silent: the 1.x typings
declare `load()` and `loadSync()` as working, and in 2.0.0 they are deprecation stubs
that `console.error` and return `undefined`. A call to either typechecks clean and
fails at runtime. If that surface ever widens, hand-write a local `.d.ts` covering
only what the kit calls.

**Keep a real file extension off a virtual module id, or add `.js`.** A virtual id
ending in a real extension gets claimed by vite's css/json/jsx transforms — postcss
will try to parse a JS module as CSS. `virtual:demo-source:<path>.js` is the shape
that survives.

**A single-threaded static server invents load regressions.** `python3 -m http.server`
handles one request at a time, which serializes a many-chunk build into a slowdown no
real host would show. Use a threaded server, and quote build-output byte counts rather
than emulated FCP — the timings vary too much between runs to compare.

**A second site dev server takes over the first.** The vite config loads `wake`
(`scripts/vite-wake.ts`), which keeps one copy of each app per machine and ignores
`--port`, so a server started from another worktree kills whichever one is running. Start
any extra copy with `WAKE_EXTRA=<port>`, which neither takes over nor gets taken over.

**A dev server serves the packages pre-bundled, so a package edit reloads rather than patches.**
`scripts/vite-prebundle.ts` bundles every `@weasel-js/*` specifier an app imports,
re-bundling on a saved package file in a few seconds. forge keeps every package holding stories (ui,
labkit, forge, diagram, devtools, diagram-elk) as source, so edits there still hot-update.
`WEASEL_DEV_BUNDLE_STORIES=1` bundles ui and labkit, whose stories import through package specifiers:
on 2026-10-21 a forge load fell from 1,624 requests to 1,270 and, at 20 ms of emulated latency, from
7.1 s to 4.5 s to network idle, while a ui component edit went from a 0.28 s hot update to a ~3.6 s
re-bundle and reload. Whatever source imports from a bundled package by relative path is left out of
the bundle and served from source, so it loads once. A stack trace into a bundled package points at
`node_modules/.vite-*/deps`. `WEASEL_DEV_SOURCE=1` serves every package file by file again.
The re-bundle does not always reach the page. On 2026-11-09, in a worktree's site server, an edit to
`packages/renderer` was written to a new chunk (`scripts/is-it-stale.mjs` reported every layer fresh), yet the
reloaded page went on importing the old chunk under its old `?v=` hash, and screenshots showed the old
renderer. Before trusting a before/after, fetch the chunks the page loaded and look for the edit; restarting
the server with `--force` (or serving with `WEASEL_DEV_SOURCE=1`) is what took the edit.
The `browser` vitest project bundles them the same way under `vitest run`, all but what its test files
reach by path (`scripts/vitest-browser-prebundle.ts`); watch mode and `WEASEL_DEV_SOURCE=1` serve them
from source. So a browser test imports its own package by specifier wherever the package exports what it
needs: one relative import of a component serves it and everything it imports from source to every test
file whose bundle reaches it, and passes. What no entry exports, a test reaches through a re-export in its
package's `src/testing/` (`@weasel-js/ui/testing/prefSchemaEditor`), which is never published. A `vi.mock` of
a path never reaches the bundled copy a bundle imports, so a browser test mocks a specifier instead, as
`apps/chart/src/pipeline/pages.browser.test.tsx` mocks `@weasel-js/diagram/effect`.

**Each re-bundle leaves native memory behind in the process that ran it.** rolldown and oxc allocate
with mimalloc, which keeps memory committed after it is freed. This is retention, not a leak: in-process
re-bundles of forge level off at about 2.5 GB, and rolldown alone, with no vite, shows the same curve.
So a saved package file re-bundles in a child process that exits (`restartLeavingNothing`), and the
server then restarts without forcing. On teitou (2026-11-03), 30 forced restarts left forge's server at
1.13 GB of footprint, against 2.66 GB re-bundling in the server, and each restart took about 1.2 s longer.
The maintainer ruled a 2.5 GB plateau acceptable (2026-11-03), so if the child ever has to go, the
in-process re-bundle is fine. vmmap reports mimalloc's regions as `IOAccelerator`, since its default
`os_tag` is 100 (VM_MEMORY_IOACCELERATOR); `scripts/lib/vmmap-regions.mjs` retags them. A restart reloads the config
file, and vite's default loader imports each load as a new ES module, which Node never frees: forge kept about
2 MB of bundled config a restart and grew 12.4 MB of RSS, until `restartLeavingNothing` switched restarts to the
module runner's loader, under which RSS fell 1.0 MB a restart from restart 1 to 30 (teitou, 2026-11-06). The
probes are `scripts/probe-dev-restarts.ts` (a dev server; `scripts/heap-retainers.mjs` reads its snapshots),
`scripts/probe-optimize-deps.ts` (the optimizer alone) and `scripts/probe-rolldown-rebuilds.mjs` (rolldown alone),
each beside its `.runs.jsonl` of records.

**After that restart, nothing a dev config imports can load a module with `import()`.** The module runner that
evaluates the config closes as soon as the config has loaded, and a later `import()` in any module it evaluated
goes through it: in flight, it fails the restart with `transport was disconnected, cannot call "fetchModule"` and
leaves the server serving the code from before the edit; in a hook, it throws `Vite module runner has been closed`,
which forge's prop controls and capture caught as "typescript/playwright is not installed" (2026-11-12). Load
lazily with `createRequire(import.meta.url)`, which is Node's own. `scripts/vite-runner-lazy.vite.test.ts` imports
each such module through the runner and calls its loader after; a new one goes there.

**`check:needs -- --write` redraws the README package table from every package's `dist/`.** Run in a
tree with no fresh build, it strips real badges from core, routing and react; its own error suggests
the flag. Add a new package's row by hand, matching a sibling's badges, and let the fleet check it.
