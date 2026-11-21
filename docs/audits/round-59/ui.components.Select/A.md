## The over-trigger nudge is measured in client px but applied in the overlay frame's px, so a Select under a scale or zoom lands its selected row off the trigger
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:78 (AlignOverTrigger layout effect)
- scenario: a Select inside a container drawn at `transform: scale(0.5)` (or `zoom`) is opened. The kit `Popover` places it in an overlay frame (`overlays/overlayFrame.ts`) that hands React Aria the trigger and viewport in the container's own px, so `offset`/`crossOffset` are read in container px. `AlignOverTrigger` computes both from `getBoundingClientRect()` (client px), so the shift comes out scaled by the frame's factor: the selected row ends up half (or double) as far from its resting place as intended, and does not sit over the trigger. The settle check (`next` vs `applied`) compares the same wrongly-scaled numbers, so it converges on the wrong spot. The viewport clamp is wrong the same way: it uses `documentElement.clientHeight` and `seat.bottom` in client px, not the frame's boundary (`frameBoundary`) in its units.
- evidence: read (Popover.tsx's doc comment and `targetInFrame`; alignOverTrigger.tsx uses raw client rects throughout)
- severity: medium

## A placeholder select opened near the bottom edge cannot flip above its trigger
- where: packages/ui/src/components/Select/Select.tsx:220 (Select, `shouldFlip={popup !== 'over'}`) with packages/ui/src/components/Select/alignOverTrigger.tsx:59 (BELOW fallback)
- scenario: `popup='over'` (the default) with nothing selected (placeholder or `mixed`). `AlignOverTrigger` falls back to `BELOW`, "like any other dropdown", but the popover still has `shouldFlip={false}` because that is decided from `popup` alone. With the trigger near the bottom of the window, React Aria keeps the list below and shrinks its max-height to the few px left, instead of flipping it above as `popup='below'` would. Should: flip whenever the list hangs below, i.e. when no row is selected.
- evidence: read
- severity: medium

## In a right-to-left document the over-trigger crossOffset is computed against the wrong edge
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:90 (AlignOverTrigger, `crossOffset`)
- scenario: under `dir="rtl"`, `placement="bottom start"` aligns the popover's right edge with the trigger's right edge, but the formula `shown.left - seat.left - (row.left - box.left)` assumes the list's resting left edge is `seat.left`. For a list wider or narrower than the trigger the crossOffset is off by `box.width - seat.width`, so the selected row does not land over the value. The default `--wzl-select-align` is also `left` (Select.module.css:35) rather than `start`, so `toEnd` is false in RTL even though RTL text reads from the right.
- evidence: read (RTL behavior of React Aria's `start` placement inferred; React Aria not installed in this tree)
- severity: low

## The capture-phase pointerup swallow also hides the opening release from the trigger's own press handling
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:109 (AlignOverTrigger, `onUp`)
- scenario: a mouse click opens the list (React Aria opens a Select on press start for mouse). The opening release is stopped at the document in the capture phase (`stopPropagation`), so neither the trigger's React `onPointerUp` nor usePress's document-level `pointerup` listener sees it. The trigger's press stays started — `data-pressed` / pressed styling remains on the trigger while the list is open, until some later pointerup ends it. Only the row under the pointer needs to miss the release; stopping it for every listener goes further than the comment's intent.
- evidence: inferred (usePress's global pointerup listener from React Aria's source as I know it; not installed here to confirm)
- severity: low

## FitSizer reads a fragment or wrapper child of a children-form Select as one label, so a width='fit' trigger sizes to the sum of the labels
- where: packages/ui/src/components/Select/optionLabels.tsx:26 (optionLabels)
- scenario: `<Select width="fit"><>{items.map(i => <SelectItem …>{i.name}</SelectItem>)}</></Select>`. `Children.toArray` does not flatten fragments, so the fragment is one element whose `props.children` is every SelectItem; `withIcon(undefined, thatArray)` puts all labels in one sizer span, and the trigger becomes as wide as all labels side by side rather than the widest one. A component that renders `SelectItem`s (or a mapped array inside a `SelectSection` wrapper other than `SelectSection` itself) is read the same way.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Select/Select.fontOptions.stories.module.css
packages/ui/src/components/Select/Select.fontOptions.stories.tsx
packages/ui/src/components/Select/Select.module.css
packages/ui/src/components/Select/Select.stories.module.css
packages/ui/src/components/Select/Select.stories.tsx
packages/ui/src/components/Select/Select.tsx
packages/ui/src/components/Select/alignOverTrigger.tsx
packages/ui/src/components/Select/index.ts
packages/ui/src/components/Select/listbox.module.css
packages/ui/src/components/Select/optionLabels.tsx

<!-- done: 5 findings, files read: 10 -->
