# Shape rotation for Swillustrator — design

**Status:** design

**Scope:** Swillustrator's data model + Swillustrator's rotation UI + the kit's `useRotate` pivot modes. weasel-svg's transform parser/serializer gains rotation round-trip support.

## Goal

Make every shape in Swillustrator (rect, text, path) rotatable via the existing rotate handle and via a numeric input in the Selection properties panel. Multi-selection rotates around the selection's union center. Rotation round-trips losslessly through SVG via standard `transform="rotate(...)"` attributes.

## Non-goals

- **Per-shape rotation pivot.** v1 always uses the shape's AABB center.
- **Movable selection pivot indicator** (Illustrator's drag-the-pivot-crosshair UX).
- **Rotation animation / tweening.** Static end-state only.
- **Skew / shear.** Different transform; separate spec.
- **Rotation locking** ("this shape can't rotate"). Defer.
- **Relative numeric input** ("rotate by +N°"). v1 numeric input is absolute only.

## Storage model

### Pose extension

Swillustrator's `Pose` extends from `{x, y, width, height}` to `{x, y, width, height, rotation?: number}`. `rotation` is in **radians**, defaulting to 0/undefined. UI shows degrees and converts at the boundary (`degrees = radians * 180 / Math.PI`).

Each shape rotates around the center of its **unrotated** AABB (`cx = x + width/2`, `cy = y + height/2`). The pivot is fixed; no per-shape configuration.

### Path geometry

Paths (`PolygonPath` coords) stay in their original axis-aligned orientation in storage. The renderer applies rotation at draw time. This:
- Preserves the authored geometry through arbitrary rotations (no cumulative rounding drift).
- Lets the user "undo" a rotation back to exact original.
- Round-trips cleanly through SVG via element-level `transform="rotate(...)"`.

The alternative — baking the rotation into the coords on every move — was rejected because cumulative float rounding would drift coordinates over many rotations.

## Renderer

Each shape's draw command emits inside a rotation transform around its center. The kit's `WeaselRenderer` already supports nested transforms via DrawCommand groups; Swillustrator's `drawGhost` and the equivalent commit-time render paths gain a wrapper:

```ts
if (obj.rotation && obj.rotation !== 0) {
  return [{
    kind: 'transform',
    transform: rotateAround(cx, cy, obj.rotation),
    commands: [...innerCommands],
  }];
}
```

(Exact API matches the existing transform support in `WeaselRenderer`.)

## Hit testing

`pickEvery` inverse-rotates the world test point against each object's rotation around its center, then does the existing AABB test on the unrotated coords:

```ts
const cx = obj.x + obj.width / 2;
const cy = obj.y + obj.height / 2;
const r = obj.rotation ?? 0;
// Inverse-rotate the test point.
const dx = wx - cx, dy = wy - cy;
const cos = Math.cos(-r), sin = Math.sin(-r);
const lx = cx + dx * cos - dy * sin;
const ly = cy + dx * sin + dy * cos;
return lx >= obj.x && lx <= obj.x + obj.width && ly >= obj.y && ly <= obj.y + obj.height;
```

This is correct for rotated rects, text, and paths.

## Rotation gesture

### Pivot mode option on `useRotate`

`useRotate` gains a `pivot?: 'each' | 'union'` option, default `'union'`.

- **`'each'`** — each selected item rotates around its own center. Only the item's `rotation` field changes; x/y unchanged.
- **`'union'`** — each selected item rotates around the selection's union center (computed from all selected items' unrotated AABBs). Both the item's `rotation` field AND its x/y change: the item's center orbits the union center.

Single-selection produces identical results in both modes (the item's center IS the union center).

Swillustrator wires `pivot: 'union'`. Other kit consumers override via the option.

### Shift-to-snap

Holding Shift while dragging the rotate handle snaps the computed angle to 15° increments. Standard Illustrator/Figma convention. The kit reads `ctx.modifiers.shift` in the rotate hook's move handler and quantizes the angle before writing it to the pose.

## Numeric input

Swillustrator's existing `<PropertiesPanel title="Selection">` block gains a "Rotation" field showing degrees.

- **Single selection:** field shows the item's rotation (degrees, 0-decimal precision). Editing sets `rotation` on the item.
- **Multi-selection, uniform rotation:** field shows the shared value.
- **Multi-selection, mixed rotation:** field shows the first item's value with a "Multiple values" hint (mirrors existing x/y/w/h fields' mixed-state behavior). Editing sets every selected item to the typed absolute value.

Editing the field commits one undoable op (single batch).

## SVG round-trip

### Save

Every shape with non-zero rotation gets `transform="rotate(angleDegrees cx cy)"` on its `<path>` or `<text>` element, where `(cx, cy)` is the unrotated center.

```xml
<path d="M 0 0 L 100 0 L 100 50 L 0 50 Z"
      fill="#3366ff"
      transform="rotate(30 50 25)"/>
```

Third-party SVG viewers render the rotated shape correctly via standard SVG.

### Load

weasel-svg's existing transform parser is extended to surface element-level rotation. svgInterop reads the rotation off the parsed `SvgNode` and populates `Pose.rotation`.

For Swillustrator-authored files, every transform is a single `rotate(...)` so the parse is unambiguous. For third-party files with composed transforms (`translate(...) rotate(...) scale(...)`), weasel-svg's existing transform handling already flattens scale/translate onto leaf geometry; we extract the rotational component when present, otherwise drop the rotation with a parse warning.

### Identity invariant

Save → reload → save produces byte-identical output for Swillustrator-authored files (no rotation drift from float rounding through round-trip).

## Architecture

Three layers, each independently testable:

```
┌───────────────────────────────────────────────────────────────┐
│  Swillustrator App                                            │
│    - Pose has rotation                                        │
│    - PropertiesPanel rotation input                           │
│    - pickEvery does rotated hit-test                          │
│    - drawGhost / commit render wraps in rotation transform    │
│    - svgInterop encodes/decodes rotation                      │
└─────────────────────────────┬─────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│  Kit — useRotate                                              │
│    - pivot: 'each' | 'union' option                           │
│    - Shift-snap to 15° increments                             │
│    - Geometry abstraction over TPose                          │
└─────────────────────────────┬─────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│  weasel-svg                                                   │
│    - Parse element-level transform="rotate(...)"              │
│    - Emit transform="rotate(angle cx cy)"                     │
│    - Compose / decompose with existing transform helpers      │
└───────────────────────────────────────────────────────────────┘
```

## Implementation tasks (high-level)

The plan will break each into bite-sized steps.

- **T1: Pose + adapter.** Extend Swillustrator's `Pose` type with `rotation?: number`. Update `setPose` in App.tsx to store the rotation field. Tests cover round-trip through the adapter.
- **T2: Renderer.** Wrap each shape's draw command in a rotation transform around its center. Visual-regression baselines for a rotated rect, text, and polygon.
- **T3: Hit testing.** Update `pickEvery` to inverse-rotate the test point. Unit tests for points inside/outside rotated rects at 30°, 45°, 90°, 180°, -45°.
- **T4: `useRotate` pivot modes.** Add `pivot: 'each' | 'union'` option to `useRotate`. Default `'union'`. Tests cover both modes against a known multi-selection.
- **T5: `useRotate` Shift-snap.** Quantize to 15° increments when `ctx.modifiers.shift`. Test the quantization boundary cases.
- **T6: Swillustrator numeric input.** Add "Rotation" field to `<PropertiesPanel title="Selection">`. Mixed-state hint when selection has non-uniform rotation. Editing emits one batched undoable op.
- **T7: SVG round-trip — emit.** weasel-svg's serializer outputs `transform="rotate(angle cx cy)"` when a node has rotation. svgInterop translates `Pose.rotation` to the SVG side.
- **T8: SVG round-trip — parse.** weasel-svg's parser extracts rotation from element-level `transform="rotate(...)"`. Handles composed transforms (extract rotational component; warn on unsupported compositions).
- **T9: Regression sweep.** Full typecheck + tests + tsup build + manual smoke test in dev server (rotate a rect, rotate text, rotate a polygon, save, reload, verify).

## Testing strategy

Four layers:

1. **Unit tests** for the rotation math (inverse-rotate hit-test, multi-selection orbit calc, Shift-snap quantization).
2. **`useRotate` hook tests** — pivot mode behavior, gesture lifecycle.
3. **Swillustrator integration tests** — pose round-trip, properties panel field behavior, save→reload identity.
4. **Visual-regression tests** — rotated rect, text, polygon under the existing rig in `tests/visual/`.

## Acceptance criteria

- Dragging the rotate handle on any selected shape (rect / text / path) rotates it visibly.
- Multi-selection rotation orbits items around the union center.
- Holding Shift snaps to 15° increments.
- The Rotation field in the Selection panel reflects and edits the current rotation.
- Save → reload → save is byte-identical for any Swillustrator-authored file with rotated shapes.
- Saved SVG renders correctly in browsers / Inkscape / Figma (rotation visible).
- Rotated shapes can be selected by clicking inside their rotated bounds (hit-test respects rotation).
- Existing non-rotated behavior unchanged.

## Migration

No format migration: existing Swillustrator-saved SVGs have no rotation field and parse as `rotation: 0` (the default). Forward-compatible.

If a user has Swillustrator-saved files with rotation manually edited into the SVG (unlikely, but possible), those parse correctly via T8.

## Risk / open items

- **Multi-selection union pivot when items have different existing rotations.** A selection of three rects at rotations 0°, 30°, 60° rotated by 90° around the union center: each item's rotation increments by 90° AND its center orbits the union center by 90°. The math is well-defined; the spec assumes consumers can reason about it. Worth a clarifying note in the kit docs.
- **Hit-test precision near the AABB boundary** of a rotated shape: inverse-rotating brings the test point to a position that's slightly off from the exact unrotated AABB boundary due to float arithmetic. Practical impact: a handful of test points within ~0.5px of the edge could give wrong answers. Not a correctness issue for normal use; consumers wanting exact boundaries would need polygon hit-test for paths.
- **Composed SVG transforms on import.** If a third-party file has `transform="translate(10,20) rotate(30) scale(0.5)"`, the rotational component is well-defined but the result isn't necessarily equivalent to a `Pose` with just rotation (the scale and translate may not factor out cleanly). T8 should emit a parse warning when it can't decompose to a single rotation around the shape's center.
- **`useResize` × rotation interaction.** Resizing a rotated shape — does the resize handle account for the rotation? Today the resize handles render at the rotated bounds (since rotation affects bounds), so the user expects rotated-resize. v1 covers this only if the kit's `useResize` already supports rotated bounds; otherwise it's a known caveat that resize-of-rotated-shapes behaves oddly. Verify and either fix or document explicitly.

## Future work

- **Per-shape rotation pivot** (movable pivot crosshair).
- **Relative numeric input** ("+15°" rotates by 15 more).
- **Skew / shear** as a separate transform.
- **Rotation locking** in the layer / selection model.
- **Rotated multi-selection alignment** — alignment ops currently work on axis-aligned bounds; rotated items need a "rotate-then-align" decision.
- **Resize-while-rotated robustness** (depending on T1-T9 findings).
