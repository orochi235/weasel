# swillustrator Page row in LayerList

**Status:** Draft
**Date:** 2026-05-12

## Motivation

swillustrator's LayerList today shows scene objects only. The document's
printable surface is drawn by a `RenderLayer` (`pageLayer` in App.tsx) sourced
from `doc.size`; there is no scene node for it. As a result the layer list
gives the user no visual anchor for the page itself, and no obvious target for
"select the page to edit document properties".

This spec adds a non-reorderable, non-deletable "Page" row at the bottom of the
LayerList that represents the document. Selecting it surfaces document
properties in the right sidebar. The page is selectable only from the
LayerList; viewport clicks on the page rect do not select it (this falls out
of the page being a `RenderLayer`, not a scene node).

A proper swillustrator layer system is planned to follow this work. The
mechanism this spec introduces is intentionally generic so that the future
layer system can reuse it for other always-present, non-reorderable rows
(e.g. background or system layers).

## Scope split

The work splits cleanly into two layers:

- **`weasel-ui` (mechanism).** `LayerList` gets one additional capability:
  individual items can be marked `locked`. Locked rows cannot initiate drag,
  cannot be crossed by drops, and never participate in multi-selection. No
  "Page" or "document" terminology in the library.
- **`swillustrator` (semantics).** App.tsx constructs the Page row with a
  fixed id, applies the muted/italic styling, handles click-to-show-document-
  properties, and decides what the right sidebar renders when Page is
  selected.

## Mechanism (weasel-ui)

### `LayerListItem`

Extend `LayerListItem` in
`packages/ui/src/useReorderDragList.ts` with an optional flag:

```ts
export interface LayerListItem {
  id: string;
  label: ReactNode;
  /** Locked rows cannot be dragged, cannot be crossed by drops, and
   *  never combine with other rows in a multi-selection. */
  locked?: boolean;
}
```

### Drag source

In `useReorderDragList`, `onPointerDownRow` becomes a no-op for locked rows:
no `pendingRef` is set, so subsequent pointer-move logic cannot engage a drag.
LayerList's `handleRowPointerDown` still records the pending click for
selection purposes, so plain-click selection still works.

### Drop clamp

Compute `firstLockedIndex` once per pointer-move/up handler:

```ts
const firstLockedIndex = items.findIndex((it) => it.locked);
const cap = firstLockedIndex === -1 ? items.length : firstLockedIndex;
const clamped = Math.min(rawTargetIndex, cap);
```

Apply the clamp inside `computeTargetIndex` (or at its call sites in
`onPointerMove` / `onPointerUp`). The drop indicator can land just above the
first locked row but never at or past it.

This rule generalizes: multiple locked rows act as walls; drops are clamped to
the first locked row encountered while scanning top-down. The current
swillustrator use case has a single Page row at the bottom, which simplifies
to "clamp at index `items.length - 1`".

### Selection

`LayerList`'s pointer-up logic computes the new selection from
`pendingClickRef`. Add two rules:

1. **Click or shift-click on a locked row → exclusive select.**
   `onSelect([id])` regardless of shift state. Locked rows never enter a
   multi-selection.
2. **Shift-click on a regular row while the current `selectedIds` contains
   any locked id → strip locked ids first**, then apply the normal toggle.
   This prevents a stale Page selection from carrying through when the user
   starts building a multi-selection of regular layers.

### DOM affordance

Locked row elements emit `data-locked="true"`. This gives consumers a
selector hook for visual treatment (e.g. swillustrator's divider above the
Page row) without baking styling into the library.

## Semantics (swillustrator)

### Page row construction

Define a constant id in App.tsx:

```ts
const PAGE_ROW_ID = '__page__';
```

The `layerItems` memo currently builds a top-down array by reversing
`items` (bottom-up scene order). Append the Page row to that reversed list so
it renders at the visual bottom:

```ts
const layerItems: LayerListItem[] = useMemo(() => {
  const objectRows = [...items].reverse().map((o): LayerListItem => ({
    id: o.id,
    label: <span className="swill-layer-label">
      <KindIcon kind={o.kind} />
      <span>{o.id}</span>
    </span>,
  }));
  const pageRow: LayerListItem = {
    id: PAGE_ROW_ID,
    locked: true,
    label: <span className="swill-layer-label swill-layer-label-page">
      <PageIcon />
      <span>Page</span>
    </span>,
  };
  return [...objectRows, pageRow];
}, [items]);
```

### Reorder handler

`onLayerReorder` needs no changes. LayerList's drop clamp already prevents
`targetIndex` from reaching the Page slot, so the existing bottom-up index
math continues to produce a valid scene index. Reordering a regular layer
"to the very bottom" lands it just above the Page row, which is exactly the
back of the scene (scene index 0).

### Selection plumbing

Add a small piece of local UI state:

```ts
const [pageSelected, setPageSelected] = useState(false);
```

`onSelectLayers` switches on the Page id:

```ts
onSelectLayers={(ids) => {
  if (ids.length === 1 && ids[0] === PAGE_ROW_ID) {
    setPageSelected(true);
    selection.set([]);
  } else {
    setPageSelected(false);
    selection.set(ids.map(asNodeId));
  }
}}
```

`selectedIds` passed to LayerList becomes:

```ts
selectedIds={pageSelected ? [PAGE_ROW_ID] : selection.current.map(String)}
```

The Page id is opaque to the scene — `selection.current` never contains it.
Existing selection-aware logic (delete, duplicate, property updates) sees an
empty selection while Page is the active row, so all those code paths no-op
without modification.

A side effect clears `pageSelected` whenever scene selection becomes
non-empty through any other path (marquee, viewport click, etc.). The exact
shape depends on how `selection` exposes change notifications — at minimum
a subscription or effect that fires on selection mutation and sets
`pageSelected` to false when `selection.current.length > 0`.

### Right sidebar

The top `PropertiesPanel` currently has two branches: a primary-selected
panel and a Defaults panel. Add a third for `pageSelected`:

```tsx
{pageSelected ? (
  <PropertiesPanel title="Page">
    <PropertyRow label="Title">…</PropertyRow>
    <PropertyRow label="Paper">…</PropertyRow>
  </PropertiesPanel>
) : primary ? (
  <PropertiesPanel title={`Selection (${selectedItems.length})`}>…</PropertiesPanel>
) : (
  <PropertiesPanel title="Defaults">…</PropertiesPanel>
)}
```

The existing standalone "Document" panel below the layer list stays in place
for this iteration — the spec scope is the Page row, not document-properties
relocation. Revisit when the proper layer system lands.

### Viewport behavior

No code changes needed. The page is rendered by `pageLayer` (a `RenderLayer`),
not a scene node, so viewport pointer events already don't hit it. Selection
from the viewport is impossible by construction.

## Visual treatment

Lives entirely in swillustrator CSS, keyed off the row label class and the
`data-locked="true"` attribute emitted by LayerList:

- The Page row's kind-icon slot uses a document/file icon.
- `.swill-layer-label-page` styles the text muted + italic.
- A 1px divider above any `[data-locked="true"]` row in the layer list
  (`border-top` on the row container).

No inline styles. All styling goes in `swillustrator.css` per the project's
no-inline-styles rule.

## Non-goals

- **No new scene node.** The Page row is purely a UI affordance in the layer
  list. No scene/adapter changes; no ops; no undo entries for Page selection.
- **No deletion semantics.** Page id is never in the scene selection, so the
  existing delete path (which iterates `selection.current`) already does
  nothing. No special-casing needed.
- **No relocation of the Document panel.** The existing
  "Document" panel below the LayerList stays put for now.
- **No multi-locked enforcement beyond the basic clamp.** The clamp rule is
  "drops cannot cross the first locked row from the top". If a future
  consumer puts locked rows in the middle of the list, drops are clamped to
  the first one encountered. That is sufficient for the bottom-Page case
  and reasonable for future system rows.

## Testing

### weasel-ui unit tests (`LayerList.test.tsx`)

- Locked row cannot initiate a drag — pointerdown + pointermove past
  threshold on a locked row produces no `state.draggedIds`.
- Drop indicator clamps — when dragging a regular row, pointermove below
  the locked row produces `targetIndex` equal to the locked row's index, not
  beyond it.
- Plain click on a locked row calls `onSelect([id])`.
- Shift-click on a locked row calls `onSelect([id])` (no toggle, no combine).
- Shift-click on a regular row while `selectedIds` contains a locked id
  strips the locked id before computing the new selection.
- Locked row DOM has `data-locked="true"`.

### swillustrator manual verification

- Clicking the Page row clears canvas selection and surfaces the Page
  properties panel.
- Selecting a regular layer (LayerList or viewport) clears the Page-selected
  state and restores normal property panels.
- Dragging a regular layer all the way down stops just above the Page row;
  reordered scene index matches "back of stack".
- Attempting to drag the Page row does nothing.
- Clicking on the page rect in the viewport does not select Page.

## Implementation order

1. `useReorderDragList` — accept `locked` on items, no-op `onPointerDownRow`
   for locked rows, clamp `computeTargetIndex` based on `firstLockedIndex`.
2. `LayerList` — emit `data-locked="true"`; update selection logic for
   locked rows; export `locked` on `LayerListItem` type.
3. Unit tests for the above.
4. swillustrator: `PAGE_ROW_ID` constant, `pageSelected` state, append Page
   row to `layerItems`, branch the right sidebar, sync `pageSelected` with
   scene selection.
5. CSS: muted/italic class for Page label, divider above `[data-locked]`.
6. Manual verification per the testing section.
