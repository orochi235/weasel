# Shape tools + tool palette + presentation metadata

Date: 2026-05-11
Status: design approved, plan pending

## Summary

Three coordinated additions to weasel:

1. **Five new shape tools** (`useEllipseTool`, `useLineTool`, `usePolygonTool`, `useStarTool`, `usePencilTool`) in `src/tools/builtin/`, alongside one new gesture primitive (`useDragRadial`) and one new pure geometry helper (`schneiderFit` for the pencil tool's cubic-Bezier fit).
2. **Presentation metadata on `Tool`** — `Tool.presentation?: { label, icon, cursor, group, shortcut }` plus kit-shipped default icons for every built-in tool. Cursor plumbing is the only piece that touches the dispatcher.
3. **`<ToolPalette>` component** in `@weasel-js/ui` consuming the new metadata — grouped flat layout, ARIA toolbar semantics, no flyouts.

Driver: the swillustrator app currently re-implements its own tool buttons because the kit's `Tool` type carries no presentation metadata. Every weasel consumer that wants a palette duplicates this work. Once metadata + `<ToolPalette>` ship, swillustrator and future consumers render their palettes from kit data alone.

## Dependency on in-flight keybinding refactor

A parallel refactor on `main` (uncommitted at spec time) reshapes `Tool.keybinding` from `string` to a structured `KeyBinding` type (`{ key, mod?, shift?, alt? }`) and factors out a shared `matchesKeyBinding` matcher between `useKeybinding` and `useKeybindings`. This spec assumes that refactor lands first. The `presentation.shortcut` deriver in weasel-ui formats from the structured shape.

If the keybinding shape diverges from the assumption (e.g., adds `meta` separate from `mod`, drops `alt`), only the deriver needs adjustment — the rest of the design is keybinding-shape-agnostic.

## Non-goals

- Flyout / long-press palette layouts. Memory rule: avoid these even when designing Illustrator-shaped UI.
- A property panel for tool options (side count, pencil tolerance, star inner radius). v1 exposes these as hook options only; runtime adjustment is a follow-up.
- Per-tool keyboard navigation inside the canvas itself (the palette owns ARIA toolbar nav between buttons; tool-internal keybinds stay declared on the Tool).
- New cursor surface: kit ships default cursors per tool but does not own a cursor manager beyond setting `style.cursor` on the canvas host.

## Architecture

```
src/tools/types.ts                          — Tool.presentation field added
src/tools/builtin/
  useEllipseTool.ts                         — bounds-rect drag-insert
  useLineTool.ts                            — click-down → drag → release-place
  usePolygonTool.ts                         — drag-from-center radial
  useStarTool.ts                            — drag-from-center radial + inner radius
  usePencilTool.ts                          — freehand sample → Schneider fit
src/interactions/gestures/useDragRadial.ts  — new primitive
src/features/paths/schneiderFit.ts          — pure cubic-Bezier fitter
src/icons/                                  — kit-shipped SVG icon components
  index.ts                                  — barrel
  SelectIcon.tsx, HandIcon.tsx, ...         — one inline-SVG component per tool
packages/ui/src/
  ToolPalette.tsx                           — new component
  ToolPalette.css                           — grouped layout
```

**Dependency order for implementation:**

1. `Tool.presentation` field on `src/tools/types.ts` — unblocks everything else.
2. `src/icons/` barrel + 11 icon components (six pre-existing tools, five new). Icons can land before the tools that use them.
3. `useDragRadial` primitive — unblocks polygon, star.
4. `schneiderFit` pure function — unblocks pencil.
5. Five tool hooks. Independent of each other once 1–4 land.
6. Backfill `presentation` on existing built-in tools.
7. `<ToolPalette>` in weasel-ui — depends only on (1).
8. `ShapeToolsDemo` kit demo + `ToolPalette` weasel-ui demos.

**Boundaries:**

- The kit owns tool definitions, gesture primitives, geometry helpers, and icon assets. It does *not* own palette layout.
- `weasel-ui` owns the palette component and its CSS. It consumes the kit's `Tool` shape and icon components but doesn't reach into the kit's internals.
- `schneiderFit` is a pure function. Lives in `src/features/paths/`, has its own unit tests, has no React dependency.
- New shape tools live in `src/tools/builtin/`, not `weasel-den`. They're primitive shape tools; consistent with `useRectTool`/`useTextTool` being core.

## Tool presentation metadata

New optional field on `Tool`:

```ts
type Tool<TScratch = unknown> = {
  // ...existing fields...
  presentation?: {
    label?: string;           // human-readable, distinct from id
    icon?: ReactNode | ((scratch?: TScratch) => ReactNode);
    cursor?: string | ((scratch?: TScratch) => string);
    group?: string;           // palette grouping key
    shortcut?: string;        // display override; otherwise derived from keybinding
  };
};
```

All fields are optional. Tools with no `presentation` field still work; the palette renders them with `id` as label and a placeholder icon.

**Cursor plumbing:** `useTools` exposes a resolved cursor string on its return. `<SceneCanvas>` writes it to its host element's `style.cursor`, re-resolving on scratch changes. This is the one piece of new imperative-style code that touches the dispatcher; inline style on the canvas host is unavoidable for cursor.

**Group convention** (kit-recommended, consumer-overridable):

```ts
type Group = 'select' | 'shape' | 'draw' | 'type' | 'view';
const DEFAULT_GROUP_ORDER: readonly string[] = ['select', 'shape', 'draw', 'type', 'view'];
```

Free-form strings outside this set are allowed — the palette renders them after the known groups in first-seen order.

## Shape tools

### `useEllipseTool<TData>(opts)`

Bounds-rect via existing `useDragRect`. Output: closed `Path` approximating an ellipse with 4 cubic-Bezier segments (kappa = 0.5522847). Modifiers: `shift` → circle (square bounds); `alt` → from center.

```ts
interface UseEllipseToolOptions<TData> {
  create: (bounds: Bounds) => { pose: Pose; data: TData; id?: NodeId } | null;
  minBounds?: { width: number; height: number };
}
```

### `useLineTool<TData>(opts)`

New lightweight gesture rolled inline (no new primitive). Pointerdown captures start; pointermove updates end; pointerup commits an open `Path` of 2 anchors. Fill: none. Modifiers: `shift` → constrain to 15° increments; `alt` → mirror end around start.

```ts
interface UseLineToolOptions<TData> {
  create: (a: Point, b: Point) => { pose: Pose; data: TData; id?: NodeId } | null;
  minLength?: number;
}
```

### `usePolygonTool<TData>(opts)`

`useDragRadial` primitive: pointerdown sets center, pointermove sets `radius = distance(center, pointer)` and `rotation = atan2(pointer.y - center.y, pointer.x - center.x)`, pointerup commits. Output: closed `Path` of N anchors on a circle. Mid-drag `ArrowUp`/`ArrowDown` adjusts side count (range 3–32). Modifiers: `shift` → 15° rotation constraint; `alt` → from-corner (one vertex pinned at downpoint).

```ts
interface UsePolygonToolOptions<TData> {
  create: (center: Point, radius: number, rotation: number, sides: number) => Commit | null;
  sides?: number;       // default 6
  minRadius?: number;
}
```

### `useStarTool<TData>(opts)`

Same `useDragRadial` primitive as polygon. Output: closed `Path` of `2 * points` anchors alternating outer/inner radius. `points` default 5; `innerRatio` default 0.5. `ArrowUp`/`ArrowDown` adjusts points. Holding `alt` mid-drag adjusts `innerRatio`.

```ts
interface UseStarToolOptions<TData> {
  create: (center: Point, outerRadius: number, innerRadius: number, rotation: number, points: number) => Commit | null;
  points?: number;       // default 5
  innerRatio?: number;   // default 0.5
  minRadius?: number;
}
```

### `usePencilTool<TData>(opts)`

Pointerdown begins capture; pointermove appends `{x, y, t}` samples (no throttling); pointerup runs `schneiderFit(samples, tolerance)` → cubic-Bezier path → commit. Live preview during drag is a polyline of raw samples emitted via the tool's overlay channel — consumer styles it through the standard overlay render path. Closure: if `distance(samples[0], samples[N-1]) < closeThreshold`, output is closed.

```ts
interface UsePencilToolOptions<TData> {
  create: (path: Path) => { pose: Pose; data: TData; id?: NodeId } | null;
  tolerance?: number;        // default 2.0 (world units; Schneider error param)
  closeThreshold?: number;   // default 8.0
}
```

## `useDragRadial` primitive

Lives at `src/interactions/gestures/useDragRadial.ts`. State machine:

- `idle` → pointerdown → `dragging`
- `dragging` → pointermove → emit `{ center, radius, rotation }` to scratch
- `dragging` → pointerup → commit and reset
- `dragging` → pointercancel or Escape → cancel

Shared by polygon and star. Exposes the same `useDragGesture`-style scratch lifecycle the other gestures use. Modifier-key state (shift, alt) is read at commit time from `ToolCtx.modifiers`.

## `schneiderFit` algorithm

Pure function in `src/features/paths/schneiderFit.ts`:

```ts
export function schneiderFit(
  samples: ReadonlyArray<Point>,
  errorTolerance: number,
): Path;
```

Implements Schneider (1990, *Graphics Gems I*) adaptive cubic-Bezier fitting:

1. **Tangent estimation** at endpoints from neighboring samples.
2. **Chord-length parameterization** assigns each sample a `t[i] ∈ [0, 1]`.
3. **Least-squares fit** with endpoints + tangents fixed — closed-form 2×2 system for the two interior control-point distances along the tangents.
4. **Reparameterize + iterate** (2–4 Newton-Raphson passes refitting `t[i]` to nearest curve point, then re-solve).
5. **Error check.** Max squared distance from any sample to curve. If ≤ tolerance² → return the cubic.
6. **Split + recurse.** Otherwise split at worst-error sample; recursively fit each half; concatenate. Split-point tangent is the chord direction through neighbors (C1-continuous joins in practice).

**Degenerate cases:**
- `samples.length < 2`: empty or single-anchor path.
- `samples.length === 2`: straight degenerate cubic.
- Co-linear samples: algorithm naturally fits a straight cubic.

**Output:** multi-anchor `Path` where consecutive anchors share Bezier handles defining each segment. For N segments the path has N+1 anchors with continuous tangents at interior anchors.

**Performance:** O(N) per fit pass, O(N log N) worst case across splits. Bounded by sample rate × duration → typically <500 samples → microseconds. Not a perf risk.

## `<ToolPalette>` component

Lives at `packages/ui/src/ToolPalette.tsx`.

```tsx
interface ToolPaletteProps {
  tools: ToolsApi;
  orientation?: 'vertical' | 'horizontal';  // default 'vertical'
  groupOrder?: readonly string[];           // default DEFAULT_GROUP_ORDER + unknown groups in first-seen order
  className?: string;
  renderTool?: (tool: Tool, defaults: ToolButtonProps) => ReactNode;
}
```

**Render model:**
- Walks `tools.list()`, partitions by `presentation.group`. Tools without a group go into an implicit `'misc'` bucket rendered last.
- Each group is a `<section>` with visible separator (border, gap). No group headers in v1.
- Tools without any `presentation` field render with `id` as label and a generic question-mark placeholder icon shipped from `src/icons/UnknownIcon.tsx` — debuggable, not hidden.

**Active highlight:** `tools.activeId` drives `aria-current="true"` and a `.tool-button--active` class. Click dispatches `tools.setActive(id)`.

**Keyboard nav:** standard ARIA toolbar — arrow keys move focus within the palette; Enter / Space activates. `role="toolbar"` on wrapper, `role="button"` on entries.

**Shortcut display:** `presentation.shortcut` if set, else derived from `keybinding` via:

```ts
function formatShortcut(b?: KeyBinding): string | undefined {
  if (!b) return;
  return [b.mod && '⌘', b.shift && '⇧', b.alt && '⌥', b.key.toUpperCase()]
    .filter(Boolean).join('');
}
```

Renders as small text under or beside the icon.

**Tooltip:** native `title` attribute combining `label` and shortcut. No custom popover.

**CSS:** `ToolPalette.css` owns sizing, separators, hover/active/focus states. Uses CSS custom properties for theming. No inline styles.

**Out of scope (v1):**
- Drag-to-reorder tools.
- Recently-used / favorites.
- Flyouts.
- Icon-size variants beyond CSS class.

## Built-in metadata backfill + icons

Every existing built-in tool gets a `presentation` field filled in alongside the new shape tools. Backfilled tools: `useSelectTool`, `useLassoTool`, `useRectTool`, `useUserPenTool`, `useTextTool`, `useHandTool`. New tools declare presentation natively.

| Tool             | label       | group    | icon              | cursor                              |
| ---------------- | ----------- | -------- | ----------------- | ----------------------------------- |
| `useSelectTool`  | Select      | `select` | arrow             | `default`                           |
| `useLassoTool`   | Lasso       | `select` | dashed loop       | `crosshair`                         |
| `useRectTool`    | Rectangle   | `shape`  | square outline    | `crosshair`                         |
| `useEllipseTool` | Ellipse     | `shape`  | circle outline    | `crosshair`                         |
| `useLineTool`    | Line        | `shape`  | diagonal line     | `crosshair`                         |
| `usePolygonTool` | Polygon     | `shape`  | hexagon outline   | `crosshair`                         |
| `useStarTool`    | Star        | `shape`  | 5-point star      | `crosshair`                         |
| `useUserPenTool` | Pen         | `draw`   | fountain-pen nib  | `crosshair`                         |
| `usePencilTool`  | Pencil      | `draw`   | pencil tip        | `crosshair`                         |
| `useTextTool`    | Text        | `type`   | "T"               | `text`                              |
| `useHandTool`    | Hand        | `view`   | open palm         | scratch: `grab` / `grabbing`        |

**Icon component shape:**
- One `.tsx` per icon in `src/icons/`, default export `React.FC<{ className?: string; size?: number }>`.
- Inline SVG, 24×24 viewbox, `stroke="currentColor"` `fill="none"` (or `fill="currentColor"` for solid glyphs like "T"). 1.5px stroke width.
- Barrel `src/icons/index.ts` re-exports named: `SelectIcon`, `HandIcon`, etc.
- Tree-shakeable — consumers who don't use a tool don't pay for its icon.

## Demos + testing

**Kit demos:**
- New `ShapeToolsDemo` card in `demo/demos/` showing all five new tools in a single canvas, with a `<ToolPalette>` mounted in the same demo.
- Existing Pen / Text / Rect / Hand demos unchanged.

**weasel-ui demos** (existing story harness):
- `ToolPalette` default — full 11-tool palette, vertical.
- `ToolPalette` horizontal — same tools, horizontal orientation.
- `ToolPalette` minimal — three tools, no groups.

**Unit tests:**
- `schneiderFit.test.ts` — synthetic samples (line, arc, S, sharp corner forcing split, near-closed loop). Assert max-error under tolerance, anchor count, endpoint match, tangent continuity at splits.
- `useDragRadial.test.ts` — gesture state machine: pointerdown→dragging, pointermove updates, pointerup commits, escape cancels.
- One `.test.ts` per new tool mirroring existing patterns (`useRectTool.test.ts` etc.). Covers keybinding activation, drag→commit produces correct Path geometry, modifier behaviors, no commit below `minRadius` / `minLength`.
- `ToolPalette.test.tsx` (weasel-ui) — renders groups in order, active tool gets `aria-current`, click calls `tools.setActive`, arrow-key focus navigation, tools without `presentation` render with placeholder.

**Visual regression** (`tests/visual/`):
- One baseline per new shape tool panel in `ShapeToolsDemo`.
- One baseline per `ToolPalette` story (3 variants).

## Open follow-ups (deferred from v1)

- **Tool options property panel.** Side count, pencil tolerance, star inner-ratio adjustable at runtime via a `<PropertiesPanel>`-shaped surface in weasel-ui.
- **Flyouts** — only revisit if a real consumer hits a scrollable-palette problem. Memory rule against flyouts stands by default.
- **Pencil retouch / reshape gestures.** Illustrator's pencil also reshapes existing strokes; v1 only creates.
- **Brush variations** (calligraphic, scatter). Out of scope; would build on pencil's stream-capture but with different commit behavior.
- **Width tool.** Variable stroke width along a path. Separate spec.
- **Custom cursors** beyond the CSS `cursor` enum (image cursors, hotspots). Defer until a real consumer wants them.
- **Tool palette drag-to-reorder.** Defer to consumer use case.

## Risks

- **Schneider fit complexity.** The algorithm is well-trodden (multiple reference implementations exist) but it's the most engineering-heavy line item in v1. If the fit produces visibly wrong output in edge cases, fallback path is to ship `usePencilTool` with a simpler RDP-only smoother and iterate. The tool's external API doesn't change.
- **Cursor plumbing on the dispatcher.** New seam between `useTools` and `<SceneCanvas>`. Risk is a re-render loop if cursor resolution isn't memoized correctly. Mitigation: tests on `useTools` exposing cursor; canvas host reads cursor via ref to avoid React re-renders.
- **Keybinding refactor shape.** This spec assumes the in-flight `KeyBinding` refactor lands with `{ key, mod?, shift?, alt? }` fields. If the shape diverges, only `formatShortcut` in weasel-ui needs updating.

## Acceptance

Spec is done when:
- All 11 tools render in a `<ToolPalette>` with correct icons and groups.
- Each new shape tool produces a geometrically correct `Path` (verified via unit tests and visual regression).
- `schneiderFit` unit tests pass for the five canonical inputs.
- Swillustrator can drop its hand-rolled tool buttons in favor of `<ToolPalette tools={tools} />`.
- `prepublishOnly` green: tsc clean, vitest pass, tsup build clean.
