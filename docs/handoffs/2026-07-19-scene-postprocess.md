# Handoff: `postProcess` hook on the scene slot

## Goal

Add a `postProcess` hook to `SceneSlotConfig` so a consumer can wrap the scene
slot's emitted `DrawCommand[]` before it reaches the renderer. This is the
minimal seam that lets an app apply regional effects to scene content —
dim-outside-a-region, spotlight, desaturation via `colorMatrix`, print-preview
modes — without weasel growing any of those as features.

**Motivating consumer:** lbx-editor (sibling repo, linked via `weaselAliases()`)
wants everything outside the label's printable bounds rendered semitransparent.
With this hook it becomes a double-draw at the call site:

```ts
// lbx-editor App.tsx — target usage (do not implement in this task;
// it's the shape the API must support)
scene: {
  drawOne: drawScreenNode,
  postProcess: (cmds) =>
    cmds.length === 0 ? cmds : [
      { kind: 'group', alpha: 0.35, children: cmds },          // faded full scene
      { kind: 'group', clip: printableRectPath, children: cmds }, // crisp copy inside bounds
    ],
},
```

Design rationale (already settled — don't relitigate): a first-class
`mask: { path, outsideAlpha }` config was considered and rejected. It reads
nicer but is single-purpose, and the double-draw cost it implies should be
something the consumer writes explicitly. `postProcess` keeps weasel generic.

## The change

### 1. `SceneSlotConfig` (`src/canvas/Canvas.tsx`, ~line 110)

Add:

```ts
/**
 * Optional post-processor for the scene slot's emitted commands. Called
 * with the final world-space `DrawCommand[]` each time a scene canvas
 * layer draws (after per-node rotation wrapping and `alphaFor`); the
 * return value replaces the array handed to the renderer. When the scene
 * slot is split into per-scene-layer canvas layers (`scene:<layerId>`),
 * it runs once per layer. Identity by default.
 *
 * Commands are world-space — `drawLayers` applies the view transform
 * afterward, so e.g. a `clip` path in a wrapping group is authored in
 * world coordinates.
 */
postProcess?: (cmds: DrawCommand[], view: View, dims: Dims) => DrawCommand[];
```

`Dims` comes from `core/layers/render` — check whether it's exported through
the barrel; if not, export it (it's already a public-ish shape passed to
`RenderLayer.draw`).

### 2. `makeSceneLayer` (`src/canvas/Canvas.tsx`, ~line 526)

Both return paths of the layer's `draw` must route through the hook:

- **Hierarchical path**: the `return buildSceneTree(...)` result.
- **Flat fallback**: the accumulated `children` array.

The layer's `draw` currently ignores its `dims` argument — accept it and pass
it through. Call the hook unconditionally (even for an empty array) so
behavior is predictable; returning the input unchanged must be a perfect
no-op.

The per-scene-layer split (`makeSceneLayers`, which builds `scene:<layerId>`
canvas layers) routes through `makeSceneLayer` via its `slot` param — verify
the hook therefore applies per split layer with no extra work.

### 3. Explicit non-goals

- No hook on custom layer entries, grid, or selection overlay — scene slot only.
- The move-overlay ghost (drag preview, `ghostAlpha`) is **not** post-processed.
  A dragged ghost outside a consumer's clip region will render at ghost alpha
  regardless; that's accepted.
- Do not add a `mask`/`dimOutside` convenience on top.

## Renderer facts (verified, rely on them)

- `GroupDrawCommand` already supports `alpha`, `clip` (stencil-based), and
  `colorMatrix` (`src/renderer/DrawCommand.ts:56`). No renderer changes needed.
- Clip paths transform with the group stack: `drawGroup` pushes
  `cmd.transform` onto the state stack *before* `pushClip`, and
  `rasterizePathToStencil` renders under the current model transform
  (`src/renderer/draw.ts:245`). So world-space clip paths inside the
  world-group wrapper that `drawLayers` adds are transformed correctly.
- Every fragment-producing draw calls `applyClipTest`, so clipping applies to
  image commands too (important: consumers may rasterize text to
  `ImageBitmap`s and emit `kind: 'image'`).
- Clip nesting max is 7 (`draw.ts:252`); a postProcess wrapper consumes one
  level. Worth one sentence in the JSDoc.
- `drawLayers` (`src/core/layers/render.ts:139`) skips a layer when its draw
  returns `[]` — postProcess returning `[]` therefore cleanly hides the scene.

## Tests

Follow the existing harness patterns in `src/canvas/Canvas.test.tsx` (it
captures emitted command trees). Cover at least:

1. postProcess receives the same commands the scene would otherwise emit, and
   its return value is what reaches the renderer (wrap in a marker group and
   assert the wrapper is present, scene content nested inside).
2. Identity function → emitted commands byte-equal to the no-hook baseline.
3. Hierarchical adapter with ≥2 scene layers split into `scene:<layerId>`
   canvas layers → hook called once per layer, each with only that layer's
   commands.
4. Flat fallback path (config with `objects`) also routes through the hook.
5. A renderer-level test (see `src/renderer/draw.test.ts`) or existing
   coverage check: group `clip` stencils an `image` command. If coverage
   already exists, cite it in the PR instead of duplicating.

## Acceptance

- `tsc` and the full weasel test suite pass.
- `SceneSlotConfig.postProcess` and `Dims` reachable from `@weasel-js/core`
  public exports — no `@internal` types in the public signature
  (`src/index.barrel.test.ts` may need an entry).
- The lbx-editor snippet above typechecks against the built types (spot-check
  by hand or in the linked repo; wiring lbx-editor is a separate follow-up
  task, not part of this one).
- JSDoc as specced; if any canvas/layer docs enumerate `SceneSlotConfig`
  fields, sync them.
