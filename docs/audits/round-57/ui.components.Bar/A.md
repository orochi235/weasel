# Audit round 57 — `ui.components.Bar` findings

## A keyless cell's key is its index after `false`/`null` children are dropped, so toggling a conditional child remounts every keyless cell after it
- where: packages/ui/src/components/Bar/barItems.tsx:29-45 (flatChildren, lineItems)
- scenario: `<Bar>{showGrid && <Toggle/>}<NumberBox/><Select/></Bar>`. `flatChildren` skips `false`/`null`, and `lineItems` keys each keyless child `.${i}` from its index in that filtered list. When `showGrid` flips, `NumberBox` goes from `.1` to `.0` and `Select` from `.2` to `.1`, so React unmounts and remounts both: a focused number box loses focus and its draft, an open select or popover closes. Plain React keeps the hole and leaves those siblings alone. The `useBarOverflow` size cache (`sizes`, keyed by item key) also attaches the old measurements to different cells, so a cell in the More menu has a stale width until it comes back on the line. The keyless index should count every child slot, holes included (as `Children.toArray`/React do), or carry the slot path through fragments.
- evidence: read
- severity: medium

## A keyed child inside a fragment or array can share its key with a sibling elsewhere in the bar, which gives two cells one item key
- where: packages/ui/src/components/Bar/barItems.tsx:29-45 (flatChildren, lineItems)
- scenario: `<Bar>{left.map(b => <B key={b.id}/>)}{right.map(b => <B key={b.id}/>)}</Bar>` with an id present in both lists. React keeps them apart because each array is its own scope, but `flatChildren` flattens both arrays into one list and `lineItems` uses the raw `child.key` (`String(child.key)`), so two items get the same key. React then reports duplicate keys among the bar's spans, `useBarOverflow` keeps one size for both (`data-bar-item` collides), and `splitBarItems`/the reorder treat them as one unit. A key should be qualified by the scope it came from.
- evidence: read
- severity: low

## A menu-mode bar does not re-measure when its lead appears or leaves with the same items, so `--bar-natural` and the kept count go stale
- where: packages/ui/src/components/Bar/useBarOverflow.ts:46-73 (useBarOverflow); packages/ui/src/components/Bar/BarLine.tsx:36-39
- scenario: A `PrefsBar`/`Bar` with `overflow="menu"` and `lead` toggled from unset to `'label'` (it is a pref, `PrefBarLead`), or a `ToolbarDock` made movable so that `useDockHandle` adds a grip lead. The item keys don't change, so the effect's deps (`on, signature, kept, vertical`) stay the same and the effect doesn't run again. The new lead span is not one of the children `watchResize` was given. The bar's own box is `inline-size: var(--bar-natural)` (Bar.module.css:72), which still holds the old value, so the bar itself doesn't resize either. Result: `natural` and `kept` leave out the lead's length plus a gap. The line overflows its box by that much (`overflow: visible`) instead of folding a cell into More, and it stays that way until some unrelated resize happens. Removing the lead goes wrong the opposite way: cells stay in the menu although there is now room for them. The effect needs to depend on whether there is a lead (or observe the lead element) as well as on the keys.
- evidence: read
- severity: medium

## `useMenuLeast` measures from the lead's left edge to the button's right edge, which gives the wrong `least` in a right-to-left row
- where: packages/ui/src/components/Bar/useMenuLeast.ts:16-19 (useMenuLeast measure)
- scenario: A `BarMenu` in a movable `ToolbarDock` under `dir="rtl"`. The grip lead comes before the button in DOM order, so in RTL it is drawn to the button's right. `start = lead.getBoundingClientRect().left` is then to the right of `button.right`, and `least = ceil(button.right - lead.left + squeezed)` comes out about −gap instead of lead + gap + button. The dock is told the bar can shrink to almost nothing, so a squeezed row cuts off the menu button, which is exactly what this hook exists to prevent ("keep a menu bar's whole button"). The measure should span min(left)..max(right) of the two boxes, or add their widths and the gap.
- evidence: read
- severity: medium

## A keyed `Bar.Group` is never marked as a reorder unit, although `onReorder`'s doc says every keyed child is
- where: packages/ui/src/components/Bar/barItems.tsx:55-57 (lineItems, BarGroup branch); doc at packages/ui/src/components/Bar/Bar.tsx:68-71
- scenario: `<Bar onReorder={set} order={o}><Bar.Group key="history">…</Bar.Group><Button key="save"/></Bar>`. The `BarGroup` branch pushes `{ key, content: child }` without `in: ''`, while the generic branch (line 59) gives every other keyed child `in: ''`. So the group's cell carries no `data-bar-unit`. A Cmd-drag on it does nothing, Alt+arrow on the group does nothing, and the `Button`'s container `''` has one unit, so it can't be moved past the group either. The doc says "each keyed child … is marked with `data-bar-unit`". Either the group branch marks keyed groups or the doc carves out groups.
- evidence: read
- severity: low

## A framed vertical bar doesn't scroll when too long for its room, although `overflow: 'scroll'` says a framed bar scrolls
- where: packages/ui/src/components/Bar/Bar.module.css:44-47 (.framed[data-orientation='vertical'])
- scenario: `<Bar framed orientation="vertical">` with more cells than its host's height. `.framed` sets `overflow-x: auto`, and the vertical rule resets it to `overflow-x: visible` without setting `overflow-y`, so both axes are `visible`. The cells spill out of the strip past its border instead of scrolling. `BarProps.overflow` says "`'scroll'` keeps every cell on the line, which a framed bar scrolls", and the `.framed` comment says "Too long for its room, it scrolls". The vertical rule should set `overflow-y: auto` (keeping x visible for turned fields if that was the intent).
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

<!-- done: 6 findings, files read: 40 -->
