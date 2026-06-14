# Obj Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Swillustrator's `Obj` union in one coherent sweep:
collapse `RectObj` into `PathObj` (carrying `Path = PolygonPath |
RectPath`), replace `kind` with `tool` as the top-level discriminator,
and add `params?` for non-bounds-derivable shape parameters (sides for
polygon, points + ratio for star).

**Supersedes:**
- `docs/superpowers/plans/2026-05-13-rect-as-path.md`
- `docs/superpowers/plans/2026-05-13-pathobj-params.md`

**Spec:** `docs/superpowers/specs/2026-05-13-obj-restructure-design.md`

**Tech stack:** TypeScript, React, Vitest, `@weasel-js/core` (kit).

**Architecture:** A "rectangle" is now a `PathObj` with `tool: 'rect'`
and `path.kind === 'rect'`. Every PathObj names its authoring tool
(`'rect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'pen' | 'pencil'
| 'imported'`); TextObj has `tool: 'text'`. `params` carries the
sides-or-points-or-ratio extras for polygon/star only. The kit's
`Path = PolygonPath | RectPath` is already in place and
`scalePathToBounds` / `translatePath` already handle RectPath natively,
so the rect fast-path survives the collapse with no kit-side changes.

**Ordering matters:** the type change (T1) breaks the codebase until
the consumer updates (T2–T9) land. Do the work in a feature branch /
worktree; only commit at the end of T11.

---

## T0 — Snapshot Baseline

**Files:** none.

- [ ] **Step 1: Confirm green starting point**

  Run from repo root: `pnpm exec tsc --noEmit && pnpm exec vitest run`
  Expected: PASS (or a known list of failures unrelated to this
  change — record them).

- [ ] **Step 2: Capture the rect-branch survey baseline**

  Run: `grep -rn "kind === 'rect'\|kind: 'rect'" /Users/mike/src/weasel/apps/swillustrator/src/ | wc -l`
  Expected: **60** (yardstick — after T11, only `RectPath` literals
  remain).

- [ ] **Step 3: Verify kit re-exports `Path`**

  Run: `grep -n "export.*Path" /Users/mike/src/weasel/src/index.ts /Users/mike/src/weasel/src/features/paths/index.ts 2>/dev/null | head -20`
  Expected: `Path` is exported. If not, add:

  ```ts
  export type { Path, PolygonPath, RectPath } from './features/paths/types';
  ```

  to the appropriate barrel.

---

## T1 — Type-only union restructure in `poseUpdate.ts`

**Files:** `/Users/mike/src/weasel/apps/swillustrator/src/poseUpdate.ts`

Pure type change. The codebase won't typecheck after this step — that
is expected and resolves by T9.

- [ ] **Step 1: Rewrite the union**

  Replace lines 1–9 with:

  ```ts
  import type { Path, TextStyle } from '@weasel-js/core';
  import { scalePathToBounds, translatePath } from '@weasel-js/core';

  export type ToolKind =
    | 'rect' | 'ellipse' | 'polygon' | 'star' | 'line'
    | 'pen' | 'pencil' | 'text' | 'imported';

  /** Non-bounds-derivable shape parameters. Bounds-derived params
   *  (ellipse rx/ry, polygon outer radius, line endpoints) are NOT
   *  stored — they're derived from x/y/width/height. */
  export type PathParams =
    | { sides: number }                  // tool === 'polygon'
    | { points: number; ratio: number }; // tool === 'star'

  export interface BaseObj {
    id: string;
    tool: ToolKind;
    x: number; y: number; width: number; height: number;
    rotation?: number;
  }

  export interface PathObj extends BaseObj {
    tool: Exclude<ToolKind, 'text'>;
    path: Path;
    closed: boolean;
    fill: string;
    stroke: string;
    strokeWidth: number;
    params?: PathParams;
  }

  export interface TextObj extends BaseObj {
    tool: 'text';
    text: string;
    style?: TextStyle;
  }

  export type Obj = PathObj | TextObj;
  ```

- [ ] **Step 2: Do not touch `applyPoseToObj` yet** — that's T2.

- [ ] **Step 3: Confirm typecheck breakage is localized to callsites**

  Run: `pnpm exec tsc --noEmit 2>&1 | head -40`
  Expected: errors are in `App.tsx`, `svgInterop.ts`,
  `kindIcons.tsx`, and the test files — not in `poseUpdate.ts` itself.

---

## T2 — Update `applyPoseToObj`

**Files:** `/Users/mike/src/weasel/apps/swillustrator/src/poseUpdate.ts`

The rect fast-path is implicit via `scalePathToBounds`'s `RectPath`
pass-through. The text branch's discriminator changes from
`prev.kind === 'text'` to `prev.tool === 'text'`.

- [ ] **Step 1: Replace the body of `applyPoseToObj`**

  ```ts
  export function applyPoseToObj(prev: Obj, pose: Pose): Obj {
    const nextRotation = pose.rotation === undefined ? prev.rotation : pose.rotation;
    const rectFields = { x: pose.x, y: pose.y, width: pose.width, height: pose.height, rotation: nextRotation };
    if (prev.tool === 'text' && pose.height !== prev.height) {
      const fontSize = Math.max(8, Math.round(pose.height * 0.7));
      const style = { ...(prev.style ?? {}), fontSize };
      return { ...prev, ...rectFields, style };
    }
    if (prev.tool !== 'text') {
      // PathObj — narrow via tool discriminator.
      const moved = pose.width !== prev.width || pose.height !== prev.height;
      const path = moved
        ? scalePathToBounds(prev.path, {
            kind: 'rect',
            x: pose.x, y: pose.y,
            width: pose.width, height: pose.height,
          })
        : translatePath(prev.path, pose.x - prev.x, pose.y - prev.y);
      // `tool` and `params` carry through via spread — resize is intentionally
      // tool/params-blind (drift is acceptable per the spec).
      return { ...prev, ...rectFields, path };
    }
    return { ...prev, ...rectFields };
  }
  ```

  Note the dropped `as PolygonPath` casts: `scalePathToBounds` and
  `translatePath` now return `Path` and `PathObj.path: Path` accepts
  that.

- [ ] **Step 2: Confirm `poseUpdate.ts` types cleanly**

  Run: `pnpm exec tsc --noEmit 2>&1 | grep poseUpdate || echo "poseUpdate.ts clean"`
  Expected: clean.

---

## T3 — Fix `translateObj`

**Files:** `/Users/mike/src/weasel/apps/swillustrator/src/App.tsx`

Today `translateObj` only bumps `x`/`y`. After the collapse, every
non-text Obj has an embedded `path` that also has to translate
(otherwise the rendered geometry desyncs from the AABB). This is the
latent bug surfaced in the rect-as-path agent's findings.

- [ ] **Step 1: Locate and rewrite `translateObj` (around line 177)**

  ```ts
  function translateObj(o: Obj, dx: number, dy: number): Obj {
    if (o.tool !== 'text') {
      return { ...o, x: o.x + dx, y: o.y + dy, path: translatePath(o.path, dx, dy) };
    }
    return { ...o, x: o.x + dx, y: o.y + dy };
  }
  ```

- [ ] **Step 2: Ensure `translatePath` is imported**

  Search imports in `App.tsx` for `translatePath`; add to the
  `@weasel-js/core` import line if missing.

- [ ] **Step 3: Add a unit test pinning the translate fix**

  In `apps/swillustrator/src/poseRotation.test.ts` (or a new
  `translateObj.test.ts` next to it):

  ```ts
  it('translateObj also translates an embedded RectPath', () => {
    const r: PathObj = {
      id: 'r', tool: 'rect', x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      closed: true, fill: '#000', stroke: '#000', strokeWidth: 0,
    };
    const next = translateObj(r, 7, 11);
    if (next.tool === 'text') throw new Error('unreachable');
    expect(next.x).toBe(7);
    expect(next.path).toEqual({ kind: 'rect', x: 7, y: 11, width: 10, height: 10 });
  });

  it('translateObj also translates a PolygonPath', () => {
    const p: PathObj = {
      id: 'p', tool: 'polygon', x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'polygon', coords: [0,0, 10,0, 5,10], closed: true },
      closed: true, fill: '#000', stroke: '#000', strokeWidth: 0,
      params: { sides: 3 },
    };
    const next = translateObj(p, 7, 11);
    if (next.tool === 'text') throw new Error('unreachable');
    expect(next.x).toBe(7);
    expect(next.path.kind).toBe('polygon');
    if (next.path.kind !== 'polygon') throw new Error('unreachable');
    expect(next.path.coords).toEqual([7,11, 17,11, 12,21]);
  });
  ```

  (Note: `translateObj` is module-local in `App.tsx`. If it's not
  exported, either export it for testing or test through a public
  surface like `cloneNode`. The above assumes a small refactor to
  export `translateObj` from `App.tsx` for testability — alternative:
  put `translateObj` in a separate `translateObj.ts` module if it
  doesn't fit in `App.tsx`.)

---

## T4 — Update `App.tsx` discriminator branches

**Files:** `/Users/mike/src/weasel/apps/swillustrator/src/App.tsx`

Walk every `obj.kind === 'rect'`, `obj.kind === 'path'`,
`obj.kind === 'text'` site and rewrite as `obj.tool === '<value>'` or
`obj.path.kind === 'rect'` depending on intent (per spec § "`tool` vs.
`path.kind`").

- [ ] **Step 1: `commitInsert` (line ~567)**

  ```ts
  commitInsert: (b: Pose): Obj => {
    const id = `r${nextId.current++}`;
    const obj: PathObj = {
      id, tool: 'rect',
      x: b.x, y: b.y, width: b.width, height: b.height,
      path: { kind: 'rect', x: b.x, y: b.y, width: b.width, height: b.height },
      closed: true,
      fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
    };
    return obj;
  },
  ```

- [ ] **Step 2: `createPathNode` (line ~614)**

  This is called by booleans (union/subtract/etc.) — output is a
  freshly synthesized path, so `tool: 'imported'` is the correct
  authoring origin (per spec § "Out of Scope" — boolean outputs land
  as `'imported'`).

  ```ts
  createPathNode: (path: Path): { id: string } => {
    const id = `b${nextId.current++}`;
    const b = path.kind === 'rect'
      ? { x: path.x, y: path.y, width: path.width, height: path.height }
      : boundsOfPath(path);
    const pathNode: PathObj = {
      id, tool: 'imported',
      x: b.x, y: b.y, width: b.width, height: b.height,
      path, closed: true,
      fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
    };
    return pathNode;
  },
  ```

- [ ] **Step 3: `cloneNode` stub fallback (line ~645)**

  ```ts
  cloneNode: (id: NodeId, offset: { dx: number; dy: number }): { id: NodeId } & Obj => {
    const src = itemsRef.current.find((o) => o.id === id);
    const newId = `${(src?.tool ?? 'p')[0]}${nextId.current++}`;
    if (!src) {
      const stub: PathObj = {
        id: newId, tool: 'imported',
        x: 0, y: 0, width: 0, height: 0,
        path: { kind: 'rect', x: 0, y: 0, width: 0, height: 0 }, closed: true,
        fill: fillRef.current, stroke: strokeRef.current, strokeWidth: strokeWidthRef.current,
      };
      return stub as { id: NodeId } & Obj;
    }
    const next = { ...translateObj(src, offset.dx, offset.dy), id: newId };
    return next as { id: NodeId } & Obj;
  },
  ```

- [ ] **Step 4: `pathForObj` (line ~262)**

  ```ts
  function pathForObj(o: Obj): Path {
    if (o.tool !== 'text') return o.path;
    return { kind: 'rect', x: o.x, y: o.y, width: o.width, height: o.height };
  }
  ```

- [ ] **Step 5: `drawGhost` (line ~718) — collapse rect arm into path arm**

  ```ts
  drawGhost: (obj, pose): DrawCommand[] => {
    if (!obj) return [];
    const fullPose: Pose = { ...pose, rotation: (pose as Pose).rotation ?? (obj as Obj).rotation };
    const o = obj as Obj;
    if (o.tool !== 'text') {
      const livePath: Path = o.path.kind === 'rect'
        ? { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height }
        : scalePathToBounds(o.path, { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height });
      const cmds: DrawCommand[] = [];
      if (o.closed) cmds.push({ kind: 'path', path: livePath, fill: { color: o.fill } });
      if (o.strokeWidth > 0) {
        cmds.push({ kind: 'path', path: livePath, stroke: { paint: { color: o.stroke }, width: o.strokeWidth } });
      }
      return wrapWithRotation(cmds, fullPose);
    }
    return wrapWithRotation([{
      kind: 'path',
      path: { kind: 'rect', x: pose.x + 0.5, y: pose.y + 0.5, width: pose.width, height: pose.height },
      stroke: { paint: { color: '#888' }, width: 1, dash: [3, 3] },
    }], fullPose);
  },
  ```

- [ ] **Step 6: `drawOne` in clone tool (line ~964) — mirror of Step 5**

  Same shape as Step 5. Replace the inner branch with `o.tool !== 'text'`.

- [ ] **Step 7: `eyedropper.colorOf` (line ~762)**

  ```ts
  if (obj.tool !== 'text') {
    return obj.fill || obj.stroke || null;
  }
  if (obj.tool === 'text') {
    const f = obj.style?.fill;
    return f && f.fill === 'solid' ? f.color : null;
  }
  return null;
  ```

- [ ] **Step 8: property-panel selection patchers (line ~1248)**

  ```ts
  const applyFillToSelection = (color: string): void => {
    updateSelected((o) => {
      if (o.tool !== 'text') return { ...o, fill: color };
      const prevFill = o.style?.fill;
      const nextFill = prevFill && prevFill.fill === 'solid'
        ? { ...prevFill, color }
        : { fill: 'solid' as const, color };
      return { ...o, style: { ...(o.style ?? {}), fill: nextFill } };
    });
  };
  const applyStrokeToSelection = (color: string): void => {
    updateSelected((o) => o.tool !== 'text' ? { ...o, stroke: color } : o);
  };
  const applyStrokeWidthToSelection = (w: number): void => {
    updateSelected((o) => o.tool !== 'text' ? { ...o, strokeWidth: w } : o);
  };
  ```

  `hasStrokeProps` / `primaryFill` / `primaryStroke` / `primaryStrokeWidth`
  (lines ~1244–1302): swap `primary.kind === 'text'` → `primary.tool === 'text'`
  and `primary.kind !== 'text'` → `primary.tool !== 'text'`.

- [ ] **Step 9: `getNodeAtPoint` (line ~994)**

  If today it returns `kind: top.kind`, change to `tool: top.tool` (or
  whatever the downstream consumer needs — verify by reading the call
  site). If the field is named `kind` in the consumer interface and
  that interface lives outside Swillustrator, keep a `kind:` alias:
  decide locally based on the consumer's type.

- [ ] **Step 10: Drop `RectObj` from imports**

  Search for `RectObj` in `App.tsx` and remove it from the import from
  `./poseUpdate`.

- [ ] **Step 11: Typecheck mid-task**

  Run: `pnpm exec tsc --noEmit 2>&1 | grep "App\\.tsx" | head -20`
  Expected: only test-file errors / shape-tool factory errors remain
  (those resolve in T5–T6).

---

## T5 — Update shape-creating tool wirings

**Files:** `/Users/mike/src/weasel/apps/swillustrator/src/App.tsx`

Every shape tool's `create` factory writes a PathObj with `tool: ...`.
Polygon and star also write `params`.

- [ ] **Step 1: Extend `pathToObj` factory**

  Find `pathToObj` (the closure that wraps a kit `PolygonPath` into a
  Swillustrator `PathObj`). Extend its signature:

  ```ts
  const pathToObj = useCallback(
    (
      path: PolygonPath,
      closed: boolean,
      tool: Exclude<ToolKind, 'text'>,
      params?: PathParams,
    ): PathObj => {
      const b = boundsOfPath(path);
      return {
        id: `p${nextId.current++}`,
        tool,
        x: b.x, y: b.y, width: b.width, height: b.height,
        path, closed,
        fill: fillRef.current,
        stroke: strokeRef.current,
        strokeWidth: strokeWidthRef.current,
        ...(params ? { params } : {}),
      };
    },
    [],
  );
  ```

- [ ] **Step 2: `useEllipseTool` (line ~924)**

  ```ts
  const ellipse = useEllipseTool<PathObj>({
    minBounds: { width: 2, height: 2 },
    create: (bounds) => pathToObj(ellipsePath(bounds), true, 'ellipse'),
  });
  ```

- [ ] **Step 3: `useLineTool` (line ~929)**

  ```ts
  const line = useLineTool<PathObj>({
    minLength: 2,
    create: (a, b) => pathToObj(linePath(a, b), false, 'line'),
  });
  ```

- [ ] **Step 4: `usePolygonTool` (line ~934) — writes params**

  ```ts
  const polygon = usePolygonTool<PathObj>({
    minRadius: 2,
    sides: 6,
    create: (center, radius, rotation, sides) =>
      pathToObj(
        regularPolygonPath(center, radius, rotation, sides),
        true,
        'polygon',
        { sides },
      ),
  });
  ```

- [ ] **Step 5: `useStarTool` (line ~941) — writes params**

  ```ts
  const star = useStarTool<PathObj>({
    minRadius: 2,
    points: 5,
    innerRatio: 0.5,
    create: (center, outer, inner, rotation, points) => {
      const ratio = outer > 0 ? inner / outer : 0.5;
      return pathToObj(
        starPath(center, outer, inner, rotation, points),
        true,
        'star',
        { points, ratio },
      );
    },
  });
  ```

- [ ] **Step 6: `usePencilTool` (line ~949)**

  ```ts
  const pencil = usePencilTool<PathObj>({
    create: (path) => pathToObj(path, false, 'pencil'),
  });
  ```

- [ ] **Step 7: `useUserPenTool` (line ~882)**

  ```ts
  const pen = useUserPenTool<PathObj>({
    create: (path, closed) => pathToObj(path, closed, 'pen'),
  });
  ```

  (Signature may differ — read the actual `useUserPenTool` option
  shape and adapt.)

- [ ] **Step 8: `useTextTool` (line ~784)**

  Ensure the TextObj factory writes `tool: 'text'` (not `kind: 'text'`).

---

## T6 — Update consumer wrappers (`useUserPolygonTool`, `useUserStarTool`)

**Files:** `/Users/mike/src/weasel/apps/swillustrator/src/App.tsx`

If `useUserPolygonTool` / `useUserStarTool` exist as Swillustrator-side
wrappers over the kit's `usePolygonTool` / `useStarTool`, they need to
thread `sides` / `points + ratio` through to `pathToObj`. If T5
already covers them, this task is a no-op.

- [ ] **Step 1: Verify**

  ```bash
  grep -n "useUserPolygonTool\|useUserStarTool" /Users/mike/src/weasel/apps/swillustrator/src/App.tsx
  ```

  If matched: rewrite their `create` factories to pass the parameters
  through to `pathToObj` exactly as in T5. If not matched: skip — T5
  already covers it.

---

## T7 — Merge `rectLayer` into `pathLayer`

**Files:** `/Users/mike/src/weasel/apps/swillustrator/src/App.tsx`

Both layers now render `PathObj`. Merge into one "shapeLayer."

- [ ] **Step 1: Delete the `rectLayer` constant (around line 1159)**

  Remove the whole `const rectLayer = ...` block.

- [ ] **Step 2: Rename / unify `pathLayer`**

  `pathLayer` already filters `itemsRef.current.filter((o): o is
  PathObj => o.kind === 'path')`. Rewrite the filter:

  ```ts
  const shapeLayer = useMemo(() => ({
    // ... existing pathLayer body
    items: itemsRef.current.filter((o): o is PathObj => o.tool !== 'text'),
    // ...
  }), [/* deps */]);
  ```

  Drop the `as PolygonPath` cast inside `pathLayer`'s body (line
  ~1201/1204) since `PathObj.path: Path` now.

- [ ] **Step 3: Update `<Canvas>` `layers` prop**

  Replace `[rectLayer, pathLayer, textLayer, ...]` with
  `[shapeLayer, textLayer, ...]`. Z-order is now scene-order across
  all non-text shapes — verify visually in T11 manual smoke.

---

## T8 — Update `svgInterop.ts`

**Files:** `/Users/mike/src/weasel/apps/swillustrator/src/svgInterop.ts`

The bridge layer:
1. drops the local `RectObj` mirror;
2. emits `swill:tool` + `swill:params-*` attrs;
3. parses them back on import, falling back to `tool: 'imported'`
   (or `tool: 'rect'` when the rect-detector fires).

- [ ] **Step 1: Shrink the local union mirror (lines 95–99)**

  ```ts
  interface BaseObj { id: string; tool: ToolKind; x: number; y: number; width: number; height: number; rotation?: number }
  interface TextObj extends BaseObj { tool: 'text'; text: string; style?: TextStyle }
  interface PathObj extends BaseObj {
    tool: Exclude<ToolKind, 'text'>;
    path: Path;
    closed: boolean;
    fill: string;
    stroke: string;
    strokeWidth: number;
    params?: PathParams;
  }
  type Obj = PathObj | TextObj;
  ```

  Drop the local `RectObj` interface. Import `ToolKind` and `PathParams`
  from `./poseUpdate` (or just import the full types).

- [ ] **Step 2: Add `encodeParams` / `decodeParams` helpers**

  ```ts
  function encodeSwillAttrs(o: PathObj | TextObj): Record<string, string> {
    const attrs: Record<string, string> = { tool: o.tool };
    if (o.tool !== 'text' && o.params) {
      if ('sides' in o.params) attrs['params-sides'] = String(o.params.sides);
      if ('points' in o.params) attrs['params-points'] = String(o.params.points);
      if ('ratio' in o.params) attrs['params-ratio'] = String(o.params.ratio);
    }
    return attrs;
  }

  function decodeToolAndParams(
    attrs: Record<string, string> | undefined,
    pathKind: 'rect' | 'polygon',
  ): { tool: Exclude<ToolKind, 'text'>; params?: PathParams } {
    const raw = attrs?.tool;
    const validTools = new Set([
      'rect', 'ellipse', 'polygon', 'star', 'line', 'pen', 'pencil', 'imported',
    ]);
    let tool: Exclude<ToolKind, 'text'>;
    if (raw && validTools.has(raw)) {
      tool = raw as Exclude<ToolKind, 'text'>;
    } else {
      // Fall back per migration rule: rect-detector hit → 'rect', else 'imported'.
      tool = pathKind === 'rect' ? 'rect' : 'imported';
    }
    let params: PathParams | undefined;
    if (tool === 'polygon' && attrs) {
      const sides = parseFloat(attrs['params-sides']);
      if (Number.isFinite(sides) && sides >= 3) params = { sides };
    } else if (tool === 'star' && attrs) {
      const points = parseFloat(attrs['params-points']);
      const ratio = parseFloat(attrs['params-ratio']);
      if (Number.isFinite(points) && points >= 3 && Number.isFinite(ratio)) {
        params = { points, ratio };
      }
    }
    return { tool, params };
  }
  ```

- [ ] **Step 3: Collapse `objToSvgNode`'s rect arm (lines 102–150)**

  Delete the `if (o.kind === 'rect')` block. The unified path branch
  emits an `SvgPathNode` wrapping `o.path` (which may be a `RectPath`
  or `PolygonPath`).

  At the end of the path-Obj branch, attach swill attrs:

  ```ts
  const node: SvgPathNode = { /* existing path node construction */ };
  node.meta = { swill: { attrs: encodeSwillAttrs(o) } };
  return node;
  ```

  For TextObj, merge `tool: 'text'` into the existing
  `meta.swill.attrs` bag (which already carries `line-height` etc.) —
  do **not** overwrite the existing bag.

- [ ] **Step 4: Collapse `svgNodesToObjsWithGroups`'s rect-import arm (lines 223–287)**

  Unify the two arms into one PathObj construction; use
  `decodeToolAndParams` to resolve `tool` and `params`:

  ```ts
  const fill = colorFromPaint(n.fill, '#000000');
  const stroke = n.stroke ? colorFromPaint(n.stroke.paint, '#000000') : '#000000';
  const strokeWidth = n.stroke?.width ?? 0;
  let bounds: { x: number; y: number; width: number; height: number };
  let closed: boolean;
  if (n.path.kind === 'rect') {
    bounds = { x: n.path.x, y: n.path.y, width: n.path.width, height: n.path.height };
    closed = true;
  } else {
    bounds = pathBounds(n.path);
    closed = isClosedPolygon(n.path);
  }
  const { tool, params } = decodeToolAndParams(n.meta?.swill?.attrs, n.path.kind);
  const o: PathObj = {
    id: nextId(),
    tool,
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    path: n.path, closed, fill, stroke, strokeWidth,
    ...(params ? { params } : {}),
  };
  if (n.rotation) o.rotation = n.rotation;
  items.push(o);
  return o.id;
  ```

- [ ] **Step 5: Update the file header comment**

  Drop the `RectObj` reference; describe the new union.

- [ ] **Step 6: Typecheck**

  Run: `pnpm exec tsc --noEmit 2>&1 | grep svgInterop || echo "svgInterop clean"`

---

## T9 — LayerList icon picker

**Files:**
- `/Users/mike/src/weasel/apps/swillustrator/src/kindIcons.tsx`
- (search) every consumer of `KindIcon`

`kindIcons.tsx` today has only `RectIcon`, `TextIcon`, `PathIcon`,
`PageIcon`. The kit already ships every per-shape icon we need from
`@weasel-js/core` (the same icons the tool palette uses):
`RectIcon`, `EllipseIcon`, `PolygonIcon`, `StarIcon`, `LineIcon`,
`PenIcon`, `PencilIcon`, `TextIcon`, `UnknownIcon`. T9 reuses those
directly — zero new SVG authoring.

- [ ] **Step 1: Import the kit's icons**

  Replace the existing per-shape inline functions in `kindIcons.tsx`
  with re-imports from the kit:

  ```tsx
  // kindIcons.tsx
  import {
    RectIcon, EllipseIcon, PolygonIcon, StarIcon, LineIcon,
    PenIcon, PencilIcon, TextIcon, UnknownIcon,
  } from '@weasel-js/core';

  // Keep the existing PageIcon (no kit equivalent).
  // PathIcon is no longer needed — UnknownIcon replaces it for the
  // `tool: 'imported'` fallback.
  ```

  Delete the old `RectIcon`, `TextIcon`, `PathIcon` function
  definitions in this file — they're shadowed by the kit imports.
  `PageIcon` stays.

- [ ] **Step 2: Rewrite the dispatch**

  Replace the existing `KindIcon` (lines 60–67) with:

  ```tsx
  /** Dispatch by authoring tool — convenient one-liner for the LayerList. */
  export function ToolIcon({ tool }: { tool: ToolKind }): ReactNode {
    switch (tool) {
      case 'rect': return <RectIcon />;
      case 'ellipse': return <EllipseIcon />;
      case 'polygon': return <PolygonIcon />;
      case 'star': return <StarIcon />;
      case 'line': return <LineIcon />;
      case 'pen': return <PenIcon />;
      case 'pencil': return <PencilIcon />;
      case 'text': return <TextIcon />;
      case 'imported': return <UnknownIcon />;
    }
  }
  ```

  Add the import for `ToolKind` at the top of `kindIcons.tsx`:

  ```ts
  import type { ToolKind } from './poseUpdate';
  ```

- [ ] **Step 3: Update call sites**

  Run: `grep -rn "KindIcon" /Users/mike/src/weasel/apps/swillustrator/src/`

  At each call site (likely the LayerList row component), rewrite:

  ```tsx
  <KindIcon kind={o.kind} />
  ```

  →

  ```tsx
  <ToolIcon tool={o.tool} />
  ```

  Optionally keep a deprecated `KindIcon` re-export for any straggler;
  prefer to clean up.

---

## T10 — Test updates

**Files:**
- `/Users/mike/src/weasel/apps/swillustrator/src/svgInterop.test.ts`
- `/Users/mike/src/weasel/apps/swillustrator/src/poseRotation.test.ts`
- `/Users/mike/src/weasel/apps/swillustrator/src/rotateUndo.test.ts`
- (maybe) `/Users/mike/src/weasel/apps/swillustrator/src/rotationHitTest.test.ts`

Every test fixture that built `{ kind: 'rect', ... }` becomes
`{ tool: 'rect', path: { kind: 'rect', ... }, closed: true, ... }`.

- [ ] **Step 1: Replace rect fixtures**

  In `poseRotation.test.ts` (3 fixtures, lines ~11, 17, 23) and
  `rotateUndo.test.ts` (1 fixture, line ~43):

  ```ts
  { id: 'r', tool: 'rect', x: 0, y: 0, width: 10, height: 10,
    path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true,
    fill: '#000', stroke: '#000', strokeWidth: 0 }
  ```

- [ ] **Step 2: Replace `svgInterop.test.ts` fixtures**

  Drop the local `RectObjT` type (line ~15) and rewrite every
  `{ id, kind: 'rect', ... }` literal as the PathObj shape above with
  `tool: 'rect'`.

  Affected line numbers (per the rect-as-path survey): 15 (type), 31,
  44, 92, 99, 199, 200, 214, 215, 227, 279, 418, 438, 450.

  Assertions like `expect(node.path).toEqual({ kind: 'rect', ... })`
  on line ~37 test the `SvgPathNode.path` (kit-side `RectPath`) and
  stay correct — they assert the embedded `Path`, not `Obj.tool`.

- [ ] **Step 3: Add SVG round-trip tests for `tool` + `params`**

  In `svgInterop.test.ts`:

  ```ts
  it('round-trips tool: ellipse', () => { /* ... */ });
  it('round-trips tool: polygon with params.sides', () => { /* ... */ });
  it('round-trips tool: star with params.points + ratio', () => { /* ... */ });
  it('round-trips tool: line', () => { /* ... */ });
  it('round-trips tool: pen with no params', () => { /* ... */ });
  it('round-trips tool: pencil with no params', () => { /* ... */ });
  it('imports a <path> without swill:tool as tool: imported', () => { /* ... */ });
  it('imports a rect-detector match without swill:tool as tool: rect', () => { /* ... */ });
  it('imports a polygon with bogus params-sides as params: undefined', () => { /* ... */ });
  it('imports a path with unknown swill:tool="bogus" as tool: imported', () => { /* ... */ });
  ```

- [ ] **Step 4: Pin the rect-fast-path invariant**

  In `poseRotation.test.ts` (or new file):

  ```ts
  it('rect-origin PathObj stays a RectPath after resize', () => {
    const r: PathObj = { id: 'r', tool: 'rect', x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true,
      fill: '#000', stroke: '#000', strokeWidth: 0 };
    const next = applyPoseToObj(r, { x: 5, y: 5, width: 20, height: 30 });
    if (next.tool === 'text') throw new Error('unreachable');
    expect(next.path.kind).toBe('rect');
    expect(next.path).toEqual({ kind: 'rect', x: 5, y: 5, width: 20, height: 30 });
    expect(next.tool).toBe('rect'); // tool persists across resize
  });

  it('star-origin PathObj keeps tool: star and params after resize (drift acceptable)', () => {
    const s: PathObj = { id: 's', tool: 'star', x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'polygon', coords: [0,0, 5,10, 10,0], closed: true }, closed: true,
      fill: '#000', stroke: '#000', strokeWidth: 0,
      params: { points: 5, ratio: 0.5 } };
    const next = applyPoseToObj(s, { x: 5, y: 5, width: 20, height: 30 });
    if (next.tool === 'text') throw new Error('unreachable');
    expect(next.tool).toBe('star');
    expect(next.params).toEqual({ points: 5, ratio: 0.5 });
  });
  ```

- [ ] **Step 5: Skim `rotationHitTest.test.ts`**

  ```bash
  grep -n "kind: 'rect'\|kind === 'rect'\|kind: 'path'\|kind: 'text'" /Users/mike/src/weasel/apps/swillustrator/src/rotationHitTest.test.ts
  ```

  Rewrite any matches with the new union shape.

- [ ] **Step 6: Run the Swillustrator test suite**

  `pnpm exec vitest run apps/swillustrator`
  Expected: PASS.

---

## T11 — Final regression sweep

**Files:** none — verification only.

- [ ] **Step 1: Verify zero remaining `Obj.kind` references**

  ```bash
  grep -rn "kind === 'rect'\|kind: 'rect'" /Users/mike/src/weasel/apps/swillustrator/src/ | grep -v "path: {" | grep -v "// "
  grep -rn "obj\\.kind\|o\\.kind\|\\.kind === " /Users/mike/src/weasel/apps/swillustrator/src/ | grep -v "path\\.kind\|SvgNode\|n\\.path"
  grep -rn "RectObj" /Users/mike/src/weasel/apps/swillustrator/src/
  ```

  Expected: zero non-RectPath / non-SvgNode hits. Zero `RectObj` hits.

- [ ] **Step 2: Full prepublishOnly gate**

  ```bash
  cd /Users/mike/src/weasel
  pnpm run prepublishOnly
  ```

  (Or equivalently: `tsc --noEmit && vitest run && tsup build`.)
  Expected: PASS. This is the CI gate per the memory note.

- [ ] **Step 3: Manual smoke**

  ```bash
  pnpm --filter swillustrator dev
  ```

  Then in the browser:
  1. Press `R`, drag a rect. Confirm fill / stroke match swatches.
  2. Resize: drag a corner. Confirm it stays axis-aligned (no
     polygon promotion).
  3. Rotate via properties panel. Confirm rotation persists.
  4. Alt-drag clone. Confirm clone has same paint and `tool`.
  5. Draw one each: ellipse (E), polygon (default hex), star
     (default 5pt), line (L), pen (P), pencil (N), text (T).
  6. Save SVG → open in text editor → verify each shape has the
     expected `swill:tool="..."` attr; polygon has
     `swill:params-sides`; star has `swill:params-points` +
     `swill:params-ratio`; pencil/pen/rect/ellipse/line have only
     `swill:tool` (no `params-*`).
  7. Reload the SVG → verify visual fidelity and `tool` survives.
  8. Re-save → confirm byte-equivalent SVG for the swill attrs.
  9. LayerList: confirm each shape kind shows the distinct icon
     (rect / ellipse / polygon / star / line / pen / pencil / text).
  10. Open a hand-written SVG from outside (e.g. an export from
      another tool) → confirm the resulting Objs have
      `tool: 'imported'` (or `tool: 'rect'` if the rect-detector
      fires).
  11. Boolean union two shapes → confirm the result has
      `tool: 'imported'`.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/swillustrator/src/poseUpdate.ts \
          apps/swillustrator/src/svgInterop.ts \
          apps/swillustrator/src/App.tsx \
          apps/swillustrator/src/kindIcons.tsx \
          apps/swillustrator/src/svgInterop.test.ts \
          apps/swillustrator/src/poseRotation.test.ts \
          apps/swillustrator/src/rotateUndo.test.ts
  # Plus any new test files / icon files / call-site updates.

  git commit -m "$(cat <<'EOF'
  refactor(swillustrator): restructure Obj union (tool discriminator + rect-as-path + params)

  - Collapse RectObj into PathObj with path.kind === 'rect'.
  - Replace `kind` with `tool` as top-level discriminator
    ('rect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'pen' |
    'pencil' | 'text' | 'imported').
  - Add PathObj.params for non-bounds-derivable shape parameters
    (polygon sides, star points + ratio).
  - Merge rectLayer + pathLayer into a single shapeLayer.
  - SVG round-trip: swill:tool="..." and swill:params-* attrs on the
    path/text node's meta.swill.attrs bag.
  - LayerList icons: distinct icons for each authoring tool.
  - Fix latent bug: translateObj now also translates embedded path
    coords for non-rect PathObjs.

  Pre-1.0; no migration needed. Existing Swillustrator SVGs round-trip
  via the rect-detector → tool: 'rect' fallback.
  EOF
  )"
  ```

---

## Self-Review Checklist (run before handing off)

- [ ] Spec § "Before / After" lines up with T1.
- [ ] Spec § Acceptance #1 (no `obj.kind === 'rect'`) → T11 Step 1.
- [ ] Spec § Acceptance #2 (no `Obj.kind` references) → T11 Step 1.
- [ ] Spec § Acceptance #3 (every tool writes `tool`) → T5 + T10.
- [ ] Spec § Acceptance #4 (visual parity) → T11 Step 3.
- [ ] Spec § Acceptance #5 (no polygon promotion on resize) → T10 Step 4.
- [ ] Spec § Acceptance #6 (rect-fast-path) → T10 Step 4.
- [ ] Spec § Acceptance #7 (SVG round-trip) → T10 Step 3 + T11 Step 3.
- [ ] Spec § Acceptance #8 (imported fallback) → T10 Step 3.
- [ ] Spec § Acceptance #9 (LayerList icons) → T9 + T11 Step 3.
- [ ] Spec § Acceptance #10 (booleans see RectPath) → T4 Step 4
      (`pathForObj` change).
- [ ] Spec § Acceptance #11 (prepublishOnly clean) → T11 Step 2.
- [ ] No "TBD" / "implement later" placeholders in the plan body.
- [ ] Every type / function (`Path`, `translatePath`, `scalePathToBounds`,
      `PathObj`, `Obj`, `ToolKind`, `PathParams`, `ToolIcon`) is
      defined in a prior task or is already in the codebase.

## Risk / Rollback

- **Risk:** the type union change in T1 cascades. Keep all edits on a
  branch / worktree; resist the urge to commit mid-plan.
- **Risk:** the `tool: 'imported'` value for boolean-op outputs may
  feel wrong in the LayerList (a unioned shape gets the "imported"
  icon). Accepted: a follow-up can add `tool: 'boolean'` if the UX
  needs it. Documented in the spec's Out-of-Scope section.
- **Risk:** `useUserPenTool` and other user-facing wrappers have
  slightly different `create` signatures than the kit tools they
  wrap. T6 hedges against this with a verification step.
- **Rollback:** the change is one logical commit. `git revert` undoes
  everything. No data migration needed (pre-1.0).
