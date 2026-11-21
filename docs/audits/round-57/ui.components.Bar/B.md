I've read all 40 files. Composing the findings document.

I couldn't write `.skulkr/out/findings.md` because the write permission was denied, so here is the whole document:

# Audit round 57 — ui.components.Bar

## An unkeyed cell's key is its index after `false`/`null` children are dropped, so a conditional child ahead of it remounts it
- where: packages/ui/src/components/Bar/barItems.tsx:46 (lineItems), with flatChildren at :29
- scenario: Take `<Bar><Button/>{showA && <Toggle/>}<NumberField/></Bar>`. `flatChildren` drops the `false` slot. `lineItems` then keys the number field `.1` while `showA` is false and `.2` once it is true. `drawBarItem` keys the cell's span with that string, so React unmounts and remounts the number field. Focus, an edit in progress and any open popover are lost. `useBarOverflow`'s size map uses the same strings, so it gives the field the toggle's old width until it measures again. React keeps a slot for a `false` child, so the index should count the original children, empty slots included.
- evidence: read
- severity: medium

## `BarMenu` ignores the bar's disabled/read-only hold, so a menu group in a disabled bar still opens and runs its actions
- where: packages/ui/src/components/Bar/BarMenu.tsx:39 (BarMenu)
- scenario: `Bar`'s doc says `disabled` holds every cell, and `holdScope(own, …)` provides that hold. `BarPopover` reads it through `useRacHold` and won't open. `BarMenu` calls neither `useRacHold` nor `useDisabled`, and `useMenuTrigger` has no disabled handling. So in a `<PrefsBar disabled>` (or a disabled `Bar`), a group drawn `as: 'menu'` (barNodes.tsx:122) shows a live button. Its menu opens, its items run their actions, and `defaultOpen` opens it on mount anyway.
- evidence: read
- severity: medium

## A `menu`-overflow `BarLine` doesn't re-fit when its lead appears, disappears or changes width
- where: packages/ui/src/components/Bar/useBarOverflow.ts:44-71 (useBarOverflow effect deps / watchResize targets)
- scenario: The effect re-runs only on `[on, signature, kept, vertical]`. It observes `el` and the children that exist when it runs. Switching `lead` from unset to `'label'` (it is a pref, `PrefBarLead`) or changing `label` adds or resizes the lead span without changing any of those deps. The bar's own box doesn't resize either, because it is pinned at `inline-size: var(--bar-natural)`, and the new lead span isn't observed. So `natural` and `kept` stay at their lead-less values: the line overruns its natural width by the lead, and cells that no longer fit stay on the line until some unrelated resize. `BarAlong` avoids this by passing `drawnKeys(items, leading != null)` to `useItemLengths`.
- evidence: read
- severity: low

## `useMenuLeast` measures from the lead's left edge, which in right-to-left layout is past the button, so the dock gets a negative least length
- where: packages/ui/src/components/Bar/useMenuLeast.ts:17 (useMenuLeast, measure)
- scenario: Put a `BarMenu` in a movable `ToolbarDock` under `dir="rtl"`. The handle comes first in DOM order, so it is drawn to the right of the button. Then `lead.left > button.right`, and `least = ceil(button.right − lead.left + …)` is about minus the lead's width. `useReportDockLeast` passes that to the dock, which can then squeeze the row below the button and its lead, which is the case this hook exists to prevent. The measure should run from the leftmost edge of the two to the rightmost.
- evidence: read
- severity: low

## A disabled compound leaf's popover still opens, but a disabled text area's does not
- where: packages/ui/src/components/Bar/renderBarLeaf.tsx:46 (renderBarLeaf)
- scenario: With `BarLeaf.disabled` set on a compound leaf, `renderBarLeaf` draws `<BarPopover label icon>` without `disabled`, so the button stays live and opens onto held controls. For a `string` leaf with `control: 'textarea'`, `BarField` passes `disabled={p.disabled}` to `BarPopover`, which dims the button and won't open. The same "leaf takes no input" state gives two different bar behaviors.
- evidence: read
- severity: low

## `least` shrinks to the lead alone when the bar's first item is a spacer
- where: packages/ui/src/components/Bar/useBarOverflow.ts:66 (useBarOverflow, measure)
- scenario: Take `<Bar overflow="menu">` whose children start with `<Bar.Group end>` or `<Bar.Spacer/>`. `lineItems` puts a spacer first, and `tidyDividers` keeps it. While everything fits, the More button has never been drawn (`more.current === 0`), so `end = first`, the spacer's width. That width is 0 when the bar sits at its natural length (`flex: 1`, no content). `least` is then just lead plus frame, and a dock squeezing several bars leaves this one no room for any cell or the More button.
- evidence: read
- severity: low

## The Bar stories use classes `Bar.stories.module.css` no longer defines
- where: packages/ui/src/components/Bar/BarField.stories.tsx:24-26,63-75; BarMenu.stories.tsx:36; BarPopover.stories.tsx:31
- scenario: The stories use `s.strip`, `s.column`, `s.matrix`, `s.head`, `s.kind` and `s.row`. The stylesheet now defines only `.narrow` and `.rail`; bfbeb0eedf deleted `.strip`, `.column`, `.matrix` and `.matrix > .row`. Each of those classes is `undefined`. `BarField/Vertical` ends up with the class string `"<bar> undefined"` and loses the column layout. `RowBesideBar` loses its three-column grid and draws as a pile. The `strip` wrappers in the BarField, BarMenu and BarPopover stories lose the strip they were meant to show.
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

<!-- done: 7 findings, files read: 40 -->