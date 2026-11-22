# Audit round 67, area `ui.components.Bar`

## A disabled BarMenu still opens its menu on click or Enter
- where: packages/ui/src/components/Bar/BarMenu.tsx:82-94 (BarMenu)
- scenario: `<Bar disabled><BarMenu label="View" schema={…} values={…} /></Bar>` (or any `HoldProps`/`Disabled` scope above it). `off` is read from `useDisabled()` but only gates the `defaultOpen` effect; the `<button>` gets no `disabled`/`aria-disabled`, and `onPointerDown={trigger.press}` / `onClick` call `trigger.click(e, resolve, side)` unconditionally, which `show`s the resolved entries (useMenuTrigger.tsx:72-76). The menu opens and its rows trigger actions and write values. The component's doc says "Disabled, it opens nothing", and its sibling `BarPopover` does force `isOpen: false` and `isDisabled` when held.
- evidence: read
- severity: high

## `aria-keyshortcuts` is left on controls after a bar's `onReorder` is removed
- where: packages/ui/src/components/Bar/useBarReorderKeys.ts:69-74 (useBarReorderKeys layout effect)
- scenario: a bar renders with `onReorder`, so every unit's control gets `aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"`. The host then drops `onReorder` (e.g. a locked layout). `Bar` passes `mark = onReorder !== undefined` to `lineItems`, so no cell carries `data-bar-unit` any more; the effect's `querySelectorAll('[data-bar-unit]')` finds nothing and the `keys === null → removeAttribute` branch never reaches the controls, which are the same DOM nodes and keep advertising shortcuts that now do nothing. The removal branch is effectively dead: whenever `enabled` is false there are no marked units to clear.
- evidence: read
- severity: low

## A Bar.Item whose id repeats is still made a reorder unit, keyed by its slot path
- where: packages/ui/src/components/Bar/barItems.tsx:72-74 (lineItems)
- scenario: two `<Bar.Item id="zoom" in="">` children under a bar with `onReorder`. `own()` warns that "the later one is keyed by its place and is not a unit a reorder moves" and returns the slot path (`.1`), but the item still gets `in: p.in`, so `drawBarItem` marks it `data-bar-in=""` `data-bar-unit=".1"` (barUnitKey of `.1` is `1`). A Cmd-drag or Alt+arrow on it then moves a unit keyed `1`, and without `keysOf` calls `onReorder` with an order list containing `"1"`, a key no child has. Other children go through `unit(key, child)`, which withholds `in` when the key fell back (`key === child.key`); Bar.Item skips that check, so the two paths answer "is a duplicate a unit" differently.
- evidence: read
- severity: low

## The arc lab computes a popover's side with its own copy of `sideOf`
- where: packages/ui/src/components/Bar/lab/useBarMeasure.ts:29-32 (sideOf), :45 (sideAt)
- scenario: the lab's "asked for (outward)" readout and its `bad` flag (BarArcView.tsx:56) are meant to check the side the bar asks for (`sideAtRun` in barSide.ts). The lab re-implements `sideOf` (identical body, its own `Side` type) and derives the normal from `shape.nearest(p)` at the item's drawn center, not from `run.at(spot.at)` with the flip `sideAtRun` applies. Any change to the bar's rule (tie-breaking, flip handling) leaves the lab checking the old one and reporting the bar as right or wrong against it; one decision answered in two places.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Bar/Bar.module.css
packages/ui/src/components/Bar/Bar.overflow.stories.module.css
packages/ui/src/components/Bar/Bar.overflow.stories.tsx
packages/ui/src/components/Bar/Bar.stories.module.css
packages/ui/src/components/Bar/Bar.stories.tsx
packages/ui/src/components/Bar/Bar.tsx
packages/ui/src/components/Bar/BarAlong.module.css
packages/ui/src/components/Bar/BarAlong.tsx
packages/ui/src/components/Bar/BarField.fixtures.tsx
packages/ui/src/components/Bar/BarField.stories.tsx
packages/ui/src/components/Bar/BarField.tsx
packages/ui/src/components/Bar/BarLine.tsx
packages/ui/src/components/Bar/BarMenu.stories.tsx
packages/ui/src/components/Bar/BarMenu.tsx
packages/ui/src/components/Bar/BarOverflow.tsx
packages/ui/src/components/Bar/BarPopover.stories.tsx
packages/ui/src/components/Bar/BarPopover.tsx
packages/ui/src/components/Bar/barFrames.module.css
packages/ui/src/components/Bar/barItems.tsx
packages/ui/src/components/Bar/barLabel.module.css
packages/ui/src/components/Bar/barLeadHandle.tsx
packages/ui/src/components/Bar/barLines.ts
packages/ui/src/components/Bar/barMenuRoot.ts
packages/ui/src/components/Bar/barOrder.ts
packages/ui/src/components/Bar/barParts.module.css
packages/ui/src/components/Bar/barParts.tsx
packages/ui/src/components/Bar/barSide.ts
packages/ui/src/components/Bar/barTurn.module.css
packages/ui/src/components/Bar/index.ts
packages/ui/src/components/Bar/lab/BarArc.stories.module.css
packages/ui/src/components/Bar/lab/BarArc.stories.tsx
packages/ui/src/components/Bar/lab/BarArcView.tsx
packages/ui/src/components/Bar/lab/barArcConfig.ts
packages/ui/src/components/Bar/lab/useBarMeasure.ts
packages/ui/src/components/Bar/popFace.tsx
packages/ui/src/components/Bar/renderBarLeaf.tsx
packages/ui/src/components/Bar/useBarOverflow.ts
packages/ui/src/components/Bar/useBarReorder.ts
packages/ui/src/components/Bar/useBarReorderKeys.ts
packages/ui/src/components/Bar/useMenuLeast.ts
packages/ui/src/components/Bar/useTurnToFit.ts

<!-- done: 4 findings, files read: 41 -->
