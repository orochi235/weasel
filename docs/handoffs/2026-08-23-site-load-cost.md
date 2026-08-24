# Demo site load cost

**What this is:** a diagnosis and a fix design for why `apps/site` loads slowly.

**Who it's for:** whoever picks up the optimization. It assumes you know the repo
but nothing about this investigation.

**Branch:** the finding is structural and present on `main`. Work from a fresh
branch off `main`; do not build on `side-scroller-finish`, which is unrelated
demo work still in flight.

---

## The finding

`apps/site/registry.ts` holds **105 eager static imports** and no lazy loading
anywhere in the site — no `React.lazy`, no dynamic `import()`.

Of those, **55 are `?raw` imports**, which inline each demo file's *entire source
text* into the bundle as a string. They exist so a demo can display its own
source in a panel, which is a feature worth keeping.

The consequence is that opening any one demo downloads, parses and evaluates
every demo in the site plus the full source text of all of them. First paint
waits on roughly fifty demos' worth of code to see one.

Exact byte and request measurements are being produced separately and will be
appended here. The structure above is confirmed by reading the file and does not
depend on those numbers.

## The fix

Split the registry in two along the line of what the navigation actually needs.

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
