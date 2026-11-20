Overlay sweep loses later steps, because each is diffed against a stale render (A): fixed 04885d5cf7

Key route `*` drawn as the asterisk key, and optional modifiers in the arg dropped (A): fixed 26f6fdecf2. This adds `foldKeyRoute` to `@weasel-js/gestures`, so `describeRoute` and the strip read a key arg through one function.

Overlay flags and probes go stale in the State and Frame tabs (A+B): fixed 3eeef4bae9. Both tabs now poll `get-state` every 500 ms while open.

Hover route's `held` slot not drawn (B): fixed 8514af1728

Route the grammar rejects throws during render and unmounts the panel (B): fixed 7329aa66d1. The strip falls back to the raw route text.

A dep's "Required by" leaves out tools that declare it (B): not a defect. `tool.deps` holds the deps a tool *registers* (`protocol.ts:128`, "Names of the deps it registers"), so a tool supplies the dep rather than requiring it.

CoordTable padding collapses in HTML (B): not a defect. The padding is U+2007 figure spaces, which HTML does not collapse, and the x/y separator is a single plain space.

CoordTable rows keyed by their index in the window remount every poll (B): fixed 0feaf98812. This adds `TraceRead.coordCursor`, with a minor changeset, so rows are keyed by their place in the canvas's ring.

ValueView gives an object's own `…` key and its "N more" row the same React key (B): fixed e9607c5628

RegistryBrowser leaf keys collide on ids containing `/` (B): fixed a96fa99e0a

Extra: none found. The area's other list keys are stable within each render. The changesets' titles were over the 140-character limit; b55fbc953c shortens them.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: StateView.test.tsx pass, GestureRoute.test.tsx pass, FrameView.test.tsx (new) pass, CoordTable.test.tsx (new) pass, ValueView.test.tsx pass, RegistryBrowser.test.tsx pass, DispatchView.test.tsx pass, client.test.ts pass, describeRoute.test.ts (gestures) pass, FallthroughDiagram.test.tsx pass, DevtoolsPanel.test.tsx pass
- StateView.browser.test.tsx: unrun (browser test)
- `npm run checks:gate`: "checks:gate: all 32 passed". This was the run after the changeset fix; the first run failed only `check:changesets`.
- `npm run lint -w <pkg>`: refused by this machine's hook as a suite-sized script. Neither `@weasel-js/devtools` nor `@weasel-js/gestures` has a `lint` script of its own, and the gate's root `npm run lint` (step 31/32) passed.
- Tree clean.