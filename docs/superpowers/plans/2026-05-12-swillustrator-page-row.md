# swillustrator Page Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-reorderable, non-deletable "Page" row at the bottom of swillustrator's LayerList. Selecting it surfaces document properties in the right sidebar.

**Architecture:** Smallest possible generic affordance in weasel-ui — a `locked?: boolean` flag on `LayerListItem` that disables drag-start, clamps the drop indicator, and forces exclusive selection. swillustrator builds a locked Page row with its own label/icon/styling and branches the right sidebar on a `pageSelected` flag.

**Tech Stack:** TypeScript, React, Vitest + @testing-library/react. weasel-ui (package), swillustrator (app).

**Spec:** `docs/superpowers/specs/2026-05-12-swillustrator-page-row-design.md`

---

## File Map

- **Modify:** `packages/weasel-ui/src/useReorderDragList.ts` — add `locked?: boolean` to `LayerListItem`; no-op `onPointerDownRow` for locked items; clamp `computeTargetIndex` to `firstLockedIndex`.
- **Modify:** `packages/weasel-ui/src/components/LayerList/LayerList.tsx` — emit `data-locked="true"` on locked rows; force exclusive select for locked rows; strip locked ids from shift-click selection on regular rows.
- **Modify:** `packages/weasel-ui/src/components/LayerList/LayerList.test.tsx` — add tests for the above.
- **Modify:** `apps/swillustrator/src/kindIcons.tsx` — add `PageIcon`.
- **Modify:** `apps/swillustrator/src/App.tsx` — `PAGE_ROW_ID` constant, `pageSelected` state, append Page row to `layerItems`, branch `onSelectLayers`, sync effect, branch right sidebar.
- **Modify:** `apps/swillustrator/src/swillustrator.css` — `.swill-layer-label-page` muted/italic; `[data-locked="true"]` divider above.

---

## Task 1: Add `locked` flag to `LayerListItem` type

**Files:**
- Modify: `packages/weasel-ui/src/useReorderDragList.ts:4-7`

- [ ] **Step 1: Update `LayerListItem` interface**

Edit `packages/weasel-ui/src/useReorderDragList.ts`. Replace lines 4–7:

```ts
export interface LayerListItem {
  id: string;
  label: ReactNode;
  /** Locked rows cannot be dragged, cannot be crossed by drops, and
   *  never combine with other rows in a multi-selection. */
  locked?: boolean;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @orochi235/weasel-ui exec tsc --noEmit`

Expected: passes (locked is optional, no consumers break).

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-ui/src/useReorderDragList.ts
git commit -m "feat(weasel-ui): add optional locked flag to LayerListItem"
```

---

## Task 2: No-op drag-start on locked rows

**Files:**
- Test: `packages/weasel-ui/src/components/LayerList/LayerList.test.tsx`
- Modify: `packages/weasel-ui/src/useReorderDragList.ts:70-78`

- [ ] **Step 1: Write the failing test**

Append to `packages/weasel-ui/src/components/LayerList/LayerList.test.tsx` (before the closing `});`):

```tsx
it('locked row cannot initiate a drag', () => {
  const onReorder = vi.fn();
  const items = [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
    { id: 'page', label: 'Page', locked: true },
  ];
  const { container } = render(
    <LayerList items={items} selectedIds={[]} onSelect={() => {}} onReorder={onReorder} />
  );
  const pageRow = screen.getByText('Page');
  fireEvent.pointerDown(pageRow, { clientX: 0, clientY: 60, pointerId: 1, isPrimary: true });
  fireEvent.pointerMove(pageRow, { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
  // No drop indicator should appear because no drag engaged.
  const indicator = container.querySelector('[class*="dropIndicator"]');
  expect(indicator).toBeNull();
  fireEvent.pointerUp(pageRow, { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
  expect(onReorder).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @orochi235/weasel-ui exec vitest run LayerList.test.tsx`

Expected: FAIL — drop indicator is present (locked behavior not yet implemented).

- [ ] **Step 3: No-op drag-start in `onPointerDownRow`**

Edit `packages/weasel-ui/src/useReorderDragList.ts:70-78`. Replace the existing `onPointerDownRow` with:

```ts
const onPointerDownRow = useCallback((id: string, index: number, e: ReactPointerEvent) => {
  // Locked items cannot be dragged — skip recording the pending state so
  // pointer-move cannot engage. Plain click still works because LayerList
  // tracks click intent in its own ref, separate from drag candidacy.
  const item = optsRef.current.items[index];
  if (item?.locked) return;
  pendingRef.current = {
    id,
    sourceIndex: index,
    startX: e.clientX,
    startY: e.clientY,
    pointerId: e.pointerId,
  };
}, []);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @orochi235/weasel-ui exec vitest run LayerList.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/useReorderDragList.ts packages/weasel-ui/src/components/LayerList/LayerList.test.tsx
git commit -m "feat(useReorderDragList): skip drag-init for locked rows"
```

---

## Task 3: Clamp drop indicator at first locked index

**Files:**
- Test: `packages/weasel-ui/src/components/LayerList/LayerList.test.tsx`
- Modify: `packages/weasel-ui/src/useReorderDragList.ts:55-64`

- [ ] **Step 1: Write the failing test**

Append to `LayerList.test.tsx`:

```tsx
it('drops cannot land at or below a locked row', () => {
  const onReorder = vi.fn();
  const items = [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
    { id: 'page', label: 'Page', locked: true },
  ];
  // Stub getBoundingClientRect so the hook's vertical math is deterministic.
  // Each row is 28px tall starting at y=0.
  const origGBR = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('data-row-index')) {
      const i = Number(this.getAttribute('data-row-index'));
      return { top: i * 28, bottom: (i + 1) * 28, left: 0, right: 100, width: 100, height: 28, x: 0, y: i * 28, toJSON: () => ({}) } as DOMRect;
    }
    return origGBR.call(this);
  };
  try {
    render(
      <LayerList items={items} selectedIds={[]} onSelect={() => {}} onReorder={onReorder} />
    );
    const alpha = screen.getByText('Alpha');
    // Drag Alpha; release at y=1000 (well past the Page row at y=56..84).
    fireEvent.pointerDown(alpha, { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
    fireEvent.pointerMove(alpha, { clientX: 0, clientY: 1000, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(alpha, { clientX: 0, clientY: 1000, pointerId: 1, isPrimary: true });
    // Locked row sits at index 2; the deepest legal drop is index 2 (just above Page).
    expect(onReorder).toHaveBeenCalledWith(['a'], 2);
  } finally {
    Element.prototype.getBoundingClientRect = origGBR;
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @orochi235/weasel-ui exec vitest run LayerList.test.tsx`

Expected: FAIL — `onReorder` called with index 3 (past the Page row).

- [ ] **Step 3: Clamp in `computeTargetIndex`**

Edit `packages/weasel-ui/src/useReorderDragList.ts:55-64`. Replace `computeTargetIndex` with:

```ts
const computeTargetIndex = useCallback((clientY: number): number => {
  const items = optsRef.current.items;
  // Locked rows act as walls — drops cannot cross them. Cap at the
  // first locked row's index (or items.length if none are locked).
  const firstLocked = items.findIndex((it) => it.locked);
  const cap = firstLocked === -1 ? items.length : firstLocked;
  const c = containerRef.current;
  if (!c) return 0;
  const rows = Array.from(c.children) as HTMLElement[];
  let raw = rows.length;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].getBoundingClientRect();
    if (clientY < r.bottom) { raw = i; break; }
  }
  return Math.min(raw, cap);
}, []);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @orochi235/weasel-ui exec vitest run LayerList.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/useReorderDragList.ts packages/weasel-ui/src/components/LayerList/LayerList.test.tsx
git commit -m "feat(useReorderDragList): clamp drop indicator at first locked row"
```

---

## Task 4: Force exclusive select for locked rows

**Files:**
- Test: `packages/weasel-ui/src/components/LayerList/LayerList.test.tsx`
- Modify: `packages/weasel-ui/src/components/LayerList/LayerList.tsx:35-53`

- [ ] **Step 1: Write the failing tests**

Append to `LayerList.test.tsx`:

```tsx
it('shift-click on a locked row is exclusive (no combine)', () => {
  const onSelect = vi.fn();
  const items = [
    { id: 'a', label: 'Alpha' },
    { id: 'page', label: 'Page', locked: true },
  ];
  render(
    <LayerList items={items} selectedIds={['a']} onSelect={onSelect} onReorder={() => {}} />
  );
  fireEvent.pointerDown(screen.getByText('Page'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
  fireEvent.pointerUp(screen.getByText('Page'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
  expect(onSelect).toHaveBeenLastCalledWith(['page']);
});

it('shift-click on a regular row strips locked ids from selection', () => {
  const onSelect = vi.fn();
  const items = [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
    { id: 'page', label: 'Page', locked: true },
  ];
  render(
    <LayerList items={items} selectedIds={['page']} onSelect={onSelect} onReorder={() => {}} />
  );
  fireEvent.pointerDown(screen.getByText('Beta'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
  fireEvent.pointerUp(screen.getByText('Beta'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
  expect(onSelect).toHaveBeenLastCalledWith(['b']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @orochi235/weasel-ui exec vitest run LayerList.test.tsx`

Expected: both new tests FAIL.

- [ ] **Step 3: Update selection logic in `handleContainerPointerUp`**

Edit `packages/weasel-ui/src/components/LayerList/LayerList.tsx`. Replace lines 35–53 (the `handleContainerPointerUp` function) with:

```tsx
const handleContainerPointerUp = (e: ReactPointerEvent) => {
  const pending = pendingClickRef.current;
  // Read drag state BEFORE the hook resets it in onPointerUp.
  const wasDragging = drag.state.draggedIds !== null;
  drag.containerProps.onPointerUp(e);
  if (pending && !wasDragging) {
    const { selectedIds: sel, onSelect: sel_cb } = propsRef.current;
    const targetItem = items.find((it) => it.id === pending.id);
    if (targetItem?.locked) {
      // Locked rows are always exclusive — ignore shift modifier so they
      // never combine with other rows in a multi-selection.
      sel_cb([pending.id]);
    } else if (pending.shift) {
      // Strip any currently-selected locked ids before applying the toggle
      // so a leftover locked selection (e.g., Page) doesn't carry through
      // when the user starts building a multi-selection of regular rows.
      const lockedIds = new Set(items.filter((it) => it.locked).map((it) => it.id));
      const filtered = sel.filter((id) => !lockedIds.has(id));
      if (filtered.includes(pending.id)) {
        sel_cb(filtered.filter((x) => x !== pending.id));
      } else {
        sel_cb([...filtered, pending.id]);
      }
    } else {
      sel_cb([pending.id]);
    }
  }
  pendingClickRef.current = null;
};
```

The `items` reference comes from the destructured props at the top of the component (line 18). No new ref needed.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @orochi235/weasel-ui exec vitest run LayerList.test.tsx`

Expected: PASS for all six tests in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/components/LayerList/LayerList.tsx packages/weasel-ui/src/components/LayerList/LayerList.test.tsx
git commit -m "feat(LayerList): exclusive select for locked rows; strip locked from shift-click"
```

---

## Task 5: Emit `data-locked` on locked rows

**Files:**
- Test: `packages/weasel-ui/src/components/LayerList/LayerList.test.tsx`
- Modify: `packages/weasel-ui/src/components/LayerList/LayerList.tsx:71-87`

- [ ] **Step 1: Write the failing test**

Append to `LayerList.test.tsx`:

```tsx
it('locked rows emit data-locked="true"', () => {
  const items = [
    { id: 'a', label: 'Alpha' },
    { id: 'page', label: 'Page', locked: true },
  ];
  const { container } = render(
    <LayerList items={items} selectedIds={[]} onSelect={() => {}} onReorder={() => {}} />
  );
  const rows = container.querySelectorAll('[data-row-index]');
  expect(rows[0].getAttribute('data-locked')).toBeNull();
  expect(rows[1].getAttribute('data-locked')).toBe('true');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @orochi235/weasel-ui exec vitest run LayerList.test.tsx`

Expected: FAIL (no `data-locked` attribute yet).

- [ ] **Step 3: Add the attribute in the row JSX**

Edit `packages/weasel-ui/src/components/LayerList/LayerList.tsx:77-86`. Replace the inner `return` of the `.map` with:

```tsx
return (
  <div
    key={item.id}
    data-row-index={i}
    data-locked={item.locked ? 'true' : undefined}
    className={cls}
    onPointerDown={(e) => handleRowPointerDown(item.id, i, e)}
  >
    {item.label}
  </div>
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @orochi235/weasel-ui exec vitest run LayerList.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/components/LayerList/LayerList.tsx packages/weasel-ui/src/components/LayerList/LayerList.test.tsx
git commit -m "feat(LayerList): emit data-locked on locked rows"
```

---

## Task 6: Verify weasel-ui release gate still passes

**Files:** none modified.

- [ ] **Step 1: Run typecheck + tests for the whole package**

Run: `pnpm --filter @orochi235/weasel-ui exec tsc --noEmit && pnpm --filter @orochi235/weasel-ui exec vitest run`

Expected: both pass.

- [ ] **Step 2: Run the workspace-level typecheck (catches consumer breakage)**

Run: `pnpm exec tsc --noEmit`

Expected: passes.

If it fails: the most likely cause is a typo in the optional `locked` field. Fix and re-run before continuing.

---

## Task 7: Add `PageIcon` to swillustrator

**Files:**
- Modify: `apps/swillustrator/src/kindIcons.tsx`

- [ ] **Step 1: Add the icon component**

Append to `apps/swillustrator/src/kindIcons.tsx` (after the existing `PathIcon`, before `KindIcon`):

```tsx
export function PageIcon() {
  // A document page — rectangle with a folded top-right corner.
  return (
    <svg {...SVG_BASE}>
      <path d="M 4 2.5 L 10.5 2.5 L 13 5 L 13 13.5 L 4 13.5 Z" strokeLinejoin="round" />
      <path d="M 10.5 2.5 L 10.5 5 L 13 5" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck the app**

Run: `pnpm --filter swillustrator exec tsc --noEmit`

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/swillustrator/src/kindIcons.tsx
git commit -m "feat(swillustrator): add PageIcon for the Page row"
```

---

## Task 8: Inject locked Page row + branch selection

**Files:**
- Modify: `apps/swillustrator/src/App.tsx` — multiple regions (search markers below).

- [ ] **Step 1: Update the `KindIcon` import**

Find line 104 of `apps/swillustrator/src/App.tsx`:

```ts
import { KindIcon } from './kindIcons';
```

Replace with:

```ts
import { KindIcon, PageIcon } from './kindIcons';
```

- [ ] **Step 2: Add the `PAGE_ROW_ID` constant**

After line 117 (the closing `}` of the `Document` interface), add:

```ts
/** Synthetic LayerList id representing the document/page row. Never appears
 *  in the scene's selection — swillustrator tracks Page selection in its
 *  own `pageSelected` state so existing selection-aware logic (delete,
 *  duplicate, property updates) no-ops while the Page row is active. */
const PAGE_ROW_ID = '__swill_page__';
```

- [ ] **Step 3: Add `pageSelected` state**

In `apps/swillustrator/src/App.tsx`, immediately after line 273 (`const [focusedSwatch, setFocusedSwatch] = useState<'fill' | 'stroke'>('fill');`), add:

```ts
const [pageSelected, setPageSelected] = useState(false);
```

- [ ] **Step 4: Update the `layerItems` memo to append the Page row**

Find the `layerItems` memo at App.tsx:1197-1208. Replace it with:

```ts
const layerItems: LayerListItem[] = useMemo(() => {
  const objectRows: LayerListItem[] = [...items].reverse().map((o) => ({
    id: o.id,
    label: (
      <span className="swill-layer-label">
        <KindIcon kind={o.kind} />
        <span>{o.id}</span>
      </span>
    ),
  }));
  const pageRow: LayerListItem = {
    id: PAGE_ROW_ID,
    locked: true,
    label: (
      <span className="swill-layer-label swill-layer-label-page">
        <PageIcon />
        <span>Page</span>
      </span>
    ),
  };
  return [...objectRows, pageRow];
}, [items]);
```

- [ ] **Step 5: Branch `onSelectLayers`**

Find line 1448 (`onSelectLayers={(ids) => selection.set(ids.map((id) => asNodeId(id)))}`). Replace with:

```ts
onSelectLayers={(ids) => {
  if (ids.length === 1 && ids[0] === PAGE_ROW_ID) {
    setPageSelected(true);
    selection.set([]);
  } else {
    setPageSelected(false);
    selection.set(ids.map((id) => asNodeId(id)));
  }
}}
```

- [ ] **Step 6: Update `selectedIds` passed to LayerList**

Find line 1447 (`selectedIds={selection.current.map((id) => String(id))}`). Replace with:

```ts
selectedIds={pageSelected ? [PAGE_ROW_ID] : selection.current.map((id) => String(id))}
```

- [ ] **Step 7: Sync `pageSelected` when scene selection becomes non-empty**

Near the top of `App()` (after the other `useEffect` calls, or anywhere in the component body before `return`), add:

```ts
// Clear Page selection whenever a scene selection appears through any
// other path (marquee, viewport click, keyboard select-all, etc.).
useEffect(() => {
  if (pageSelected && selection.current.length > 0) {
    setPageSelected(false);
  }
}, [pageSelected, selection.current.length]);
```

- [ ] **Step 8: Typecheck and run the app**

Run: `pnpm --filter swillustrator exec tsc --noEmit`

Expected: passes.

Run: `pnpm --filter swillustrator dev`

Manually verify in the browser:
- The Page row appears at the bottom of the Layers panel.
- Clicking it clears any canvas selection (the right sidebar's Properties panel returns to its no-selection state for now — Task 9 wires the dedicated Page panel).
- Clicking a regular layer deselects Page (it loses the selected highlight in the layer list).
- Dragging the Page row does nothing.
- Dragging a regular layer all the way down stops just above the Page row.
- Clicking on the page rectangle in the viewport does not select Page.

Stop the dev server.

- [ ] **Step 9: Commit**

```bash
git add apps/swillustrator/src/App.tsx
git commit -m "feat(swillustrator): inject locked Page row in LayerList with selection branching"
```

---

## Task 9: Branch right sidebar on `pageSelected`

**Files:**
- Modify: `apps/swillustrator/src/App.tsx` — `RightSidebar` component and the prop bag passed to it.

- [ ] **Step 1: Add `pageSelected` to `RightSidebarProps`**

Find the `RightSidebarProps` interface (around line 1474). Add a new field near `selectedIds`:

```ts
pageSelected: boolean;
```

- [ ] **Step 2: Pass `pageSelected` to `RightSidebar`**

Find the `<RightSidebar` JSX (around line 1410+). Add the prop:

```tsx
pageSelected={pageSelected}
```

- [ ] **Step 3: Branch the Properties panel**

The existing `RightSidebar` JSX has a ternary `{primary ? (...selection panel...) : (...defaults panel...)}` near the top of the component's return. Wrap that ternary in an outer ternary that prefers the new Page panel when `p.pageSelected` is true.

Concretely: locate the line containing `{primary ? (` and prepend:

```tsx
{p.pageSelected ? (
  <PropertiesPanel title="Page">
    <PropertyRow label="Title">
      <PropertyTextInput value={p.docTitle} onChange={p.setDocTitle} />
    </PropertyRow>
    <PropertyRow label="Paper">
      <PropertySelect
        value={p.paperSize}
        onChange={p.setPaperSize}
        options={[
          { value: 'letter', label: 'US Letter' },
          { value: 'a4', label: 'A4' },
          { value: 'legal', label: 'Legal' },
        ]}
      />
    </PropertyRow>
  </PropertiesPanel>
) : primary ? (
```

…then find the matching closing `)}` of the existing two-branch ternary and replace it with `)}` for the outer ternary. The bodies of the existing `primary ? (...)` and `: (...)` branches stay byte-for-byte unchanged — only the surrounding `{primary ? (` becomes `: primary ? (` and the final `)}` gains one more level of nesting.

After the edit, the structure must read:

```tsx
{p.pageSelected ? (
  <PropertiesPanel title="Page">…</PropertiesPanel>
) : primary ? (
  <PropertiesPanel title={`Selection (${selectedItems.length})`}>
    {/* existing rows — unchanged */}
  </PropertiesPanel>
) : (
  <PropertiesPanel title="Defaults">
    {/* existing rows — unchanged */}
  </PropertiesPanel>
)}
```

- [ ] **Step 4: Typecheck and verify in the browser**

Run: `pnpm --filter swillustrator exec tsc --noEmit`

Expected: passes.

Run: `pnpm --filter swillustrator dev`

Manually verify:
- Clicking the Page row in the LayerList replaces the top "Properties" panel with the "Page" panel showing Title and Paper controls.
- Editing Title or Paper from the Page panel updates the document (visible in the existing "Document" panel below the LayerList, which still works as before).
- Clicking a regular layer switches back to the Selection panel.
- Clicking empty canvas with no selection returns to the Defaults panel.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/swillustrator/src/App.tsx
git commit -m "feat(swillustrator): show Page properties panel when Page row is selected"
```

---

## Task 10: Style the Page row (muted/italic + divider)

**Files:**
- Modify: `apps/swillustrator/src/swillustrator.css`

- [ ] **Step 1: Add Page label styling and locked-row divider**

Append to `apps/swillustrator/src/swillustrator.css` (after the existing `.swill-layer-label > svg` block at lines 122–132):

```css
/* --- Page row (locked, system-owned) --------------------------------- */
.swill-layer-label-page {
  color: #8a7a5a;
  font-style: italic;
}

/* Thin divider above any locked row in the layer list — separates
   user layers from system rows (currently just the Page row). */
.swill-layerlist-host [data-locked="true"] {
  border-top: 1px solid #3a2e22;
  /* Visually offset the row so the divider sits in its own gutter rather
     than hugging the previous row. */
  margin-top: 4px;
  padding-top: 1px;
}
```

- [ ] **Step 2: Verify in the browser**

Run: `pnpm --filter swillustrator dev`

Manually verify:
- The Page row label is muted (warm grey) and italic, distinct from the regular layer labels.
- A thin divider line appears above the Page row, separating it from the regular layers.
- When there are no regular layers, the Page row still renders cleanly (the divider may look like a top border on the only row — acceptable).
- Selecting the Page row still applies the row's selected highlight from the library CSS.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add apps/swillustrator/src/swillustrator.css
git commit -m "feat(swillustrator): style Page row with muted/italic label and divider"
```

---

## Task 11: Full verification

**Files:** none modified.

- [ ] **Step 1: Run the release gate**

Run: `pnpm exec tsc --noEmit && pnpm exec vitest run`

Expected: typecheck passes; all tests pass.

- [ ] **Step 2: Manual checklist in `pnpm --filter swillustrator dev`**

Walk through each item from the spec's Testing section:
- Clicking the Page row clears canvas selection and surfaces the Page properties panel.
- Selecting a regular layer (LayerList or viewport) clears the Page-selected state and restores normal property panels.
- Dragging a regular layer all the way down stops just above the Page row.
- The newly-reordered "bottom-most" regular layer is at scene index 0 (back of stack — visible by drawing two overlapping rects, sending one to back, and verifying the right one paints behind).
- Attempting to drag the Page row does nothing.
- Clicking on the page rectangle in the viewport does not select Page.
- Marquee-selecting a regular layer while Page is selected switches selection to that layer.
- Shift-clicking a regular layer in the LayerList while Page is selected switches selection to that single regular layer (does not include Page).

Stop the dev server.

- [ ] **Step 3: Final commit if any cleanup landed**

If verification surfaced no changes, skip this step. Otherwise:

```bash
git add -A
git commit -m "chore: address page-row verification findings"
```
