# Demo site load cost

**What this is:** a diagnosis and a fix design for why `apps/site` loads slowly.

**Who it's for:** whoever picks up the optimization. It assumes you know the repo
but nothing about this investigation.

**Branch:** the finding is structural and present on `main`. Work from a fresh
branch off `main`; do not build on `side-scroller-finish`, which is unrelated
demo work still in flight.

---

## The finding

Measured 2026-08-23 by ablation builds — each number below is a real build, not
an estimate.

**The dominant cost is one line: `apps/site/registry.ts:696`.** It runs

```ts
import.meta.glob([... '../../packages/**/src/**/*.{tsx,ts,css}',
                  '../draw/src/**/*.{tsx,ts,css}'], { query: '?raw', eager: true })
```

which inlines the verbatim source of **all 1,656 files under `packages/*/src/`**
— including **642 test files, 3.71 MB** — plus **123 files of `apps/draw/src`,
a different application** — into the entry chunk as string literals. That is
**8.98 MB of the 10.95 MB bundle (82%)**, and 1,779 of the 2,762 module requests
the dev server serves. The bundle is not mostly code; it is mostly a copy of the
repo. Lines 10,000–239,999 of the minified output are unminified TypeScript,
JSDoc and `describe(...)` blocks intact.

It exists to auto-derive "extras" source tabs from a demo's relative imports.

The eager component and `?raw` demo imports are real but secondary:

| removed | entry raw | Δ |
|---|---|---|
| baseline | 10,964,114 | — |
| the `packages/**` + `apps/draw/**` glob | 1,981,401 | **−8,982,713** |
| the `./demos/**` glob | 1,862,873 | −118,528 |
| 54 explicit `?raw` demo imports | 1,539,787 | −323,086 |
| `virtual:changelogs` | ~1,335,000 | −204,440 |
| + `React.lazy` on 51 demos | **338,244** | −993,000 |

`React.lazy` **alone**, glob left in place, buys only −9.1% raw / −11.3% gzip,
because top-level registry code consumes the source strings and keeps them eager.
**Do the glob first or the rest is capped.**

Load timing, gzip-served, 40 ms RTT:

| | baseline | fully fixed |
|---|---|---|
| transfer / requests | 3,122,975 B / 6 | 592,951 B / 13 |
| FCP localhost | 1,034 ms | 223 ms |
| FCP 5 Mbps | **5,333 ms** | **1,278 ms** |
| DCL localhost | 840 ms | 67 ms |

Dev server: 2,762 responses / 25.74 MB baseline → 554 / 9.10 MB fixed. 68% of
baseline requests exist only to ship source text to a syntax-highlighted panel.

**Tree-shaking is exonerated.** A single-symbol build
(`import { createInsertOp }`) is 1.04 kB; barrel and deep-path imports of
`SceneCanvas` agree within 0.04%. `SceneCanvas` genuinely costs ~596 kB because
it pulls the renderer, dispatcher and tools. Do not spend time there.

## The fix

**First, scope the glob at `registry.ts:696`.** Drop `'../draw/src/**'` and
`'../../packages/**'` outright and fetch extras source over HTTP when the panel
opens; at minimum exclude `**/*.{test,spec}.*` and make it non-eager, since
`eager: false` yields per-file `import()` thunks and moves the whole payload out
of the entry chunk. This alone is ~2.17 MB gzipped and ~3.2 s of warm dev FCP.

Then split the registry along the line of what the navigation actually needs.

The nav needs only **metadata** — `id`, `title`, `category`, `description`,
`hint`, `path`, `links`. That is small, and it must stay eager: `CATEGORIES` and
`DEMOS_BY_ID` derive from it, and the demo list has to render before anything is
chosen.

The nav does not need the **payload** — `Component` and `full` (the raw source).
Both should load on demand for the selected demo only:

- `Component` via `React.lazy(() => import('./demos/FooDemo'))`, rendered inside
  a `<Suspense>` with a placeholder sized to the canvas so the layout does not
  jump.
- `full` via a dynamic `import('./demos/FooDemo.tsx?raw')`, fetched when the
  source panel is actually opened rather than when the demo mounts. Most visits
  never open it.

Keep both keyed off the same demo id so a single entry declares its own loaders.

## Also worth taking, measured

- **`prism-react-renderer`** (`apps/site/WeaselDemos.tsx:2`) — 96 KB raw / ~34 KB
  gz in the entry chunk for a source panel not visible at first paint. Lazy it.
- **`virtual:changelogs`** (`scripts/vite-changelogs.ts`, used by `Releases.tsx`)
  — 204 KB raw / 68 KB gz, eager, for a view nobody lands on.
- **The font blocks paint.** `apps/site/main.tsx` does a module-level
  `await registerFont(...)`; `inter.png` starts at t=839 ms when DCL is 840 ms
  (t=4,872 ms at 5 Mbps). Preload in `index.html` or start the fetch before the
  await. Worth 110–300 ms.
- **The logo is 181,607 B for a 449×496 PNG**, fetched on first paint. Recompress
  for ~150 KB.

## Traps

- **`autoExtras()` walks the raw source** to find relative imports and attach
  companion files as extra source tabs. It currently runs at module load over
  every demo's already-present source. Once source is lazy, this has to run
  lazily too, for one demo at a time — and `findRawFor` needs a lazy equivalent.
  This is the part most likely to be done wrong.
- **`virtual:demo-timestamps`** populates `created`/`lastModified`. Check it does
  not force the eager graph back in.
- The registry is a single large file that several other work streams touch.
  Expect conflicts; land this in one focused change rather than piecemeal.

## What good looks like

First load fetches the nav metadata plus one demo. Opening a second demo fetches
only that demo. Opening the source panel fetches only that demo's source. Measure
before and after — total JS bytes and request count on first paint — and put the
numbers in `docs/TODO.md` with the entry this closes.

## Not in scope

WeaselDraw's load cost is a separate investigation with different causes (fonts,
startup work rather than bytes). Do not conflate them.
