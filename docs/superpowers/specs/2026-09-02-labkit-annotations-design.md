# Annotations: drawing on a lab surface

**Five arcs, two of them in `core` and independently useful. Arcs 1, 3, 4 and 5
are built and closed; arc 2 is spiked.**

For whoever picks up arc 2, or changes the annotations API arc 5 exercised. It
assumes you know weasel's renderer and `SceneCanvas` and labkit's
instrument/capability model, and nothing about the conversation that produced
this.

**The question this answers:** a lab renders something; you want to draw on top
of it — mark a missing edge, circle a defect, write a note — keep those marks as
queryable data, and export the render with the marks on it. What has to exist
for that, and in what order.

## Shape

A labkit instrument declares an `annotations` capability naming *regions that
accept marks*. Marks are weasel scene nodes, edited by weasel tools. labkit owns
a store over that scene which the host queries; what a mark *means* stays the
host's.

The first consumer is brick-icons' part inspector (`~/src/brick-icons/lab`),
which today hand-rolls all of this as a rect-only `MarkLayer` over inline-SVG
panes.

## Three decisions, and what they rule out

**The marks are a weasel scene, not an SVG overlay.** An SVG overlay with
geometry as path `d` is cheaper, needs no camera sync and no GL context, and
composites into an SVG artifact natively — it is the obvious answer and will be
re-proposed. It was declined because annotating means coming back later to grab
a mark and nudge it, and selection, handles, marquee and nudge are an editor
you would then write by hand.

**labkit owns the shared surface; weasel renders into it.** Core's
`<CanvasView>` already does "one GL context, N interactive views" and could host
the panes with no core change. It was declined because it inverts ownership —
weasel's view registry would become the surface system, sitting beside labkit's
`useTiledSurface`, which already exists for exactly this. Arcs 1 and 2 close a
real engine gap instead.

**The scene is the truth, and the store is a facade over it.** The alternative —
a typed store as truth, with the scene derived — reintroduces an op→store sync
layer, which is the seam a weasel-backed design exists to delete. Consequences:
`title` / `status` / `tags` / `meta` / `seen` live in node `data`, persistence
serializes the scene, and **weasel history is the undo authority**, with
labkit's `undo` capability delegating rather than snapshotting alongside.

## Arc 1 — `WeaselRenderer` targets a rect

`WeaselRenderer` accepts a caller-owned `gl` today, but its viewport is set
privately at construction and `render()` never touches it
(`packages/core/src/renderer/WeaselRenderer.ts`). Drawing into part of a buffer
therefore works only by accident. Make it API:

- A public target rect applied inside `render()` — viewport, scissor,
  `SCISSOR_TEST`.
- A clear policy. `render()` currently clears colour and stencil over the whole
  buffer; a caller owning the gutters needs to suppress or confine that.
- Per-`render()` re-establishment of blend / depth / cull / clear colour. These
  are constructor-only, so any co-tenant on the context corrupts weasel's
  frames.
- Fail loudly when an injected `gl` has no stencil buffer. Bits 0–7 are
  load-bearing for every clip and even-odd fill (`renderer/draw.ts`, bit split
  documented there) and nothing checks `getContextAttributes().stencil` today.

**All four are built.** `setTarget({ origin, clear })` applies viewport and
scissor inside `render()`; the frame clear is scissored and can be suppressed;
blend / depth / cull / clear-colour are re-applied per frame; and the constructor
throws on a context whose attributes report no stencil. The rect's *size* is the
renderer's own `width`/`height` rather than part of the target, so `resize()`
stays the one source of it. Unit tests in
`packages/core/src/renderer/WeaselRenderer.target.test.ts`, real-GL guards in
`tests/visual/tiled-surface.spec.ts`.

**Costed, and it does not force a decision** (`tests/perf/tiled-surface.spec.ts`).
Two renderers on one context cost **12 GL buffers and 74KB at warm-up** — six
buffers and ~37KB each — and **nothing extra per frame**: a drag's uploads are
transient stroke and preview geometry, freed each frame by the content, not by
the renderer count. So N renderers buy N copies of the *cache* and no per-frame
penalty. One retargeted renderer would hold the union in a single cache, which
is strictly less memory where panes draw the same shapes and a wash where they
do not. At this scale the difference is too small to choose on; revisit if a lab
puts many panes of heavy text on one surface, where the glyph atlas — not the
mesh cache — is what duplicates.

Standalone value: tiled and multi-view compositing want this whether or not
annotations ship.

## Arc 2 — paint target and input target come apart

`<Canvas>` creates its own canvas element and its own context with no injection
point, and the tools / actions / preview / chrome assembly lives inside
`SceneCanvas.tsx`. Factoring that assembly out is the expensive path. Do the
cheap one instead: give `<Canvas>` two props where it assumes one element —

- *where I paint*: an external canvas plus a rect on it;
- *where I take input from*: an element.

N `SceneCanvas`es then paint into labkit's one shared surface while each takes
input from its own transparent box over its pane, which also avoids N
dispatchers colliding on one shared element. `useGestureDispatcher` already
takes a caller-supplied `clientToWorld` and uses its ref only for
`addEventListener`, cursor and one `getBoundingClientRect`, so widening it to
`HTMLElement` is a type change.

**The split holds — spiked 2026-09-02; the page became the `tiled-surface` demo
(`apps/site/demos/TiledSurfaceDemo.tsx`), and the `paintInto` / `inputElement`
props on `<Canvas>` are still the spike's, awaiting this arc.** Two `SceneCanvas`es painted into
one canvas at two rects on two cameras, each taking input from its own box.
Drags landed at exactly the right world coordinates in both panes, and the
selection handles, the drag ghost and the marquee all landed on the mark in the
2× pane sitting 420px into the shared buffer. Nothing in the preview or chrome
path measures the canvas it paints into: every DOM measurement in `Canvas.tsx`
and `SceneCanvas.tsx` is either an input listener or a client→world conversion,
and both follow the input element.

Two things the spike found:

- **Each pane needs its own `<WeaselProvider isolate>`.** A shared
  `<ActionsProvider>` lets only the newest canvas under it respond to input, and
  the rest go dead — the kit warns in the console when it happens. The collision
  is at the provider, so giving each pane its own input element does not prevent
  it.
- **`WeaselRenderer` gets `gl` alone here, never `canvas`.** Handed the element
  it sizes it, so every co-tenant would resize the shared surface to its own
  pane.

The `<CanvasView>` fallback (arc 3 over a weasel-owned surface, which would have
meant ratifying an `@experimental` component public) is no longer needed.

## Arc 3 — the labkit `annotations` capability

**Built and closed, in four passes: the declaration and the store (3a/3b), the
overlay and the palette bridge (3c), then persistence, undo and meaning (3d).**
Five things below were decided differently in the building, each for a reason
the design could not see:

- **One scene per target, not one scene with a `target` field.** A pane's
  hit-test, marquee and paint all walk the whole scene they are handed and take
  no filter, so a shared scene puts every other pane's marks under the pointer
  and paints them twice. An annotation's id is `<target>/<node>`, because a
  node id is only unique inside one scene.
- **A target with no `view` gets a fit, not the identity.** World is the
  content box in CSS pixels; the pane is whatever size the layout gave it. At
  zoom 1 a mark drawn on a scaled-down pane lands outside it.
- **The mark kind comes from the labkit tool id, not the weasel insert.**
  `arrow` and `stroke` ride `line` and `pencil`, which cannot tell them apart.
- **`subscribe(fn)` takes no change payload.** `Scene.subscribe` is a bare
  invalidation, so a delta would have to be synthesized by diffing snapshots on
  every mutation — a cost every consumer pays for information most do not use.
- **Marks get a trial slot of their own, not `record.state`.** That slot is the
  *instrument's* state, typed `TS`; labkit writing its own payload into it
  corrupts a shape the instrument owns. `TrialRecord.annotations` is additive
  and optional, so a document from before the arc lacks it and needs no
  migration. An instrument may declare `annotations.storage` and keep its marks
  itself, which is what lets a consumer hold them in a format it already owns.

Undo is routed, not reimplemented: each target's scene owns its own stack, and
`MarkHistory` keeps the order changes arrived in so "take back the last thing I
did" crosses panes. It reads each scene's `historyIndex()` rather than its
subscribe callback — a scene notifies on ephemeral changes that are not
history, and a pane's own Cmd+Z has to *move* the ordering rather than append
to it. Undo history itself is not persisted; `Scene.serializeHistory()` exists,
but a reload restoring an undo stack over marks is a separate decision.

A new optional field on `Instrument`, wired in `Trial.tsx` and
`chrome/builtins.tsx` — capabilities are hardcoded fields, not a registry, so
there is no way to add one from outside labkit. Two more files read capability
fields and may need touching: `TrialChrome.tsx` (merges `instrument.chrome`,
and keys a layout class off `instrument.canvas`) and `trialOps.ts` (seeds a
reset view off `instrument.canvas?.initialView`).

```ts
annotations: {
  targets: (state, config) => [
    { id: 'pane:naive',
      ref: naiveRef,                    // element the overlay tracks
      content: { w: 256, h: 170 },      // intrinsic size, for frac↔world
      view: camera,                     // the pane's camera, mirrored
      positionDependsOn: ['angle', 'shading', 'shade_style'] },
  ],
  meaning: { statuses: [/* … */] },     // optional
}
```

`positionDependsOn` names the config keys whose change means a stored position
no longer refers to the same picture. labkit snapshots their values onto each
mark and can then answer `isStale(mark, config)` without knowing what any of
them mean. It is what lets brick-icons delete `identity.ts` rather than keep it.

Scene world is the target's content box in CSS pixels at zoom 1, so stroke
widths stay in sane units and the camera is a plain scale. Normalization to
fractions happens only at persist time — the form brick-icons already stores,
so its marks migrate rather than convert.

```ts
interface AnnotationsApi {
  get(id): Annotation | undefined;
  query(q: { target?; kind?; status?; tags?; where?: (a) => boolean }): Annotation[];
  hitTest(target: string, pt: FracPoint, tol?: number): Annotation[];
  within(target: string, box: FracRect): Annotation[];
  isStale(a: Annotation, config: unknown): boolean;
  subscribe(fn: (change) => void): () => void;

  add(init): string;
  update(id, patch): void;
  setMeta(id, meta: unknown): void;
  remove(id): void;
}
```

Reached through a hook, not through chrome context — `TrialChromeContext`
carries no instrument state, so a sidebar panel listing marks pulls the API
itself the way `useTrialState()` does.

Tools: freehand stroke, line, arrow, rect, ellipse, text, select. Declared as
weasel `ToolDef`s with bindings, per the reference implementations named in
`CLAUDE.md` — a declarative shell, with the dispatcher owning the gesture and an
insert action minting the node. Not a tool running its own `useDragRect` and
committing a batch.

Storage defaults to `TrialRecord.annotations` (see the deviation above), written
on a trailing debounce and flushed on unmount. Two
constraints come with it. `Instrument.serialize` / `deserialize` never run —
`registerSerializers` has no callers, so state is `JSON.stringify`d raw — which
means whatever annotations write there must be JSON-safe; `scene.toJSON()`
output is, a live `Scene` is not. And labkit's document migrations only reach
top-level sections, never `trials[].state`, so annotations version their own
payload. An instrument may supply an adapter instead; brick-icons keeps writing
its TOML.

## Arc 4 — capture

**Built and closed.** A target hands over its base; labkit composites the marks
over it and returns a Blob.

```ts
base?: () => CaptureSource | Promise<CaptureSource>;
type CaptureSource =
  | { kind: 'svg'; markup: string }        // preferred
  | { kind: 'image'; src: string }
  | { kind: 'canvas'; canvas: HTMLCanvasElement };
```

`capturePlan(base, format)` picks the route. An SVG base nests beside the marks
in one document — one rasterize at the end, and an SVG output format for free.
Anything else, or no base at all, stacks rasters: the base into a 2D canvas,
the marks from `renderSceneToPixels` at export scale, composited over it. Marks
are never read back off the live surface, so a capture neither depends on nor
disturbs what is on screen. Output size is the target's *content box* times the
scale, so it does not follow the size the pane happens to be on screen.

`AnnotationsApi.capture(target, opts)` resolves to `{ blob, format, width,
height, target }`; `targets()` reports what an instrument declared. The chrome
is an Export button in the toolbar opening a panel — target, PNG or SVG, scale,
then Download or Copy — because a mark belongs to a target and an icon button
cannot ask which one.

Five things were decided differently in the building:

- **The target's field is `base`, not `capture`.** Naming both the hand-over
  and the API that returns a Blob `capture` makes every sentence about either
  ambiguous. It sits on `AnnotationTargetInfo` rather than `AnnotationTarget`,
  because the store is what calls it — `ref` and `view` are the React-shaped
  half only the overlay reads.
- **`@weasel-js/svg` is an ordinary dependency, inlined.** This was the Open
  question and it was not a real fork: labkit's tsup declares
  `noExternal: [/^@weasel-js\//]`, and `@weasel-js/ui` already depends on svg,
  so it was already inlined into labkit's dist. Declaring it changes nothing
  that ships.
- **`onCapture` notifies; it does not intercept.** A hook that can suppress
  labkit's own download needs a return protocol nobody can see from the call
  site. A host wanting its own flow calls `capture()` from its own UI — the
  same surface the chrome uses.
- **SVG copies as text.** `ClipboardItem` takes `image/png` unprefixed;
  `image/svg+xml` needs Chromium's `web ` prefix and nothing else reads it.
- **Marks reach SVG through their own draw commands.** `markSvgNodes` maps over
  what `markCommands` produced rather than switching over the mark kinds again,
  and drops the marker reference on the way — an arrow's head is already its
  own path command, and keeping the reference makes the serializer emit a
  `<marker>` def that draws it twice.

Two things the arc found that are not about capture:

- **A React Aria overlay inside a lab renders unthemed.** It portals to
  `document.body`, outside the element labkit paints its tokens onto, where
  `--wzl-surface` resolves to the empty string. The export panel passes the lab
  root as its portal container; nothing else in labkit does yet.
- **The consumer smoke test's package list was hand-kept and had drifted.**
  `loupe` and `bidi` were missing, so nothing packed them and the audit blamed
  their importers. It reads the directory now.

## Arc 5 — brick-icons migrates

**Built.** `MarkLayer`, `defects/geometry.ts` and the staleness half of
`defects/identity.ts` are gone; `slug` / `defectId` stayed, which is the
acceptance test this section set and it held. A defect can now be a line rather
than a box drawn roughly where the line should be.

The lab keeps its Python server as the record of truth and *projects* into the
store, rather than declaring `annotations.storage`. That was not preference:
`SerializedAnnotations` is opaque serialized scenes, so a server storing it goes
blind to its own defects — no filtering by part, no cross-part list, no
reporting — and `AnnotationStorage.load` is synchronous while every real backend
is not. Any consumer with a server behind it will land here too.

Five things the arc found. The first four are the API's, and the fifth is the
one that cost real time.

- **`targets(state, config)` cannot say which trial is asking.** The capability
  is declared once per instrument; `targets` runs once per trial. A consumer
  needing per-trial DOM refs has to smuggle a trial key through its own
  instrument state and key a registry by it. Getting this wrong is invisible
  with one trial open and silently catastrophic with two: each trial's overlay
  measured the other's panes, one overlay covered 666×1326 of the workspace
  instead of its 476×639 pane, and it swallowed clicks on the neighbouring
  trial's tool rail. Every unit test stayed green.
- **`targets` cannot reach the trial view either.** The camera lives on the
  trial, not in `state`, so it rides in a ref the render keeps current. A target
  that omits `view` gets a fit rather than failing, so the mistake shows up only
  as marks that do not track pan and zoom.
- **`subscribe` carries no delta**, so a consumer diffs snapshots to notice a new
  or moved mark. Its doc comment also claimed it fires "after every mutation" —
  it has always fired on selection changes too, because `scene.setSelection`
  notifies. Corrected in the source.
- **There was no way to learn what the user selected.** `hitTest` and `within`
  are read-only probes and the overlay owns pointer input, so a host could draw
  marks and never find out which one was clicked — a detail panel was
  unbuildable. `selection()` / `setSelection()` close it. Selection turned out to
  be scene state already, so the store fans across the scenes it holds; no
  registration handshake and no React in the store.
- **A stored fraction is a fraction of the measured pane box, not the render
  box.** Both `geometry.ts`'s docstring and the server's TOML header said render
  box. Believing them and passing `render_px` as a target's `content` moves every
  previously filed mark — 75px horizontally and 150px vertically on a 1200×600
  pane. Nothing errors. Both comments are now fixed.

Still open: the overlay leaves `selectionMode` at `single` and each canvas clears
only its own scene, so a selection can stand in two targets at once.

## Testing traps

jsdom cannot see most of this, and a test that cannot fail is worse than none.

- Arc 1's guard tests need real GL, so they belong in `tests/visual` under
  Playwright (`tests/visual/tiled-surface.spec.ts`). The load-bearing one is the
  frame **clear**, not the stencil: `gl.clear` ignores the viewport and respects
  the scissor, so two tiles in one context with a viewport each and no scissor
  means the second pane's clear erases the first, every frame. Drop
  `gl.enable(SCISSOR_TEST)` and watch that test go red.

  The stencil leak this section used to predict — one pane's even-odd fill
  reading bits its neighbour left set — does not reproduce. Dropping
  `STENCIL_BUFFER_BIT` from the frame clear leaves all three guards green,
  because `drawPathFillStencil` narrows to `stencilMask(0x01)` and clears bit 0
  after its own fill. The frame's stencil clear is belt-and-braces, worth keeping
  for a clip abandoned mid-frame, but it is not what protects even-odd fills.

  Beware a third shape: an assertion that content stops at the pane edge passes
  with *either* the viewport or the scissor broken, since each clips drawing on
  its own. Only the clear separates them.
- Camera mirroring is a screenshot test. A mark that swims under pan is invisible
  to jsdom.
- Arc 3's store is pure and belongs in vitest: query, `hitTest`, `within`,
  `isStale`, fraction↔world, serialization round-trip. **The overlay is not**,
  and the first browser run found three defects a green jsdom suite had missed:
  every pane painting every other pane's marks, an arrow with no head, and a
  mark count that never revised itself. What jsdom did catch, once the test
  rendered under `StrictMode`, was the tile deregistering on the remount and
  never coming back — mount / unmount / mount is the shape to test registration
  under.
- Arc 4 is browser-only end to end (`tests/visual/annotations-capture.spec.ts`),
  and the trap it walked into is the shape of the pixel assertion. "The probed
  pixel is reddish" passed against a capture carrying **no marks at all**,
  because the demo's own top-left quadrant was orange enough to satisfy it. A
  colour probe has to be close to the mark's actual colour, over a base
  deliberately nowhere near it, with a second probe asserting the base is
  *unchanged* where no mark went.

  The same spec carries the repo's only viewport calibration for a drawn mark —
  `insert.spec.ts` and `shape-tools.spec.ts` both defer a scripted-drag
  insertion in their own headers. Writing it found a bug in its own demo: an
  inline `<svg>` sits on a text baseline, so the pane's box was five pixels
  taller than the picture, and a mark's fractions are fractions of the box.

## Open

Nothing. The svg peer-or-inline question closed with arc 4.
