# SceneCanvas Happy-Path Defaults

**Status:** design approved 2026-05-11.

**Goal:** Cut boilerplate from typical SceneCanvas consumers. After this change, the minimal demo becomes `<SceneCanvas width={W} height={H} scene={scene} />` — no `layers`, no `selectTool` config, no per-demo `HANDLE = 8` constants. Kit-level defaults render each node as a filled rect using `node.data.color`, and the selection overlay + corner-handle hit radius pick up a shared `DEFAULT_HANDLE_SIZE`.

**Non-goals:**
- Changing Canvas-level defaults. Canvas is the low-level surface; SceneCanvas is where opinions belong.
- Constraining `TData`'s shape at the type level (no `TData extends { color?: string }` requirement). The default reads `node.data.color` via an untyped runtime lookup; non-color TData just paints gray.
- Adding a `colorOf` prop. The default is opinionated; consumers who want a different projection write their own `drawOne`.
- Re-styling the corner handles (color, shape, etc.). Only the size default changes.

## Motivation

Every demo opens with the same 5-line `drawOne`:

```tsx
drawOne: (node, p): DrawCommand[] => [{
  kind: 'path',
  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
  fill: { color: node.data.color },
}],
```

Plus a `HANDLE = 8` constant threaded into `selectionOverlay.handles.size` and `selectTool.handleHitRadius`. Across 17 demos, that's ~85 lines of identical boilerplate. The kit can pick a sensible default for each, and consumers override when they need something different. The cost of overriding stays the same (one prop); the cost of accepting the default drops to zero.

## Decisions locked in

- **Default `drawOne`: paint a filled rect using `node.data.color` if present, gray fallback otherwise.** Untyped runtime lookup — `(node.data as { color?: string })?.color ?? '#888'`. Consumers with `TData = string`, function-only data, or differently-shaped color sources override `drawOne` explicitly.
- **`DEFAULT_HANDLE_SIZE = 8`.** Single module-level constant in `src/canvas/SceneCanvas.tsx`, re-exported. Used as the default for both `selectionOverlay.handles.size` (visual) and `selectTool.handleHitRadius` (hit target) so the painted square and the clickable region coincide.
- **`layers` deep-merges with kit defaults.** When the consumer omits `layers` entirely OR passes a partial `layers` object, the kit injects defaults for unmentioned slots (currently `scene` and `selectionOverlay`). Consumers explicitly disable a slot by passing `slot: null` (existing kit convention for layer slots).
- **Pose shape assumption: `{ x, y, width, height }`.** The default `drawOne` is only correct for rect-AABB poses. Consumers with non-rect poses (paths, polygons, etc.) MUST override `drawOne`. This isn't enforced at the type level — TPose stays fully generic — but documented in the JSDoc.

## Architecture

### Modified: `src/canvas/SceneCanvas.tsx`

Three new exported names + one behavior change in the layer-construction code path.

**New module-level constant:**
```ts
/** Default size in CSS pixels for selection corner-handles AND their
 *  hit-test radius. Used by the SceneCanvas defaults; consumers override
 *  via `selectTool.handleHitRadius` or `layers.selectionOverlay.handles.size`. */
export const DEFAULT_HANDLE_SIZE = 8;
```

**New internal default `drawOne` function:**
```ts
/** Default scene-slot `drawOne`. Paints each node as a filled rect using
 *  `node.data.color` if present, falling back to neutral gray. Assumes
 *  TPose carries `{ x, y, width, height }` — consumers with non-rect
 *  poses (paths, polygons) must supply their own `drawOne`. */
function defaultDrawOne<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
): DrawCommand[] {
  const p = pose as unknown as { x: number; y: number; width: number; height: number };
  const color = (node.data as { color?: string } | null)?.color ?? '#888';
  return [{
    kind: 'path',
    path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
    fill: { color },
  }];
}
```

Not exported. Consumers who want it explicitly should write the 5-line override themselves (transparency over re-exporting a built-in).

**New layer-merge helper, internal:**
```ts
/** Deep-merge user-supplied `layers` with kit defaults. Slots the user
 *  doesn't mention get filled with defaults; slots explicitly set to
 *  `null` are dropped (the existing "disable this slot" convention).
 *  Partial slot configs (e.g. `{ scene: { drawOne: customFn } }`) are
 *  shallow-spread on top of the default slot config. */
function mergeLayersWithDefaults<TData, TLayer extends string, TPose>(
  user: LayersMap<Node<TData, TLayer, TPose>, TPose> | undefined,
): LayersMap<Node<TData, TLayer, TPose>, TPose> {
  // ... see implementation below ...
}
```

Implementation: build a result starting from kit defaults, then for each slot the user mentioned: `null` → delete from result; partial object → spread over default; full object → replace.

Kit defaults shape:
```ts
const DEFAULT_LAYERS: LayersMap<...> = {
  scene: { drawOne: defaultDrawOne },
  selectionOverlay: { handles: { size: DEFAULT_HANDLE_SIZE } },
};
```

**Behavior change in `SceneCanvas`:**

Where SceneCanvas currently forwards `layers` to `<Canvas layers={...} />`, it now passes `mergeLayersWithDefaults(props.layers)`. The merge is a pure transformation; no React state, no useMemo deps churn (it can be `useMemo`'d on `props.layers`).

Where SceneCanvas currently passes `selectTool.handleHitRadius` (or omits it), it falls back to `DEFAULT_HANDLE_SIZE`:
```ts
const handleHitRadius =
  props.selectTool?.handleHitRadius ?? DEFAULT_HANDLE_SIZE;
```

### No changes elsewhere

Canvas, `useSelectTool`, `createSelectionOverlayLayer`, and demos all stay as-is. The defaults live entirely in SceneCanvas's prop-construction path.

## Data flow

```
Consumer JSX
  <SceneCanvas scene={scene} width={W} height={H} />
                    │
                    ▼
SceneCanvas resolves:
  • layers       → mergeLayersWithDefaults(undefined) → DEFAULT_LAYERS
  • selectTool   → { handleHitRadius: DEFAULT_HANDLE_SIZE }
  • other props  → unchanged (existing defaults / undefined)
                    │
                    ▼
<Canvas layers={...} adapter={...} tools={...} selection={...} ... />
                    │
                    ▼
existing render pipeline (no changes)
```

## Behavior change for existing consumers

**Breaking change:** any consumer that passes a partial `layers` object today gets DIFFERENT behavior after this change. Specifically:

- **Today:** `layers: { scene: {...} }` renders only the scene slot. Selection overlay (and any future slots) are absent because the slot wasn't mentioned.
- **After:** `layers: { scene: {...} }` renders the scene slot AND the default selection overlay. To suppress the overlay, the consumer must pass `selectionOverlay: null`.

Mitigation:
- The four demos we just migrated (Clipping, Scene, NestedGroups, Layout) already use `selectionOverlay: { handles: false }` to suppress handles when they don't want them; they continue to work (handles: false is a valid override of the default).
- Other demos that pass `layers: {...}` need an audit — any that relied on the absence of `selectionOverlay` will now show overlays.
- Release notes call this out explicitly. We grep for `<SceneCanvas` usage in the demos and document the per-demo migration in a follow-up.

**No other behavior change:**
- Consumers passing the full `layers` shape (every slot they want, with full configs) see no difference — their explicit values win over defaults.
- Consumers passing custom `tools` bypass SceneCanvas's `useSelectTool` entirely, so the `handleHitRadius` default doesn't apply.
- The `defaultDrawOne`'s gray-fallback only fires for TData without a `color` field; TData = `{ color: string, ... }` (the common shape) is unaffected.

## Components

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| `DEFAULT_HANDLE_SIZE` | Module-level constant; re-exported from kit barrel | None |
| `defaultDrawOne` | Internal default for the scene-slot `drawOne` | `DrawCommand` type, `Node` type |
| `mergeLayersWithDefaults` | Pure transformation: user layers → user + defaults | `DEFAULT_LAYERS`, `LayersMap` type |
| SceneCanvas's prop-construction path | Apply defaults to `layers` and `handleHitRadius` | `mergeLayersWithDefaults`, `DEFAULT_HANDLE_SIZE` |

Each unit is independently testable: the constant is a number, `defaultDrawOne` is a pure function over a single node, and `mergeLayersWithDefaults` is a pure function over a `LayersMap`.

## Testing

### `src/canvas/SceneCanvas.test.tsx` additions

- `mergeLayersWithDefaults(undefined)` returns the full default map.
- `mergeLayersWithDefaults({})` returns the full default map.
- `mergeLayersWithDefaults({ scene: customScene })` returns `{ scene: customScene, selectionOverlay: defaultOverlay }`.
- `mergeLayersWithDefaults({ scene: { drawOne: customFn } })` returns `{ scene: { drawOne: customFn }, selectionOverlay: defaultOverlay }`. Partial slot config takes the consumer's drawOne but uses the default selection overlay.
- `mergeLayersWithDefaults({ selectionOverlay: null })` returns `{ scene: defaultScene }` only; the selection overlay is suppressed.
- `mergeLayersWithDefaults({ scene: null })` returns `{ selectionOverlay: defaultOverlay }` only.

### Integration

- `<SceneCanvas scene={scene} width={...} height={...} />` (no other props) mounts cleanly. Inspect the rendered `DrawCommand` tree to confirm rect paths with `data.color` fill.
- `<SceneCanvas scene={scene} ... selectTool={undefined} />` results in handle hit-radius of `DEFAULT_HANDLE_SIZE`.
- `<SceneCanvas scene={scene} ... selectTool={{ handleHitRadius: 16 }} />` honors the override.

### `defaultDrawOne` unit tests

- Node with `data: { color: '#abc' }` → emits one path command with that fill color.
- Node with `data: {}` (no color) → emits the gray fallback.
- Node with `data: null` → emits the gray fallback.

## Release notes

> SceneCanvas now applies sensible defaults for the scene-slot `drawOne`
> and the selection overlay handle size, so a minimal usage is
> `<SceneCanvas scene={scene} width={W} height={H} />`. The `layers`
> prop now deep-merges with kit defaults: slots you omit get a kit
> default; pass `slot: null` to suppress one explicitly. The default
> `drawOne` paints each node as a filled rect using `node.data.color`
> (falling back to gray); consumers with non-rect poses or differently-
> shaped data should supply their own `drawOne`. `DEFAULT_HANDLE_SIZE`
> is exported for consumers who want to thread the same value into
> custom tooling. **Breaking change:** consumers who passed a partial
> `layers` map and relied on the absence of unmentioned slots now see
> those slots' kit defaults instead. Pass `slot: null` to opt out.

## Demo cleanup (follow-up)

Not in scope for this spec. Once the defaults land, every demo currently passing the boilerplate `drawOne` and the `HANDLE = 8` constant can drop both. Track as a follow-up task; expect ~85 lines of demo code to go away.
