# LayerList drag-reorder (weasel-ui)

**Status:** design
**Tier:** 1.5 (small additive hook)
**Source TODO:** `docs/TODO.md` → "Drag-to-reorder UX for sibling z-order"

## Problem

`createMoveToIndexOp({ ids, parentId, index })` and `useReorder` (`Mod+]` / `Mod+[`) ship the data side of sibling z-order. There is no UI that lets a user pick an arbitrary target index. The standard editor UX is a vertical "Layers" panel where the user clicks rows to select and drags them up/down to reorder.

## Goals

- Generic `<LayerList>` React component in `@weasel-js/ui` that renders a flat list of items, supports click + shift-click selection, and supports drag-to-reorder with a drop indicator.
- Headless `useReorderDragList` hook backing the component so future custom UIs can reuse the drag-state state-machine.
- Multi-select-aware drag: dragging any one of N selected rows moves all selected rows as one contiguous block to the drop position.
- `onReorder(ids: string[], targetIndex: number)` callback that the consumer wires to `createMoveToIndexOp` + `dispatchApplyBatch`. The component never imports kit ops directly — keeps weasel-ui decoupled.

## Non-goals

- Nested tree. Flat siblings of one parent only.
- Cross-parent drag (drag into a different container). Tree feature.
- Visibility / lock toggles, inline rename, thumbnails. Add per consumer demand.
- Keyboard reorder. `useReorder` already covers `Mod+]` / `Mod+[`.
- Touch-drag polish. Pointer events handle touch too; v1 doesn't add a long-press to engage drag — drag starts on pointerdown like every other Figma-style list.

## API

### Styled component (`packages/ui/src/LayerList.tsx`)

```ts
export interface LayerListItem {
  id: string;
  label: ReactNode;
}

export interface LayerListProps {
  items: LayerListItem[];                         // top of list = top of z-stack
  selectedIds: string[];
  onSelect(ids: string[]): void;                  // fires on click / shift-click / Esc
  onReorder(ids: string[], targetIndex: number): void;
  /** Optional class for the outer container, for layout overrides. */
  className?: string;
  /** Optional empty-state node. Default: rendered as an em-dashed placeholder. */
  empty?: ReactNode;
}
```

Item ordering: items[0] is rendered at the top of the list and represents the top of the z-stack. The `targetIndex` passed to `onReorder` is the new top-down index (0 = front). The consumer reconciles with their own ordering convention (`renderOrder()` if scene-backed).

Single-select: clicking a row replaces selection. Shift-click toggles row membership.
Esc inside the list clears selection.

### Headless hook (`packages/ui/src/useReorderDragList.ts`)

```ts
export interface UseReorderDragListOptions {
  items: LayerListItem[];
  selectedIds: string[];
  onReorder(ids: string[], targetIndex: number): void;
}

export interface ReorderDragState {
  draggedIds: string[] | null;    // null when not dragging
  targetIndex: number | null;     // null when not dragging; else 0..items.length
}

export interface ReorderDragHandlers {
  /** Spread onto the row element. Captures pointerdown to start drag,
   *  routes pointermove to compute target index, routes pointerup to commit. */
  rowProps(id: string, index: number): {
    onPointerDown(e: React.PointerEvent): void;
  };
  /** Spread onto the list container. Required so we can compute target
   *  index from pointer Y relative to row geometry. */
  containerProps: {
    ref: React.RefCallback<HTMLElement>;
    onPointerMove(e: React.PointerEvent): void;
    onPointerUp(e: React.PointerEvent): void;
    onPointerCancel(e: React.PointerEvent): void;
  };
  state: ReorderDragState;
}

export function useReorderDragList(opts: UseReorderDragListOptions): ReorderDragHandlers;
```

### Drag semantics

**On pointerdown** of a row, the hook captures the start state. The drag does NOT engage immediately — it waits for a small pointer-move threshold (default 4 px) so a plain click still produces a normal `onSelect`. This matches the kit's `useDragGesture` pattern.

**On pointermove** past threshold, the hook engages:
- `draggedIds` = if the pointer-down id is in `selectedIds`, use the full selection; else just `[pointerDownId]`.
- The hook computes `targetIndex` from pointer Y relative to row midpoints inside the container.
- The hook re-publishes `state` so the styled component can render the drop indicator and dim the source rows.

**On pointerup** while engaged:
- Compute final `targetIndex`.
- Call `onReorder(draggedIds, targetIndex)`.
- Reset state.

**On pointercancel** or Esc:
- Reset state without firing `onReorder`.

### Target-index math

The container has N rows. The dragged block has K items (the selection if the pointerdown landed on a selected row, else 1). The list of "drop slots" is 0..N (slot `i` means "land at index `i` after removing the dragged block").

Given pointer Y within the container:
1. Compute each row's midpoint Y.
2. Find the row whose midpoint the pointer is above; `targetIndex = that row's index`.
3. If pointer is below all midpoints: `targetIndex = N`.
4. `createMoveToIndexOp` is "removing then inserting at `index`," so the consumer doesn't need to compensate for the removal — pass the raw target index.

### Styled component visuals (`packages/ui/src/LayerList.module.css`)

Follows the existing weasel-ui dark theme (see `PropertiesPanel.module.css`):
- Panel: `background: var(--ckd-bg-panel)` or similar token; tight padding.
- Row: 28px height; truncated label; row highlight on hover; row selection background = `var(--ckd-accent-bg)`.
- Source row during drag: `opacity: 0.5`.
- Drop indicator: 2px-tall full-width line at the target row boundary, color = accent.
- Empty state: muted text.

No inline styles. All variant logic via CSS classes (per user's coding rules).

## Files touched

- Create: `packages/ui/src/LayerList.tsx`
- Create: `packages/ui/src/LayerList.module.css`
- Create: `packages/ui/src/useReorderDragList.ts`
- Create: `packages/ui/src/LayerList.test.tsx`
- Create: `packages/ui/src/useReorderDragList.test.ts`
- Create: `packages/ui/src/LayerList.stories.tsx`
- Modify: `packages/ui/src/index.ts` — re-export `LayerList`, `useReorderDragList`, types.
- Create: `demo/demos/LayerListDemo.tsx` — scene + LayerList side-by-side, wires `createMoveToIndexOp`.
- Modify: `demo/registry.ts` — register `LayerListDemo`.
- Modify: `docs/TODO.md` — strike entry.

## Tests

### `useReorderDragList.test.ts` (logic-only)

Use `renderHook` + a fake `containerProps.ref`-attached element with synthetic row geometry. Drive via dispatching pointer events on a JSDOM element. Each test:

1. **Plain click below threshold → no drag, no onReorder fired.**
2. **Drag past threshold, drop in same place → onReorder fired with `[id]` and current index** (or skipped if same — pick a semantic; spec choice: still fire so the consumer can debounce, OR skip if `targetIndex === sourceIndex`. Recommendation: skip. Add to spec: skip when `targetIndex` equals source position.)
3. **Drag a non-selected row → draggedIds = [thatId]; other selected rows are not part of the drag.**
4. **Drag a selected row when 3 are selected → draggedIds = all 3; targetIndex computed correctly.**
5. **Drop above row[0] → targetIndex = 0.**
6. **Drop below all rows → targetIndex = items.length.**
7. **PointerCancel during drag → state resets, no onReorder.**
8. **Esc keydown during drag → state resets, no onReorder.** (May be out of scope — depends on whether the hook listens for keys; if not, drop this test.)

### `LayerList.test.tsx` (component integration)

1. **Render items → renders one row per item with the label.**
2. **Click a row → onSelect called with [id].**
3. **Shift-click an unselected row → onSelect called with [...existing, id].**
4. **Shift-click an already-selected row → onSelect called with selection minus that id.**
5. **Drag row 2 → row 0 → onReorder called with `['id2'], 0`.**
6. **Drag a selected row when 2 are selected → onReorder called with both ids.**
7. **Empty `items` shows the empty-state placeholder.**
8. **Source row dims during drag (assert className contains the `s.dragging` class or equivalent).**

### `LayerList.stories.tsx`

Matches existing storybook pattern (see `PropertiesPanel.stories.tsx`, `RangePicker.stories.tsx`). One story: a stateful wrapper that maintains `items` + `selection` in `useState`, wires `onReorder` to splice-and-set, lets you exercise the component live.

## Demo (`demo/demos/LayerListDemo.tsx`)

- `useScene` with 5 colored rects, layer 'default'.
- `useSelection({ mode: 'multi' })`.
- Side-by-side: `<SceneCanvas>` on the left rendering the rects; `<LayerList>` on the right showing one row per rect labeled with its color hex.
- `items` derived from `scene.renderOrder()` (top of z-stack at array index 0). Map each id to `{ id, label: hex }`.
- `selectedIds = selection.current`.
- `onSelect = selection.set`.
- `onReorder(ids, index) = scene.applyBatch([createMoveToIndexOp({ ids, parentId: null, index })], 'Reorder')` (or whatever the demo's adapter shape exposes — model on existing demos that use `scene.applyBatch`).
- Selecting a rect on canvas highlights its row; selecting a row highlights the rect (no extra wiring — both surfaces read `selection.current`).
- Hint: "Click a row or a rect to select. Shift-click to extend. Drag rows up/down to reorder."

## Done criteria

- All tests green.
- `npm run prepublishOnly` clean (except the 3 pre-existing `PropertiesPanel.stories.tsx` errors out of our scope).
- Storybook story renders.
- Demo manually verified end-to-end: drag a row, see the rect's z-order change on canvas; reverse — click a rect on canvas, see the row highlight in the list.

## Follow-ups (defer)

- Nested tree (drag-into-folder), cycle detection.
- Visibility / lock toggles per row.
- Inline rename.
- Thumbnails (would need scene snapshot integration).
- Auto-scroll the list when dragging near top/bottom edge.
- Keyboard reorder inside the list (arrows + Enter).
- Re-publish drop semantics: a follow-up could add per-row "above"/"below" drop slots (rather than gap-based) for explicit nesting hints once tree mode lands.
