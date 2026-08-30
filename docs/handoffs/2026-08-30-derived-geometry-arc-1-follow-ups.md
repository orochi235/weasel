# Derived geometry: both arc-1 P1s are closed

For whoever picks up the diagram plugin. Arc 1 (derived path) shipped with two known holes; both
are now closed, so the next arc is unblocked. The changesets and `docs/TODO.md` say what landed —
this carries the branch state, the decision that isn't in the code, and the traps.

## Where the work is

Branch **`derived-picking`**, worktree `.claude/worktrees/derived-picking`. Everything is
committed; **nothing is pushed to the remote** — that needs Mike's explicit OK.

`main` was fast-forwarded to the picking commit (`bb27e834`) but not to the drag work that
followed it. Note `main` is not checked out anywhere — the primary checkout sits on
`ci/perf-on-self-hosted-gpu` — so moving `main` disturbs no working tree.

## The decision that isn't in the code

The live-drag hole had two candidate fixes and Mike chose the second:

- **(A)** dependents join `previewIds` and ghost alongside the dragged node
- **(B)** the built-in actions publish their in-flight poses to the scene's pose overrides

**B**, because A makes correctness depend on every future gesture author remembering to enumerate
dependents — the same enumerate-the-triggers approach whose misses the arc's own reviews caught
three times. B makes the scene the single answer to "where is this node right now", so derived
geometry and picking follow by construction.

`clone` was deliberately left alone: its previews are new ghosts at the drag target and the
originals never move, so nothing derives from a changed pose.

## Traps

**A hand-written `Scene` stand-in must carry `overrides`.** The actions now read it on every
gesture frame. It was always required by the `Scene` contract, but partial fakes omitted it and
threw — six test stubs had to grow one (they use the real `createPoseOverrides`, not a fake).
Nothing outside tests was affected; `apps/draw`'s cast at `App.tsx:1882` widens a real
`useScene` scene.

**`recomputePreviews` in `rotate.ts` has two exits.** Syncing only the early one left rotate
publishing nothing, and every existing test still passed — the guard added in `rotate.test.ts`
("publishes an override while rotating") is what caught it. Any action wired to
`syncPreviewOverrides` needs the call on *every* path that rebuilds `previews`, and a test that
asserts `scene.overrides.ids()` is non-empty mid-gesture.

**Drop the overrides after the commit ops land, not before.** Dropping first leaves a window in
which the scene answers with the pre-gesture pose.

**`findShapeSilhouette` skips its memo only for a non-null derived path.** A scene-backed source
answers `null` for every ordinary node; treating that as a reason to bypass retires the memo
scene-wide on every pointer move. There is a guard test for this in `derivedPath.test.ts`.

## Verified in a browser, not just jsdom

Both behaviors were confirmed against the running dev server with a real pointer
drag, screenshotting with the button still down: the box moves, and the black
connector tracks it mid-gesture rather than jumping at the drop.

Two things that cost time and will cost it again:

**`useScene` seeds `initial` once, and HMR keeps the old scene.** Editing a
demo's node data and saving leaves the *previous* nodes live, so the canvas
paints stale data with no error. A hard reload is the only way to trust a
before/after. This is the dev-server-staleness trap in a new place.

**A derived edge is now pickable, which changes what a click hits.** The
connector's silhouette is the line, and it renders above its endpoints, so
clicking a box *at its centre* — where the line starts — selects the edge, not
the box. The edge's pose is a zero-sized placeholder, so dragging it looks like
nothing happening at all, save for a few stray pixels of its selection outline.
That is correct behavior and a genuinely confusing first encounter. Grab a box
away from the line.

## A demo is still wanted

I wrote `DerivedGeometryDemo` (two boxes, a connector deriving the segment
between their centres, no `drawOne` so the built-in `kit:derived` painter runs)
and **reverted it** — a drag on a box also raised a marquee, which is not the
standard a reference implementation is held to, and I could not isolate the
tool-binding cause before running out of room. Worth redoing: the substance
worked, and the demo is arc 7 of the plugin spec anyway.

Two findings from that attempt, both non-obvious:

- **Supplying `layers.scene.drawOne` replaces the built-in painter dispatch**,
  so a derived node silently never paints. A demo of this seam must omit
  `drawOne` and let `defaultDrawOne` run.
- Compare against `MoveSnapDemo`, which drags a node cleanly. It passes
  `selectTool={{ move: { behaviors } }}` and a `selectionOverlay` layer; the
  marquee appeared with `selectTool={{}}`.

## What is next

The connect gesture (arc 5) and `packages/diagram` (arc 3) are now unblocked. **Arc 2 — stroke
markers — is independent of both and needs no decision**: arrowheads do not exist anywhere in the
repo, `packages/svg/src/parse.ts` already enumerates the presentation-attribute group they belong
to, and the design is spelled out under "Core change 2" in
`docs/superpowers/specs/2026-08-28-diagram-plugin-design.md`. The non-obvious part is that a
filled marker needs the stroke to stop short of the tip, which is stroke geometry, not diagram
logic.

Two smaller things are left in `docs/TODO.md` under *Derived geometry follow-ups*: the preview
channel still carries pose twice (P3, with a real decision in it about whether `PoseOverride`
grows a `data` field), and a derived node is still unpickable through a bare adapter (P3).
