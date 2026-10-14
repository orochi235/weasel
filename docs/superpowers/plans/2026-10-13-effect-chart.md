# EffectChart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: unbuilt.** Written 2026-10-13. Delete this file and the spec when the work merges.

**Goal:** A chart of an effects pipeline on `@weasel-js/diagram`, with swappable looks and branch symbols, and a workshop story to try them in.

**Architecture:** Pipeline data goes through a *look* (a pure function) that returns `diagramScene`'s two arguments; `EffectChart` runs it and renders a `DiagramView`. Tasks 1 to 5 add general surface to diagram that the looks need; tasks 6 to 10 build `src/effect/`; tasks 11 to 13 are the lab, the site demos and the paperwork.

**Tech Stack:** TypeScript, React, vitest (jsdom project `weasel-ui`, Chromium project `browser`), `@weasel-js/core`, `@weasel-js/forge` stories.

**Spec:** `docs/superpowers/specs/2026-10-13-effect-chart-design.md`

## Global Constraints

- Work in the worktree `.claude/worktrees/effect-chart` (branch `worktree-effect-chart`). Run `npm ci` there once before any build or browser test.
- Run only the test files a task names. The full suite runs on the fleet: `npm run test:fleet` and `npm run test:gate` before merging, never a bare `onto test`.
- Unit tests under `packages/diagram/src` run with `npx vitest run --project=weasel-ui <file>`. Browser tests run with `npx vitest run --project=browser <file>`; they import `describe`, `it`, `expect` from `vitest` explicitly.
- `npm run check:size` fails on a file over 400 lines or a function over 120. `diagramScene` in `fromData.ts` is recorded at 166 and may only shrink.
- Shipped source in `packages/diagram/src` imports only `react` and the packages in its `peerDependencies`. Only `*.stories.*` and `*.test.*` files may import `@weasel-js/forge` or `@weasel-js/labkit`.
- No inline `style` props and no `!important`. Use a CSS module.
- US English. Comments only where the code cannot say it, one or two lines.
- Every changeset is `patch`.
- Commit by path (`git commit -- <paths>`), never `git add -A`. End each commit message with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01V65WLSWA5eiG1k3hqS1QgM
  ```
- Never open a visible browser. Screenshots go through the headless playwright MCP and onto the wall with `transom post`.

## Review Focus

Inputs the spec implies and a person will hit, each pinned by a test in the task named:

1. **Two stages with the same id.** `diagramScene` throws on a repeated node id; a look must keep the first and still draw. (Task 8)
2. **A pipeline with a feedback wire (a cycle).** Finding the main chain must end and give a chain. (Task 9)
3. **An empty pipeline.** Both looks return empty data and `EffectChart` mounts without throwing. (Tasks 8, 9, 10)
4. **A `split` with cuts out of order or the wrong number of outputs.** The `bar` symbol must fall back to `diamond`, not draw ticks in the wrong place. (Task 7)
5. **A wire whose end names a missing stage or port.** It is reported and left out; every other wire still draws. (Tasks 6, 8)

## File Map

| File | Responsibility |
|---|---|
| `packages/diagram/src/portAffordance.ts` (modify) | A port's fill may depend on the port; a port may be drawn round |
| `packages/diagram/src/DiagramView.tsx` (modify) | `ports` prop: show ports with nothing to connect; register the mark painter |
| `packages/diagram/src/outline.ts` (modify) | `'trapezoid'` outline |
| `packages/diagram/src/dataEdges.ts` (create) | Edge and edge-label specs, moved out of `diagramScene` |
| `packages/diagram/src/marks.ts` (create) | Marks: drawings and text a data node carries besides its rows |
| `packages/diagram/src/fromData.ts` (modify) | `DataNode.marks`; calls `edgeSpecs` and `markSpecs` |
| `packages/diagram/src/chain.ts` (create) | `chain` layout |
| `packages/diagram/src/effect/types.ts` (create) | Pipeline types |
| `packages/diagram/src/effect/check.ts` (create) | `checkPipeline` |
| `packages/diagram/src/effect/draw.ts` (create) | What the looks share: colors, styles, wire lookups |
| `packages/diagram/src/effect/symbols.ts` (create) | Branch symbols |
| `packages/diagram/src/effect/nodeGraph.ts` (create) | `nodeGraph` look |
| `packages/diagram/src/effect/mainChain.ts` (create) | Main chain and skip-ahead decisions of a pipeline |
| `packages/diagram/src/effect/rack.ts` (create) | `rack` look |
| `packages/diagram/src/effect/EffectChart.tsx` (create) | The component |
| `packages/diagram/src/effect.entry.ts` (create) | The `@weasel-js/diagram/effect` barrel |
| `packages/diagram/src/effect/lab/samples.ts` (create) | Sample pipelines |
| `packages/diagram/src/effect/lab/EffectLab.stories.tsx` (create) | The lab |

---

### Task 1: Ports that take their color from the port, and round ports

**Files:**
- Modify: `packages/diagram/src/portAffordance.ts`
- Modify: `packages/diagram/src/DiagramView.tsx` (the `portOptions` `Pick`)
- Test: `packages/diagram/src/portAffordance.test.ts` (exists; append)

**Interfaces:**
- Produces: `PortAffordanceOptions.fill?: CommandFill | ((port: Port) => CommandFill)` and `PortAffordanceOptions.shape?: 'square' | 'circle'`. `DiagramViewProps.portOptions` accepts `shape`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/diagram/src/portAffordance.test.ts` (reuse the file's existing imports where they overlap):

```ts
import { createPortAffordance } from './portAffordance';

describe('port paint', () => {
  const STATE = {} as Parameters<ReturnType<typeof createPortAffordance>['regions']>[0];
  const participants = () => [{
    node: {
      id: 'a',
      kind: 'leaf' as const,
      data: { diagram: { ports: [
        { id: 'in', at: { u: 0, v: 0.5 }, type: 'image' },
        { id: 'amt', at: { u: 0, v: 0.8 }, type: 'number' },
      ] } },
    },
    pose: { x: 0, y: 0, width: 100, height: 40 },
  }];

  it('asks the fill function once per port and paints what it answers', () => {
    const fill = (port: { type?: string }) => ({ paint: { color: port.type === 'image' ? '#00f' : '#fa0' } });
    const regions = createPortAffordance(participants, { fill }).regions(STATE);
    expect(regions.map((r) => r.paint)).toEqual([
      { kind: 'square', sizePx: 7, fill: { paint: { color: '#00f' } } },
      { kind: 'square', sizePx: 7, fill: { paint: { color: '#fa0' } } },
    ]);
  });

  it('paints a circle as one path centered on the port in screen pixels', () => {
    const [region] = createPortAffordance(participants, { shape: 'circle', sizePx: 8 }).regions(STATE);
    const paint = region!.paint!;
    expect(paint.kind).toBe('custom');
    if (paint.kind !== 'custom') return;
    const cmds = paint.draw({
      world: { x: 10, y: 20 },
      local: region!.shape,
      view: { x: 5, y: 7, scale: { x: 2, y: 2 } },
      state: STATE,
    });
    expect(cmds).toHaveLength(1);
    const path = (cmds[0] as { path: { coords: Float32Array } }).path;
    const xs = [...path.coords].filter((_, i) => i % 2 === 0);
    const ys = [...path.coords].filter((_, i) => i % 2 === 1);
    // Screen center is pan + world * zoom; read both from `viewToTransform` so the
    // test does not restate the view's own convention.
    const mid = (v: number[]) => (Math.min(...v) + Math.max(...v)) / 2;
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(8, 4);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(8, 4);
    const t = viewToTransform({ x: 5, y: 7, scale: { x: 2, y: 2 } });
    expect(mid(xs)).toBeCloseTo(t.panX + 10 * t.zoom.x, 4);
    expect(mid(ys)).toBeCloseTo(t.panY + 20 * t.zoom.y, 4);
  });
});
```

Add `import { viewToTransform } from '@weasel-js/core';` at the top of the test file.

- [ ] **Step 2: Run and watch both fail**

Run: `npx vitest run --project=weasel-ui packages/diagram/src/portAffordance.test.ts`
Expected: the first fails with a `fill` type error or a paint holding the function itself; the second fails with `expected 'square' to be 'custom'`.

- [ ] **Step 3: Implement**

In `packages/diagram/src/portAffordance.ts`, add `ellipsePath` and `viewToTransform` to the `@weasel-js/core` import, import `type Port` from `./types`, and change the options and the paint:

```ts
  /** One fill for every port, or a function of the port — its `type`, say. */
  fill?: CommandFill | ((port: Port) => CommandFill);
  stroke?: CommandStroke;
  /** Default `'square'`. */
  shape?: 'square' | 'circle';
```

Replace the single precomputed `paint` constant with a function called per port:

```ts
  const paintOf = (port: Port): AffordanceRegion['paint'] => {
    if (sizePx <= 0) return undefined;
    const fill = typeof opts.fill === 'function' ? opts.fill(port) : opts.fill;
    const look = { ...(fill ? { fill } : {}), ...(opts.stroke ? { stroke: opts.stroke } : {}) };
    if (opts.shape !== 'circle') return { kind: 'square', sizePx, ...look };
    return {
      kind: 'custom',
      // An affordance layer paints in screen pixels, so the mark stays one size at any zoom.
      draw: ({ world, view }) => {
        const t = viewToTransform(view);
        const x = t.panX + world.x * t.zoom.x - sizePx / 2;
        const y = t.panY + world.y * t.zoom.y - sizePx / 2;
        return [{ kind: 'path', path: ellipsePath({ x, y, width: sizePx, height: sizePx }), ...look }];
      },
    };
  };
```

In `regions`, replace `...(paint ? { paint } : {})` with:

```ts
            ...withPaint(paintOf(port)),
```

and add beside `portScratchOf`:

```ts
function withPaint(paint: AffordanceRegion['paint']): { paint?: NonNullable<AffordanceRegion['paint']> } {
  return paint === undefined ? {} : { paint };
}
```

In `packages/diagram/src/DiagramView.tsx`, add `'shape'` to the `portOptions` `Pick` list.

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run --project=weasel-ui packages/diagram/src/portAffordance.test.ts packages/diagram/src/portLayer.test.ts`
Expected: PASS, including every test that was there before.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/portAffordance.ts packages/diagram/src/portAffordance.test.ts packages/diagram/src/DiagramView.tsx
git commit -m "let a diagram port take its fill from the port and draw round" -- packages/diagram/src/portAffordance.ts packages/diagram/src/portAffordance.test.ts packages/diagram/src/DiagramView.tsx
```

---

### Task 2: Show ports in a view-only `DiagramView`

**Files:**
- Modify: `packages/diagram/src/DiagramView.tsx`
- Test: `packages/diagram/src/DiagramView.ports.browser.test.tsx` (create)

**Interfaces:**
- Produces: `DiagramViewProps.ports?: 'connect' | 'show' | 'none'`. Unset, it is `'connect'` when `onConnect` is set and `'none'` otherwise, which is today's behavior.

- [ ] **Step 1: Write the failing browser test**

Create `packages/diagram/src/DiagramView.ports.browser.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import { diagramScene } from './fromData';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** One box at world (100, 100), 100 by 60, with one port in the middle of its left edge. */
const SPECS = diagramScene(
  { nodes: [{ id: 'a', lines: [], width: 100, height: 60, at: { x: 100, y: 100 }, ports: [{ id: 'p', at: { u: 0, v: 0.5 } }] }], edges: [] },
  { layout: 'none', nodeStyle: () => ({ fill: '#101010', stroke: '#101010', text: '#101010' }) },
);
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

async function mount(extra: Partial<DiagramViewProps>): Promise<HTMLCanvasElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(DiagramView, {
    specs: SPECS, width: 300, height: 300, view: VIEW, onViewChange: () => {},
    background: { color: '#000000' },
    portOptions: { fill: { paint: { color: '#ff0000' } }, sizePx: 10 },
    ...extra,
  })));
  await frame();
  await frame();
  return host.querySelector('canvas')!;
}

/** RGB at a CSS-pixel point in the canvas, read back from the framebuffer. */
function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  const gl = canvas.getContext('webgl2')!;
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const out = new Uint8Array(4);
  gl.readPixels(Math.round(x * dpr), Math.round(canvas.height - y * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return [out[0]!, out[1]!, out[2]!];
}

describe('DiagramView ports', () => {
  it('paints a port at its world point when ports is "show"', async () => {
    const canvas = await mount({ ports: 'show' });
    expect(pixelAt(canvas, 100, 130)).toEqual([255, 0, 0]);
  });

  it('paints no port when nothing asks for them', async () => {
    const canvas = await mount({});
    expect(pixelAt(canvas, 97, 130)).toEqual([0, 0, 0]);
  });
});
```

If `pixelAt` reads `[0, 0, 0]` everywhere including inside the box, the context does not keep its buffer after presenting. Then read inside the same frame: replace the two `await frame()` calls with one, and call `pixelAt` from a `requestAnimationFrame` callback scheduled before `mount` returns. Settle this on the *first* test before trusting the second, which passes on an all-black read.

- [ ] **Step 2: Run and watch the first fail**

Run: `npx vitest run --project=browser packages/diagram/src/DiagramView.ports.browser.test.tsx`
Expected: "paints a port" fails with `[0, 0, 0]` or `[16, 16, 16]` where `[255, 0, 0]` was expected. The second passes.

- [ ] **Step 3: Implement**

In `DiagramViewProps`, after `onConnect`:

```ts
  /** Whether ports are drawn. `'connect'` draws them and lets one be dragged
   *  onto another; `'show'` only draws them. Default: `'connect'` when
   *  `onConnect` is set, else `'none'`. */
  ports?: 'connect' | 'show' | 'none';
```

In `Inner`, destructure `ports: portMode`, add `portLayer` to the `./portLayer` import, and replace the `connecting` / `ports` / `registerLayer` block with:

```ts
  const mode = portMode ?? (onConnect !== undefined ? 'connect' : 'none');
  const ports = useMemo(() => mode === 'connect'
    ? diagramPorts<RectPose>({
        ...portOptions,
        participants: source,
        ...(canConnect ? { canConnect } : {}),
        commit: ({ from, to }) => onConnectRef.current?.({
          from: from.nodeId, fromPort: from.id, to: to.nodeId, toPort: to.id,
        }),
      })
    : null, [mode, source, canConnect, portOptions, onConnectRef]);
  // A registered layer with no `hitTest` is painted and claims no press.
  const shown = useMemo(() => {
    if (mode !== 'show') return null;
    const { hitTest: _hitTest, ...paintOnly } = portLayer<RectPose>(source, portOptions);
    return paintOnly;
  }, [mode, source, portOptions]);
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  const layer = ports?.layer ?? shown;
  useEffect(() => (layer ? canvasRef.current?.registerLayer(layer) : undefined), [layer]);
```

Leave the `ambient` line as it is: it reads `ports`, which is null outside `'connect'`.

- [ ] **Step 4: Run and watch both pass**

Run: `npx vitest run --project=browser packages/diagram/src/DiagramView.ports.browser.test.tsx`
Then: `npx vitest run --project=weasel-ui packages/diagram/src/DiagramView.view.test.tsx`
Expected: PASS for both.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/DiagramView.tsx packages/diagram/src/DiagramView.ports.browser.test.tsx
git commit -m "draw ports in a DiagramView that has nothing to connect" -- packages/diagram/src/DiagramView.tsx packages/diagram/src/DiagramView.ports.browser.test.tsx
```

---

### Task 3: `'trapezoid'` outline

**Files:**
- Modify: `packages/diagram/src/outline.ts`
- Test: `packages/diagram/src/outline.test.ts` (append; create if absent with `import { describe, expect, it } from 'vitest';`)

**Interfaces:**
- Produces: `Outline` gains `'trapezoid'`: the narrow side on the left, half the box's height, centered.

- [ ] **Step 1: Write the failing test**

```ts
import { boxForContent, contentBox, outlinePath } from './outline';

describe('trapezoid', () => {
  const box = { x: 10, y: 20, width: 40, height: 80 };

  it('runs from a half-height left side to a full-height right side', () => {
    const path = outlinePath('trapezoid', box);
    expect(path.kind).toBe('polygon');
    if (path.kind !== 'polygon') return;
    expect([...path.coords]).toEqual([10, 40, 50, 20, 50, 100, 10, 80]);
  });

  it('keeps content inside the narrow side, and sizes a box to hold it', () => {
    expect(contentBox('trapezoid', box)).toEqual({ x: 10, y: 40, width: 40, height: 40 });
    expect(boxForContent('trapezoid', { width: 40, height: 40 })).toEqual({ width: 40, height: 80 });
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run --project=weasel-ui packages/diagram/src/outline.test.ts`
Expected: FAIL, `'trapezoid'` is not assignable to `Outline` and `outlinePath` returns `undefined`.

- [ ] **Step 3: Implement**

In `outline.ts`:

```ts
export type Outline = 'rect' | 'diamond' | 'stadium' | 'parallelogram' | 'trapezoid' | Path;
```

`outlinePath`, before `case 'stadium'`:

```ts
    case 'trapezoid':
      return polygonFromPoints([
        { x, y: y + h / 4 },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + (h * 3) / 4 },
      ]);
```

`contentBox`:

```ts
    case 'trapezoid':
      return { x, y: y + h / 4, width: w, height: h / 2 };
```

`boxForContent`:

```ts
    case 'trapezoid':
      return { width: content.width, height: content.height * 2 };
```

Update the file's opening comment to name the trapezoid. Then run `npm run typecheck:packages -- diagram` and add a `'trapezoid'` case to any other `switch` over `Outline` it reports.

- [ ] **Step 4: Run and watch it pass**

Run: `npx vitest run --project=weasel-ui packages/diagram/src/outline.test.ts packages/diagram/src/onOutline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/outline.ts packages/diagram/src/outline.test.ts
git commit -m "add a trapezoid outline to diagram bodies" -- packages/diagram/src/outline.ts packages/diagram/src/outline.test.ts
```

---

### Task 4: Marks on a data node

A mark is something a node draws besides its rows: a shape given as SVG path data in a unit square that is stretched over the node's box, or a line of text pinned to a point on the box.

**Files:**
- Create: `packages/diagram/src/dataEdges.ts`
- Create: `packages/diagram/src/marks.ts`
- Modify: `packages/diagram/src/fromData.ts`, `packages/diagram/src/trait.ts`, `packages/diagram/src/DiagramView.tsx`, `packages/diagram/src/index.ts`
- Test: `packages/diagram/src/marks.test.ts` (create)

**Interfaces:**
- Produces, from `./marks`:
  ```ts
  export type DataMark =
    | { d: string; fill?: string; stroke?: string; strokeWidth?: number; dash?: number[]; opacity?: number }
    | { text: string; at: PortAnchor; self?: PortAnchor; offset?: Vec2; color?: string; style?: RowTextStyle };
  export interface DiagramMark { d: string }
  export function diagramMarkOf(node: { data: unknown }): DiagramMark | null;
  export function registerMarkShape<TPose>(opts?: { geometry?: PoseDescriptor<TPose> }): () => void;
  ```
- Produces: `DataNode.marks?: readonly DataMark[]`. A drawn mark is a leaf `<node id>/mark:<i>` under the node; a text mark is a leaf of the same id that depends on the node.

- [ ] **Step 1: Move edge specs out of `diagramScene`, changing nothing**

`diagramScene` is at its recorded 166 lines, so it has to shrink before it can grow. Create `packages/diagram/src/dataEdges.ts`:

```ts
/** The scene specs `diagramScene` makes for edges and their labels. */
import { EDGE_DERIVE_PATH } from './edge';
import type { MeasureRowText } from './body';
import type { DataEdge, DiagramSceneOptions, DiagramSpec, EdgeStyle } from './fromData';
import { LABEL_DERIVE_POSE, type DiagramLabel } from './label';

export interface EdgeSpecContext {
  idOf: (edge: DataEdge) => string;
  font: { fontFamily: string; fontSize: number };
  measure: MeasureRowText;
  fallback: EdgeStyle;
  labelPlacement: DiagramLabel;
  opts: Pick<DiagramSceneOptions, 'edgeStyle' | 'router' | 'labelPlacement'>;
}

export function edgeSpecs(edges: readonly DataEdge[], ctx: EdgeSpecContext): DiagramSpec[] {
  const specs: DiagramSpec[] = [];
  for (const e of edges) {
    const id = ctx.idOf(e);
    const style = ctx.opts.edgeStyle?.(e) ?? ctx.fallback;
    const markerStart = style.markerStart ?? null;
    const markerEnd = style.markerEnd === undefined ? 'arrow' : style.markerEnd;
    specs.push({
      id: id as never,
      kind: 'leaf',
      layer: 'main',
      pickable: false,
      pose: { x: 0, y: 0, width: 0, height: 0 },
      data: {
        diagram: {
          from: e.fromPort ? { port: e.fromPort } : {},
          to: e.toPort ? { port: e.toPort } : {},
          router: e.router ?? ctx.opts.router ?? 'bezier',
          ...(e.waypoints ? { waypoints: e.waypoints } : {}),
        },
        stroke: {
          paint: { color: style.stroke },
          width: style.width ?? 1.5,
          ...(style.dash ? { dash: style.dash } : {}),
          ...(markerStart !== null ? { markerStart } : {}),
          ...(markerEnd !== null ? { markerEnd } : {}),
        },
      },
      dependsOn: [e.from as never, e.to as never],
      derivePath: EDGE_DERIVE_PATH,
    });
    if (!e.label) continue;
    const labelStyle = { ...ctx.font, fontSize: ctx.font.fontSize - 2 };
    specs.push({
      id: `${id}/label` as never,
      kind: 'leaf',
      layer: 'main',
      pickable: false,
      pose: { x: 0, y: 0, width: ctx.measure(e.label, labelStyle).width, height: labelStyle.fontSize },
      data: {
        diagram: { label: e.labelPlacement ?? ctx.opts.labelPlacement ?? ctx.labelPlacement },
        text: e.label,
        style: labelStyle,
        fill: { paint: { color: style.label ?? style.stroke } },
      },
      dependsOn: [id as never],
      derivePose: LABEL_DERIVE_POSE as never,
    });
  }
  return specs;
}
```

In `fromData.ts`, replace the whole `for (const e of edges) { … }` loop at the end of `diagramScene` with:

```ts
  specs.push(...edgeSpecs(edges, { idOf: edgeIdOf, font, measure, fallback: EDGE, labelPlacement: LABEL_PLACEMENT, opts }));
```

and import `edgeSpecs` from `./dataEdges`. Drop the imports `fromData.ts` no longer uses (`EDGE_DERIVE_PATH`, `LABEL_DERIVE_POSE`); keep the `DiagramEdge` and `DiagramLabel` type imports.

Run: `npx vitest run --project=weasel-ui packages/diagram/src/fromData.test.ts`
Expected: PASS, unchanged.

- [ ] **Step 2: Write the failing tests for marks**

Create `packages/diagram/src/marks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { diagramScene, type DiagramData } from './fromData';
import { dataKeyReader } from './trait';
import { diagramMarkOf, markShape } from './marks';

const DATA: DiagramData = {
  nodes: [{
    id: 'a', lines: [], width: 40, height: 80, at: { x: 100, y: 200 },
    marks: [
      { d: 'M0 0.5 H1', stroke: '#fff' },
      { text: '0.5', at: { u: 0, v: 0.5 }, self: { u: 1, v: 0.5 }, offset: { x: -6, y: 0 } },
    ],
  }],
  edges: [],
};
const specs = diagramScene(DATA, { layout: 'none', font: { fontFamily: 'sans-serif', fontSize: 10 } });
const drawn = specs.find((s) => s.id === ('a/mark:0' as never))!;
const text = specs.find((s) => s.id === ('a/mark:1' as never))!;

describe('marks', () => {
  it('makes a drawn mark a child of its node, over the node\'s whole box', () => {
    expect(drawn.parent).toBe('a');
    expect(drawn.pickable).toBe(false);
    expect(drawn.pose).toEqual({ x: 100, y: 200, width: 40, height: 80 });
    expect(diagramMarkOf(drawn)).toEqual({ d: 'M0 0.5 H1' });
  });

  it('does not read a mark as a diagram participant', () => {
    expect(dataKeyReader({ id: 'a/mark:0', kind: 'leaf', data: drawn.data })).toBeNull();
  });

  it('stretches the unit path over the box it is painted in', () => {
    const [cmd] = markShape().paint(drawn as never, drawn.pose as never);
    const path = (cmd as { path: { coords: Float32Array } }).path;
    expect([...path.coords]).toEqual([100, 240, 140, 240]);
  });

  it('pins a text mark to a point on the node, by a point of its own', () => {
    expect(text.dependsOn).toEqual(['a']);
    expect(text.data?.text).toBe('0.5');
    // Right edge 6 left of the node's left edge, centered on its middle.
    const pose = text.pose as { x: number; y: number; width: number; height: number };
    expect(pose.x + pose.width).toBeCloseTo(94, 6);
    expect(pose.y + pose.height / 2).toBeCloseTo(240, 6);
  });
});
```

Run: `npx vitest run --project=weasel-ui packages/diagram/src/marks.test.ts`
Expected: FAIL, `./marks` does not exist.

- [ ] **Step 3: Implement `marks.ts`**

```ts
/**
 * Marks: what a data node draws besides its rows. A drawn mark is SVG path
 * data in a unit square, stretched over the node's box, so it follows the node
 * wherever layout or a drag puts it. A text mark is pinned to a point on the box.
 */
import {
  commandFill,
  commandStroke,
  pathFromD,
  RECT_POSE_DESCRIPTOR,
  registerNodeShape,
  transformPath,
  type Fill,
  type NodeShapeEntry,
  type Path,
  type PoseDescriptor,
  type Stroke,
  type Vec2,
} from '@weasel-js/core';
import type { MeasureRowText, RowTextStyle } from './body';
import type { DiagramSpec, DiagramTextStyle, NodeStyle } from './fromData';
import { ANCHOR_DERIVE_POSE } from './group';
import type { Bounds } from './outline';
import { DIAGRAM_TRAIT_KEY } from './trait';
import type { PortAnchor } from './types';

/** One mark on a `DataNode`. Colors default to the node's stroke and text. */
export type DataMark =
  | { d: string; fill?: string; stroke?: string; strokeWidth?: number; dash?: number[]; opacity?: number }
  | { text: string; at: PortAnchor; self?: PortAnchor; offset?: Vec2; color?: string; style?: RowTextStyle };

/** The trait on a drawn mark's `data`: path data in a unit square. */
export interface DiagramMark { d: string }

export function diagramMarkOf(node: { data: unknown }): DiagramMark | null {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const trait = (data as Record<string, unknown>)[DIAGRAM_TRAIT_KEY];
  if (trait === null || typeof trait !== 'object' || !('mark' in trait)) return null;
  const mark = (trait as { mark: unknown }).mark;
  return mark !== null && typeof mark === 'object' && typeof (mark as DiagramMark).d === 'string'
    ? (mark as DiagramMark)
    : null;
}

const PARSED = new Map<string, Path>();
const PARSED_MAX = 256;

function unitPath(d: string): Path {
  let path = PARSED.get(d);
  if (path === undefined) {
    if (PARSED.size >= PARSED_MAX) PARSED.clear();
    path = pathFromD(d);
    PARSED.set(d, path);
  }
  return path;
}

/** The painter for a drawn mark. */
export function markShape<TPose>(
  opts: { geometry?: PoseDescriptor<TPose> } = {},
): NodeShapeEntry<unknown, TPose> {
  const geometry = opts.geometry ?? (RECT_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  return {
    id: 'diagram:mark',
    matches: (node) => diagramMarkOf(node) !== null,
    paint: (node, pose) => {
      const mark = diagramMarkOf(node);
      if (mark === null) return [];
      const box = geometry.getBounds(pose);
      const d = node.data as { fill?: Fill | null; stroke?: Stroke | null };
      const fill = d.fill && commandFill(d.fill, box);
      const stroke = d.stroke && commandStroke(d.stroke, box);
      return [{
        kind: 'path',
        path: transformPath(unitPath(mark.d), [box.width, 0, 0, box.height, box.x, box.y]),
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke } : {}),
      }];
    },
  };
}

/** Register {@link markShape}; returns the disposer. */
export function registerMarkShape<TPose>(opts: { geometry?: PoseDescriptor<TPose> } = {}): () => void {
  return registerNodeShape(markShape(opts), { priority: 'high' });
}

/** The specs for one node's marks. `box` is where the node stands. */
export function markSpecs(
  nodeId: string,
  marks: readonly DataMark[],
  box: Bounds,
  ctx: { style: NodeStyle; textStyle: (s: RowTextStyle | undefined) => DiagramTextStyle; measure: MeasureRowText },
): DiagramSpec[] {
  return marks.map((mark, i): DiagramSpec => {
    const id = `${nodeId}/mark:${i}` as never;
    if ('d' in mark) {
      const paint = (color: string) => ({ color, ...(mark.opacity !== undefined ? { opacity: mark.opacity } : {}) });
      const stroke = mark.stroke ?? (mark.fill === undefined ? ctx.style.stroke : undefined);
      return {
        id,
        kind: 'leaf',
        layer: 'main',
        parent: nodeId as never,
        pickable: false,
        pose: { x: box.x, y: box.y, width: box.width, height: box.height },
        data: {
          diagram: { mark: { d: mark.d } },
          ...(mark.fill !== undefined ? { fill: { paint: paint(mark.fill) } } : {}),
          ...(stroke !== undefined
            ? { stroke: { paint: paint(stroke), width: mark.strokeWidth ?? 1.5, ...(mark.dash ? { dash: mark.dash } : {}) } }
            : {}),
        },
      };
    }
    const size = ctx.measure(mark.text, mark.style ?? {});
    const self = mark.self ?? mark.at;
    return {
      id,
      kind: 'leaf',
      layer: 'main',
      pickable: false,
      pose: {
        x: box.x + mark.at.u * box.width + (mark.offset?.x ?? 0) - self.u * size.width,
        y: box.y + mark.at.v * box.height + (mark.offset?.y ?? 0) - self.v * size.height,
        width: size.width,
        height: size.height,
      },
      data: {
        diagram: { anchor: { at: mark.at, self, ...(mark.offset ? { offset: mark.offset } : {}) } },
        text: mark.text,
        style: ctx.textStyle(mark.style),
        fill: { paint: { color: mark.color ?? ctx.style.text } },
      },
      dependsOn: [nodeId as never],
      derivePose: ANCHOR_DERIVE_POSE as never,
    };
  });
}
```

- [ ] **Step 4: Wire it in**

`fromData.ts`:

- Import `markSpecs`, `type DataMark`, `type DiagramMark` from `./marks`.
- Add to `DataNode`:
  ```ts
  /** Drawn over the box besides its rows: shapes in a unit square stretched
   *  over it, and text pinned to a point on it. */
  marks?: readonly DataMark[];
  ```
- Widen `DiagramSceneData`:
  ```ts
  diagram?: DiagramNode | DiagramEdge | { label: DiagramLabel } | { anchor: DiagramAnchor } | { mark: DiagramMark };
  fill?: { paint: { color: string; opacity?: number } };
  ```
- In `diagramScene`, directly after the loop that pushes `built.specs` for a node:
  ```ts
    if (n.marks) specs.push(...markSpecs(n.id, n.marks, at, { style, textStyle: styleOf, measure }));
  ```

`trait.ts`, in `dataKeyReader`, widen the exclusion and its comment:

```ts
  if ('label' in trait || 'anchor' in trait || 'mark' in trait) return null;
```

`DiagramView.tsx`: import `registerMarkShape` from `./marks` and register both painters in the one effect:

```ts
  useEffect(() => {
    const disposers = [registerDiagramShape<RectPose>(), registerMarkShape<RectPose>()];
    return () => disposers.forEach((dispose) => dispose());
  }, []);
```

`index.ts`: export `diagramMarkOf`, `markShape`, `registerMarkShape` and the types `DataMark`, `DiagramMark` from `./marks`.

- [ ] **Step 5: Run, then lower the size allowance**

Run: `npx vitest run --project=weasel-ui packages/diagram/src/marks.test.ts packages/diagram/src/fromData.test.ts packages/diagram/src/trait.test.ts`
Expected: PASS.

Run: `npm run check:size -- --update`
Expected: `packages/diagram/src/fromData.ts`'s `longestFunction` in `scripts/check-size.allow.json` drops below 166, or the entry disappears.

- [ ] **Step 6: Commit**

```bash
git add packages/diagram/src/dataEdges.ts packages/diagram/src/marks.ts packages/diagram/src/marks.test.ts packages/diagram/src/fromData.ts packages/diagram/src/trait.ts packages/diagram/src/DiagramView.tsx packages/diagram/src/index.ts scripts/check-size.allow.json
git commit -m "let a diagram data node carry drawn marks and pinned text" -- packages/diagram/src/dataEdges.ts packages/diagram/src/marks.ts packages/diagram/src/marks.test.ts packages/diagram/src/fromData.ts packages/diagram/src/trait.ts packages/diagram/src/DiagramView.tsx packages/diagram/src/index.ts scripts/check-size.allow.json
```

---

### Task 5: `chain` layout

One run of nodes stands on a straight line; everything else hangs beside the chain node it connects to.

**Files:**
- Create: `packages/diagram/src/chain.ts`
- Modify: `packages/diagram/src/layout.ts` (`LayoutOptions`), `packages/diagram/src/layoutAction.ts` (`LAYOUTS`), `packages/diagram/src/fromData.ts` (`LAYOUTS`, the `layout` option's type), `packages/diagram/src/index.ts`, `packages/diagram/src/layout.entry.ts`
- Test: `packages/diagram/src/chain.test.ts` (create)

**Interfaces:**
- Produces: `export const chain: LayoutFn` and
  ```ts
  // LayoutOptions
  /** `chain` only: the ids that stand on the line, in order. Unset, the
   *  longest path through the graph. */
  chain?: readonly string[];
  /** `chain` only: which side of the line everything else hangs on, along
   *  the cross axis. Default `'after'`. */
  chainSide?: 'after' | 'before';
  ```

- [ ] **Step 1: Write the failing tests**

Create `packages/diagram/src/chain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chain } from './chain';
import { graphOf } from './groupFixture';
import type { LayoutResult } from './layout';

// `graphOf` seeds node i at (i, i), 100 by 40.
const IDS = ['src', 'blur', 'mix', 'out', 'osc', 'mask'] as const;
const EDGES = [['src', 'blur'], ['blur', 'mix'], ['mix', 'out'], ['osc', 'blur'], ['mask', 'mix']] as const;
const graph = graphOf(IDS, EDGES, {});
const at = (result: LayoutResult, id: string) => result.get(id) ?? { x: IDS.indexOf(id as never), y: IDS.indexOf(id as never) };
const OPTS = { direction: 'right', chain: ['src', 'blur', 'mix', 'out'] } as const;

describe('chain', () => {
  it('stands the chain on one line, in order', () => {
    const r = chain(graph, OPTS);
    const line = OPTS.chain.map((id) => at(r, id));
    expect(new Set(line.map((p) => p.y)).size).toBe(1);
    expect(line.map((p) => p.x)).toEqual([...line.map((p) => p.x)].sort((a, b) => a - b));
    expect(new Set(line.map((p) => p.x)).size).toBe(4);
  });

  it('hangs each other node past the line, in its chain node\'s column', () => {
    const r = chain(graph, OPTS);
    expect(at(r, 'osc').y).toBeGreaterThan(at(r, 'blur').y + 40);
    expect(at(r, 'osc').x).toBe(at(r, 'blur').x);
    expect(at(r, 'mask').x).toBe(at(r, 'mix').x);
  });

  it('hangs on the other side when asked', () => {
    const r = chain(graph, { ...OPTS, chainSide: 'before' });
    expect(at(r, 'osc').y + 40).toBeLessThan(at(r, 'blur').y);
  });

  it('starts where the graph did, and moves nothing on a second run', () => {
    const r = chain(graph, OPTS);
    const xs = IDS.map((id) => at(r, id).x);
    const ys = IDS.map((id) => at(r, id).y);
    expect([Math.min(...xs), Math.min(...ys)]).toEqual([0, 0]);
    const settled = graphOf(IDS, EDGES, {});
    settled.nodes.forEach((n) => Object.assign(n.bounds, at(r, n.id)));
    expect(chain(settled, OPTS).size).toBe(0);
  });

  it('takes the longest path as the chain when none is named', () => {
    const r = chain(graph, { direction: 'right' });
    expect(new Set(['src', 'blur', 'mix', 'out'].map((id) => at(r, id).y)).size).toBe(1);
  });

  it('answers an empty graph with nothing', () => {
    expect(chain(graphOf([], [], {}), OPTS).size).toBe(0);
  });
});
```

Run: `npx vitest run --project=weasel-ui packages/diagram/src/chain.test.ts`
Expected: FAIL, `./chain` does not exist.

- [ ] **Step 2: Implement**

Add the two options above to `LayoutOptions` in `layout.ts`. Create `packages/diagram/src/chain.ts`:

```ts
/**
 * `chain` — one run of nodes on a straight line, and everything else hung
 * beside the chain node it is nearest to.
 *
 * The signal-chain layout: a rack of effects with their side inputs under
 * them. Each chain node owns a column as long as the widest row hung on it, so
 * two neighbors' hangers never share space. Groups are ignored.
 */
import type { Graph, GraphNode } from './graph';
import { backEdges, ranksOf } from './layered';
import {
  DEFAULT_NODE_GAP,
  DEFAULT_RANK_GAP,
  axesFor,
  extent,
  settle,
  type LayoutFn,
  type Slot,
} from './layout';

/** The nodes that stand on the line: the ids given, or the longest path. */
function lineOf(graph: Graph, ids: readonly string[] | undefined): GraphNode[] {
  if (ids !== undefined && ids.length > 0) {
    const seen = new Set<string>();
    return ids.flatMap((id) => {
      const node = graph.node(id);
      if (node === undefined || seen.has(id)) return [];
      seen.add(id);
      return [node];
    });
  }
  const back = backEdges(graph);
  const ranks = ranksOf(graph, back);
  let end: GraphNode | undefined;
  for (const node of graph.nodes) {
    if (end === undefined || ranks.get(node.id)! > ranks.get(end.id)!) end = node;
  }
  const line: GraphNode[] = [];
  for (let at = end; at !== undefined;) {
    line.unshift(at);
    const rank = ranks.get(at.id)!;
    const edge = graph.incoming(at.id).find((e) => !back.has(e.id) && ranks.get(e.from) === rank - 1);
    at = edge === undefined ? undefined : graph.node(edge.from);
  }
  return line;
}

export const chain: LayoutFn = (graph, opts = {}) => {
  const axes = axesFor(opts.direction);
  const nodeGap = opts.nodeGap ?? DEFAULT_NODE_GAP;
  const rankGap = opts.rankGap ?? DEFAULT_RANK_GAP;
  const line = lineOf(graph, opts.chain);
  if (line.length === 0) return new Map();

  // Breadth-first from the line, so a node hangs on the chain node it is
  // fewest edges from, at that many steps out.
  const owner = new Map<string, string>(line.map((n) => [n.id, n.id]));
  const level = new Map<string, number>(line.map((n) => [n.id, 0]));
  for (let frontier = line.map((n) => n.id); frontier.length > 0;) {
    const next: string[] = [];
    for (const id of frontier) {
      const near = [...graph.incoming(id).map((e) => e.from), ...graph.outgoing(id).map((e) => e.to)];
      for (const other of near) {
        if (owner.has(other) || graph.node(other) === undefined) continue;
        owner.set(other, owner.get(id)!);
        level.set(other, level.get(id)! + 1);
        next.push(other);
      }
    }
    frontier = next;
  }
  const last = line[line.length - 1]!.id;
  for (const node of graph.nodes) {
    if (owner.has(node.id)) continue;
    owner.set(node.id, last);
    level.set(node.id, 1);
  }

  const rows = new Map<string, GraphNode[][]>(line.map((n) => [n.id, []]));
  const levelSize: number[] = [Math.max(...line.map((n) => extent(n.bounds, axes.cross)))];
  for (const node of graph.nodes) {
    const at = level.get(node.id)!;
    if (at === 0) continue;
    const column = rows.get(owner.get(node.id)!)!;
    (column[at] ??= []).push(node);
    levelSize[at] = Math.max(levelSize[at] ?? 0, extent(node.bounds, axes.cross));
  }
  const rowSpan = (row: readonly GraphNode[]) =>
    row.reduce((sum, n) => sum + extent(n.bounds, axes.rank), 0) + nodeGap * Math.max(row.length - 1, 0);
  const before = opts.chainSide === 'before';
  /** The low cross edge of level `at`'s band, the line's own being 0. */
  const bandStart = (at: number): number => {
    let offset = 0;
    for (let k = before ? 1 : 0; k < (before ? at + 1 : at); k++) offset += (levelSize[k] ?? 0) + nodeGap;
    return before ? -offset : offset;
  };

  const slots = new Map<string, Slot>();
  let cursor = 0;
  for (const node of line) {
    const column = rows.get(node.id)!;
    const span = Math.max(extent(node.bounds, axes.rank), ...column.map((row) => (row ? rowSpan(row) : 0)));
    slots.set(node.id, {
      cross: (levelSize[0]! - extent(node.bounds, axes.cross)) / 2,
      rank: cursor + (span - extent(node.bounds, axes.rank)) / 2,
    });
    column.forEach((row, at) => {
      if (!row) return;
      let along = cursor + (span - rowSpan(row)) / 2;
      for (const hung of row) {
        // Hung against the edge of its band that faces the line.
        const cross = before ? bandStart(at) + levelSize[at]! - extent(hung.bounds, axes.cross) : bandStart(at);
        slots.set(hung.id, { cross, rank: along });
        along += extent(hung.bounds, axes.rank) + nodeGap;
      }
    });
    cursor += span + rankGap;
  }
  return settle(graph, slots, opts);
};
```

`bandStart` for `'before'` sums the sizes of levels 1 through `at` and negates, which puts level `at`'s band entirely on the negative side of the line; for `'after'` it sums levels 0 through `at - 1`.

Add `chain` to:
- `LAYOUTS` in `layoutAction.ts` and in `fromData.ts`.
- The `layout` option's type in `DiagramSceneOptions`: `'layered' | 'tree' | 'force' | 'chain' | 'none' | LayoutFn`.
- `index.ts` and `layout.entry.ts`: `export { chain } from './chain';`.

Then run `grep -rn "'layered' | 'tree' | 'force'" packages/diagram/src` and add `'chain'` to every named-layout union it finds (`DiagramView.tsx` has two). If `live.ts`'s `EASED_LAYOUTS` lists layouts by name, add `chain` there.

- [ ] **Step 3: Run and watch them pass**

Run: `npx vitest run --project=weasel-ui packages/diagram/src/chain.test.ts packages/diagram/src/layout.test.ts packages/diagram/src/layoutAction.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/diagram/src/chain.ts packages/diagram/src/chain.test.ts packages/diagram/src/layout.ts packages/diagram/src/layoutAction.ts packages/diagram/src/fromData.ts packages/diagram/src/index.ts packages/diagram/src/layout.entry.ts packages/diagram/src/DiagramView.tsx packages/diagram/src/live.ts
git commit -m "add a chain layout to diagram" -- packages/diagram/src
```

---

### Task 6: Pipeline types and `checkPipeline`

**Files:**
- Create: `packages/diagram/src/effect/types.ts`, `packages/diagram/src/effect/check.ts`
- Test: `packages/diagram/src/effect/check.test.ts`

**Interfaces:**
- Produces, from `./types`: `EffectPipeline`, `EffectStage`, `EffectPort`, `EffectWire`, `EffectGroup`, `EffectType`, exactly as the spec's "Pipeline" section gives them.
- Produces, from `./check`:
  ```ts
  export interface EffectProblem {
    kind: 'missing-stage' | 'missing-port' | 'wrong-direction' | 'type-mismatch'
      | 'duplicate-stage' | 'duplicate-port' | 'missing-member' | 'bad-split';
    message: string;
    stage?: string;
    port?: string;
    /** Index into `pipeline.wires`. */
    wire?: number;
    group?: string;
  }
  export function checkPipeline(pipeline: EffectPipeline): EffectProblem[];
  ```

- [ ] **Step 1: Write `types.ts`**

Copy the six interfaces from the spec's "Pipeline" section verbatim, each exported, under this header:

```ts
/** An effects pipeline as plain data. It says what is wired to what and
 *  nothing about how any of it is drawn. */
```

- [ ] **Step 2: Write the failing tests**

Create `packages/diagram/src/effect/check.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { checkPipeline } from './check';
import type { EffectPipeline } from './types';

const OK: EffectPipeline = {
  stages: [
    { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
    { id: 'blur', title: 'Blur', inputs: [{ id: 'image', type: 'image' }, { id: 'radius', type: 'number' }], outputs: [{ id: 'out', type: 'image' }] },
  ],
  wires: [{ from: { stage: 'src', port: 'out' }, to: { stage: 'blur', port: 'image' } }],
  groups: [{ id: 'g', members: ['blur'] }],
};
const kinds = (p: EffectPipeline) => checkPipeline(p).map((x) => x.kind);
const wire = (from: [string, string], to: [string, string]) =>
  ({ from: { stage: from[0], port: from[1] }, to: { stage: to[0], port: to[1] } });

describe('checkPipeline', () => {
  it('finds nothing wrong with a sound pipeline', () => {
    expect(checkPipeline(OK)).toEqual([]);
  });

  it('names a wire whose stage or port is missing, by its index', () => {
    const p = { ...OK, wires: [...OK.wires, wire(['nope', 'out'], ['blur', 'image']), wire(['src', 'out'], ['blur', 'nope'])] };
    expect(checkPipeline(p).map((x) => [x.kind, x.wire])).toEqual([['missing-stage', 1], ['missing-port', 2]]);
  });

  it('names a wire that starts at an input or ends at an output', () => {
    expect(kinds({ ...OK, wires: [wire(['blur', 'image'], ['blur', 'radius'])] })).toEqual(['wrong-direction']);
    expect(kinds({ ...OK, wires: [wire(['src', 'out'], ['blur', 'out'])] })).toEqual(['wrong-direction']);
  });

  it('names a wire joining two types', () => {
    expect(kinds({ ...OK, wires: [wire(['src', 'out'], ['blur', 'radius'])] })).toEqual(['type-mismatch']);
  });

  it('names a repeated stage id and a repeated port id', () => {
    expect(kinds({ ...OK, stages: [...OK.stages, OK.stages[0]!] })).toEqual(['duplicate-stage']);
    const twice = { id: 'x', title: 'X', inputs: [{ id: 'a', type: 'image' }], outputs: [{ id: 'a', type: 'image' }] };
    expect(kinds({ stages: [twice], wires: [] })).toEqual(['duplicate-port']);
  });

  it('names a group member that does not exist', () => {
    expect(kinds({ ...OK, groups: [{ id: 'g', members: ['blur', 'ghost'] }] })).toEqual(['missing-member']);
  });

  it('accepts a group that holds another group', () => {
    expect(kinds({ ...OK, groups: [{ id: 'inner', members: ['blur'] }, { id: 'outer', members: ['inner'] }] })).toEqual([]);
  });

  it('names a split with a missing input, cuts out of order, or the wrong number of outputs', () => {
    const split = (over: object) => ({
      id: 'gate', title: 'Gate', kind: 'decision',
      inputs: [{ id: 'x', type: 'number' }],
      outputs: [{ id: 'lo', type: 'number' }, { id: 'hi', type: 'number' }],
      split: { input: 'x', at: [0.5] },
      ...over,
    });
    expect(kinds({ stages: [split({})], wires: [] })).toEqual([]);
    expect(kinds({ stages: [split({ split: { input: 'y', at: [0.5] } })], wires: [] })).toEqual(['bad-split']);
    expect(kinds({ stages: [split({ split: { input: 'x', at: [0.8, 0.2] } })], wires: [] })).toEqual(['bad-split']);
    expect(kinds({ stages: [split({ split: { input: 'x', at: [0.2, 0.8] } })], wires: [] })).toEqual(['bad-split']);
    expect(kinds({ stages: [split({ split: { input: 'x', at: [] } })], wires: [] })).toEqual(['bad-split']);
  });

  it('does not throw on an empty pipeline', () => {
    expect(checkPipeline({ stages: [], wires: [] })).toEqual([]);
  });
});
```

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/check.test.ts`
Expected: FAIL, `./check` does not exist.

- [ ] **Step 3: Implement `check.ts`**

```ts
import type { EffectPipeline, EffectStage } from './types';

/** One thing wrong with a pipeline, and where. */
export interface EffectProblem {
  kind: 'missing-stage' | 'missing-port' | 'wrong-direction' | 'type-mismatch'
    | 'duplicate-stage' | 'duplicate-port' | 'missing-member' | 'bad-split';
  message: string;
  stage?: string;
  port?: string;
  /** Index into `pipeline.wires`. */
  wire?: number;
  group?: string;
}

/** What `split` gets wrong on `stage`, or null. */
export function splitProblem(stage: EffectStage): string | null {
  const split = stage.split;
  if (split === undefined) return null;
  if (!(stage.inputs ?? []).some((p) => p.id === split.input)) return `splits on "${split.input}", which is not one of its inputs`;
  if (split.at.length === 0) return 'splits with no cuts';
  if (split.at.some((cut, i) => i > 0 && cut <= split.at[i - 1]!)) return 'has cuts that are not in ascending order';
  const exits = (stage.outputs ?? []).length;
  if (exits !== split.at.length + 1) return `has ${split.at.length} cuts and ${exits} outputs; it needs ${split.at.length + 1}`;
  return null;
}

/** Everything wrong with `pipeline`. Never throws. */
export function checkPipeline(pipeline: EffectPipeline): EffectProblem[] {
  const out: EffectProblem[] = [];
  const stages = new Map<string, EffectStage>();
  for (const stage of pipeline.stages) {
    if (stages.has(stage.id)) {
      out.push({ kind: 'duplicate-stage', stage: stage.id, message: `Stage "${stage.id}" appears more than once.` });
      continue;
    }
    stages.set(stage.id, stage);
    const seen = new Set<string>();
    for (const port of [...(stage.inputs ?? []), ...(stage.outputs ?? [])]) {
      if (seen.has(port.id)) {
        out.push({ kind: 'duplicate-port', stage: stage.id, port: port.id, message: `Stage "${stage.id}" has two ports called "${port.id}".` });
      }
      seen.add(port.id);
    }
    const split = splitProblem(stage);
    if (split !== null) out.push({ kind: 'bad-split', stage: stage.id, message: `Stage "${stage.id}" ${split}.` });
  }

  pipeline.wires.forEach((wire, index) => {
    const ends = ([['from', 'outputs', 'inputs'], ['to', 'inputs', 'outputs']] as const).map(([end, own, other]) => {
      const ref = wire[end];
      const stage = stages.get(ref.stage);
      if (stage === undefined) {
        out.push({ kind: 'missing-stage', wire: index, stage: ref.stage, message: `Wire ${index} names stage "${ref.stage}", which does not exist.` });
        return null;
      }
      const port = (stage[own] ?? []).find((p) => p.id === ref.port);
      if (port !== undefined) return port;
      const wrong = (stage[other] ?? []).some((p) => p.id === ref.port);
      out.push(wrong
        ? { kind: 'wrong-direction', wire: index, stage: ref.stage, port: ref.port, message: `Wire ${index} ${end === 'from' ? 'starts at an input' : 'ends at an output'}, "${ref.stage}.${ref.port}".` }
        : { kind: 'missing-port', wire: index, stage: ref.stage, port: ref.port, message: `Wire ${index} names port "${ref.stage}.${ref.port}", which does not exist.` });
      return null;
    });
    const [from, to] = ends;
    if (from && to && from.type !== to.type) {
      out.push({ kind: 'type-mismatch', wire: index, message: `Wire ${index} joins a "${from.type}" output to a "${to.type}" input.` });
    }
  });

  const groupIds = new Set((pipeline.groups ?? []).map((g) => g.id));
  for (const group of pipeline.groups ?? []) {
    for (const member of group.members) {
      if (stages.has(member) || groupIds.has(member)) continue;
      out.push({ kind: 'missing-member', group: group.id, message: `Group "${group.id}" names "${member}", which is neither a stage nor a group.` });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/check.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/effect/types.ts packages/diagram/src/effect/check.ts packages/diagram/src/effect/check.test.ts
git commit -m "effect pipeline types and checkPipeline" -- packages/diagram/src/effect
```

---

### Task 7: Shared drawing helpers and branch symbols

**Files:**
- Create: `packages/diagram/src/effect/draw.ts`, `packages/diagram/src/effect/symbols.ts`
- Test: `packages/diagram/src/effect/symbols.test.ts`

**Interfaces:**
- Consumes: Task 4's `DataMark`; Task 3's `'trapezoid'`; Task 6's types and `splitProblem`.
- Produces, from `./draw`:
  ```ts
  export type TypeColor = (type: string | undefined) => string;
  export interface EffectLookResult { data: DiagramData; scene: DiagramSceneOptions; color: TypeColor }
  export type EffectLook<TOptions = unknown> = (pipeline: EffectPipeline, options?: TOptions) => EffectLookResult;
  export function typeColors(pipeline: EffectPipeline, given?: Readonly<Record<string, string>>): TypeColor;
  export function isControl(pipeline: EffectPipeline, type: string | undefined): boolean;
  export function stageStyle(stage: EffectStage): NodeStyle;
  export function wireStyle(color: string, control: boolean, problem: boolean): EdgeStyle;
  /** Stages with the repeats dropped, first one kept. */
  export function uniqueStages(pipeline: EffectPipeline): EffectStage[];
  export function portOn(stage: EffectStage | undefined, id: string): EffectPort | undefined;
  export function kindOf(stage: EffectStage): 'stage' | 'decision' | 'source' | 'sink';
  export const PROBLEM_COLOR: string;
  ```
- Produces, from `./symbols`:
  ```ts
  export type BranchChoice = 'auto' | 'diamond' | 'bar' | 'demux' | 'switch';
  export type BranchNode = Pick<DataNode, 'outline' | 'lines' | 'rows' | 'ports' | 'marks' | 'width' | 'height' | 'padding'>;
  export type BranchSymbol = (stage: EffectStage, pipeline: EffectPipeline) => BranchNode;
  export const BRANCH_SYMBOLS: Readonly<Record<Exclude<BranchChoice, 'auto'>, BranchSymbol>>;
  /** The node a decision draws as, after `choice`'s fallbacks. */
  export function branchNode(stage: EffectStage, pipeline: EffectPipeline, choice?: BranchChoice): BranchNode;
  export function symbolNameFor(stage: EffectStage, choice?: BranchChoice): Exclude<BranchChoice, 'auto'>;
  ```
  Every `BranchNode.ports` entry has the stage port's own `id` and `type`.

- [ ] **Step 1: Write `draw.ts`**

```ts
/** What every look shares: how a type is colored, how a stage and a wire are
 *  styled, and the lookups a look does over a pipeline. */
import type { DiagramData, DiagramSceneOptions, EdgeStyle, NodeStyle } from '../fromData';
import type { EffectPipeline, EffectPort, EffectStage } from './types';

export type TypeColor = (type: string | undefined) => string;

/** What a look hands back: `diagramScene`'s two arguments, and its colors. */
export interface EffectLookResult {
  data: DiagramData;
  scene: DiagramSceneOptions;
  color: TypeColor;
}

/** One way of drawing a pipeline. */
export type EffectLook<TOptions = unknown> = (pipeline: EffectPipeline, options?: TOptions) => EffectLookResult;

const PALETTE = ['#6fb3ff', '#c58bff', '#f2c14e', '#5ad07f', '#ff8a6b', '#4fd1c5', '#e58fb8', '#b0bec5'];
const UNTYPED = '#8aa2b5';
export const PROBLEM_COLOR = '#ff5d5d';

const NORMAL: NodeStyle = { fill: '#16222c', stroke: '#3d566b', text: '#dbe7f2', strokeWidth: 1.5 };
const BYPASSED: NodeStyle = { fill: '#121a21', stroke: '#3d566b', text: '#6d8496', strokeWidth: 1.5, dash: [4, 3] };

/** A color per type: the one given, or the next in the palette in the order
 *  types first appear on the pipeline's ports. */
export function typeColors(pipeline: EffectPipeline, given: Readonly<Record<string, string>> = {}): TypeColor {
  const colors = new Map<string, string>();
  for (const stage of pipeline.stages) {
    for (const port of [...(stage.inputs ?? []), ...(stage.outputs ?? [])]) {
      if (colors.has(port.type)) continue;
      colors.set(port.type, given[port.type] ?? PALETTE[colors.size % PALETTE.length]!);
    }
  }
  return (type) => (type === undefined ? UNTYPED : colors.get(type) ?? given[type] ?? UNTYPED);
}

export function isControl(pipeline: EffectPipeline, type: string | undefined): boolean {
  return type !== undefined && pipeline.types?.[type]?.control === true;
}

export function stageStyle(stage: EffectStage): NodeStyle {
  return stage.bypassed === true ? BYPASSED : NORMAL;
}

export function wireStyle(color: string, control: boolean, problem: boolean): EdgeStyle {
  return {
    stroke: problem ? PROBLEM_COLOR : color,
    width: 2,
    markerEnd: null,
    ...(control ? { dash: [5, 4] } : {}),
  };
}

export function uniqueStages(pipeline: EffectPipeline): EffectStage[] {
  const seen = new Set<string>();
  return pipeline.stages.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

export function portOn(stage: EffectStage | undefined, id: string): EffectPort | undefined {
  return [...(stage?.inputs ?? []), ...(stage?.outputs ?? [])].find((p) => p.id === id);
}

export function kindOf(stage: EffectStage): 'stage' | 'decision' | 'source' | 'sink' {
  return stage.kind === 'decision' || stage.kind === 'source' || stage.kind === 'sink' ? stage.kind : 'stage';
}
```

- [ ] **Step 2: Write the failing symbol tests**

Create `packages/diagram/src/effect/symbols.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { branchNode, symbolNameFor } from './symbols';
import type { EffectPipeline, EffectStage } from './types';

const P: EffectPipeline = { stages: [], wires: [], types: { bool: { control: true } } };
const yesNo: EffectStage = {
  id: 'q', title: 'high?', kind: 'decision',
  inputs: [{ id: 'in', type: 'image' }, { id: 'when', type: 'bool' }],
  outputs: [{ id: 'yes', type: 'image' }, { id: 'no', type: 'image' }],
};
const bands: EffectStage = {
  id: 'b', title: 'Band', kind: 'decision',
  inputs: [{ id: 'x', type: 'number' }],
  outputs: [{ id: 'low', type: 'number' }, { id: 'mid', type: 'number' }, { id: 'high', type: 'number' }],
  split: { input: 'x', at: [0.2, 0.8] },
};
const ids = (stage: EffectStage, choice?: Parameters<typeof branchNode>[2]) =>
  (branchNode(stage, P, choice).ports ?? []).map((p) => p.id).sort();
const port = (stage: EffectStage, id: string, choice?: Parameters<typeof branchNode>[2]) =>
  branchNode(stage, P, choice).ports!.find((p) => p.id === id)!;

describe('branch symbols', () => {
  it('gives every symbol a port for each of the stage\'s ports, carrying its type', () => {
    for (const choice of ['diamond', 'demux', 'switch'] as const) {
      expect(ids(yesNo, choice)).toEqual(['in', 'no', 'when', 'yes']);
      expect(port(yesNo, 'when', choice).type).toBe('bool');
    }
    expect(ids(bands, 'bar')).toEqual(['high', 'low', 'mid', 'x']);
  });

  it('picks the bar for a split and the diamond otherwise', () => {
    expect(symbolNameFor(bands)).toBe('bar');
    expect(symbolNameFor(yesNo)).toBe('diamond');
  });

  it('falls back to the diamond where a symbol cannot draw the stage', () => {
    expect(symbolNameFor(yesNo, 'bar')).toBe('diamond');
    expect(symbolNameFor(bands, 'switch')).toBe('diamond');
    expect(symbolNameFor({ ...bands, split: { input: 'x', at: [0.8, 0.2] } }, 'bar')).toBe('diamond');
    expect(symbolNameFor({ ...bands, split: { input: 'x', at: [0.5] } })).toBe('diamond');
  });

  it('puts a diamond\'s control input on top and its two exits right and bottom', () => {
    expect(port(yesNo, 'in', 'diamond').at).toEqual({ u: 0, v: 0.5 });
    expect(port(yesNo, 'when', 'diamond').at).toEqual({ u: 0.5, v: 0 });
    expect(port(yesNo, 'yes', 'diamond').at).toEqual({ u: 1, v: 0.5 });
    expect(port(yesNo, 'no', 'diamond').at).toEqual({ u: 0.5, v: 1 });
  });

  it('stacks a bar\'s bands lowest at the bottom, with a tick and its value at each cut', () => {
    const node = branchNode(bands, P, 'bar');
    expect(port(bands, 'low', 'bar').at.v).toBeCloseTo(5 / 6, 6);
    expect(port(bands, 'high', 'bar').at.v).toBeCloseTo(1 / 6, 6);
    const ticks = node.marks!.filter((m) => 'd' in m && m.stroke !== undefined);
    expect(ticks.map((m) => 'd' in m && m.d)).toEqual(['M-0.25 0.6666666666666667 H1.25', 'M-0.25 0.33333333333333337 H1.25']);
    expect(node.marks!.filter((m) => 'text' in m).map((m) => 'text' in m && m.text)).toEqual(['0.2', '0.8', 'Band']);
  });

  it('draws a demux as a trapezoid with its exits down the wide side', () => {
    const node = branchNode(yesNo, P, 'demux');
    expect(node.outline).toBe('trapezoid');
    expect(port(yesNo, 'yes', 'demux').at.u).toBe(1);
    expect(port(yesNo, 'when', 'demux').at.v).toBe(0);
  });
});
```

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/symbols.test.ts`
Expected: FAIL, `./symbols` does not exist.

- [ ] **Step 3: Implement `symbols.ts`**

```ts
/**
 * Branch symbols: the node a decision stage draws as. Each answers with the
 * outline, ports and marks of a diagram data node; a look adds the id and the
 * style. All of them read left to right: signal in on the left, exits on the right.
 */
import type { DataNode } from '../fromData';
import type { DataMark } from '../marks';
import type { PortAnchor, PortSpec } from '../types';
import { splitProblem } from './check';
import { isControl } from './draw';
import type { EffectPipeline, EffectPort, EffectStage } from './types';

export type BranchChoice = 'auto' | 'diamond' | 'bar' | 'demux' | 'switch';
export type BranchNode = Pick<DataNode, 'outline' | 'lines' | 'rows' | 'ports' | 'marks' | 'width' | 'height' | 'padding'>;
export type BranchSymbol = (stage: EffectStage, pipeline: EffectPipeline) => BranchNode;

type Side = 'left' | 'top' | 'right' | 'bottom';

/** The `i`th of `n` points spread evenly along one side of the box. */
function along(side: Side, i: number, n: number): PortAnchor {
  const t = (i + 1) / (n + 1);
  if (side === 'left') return { u: 0, v: t };
  if (side === 'right') return { u: 1, v: t };
  return side === 'top' ? { u: t, v: 0 } : { u: t, v: 1 };
}

const spread = (ports: readonly EffectPort[], side: Side): PortSpec[] =>
  ports.map((p, i) => ({ id: p.id, type: p.type, at: along(side, i, ports.length) }));

/** Inputs split into the signal (left) and what steers the branch (top). */
function inputs(stage: EffectStage, pipeline: EffectPipeline, steer?: string): PortSpec[] {
  const all = stage.inputs ?? [];
  const top = all.filter((p) => isControl(pipeline, p.type) || (p.id === steer && all.length > 1));
  return [...spread(all.filter((p) => !top.includes(p)), 'left'), ...spread(top, 'top')];
}

const title = (stage: EffectStage): DataMark =>
  ({ text: stage.title, at: { u: 0.5, v: 1 }, self: { u: 0.5, v: 0 }, offset: { x: 0, y: 4 } });

const diamond: BranchSymbol = (stage, pipeline) => {
  const exits = stage.outputs ?? [];
  const out: PortSpec[] = exits.length === 2
    ? [{ id: exits[0]!.id, type: exits[0]!.type, at: { u: 1, v: 0.5 } }, { id: exits[1]!.id, type: exits[1]!.type, at: { u: 0.5, v: 1 } }]
    : spread(exits, 'right');
  return { outline: 'diamond', lines: [stage.title], ports: [...inputs(stage, pipeline), ...out] };
};

const BAND_TINTS = ['#c58bff', '#6fb3ff', '#5ad07f', '#f2c14e'];

const bar: BranchSymbol = (stage, pipeline) => {
  const cuts = stage.split!.at;
  const exits = stage.outputs ?? [];
  const n = exits.length;
  const marks: DataMark[] = [];
  exits.forEach((_, i) => {
    const top = 1 - (i + 1) / n;
    marks.push({ d: `M0 ${top} H1 V${1 - i / n} H0 Z`, fill: BAND_TINTS[i % BAND_TINTS.length]!, opacity: 0.3 });
  });
  cuts.forEach((_, k) => marks.push({ d: `M-0.25 ${1 - (k + 1) / n} H1.25`, stroke: '#dbe7f2' }));
  cuts.forEach((cut, k) => marks.push({
    text: String(cut), at: { u: 0, v: 1 - (k + 1) / n }, self: { u: 1, v: 0.5 }, offset: { x: -10, y: 0 },
  }));
  marks.push(title(stage));
  return {
    outline: 'rect',
    lines: [],
    padding: 0,
    width: 24,
    height: Math.max(72, 30 * n),
    ports: [
      ...inputs(stage, pipeline, stage.split!.input),
      ...exits.map((p, i): PortSpec => ({ id: p.id, type: p.type, at: { u: 1, v: 1 - (i + 0.5) / n } })),
    ],
    marks,
  };
};

const demux: BranchSymbol = (stage, pipeline) => {
  const exits = stage.outputs ?? [];
  return {
    outline: 'trapezoid',
    lines: [],
    padding: 0,
    width: 44,
    height: Math.max(64, 28 * exits.length),
    ports: [...inputs(stage, pipeline), ...spread(exits, 'right')],
    marks: [title(stage)],
  };
};

/** A filled dot of radius `r` at (`cx`, `cy`), in the unit square. */
const dot = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

const switchSymbol: BranchSymbol = (stage, pipeline) => {
  const exits = stage.outputs ?? [];
  return {
    outline: 'rect',
    lines: [],
    padding: 0,
    width: 48,
    height: 48,
    ports: [
      ...inputs(stage, pipeline),
      ...exits.map((p, i): PortSpec => ({ id: p.id, type: p.type, at: { u: 1, v: i === 0 ? 0.25 : 0.75 } })),
    ],
    marks: [
      { d: 'M0 0.5 H0.2 M0.8 0.25 H1 M0.8 0.75 H1', stroke: '#dbe7f2' },
      { d: 'M0.2 0.5 L0.78 0.27', stroke: '#dbe7f2', strokeWidth: 2.5 },
      { d: dot(0.2, 0.5, 0.07), fill: '#dbe7f2' },
      { d: dot(0.8, 0.25, 0.07), fill: '#dbe7f2' },
      { d: dot(0.8, 0.75, 0.07), stroke: '#dbe7f2' },
      title(stage),
    ],
  };
};

export const BRANCH_SYMBOLS: Readonly<Record<Exclude<BranchChoice, 'auto'>, BranchSymbol>> = Object.freeze({
  diamond,
  bar,
  demux,
  switch: switchSymbol,
});

/** The symbol `choice` comes to for `stage`: `bar` needs a sound split, `switch` two exits. */
export function symbolNameFor(stage: EffectStage, choice: BranchChoice = 'auto'): Exclude<BranchChoice, 'auto'> {
  const splits = stage.split !== undefined && splitProblem(stage) === null;
  const want = choice === 'auto' ? (splits ? 'bar' : 'diamond') : choice;
  if (want === 'bar' && !splits) return 'diamond';
  if (want === 'switch' && (stage.outputs ?? []).length !== 2) return 'diamond';
  return want;
}

export function branchNode(stage: EffectStage, pipeline: EffectPipeline, choice: BranchChoice = 'auto'): BranchNode {
  return BRANCH_SYMBOLS[symbolNameFor(stage, choice)](stage, pipeline);
}
```

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/symbols.test.ts`
Expected: PASS. If the tick `d` strings differ only in float digits, compare each tick's number with `toBeCloseTo` instead of the whole string.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/src/effect/draw.ts packages/diagram/src/effect/symbols.ts packages/diagram/src/effect/symbols.test.ts
git commit -m "branch symbols for effect pipeline decisions" -- packages/diagram/src/effect
```

---

### Task 8: `nodeGraph` look

**Files:**
- Create: `packages/diagram/src/effect/nodeGraph.ts`
- Test: `packages/diagram/src/effect/nodeGraph.test.ts`

**Interfaces:**
- Consumes: `checkPipeline`; everything `./draw` exports; `branchNode`, `BranchChoice`.
- Produces:
  ```ts
  export interface NodeGraphOptions {
    router?: DiagramRouter;
    nodeGap?: number;
    rankGap?: number;
    colors?: Readonly<Record<string, string>>;
    /** Default true. */
    showParams?: boolean;
    branch?: BranchChoice;
  }
  export const nodeGraph: EffectLook<NodeGraphOptions>;
  /** Shared with `rack`: the wires worth drawing, each with what it carries. */
  export function drawableWires(pipeline: EffectPipeline): DrawableWire[];
  export interface DrawableWire { wire: EffectWire; index: number; type: string | undefined; problem: boolean; fromStage: EffectStage; toStage: EffectStage }
  ```

- [ ] **Step 1: Write the failing tests**

Create `packages/diagram/src/effect/nodeGraph.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { diagramScene, edgeIdOf } from '../fromData';
import { PROBLEM_COLOR } from './draw';
import { nodeGraph } from './nodeGraph';
import type { EffectPipeline } from './types';

const w = (from: [string, string], to: [string, string], label?: string) =>
  ({ from: { stage: from[0], port: from[1] }, to: { stage: to[0], port: to[1] }, ...(label ? { label } : {}) });

const P: EffectPipeline = {
  types: { bool: { control: true } },
  stages: [
    { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
    { id: 'q', title: 'high?', kind: 'decision', inputs: [{ id: 'in', type: 'image' }],
      outputs: [{ id: 'yes', type: 'image', label: 'yes' }, { id: 'no', type: 'image', label: 'no' }] },
    { id: 'blur', title: 'Blur', bypassed: true, params: [{ label: 'radius', value: '6 px' }],
      inputs: [{ id: 'image', type: 'image' }, { id: 'on', type: 'bool' }], outputs: [{ id: 'out', type: 'image' }] },
    { id: 'flag', title: 'Flag', outputs: [{ id: 'out', type: 'bool' }] },
  ],
  wires: [w(['src', 'out'], ['q', 'in']), w(['q', 'yes'], ['blur', 'image']), w(['flag', 'out'], ['blur', 'on'])],
  groups: [{ id: 'g', label: 'Soften', members: ['blur'] }],
};

describe('nodeGraph', () => {
  const { data, scene, color } = nodeGraph(P);
  const node = (id: string) => data.nodes.find((n) => n.id === id)!;

  it('makes one node per stage, by stage id, and passes groups through', () => {
    expect(data.nodes.map((n) => n.id)).toEqual(['src', 'q', 'blur', 'flag']);
    expect(data.groups).toEqual([{ id: 'g', label: 'Soften', members: ['blur'] }]);
  });

  it('gives a stage a title row, a ports row with inputs left and outputs right, then its params', () => {
    expect(node('blur').rows).toEqual([
      { kind: 'label', text: 'Blur', style: { bold: true } },
      { kind: 'ports',
        left: [{ id: 'image', label: 'image', type: 'image' }, { id: 'on', label: 'on', type: 'bool' }],
        right: [{ id: 'out', label: 'out', type: 'image' }] },
      { kind: 'field', label: 'radius', value: '6 px' },
    ]);
  });

  it('leaves the params out when asked', () => {
    const rows = nodeGraph(P, { showParams: false }).data.nodes.find((n) => n.id === 'blur')!.rows!;
    expect(rows.some((r) => r.kind === 'field')).toBe(false);
  });

  it('draws a source as a stadium and a decision as its branch symbol', () => {
    expect(node('src').outline).toBe('stadium');
    expect(node('q').outline).toBe('diamond');
    expect(nodeGraph(P, { branch: 'demux' }).data.nodes.find((n) => n.id === 'q')!.outline).toBe('trapezoid');
  });

  it('runs each wire port to port, labels a decision exit, and dashes a control wire', () => {
    expect(data.edges).toEqual([
      { from: 'src', fromPort: 'out', to: 'q', toPort: 'in' },
      { from: 'q', fromPort: 'yes', to: 'blur', toPort: 'image', label: 'yes' },
      { from: 'flag', fromPort: 'out', to: 'blur', toPort: 'on' },
    ]);
    expect(scene.edgeStyle!(data.edges[0]!).stroke).toBe(color('image'));
    expect(scene.edgeStyle!(data.edges[0]!).dash).toBeUndefined();
    expect(scene.edgeStyle!(data.edges[2]!).dash).toEqual([5, 4]);
  });

  it('dashes a bypassed stage\'s outline', () => {
    expect(scene.nodeStyle!(node('blur')).dash).toEqual([4, 3]);
    expect(scene.nodeStyle!(node('src')).dash).toBeUndefined();
  });

  it('lays out with layered, flowing right', () => {
    expect(scene.layout).toBe('layered');
    expect(scene.layoutOptions?.direction).toBe('right');
  });

  it('draws a mismatched wire in the problem color and leaves out a wire with a missing end', () => {
    const bad = nodeGraph({ ...P, wires: [...P.wires, w(['flag', 'out'], ['blur', 'image']), w(['ghost', 'out'], ['blur', 'image'])] });
    expect(bad.data.edges).toHaveLength(4);
    expect(bad.scene.edgeStyle!(bad.data.edges[3]!).stroke).toBe(PROBLEM_COLOR);
  });

  it('keeps the first of two stages sharing an id, so diagramScene does not throw', () => {
    const twice = nodeGraph({ ...P, stages: [...P.stages, { id: 'blur', title: 'Blur again' }] });
    expect(twice.data.nodes.filter((n) => n.id === 'blur')).toHaveLength(1);
    expect(() => diagramScene(twice.data, twice.scene)).not.toThrow();
  });

  it('draws a stage with no ports as a box with its title', () => {
    const bare = nodeGraph({ stages: [{ id: 'x', title: 'X' }], wires: [] });
    expect(bare.data.nodes[0]!.rows).toEqual([{ kind: 'label', text: 'X', style: { bold: true } }]);
  });

  it('answers an empty pipeline with empty data that diagramScene accepts', () => {
    const empty = nodeGraph({ stages: [], wires: [] });
    expect(empty.data).toEqual({ nodes: [], edges: [], groups: [] });
    expect(diagramScene(empty.data, empty.scene)).toEqual([]);
  });

  it('builds a scene whose edge ids are unique', () => {
    const specs = diagramScene(data, scene);
    const ids = data.edges.map(edgeIdOf);
    expect(new Set(ids).size).toBe(ids.length);
    expect(specs.filter((s) => s.kind === 'container').map((s) => s.id)).toEqual(['src', 'q', 'blur', 'flag']);
  });
});
```

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/nodeGraph.test.ts`
Expected: FAIL, `./nodeGraph` does not exist.

- [ ] **Step 2: Implement `nodeGraph.ts`**

```ts
/** The node-graph look: every port a named row, a wire from port to port in
 *  the color of what it carries, flowing left to right. */
import type { Row } from '../body';
import { edgeIdOf, type DataEdge, type DataNode, type DiagramRouter, type EdgeStyle, type NodeStyle } from '../fromData';
import { checkPipeline } from './check';
import { isControl, kindOf, portOn, stageStyle, typeColors, uniqueStages, wireStyle, type EffectLook } from './draw';
import { branchNode, type BranchChoice } from './symbols';
import type { EffectPipeline, EffectStage, EffectWire } from './types';

export interface NodeGraphOptions {
  /** Default `'bezier'`. */
  router?: DiagramRouter;
  nodeGap?: number;
  rankGap?: number;
  /** A color per value type, over the palette's own. */
  colors?: Readonly<Record<string, string>>;
  /** Default true. */
  showParams?: boolean;
  /** Default `'auto'`. */
  branch?: BranchChoice;
}

/** A wire with both ends present, and what a look needs to draw it. */
export interface DrawableWire {
  wire: EffectWire;
  /** Index into `pipeline.wires`. */
  index: number;
  type: string | undefined;
  /** `checkPipeline` reported it. */
  problem: boolean;
  fromStage: EffectStage;
  toStage: EffectStage;
}

export function drawableWires(pipeline: EffectPipeline): DrawableWire[] {
  const stages = new Map(uniqueStages(pipeline).map((s) => [s.id, s]));
  const flagged = new Set(checkPipeline(pipeline).flatMap((p) => (p.wire === undefined ? [] : [p.wire])));
  return pipeline.wires.flatMap((wire, index) => {
    const fromStage = stages.get(wire.from.stage);
    const toStage = stages.get(wire.to.stage);
    const from = portOn(fromStage, wire.from.port);
    if (fromStage === undefined || toStage === undefined || from === undefined || portOn(toStage, wire.to.port) === undefined) return [];
    return [{ wire, index, type: from.type, problem: flagged.has(index), fromStage, toStage }];
  });
}

/** The rows of an ordinary stage: title, ports, params. */
export function stageRows(stage: EffectStage, showParams: boolean, withPorts: boolean): Row[] {
  const rows: Row[] = [{ kind: 'label', text: stage.title, style: { bold: true } }];
  const side = (ports: EffectStage['inputs']) => (ports ?? []).map((p) => ({ id: p.id, label: p.label ?? p.id, type: p.type }));
  if (withPorts && ((stage.inputs?.length ?? 0) > 0 || (stage.outputs?.length ?? 0) > 0)) {
    rows.push({ kind: 'ports', left: side(stage.inputs), right: side(stage.outputs) });
  }
  if (showParams) for (const p of stage.params ?? []) rows.push({ kind: 'field', label: p.label, value: p.value });
  return rows;
}

/** What a decision's exit is called on its wire. */
export function exitLabel(d: DrawableWire): string | undefined {
  if (d.wire.label !== undefined) return d.wire.label;
  return kindOf(d.fromStage) === 'decision' ? portOn(d.fromStage, d.wire.from.port)?.label : undefined;
}

export const nodeGraph: EffectLook<NodeGraphOptions> = (pipeline, options = {}) => {
  const color = typeColors(pipeline, options.colors);
  const stages = uniqueStages(pipeline);
  const styles = new Map<string, NodeStyle>(stages.map((s) => [s.id, stageStyle(s)]));

  const nodes = stages.map((stage): DataNode => {
    const kind = kindOf(stage);
    if (kind === 'decision') return { id: stage.id, ...branchNode(stage, pipeline, options.branch) };
    return {
      id: stage.id,
      outline: kind === 'stage' ? 'rect' : 'stadium',
      rows: stageRows(stage, options.showParams !== false, true),
    };
  });

  const edgeStyles = new Map<string, EdgeStyle>();
  const edges = drawableWires(pipeline).map((d): DataEdge => {
    const label = exitLabel(d);
    const edge: DataEdge = {
      from: d.wire.from.stage, fromPort: d.wire.from.port,
      to: d.wire.to.stage, toPort: d.wire.to.port,
      ...(label !== undefined ? { label } : {}),
    };
    edgeStyles.set(edgeIdOf(edge), wireStyle(color(d.type), isControl(pipeline, d.type), d.problem));
    return edge;
  });

  return {
    data: { nodes, edges, groups: [...(pipeline.groups ?? [])] },
    scene: {
      layout: 'layered',
      layoutOptions: {
        direction: 'right',
        ...(options.nodeGap !== undefined ? { nodeGap: options.nodeGap } : {}),
        ...(options.rankGap !== undefined ? { rankGap: options.rankGap } : {}),
      },
      router: options.router ?? 'bezier',
      nodeStyle: (n) => styles.get(n.id) ?? stageStyle({ id: n.id, title: '' }),
      edgeStyle: (e) => edgeStyles.get(edgeIdOf(e)) ?? wireStyle(color(undefined), false, false),
    },
    color,
  };
};
```

- [ ] **Step 3: Run and watch them pass**

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/nodeGraph.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/diagram/src/effect/nodeGraph.ts packages/diagram/src/effect/nodeGraph.test.ts
git commit -m "nodeGraph look for effect pipelines" -- packages/diagram/src/effect
```

---

### Task 9: `rack` look

**Files:**
- Create: `packages/diagram/src/effect/mainChain.ts`, `packages/diagram/src/effect/rack.ts`
- Test: `packages/diagram/src/effect/mainChain.test.ts`, `packages/diagram/src/effect/rack.test.ts`

**Interfaces:**
- Consumes: Task 5's `chain` layout options; Task 8's `drawableWires`, `stageRows`, `exitLabel`.
- Produces, from `./mainChain`:
  ```ts
  /** Stage ids of the longest path over data wires, sources first. */
  export function mainChain(pipeline: EffectPipeline): string[];
  export interface Skip { decision: EffectStage; into: DrawableWire; through: DrawableWire; skip: DrawableWire }
  /** The decisions on `line` that only choose between going on and skipping ahead. */
  export function skipDecisions(pipeline: EffectPipeline, line: readonly string[]): Skip[];
  ```
- Produces, from `./rack`:
  ```ts
  export interface RackOptions {
    chain?: readonly string[];
    /** Where what feeds the chain from the side sits. Default `'below'`. */
    side?: 'below' | 'above';
    nodeGap?: number;
    rankGap?: number;
    colors?: Readonly<Record<string, string>>;
    showParams?: boolean;
    branch?: BranchChoice;
    /** Default true. */
    collapseSkips?: boolean;
  }
  export const rack: EffectLook<RackOptions>;
  ```

- [ ] **Step 1: Write the failing `mainChain` tests**

Create `packages/diagram/src/effect/mainChain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mainChain, skipDecisions } from './mainChain';
import type { EffectPipeline, EffectStage } from './types';

const w = (from: [string, string], to: [string, string]) =>
  ({ from: { stage: from[0], port: from[1] }, to: { stage: to[0], port: to[1] } });
const io = (id: string, extra: Partial<EffectStage> = {}): EffectStage =>
  ({ id, title: id, inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }], ...extra });

const SKIP: EffectPipeline = {
  types: { number: { control: true } },
  stages: [
    io('src', { inputs: [] }),
    { id: 'q', title: 'high quality?', kind: 'decision', inputs: [{ id: 'in', type: 'image' }],
      outputs: [{ id: 'yes', type: 'image', label: 'yes' }, { id: 'no', type: 'image', label: 'no' }] },
    io('blur', { inputs: [{ id: 'in', type: 'image' }, { id: 'radius', type: 'number' }] }),
    io('mix'),
    io('out', { outputs: [] }),
    { id: 'osc', title: 'Oscillator', outputs: [{ id: 'value', type: 'number' }] },
  ],
  wires: [
    w(['src', 'out'], ['q', 'in']), w(['q', 'yes'], ['blur', 'in']), w(['q', 'no'], ['mix', 'in']),
    w(['blur', 'out'], ['mix', 'in']), w(['mix', 'out'], ['out', 'in']), w(['osc', 'value'], ['blur', 'radius']),
  ],
};

describe('mainChain', () => {
  it('is the longest path over data wires', () => {
    expect(mainChain(SKIP)).toEqual(['src', 'q', 'blur', 'mix', 'out']);
  });

  it('does not follow a control wire', () => {
    expect(mainChain(SKIP)).not.toContain('osc');
  });

  it('ends on a pipeline with a feedback wire', () => {
    const loop = { ...SKIP, wires: [...SKIP.wires, w(['mix', 'out'], ['blur', 'in'])] };
    const line = mainChain(loop);
    expect(line[0]).toBe('src');
    expect(new Set(line).size).toBe(line.length);
  });

  it('is empty for an empty pipeline', () => {
    expect(mainChain({ stages: [], wires: [] })).toEqual([]);
  });
});

describe('skipDecisions', () => {
  it('finds a decision whose one exit goes on and whose other skips ahead', () => {
    const [skip] = skipDecisions(SKIP, mainChain(SKIP));
    expect(skip!.decision.id).toBe('q');
    expect(skip!.through.wire.to.stage).toBe('blur');
    expect(skip!.skip.wire.to.stage).toBe('mix');
    expect(skip!.into.wire.from.stage).toBe('src');
  });

  it('leaves a decision with a second input alone', () => {
    const steered = { ...SKIP, stages: SKIP.stages.map((s) => (s.id === 'q'
      ? { ...s, inputs: [...s.inputs!, { id: 'when', type: 'number' }] } : s)) };
    expect(skipDecisions(steered, mainChain(steered))).toEqual([]);
  });
});
```

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/mainChain.test.ts`
Expected: FAIL, `./mainChain` does not exist.

- [ ] **Step 2: Implement `mainChain.ts`**

```ts
/** Which stages a pipeline's main signal runs through, and which decisions on
 *  that run only choose between going on and skipping ahead. */
import { isControl, kindOf, uniqueStages } from './draw';
import { drawableWires, type DrawableWire } from './nodeGraph';
import type { EffectPipeline, EffectStage } from './types';

export function mainChain(pipeline: EffectPipeline): string[] {
  const next = new Map<string, string[]>();
  for (const d of drawableWires(pipeline)) {
    if (isControl(pipeline, d.type)) continue;
    next.set(d.wire.from.stage, [...(next.get(d.wire.from.stage) ?? []), d.wire.to.stage]);
  }
  const best = new Map<string, string[]>();
  const walking = new Set<string>();
  const from = (id: string): string[] => {
    const known = best.get(id);
    if (known !== undefined) return known;
    // A stage already on the path closes a loop; the path stops there.
    if (walking.has(id)) return [];
    walking.add(id);
    let tail: string[] = [];
    for (const to of next.get(id) ?? []) {
      const path = from(to);
      if (path.length > tail.length && !path.includes(id)) tail = path;
    }
    walking.delete(id);
    const path = [id, ...tail];
    best.set(id, path);
    return path;
  };
  let longest: string[] = [];
  for (const stage of uniqueStages(pipeline)) {
    const path = from(stage.id);
    if (path.length > longest.length) longest = path;
  }
  return longest;
}

export interface Skip {
  decision: EffectStage;
  /** The wire into the decision, from the chain stage before it. */
  into: DrawableWire;
  /** The exit that goes on to the next chain stage. */
  through: DrawableWire;
  /** The exit that lands further along the chain. */
  skip: DrawableWire;
}

export function skipDecisions(pipeline: EffectPipeline, line: readonly string[]): Skip[] {
  const wires = drawableWires(pipeline);
  const stages = new Map(uniqueStages(pipeline).map((s) => [s.id, s]));
  const out: Skip[] = [];
  line.forEach((id, i) => {
    const decision = stages.get(id);
    if (decision === undefined || kindOf(decision) !== 'decision' || i === 0) return;
    if ((decision.inputs ?? []).length !== 1 || (decision.outputs ?? []).length !== 2) return;
    const entering = wires.filter((d) => d.wire.to.stage === id);
    const leaving = wires.filter((d) => d.wire.from.stage === id);
    if (entering.length !== 1 || leaving.length !== 2 || entering[0]!.wire.from.stage !== line[i - 1]) return;
    const through = leaving.find((d) => d.wire.to.stage === line[i + 1]);
    const skip = leaving.find((d) => d !== through && line.indexOf(d.wire.to.stage) > i + 1);
    if (through !== undefined && skip !== undefined) out.push({ decision, into: entering[0]!, through, skip });
  });
  return out;
}
```

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/mainChain.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing `rack` tests**

Create `packages/diagram/src/effect/rack.test.ts`. Copy the `w`, `io` and `SKIP` definitions from `mainChain.test.ts` to the top (a test file may not import another test file), then:

```ts
import { describe, expect, it } from 'vitest';
import { diagramScene } from '../fromData';
import { rack } from './rack';

describe('rack', () => {
  const { data, scene } = rack(SKIP);
  const node = (id: string) => data.nodes.find((n) => n.id === id)!;
  const edge = (from: string, to: string) => data.edges.filter((e) => e.from === from && e.to === to);

  it('lays out with the chain layout, flowing right, naming the chain', () => {
    expect(scene.layout).toBe('chain');
    expect(scene.layoutOptions).toMatchObject({ direction: 'right', chain: ['src', 'blur', 'mix', 'out'], chainSide: 'after' });
  });

  it('collapses a skip-ahead decision into an arc over what it skips', () => {
    expect(data.nodes.map((n) => n.id)).toEqual(['src', 'blur', 'mix', 'out', 'osc']);
    expect(edge('src', 'blur')).toHaveLength(1);
    const [arc] = edge('src', 'mix');
    expect(arc).toMatchObject({ fromPort: '~skip-out', toPort: '~skip-in', label: 'high quality?: no' });
    expect(scene.edgeStyle!(arc!).dash).toEqual([5, 4]);
  });

  it('keeps the decision as its symbol when told not to collapse', () => {
    const kept = rack(SKIP, { collapseSkips: false });
    expect(kept.data.nodes.map((n) => n.id)).toContain('q');
    expect(kept.scene.layoutOptions?.chain).toEqual(['src', 'q', 'blur', 'mix', 'out']);
  });

  it('puts the main signal on a stage\'s left and right, and a side input underneath', () => {
    const ports = Object.fromEntries(node('blur').ports!.map((p) => [p.id, p.at]));
    expect(ports.in).toEqual({ u: 0, v: 0.5 });
    expect(ports.out).toEqual({ u: 1, v: 0.5 });
    expect(ports.radius!.v).toBe(1);
  });

  it('labels a wire into a side input with the input\'s name', () => {
    expect(edge('osc', 'blur')[0]).toMatchObject({ fromPort: 'value', toPort: 'radius', label: 'radius' });
  });

  it('turns a side stage\'s output toward the line', () => {
    expect(node('osc').ports!.find((p) => p.id === 'value')!.at.v).toBe(0);
  });

  it('flips everything for side: above', () => {
    const above = rack(SKIP, { side: 'above' });
    expect(above.scene.layoutOptions?.chainSide).toBe('before');
    expect(above.data.nodes.find((n) => n.id === 'blur')!.ports!.find((p) => p.id === 'radius')!.at.v).toBe(0);
    expect(above.data.nodes.find((n) => n.id === 'osc')!.ports!.find((p) => p.id === 'value')!.at.v).toBe(1);
  });

  it('uses the chain it is given', () => {
    expect(rack(SKIP, { chain: ['osc', 'blur'], collapseSkips: false }).scene.layoutOptions?.chain).toEqual(['osc', 'blur']);
  });

  it('drops a collapsed decision from any group that named it', () => {
    const grouped = rack({ ...SKIP, groups: [{ id: 'g', members: ['q', 'blur'] }] });
    expect(grouped.data.groups).toEqual([{ id: 'g', members: ['blur'] }]);
  });

  it('builds a scene diagramScene accepts, and an empty one for an empty pipeline', () => {
    expect(() => diagramScene(data, scene)).not.toThrow();
    const empty = rack({ stages: [], wires: [] });
    expect(empty.data).toEqual({ nodes: [], edges: [], groups: [] });
    expect(diagramScene(empty.data, empty.scene)).toEqual([]);
  });
});
```

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/rack.test.ts`
Expected: FAIL, `./rack` does not exist.

- [ ] **Step 4: Implement `rack.ts`**

```ts
/**
 * The rack look: the main signal on one straight line with its stages in
 * order, and whatever feeds a stage from the side hung beside it.
 */
import { edgeIdOf, type DataEdge, type DataNode, type EdgeStyle, type NodeStyle } from '../fromData';
import type { PortAnchor, PortSpec } from '../types';
import { isControl, kindOf, portOn, stageStyle, typeColors, uniqueStages, wireStyle, type EffectLook } from './draw';
import { mainChain, skipDecisions } from './mainChain';
import { drawableWires, exitLabel, stageRows, type DrawableWire } from './nodeGraph';
import { branchNode, type BranchChoice } from './symbols';
import type { EffectPort, EffectStage } from './types';

export interface RackOptions {
  /** The stage ids on the line, in order. Default the longest path over data wires. */
  chain?: readonly string[];
  /** Where what feeds the chain from the side sits. Default `'below'`. */
  side?: 'below' | 'above';
  nodeGap?: number;
  rankGap?: number;
  colors?: Readonly<Record<string, string>>;
  /** Default true. */
  showParams?: boolean;
  branch?: BranchChoice;
  /** Draw a decision that only skips ahead as an arc over what it skips. Default true. */
  collapseSkips?: boolean;
}

const SKIP_OUT = '~skip-out';
const SKIP_IN = '~skip-in';

/** One wire the rack draws: a pipeline wire, or one made by collapsing a decision. */
interface RackWire {
  from: { stage: string; port: string };
  to: { stage: string; port: string };
  type: string | undefined;
  problem: boolean;
  label?: string;
  arc?: boolean;
}

const spreadAt = (ports: readonly EffectPort[], v: number): PortSpec[] =>
  ports.map((p, i) => ({ id: p.id, type: p.type, at: { u: (i + 1) / (ports.length + 1), v } }));

export const rack: EffectLook<RackOptions> = (pipeline, options = {}) => {
  const color = typeColors(pipeline, options.colors);
  const below = options.side !== 'above';
  const near = below ? 1 : 0;
  const far = below ? 0 : 1;
  const stages = uniqueStages(pipeline);
  const given = options.chain?.filter((id) => stages.some((s) => s.id === id));
  const line = given !== undefined && given.length > 0 ? given : mainChain(pipeline);
  const skips = options.collapseSkips === false ? [] : skipDecisions(pipeline, line);
  const gone = new Set(skips.map((s) => s.decision.id));
  const eaten = new Set<DrawableWire>(skips.flatMap((s) => [s.into, s.through, s.skip]));

  const wires: RackWire[] = drawableWires(pipeline).filter((d) => !eaten.has(d)).map((d) => {
    const label = exitLabel(d);
    return { from: d.wire.from, to: d.wire.to, type: d.type, problem: d.problem, ...(label !== undefined ? { label } : {}) };
  });
  for (const s of skips) {
    wires.push({ from: s.into.wire.from, to: s.through.wire.to, type: s.into.type, problem: false });
    wires.push({
      from: { stage: s.into.wire.from.stage, port: SKIP_OUT },
      to: { stage: s.skip.wire.to.stage, port: SKIP_IN },
      type: s.into.type,
      problem: false,
      label: `${s.decision.title}: ${exitLabel(s.skip) ?? s.skip.wire.from.port}`,
      arc: true,
    });
  }

  const chain = line.filter((id) => !gone.has(id));
  const at = new Map(chain.map((id, i) => [id, i]));
  /** The port a chain stage takes the main signal in on, and the one it sends it out of. */
  const mainIn = new Map<string, string>();
  const mainOut = new Map<string, string>();
  for (const wire of wires) {
    if (wire.arc || isControl(pipeline, wire.type)) continue;
    const a = at.get(wire.from.stage);
    const b = at.get(wire.to.stage);
    if (a === undefined || b !== a + 1) continue;
    if (!mainOut.has(wire.from.stage)) mainOut.set(wire.from.stage, wire.from.port);
    if (!mainIn.has(wire.to.stage)) mainIn.set(wire.to.stage, wire.to.port);
  }

  const portsOf = (stage: EffectStage): PortSpec[] => {
    const typed = (p: EffectPort, anchor: PortAnchor): PortSpec => ({ id: p.id, type: p.type, at: anchor });
    if (!at.has(stage.id)) return [...spreadAt(stage.outputs ?? [], far), ...spreadAt(stage.inputs ?? [], near)];
    const out: PortSpec[] = [];
    const side: EffectPort[] = [];
    for (const p of stage.inputs ?? []) {
      if (p.id === mainIn.get(stage.id)) out.push(typed(p, { u: 0, v: 0.5 }));
      else side.push(p);
    }
    for (const p of stage.outputs ?? []) {
      if (p.id === mainOut.get(stage.id)) out.push(typed(p, { u: 1, v: 0.5 }));
      else side.push(p);
    }
    out.push(...spreadAt(side, near));
    const type = portOn(stage, mainOut.get(stage.id) ?? mainIn.get(stage.id) ?? '')?.type;
    const arc = (id: string, u: number): PortSpec => ({ id, at: { u, v: far }, ...(type !== undefined ? { type } : {}) });
    if (wires.some((w) => w.arc && w.from.stage === stage.id)) out.push(arc(SKIP_OUT, 0.75));
    if (wires.some((w) => w.arc && w.to.stage === stage.id)) out.push(arc(SKIP_IN, 0.25));
    return out;
  };

  const kept = stages.filter((s) => !gone.has(s.id));
  const styles = new Map<string, NodeStyle>(kept.map((s) => [s.id, stageStyle(s)]));
  const nodes = kept.map((stage): DataNode => {
    const kind = kindOf(stage);
    if (kind === 'decision') return { id: stage.id, ...branchNode(stage, pipeline, options.branch) };
    return {
      id: stage.id,
      outline: kind === 'stage' ? 'rect' : 'stadium',
      rows: stageRows(stage, options.showParams !== false, false),
      ports: portsOf(stage),
    };
  });

  const byId = new Map(kept.map((s) => [s.id, s]));
  const edgeStyles = new Map<string, EdgeStyle>();
  const edges = wires.map((wire): DataEdge => {
    const to = byId.get(wire.to.stage);
    const sideInput = to !== undefined && kindOf(to) !== 'decision' && !wire.arc
      && wire.to.port !== mainIn.get(wire.to.stage) && at.has(wire.to.stage);
    const label = wire.label ?? (sideInput ? portOn(to, wire.to.port)?.label ?? wire.to.port : undefined);
    const edge: DataEdge = {
      from: wire.from.stage, fromPort: wire.from.port,
      to: wire.to.stage, toPort: wire.to.port,
      ...(label !== undefined ? { label } : {}),
    };
    edgeStyles.set(edgeIdOf(edge), wireStyle(color(wire.type), wire.arc === true || isControl(pipeline, wire.type), wire.problem));
    return edge;
  });

  return {
    data: {
      nodes,
      edges,
      groups: (pipeline.groups ?? []).map((g) => ({ ...g, members: g.members.filter((m) => !gone.has(m)) })),
    },
    scene: {
      layout: 'chain',
      layoutOptions: {
        direction: 'right',
        chain,
        chainSide: below ? 'after' : 'before',
        ...(options.nodeGap !== undefined ? { nodeGap: options.nodeGap } : {}),
        ...(options.rankGap !== undefined ? { rankGap: options.rankGap } : {}),
      },
      router: 'bezier',
      nodeStyle: (n) => styles.get(n.id) ?? stageStyle({ id: n.id, title: '' }),
      edgeStyle: (e) => edgeStyles.get(edgeIdOf(e)) ?? wireStyle(color(undefined), false, false),
    },
    color,
  };
};
```

`rack.ts` runs close to the 120-line function limit. Run `npm run check:size` after writing it; if `rack` is over, move `portsOf` and the wire-building block into module-level helpers that take what they read (`wires`, `at`, `mainIn`, `mainOut`, `near`, `far`) as arguments.

- [ ] **Step 5: Run and watch them pass**

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/rack.test.ts packages/diagram/src/effect/mainChain.test.ts`
Run: `npm run check:size`
Expected: PASS, and no size failure.

- [ ] **Step 6: Commit**

```bash
git add packages/diagram/src/effect/mainChain.ts packages/diagram/src/effect/mainChain.test.ts packages/diagram/src/effect/rack.ts packages/diagram/src/effect/rack.test.ts
git commit -m "rack look for effect pipelines" -- packages/diagram/src/effect
```

---

### Task 10: `EffectChart` and the `@weasel-js/diagram/effect` entry

**Files:**
- Create: `packages/diagram/src/effect/EffectChart.tsx`, `packages/diagram/src/effect/looks.ts`, `packages/diagram/src/effect.entry.ts`
- Modify: `packages/diagram/package.json`, `packages/diagram/tsup.config.ts`, `tsconfig.json` and `packages/core/tsconfig.json` (both generated)
- Test: `packages/diagram/src/effect/EffectChart.browser.test.tsx`

**Interfaces:**
- Consumes: `nodeGraph`, `rack`, `checkPipeline`, `EffectLook`; Task 2's `ports: 'show'`; Task 1's `shape` and fill function.
- Produces:
  ```ts
  export const EFFECT_LOOKS: Readonly<{ nodeGraph: typeof nodeGraph; rack: typeof rack }>;
  export interface EffectChartProps<TOptions = unknown> {
    pipeline: EffectPipeline;
    look?: EffectLook<TOptions>;
    options?: TOptions;
    width: number;
    height: number;
    selected?: string | null;
    onSelect?: (stage: string | null) => void;
    onProblems?: (problems: readonly EffectProblem[]) => void;
    className?: string;
  }
  export function EffectChart<TOptions = unknown>(props: EffectChartProps<TOptions>): JSX.Element;
  ```

- [ ] **Step 1: Add the subpath**

`packages/diagram/package.json`, in `exports` after `./layout`:

```json
    "./effect": {
      "import": "./dist/effect.js",
      "types": "./dist/effect.d.ts"
    },
```

`packages/diagram/tsup.config.ts`: `entry: { index: 'src/index.ts', layout: 'src/layout.entry.ts', effect: 'src/effect.entry.ts' }`.

Create `packages/diagram/src/effect/looks.ts`:

```ts
import { nodeGraph } from './nodeGraph';
import { rack } from './rack';

/** The looks that ship, by name. */
export const EFFECT_LOOKS = Object.freeze({ nodeGraph, rack });
```

Create `packages/diagram/src/effect.entry.ts`:

```ts
/**
 * `@weasel-js/diagram/effect` — a chart of an effects pipeline: the stages,
 * what each reads and writes, and where a decision sends the signal.
 */
export { checkPipeline } from './effect/check';
export type { EffectProblem } from './effect/check';
export { typeColors } from './effect/draw';
export type { EffectLook, EffectLookResult, TypeColor } from './effect/draw';
export { EffectChart } from './effect/EffectChart';
export type { EffectChartProps } from './effect/EffectChart';
export { EFFECT_LOOKS } from './effect/looks';
export { mainChain } from './effect/mainChain';
export { nodeGraph } from './effect/nodeGraph';
export type { NodeGraphOptions } from './effect/nodeGraph';
export { rack } from './effect/rack';
export type { RackOptions } from './effect/rack';
export { BRANCH_SYMBOLS, branchNode, symbolNameFor } from './effect/symbols';
export type { BranchChoice, BranchNode, BranchSymbol } from './effect/symbols';
export type {
  EffectGroup,
  EffectPipeline,
  EffectPort,
  EffectStage,
  EffectType,
  EffectWire,
} from './effect/types';
```

Run: `npm run gen:tsconfig-paths`
Expected: `tsconfig.json` and `packages/core/tsconfig.json` each gain a `@weasel-js/diagram/effect` line pointing at `src/effect.entry.ts`.

- [ ] **Step 2: Write the failing browser test**

Create `packages/diagram/src/effect/EffectChart.browser.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { registerCanvasFont } from '@weasel-js/font';
import { EffectChart } from './EffectChart';
import { rack } from './rack';
import type { EffectPipeline } from './types';

registerCanvasFont('sans-serif');
afterEach(cleanup);

const P: EffectPipeline = {
  stages: [
    { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
    { id: 'blur', title: 'Blur', inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] },
  ],
  wires: [{ from: { stage: 'src', port: 'out' }, to: { stage: 'blur', port: 'image' } }],
};
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** How many pixels of the canvas are not the clear color. */
function inked(canvas: HTMLCanvasElement): number {
  const gl = canvas.getContext('webgl2')!;
  const px = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) n++;
  return n;
}

describe('<EffectChart>', () => {
  it('mounts a canvas of the size asked for and draws the pipeline on it', async () => {
    const { container } = render(<EffectChart pipeline={P} width={480} height={320} />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas.getBoundingClientRect().width).toBe(480);
    await frame();
    await frame();
    expect(inked(canvas)).toBeGreaterThan(500);
  });

  it('draws with the look it is given', async () => {
    const { container } = render(<EffectChart pipeline={P} look={rack} width={480} height={320} />);
    await frame();
    await frame();
    expect(inked(container.querySelector('canvas')!)).toBeGreaterThan(500);
  });

  it('reports what is wrong with the pipeline', async () => {
    const onProblems = vi.fn();
    const bad = { ...P, wires: [{ from: { stage: 'ghost', port: 'out' }, to: { stage: 'blur', port: 'image' } }] };
    render(<EffectChart pipeline={bad} width={480} height={320} onProblems={onProblems} />);
    await waitFor(() => expect(onProblems).toHaveBeenCalled());
    expect(onProblems.mock.lastCall![0].map((p: { kind: string }) => p.kind)).toEqual(['missing-stage']);
  });

  it('mounts an empty pipeline without throwing', () => {
    expect(() => render(<EffectChart pipeline={{ stages: [], wires: [] }} width={200} height={100} />)).not.toThrow();
  });
});
```

If `inked` reads zero on the first test although the chart is visibly drawn (the context does not keep its buffer), apply the same fix Task 2 settled on. A pick reported as a stage id is covered by the unit test in Step 5, where a click needs no real layout.

Run: `npx vitest run --project=browser packages/diagram/src/effect/EffectChart.browser.test.tsx`
Expected: FAIL, `./EffectChart` does not exist.

- [ ] **Step 3: Implement `EffectChart.tsx`**

```tsx
import { useEffect, useMemo } from 'react';
import { DiagramView, type DiagramViewProps } from '../DiagramView';
import { diagramScene } from '../fromData';
import { checkPipeline, type EffectProblem } from './check';
import type { EffectLook } from './draw';
import { nodeGraph } from './nodeGraph';
import type { EffectPipeline } from './types';

/** Props for `EffectChart`. */
export interface EffectChartProps<TOptions = unknown> {
  pipeline: EffectPipeline;
  /** How the pipeline is drawn. Default `nodeGraph`. */
  look?: EffectLook<TOptions>;
  /** The look's options. Keep the object's identity steady between renders,
   *  or the chart lays out again on each one. */
  options?: TOptions;
  width: number;
  height: number;
  /** A stage id, or null for none. */
  selected?: string | null;
  onSelect?: (stage: string | null) => void;
  /** What `checkPipeline` found, each time the pipeline changes. */
  onProblems?: (problems: readonly EffectProblem[]) => void;
  className?: string;
}

const keys = new WeakMap<object, number>();
let nextKey = 0;
/** A React key that changes when the built scene does, so a new pipeline or
 *  look opens fitted and laid out afresh. */
function keyOf(built: object): number {
  let key = keys.get(built);
  if (key === undefined) {
    key = nextKey++;
    keys.set(built, key);
  }
  return key;
}

/** A chart of an effects pipeline: pan, zoom, and pick a stage. Text paints
 *  only in a registered font family, so call `registerCanvasFont('sans-serif')`
 *  once before mounting one. */
export function EffectChart<TOptions = unknown>({
  pipeline, look, options, width, height, selected, onSelect, onProblems, className,
}: EffectChartProps<TOptions>) {
  const problems = useMemo(() => checkPipeline(pipeline), [pipeline]);
  useEffect(() => onProblems?.(problems), [onProblems, problems]);

  const built = useMemo(() => {
    const drawn = ((look ?? nodeGraph) as EffectLook<TOptions>)(pipeline, options);
    const portOptions: DiagramViewProps['portOptions'] = {
      shape: 'circle',
      sizePx: 8,
      fill: (port) => ({ paint: { color: drawn.color(port.type) } }),
    };
    return { specs: diagramScene(drawn.data, drawn.scene), portOptions };
  }, [pipeline, look, options]);

  const stageIds = useMemo(() => new Set(pipeline.stages.map((s) => s.id)), [pipeline]);
  return (
    <DiagramView
      key={keyOf(built)}
      specs={built.specs}
      width={width}
      height={height}
      ports="show"
      portOptions={built.portOptions}
      anchor="start"
      {...(selected !== undefined ? { selected } : {})}
      {...(onSelect ? { onSelect: (id: string | null) => onSelect(id !== null && stageIds.has(id) ? id : null) } : {})}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
```

- [ ] **Step 4: Run and watch the browser tests pass**

Run: `npx vitest run --project=browser packages/diagram/src/effect/EffectChart.browser.test.tsx`
Expected: PASS.

- [ ] **Step 5: Pin the pick, in jsdom**

Create `packages/diagram/src/effect/EffectChart.test.tsx`. It checks only what `EffectChart` adds on top of `DiagramView`: a pick that is not a stage comes back as null.

```tsx
import { cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it, vi } from 'vitest';

const seen: { onSelect?: (id: string | null) => void }[] = [];
vi.mock('../DiagramView', () => ({
  DiagramView: (props: { onSelect?: (id: string | null) => void }) => {
    seen.push(props);
    return null;
  },
}));

import { EffectChart } from './EffectChart';

afterEach(() => {
  cleanup();
  seen.length = 0;
});

describe('EffectChart picking', () => {
  const pipeline = { stages: [{ id: 'blur', title: 'Blur' }], wires: [], groups: [{ id: 'g', members: ['blur'] }] };

  it('reports a picked stage by its id, and anything else as none', () => {
    const onSelect = vi.fn();
    render(<EffectChart pipeline={pipeline} width={100} height={100} onSelect={onSelect} />);
    const view = seen[seen.length - 1]!;
    view.onSelect!('blur');
    view.onSelect!('g');
    view.onSelect!(null);
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual(['blur', null, null]);
  });
});
```

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/EffectChart.test.tsx`
Expected: PASS. To see it fail first, temporarily make `onSelect` pass `id` straight through and confirm the `'g'` call reports `'g'`.

- [ ] **Step 6: Build and check the manifest**

Run: `npm run build --workspace @weasel-js/diagram`
Run: `npm run check:manifests`
Run: `npm run check:imports`
Run: `npm run typecheck`
Expected: `dist/effect.js` and `dist/effect.d.ts` exist; all three checks pass.

- [ ] **Step 7: Commit**

```bash
git add packages/diagram/src/effect packages/diagram/src/effect.entry.ts packages/diagram/package.json packages/diagram/tsup.config.ts tsconfig.json packages/core/tsconfig.json
git commit -m "EffectChart component and the diagram/effect entry" -- packages/diagram tsconfig.json packages/core/tsconfig.json
```

---

### Task 11: The lab

A workshop story with a config schema: the workshop draws the controls, the story draws the chart and the problems list.

**Files:**
- Create: `packages/diagram/src/effect/lab/samples.ts`, `packages/diagram/src/effect/lab/EffectLab.stories.tsx`, `packages/diagram/src/effect/lab/EffectLab.stories.module.css`
- Modify: `apps/forge/viteShared.ts`, `apps/forge/libraries.ts`
- Test: `packages/diagram/src/effect/lab/samples.test.ts`

**Interfaces:**
- Consumes: `EffectChart`, `EFFECT_LOOKS`, `checkPipeline`.
- Produces: `export const SAMPLES: Readonly<Record<string, EffectPipeline>>` with keys `chain`, `branch`, `sideInputs`, `skip`, `bands`, `large`, `broken`.

- [ ] **Step 1: Write the failing sample tests**

Create `packages/diagram/src/effect/lab/samples.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { diagramScene } from '../../fromData';
import { checkPipeline } from '../check';
import { EFFECT_LOOKS } from '../looks';
import { SAMPLES } from './samples';

describe('lab samples', () => {
  it('has the samples the lab offers', () => {
    expect(Object.keys(SAMPLES)).toEqual(['chain', 'branch', 'sideInputs', 'skip', 'bands', 'large', 'broken']);
  });

  it('is sound everywhere but the one that is wrong on purpose', () => {
    for (const [name, pipeline] of Object.entries(SAMPLES)) {
      const problems = checkPipeline(pipeline);
      if (name === 'broken') expect(problems.length).toBeGreaterThan(1);
      else expect(problems, name).toEqual([]);
    }
  });

  it('has about forty stages in the large one', () => {
    expect(SAMPLES.large!.stages.length).toBeGreaterThanOrEqual(36);
  });

  it('draws under every look', () => {
    for (const [name, pipeline] of Object.entries(SAMPLES)) {
      for (const [lookName, look] of Object.entries(EFFECT_LOOKS)) {
        const { data, scene } = look(pipeline);
        expect(() => diagramScene(data, scene), `${name} / ${lookName}`).not.toThrow();
      }
    }
  });
});
```

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/lab/samples.test.ts`
Expected: FAIL, `./samples` does not exist.

- [ ] **Step 2: Write `samples.ts`**

```ts
/** Pipelines to try looks against. `broken` is wrong on purpose. */
import type { EffectPipeline, EffectPort, EffectStage, EffectWire } from '../types';

const img = (id: string, label?: string): EffectPort => ({ id, type: 'image', ...(label ? { label } : {}) });
const num = (id: string): EffectPort => ({ id, type: 'number' });
const mask = (id: string): EffectPort => ({ id, type: 'mask' });
const w = (from: string, to: string, label?: string): EffectWire => {
  const [fs, fp] = from.split('.');
  const [ts, tp] = to.split('.');
  return { from: { stage: fs!, port: fp! }, to: { stage: ts!, port: tp! }, ...(label ? { label } : {}) };
};
const TYPES = { number: { control: true } };

const source: EffectStage = { id: 'src', title: 'Source', kind: 'source', outputs: [img('out')] };
const sink: EffectStage = { id: 'out', title: 'Out', kind: 'sink', inputs: [img('in')] };
const blur: EffectStage = {
  id: 'blur', title: 'Blur', inputs: [img('image'), num('radius')], outputs: [img('out')],
  params: [{ label: 'radius', value: '6.0 px' }, { label: 'passes', value: '2' }],
};
const mix: EffectStage = {
  id: 'mix', title: 'Composite', inputs: [img('base'), img('over'), mask('mask')], outputs: [img('out')],
  params: [{ label: 'blend', value: 'screen' }, { label: 'opacity', value: '0.80' }],
};
const osc: EffectStage = { id: 'osc', title: 'Oscillator', outputs: [num('value')], params: [{ label: 'rate', value: '0.5 Hz' }] };
const beams: EffectStage = { id: 'beams', title: 'Sunbeams', outputs: [img('out')] };
const cutout: EffectStage = { id: 'cutout', title: 'Mask', outputs: [mask('out')] };

const chain: EffectPipeline = {
  types: TYPES,
  stages: [
    source,
    { id: 'tone', title: 'Tone', inputs: [img('in')], outputs: [img('out')], params: [{ label: 'gamma', value: '2.2' }] },
    { ...blur, inputs: [img('image')] },
    { id: 'grain', title: 'Grain', bypassed: true, inputs: [img('in')], outputs: [img('out')] },
    sink,
  ],
  wires: [w('src.out', 'tone.in'), w('tone.out', 'blur.image'), w('blur.out', 'grain.in'), w('grain.out', 'out.in')],
};

const sideInputs: EffectPipeline = {
  types: TYPES,
  stages: [source, blur, mix, sink, osc, beams, cutout],
  wires: [
    w('src.out', 'blur.image'), w('blur.out', 'mix.base'), w('mix.out', 'out.in'),
    w('osc.value', 'blur.radius'), w('beams.out', 'mix.over'), w('cutout.out', 'mix.mask'),
  ],
};

const gate: EffectStage = {
  id: 'q', title: 'high quality?', kind: 'decision', inputs: [img('in')], outputs: [img('yes', 'yes'), img('no', 'no')],
};

const skip: EffectPipeline = {
  types: TYPES,
  stages: [source, gate, blur, mix, sink, osc, beams, cutout],
  wires: [
    w('src.out', 'q.in'), w('q.yes', 'blur.image'), w('q.no', 'mix.base'), w('blur.out', 'mix.base'),
    w('mix.out', 'out.in'), w('osc.value', 'blur.radius'), w('beams.out', 'mix.over'), w('cutout.out', 'mix.mask'),
  ],
};

const branch: EffectPipeline = {
  types: TYPES,
  stages: [
    source,
    { ...gate, title: 'has alpha?' },
    { id: 'matte', title: 'Matte', inputs: [img('in')], outputs: [img('out')] },
    { id: 'flat', title: 'Flatten', inputs: [img('in')], outputs: [img('out')] },
    { id: 'join', title: 'Merge', inputs: [img('a'), img('b')], outputs: [img('out')] },
    sink,
  ],
  wires: [
    w('src.out', 'q.in'), w('q.yes', 'matte.in'), w('q.no', 'flat.in'),
    w('matte.out', 'join.a'), w('flat.out', 'join.b'), w('join.out', 'out.in'),
  ],
  groups: [{ id: 'alpha', label: 'Alpha handling', members: ['matte', 'flat'] }],
};

const bands: EffectPipeline = {
  types: TYPES,
  stages: [
    source,
    { id: 'level', title: 'Luma', inputs: [img('in')], outputs: [num('value')] },
    { id: 'band', title: 'Brightness', kind: 'decision', inputs: [img('in'), num('x')],
      outputs: [img('low', 'low'), img('mid', 'mid'), img('high', 'high')], split: { input: 'x', at: [0.2, 0.8] } },
    { id: 'lift', title: 'Lift', inputs: [img('in')], outputs: [img('out')] },
    { id: 'keep', title: 'Pass', inputs: [img('in')], outputs: [img('out')] },
    { id: 'clip', title: 'Soft clip', inputs: [img('in')], outputs: [img('out')] },
    { id: 'join', title: 'Merge', inputs: [img('a'), img('b'), img('c')], outputs: [img('out')] },
    sink,
  ],
  wires: [
    w('src.out', 'level.in'), w('src.out', 'band.in'), w('level.value', 'band.x'),
    w('band.low', 'lift.in'), w('band.mid', 'keep.in'), w('band.high', 'clip.in'),
    w('lift.out', 'join.a'), w('keep.out', 'join.b'), w('clip.out', 'join.c'), w('join.out', 'out.in'),
  ],
};

/** A long chain with a modulator on every third stage. */
function large(): EffectPipeline {
  const stages: EffectStage[] = [source];
  const wires: EffectWire[] = [];
  let last = 'src.out';
  for (let i = 0; i < 28; i++) {
    const id = `fx${i}`;
    const modulated = i % 3 === 0;
    stages.push({ id, title: `Effect ${i + 1}`, inputs: modulated ? [img('in'), num('amount')] : [img('in')], outputs: [img('out')] });
    wires.push(w(last, `${id}.in`));
    if (modulated) {
      stages.push({ id: `lfo${i}`, title: `LFO ${i / 3 + 1}`, outputs: [num('value')] });
      wires.push(w(`lfo${i}.value`, `${id}.amount`));
    }
    last = `${id}.out`;
  }
  stages.push(sink);
  wires.push(w(last, 'out.in'));
  return { types: TYPES, stages, wires };
}

const broken: EffectPipeline = {
  types: TYPES,
  stages: [source, blur, mix, sink, osc],
  wires: [
    w('src.out', 'blur.image'), w('blur.out', 'mix.base'), w('mix.out', 'out.in'),
    w('osc.value', 'mix.over'),
    w('ghost.out', 'mix.mask'),
    w('blur.image', 'mix.over'),
  ],
  groups: [{ id: 'g', label: 'Missing', members: ['blur', 'nowhere'] }],
};

export const SAMPLES: Readonly<Record<string, EffectPipeline>> = Object.freeze({
  chain,
  branch,
  sideInputs,
  skip,
  bands,
  large: large(),
  broken,
});
```

Run: `npx vitest run --project=weasel-ui packages/diagram/src/effect/lab/samples.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the story**

Create `packages/diagram/src/effect/lab/EffectLab.stories.module.css`:

```css
.lab {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 12px;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  background: #0e151b;
  color: #dbe7f2;
  font: 13px/1.4 system-ui, sans-serif;
}

.chart {
  min-height: 0;
  border: 1px solid #1f2d39;
  border-radius: 8px;
  overflow: hidden;
}

.problems {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 120px;
  overflow: auto;
}

.problems li {
  padding: 2px 0;
  color: #ff8a8a;
}

.status {
  color: #8aa2b5;
}
```

Create `packages/diagram/src/effect/lab/EffectLab.stories.tsx`:

```tsx
import { f, meta, story } from '@weasel-js/forge';
import { registerCanvasFont } from '@weasel-js/font';
import { useMemo, useState } from 'react';
import type { EffectProblem } from '../check';
import type { EffectLook } from '../draw';
import { EffectChart } from '../EffectChart';
import { EFFECT_LOOKS } from '../looks';
import { SAMPLES } from './samples';
import s from './EffectLab.stories.module.css';

registerCanvasFont('sans-serif');

export default meta({ title: 'diagram/EffectChart lab', layout: 'fullscreen' });

interface LabConfig {
  sample: string;
  look: string;
  branch: string;
  showParams: boolean;
  nodeGap: number;
  rankGap: number;
  router: string;
  side: string;
  collapseSkips: boolean;
}

const W = 1100;
const H = 620;

function LabView({ config }: { config: LabConfig }) {
  const [problems, setProblems] = useState<readonly EffectProblem[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  // Both looks take one bag; each reads the keys it knows.
  const options = useMemo(() => ({
    branch: config.branch,
    showParams: config.showParams,
    nodeGap: config.nodeGap,
    rankGap: config.rankGap,
    router: config.router,
    side: config.side,
    collapseSkips: config.collapseSkips,
  }), [config.branch, config.showParams, config.nodeGap, config.rankGap, config.router, config.side, config.collapseSkips]);
  const look = EFFECT_LOOKS[config.look as keyof typeof EFFECT_LOOKS] as EffectLook<typeof options>;
  return (
    <div className={s.lab}>
      <div className={s.chart}>
        <EffectChart
          pipeline={SAMPLES[config.sample]!}
          look={look}
          options={options}
          width={W}
          height={H}
          selected={picked}
          onSelect={setPicked}
          onProblems={setProblems}
        />
      </div>
      <div>
        <div className={s.status}>picked: {picked ?? 'none'}</div>
        <ul className={s.problems} aria-label="Problems">
          {problems.map((p, i) => <li key={i}>{p.message}</li>)}
        </ul>
      </div>
    </div>
  );
}

export const Lab = story({
  config: f.schema({
    sample: f.enum('skip', Object.keys(SAMPLES)).label('Pipeline'),
    look: f.enum('nodeGraph', Object.keys(EFFECT_LOOKS)).radio().label('Look'),
    branch: f.enum('auto', ['auto', 'diamond', 'bar', 'demux', 'switch']).label('Branch symbol'),
    showParams: f.boolean(true).label('Show params'),
    nodeGap: f.number(32).range(8, 96).step(4).label('Node gap'),
    rankGap: f.number(72).range(24, 200).step(4).label('Rank gap'),
    router: f.enum('bezier', ['bezier', 'orthogonal', 'straight']).label('Router').showIf((c) => c.look === 'nodeGraph'),
    side: f.enum('below', ['below', 'above']).radio().label('Side inputs').showIf((c) => c.look === 'rack'),
    collapseSkips: f.boolean(true).label('Collapse skip-ahead decisions').showIf((c) => c.look === 'rack'),
  }),
  render: ({ config }) => <LabView config={config as LabConfig} />,
});
```

If `f.enum` rejects a `string[]` from `Object.keys`, list the keys in a literal array beside it and add a test in `samples.test.ts` that the array equals `Object.keys(SAMPLES)`.

- [ ] **Step 4: Put the story in the workshop**

`apps/forge/viteShared.ts`, add to `stories`:

```ts
  'packages/diagram/src/**/*.stories.{ts,tsx}',
```

`apps/forge/libraries.ts`, add to `LIBRARIES` (pick a swatch `apps/forge/libraries.css` declares as `--forge-library-<swatch>` and no other library uses):

```ts
  { path: '/packages/diagram/', label: 'diagram', tone: tone('<swatch>') },
```

Run: `npm run check:forge-stories`
Run: `npm run check:imports`
Run: `npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Look at it**

Start the workshop from the worktree, in the background, as an extra copy: `WAKE_EXTRA=<a free port> npm run dev --workspace apps/forge` (check `apps/forge/package.json` for the script's exact name). With the headless playwright MCP, open the lab story, and for each of `nodeGraph` and `rack` with the `skip` sample, then `bands` with `nodeGraph`, take a screenshot and `transom post` it. Check in each:

- every stage's title and port labels are readable and inside its box
- wires end on ports, and ports take their type's color
- in `rack`, the chain is on one line and the skip arc runs over Blur
- in `bands`, the bar shows two ticks with `0.2` and `0.8` beside them and three exits
- with `broken`, the problems list names each problem and a red wire shows

Fix what is wrong before going on. Stop the dev server by its PID when done.

- [ ] **Step 6: Commit**

```bash
git add packages/diagram/src/effect/lab apps/forge/viteShared.ts apps/forge/libraries.ts
git commit -m "EffectChart lab in the workshop" -- packages/diagram/src/effect/lab apps/forge/viteShared.ts apps/forge/libraries.ts
```

---

### Task 12: Site demos and visual baselines

**Files:**
- Create: `apps/site/demos/EffectChartDemo.tsx`, `tests/visual/effect-chart.spec.ts`
- Modify: `apps/site/registry.ts`

**Interfaces:**
- Consumes: `EffectChart`, `rack`, `EffectPipeline` from `@weasel-js/diagram/effect`.

- [ ] **Step 1: Write the demo**

Create `apps/site/demos/EffectChartDemo.tsx`. One pipeline, two exported components, one per look:

```tsx
import { useState } from 'react';
import { EffectChart, rack, type EffectLook, type EffectPipeline } from '@weasel-js/diagram/effect';

const image = (id: string, label?: string) => ({ id, type: 'image', ...(label ? { label } : {}) });
const wire = (from: string, to: string) => {
  const [fs, fp] = from.split('.');
  const [ts, tp] = to.split('.');
  return { from: { stage: fs!, port: fp! }, to: { stage: ts!, port: tp! } };
};

/** A source blurred only at high quality, then composited under sunbeams
 *  through a mask, with an oscillator driving the blur radius. */
const PIPELINE: EffectPipeline = {
  types: { number: { control: true } },
  stages: [
    { id: 'src', title: 'Source', kind: 'source', outputs: [image('out')] },
    { id: 'q', title: 'high quality?', kind: 'decision', inputs: [image('in')], outputs: [image('yes', 'yes'), image('no', 'no')] },
    { id: 'blur', title: 'Blur', inputs: [image('image'), { id: 'radius', type: 'number' }], outputs: [image('out')],
      params: [{ label: 'radius', value: '6.0 px' }] },
    { id: 'mix', title: 'Composite', inputs: [image('base'), image('over'), { id: 'mask', type: 'mask' }], outputs: [image('out')],
      params: [{ label: 'blend', value: 'screen' }] },
    { id: 'out', title: 'Out', kind: 'sink', inputs: [image('in')] },
    { id: 'osc', title: 'Oscillator', outputs: [{ id: 'value', type: 'number' }] },
    { id: 'beams', title: 'Sunbeams', outputs: [image('out')] },
    { id: 'cutout', title: 'Mask', outputs: [{ id: 'out', type: 'mask' }] },
  ],
  wires: [
    wire('src.out', 'q.in'), wire('q.yes', 'blur.image'), wire('q.no', 'mix.base'), wire('blur.out', 'mix.base'),
    wire('mix.out', 'out.in'), wire('osc.value', 'blur.radius'), wire('beams.out', 'mix.over'), wire('cutout.out', 'mix.mask'),
  ],
};

function Demo({ look }: { look?: EffectLook }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="ckd-stack">
      <div className="ckd-row">picked: {picked ?? 'none'}</div>
      <EffectChart
        pipeline={PIPELINE}
        {...(look ? { look } : {})}
        width={820}
        height={420}
        selected={picked}
        onSelect={setPicked}
        className="ckd-canvas"
      />
    </div>
  );
}

export function EffectChartDemo() {
  return <Demo />;
}

export function EffectChartRackDemo() {
  return <Demo look={rack as EffectLook} />;
}
```

- [ ] **Step 2: Register both**

In `apps/site/registry.ts`, after the `diagram-live` entry:

```ts
  {
    id: 'effect-chart',
    title: 'Effect chart',
    package: 'diagram',
    description: "EffectChart draws an effects pipeline from plain data: stages, the typed ports each reads and writes, and the wires between them. This is the node-graph look. Every port is a named row, a wire takes the color of the value it carries, a control value's wire is dashed, and a decision draws as a branch symbol. checkPipeline reports a wire that names a missing port or joins two types, and the chart draws it in a warning color.",
    hint: 'Click a stage: the picked readout names it. Drag to pan, scroll to zoom.',
    load: () => import('./demos/EffectChartDemo').then((m) => m.EffectChartDemo),
    path: 'apps/site/demos/EffectChartDemo.tsx',
  },
  {
    id: 'effect-chart-rack',
    title: 'Effect chart, rack look',
    package: 'diagram',
    description: "The same pipeline under the rack look. The main signal runs along one line with its stages in order, laid out by the chain layout; whatever feeds a stage from the side hangs under it. A decision that only chooses between going on and skipping ahead draws as a dashed arc over the stages it skips. A look is a function from a pipeline to what diagramScene takes, so a new way of drawing one is a new function.",
    hint: 'Compare with the node-graph demo: the wiring is the same and only the look differs.',
    load: () => import('./demos/EffectChartDemo').then((m) => m.EffectChartRackDemo),
    path: 'apps/site/demos/EffectChartDemo.tsx',
  },
```

Run: `npx vitest run --project=site apps/site`
Expected: PASS (the registry's own tests).

- [ ] **Step 3: Look at both, then add the visual spec**

Start the site dev server from the worktree as an extra copy (`WAKE_EXTRA=<free port>`), open `/#effect-chart` and `/#effect-chart-rack` headless, screenshot each and `transom post` them. If text is blank, the site registers no canvas font for these demos: add `registerCanvasFont('sans-serif')` at module top of the demo, as `RenderToPixelsDemo.tsx` does, importing it from `@weasel-js/font`.

Create `tests/visual/effect-chart.spec.ts`:

```ts
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline, type DiffOptions } from './diff.js';

const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

// These canvases are mostly empty, so a stage moving 10px is well under the 2% default.
const OPTS: DiffOptions = { maxDiffRatio: 0.004 };

test('effect-chart: node-graph look', async ({ page }) => {
  const png = await captureCanvas(page, '/#effect-chart');
  assertMatchesBaseline(png, resolve(BASELINE_DIR, 'effect-chart.png'), OPTS);
});

test('effect-chart-rack: rack look', async ({ page }) => {
  const png = await captureCanvas(page, '/#effect-chart-rack');
  assertMatchesBaseline(png, resolve(BASELINE_DIR, 'effect-chart-rack.png'), OPTS);
});
```

Baselines are captured on CI's runner by the "Visual Regression — Update Baselines" workflow; one captured on this machine may not match. Do not commit a locally captured PNG. Dispatching that workflow needs a push, which needs Mike's say-so: leave the two baselines as the one open item in the handoff.

- [ ] **Step 4: Commit**

```bash
git add apps/site/demos/EffectChartDemo.tsx apps/site/registry.ts tests/visual/effect-chart.spec.ts
git commit -m "EffectChart site demos, one per look" -- apps/site/demos/EffectChartDemo.tsx apps/site/registry.ts tests/visual/effect-chart.spec.ts
```

---

### Task 13: Docs, changeset, and closing out

**Files:**
- Modify: `packages/diagram/README.md`, `docs/TODO.md`, `~/src/PROJECTS.md` only if it describes diagram's contents
- Create: `.changeset/effect-chart.md`
- Delete (in the merge commit): `docs/superpowers/specs/2026-10-13-effect-chart-design.md`, `docs/superpowers/plans/2026-10-13-effect-chart.md`

- [ ] **Step 1: README**

Add to `packages/diagram/README.md`, matching the file's existing register:

- A section "Effect charts" covering: what a pipeline is (stages, typed ports, wires, groups, `types` for control values, `split` for a threshold decision), the `EffectChart` props, the two looks and their options, the four branch symbols and their fallbacks, `checkPipeline`, and how to write a look (a function returning `{ data, scene, color }`).
- In the existing sections: the `ports` prop and the `fill` function and `shape` on `portOptions`; the `'trapezoid'` outline; `marks` on a data node (unit-square path data, pinned text); the `chain` layout and its two options.
- Under the outline notes, one sentence: a custom `Path` outline is in world coordinates and does not follow its node when layout moves it.

- [ ] **Step 2: TODO**

Add to `docs/TODO.md` under the diagram heading (find it with `grep -n 'diagram' docs/TODO.md`; add a "Diagram follow-ups" heading if none fits):

```md
- **(P2) EffectChart: show a run.** A second input beside the pipeline, keyed by stage id and
  wire, never new fields on the pipeline; a look takes it as a third argument. Which branch was
  taken (the `switch` symbol already has a lever to throw), the value or a preview on each wire
  (a body `slot` row is the room for one), cost per stage. Live state follows from it: the run
  changes every frame, only what it touches repaints, and the layout stays put.
- **(P3) EffectChart: more looks.** One lane per value type, with a stage as tall as the lanes it
  touches; and a compact look with one-line stages and no ports drawn, for pipelines too big for
  the node graph. Branch symbols sketched and not built: hexagon, step glyph, comparator,
  crossover, and a bare fork with the conditions on its wires.
- **(P3) A custom `Path` outline does not follow its node.** `outlinePath` returns a consumer's
  path unchanged, in world coordinates, so `diagramScene`'s layout moves the box and leaves the
  outline behind. Marks solve the same problem with path data in a unit square
  (`packages/diagram/src/marks.ts`); an outline could take the same form.
- **(P3) EffectChart visual baselines are not captured.** `tests/visual/effect-chart.spec.ts`
  names `effect-chart.png` and `effect-chart-rack.png`; the update-baselines workflow has to
  write them.
```

Drop the last entry if the baselines were captured before merging.

- [ ] **Step 3: Changeset**

Create `.changeset/effect-chart.md`:

```md
---
'@weasel-js/diagram': patch
---

`@weasel-js/diagram/effect` is new: `EffectChart` draws an effects pipeline given as plain data, with stages, the typed ports each reads and writes, the wires between them, and groups. How it is drawn is a look, a function from a pipeline to what `diagramScene` takes; `nodeGraph` gives every port a named row and `rack` runs the main signal along one line with side inputs hung under it. A decision draws as a branch symbol (`diamond`, `bar`, `demux`, `switch`), and one with `split` draws its thresholds as ticks on a bar. `checkPipeline` reports a wire that names a missing stage or port, runs the wrong way, or joins two types.

Additive in `@weasel-js/diagram` itself: `DiagramView` takes `ports="show"` to draw ports with nothing to connect; `portOptions.fill` may be a function of the port and `portOptions.shape` may be `'circle'`; `'trapezoid'` is an outline; a data node takes `marks`, shapes in a unit square stretched over its box and text pinned to a point on it; and `chain` is a layout that stands one run of nodes on a line and hangs the rest beside it.
```

Run: `npm run check:bumps`
Expected: PASS.

- [ ] **Step 4: Gate, fleet, merge**

Run: `npm run test:gate`
Run, detached to a file in the session scratchpad: `nohup npm run test:fleet > <scratchpad>/effect-chart-fleet.log 2>&1 &`, read the log's exit line when it finishes, then delete the log.
Expected: both green. A failure in a file this branch did not touch that passes alone is load, not a regression; say so and move on.

Then, in the merge to `main`: delete the spec and this plan (`git rm`), commit, merge, run `npm run test:fleet` on `main` in the background, switch the session back to `main`, and remove the worktree and branch. Do not push.

- [ ] **Step 5: Commit**

```bash
git add packages/diagram/README.md docs/TODO.md .changeset/effect-chart.md
git commit -m "document EffectChart and file what it leaves open" -- packages/diagram/README.md docs/TODO.md .changeset/effect-chart.md
```
