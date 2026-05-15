# Scene trivial-case shorthand for `useScene`

**Status:** draft, awaiting review.
**Scope:** Make `useScene` ergonomic enough to subsume the
`items` / `setItems` / `toPose` / `fromPose` / `createDefault` /
`poseBounds` / `intersectsRect` shorthand on `<Canvas>`. After this lands,
those props can be deprecated and then deleted; the only Scene-less path
that survives on `<Canvas>` is the explicit `adapter` prop.

## Goal

Today there are three tiers of state ergonomics:

1. Inline `<Canvas items={…} setItems={…} />` — cheapest for a flat list of
   rects; trades away parenting, layers, history, custom ops.
2. Explicit `adapter` — full control, full boilerplate.
3. `useScene` + `<SceneCanvas>` — kit-owned scene primitive with layers,
   parenting, undo/redo, registered ops.

The trivial case ("a flat list of rects, no layers, no parenting") costs
*more* boilerplate via tier 3 than tier 1, which is the whole reason tier 1
still exists. ResizeDemo today:

```tsx
const [rects, setRects] = useState<Rect[]>([INITIAL]);

return (
  <Canvas
    width={W} height={H}
    items={rects} setItems={setRects}
    selectionOptions={{ initial: [INITIAL.id] }}
    layers={{ scene: { drawOne: (cx, r, p) => { /* … */ } } }}
  />
);
```

The same demo via current `useScene` has to declare `systemLayers`, wrap
each item in an `AddNodeSpec` with `kind: 'leaf'`, name a layer, and
either know or invent a `Pose` type that's distinct from the item itself.
That's the gap to close.

## Existing surface

From `src/core/scene/types.ts`, `scene.ts`, `useScene.ts`,
`SceneCanvas.tsx`:

- `useScene<TData, TLayer extends string, TPose>({ systemLayers, initial,
  ops?, historyLimit?, generateId? })` — `systemLayers` is **required and
  non-empty** (Scene throws otherwise). `initial` is an array of
  `AddNodeSpec` (each needs `kind`, `layer`, `pose`, `data`, optional
  `parent`/`index`/`id`).
- The Scene generic shape is `Scene<TData, TLayer, TPose>`. `TPose`
  defaults to `RectPose` at the type level.
- `<SceneCanvas scene={scene}>` synthesizes a Move/Resize/Rotate adapter
  via `sceneToAdapter`, wires `gestures.undoRedo` to the scene, and omits
  the `adapter` / `items` / `setItems` / `toPose` / `fromPose` /
  `createDefault` / `poseBounds` / `intersectsRect` props from its public
  surface.
- `Canvas`'s scene-slot `drawOne` is called with `(cx, object, pose)` —
  for `<SceneCanvas>` the `object` is a `Node<TData, TLayer, TPose>`, not
  a raw item. That's the user-visible difference between tier 1 and tier 3
  draw callbacks today.

What's awkward for "just a list of rects":

1. You must invent a layer id and pass `systemLayers: [{ id: 'main' }]`
   even though there's only one.
2. You must split each item into `{ kind, layer, pose, data }` even though
   pose === data === the item itself.
3. The render callback receives `Node<TData,…>` so you have to reach
   through `node.data` everywhere instead of using the item directly.
4. Item ids have to be branded (`as never` or `asNodeId`) to satisfy the
   `AddNodeSpec.id` type.

## Proposed shorthand

Add an overload (not a separate hook — the return type is the same
`Scene` and consumers should be able to grow into the full surface
without renaming the call):

```ts
// New overload
export function useScene<TItem extends { id: string }>(
  options: { items: readonly TItem[] }
): Scene<TItem, 'default', TItem>;

// Existing overload preserved
export function useScene<TData, TLayer extends string, TPose = RectPose>(
  options: UseSceneOptions<TData, TLayer, TPose>
): Scene<TData, TLayer, TPose>;
```

Behavior of the trivial overload:

- `TLayer` is fixed to the literal `'default'`. A single system layer
  named `'default'` is registered automatically. The name is reserved on
  this path; callers who want a different layer name use the full form.
- `TPose` defaults to `TItem` (matches the `<Canvas>` generic-default
  change in `66a2562` — the item *is* its pose).
- `TData` defaults to `TItem` — the full item is stored on `node.data`.
  This means `node.pose === node.data` at all times on this path. Cheap,
  and it keeps `drawOne(cx, node, pose)` consumers unsurprising
  (`node.data.color` works; so does `pose.color` if you want).
- Each item is added as a leaf, on layer `'default'`, with `id =
  asNodeId(item.id)`. Insertion order = render order.
- The returned object is a normal `Scene<TItem, 'default', TItem>`.
  `scene.add` / `scene.batch` / `scene.recordOp` / `scene.undo` etc. all
  work; consumers who outgrow the shorthand can mutate via the Scene API
  without rewriting the construction site.

No `setItems` escape hatch. Mutation goes through `scene.add` /
`scene.remove` / `scene.setPose` (auto-undoable). If a consumer truly
needs imperative bulk replacement, they can `scene.batch('reset', () =>
{ for (const id of […scene.nodes.keys()]) scene.remove(id); for (const it
of next) scene.add({ kind: 'leaf', layer: 'default', pose: it, data: it,
id: asNodeId(it.id) }); })` — but that's a deliberate departure from the
shorthand contract, not a built-in.

### Discriminating the overloads

The overload picks the trivial form when the options object has `items`
and lacks `systemLayers`. Implementation: runtime checks
`'systemLayers' in options` first; if not present, falls into the trivial
construction. TypeScript picks the trivial overload because its options
type is structurally narrower.

## `<SceneCanvas>` defaults to match

`<SceneCanvas>` already takes only `scene` (no items props). The
shorthand path Just Works through the existing wrapper — but the
`drawOne` signature still receives `Node<TItem, 'default', TItem>`, not
`TItem`. Two choices:

- **(a)** Leave `drawOne` as-is. Trivial-path consumers write
  `drawOne: (cx, node, pose) => { /* use node.data or pose */ }`.
- **(b)** Add a `<SceneCanvas>` flag (or a sibling `<FlatSceneCanvas>`)
  that unwraps `node.data` before calling `drawOne`, so the signature
  matches the tier-1 callback exactly.

Recommend **(a)** for v1: `pose` already equals the item, so the only
ergonomic difference is the type of the `node` arg, which most demos
ignore anyway. We can revisit (b) if real porting friction shows up in
phase 3.

### ResizeDemo, before and after

Before (tier 1):

```tsx
const [rects, setRects] = useState<Rect[]>([INITIAL]);

<Canvas
  width={W} height={H}
  items={rects} setItems={setRects}
  selectionOptions={{ initial: [INITIAL.id] }}
  layers={{
    scene: { drawOne: (cx, r, p) => { cx.fillStyle = r.color;
                                       cx.fillRect(p.x, p.y, p.width, p.height); } },
    selectionOverlay: { handles: { size: HANDLE } },
  }}
/>
```

After (shorthand):

```tsx
const scene = useScene({ items: [INITIAL] });

<SceneCanvas
  width={W} height={H}
  scene={scene}
  selectionOptions={{ initial: [INITIAL.id] }}
  layers={{
    scene: { drawOne: (cx, _node, p) => { cx.fillStyle = p.color;
                                          cx.fillRect(p.x, p.y, p.width, p.height); } },
    selectionOverlay: { handles: { size: HANDLE } },
  }}
/>
```

Trade: lose the `setRects` reference, gain auto-undoable mutation, layer
visibility, and a Scene the consumer can grow into. The demo's visible
behavior is unchanged.

## Migration plan

1. Land the shorthand and the test suite (phase 2).
2. Port every demo currently on the inline-items path to the shorthand
   (phase 3). Skip `SceneDemo` (already on Scene) and `NestingDemo`
   (custom adapter; comment in the file flags it as an escape hatch).
3. Mark `items`, `setItems`, `toPose`, `fromPose`, `createDefault`,
   `poseBounds`, `intersectsRect` as deprecated on `<Canvas>` —
   `@deprecated` JSDoc, no runtime warning yet (breaking changes are
   cheap at this stage; we don't need a deprecation cycle, but the
   marker helps anyone reading the type).
4. In a follow-up commit, delete those props and the
   `useArrayAdapter`-on-Canvas wiring path in `Canvas.tsx`. `<Canvas>`
   keeps the explicit `adapter` path for non-Scene consumers (e.g. the
   `NestingDemo` custom adapter pattern).
5. `useArrayAdapter` itself can stay — it's still useful for non-Canvas
   contexts and for the SceneCanvas-doesn't-fit cases. Or delete it; the
   call doesn't have to be made in this proposal.

## Open questions

- **Trivial-path layer name.** Picked `'default'` as a reserved literal.
  Anonymous (empty string) felt worse — empty strings are awkward in
  error messages and devtools. Alternative: namespace it `'__default__'`
  to make collisions even less likely. Calling for `'default'` unless
  someone sees a problem.
- **`drawOne` signature on the trivial path.** See "**(a)** vs **(b)**"
  above. Default to (a); revisit if porting hurts.
- **Container layout.** Trivial path is leaves-only. Containers go
  through the full `useScene` form. This is fine and consistent with
  "trivial = flat list of rects." No special handling needed; the
  shorthand simply doesn't expose `kind: 'container'`.
- **`TData === TItem` vs `TData === void`.** Storing the whole item under
  `data` is redundant when `pose === item`, but it keeps the consumer
  ergonomic ("look at `node.data` if you want the original item"). The
  alternative — `data: undefined` — saves a pointer per node and forces
  consumers to reach through `pose`. Recommend `data === item` for v1
  because it's the path of least surprise; we can add `{ items, dataless:
  true }` later if memory pressure ever shows up.
- **Should this be a separate hook (`useFlatScene`)?** No. Same return
  type, same mental model, same name. Overload keeps the API surface
  small.
- **Initial selection.** `<Canvas selectionOptions={{ initial: [...] }}>`
  still works through `<SceneCanvas>`. Nothing to add here.
- **Pose mutation feedback loop.** When the user drags a node, the Scene
  updates `node.pose` in place via `scene.setPose`. Because the shorthand
  stores `data === item === pose` by *reference* on construction, an
  external observer holding the original `INITIAL` object would see it
  mutate. This matches today's tier-1 behavior (the item's pose fields
  get mutated in place via `setItems`). Documenting it; not changing it.
