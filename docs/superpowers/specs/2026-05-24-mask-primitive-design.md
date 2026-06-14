# Mask Primitive

**Status: DEFERRED — on the shelf.**

This document captures a brainstorm from 2026-05-24. It is **not** an active plan and should not be lifted directly into implementation without reassessment. When the time comes to pick this up:

- Re-read the then-current state of the WebGL renderer plan (`2026-05-08-webgl-transition-plan-design.md`) and the nested-clipping work (`2026-05-10-nested-clipping-phase-2-design.md`). FBO-based effects (shadow, glow, blur, masks) were a deferred v2 cohort at the time of this writing; if any of them have landed first, the shared infrastructure assumptions here may need restating.
- Re-read the modality design (`2026-05-24-modality-design.md`). The "modality coupling" section below assumes a particular shape for the mode preset and decoration layer; verify those are still as written.
- Re-examine the position the kit has taken on **symbols / instances**. If a symbol primitive landed first, the "C — referenced node" option (rejected here in favor of "D — typed-slot container") may deserve reconsideration on grounds of mask reuse via instancing.
- Re-examine whether `OffscreenGroup` has been factored out yet (see "Co-design with the v2 FBO cohort" below). If yes, `MaskedGroup` becomes a specialization rather than owning its own offscreen-render machinery.

The shape below is internally consistent, but it's a snapshot. Treat it as a starting point for the design conversation when masks come off the shelf, not as a frozen contract.

---

## Motivation

Weasel will eventually want masks as a kit primitive. The existing scene already has `clipFromPose` (binary geometric clipping derived from a container's pose) and stencil-based nested clipping at the renderer level (up to 7 deep). Those cover the binary/coverage case well, but a general 2D kit needs:

- **Soft / alpha-masked edges** — gradient transparency, feathered shapes.
- **Arbitrary-content masks** — use an image, a text node, a gradient-filled path, or even another masked group as the mask.
- **Inverse masks** — punch a hole rather than show through one.

These don't compose into clipping. They want a separate primitive.

## Scope

In scope:

- A new container variant `MaskedGroup` with typed-slot subtrees (`mask`, `content`).
- Alpha and luminance channels; inverse flag.
- Hit-testing that respects the mask's coverage.
- Coexistence with the existing `clipFromPose` and stencil-based clipping.
- A new `mask-edit` mode in the modality preset.
- The "Make Mask" creation command (layer-list / menu).

Out of scope:

- Multi-mask stacking on a single content (use nesting).
- A general `OffscreenGroup` primitive (let it emerge when the second FBO-effect consumer arrives — likely blur).
- Blend modes, drop shadow, glow, blur — separate primitives in the same v2 FBO cohort.
- Mask reuse via non-tree edges (defer to symbol/instance design).

## Structural model

**Option D from the brainstorm: typed-slot container.** A new container variant — call it `MaskedGroup` — with two named subtree slots:

```
MaskedGroup
├── mask     (subtree — anything renderable)
└── content  (subtree — anything renderable)
```

Roles are explicit, not order-dependent. Tools see two distinct hit regions. Serialization is unambiguous. Reorder within a slot doesn't change roles. This fits weasel's already-strongly-typed scene (`Scene<TData, TLayer, TPose>`) without compromising the tree invariant.

Rejected alternatives:

- **A. Function on a container** (extend `clipFromPose`). Doesn't generalize — most interesting masks (alpha gradients, image masks, scene-subtree masks) aren't pose-derivable.
- **B. Flagged child node** (Figma's `isMask: true`, Illustrator's "topmost child"). Role-by-convention; reorder accidents. Conflates structural position with semantic role.
- **C. Referenced node** (SVG `<mask>` referenced from elsewhere). Breaks the tree invariant. Mask reuse is real but better solved by a general symbol/instance primitive.

## Container fields

```ts
interface MaskedGroup<TData, TLayer, TPose> extends ContainerNode<...> {
  kind: 'masked-group'
  channel: 'alpha' | 'luminance'  // default 'alpha'
  inverted: boolean                // default false
  mask: NodeId[]                   // children in the mask slot
  content: NodeId[]                // children in the content slot
}
```

(The slot representation as two ordered child-id lists is illustrative; the actual encoding should fit weasel's existing container-children machinery.)

## Channels

Two supported:

- **`alpha`** (default) — read the mask subtree's rendered alpha channel. Opaque pixels in the mask reveal the content; transparent pixels hide it. Modern intuitive default. Matches Photoshop layer masks, Figma masks, modern SVG `<mask>` with `mask-type="alpha"`.
- **`luminance`** — read the mask subtree's rendered grayscale (luminance), treating brightness as alpha. SVG's historical default, useful for grayscale-image masks.

No third "coverage" option. Hard-coverage clipping is the stencil-based `clipFromPose` path; using `MaskedGroup` for binary clipping is fine but wasteful unless the renderer optimizer recognizes the case (see Optimizer note).

## Inverse

A boolean `inverted` flag on the container, default `false`. When true, the channel reading is flipped (alpha ↔ 1-alpha). One uniform / one shader instruction. Common enough — "punch a hole" is a standard ask — to deserve a flag rather than inverting the mask content manually.

## Stacking

The container is **1:1** — one mask, one content. To stack masks, nest `MaskedGroup`s. Reasons:

- Preserves the tree invariant cleanly.
- Avoids a list-of-masks composition order question.
- Nesting makes order explicit and inspectable in the layer list.

## Hit-testing

- The **`mask` subtree is invisible to hit-tests by default.** It modulates appearance, not pointer events. (Becomes hit-testable inside `mask-edit` mode — see Modality coupling.)
- The **`content` subtree's hit region is clipped by the mask's coverage.** A point hits content only if (a) it hits some node in the content subtree by ordinary rules, AND (b) the mask's evaluated coverage at that point (alpha or luminance, possibly inverted) exceeds a threshold. Without (b), users would click "through" masked-out content onto things behind it, then be confused when their click does nothing visible.

The threshold for hit-testing is a separate concern from rendering, but should default to something modest (e.g., 0.05) to avoid "I can see something there but I can't click it" near the edges of feathered masks.

## Rendering

FBO-backed, conceptually:

1. Render the `mask` subtree to an offscreen target sized to the masked group's bounds (with the same DPR/MSAA settings as the main target).
2. Render the `content` subtree to a second offscreen target of the same size.
3. Composite: for each pixel, `out.rgb = content.rgb`, `out.a = content.a * channel(mask, inverted)`.
4. Blit the composite into the parent's render context at the masked group's position.

Practical constraints:

- Per-frame cost is meaningful (two offscreen targets + composite per masked group). Caching by content-version + mask-version is the obvious optimization but introduces invalidation correctness questions; not in the v1 design.
- Tile / sub-region rendering for very large masked groups is a renderer concern, not a primitive concern.
- DPR handling matches the main target.

## Coexistence with existing clipping

Both primitives stay:

- **`clipFromPose`** / stencil-based nested clipping: fast path for binary geometric clipping derived from a container's pose. No buffer cost. Max 7 deep. Unchanged.
- **`MaskedGroup`**: general FBO-backed primitive for soft/arbitrary masks.

### Optimizer note

The renderer can recognize "this `MaskedGroup` has `channel: 'alpha'`, `inverted: false`, the mask subtree is a single opaque-fill path, and the channel reading is binary at all relevant pixels" and downgrade to a stencil-clipping path. This is a render-pipeline detail, not a primitive design question, but the primitive's data shape must be **lossless** enough to *recognize* this case. The fields above are sufficient.

## Modality coupling

A new mode, `mask-edit`, joins the modality preset:

- **Kind:** soft.
- **Entry:** double-click on a `MaskedGroup`'s mask region in the layer list, or `M` key with a `MaskedGroup` selected.
- **Allows:** the same tool set as `path-edit` plus `creates-paths`, `creates-shapes`, `applies-fill`, `samples-color` — masks can be arbitrary, so almost any creation tool is eligible. New capability tag: **`edits-mask`** for the mask-subtree-aware versions of these tools (which mostly degenerate to "the same tool, but its writes target the mask subtree instead of the parent container's normal children").
- **Scoping:** yes — target `MaskedGroup`'s content subtree dims to ~30%; the mask subtree is fully visible and editable; everything outside the `MaskedGroup` dims to ~30%.
- **Tint:** TBD when picked up. Suggest a teal/aqua to differentiate from path-edit's blue.
- **Exit:** `⎋` suspend / `⌘⎋` discard, matching path-edit semantics.

Inside `mask-edit`, the `mask` subtree becomes hit-testable; the `content` subtree is rendered but non-interactive (so you can see what you're masking).

**Cross-doc obligation:** when this design comes off the shelf, update `2026-05-24-modality-design.md` to add `mask-edit` to the stock preset table and the `edits-mask` tag to the capability table.

## Creation UX

- **"Make Mask" command** (layer-list right-click, `Object > Mask > Make` menu, or a keybinding). With ≥2 selected nodes: the topmost becomes the `mask`, the rest become `content`, wrapped in a new `MaskedGroup`. Mirrors Illustrator's `Object > Clipping Mask > Make`.
- **"Release Mask"** unwraps a `MaskedGroup`: the `mask` and `content` subtrees become children of the `MaskedGroup`'s parent, with the mask placed topmost. Inverse of Make.
- Drag-into-slot in the layer list (drop a node onto the `mask` row vs. the `content` row of a `MaskedGroup`) is a later affordance.

## Co-design with the v2 FBO cohort

Drop shadow, glow, blur, and masks all share infrastructure: "render this subtree to an offscreen buffer, then composite with effect." That argues for a shared `OffscreenGroup` primitive lower in the stack, with `MaskedGroup` / `BlurGroup` / `ShadowGroup` as specializations.

**Decision:** let it emerge. Build `MaskedGroup` owning its own offscreen-render machinery directly. When the second FBO-effect consumer arrives (probably blur), factor out `OffscreenGroup` from both. Designing `OffscreenGroup` now is the wrong shape because we have only one consumer to design against.

This decision should be **revisited when masks come off the shelf**, since by then one or more of the other FBO effects may have landed first, in which case `OffscreenGroup` may already exist or be in flight, and `MaskedGroup` should slot into that infrastructure rather than duplicate it.

## File plan (sketch)

```
src/core/scene/types.ts         + MaskedGroup container variant
src/core/scene/ops/             + createMakeMaskOp, createReleaseMaskOp
src/renderer/                   + offscreen-target machinery, mask composite shader
src/canvas/sceneAdapter.ts      ~ hit-testing respects mask coverage
packages/modes/          + mask-edit mode in the default preset
                                + edits-mask capability tag
apps/weaseldraw/                + Make/Release Mask menu items + keybindings
                                + mask-edit chrome (breadcrumb, tint var)
```

## Reassessment checklist (read this first when picking up)

- [ ] Has any of the v2 FBO cohort (blur, drop shadow, glow) landed? If yes, factor out `OffscreenGroup` first.
- [ ] Has a symbol / instance primitive landed? If yes, reconsider whether mask reuse should ride on instancing rather than nesting.
- [ ] Is the modality preset and capability-tag taxonomy still as written in `2026-05-24-modality-design.md`? Update the modality doc to add `mask-edit` and `edits-mask`.
- [ ] Is the renderer still stencil-based for clipping? Verify the optimizer note's "downgrade to stencil" case is still applicable.
- [ ] Has hit-testing's kind transport changed since the Canvas/SceneCanvas seam refactor? Update the hit-testing section if so.
- [ ] Does the `clipFromPose` mechanism still exist in its current form? If it's been generalized or replaced, reconcile.
