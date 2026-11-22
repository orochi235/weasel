# Audit round 67 — ui.components.Bar

## A disabled BarMenu still opens its menu on click
- where: packages/ui/src/components/Bar/BarMenu.tsx:82-95 (BarMenu)
- scenario: `<Bar disabled><BarMenu …/></Bar>` (or a `holdScope` disabling it). `off` is read (line 57) but gates only the `defaultOpen` effect. The `<button>` carries no `disabled`/`aria-disabled`, and `onPointerDown={trigger.press}` / `onClick` → `trigger.click(e, resolve, side)` run unconditionally; `useMenuTrigger.click` calls `show` with no hold check. A click opens the menu, and its rows trigger actions and write values. The doc comment says "Disabled, it opens nothing", and BarPopover does honor it (`isOpen: false`, `isDisabled`). The button is also not dimmed, since `.popTrigger:is([data-disabled], [data-held='disabled'])` never matches.
- evidence: read (BarMenu.tsx, Menu/useMenuTrigger.tsx:67-76)
- severity: high

## A duplicate `Bar.Item` id still gets marked as a reorder unit, under a bogus key
- where: packages/ui/src/components/Bar/barItems.tsx:72-74 (lineItems)
- scenario: two `Bar.Item`s with `id="zoom"` and `in=""` on a bar with `onReorder`. The second's key falls back to its slot path (`.3`), and the warning says it "is not a unit a reorder moves". But line 74 still sets `in: p.in` whenever `mark && p.in !== undefined`. So `drawBarItem` marks it `data-bar-unit="3"` (`barUnitKey('.3')`), and a Cmd-drag or Alt+arrow on it writes `'3'` into the container's order, a key no child has. Other children use `unit()`, which checks `key === child.key` to skip fallbacks; Bar.Item has no such check, so the same decision gets two different answers.
- evidence: read
- severity: medium

## A curved bar drops `framed`, `wrap`, and the status strip's footer
- where: packages/ui/src/components/Bar/BarAlong.tsx:89-105 (BarAlong)
- scenario: `<Along shape={arc}><Bar framed="status" …/></Along>`, or `framed`/`framed="segmented"`. BarLine applies `frameClass(framed)`, renders a `<footer>` for `status`, and sets `aria-orientation`. BarAlong calls `barRoot` but uses only its `role`: it always renders a `<div>`, never applies a frame class, and ignores `wrap`. Neither BarProps nor Bar's doc says these options are line-only. A status strip on a curve loses its footer semantics, and the frame is silently dropped.
- evidence: read
- severity: low

## In menu mode a spacer's measured length is whatever slack it absorbed, so `--bar-natural` can lock in extra room
- where: packages/ui/src/components/Bar/useBarOverflow.ts:62,70-73 (useBarOverflow measure); Bar.module.css:73-79,407-409
- scenario: a `'menu'` bar holding a `Bar.Spacer` (or a `Bar.Group end`). `.spacer { flex: 1 }` grows into any room the bar is given, and `measure` records that grown width as the spacer's size. `natural` sums it, and `inline-size: var(--bar-natural)` then pins the bar at that width. Once a host has given the bar more room than its content (its first auto-width layout in a block host, say), the spacer keeps filling it and natural never drops back to the content length. That contradicts "asks for its natural length … does not stretch to fill its host". The `first` parameter's doc already notes that "a spacer has no length of its own to keep", but `sizes`/`fitting` still count one. (Inferred from the CSS and the measuring code; not run.)
- evidence: read (inferred)
- severity: low

## A refused keyboard reorder leaves a pending refocus that steals focus on a later render
- where: packages/ui/src/components/Bar/useBarReorderKeys.ts:59-68,102-104 (useBarReorderKeys)
- scenario: Alt+Right on a unit calls `done(next)` after setting `refocus.current`. An `onReorder` that rejects the move (validates, or ignores it while busy) changes no state, so nothing renders and `refocus` stays set. `setAnnouncement` only re-renders the hook's owner when the text changes; a repeat announcement like "Undo, 2 of 4" does not. On the next render for any reason (a value change, a hover state), the dep-less layout effect finds the unit and calls `focusableOf(found).focus()` whenever focus is elsewhere. That pulls focus off whatever control the reader has moved to since. The refocus should be dropped once the render that answers the move has happened (or limited to the next commit).
- evidence: read (inferred)
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

<!-- done: 5 findings, files read: 41 -->
