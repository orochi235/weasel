# Annotations: drawing on a lab surface

**Spec. Nothing built yet.** Five arcs, two of them in `core` and independently
useful.

For whoever picks up arc 1 or arc 2. It assumes you know weasel's renderer and
`SceneCanvas` and labkit's instrument/capability model, and nothing about the
conversation that produced this.

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

Also worth costing here rather than discovering later: one renderer resized per
pane per frame, against N renderers on one context. Mesh and text caches are
per-renderer, so N renderers means N copies of every uploaded mesh and atlas on
the same context.

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

**Start with a spike, not a spec:** mount a `<Canvas>` painting into an external
canvas at a rect while taking input from a separate element, and confirm a drag
lands at the right world coordinates. If a preview or chrome layer turns out to
measure the canvas it paints into, the arc's shape changes — better to know
before planning it.

If this arc fails, arc 3 still lands on `<CanvasView>` over a weasel-owned
surface. The store does not care who owns the pixels. Note that `CanvasView` is
marked `@experimental`, so that fallback means ratifying it public first, the way
`CanvasExtensionApi` was.

## Arc 3 — the labkit `annotations` capability

A new optional field on `Instrument`, wired in `Trial.tsx` and
`chrome/builtins.tsx` — capabilities are hardcoded fields read in those two
places, not a registry, so there is no way to add one from outside labkit.

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

Storage defaults to `record.state`, which is the only persisted instrument slot
and brings the document-migration path with it. An instrument may supply an
adapter instead; brick-icons keeps writing its TOML.

## Arc 4 — capture

labkit cannot rasterize the artifact underneath — it is the consumer's DOM. So a
target hands over its base:

```ts
capture?: () => CaptureSource | Promise<CaptureSource>;
type CaptureSource =
  | { kind: 'svg'; markup: string }        // preferred
  | { kind: 'image'; src: string }
  | { kind: 'canvas'; canvas: HTMLCanvasElement };
```

A target declaring none still exports its marks on transparency, which fails
visibly rather than producing a blank brick.

With an `svg` base, marks serialize through `serializeSvg` (`@weasel-js/svg`)
and nest into the artifact's markup — one rasterize at the end, and an SVG
output format for free. Otherwise both sides rasterize and stack. Export renders
offscreen at export scale via `renderSceneToPixels` rather than reading back the
live surface, so a capture neither depends on nor disturbs what is on screen.

`capture()` returns a Blob. Where it goes is the host's: labkit ships download
and copy-to-clipboard chrome (`ClipboardItem` with `image/png`) and an
`onCapture(blob, meta)` hook.

This adds `@weasel-js/svg` to labkit's dependencies. labkit inlines `core`
(`docs/TODO.md`, "labkit inlines core"); decide whether `svg` is peered or
inlined the same way in this arc, rather than at a consumer's bundler.

## Arc 5 — brick-icons migrates

`MarkLayer`, `defects/geometry.ts` and `defects/identity.ts` come out; a defect
becomes a mark plus the lab's own meaning. Marks gain geometry richer than a
box, which is the point — a missing edge is a line, and the only shape available
today is a rectangle around roughly where the line should be.

This is the arc that proves arc 3's API. If all three files cannot be deleted,
the API is wrong somewhere.

Note that the lab consumes `@weasel-js/labkit` from npm, so arcs 1–4 must
release before it can migrate.

## Testing traps

jsdom cannot see most of this, and a test that cannot fail is worse than none.

- Arc 1's guard tests need real GL, so they belong in `tests/visual` under
  Playwright. The load-bearing one: draw two tiles into one context *without*
  clearing stencil inside each scissor and watch one pane's even-odd fill leak
  into its neighbour. Write the naive version first and confirm the test fails.
- Camera mirroring is a screenshot test. A mark that swims under pan is invisible
  to jsdom.
- Arc 3's store is pure and belongs in vitest: query, `hitTest`, `within`,
  `isStale`, fraction↔world, serialization round-trip.
- Arc 4 is browser-only end to end. Assert pixels: a mark captured at `scale: 4`
  lands on the same feature of the brick it was drawn over.

## Open

- Whether one `WeaselRenderer` resized per pane beats N renderers on one context
  (arc 1).
- Whether arc 2's split survives contact with the preview and chrome layers.
  The spike answers this.
- Whether `@weasel-js/svg` is peered or inlined in labkit (arc 4).
