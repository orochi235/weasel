# Build and dev-server traps

Things in package exports, typings, vite and the dev servers that pass every test and are still wrong.

**`export * from '@weasel-js/<pkg>'` in core's barrel emits no binding in the
bundle.** A star re-export of an *external* package survives typecheck and the
unit suite, then fails at the consumer's bundler — `No matching export in
core/dist/index.js` — because esbuild cannot see through the package boundary
to enumerate the names. Re-export from another workspace package by name, the
way core already does for `@weasel-js/font`. Only `npm run test:smoke:consumer`
catches it.

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

**`import.meta.glob`'s two arguments must be inline literals.** Vite resolves it by
static analysis, so hoisting the patterns or the options object into a `const` leaves
it unable to read them — it silently drops `eager` and every matched file becomes its
own dynamic chunk. That turned one modulepreload into 87 in `apps/draw` and, measured
cold on Slow 4G, looked exactly like "lazy-loading the dev surfaces caused a 6x FCP
regression". Bisect before believing a chunk-count regression.

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
The `browser` vitest project bundles them the same way under `vitest run`, all but what its test files
reach by path (`scripts/vitest-browser-prebundle.ts`); watch mode and `WEASEL_DEV_SOURCE=1` serve them
from source.
