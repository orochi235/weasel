# WebGL Features Showcase Demos

Add four demos under a new "Paint & shading" registry category that showcase capabilities introduced by the WebGL transition (steps 4–6): gradient paint variants, per-vertex path coloring, group-level color matrices, and the experimental custom shader API.

These are demos only — no kit API changes. They serve as discoverable, runnable references for consumers learning what the GL backend enables, and as visual-regression candidates for the features they exercise.

## Background

The WebGL transition (`docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md`, completed 2026-05-09) shipped:

- **Gradient paints** — `linear-gradient`, `radial-gradient`, `conic-gradient` variants on the `Paint` union (`src/core/paint-types.ts`)
- **Per-vertex path colors** — optional `vertexColors: number[]` field on `PathDrawCommand` (`src/renderer/DrawCommand.ts`)
- **Group color matrix** — optional `colorMatrix: number[]` (4×5 row-major) on `GroupDrawCommand`, composed multiplicatively down the group stack (`src/renderer/state/GroupState.ts`)
- **Custom shader DrawCommand** — `ShaderDrawCommand` with consumer-supplied fragment shader, marked `@experimental`

The existing demo registry has no tiles for any of these. This spec adds four.

## Goals

- Each new feature has a dedicated, focused demo tile
- Gradients get a deeper interactive editor (the variant geometry is the genuinely tricky part — different paint variants use different parameter sets in world coordinates, and a static demo doesn't teach this well)
- Demos read cleanly as source — consumers learn by reading one demo file, the way they currently learn `useResize` from `ResizeDemo.tsx`

## Non-goals

- No new kit API. The demos consume the existing surface.
- No new paint variants or shader features.
- No pattern-paint demo — patterns predate the WebGL transition.
- No standalone `ImageDrawCommand` demo — it's a thin feature and the ripple shader panel exercises image sampling indirectly.
- Not refactoring the demo registry shape.

## Demos

### 1. `GradientPlaygroundDemo` — full editor

A single shape (rounded rect) on canvas, filled with one of the three gradient variants. Three pieces of UI:

**Variant tabs** at the top — `Linear / Radial / Conic`. Switching tabs swaps the active `Paint` variant. Each variant remembers its own state across tab switches (so flipping back to Linear restores the user's earlier handles).

**On-canvas control handles** for the active variant:

- **Linear** — `from` and `to` endpoint handles, with a thin guideline drawn between them
- **Radial** — `center` handle plus a radius handle on the circumference (drag radius handle to grow/shrink the circle, drag center to translate)
- **Conic** — `center` handle plus an angle handle (a point on a unit circle around the center; dragging it sets the gradient's start angle)

Handles are circular SVG-style markers (~10px radius), drawn as a separate React overlay above the canvas. Dragging is handled with raw `pointerdown`/`pointermove`/`pointerup` listeners local to the demo — these are demo-local control affordances, not first-class kit handles.

**Stop strip** below the canvas — a horizontal bar showing the current stops:

- Click empty area on the strip → add a stop at that offset (color interpolated from neighbors)
- Drag a stop → reposition along the strip (offset 0..1, clamped, can't cross neighbors)
- Click a stop swatch → open native `<input type="color">` to recolor
- Right-click a stop or click an attached `×` button → delete (minimum two stops enforced)

Default seed: a 3-stop teal → magenta → gold gradient so the canvas looks good on first paint.

### 2. `VertexColorsDemo` — standalone

A polygon (heptagon by default) on canvas. Each vertex has a draggable position handle and a color swatch. The fill is rendered via the per-vertex color path (no `Paint` object) so the colors interpolate across the triangulated interior.

UI:

- Vertex position handles (filled circles) — drag to move the vertex
- Color swatches attached to each handle — click to open a color picker, updating that vertex's RGBA in the `vertexColors` array
- A "show handles" toggle to hide the affordances for clean screenshots

The fill is emitted through a custom `RenderLayer` (the same pattern `QuadtreeDemo` uses to inject a layer into the `Canvas` layers map) since `vertexColors` lives on `PathDrawCommand`, not on the consumer-facing `Paint` surface.

### 3. `ColorMatrixDemo` — nested groups with stacked filters

Three nested groups, each carrying its own preset color matrix. Inside each group are leaves with a base palette (e.g. three colored circles) so the cumulative effect of the stacked matrices is visible.

Tree:

```
outer group   (default: Identity)
├─ leaves (base palette)
└─ middle group   (default: Sepia)
   ├─ leaves (base palette)
   └─ inner group   (default: Hue+90°)
      └─ leaves (base palette)
```

Each group has a row of preset buttons rendered next to it: `Identity / Grayscale / Sepia / Invert / Hue+90° / Brightness×1.5`. Clicking a preset swaps that group's `colorMatrix` field. The leaves under that group (and any nested groups beneath) re-render with the composed transform.

The teaching moment is composition: changing the outer group's filter affects every leaf in the tree; changing the middle group affects only its subtree; the inner leaves see all three matrices multiplied together.

This demo also uses a custom `RenderLayer` (DrawCommands directly) because `colorMatrix` is a `GroupDrawCommand` field with no consumer-Scene equivalent today.

### 4. `CustomShaderDemo` — three-panel

A row of three equal-width shader panels, each running its own `ShaderDrawCommand`:

**Plasma panel** — short animated GLSL fragment that combines `sin`/`cos` color fields. Uniforms: `u_time` (animated via `requestAnimationFrame`), `u_mouse` (vec2, panel-local cursor position). Moving the cursor over the panel shifts the field's anchor.

**Ripple panel** — a sampled image rendered as a quad, with the shader displacing UV lookups based on active ripples. Click anywhere in the panel to spawn a ripple at that point. Uniforms: `u_time`, `u_image` (sampler2D), `u_ripples` (array of vec3 — `xy` = origin, `z` = spawn time), `u_rippleCount` (int). Ripple lifetimes are bounded (~1.5s); a fixed array slot count (e.g. 8) is sufficient.

**Voronoi panel** — N draggable seed points (default 6) inside the panel. Each frame, the shader samples the per-fragment nearest seed and colors the region by seed index. Uniforms: `u_seeds` (array of vec2), `u_seedCount` (int), `u_time` (small color-cycling on the palette). Drag handles are the standard demo-local circle affordances.

GLSL source is inlined as JS template strings at the top of the demo file so consumers can read it without chasing imports. The custom shader API is `@experimental`; the demo description includes a `<small>` note acknowledging the surface may shift.

## Registry & file plumbing

Four new files under `demo/demos/`:

- `GradientPlaygroundDemo.tsx`
- `VertexColorsDemo.tsx`
- `ColorMatrixDemo.tsx`
- `CustomShaderDemo.tsx`

Each exports a single React component matching the existing demo pattern. Each is registered in `demo/registry.ts` with:

- Component import + `?raw` source import (matching every other demo)
- A `DemoEntry` with `category: 'Paint & shading'`
- A description tuned for the discovery sidebar (one paragraph, similar density to existing entries)

The registry's `CATEGORIES` constant derives the category list from `DEMOS`, so the new category appears automatically once the entries exist.

## Tricky bits to watch during implementation

**Vertex colors and color matrix have no consumer-Paint surface.** Today they live on `DrawCommand` only. The pattern for emitting them from a demo is a custom `RenderLayer` slotted into the `Canvas` layers map (as `QuadtreeDemo` does). Confirm this is still the recommended path during the planning phase — if a higher-level surface has been added since, prefer that.

**Image asset for the ripple panel.** The repo has an untracked `weasel-transparent.cleaned.png` at the root. The implementation should move/copy it into `demo/assets/` (or wherever existing demo images live — verify during planning), import it via Vite, and register it through the kit's image pipeline.

**Native color pickers.** `<input type="color">` is the simplest cross-browser swatch picker. No need for a custom popover.

**Bounds for shader panels.** `ShaderDrawCommand` takes a screen-space `bounds` rect. The three-panel layout means each panel passes its own bounds. Use the panel's measured `getBoundingClientRect` (relative to the canvas) at draw time; recompute on resize.

**Animation loops.** The plasma, ripple, and voronoi panels need `requestAnimationFrame` loops to advance `u_time`. Tie each loop to component lifecycle — start on mount, stop on unmount, request a redraw each frame via the existing canvas redraw mechanism.

## Out of scope (deferred)

- Pattern-paint demo — pre-WebGL feature, no new GL story.
- Standalone `ImageDrawCommand` demo — too thin for a tile.
- Promoting `vertexColors` or `colorMatrix` to a higher-level consumer surface — that's a separate API discussion.
- Stabilizing the custom shader API past `@experimental` — separate spec.
- Visual-regression coverage for the new demos — these will be candidates once they land, but adding the regression entries is its own task.
