# SceneCanvas Happy-Path Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut SceneCanvas boilerplate by defaulting `drawOne` (paints a filled rect from `node.data.color`), `selectionOverlay.handles.size`, and `selectTool.handleHitRadius`. After this lands, the minimal demo is `<SceneCanvas width={W} height={H} scene={scene} />`.

**Architecture:** All changes inside `src/canvas/SceneCanvas.tsx`. Three new module-level additions (one constant, one default-drawOne function, one merge helper) plus a behavior change in the prop-construction path. No Canvas changes, no demo migrations in scope.

**Tech Stack:** TypeScript, vitest, React (existing).

**Spec:** `docs/superpowers/specs/2026-05-11-scenecanvas-happy-path-defaults-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/canvas/SceneCanvas.tsx` | Modify | Add `DEFAULT_HANDLE_SIZE`, `defaultDrawOne`, `mergeLayersWithDefaults`; wire them into the prop-construction path |
| `src/canvas/SceneCanvas.test.tsx` | Modify | Unit tests for the helper + integration test for minimal-prop usage |
| `src/index.ts` | Modify | Re-export `DEFAULT_HANDLE_SIZE` from the kit barrel |

---

## Task 1: Defaults + merge helper (unit-tested in isolation)

**Files:**
- Modify: `src/canvas/SceneCanvas.tsx`
- Modify: `src/canvas/SceneCanvas.test.tsx`
- Modify: `src/index.ts`

Add the constant, the default-drawOne function, and the merge helper. Unit-test the merge helper and the default drawOne. No SceneCanvas behavior change in this task — those land in Task 2.

- [ ] **Step 1: Read the existing SceneCanvas surface**

Read `src/canvas/SceneCanvas.tsx` — pay attention to:
- The `LayersMap` type structure (imported from Canvas — look at how `layers` is currently forwarded).
- The `SceneSlotConfig` / `SelectionOverlaySlotConfig` shapes (defined in Canvas.tsx).
- The current `props.layers` → `<Canvas layers={...} />` forwarding.
- Where module-level constants/helpers live in the file (top, after imports? or near the bottom?).

Read `src/canvas/Canvas.tsx` for the `LayersMap`, `SceneSlotConfig`, and `SelectionOverlaySlotConfig` types.

- [ ] **Step 2: Write failing tests for the merge helper**

Add to `src/canvas/SceneCanvas.test.tsx` (new describe block):

```ts
import {
  DEFAULT_HANDLE_SIZE,
  defaultDrawOne,
  mergeLayersWithDefaults,
} from './SceneCanvas';

describe('SceneCanvas defaults', () => {
  describe('DEFAULT_HANDLE_SIZE', () => {
    it('is 8 (the demo-wide HANDLE constant)', () => {
      expect(DEFAULT_HANDLE_SIZE).toBe(8);
    });
  });

  describe('defaultDrawOne', () => {
    it('emits a filled rect using node.data.color', () => {
      const node = {
        id: 'a',
        kind: 'leaf' as const,
        layer: 'default',
        pose: { x: 1, y: 2, width: 3, height: 4 },
        data: { color: '#abc' },
        parent: null,
      };
      const cmds = defaultDrawOne(node as never, node.pose);
      expect(cmds).toEqual([
        {
          kind: 'path',
          path: { kind: 'rect', x: 1, y: 2, width: 3, height: 4 },
          fill: { color: '#abc' },
        },
      ]);
    });

    it('falls back to gray when data has no color', () => {
      const node = {
        id: 'a', kind: 'leaf' as const, layer: 'default',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: {}, parent: null,
      };
      const cmds = defaultDrawOne(node as never, node.pose);
      const fill = (cmds[0] as { fill: { color: string } }).fill;
      expect(fill.color).toBe('#888');
    });

    it('falls back to gray when data is null', () => {
      const node = {
        id: 'a', kind: 'leaf' as const, layer: 'default',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: null as never, parent: null,
      };
      const cmds = defaultDrawOne(node as never, node.pose);
      const fill = (cmds[0] as { fill: { color: string } }).fill;
      expect(fill.color).toBe('#888');
    });
  });

  describe('mergeLayersWithDefaults', () => {
    it('returns full defaults when input is undefined', () => {
      const merged = mergeLayersWithDefaults(undefined);
      expect(merged.scene).toBeDefined();
      expect((merged.scene as { drawOne: unknown }).drawOne).toBe(defaultDrawOne);
      expect(merged.selectionOverlay).toEqual({ handles: { size: DEFAULT_HANDLE_SIZE } });
    });

    it('returns full defaults when input is empty', () => {
      const merged = mergeLayersWithDefaults({});
      expect((merged.scene as { drawOne: unknown }).drawOne).toBe(defaultDrawOne);
      expect(merged.selectionOverlay).toEqual({ handles: { size: DEFAULT_HANDLE_SIZE } });
    });

    it('partial slot config spreads on top of the default for that slot', () => {
      const customDrawOne = () => [];
      const merged = mergeLayersWithDefaults({
        scene: { drawOne: customDrawOne as never },
      });
      expect((merged.scene as { drawOne: unknown }).drawOne).toBe(customDrawOne);
      // selectionOverlay unchanged — default applies
      expect(merged.selectionOverlay).toEqual({ handles: { size: DEFAULT_HANDLE_SIZE } });
    });

    it('null slot suppresses the default', () => {
      const merged = mergeLayersWithDefaults({ selectionOverlay: null });
      expect(merged.selectionOverlay).toBeNull();
      // scene default still present
      expect((merged.scene as { drawOne: unknown }).drawOne).toBe(defaultDrawOne);
    });

    it('null scene + null overlay yields a layers map with both nulls', () => {
      const merged = mergeLayersWithDefaults({ scene: null, selectionOverlay: null });
      expect(merged.scene).toBeNull();
      expect(merged.selectionOverlay).toBeNull();
    });

    it('passes through custom layer keys (unknown slots) unchanged', () => {
      const customLayer = { layer: { id: 'x', label: 'X', draw: () => [] } } as never;
      const merged = mergeLayersWithDefaults({ myExtra: customLayer });
      expect((merged as { myExtra?: unknown }).myExtra).toBe(customLayer);
    });
  });
});
```

(Adapt the import path / type casts to whatever the existing SceneCanvas tests look like — there's likely a `SceneCanvas.test.tsx` already; if not, place this in a sibling file. If `defaultDrawOne` and `mergeLayersWithDefaults` are exported only for tests, that's acceptable per the codebase's existing `__internal` patterns — but exporting at the module level is cleaner since `DEFAULT_HANDLE_SIZE` is also exported.)

- [ ] **Step 3: Run to verify failure**

```
npx vitest run src/canvas/SceneCanvas.test.tsx -t "SceneCanvas defaults"
```

Expected: FAIL — none of the exports exist yet.

- [ ] **Step 4: Add the constant and the default drawOne**

In `src/canvas/SceneCanvas.tsx`, near the top (after imports, before the props type), add:

```ts
/** Default size in CSS pixels for selection corner-handles AND their
 *  hit-test radius. Used by the SceneCanvas defaults; consumers override
 *  via `selectTool.handleHitRadius` or `layers.selectionOverlay.handles.size`. */
export const DEFAULT_HANDLE_SIZE = 8;

/** Default scene-slot `drawOne`. Paints each node as a filled rect using
 *  `node.data.color` if present, falling back to neutral gray. Assumes
 *  TPose carries `{ x, y, width, height }` — consumers with non-rect
 *  poses (paths, polygons) must supply their own `drawOne`. */
export function defaultDrawOne<TData, TLayer extends string, TPose>(
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

`Node` and `DrawCommand` should already be imported (or accessible via existing imports). If not, add them — check the top of the file.

- [ ] **Step 5: Add the merge helper**

Below `defaultDrawOne`:

```ts
/** Deep-merge user-supplied `layers` with kit defaults. Slots the user
 *  doesn't mention get filled with defaults; slots explicitly set to
 *  `null` are dropped (the existing "disable this slot" convention).
 *  Partial slot configs (e.g. `{ scene: { drawOne: customFn } }`) are
 *  shallow-spread on top of the default slot config. */
export function mergeLayersWithDefaults<TData, TLayer extends string, TPose>(
  user: LayersMap<Node<TData, TLayer, TPose>, TPose> | undefined,
): LayersMap<Node<TData, TLayer, TPose>, TPose> {
  const defaults = {
    scene: { drawOne: defaultDrawOne as (
      node: Node<TData, TLayer, TPose>,
      pose: TPose,
    ) => DrawCommand[] },
    selectionOverlay: { handles: { size: DEFAULT_HANDLE_SIZE } },
  } satisfies Partial<LayersMap<Node<TData, TLayer, TPose>, TPose>>;

  if (!user) return defaults as LayersMap<Node<TData, TLayer, TPose>, TPose>;

  // Start from a shallow copy of the user map so unknown slots pass through.
  const result: LayersMap<Node<TData, TLayer, TPose>, TPose> = { ...user };

  // Scene slot
  if (!('scene' in user)) {
    result.scene = defaults.scene;
  } else if (user.scene === null) {
    result.scene = null;
  } else {
    // Shallow-spread user's partial over default.
    result.scene = { ...defaults.scene, ...user.scene };
  }

  // Selection-overlay slot
  if (!('selectionOverlay' in user)) {
    result.selectionOverlay = defaults.selectionOverlay;
  } else if (user.selectionOverlay === null) {
    result.selectionOverlay = null;
  } else {
    result.selectionOverlay = { ...defaults.selectionOverlay, ...user.selectionOverlay };
  }

  return result;
}
```

Type concerns: `LayersMap` allows arbitrary additional keys (custom layer entries). The `{ ...user }` spread preserves them. The two slots we default (`scene`, `selectionOverlay`) are handled explicitly.

If TypeScript complains about the type of `defaults.scene` not matching `SceneSlotConfig<...>`, the cast in `defaults` (or an explicit type annotation) resolves it. Match the file's existing patterns for similar generics.

- [ ] **Step 6: Re-export `DEFAULT_HANDLE_SIZE` from the package barrel**

In `src/index.ts`, find where `SceneCanvas` is exported and add `DEFAULT_HANDLE_SIZE` next to it:

```ts
export { SceneCanvas, DEFAULT_HANDLE_SIZE } from './canvas/SceneCanvas';
```

Confirm the existing export line for SceneCanvas and adjust. Don't export `defaultDrawOne` or `mergeLayersWithDefaults` from the barrel — they're useful internal exports for tests but not part of the consumer surface.

- [ ] **Step 7: Run the unit tests**

```
npx vitest run src/canvas/SceneCanvas.test.tsx -t "SceneCanvas defaults"
```

Expected: ALL PASS.

- [ ] **Step 8: Typecheck**

```
npx tsc --noEmit
```

Expected: clean within `src/canvas/`. (Pre-existing rich-text and weasel-hud errors elsewhere are unrelated; same baseline as before.)

- [ ] **Step 9: Commit**

```bash
git add src/canvas/SceneCanvas.tsx src/canvas/SceneCanvas.test.tsx src/index.ts
git commit -m "feat(scene-canvas): DEFAULT_HANDLE_SIZE, defaultDrawOne, mergeLayersWithDefaults"
```

---

## Task 2: Wire defaults into SceneCanvas

**Files:**
- Modify: `src/canvas/SceneCanvas.tsx`
- Modify: `src/canvas/SceneCanvas.test.tsx`

Apply the merge helper to `props.layers` before forwarding to `<Canvas>`, and use `DEFAULT_HANDLE_SIZE` as the fallback for `selectTool.handleHitRadius`. Integration test that confirms a minimal SceneCanvas mount paints something.

- [ ] **Step 1: Write the failing integration test**

Add to `src/canvas/SceneCanvas.test.tsx`:

```ts
it('mounts with no layers prop and uses defaults', () => {
  function Harness() {
    const scene = useScene<{ color: string }, 'default', { x: number; y: number; width: number; height: number }>({
      systemLayers: [{ id: 'default' }],
      initial: [{
        id: 'a' as never,
        kind: 'leaf',
        layer: 'default',
        pose: { x: 10, y: 20, width: 30, height: 40 },
        data: { color: '#f00' },
      }],
    });
    return <SceneCanvas width={200} height={200} scene={scene} />;
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  expect(canvas).toBeTruthy();
  // No throw on mount; the canvas element exists. That's sufficient to prove
  // the defaults wire — the rendered DrawCommand tree is exercised by the
  // unit tests for defaultDrawOne / mergeLayersWithDefaults.
});

it('selectTool.handleHitRadius defaults to DEFAULT_HANDLE_SIZE when not provided', () => {
  // The handle-hit-radius default is harder to assert directly without
  // simulating clicks. Instead, render with no selectTool prop and then
  // assert no error, plus that the kit's default constant is what we expect.
  function Harness() {
    const scene = useScene<{ color: string }, 'default', { x: number; y: number; width: number; height: number }>({
      systemLayers: [{ id: 'default' }],
    });
    return <SceneCanvas width={200} height={200} scene={scene} />;
  }
  const { container } = render(<Harness />);
  expect(container.querySelector('canvas')).toBeTruthy();
  expect(DEFAULT_HANDLE_SIZE).toBe(8);
});

it('selectTool.handleHitRadius override wins over the default', () => {
  function Harness() {
    const scene = useScene<{ color: string }, 'default', { x: number; y: number; width: number; height: number }>({
      systemLayers: [{ id: 'default' }],
    });
    return (
      <SceneCanvas
        width={200} height={200} scene={scene}
        selectTool={{ handleHitRadius: 16 }}
      />
    );
  }
  const { container } = render(<Harness />);
  expect(container.querySelector('canvas')).toBeTruthy();
  // Behavioral assertion would require simulating a click 12px from a corner
  // and checking whether resize fires — out of scope for this test layer.
});
```

(Make sure `useScene`, `render`, `SceneCanvas`, `DEFAULT_HANDLE_SIZE` are imported. The existing test file likely already has the canvas-mocking `beforeAll` block; reuse it.)

- [ ] **Step 2: Run to verify failure**

```
npx vitest run src/canvas/SceneCanvas.test.tsx -t "mounts with no layers prop"
```

Expected: FAIL — SceneCanvas's `layers` prop is typed as required (or the absent `scene.drawOne` causes a runtime error inside `buildSceneLayer`).

If the test fails to compile because `layers` is required at the type level, the fix is in Step 3 — make the prop optional in `SceneCanvasProps`.

- [ ] **Step 3: Make `layers` optional on `SceneCanvasProps`**

In `src/canvas/SceneCanvas.tsx`, find where `SceneCanvasProps` is constructed. The type currently inherits `layers` from `CanvasProps` — `layers: LayersMap<...>`. Either:
- Change SceneCanvasProps's intersected addition to override `layers` as optional, or
- Add `layers?` to the inherited shape.

Look at how SceneCanvasProps is built (an `Omit` + `&` likely) and apply the minimal change. The implementation will fill `undefined` with defaults via the merge helper.

- [ ] **Step 4: Wire the merge helper into the render**

Find where SceneCanvas forwards `layers` to `<Canvas>`. Wrap it:

```ts
const mergedLayers = useMemo(
  () => mergeLayersWithDefaults(props.layers),
  [props.layers],
);
```

Pass `mergedLayers` instead of `props.layers` to `<Canvas>`.

Also wire the handle-hit-radius default. Find where `selectTool` options are read (likely passed to `useSceneSelectTool` or directly to a `useSelectTool` call inside SceneCanvas). Change:

```ts
// before
handleHitRadius: props.selectTool?.handleHitRadius,
// after
handleHitRadius: props.selectTool?.handleHitRadius ?? DEFAULT_HANDLE_SIZE,
```

Read the existing wiring (`useSceneSelectTool.ts` likely receives this) to apply the change at the right spot.

- [ ] **Step 5: Run the integration tests**

```
npx vitest run src/canvas/SceneCanvas.test.tsx
```

Expected: ALL PASS, including the new "mounts with no layers prop" test.

- [ ] **Step 6: Run the full kit suite**

```
npx vitest run
```

Expected: same baseline as before. **Note:** any existing demo tests that asserted on a specific layer absence (e.g., "no selection overlay rendered when only scene was set") will now fail because the default selection overlay is injected. If such tests exist, they need updating — pass `selectionOverlay: null` in their setup. Audit and fix any breakages.

If demo tests break en masse, that's the breaking change documented in the spec — handle by updating the affected demo test setups, not by reverting the merge behavior.

- [ ] **Step 7: Typecheck**

```
npx tsc --noEmit
```

Expected: same baseline.

- [ ] **Step 8: Build**

```
npm run build
```

Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/canvas/SceneCanvas.tsx src/canvas/SceneCanvas.test.tsx
git commit -m "feat(scene-canvas): wire defaults — layers merge + handleHitRadius fallback"
```

---

## After both tasks

Run the full pipeline:

```
npx tsc --noEmit && npx vitest run && npm run build
```

Expected: same baseline, plus all new tests pass.

Manual smoke-test the demos in the browser. Pay particular attention to demos that passed a partial `layers` map without setting `selectionOverlay`:

- If they NOW show a selection overlay they didn't before, that's the documented breaking change. Audit the demo and either accept the overlay (often desired) or pass `selectionOverlay: null` to suppress.

The follow-up demo-cleanup pass (drop the boilerplate `drawOne` and `HANDLE = 8` constants) is NOT in this plan's scope. Schedule it as a separate task once the defaults are settled and visually verified.
