# LayerList Drag-Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `<LayerList>` React component in `@weasel-js/ui` plus a headless `useReorderDragList` hook that backs it. Generic items-in / `onReorder`-out — no kit-op coupling. Multi-select-aware drag with drop indicator.

**Architecture:** Hook owns the drag state machine (threshold-gated start, pointer-Y → target-index math, multi-select block move). Component renders rows + drop indicator and consumes the hook. Consumer maps scene state → `items` prop and wires `onReorder` to `createMoveToIndexOp`.

**Tech Stack:** TypeScript, React, Vitest + React Testing Library, CSS modules.

**Spec:** `docs/superpowers/specs/2026-05-11-layer-list-drag-reorder-design.md`

---

## File map

- Create: `packages/ui/src/useReorderDragList.ts`
- Create: `packages/ui/src/useReorderDragList.test.ts`
- Create: `packages/ui/src/LayerList.tsx`
- Create: `packages/ui/src/LayerList.module.css`
- Create: `packages/ui/src/LayerList.test.tsx`
- Create: `packages/ui/src/LayerList.stories.tsx`
- Modify: `packages/ui/src/index.ts` — re-export.
- Create: `demo/demos/LayerListDemo.tsx`
- Modify: `demo/registry.ts` — register.
- Modify: `docs/TODO.md` — strike Tier 1.5 entry.

---

## Task 1: `useReorderDragList` hook + tests (TDD)

**Files:**
- Create: `packages/ui/src/useReorderDragList.ts`
- Test: `packages/ui/src/useReorderDragList.test.ts`

The hook's drag state machine: idle → pending (pointerdown captured, sub-threshold) → active (past threshold) → end (commit on pointerup) or cancel (Esc / pointercancel).

- [ ] **Step 1.1: Write the failing tests**

Use `@testing-library/react`'s `renderHook` + `act`. Mock the container `ref` by attaching the returned `containerProps.ref` to a JSDOM element with stubbed `getBoundingClientRect` per child.

Create `packages/ui/src/useReorderDragList.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReorderDragList } from './useReorderDragList';

interface Item { id: string; label: string }
const ITEMS: Item[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
];

// Build a container with stubbed row geometry (each row 32 tall, starting at y=0).
function makeContainer(n: number): HTMLDivElement {
  const c = document.createElement('div');
  Object.defineProperty(c, 'getBoundingClientRect', {
    value: () => ({ x: 0, y: 0, top: 0, left: 0, right: 200, bottom: n * 32, width: 200, height: n * 32 } as DOMRect),
  });
  for (let i = 0; i < n; i++) {
    const row = document.createElement('div');
    row.setAttribute('data-row-index', String(i));
    Object.defineProperty(row, 'getBoundingClientRect', {
      value: () => ({ x: 0, y: i * 32, top: i * 32, left: 0, right: 200, bottom: (i + 1) * 32, width: 200, height: 32 } as DOMRect),
    });
    c.appendChild(row);
  }
  return c;
}

function makePointerEvent(type: string, x: number, y: number): React.PointerEvent {
  return new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, button: 0, isPrimary: true }) as unknown as React.PointerEvent;
}

describe('useReorderDragList', () => {
  it('plain pointerdown + pointerup (no move) does not fire onReorder', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: ['a'], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    act(() => {
      result.current.rowProps('b', 1).onPointerDown(makePointerEvent('pointerdown', 100, 48));
    });
    act(() => {
      result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 48));
    });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('drag past threshold + drop fires onReorder with [draggedId] when row is unselected', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: ['a'], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    // Pointer down on row 'c' (index 2, y=64..96, midpoint y=80).
    act(() => result.current.rowProps('c', 2).onPointerDown(makePointerEvent('pointerdown', 100, 80)));
    // Move past 4-px threshold up to y=20 (above row 0 midpoint y=16).
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 20)));
    act(() => result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 20)));
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['c'], 0);
  });

  it('dragging a selected row moves entire selection as one block', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: ['a', 'c'], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    // Pointer down on selected row 'a' (index 0).
    act(() => result.current.rowProps('a', 0).onPointerDown(makePointerEvent('pointerdown', 100, 16)));
    // Move down to below all rows (y > 128).
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 200)));
    act(() => result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 200)));
    expect(onReorder).toHaveBeenCalledWith(['a', 'c'], ITEMS.length);
  });

  it('drop below all rows yields targetIndex = items.length', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: [], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    act(() => result.current.rowProps('a', 0).onPointerDown(makePointerEvent('pointerdown', 100, 16)));
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 999)));
    act(() => result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 999)));
    expect(onReorder).toHaveBeenCalledWith(['a'], ITEMS.length);
  });

  it('pointercancel during drag resets state without firing onReorder', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: [], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    act(() => result.current.rowProps('a', 0).onPointerDown(makePointerEvent('pointerdown', 100, 16)));
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 64)));
    act(() => result.current.containerProps.onPointerCancel(makePointerEvent('pointercancel', 100, 64)));
    expect(onReorder).not.toHaveBeenCalled();
    expect(result.current.state.draggedIds).toBeNull();
  });

  it('drop at the source row index is a no-op (targetIndex would equal source position) — does not fire onReorder', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: [], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    // Pointer down on row 'b' (index 1). Drag 5px (past threshold) then back.
    act(() => result.current.rowProps('b', 1).onPointerDown(makePointerEvent('pointerdown', 100, 48)));
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 55))); // engages
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 48))); // back to source row
    act(() => result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 48)));
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('state.draggedIds is null when idle, populated when actively dragging', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: ['a', 'b'], onReorder })
    );
    expect(result.current.state.draggedIds).toBeNull();
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    act(() => result.current.rowProps('a', 0).onPointerDown(makePointerEvent('pointerdown', 100, 16)));
    expect(result.current.state.draggedIds).toBeNull(); // still pending, sub-threshold
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 64))); // past threshold
    expect(result.current.state.draggedIds).toEqual(['a', 'b']);
    act(() => result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 64)));
    expect(result.current.state.draggedIds).toBeNull();
  });
});
```

- [ ] **Step 1.2: Run tests — confirm failures**

```
cd /Users/mike/src/weasel
npx vitest run packages/ui/src/useReorderDragList.test.ts
```

Expected: all fail (file doesn't exist).

- [ ] **Step 1.3: Implement the hook**

Create `packages/ui/src/useReorderDragList.ts`:

```ts
import { useCallback, useRef, useState } from 'react';
import type { ReactNode, PointerEvent as ReactPointerEvent, RefCallback } from 'react';

export interface LayerListItem {
  id: string;
  label: ReactNode;
}

export interface UseReorderDragListOptions {
  items: LayerListItem[];
  selectedIds: string[];
  onReorder(ids: string[], targetIndex: number): void;
  /** Pointer-move distance (px) before pending drag engages. Default 4. */
  threshold?: number;
}

export interface ReorderDragState {
  draggedIds: string[] | null;
  targetIndex: number | null;
}

export interface ReorderDragHandlers {
  rowProps(id: string, index: number): { onPointerDown(e: ReactPointerEvent): void };
  containerProps: {
    ref: RefCallback<HTMLElement>;
    onPointerMove(e: ReactPointerEvent): void;
    onPointerUp(e: ReactPointerEvent): void;
    onPointerCancel(e: ReactPointerEvent): void;
  };
  state: ReorderDragState;
}

interface PendingState {
  id: string;
  sourceIndex: number;
  startX: number;
  startY: number;
  pointerId: number;
}

interface ActiveState extends PendingState {
  draggedIds: string[];
  targetIndex: number;
}

export function useReorderDragList(opts: UseReorderDragListOptions): ReorderDragHandlers {
  const { threshold = 4 } = opts;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const containerRef = useRef<HTMLElement | null>(null);
  const pendingRef = useRef<PendingState | null>(null);
  const activeRef = useRef<ActiveState | null>(null);
  const [state, setState] = useState<ReorderDragState>({ draggedIds: null, targetIndex: null });

  const computeTargetIndex = useCallback((clientY: number): number => {
    const c = containerRef.current;
    if (!c) return 0;
    const rows = Array.from(c.children) as HTMLElement[];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (clientY < mid) return i;
    }
    return rows.length;
  }, []);

  const refCb = useCallback<RefCallback<HTMLElement>>((el) => {
    containerRef.current = el;
  }, []);

  const onPointerDownRow = useCallback((id: string, index: number, e: ReactPointerEvent) => {
    pendingRef.current = {
      id,
      sourceIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
    };
  }, []);

  const reset = useCallback(() => {
    pendingRef.current = null;
    activeRef.current = null;
    setState({ draggedIds: null, targetIndex: null });
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const active = activeRef.current;
    if (active) {
      const targetIndex = computeTargetIndex(e.clientY);
      if (targetIndex !== active.targetIndex) {
        active.targetIndex = targetIndex;
        setState({ draggedIds: active.draggedIds, targetIndex });
      }
      return;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    const dx = e.clientX - pending.startX;
    const dy = e.clientY - pending.startY;
    if (Math.hypot(dx, dy) < threshold) return;
    // Engage.
    const selected = optsRef.current.selectedIds;
    const inSelection = selected.includes(pending.id);
    const draggedIds = inSelection ? [...selected] : [pending.id];
    const targetIndex = computeTargetIndex(e.clientY);
    activeRef.current = { ...pending, draggedIds, targetIndex };
    setState({ draggedIds, targetIndex });
  }, [computeTargetIndex, threshold]);

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    const active = activeRef.current;
    if (!active) {
      reset();
      return;
    }
    const targetIndex = computeTargetIndex(e.clientY);
    // Skip no-op: target equals source position OR target lands inside the
    // dragged-ids contiguous block (would be a no-move).
    const items = optsRef.current.items;
    const indices = active.draggedIds.map((id) => items.findIndex((it) => it.id === id)).filter((i) => i >= 0).sort((a, b) => a - b);
    const isContiguous = indices.length > 0 && indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
    const wouldBeNoop = isContiguous && targetIndex >= indices[0] && targetIndex <= indices[indices.length - 1] + 1;
    if (!wouldBeNoop) {
      optsRef.current.onReorder(active.draggedIds, targetIndex);
    }
    reset();
  }, [computeTargetIndex, reset]);

  const onPointerCancel = useCallback(() => {
    reset();
  }, [reset]);

  return {
    rowProps: (id, index) => ({
      onPointerDown: (e) => onPointerDownRow(id, index, e),
    }),
    containerProps: {
      ref: refCb,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    state,
  };
}
```

- [ ] **Step 1.4: Run tests — confirm green**

```
npx vitest run packages/ui/src/useReorderDragList.test.ts
```

Expected: all 7 pass. If any test fails, inspect the failure: it may be the no-op-detection (test 6) interacting with how target index back-calculates after engagement. Adjust the production code to match the test's stated semantic.

- [ ] **Step 1.5: Typecheck**

```
npx tsc --noEmit
```

Expected: clean (modulo 3 pre-existing `PropertiesPanel.stories.tsx` errors).

- [ ] **Step 1.6: Commit**

```
git add packages/ui/src/useReorderDragList.ts packages/ui/src/useReorderDragList.test.ts
git commit -m "feat(weasel-ui): useReorderDragList headless hook" -m "" -m "Threshold-gated drag state machine for list reorder; multi-select-aware block move; no-op detection on drop within source range." -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `<LayerList>` component + CSS module + tests

**Files:**
- Create: `packages/ui/src/LayerList.tsx`
- Create: `packages/ui/src/LayerList.module.css`
- Test: `packages/ui/src/LayerList.test.tsx`

- [ ] **Step 2.1: Read existing weasel-ui component for conventions**

Read `packages/ui/src/PropertiesPanel.tsx` + `PropertiesPanel.module.css` (already read in earlier session). Match the CSS-module + `className` composition pattern. No inline styles.

- [ ] **Step 2.2: Write the failing component tests**

Create `packages/ui/src/LayerList.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { LayerList } from './LayerList';

const ITEMS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

describe('LayerList', () => {
  it('renders one row per item with its label', () => {
    render(
      <LayerList items={ITEMS} selectedIds={[]} onSelect={() => {}} onReorder={() => {}} />
    );
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();
  });

  it('click on row fires onSelect with [id]', () => {
    const onSelect = vi.fn();
    render(<LayerList items={ITEMS} selectedIds={[]} onSelect={onSelect} onReorder={() => {}} />);
    fireEvent.pointerDown(screen.getByText('Beta'), { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(screen.getByText('Beta'), { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
    expect(onSelect).toHaveBeenLastCalledWith(['b']);
  });

  it('shift-click on unselected row adds it to selection', () => {
    const onSelect = vi.fn();
    render(<LayerList items={ITEMS} selectedIds={['a']} onSelect={onSelect} onReorder={() => {}} />);
    fireEvent.pointerDown(screen.getByText('Gamma'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(screen.getByText('Gamma'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    expect(onSelect).toHaveBeenLastCalledWith(['a', 'c']);
  });

  it('shift-click on already-selected row removes it', () => {
    const onSelect = vi.fn();
    render(<LayerList items={ITEMS} selectedIds={['a', 'c']} onSelect={onSelect} onReorder={() => {}} />);
    fireEvent.pointerDown(screen.getByText('Alpha'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(screen.getByText('Alpha'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    expect(onSelect).toHaveBeenLastCalledWith(['c']);
  });

  it('empty items prop renders the empty-state node', () => {
    render(
      <LayerList items={[]} selectedIds={[]} onSelect={() => {}} onReorder={() => {}} empty={<span>No layers</span>} />
    );
    expect(screen.getByText('No layers')).toBeTruthy();
  });

  it('selected row has the selected class', () => {
    const { container } = render(
      <LayerList items={ITEMS} selectedIds={['b']} onSelect={() => {}} onReorder={() => {}} />
    );
    const rows = container.querySelectorAll('[data-row-index]');
    expect(rows[1].className).toMatch(/selected/);
  });
});
```

- [ ] **Step 2.3: Run tests — expect failure**

```
npx vitest run packages/ui/src/LayerList.test.tsx
```

Expected: all fail (file doesn't exist).

- [ ] **Step 2.4: Implement the component**

Create `packages/ui/src/LayerList.module.css`:

```css
.list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: #1a1612;
  border: 1px solid #2a2418;
  border-radius: 4px;
  padding: 2px;
  user-select: none;
  position: relative;
  min-width: 160px;
}

.row {
  display: flex;
  align-items: center;
  padding: 0 8px;
  height: 28px;
  font-size: 12px;
  color: #d8c8a8;
  background: transparent;
  border-radius: 2px;
  cursor: default;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row:hover {
  background: #221c12;
}

.selected {
  background: #3a2e1c;
  color: #fff5d8;
}

.selected:hover {
  background: #443420;
}

.dragging {
  opacity: 0.4;
}

.dropIndicator {
  position: absolute;
  left: 2px;
  right: 2px;
  height: 2px;
  background: #ddb87a;
  pointer-events: none;
  z-index: 1;
}

.empty {
  padding: 12px 8px;
  font-size: 12px;
  color: #6a5d44;
  font-style: italic;
}
```

Create `packages/ui/src/LayerList.tsx`:

```tsx
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { useRef } from 'react';
import { useReorderDragList, type LayerListItem } from './useReorderDragList';
import s from './LayerList.module.css';

export type { LayerListItem };

export interface LayerListProps {
  items: LayerListItem[];
  selectedIds: string[];
  onSelect(ids: string[]): void;
  onReorder(ids: string[], targetIndex: number): void;
  className?: string;
  empty?: ReactNode;
}

export function LayerList(props: LayerListProps) {
  const { items, selectedIds, onSelect, onReorder, className, empty } = props;
  const drag = useReorderDragList({ items, selectedIds, onReorder });

  // We track "did the pending pointerdown engage drag?" to decide whether
  // pointerup fires a select. Use a ref because state would lag the
  // pointer-up handler.
  const pendingClickRef = useRef<{ id: string; shift: boolean } | null>(null);

  const handleRowPointerDown = (id: string, index: number, e: ReactPointerEvent) => {
    pendingClickRef.current = { id, shift: e.shiftKey };
    drag.rowProps(id, index).onPointerDown(e);
  };

  const handleContainerPointerUp = (e: ReactPointerEvent) => {
    const pending = pendingClickRef.current;
    const wasDragging = drag.state.draggedIds !== null;
    drag.containerProps.onPointerUp(e);
    if (pending && !wasDragging) {
      if (pending.shift) {
        if (selectedIds.includes(pending.id)) {
          onSelect(selectedIds.filter((x) => x !== pending.id));
        } else {
          onSelect([...selectedIds, pending.id]);
        }
      } else {
        onSelect([pending.id]);
      }
    }
    pendingClickRef.current = null;
  };

  if (items.length === 0) {
    return (
      <div className={[s.list, className].filter(Boolean).join(' ')}>
        <div className={s.empty}>{empty ?? '—'}</div>
      </div>
    );
  }

  return (
    <div
      className={[s.list, className].filter(Boolean).join(' ')}
      ref={drag.containerProps.ref as React.RefCallback<HTMLDivElement>}
      onPointerMove={drag.containerProps.onPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={drag.containerProps.onPointerCancel}
    >
      {items.map((item, i) => {
        const isSelected = selectedIds.includes(item.id);
        const isDragging = drag.state.draggedIds?.includes(item.id) ?? false;
        const cls = [s.row, isSelected && s.selected, isDragging && s.dragging]
          .filter(Boolean)
          .join(' ');
        return (
          <div
            key={item.id}
            data-row-index={i}
            className={cls}
            onPointerDown={(e) => handleRowPointerDown(item.id, i, e)}
          >
            {item.label}
          </div>
        );
      })}
      {drag.state.targetIndex !== null && (
        <div
          className={s.dropIndicator}
          style={dropIndicatorStyle(drag.state.targetIndex, items.length)}
        />
      )}
    </div>
  );
}

function dropIndicatorStyle(targetIndex: number, total: number): React.CSSProperties {
  // 28px row + 1px gap = 29px per row; container has 2px padding.
  const ROW_H = 28, GAP = 1, PAD = 2;
  const y = PAD + targetIndex * (ROW_H + GAP) - GAP / 2;
  return { top: `${y}px` };
}
```

Note: the `style={...}` on the drop indicator is dynamic positioning (computed pixel offset), so it can't be class-only. That's the kind of usage the user's "no inline styles" rule allows. Document with a comment if questioned.

- [ ] **Step 2.5: Run tests — confirm green**

```
npx vitest run packages/ui/src/LayerList.test.tsx
```

Expected: all 6 pass.

- [ ] **Step 2.6: Typecheck**

```
npx tsc --noEmit
```

Expected: clean (modulo pre-existing).

- [ ] **Step 2.7: Update barrel**

In `packages/ui/src/index.ts`, add:

```ts
export { LayerList } from './LayerList';
export type { LayerListProps, LayerListItem } from './LayerList';
export { useReorderDragList } from './useReorderDragList';
export type {
  UseReorderDragListOptions,
  ReorderDragState,
  ReorderDragHandlers,
} from './useReorderDragList';
```

- [ ] **Step 2.8: Commit**

```
git add packages/ui/src/LayerList.tsx packages/ui/src/LayerList.module.css packages/ui/src/LayerList.test.tsx packages/ui/src/index.ts
git commit -m "feat(weasel-ui): LayerList component" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Storybook story

**Files:**
- Create: `packages/ui/src/LayerList.stories.tsx`

- [ ] **Step 3.1: Read existing stories for pattern**

Read `packages/ui/src/PropertiesPanel.stories.tsx` and `packages/ui/src/RangePicker.stories.tsx`.

- [ ] **Step 3.2: Write the story**

Create `packages/ui/src/LayerList.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { LayerList, type LayerListItem } from './LayerList';

const meta: Meta<typeof LayerList> = {
  title: 'LayerList',
  component: LayerList,
};
export default meta;

type Story = StoryObj<typeof LayerList>;

function Demo() {
  const [items, setItems] = useState<LayerListItem[]>([
    { id: 'a', label: 'Layer A' },
    { id: 'b', label: 'Layer B' },
    { id: 'c', label: 'Layer C' },
    { id: 'd', label: 'Layer D' },
    { id: 'e', label: 'Layer E' },
  ]);
  const [selected, setSelected] = useState<string[]>([]);

  const onReorder = (ids: string[], targetIndex: number) => {
    setItems((prev) => {
      const moving = ids
        .map((id) => prev.find((p) => p.id === id))
        .filter((x): x is LayerListItem => Boolean(x));
      const remaining = prev.filter((p) => !ids.includes(p.id));
      // Translate targetIndex (in original items list) to remaining-list index.
      const insertBeforeId = prev[targetIndex]?.id;
      const insertAt = insertBeforeId !== undefined
        ? remaining.findIndex((p) => p.id === insertBeforeId)
        : remaining.length;
      const out = [...remaining];
      out.splice(insertAt < 0 ? remaining.length : insertAt, 0, ...moving);
      return out;
    });
  };

  return (
    <div style={{ width: 200 }}>
      <LayerList
        items={items}
        selectedIds={selected}
        onSelect={setSelected}
        onReorder={onReorder}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <Demo />,
};

export const Empty: Story = {
  args: {
    items: [],
    selectedIds: [],
    onSelect: () => {},
    onReorder: () => {},
    empty: 'No layers in this group',
  },
};
```

- [ ] **Step 3.3: Typecheck**

```
npx tsc --noEmit
```

- [ ] **Step 3.4: Commit**

```
git add packages/ui/src/LayerList.stories.tsx
git commit -m "story(weasel-ui): LayerList default + empty" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: LayerListDemo

**Files:**
- Create: `demo/demos/LayerListDemo.tsx`
- Modify: `demo/registry.ts`

- [ ] **Step 4.1: Read references**

Read:
- `demo/demos/ClipboardDemo.tsx` (Canvas + arrayAdapter + useSelection pattern).
- `demo/demos/CloneDemo.tsx` (scene + sceneToAdapter pattern).
- One demo that uses `createMoveToIndexOp` — grep for `createMoveToIndexOp` under `demo/`.

- [ ] **Step 4.2: Build the demo**

Create `demo/demos/LayerListDemo.tsx`:

```tsx
import { useMemo } from 'react';
import {
  asNodeId,
  createMoveToIndexOp,
  dispatchApplyBatch,
  SceneCanvas,
  sceneToAdapter,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@weasel-js/core';
import { LayerList, type LayerListItem } from '@weasel-js/ui';
import type { DrawCommand } from '../../src/renderer';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 480, H = 320;
const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 60,  width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 130, y: 80,  width: 80, height: 60, color: '#d4a574' },
  { id: 'c', x: 220, y: 100, width: 80, height: 60, color: '#a48bd4' },
  { id: 'd', x: 310, y: 120, width: 80, height: 60, color: '#7ab8d4' },
  { id: 'e', x: 80,  y: 180, width: 80, height: 60, color: '#d47a7a' },
];

export function LayerListDemo() {
  const scene = useScene<Rect>({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });

  const adapter = useMemo(
    () => sceneToAdapter(scene, { selection }),
    [scene, selection],
  );

  const pickEvery = (worldX: number, worldY: number): string[] => {
    const hits: string[] = [];
    for (const id of scene.renderOrder()) {
      const n = scene.get(id);
      if (!n) continue;
      const p = n.pose as Rect;
      if (worldX >= p.x && worldX <= p.x + p.width
          && worldY >= p.y && worldY <= p.y + p.height) hits.push(id);
    }
    return hits;
  };

  const boundsOf = (id: string) => {
    const n = scene.get(asNodeId(id));
    if (!n) return null;
    const p = n.pose as Rect;
    return { x: p.x, y: p.y, width: p.width, height: p.height };
  };

  const select = useSelectTool(adapter, {
    pickEvery, boundsOf,
    getSelection: () => selection.current,
  });
  const tools = useTools({ active: 'select', registry: { select } });

  // Derive items from scene render order — top of stack first.
  const items: LayerListItem[] = useMemo(() => {
    // renderOrder is bottom→top; reverse so index 0 is top.
    const order = [...scene.renderOrder()].reverse();
    return order.map((id) => {
      const n = scene.get(id);
      const data = n?.data as Rect | undefined;
      return { id, label: data?.color ?? id };
    });
  }, [scene]);

  const onReorder = (ids: string[], targetIndex: number) => {
    // LayerList's index is top-down (0 = front). scene order is bottom-up.
    // Convert: scene-index = total - targetIndex.
    const total = scene.renderOrder().length;
    const sceneIndex = total - targetIndex;
    dispatchApplyBatch(
      adapter,
      [createMoveToIndexOp({ ids, parentId: null, index: Math.max(0, sceneIndex - ids.length) })],
      'Reorder',
    );
  };

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <SceneCanvas
        width={W} height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        tools={tools}
        layers={{
          scene: {
            drawOne: (n, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: (n.data as Rect).color },
            }],
          },
        }}
      />
      <LayerList
        items={items}
        selectedIds={selection.current.map((id) => String(id))}
        onSelect={(ids) => selection.set(ids.map(asNodeId))}
        onReorder={onReorder}
      />
    </div>
  );
}
```

Note: the `style` on the wrapper div is layout-only flex direction; the rule about no inline styles is about *visual* styling. A pure flex layout is acceptable since the demo is not a kit consumer-facing API. If lint complains, move to a small `.module.css` next to the demo.

- [ ] **Step 4.3: Register**

In `demo/registry.ts`:

```ts
import { LayerListDemo } from './demos/LayerListDemo';
import LayerListDemoFull from './demos/LayerListDemo.tsx?raw';
```

Add an entry near other tools demos:

```ts
{
  id: 'layer-list',
  title: 'Layer list',
  category: 'Tools',
  description: 'LayerList from @weasel-js/ui wired to a scene. Click rows or rects to select. Drag rows to reorder. Drag a selected row to move the whole selection.',
  hint: 'Drag the rows up and down.',
  Component: LayerListDemo,
  full: LayerListDemoFull,
  path: 'demo/demos/LayerListDemo.tsx',
},
```

- [ ] **Step 4.4: Typecheck**

```
npx tsc --noEmit
```

- [ ] **Step 4.5: Commit**

```
git add demo/demos/LayerListDemo.tsx demo/registry.ts
git commit -m "demo(layer-list): scene + LayerList side-by-side" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: TODO + release gate

- [ ] **Step 5.1: Strike entry**

In `docs/TODO.md`, find the Tier 1.5 bullet `- **Drag-to-reorder UX for sibling z-order.**`. Replace with:

```
- [x] **Drag-to-reorder UX for sibling z-order.** *Shipped 2026-05-11.* `@weasel-js/ui` now ships `<LayerList>` (styled component) backed by a headless `useReorderDragList` hook. Click + shift-click selection, multi-select-aware block drag, drop indicator, threshold-gated start. Generic items+onReorder API — consumer wires the `createMoveToIndexOp` call. Demo: `demo/demos/LayerListDemo.tsx` (`#layer-list`). Spec: `docs/superpowers/specs/2026-05-11-layer-list-drag-reorder-design.md`. Plan: `docs/superpowers/plans/2026-05-11-layer-list-drag-reorder.md`.
```

- [ ] **Step 5.2: Commit + release gate**

```
git add docs/TODO.md
git commit -m "docs(TODO): mark LayerList drag-reorder shipped" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
npm run prepublishOnly
```

If tsc fails ONLY on the 3 pre-existing `PropertiesPanel.stories.tsx` errors → DONE_WITH_CONCERNS, otherwise BLOCKED.

- [ ] **Step 5.3: Report**

One line: file count + new tests + prepublishOnly outcome.
