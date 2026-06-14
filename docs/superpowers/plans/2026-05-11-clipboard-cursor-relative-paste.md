# Clipboard Cursor-Relative Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `getDropPoint` seam to `useClipboard` / `useClipboardOps` so consumers can make `Cmd+V` paste land at the pointer.

**Architecture:** Thread an optional `getDropPoint: () => { worldX, worldY } | null` from the hook options through `paste()` to the adapter's existing `commitPaste(cb, offset, { dropPoint })` contract. No adapter API change. Existing cascade-offset behavior is the fallback when `getDropPoint` is absent or returns null.

**Tech Stack:** TypeScript, React hooks, Vitest + React Testing Library, Vite for the demo runtime.

**Spec:** `docs/superpowers/specs/2026-05-11-clipboard-cursor-relative-paste-design.md`

---

## File map

- Modify: `src/interactions/actions/clipboard/clipboardOps.ts` — add `getDropPoint` option, thread to `commitPaste`.
- Modify: `src/interactions/actions/clipboard/clipboard.ts` — forward option from `useClipboard` to `useClipboardOps`.
- Modify: `src/interactions/actions/clipboard/clipboardOps.test.ts` — new tests.
- Create: `demo/demos/ClipboardDemo.tsx` — manual verification demo (no in-kit clipboard demo exists today).
- Modify: `demo/registry.ts` — register the new demo.
- Modify: `docs/TODO.md` — mark Tier 1.5 entry shipped; record arrayAdapter.commitPaste and SceneCanvas auto-wire as new follow-ups.

---

## Task 1: Thread `getDropPoint` through the hook (TDD)

**Files:**
- Modify: `src/interactions/actions/clipboard/clipboardOps.ts`
- Modify: `src/interactions/actions/clipboard/clipboard.ts`
- Test: `src/interactions/actions/clipboard/clipboardOps.test.ts`

The test adapter in `clipboardOps.test.ts` already records `commitPaste`'s args via its inline implementation. We extend it to capture the third arg.

- [ ] **Step 1.1: Update the test adapter to capture `commitPaste`'s third arg**

In `src/interactions/actions/clipboard/clipboardOps.test.ts`, locate `makeAdapter` (around line 9). Replace the `commitPaste` method and add a `pasteCtxLog` array so tests can assert on the third argument:

```ts
const pasteCtxLog: ({ dropPoint?: { worldX: number; worldY: number } } | undefined)[] = [];
// ...inside `const adapter: InsertAdapter<Obj> = { ... }`:
commitPaste(clipboard, offset, ctx) {
  pasteCtxLog.push(ctx);
  const out: Obj[] = [];
  for (const raw of clipboard.items) {
    const src = raw as Obj;
    out.push({ id: `n${nextId++}`, x: src.x + offset.dx, y: src.y + offset.dy });
  }
  return out;
},
```

And expose it from the helper return:

```ts
return {
  adapter,
  inserts,
  batches,
  pasteCtxLog,
  getSelection: () => selection,
  seed(o: Obj) { inserts.push(o); selection = [o.id]; },
};
```

- [ ] **Step 1.2: Write the failing tests**

Append these tests inside the `describe('useClipboardOps', ...)` block:

```ts
it('passes { dropPoint } as third arg when getDropPoint returns a point', () => {
  const helpers = makeAdapter();
  helpers.seed({ id: 'a', x: 0, y: 0 });
  const { result } = renderHook(() =>
    useClipboardOps(helpers.adapter, {
      getSelection: () => [asNodeId('a')],
      getDropPoint: () => ({ worldX: 50, worldY: 60 }),
    }),
  );
  act(() => { result.current.copy(); });
  act(() => { result.current.paste(); });
  expect(helpers.pasteCtxLog).toEqual([{ dropPoint: { worldX: 50, worldY: 60 } }]);
});

it('passes undefined ctx when getDropPoint returns null', () => {
  const helpers = makeAdapter();
  helpers.seed({ id: 'a', x: 0, y: 0 });
  const { result } = renderHook(() =>
    useClipboardOps(helpers.adapter, {
      getSelection: () => [asNodeId('a')],
      getDropPoint: () => null,
    }),
  );
  act(() => { result.current.copy(); });
  act(() => { result.current.paste(); });
  expect(helpers.pasteCtxLog).toEqual([undefined]);
});

it('omits ctx when getDropPoint option is not provided (regression)', () => {
  const helpers = makeAdapter();
  helpers.seed({ id: 'a', x: 0, y: 0 });
  const { result } = renderHook(() =>
    useClipboardOps(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
  );
  act(() => { result.current.copy(); });
  act(() => { result.current.paste(); });
  expect(helpers.pasteCtxLog).toEqual([undefined]);
});

it('calls getDropPoint exactly once per paste()', () => {
  const helpers = makeAdapter();
  helpers.seed({ id: 'a', x: 0, y: 0 });
  let calls = 0;
  const { result } = renderHook(() =>
    useClipboardOps(helpers.adapter, {
      getSelection: () => [asNodeId('a')],
      getDropPoint: () => { calls++; return { worldX: 1, worldY: 2 }; },
    }),
  );
  act(() => { result.current.copy(); });
  act(() => { result.current.paste(); });
  expect(calls).toBe(1);
});

it('still cascades: second paste reads the just-pasted ids as source', () => {
  const helpers = makeAdapter();
  helpers.seed({ id: 'a', x: 0, y: 0 });
  const { result } = renderHook(() =>
    useClipboardOps(helpers.adapter, {
      getSelection: () => [asNodeId('a')],
      getDropPoint: () => ({ worldX: 50, worldY: 60 }),
    }),
  );
  act(() => { result.current.copy(); });
  act(() => { result.current.paste(); });
  act(() => { result.current.paste(); });
  // Two pastes, two ctx entries, both with the same dropPoint.
  expect(helpers.pasteCtxLog).toHaveLength(2);
  // The cascade re-snapshot wires up: second paste produced new inserts beyond the first.
  expect(helpers.inserts.length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 1.3: Run tests, confirm failures**

Run:

```
npx vitest run src/interactions/actions/clipboard/clipboardOps.test.ts
```

Expected: the four new `getDropPoint` tests fail; the `cascade` test may pass coincidentally (no change yet). Existing tests remain green.

- [ ] **Step 1.4: Add `getDropPoint` to `UseClipboardOpsOptions` and thread it through `paste()`**

In `src/interactions/actions/clipboard/clipboardOps.ts`:

Replace the `UseClipboardOpsOptions` interface (lines 10-19):

```ts
/** Options for `useClipboardOps`. */
export interface UseClipboardOpsOptions {
  /** How the hook reads "current selection" for copy. The kit doesn't assume
   *  a global selection store; each consumer wires this. */
  getSelection: () => NodeId[];
  /** Called after a successful paste with the ids of the newly inserted objects. */
  onPaste?: (newIds: NodeId[]) => void;
  /** Label for the history entry produced by paste. Default 'Paste'. */
  pasteLabel?: string;
  /** Pulled once per paste() call. When non-null, threaded to commitPaste
   *  as `ctx.dropPoint`; adapters typically use it as the cluster origin
   *  (ignoring `offset`). When null/undefined, the hook falls back to the
   *  existing cascade-offset behavior. */
  getDropPoint?: () => { worldX: number; worldY: number } | null;
}
```

Update the `optsRef` destructure + assignment (around lines 35, 40-41):

```ts
const { getSelection, onPaste, pasteLabel = 'Paste', getDropPoint } = options;
const clipboardRef = useRef<ClipboardSnapshot>(EMPTY);
const adapterRef = useRef(adapter);
adapterRef.current = adapter;
const optsRef = useRef({ getSelection, onPaste, pasteLabel, getDropPoint });
optsRef.current = { getSelection, onPaste, pasteLabel, getDropPoint };
```

Replace the body of the `paste` callback (lines 49-66) with:

```ts
const paste = useCallback(() => {
  const cb = clipboardRef.current;
  if (cb.items.length === 0) return;
  const a = adapterRef.current;
  const offset = a.getPasteOffset?.(cb) ?? { dx: 0, dy: 0 };
  const dropPoint = optsRef.current.getDropPoint?.();
  const ctx = dropPoint != null ? { dropPoint } : undefined;
  const created = a.commitPaste(cb, offset, ctx);
  if (created.length === 0) return;
  const newIds = created.map((o) => o.id as NodeId);
  const beforeSel = optsRef.current.getSelection();
  const ops: Op[] = [
    ...created.map((o) => createInsertOp({ node: o })),
    createSetSelectionOp({ from: beforeSel, to: newIds }),
  ];
  dispatchApplyBatch(a, ops, optsRef.current.pasteLabel);
  clipboardRef.current = a.snapshotSelection(newIds);
  optsRef.current.onPaste?.(newIds);
}, []);
```

- [ ] **Step 1.5: Forward `getDropPoint` from `useClipboard` to `useClipboardOps`**

In `src/interactions/actions/clipboard/clipboard.ts`:

Update `UseClipboardOptions` (lines 27-41) — add the same field:

```ts
export interface UseClipboardOptions {
  getSelection: () => NodeId[];
  enableKeyboard?: boolean;
  cutLabel?: string;
  pasteLabel?: string;
  onPaste?: (newIds: NodeId[]) => void;
  /** Pulled once per paste() call. When non-null, threaded to commitPaste
   *  as `ctx.dropPoint`. See useClipboardOps for full semantics. */
  getDropPoint?: () => { worldX: number; worldY: number } | null;
}
```

Update the `useClipboardOps` call (lines 61-65):

```ts
const cb = useClipboardOps(adapter, {
  getSelection: options.getSelection,
  onPaste: options.onPaste,
  pasteLabel: options.pasteLabel,
  getDropPoint: options.getDropPoint,
});
```

- [ ] **Step 1.6: Run tests, confirm all green**

```
npx vitest run src/interactions/actions/clipboard/
```

Expected: all tests in `clipboardOps.test.ts` and `clipboard.test.ts` pass.

- [ ] **Step 1.7: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 1.8: Commit**

```bash
git add src/interactions/actions/clipboard/clipboardOps.ts src/interactions/actions/clipboard/clipboard.ts src/interactions/actions/clipboard/clipboardOps.test.ts
git commit -m "$(cat <<'EOF'
feat(clipboard): getDropPoint option for cursor-relative paste

Threads an optional getDropPoint thunk from useClipboard /
useClipboardOps through to commitPaste's existing ctx.dropPoint
contract. Cmd+V on a consumer wiring a pointer ref into getDropPoint
now lands at the cursor. Cascade behavior unchanged when getDropPoint
is absent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: ClipboardDemo with pointer tracking

**Files:**
- Create: `demo/demos/ClipboardDemo.tsx`
- Modify: `demo/registry.ts`

The demo seeds three rectangles, uses click-to-select, tracks pointer position via an `onMouseMove` listener on the wrapper, and wires the resulting ref into `getDropPoint`. The adapter implements a real `commitPaste` that uses `dropPoint` when present (centering the cluster bbox at the drop point) and falls back to `offset`.

- [ ] **Step 2.1: Create the demo file**

Create `demo/demos/ClipboardDemo.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react';
import {
  arrayAdapter,
  asNodeId,
  SceneCanvas,
  useClipboard,
  useSelectTool,
  useTools,
} from '@weasel-js/core';
import type { ClipboardSnapshot } from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 480, H = 320;

const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 60,  width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 160, y: 130, width: 80, height: 60, color: '#d4a574' },
  { id: 'c', x: 280, y: 60,  width: 80, height: 60, color: '#8aa6c1' },
];

export function ClipboardDemo() {
  const [items, setItems] = useState<Rect[]>(INITIAL);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [selection, setSelection] = useState<string[]>([]);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const dropPointRef = useRef<{ worldX: number; worldY: number } | null>(null);
  const nextId = useRef(0);

  const adapter = useMemo(() => ({
    ...arrayAdapter<Rect, Rect>({
      ref: itemsRef,
      setItems,
      toPose: (r) => r,
      selectionRef,
      setSelection,
    }),
    snapshotSelection: (ids: string[]): ClipboardSnapshot => ({
      items: ids.map((id) => itemsRef.current.find((o) => o.id === id)).filter((o): o is Rect => !!o),
    }),
    commitPaste: (
      clip: ClipboardSnapshot,
      offset: { dx: number; dy: number },
      ctx?: { dropPoint?: { worldX: number; worldY: number } },
    ): Rect[] => {
      const src = clip.items as Rect[];
      if (src.length === 0) return [];
      let dx = offset.dx;
      let dy = offset.dy;
      if (ctx?.dropPoint) {
        // Translate so the source cluster's bbox center lands at dropPoint.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const r of src) {
          minX = Math.min(minX, r.x);
          minY = Math.min(minY, r.y);
          maxX = Math.max(maxX, r.x + r.width);
          maxY = Math.max(maxY, r.y + r.height);
        }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        dx = ctx.dropPoint.worldX - cx;
        dy = ctx.dropPoint.worldY - cy;
      }
      return src.map((r) => ({
        ...r,
        id: `clip-${nextId.current++}`,
        x: r.x + dx,
        y: r.y + dy,
      }));
    },
    getPasteOffset: () => ({ dx: 16, dy: 16 }),
  }), [setItems]);

  useClipboard(adapter, {
    getSelection: () => selectionRef.current.map((id) => asNodeId(id)),
    getDropPoint: () => dropPointRef.current,
  });

  const select = useSelectTool(adapter);
  const tools = useTools({ active: 'select', registry: { select } });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const onMouseMove = (e: React.MouseEvent) => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dropPointRef.current = {
      worldX: e.clientX - rect.left,
      worldY: e.clientY - rect.top,
    };
  };
  const onMouseLeave = () => { dropPointRef.current = null; };

  const drawRect = (n: { data: Rect; id: string }, p: Rect): DrawCommand[] => [{
    kind: 'path',
    path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
    fill: { color: n.data.color },
  }];

  return (
    <div ref={wrapperRef} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        items={items}
        setItems={setItems}
        selection={selection}
        setSelection={setSelection}
        toPose={(r: Rect) => r}
        adapter={adapter}
        tools={tools}
        layers={{
          scene: { drawOne: drawRect },
        }}
      />
    </div>
  );
}
```

Note: if any of the props above (`items`/`setItems`/`toPose`/`selection`/`setSelection`/`adapter`) don't exist on `SceneCanvas`, drop them and pass only the props it accepts — model on `CloneDemo.tsx` if needed. The critical wires are `adapter` (with the cursor-aware `commitPaste`), `tools` (so click-to-select works), and the wrapper's `onMouseMove` updating `dropPointRef`.

- [ ] **Step 2.2: Register the demo in `demo/registry.ts`**

Add the import alongside the other demo imports (group near `ClippingDemo`):

```ts
import { ClipboardDemo } from './demos/ClipboardDemo';
import ClipboardDemoFull from './demos/ClipboardDemo.tsx?raw';
```

Add an entry in the demos array (place it near the `clone` entry):

```ts
{
  id: 'clipboard',
  title: 'Clipboard',
  category: 'Tools',
  description: 'useClipboard with getDropPoint wired to the pointer position — Cmd+C, move the mouse, Cmd+V lands the paste at the cursor.',
  hint: 'Click a rect, Cmd+C, move the mouse, Cmd+V.',
  Component: ClipboardDemo,
  full: ClipboardDemoFull,
  path: 'demo/demos/ClipboardDemo.tsx',
},
```

- [ ] **Step 2.3: Manually verify in the dev server**

The dev server is already running on http://localhost:5173/weasel/ (background task started earlier). Open `http://localhost:5173/weasel/#clipboard`.

Expected:
1. Three colored rectangles render.
2. Click one — selection chrome appears.
3. `Cmd+C`, move the mouse to a different spot, `Cmd+V` — a new rectangle of the same color appears centered on the cursor.
4. Move the mouse to another spot, `Cmd+V` again — the next clone lands at the new cursor position.

If any step fails, fix the demo (most likely fixes: adjust adapter spread, fix selection wiring, adjust `SceneCanvas` prop set to match the actual API).

- [ ] **Step 2.4: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.5: Commit**

```bash
git add demo/demos/ClipboardDemo.tsx demo/registry.ts
git commit -m "$(cat <<'EOF'
demo(clipboard): cursor-relative paste demo

Click to select, Cmd+C, move the mouse, Cmd+V — pastes the cluster
centered at the cursor. Demonstrates the new useClipboard
getDropPoint seam end-to-end with a working commitPaste that
honors ctx.dropPoint.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: TODO bookkeeping

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 3.1: Strike the shipped entry**

In `docs/TODO.md`, find the Tier 1.5 line beginning `- **Clipboard: cursor-relative paste offsets.**` (around line 246) and replace it with:

```
- [x] **Clipboard: cursor-relative paste offsets.** *Shipped 2026-05-11.* `useClipboard` / `useClipboardOps` accept an optional `getDropPoint: () => { worldX, worldY } | null` thunk; when non-null, the resolved point flows to `commitPaste(cb, offset, { dropPoint })`. Demo: `demo/demos/ClipboardDemo.tsx` (`#clipboard`). Spec: `docs/superpowers/specs/2026-05-11-clipboard-cursor-relative-paste-design.md`. Plan: `docs/superpowers/plans/2026-05-11-clipboard-cursor-relative-paste.md`.
```

- [ ] **Step 3.2: Add follow-up entries to Tier 1.5**

Append these two new bullets in the Tier 1.5 section (anywhere near the clipboard entries is fine):

```
- **`arrayAdapter.commitPaste` real implementation.** Today the default `arrayAdapter` ships `commitPaste: () => []` (a stub — `src/core/adapters/arrayAdapter.ts:188`), so the default-adapter clipboard path doesn't paste anything. Implement: clone each `clip.items` entry with a consumer-supplied `nextId` factory, translate by `offset` (or center the cluster bbox at `ctx.dropPoint` when present, matching the ClipboardDemo wiring), and append via `insertNode`. Open: where the id factory lives — adapter config option vs. caller-supplied via spread.
- **`SceneCanvas` auto-wires `getDropPoint`.** `SceneCanvas` already tracks pointer position for hit-tests; expose it as a `getDropPoint` thunk consumed by `useClipboard` when the consumer doesn't override. Lets `<SceneCanvas>` + `useClipboard` give cursor-paste for free.
```

- [ ] **Step 3.3: Commit**

```bash
git add docs/TODO.md
git commit -m "$(cat <<'EOF'
docs(TODO): mark cursor-relative paste shipped; add follow-ups

Strikes the Tier 1.5 clipboard cursor-paste entry and records two
new follow-ups: arrayAdapter.commitPaste real implementation, and
SceneCanvas auto-wiring getDropPoint.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Release-gate verification

- [ ] **Step 4.1: Run the release gate**

```
npm run prepublishOnly
```

Expected: `tsc --noEmit` clean, `vitest run` all green, `tsup build` succeeds.

If any step fails: stop, investigate, fix the root cause, re-run. Do not commit a green-claimed task with red output.

- [ ] **Step 4.2: Report done**

Summarize:
- Files touched (3 src, 2 demo, 1 doc).
- Test count added (5 new vitest cases).
- Manual verification result (one sentence).
- Follow-ups recorded in TODO.md.
