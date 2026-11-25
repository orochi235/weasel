# Audit round 56 — ui.components.Bar

I couldn't write `.skulkr/out/findings.md` because the write permission was denied, so the whole document is below.

## Three stories use CSS classes that a 2026-11-14 commit deleted, so they render unstyled
- where: packages/ui/src/components/Bar/BarField.stories.tsx:25 (Strip), :67 (RowBesideBar); packages/ui/src/components/Bar/BarMenu.stories.tsx:37 (Host); packages/ui/src/components/Bar/BarPopover.stories.tsx:31 (Rows)
- scenario: commit bfbeb0eedf (2026-11-14) cut `Bar.stories.module.css` down to `.narrow` and `.rail`. It deleted `.strip`, `.column`, `.matrix`, `.row`, `.head` and `.kind`, and the three stories still read all of them. `s.strip`, `s.column` and the rest are now `undefined`.
  - Every BarField, BarMenu and BarPopover story loses its toolbar-height stand-in strip: no flex line, no surface and no border.
  - The BarField `Vertical` story gets the class `"<bar> undefined"`.
  - `RowBesideBar` loses its three-column grid, so its kind, row and bar cells run together in normal flow.
- evidence: read (`git log -p` on the stylesheet shows the deletion)
- severity: medium

## A held bar's menu button still opens its menu, with live rows
- where: packages/ui/src/components/Bar/BarMenu.tsx:45 (BarMenu)
- scenario: `<Bar disabled>`, or a held `PrefsBar` whose `as: 'menu'` groups draw through `barNodeChildren` → `BarMenu`. `Bar`'s doc says "`disabled` holds every cell".
  - `BarPopover` honors that through `useRacHold`: its trigger goes `isDisabled` and it opens nothing.
  - `BarMenu` reads neither `useDisabled` nor `useControlAccess`, and neither does `useMenuTrigger`.
  - So the button stays enabled and `onClick` opens the menu, with its actions triggerable and its flags writable through `onChange`. A held `defaultOpen` menu also opens on mount.
  - Expected: it draws disabled (or read-only) and opens nothing, as `BarPopover` does.
- evidence: read
- severity: medium

## On a wrapped bar, a drag-reorder drop on the second line picks its gap by x alone
- where: packages/ui/src/components/Bar/BarLine.tsx:45 (BarLine, the `measure` passed to useBarReorder)
- scenario: `<Bar wrap onReorder>` whose cells run onto two lines. `measure` returns only `p.clientX`, and `containerUnits` takes each unit's center x, so units on both lines are compared on one axis.
  - Line 1's middles are at x = 10, 50, 90; line 2's are at x = 10, 50.
  - A Cmd-drag released at x = 30 on line 2 gets `gapByMidpoint` = 2, because both x = 10 middles count.
  - The cell lands between line 1's second and third cells, and the drop marker shows that gap too. It should land in the gap on the line under the pointer.
- evidence: read
- severity: medium

## A curved bar drops `fit`, so its FitLabels never shorten together
- where: packages/ui/src/components/Bar/BarAlong.tsx:40 (BarAlong)
- scenario: `<Bar fit>` inside a curved `Along`. `BarLine` wraps its content in `<FitScope value={useFitScope(barRef)}>` when `props.fit` is set. `BarAlong` never reads `props.fit` and provides no fit scope.
  - So on this path the option is silently dropped: the `FitLabel`s don't shorten together as `BarProps.fit` promises.
  - Neither `docs/unruled.md` nor the props doc exempts a curved bar.
- evidence: read
- severity: low

## A vertical framed bar never scrolls, though its doc says it does
- where: packages/ui/src/components/Bar/Bar.module.css:44 (`.framed[data-orientation='vertical']`)
- scenario: `<Bar framed orientation="vertical">` with the default `overflow: 'scroll'`, holding more cells than its host is tall.
  - `.framed` scrolls through `overflow-x: auto`. The vertical rule resets that to `visible` and sets no `overflow-y`.
  - So the column spills out of its strip over whatever lies below. Expected: it scrolls along its line, as `BarProps.overflow` says ("a framed bar scrolls").
- evidence: read
- severity: low

## useMenuLeast reports a near-zero minimum width under right-to-left
- where: packages/ui/src/components/Bar/useMenuLeast.ts:17 (measure)
- scenario: a `BarMenu` in a movable `ToolbarDock` under `dir="rtl"`. The handle span comes before the button in the DOM, so in RTL it sits to the button's right.
  - `start = lead.left` is then greater than `button.right`, so `right - start` is about minus the gap and `least` comes out near 0.
  - The dock is told the bar can shrink to nothing and squeezes it below its button, which is exactly what this hook exists to prevent.
  - It should span from the smaller left to the larger right of the two boxes.
- evidence: read
- severity: low

## Alt+arrow at the end of a container moves roving focus instead of doing nothing
- where: packages/ui/src/components/Bar/useBarReorderKeys.ts:95 (onKeyDownCapture), with BarLine.tsx:71
- scenario: `<Bar roving onReorder>`, with focus on the last unit of its container (say the last cell of a run, with other buttons after it).
  - Alt+ArrowRight finds no `neighbor` and returns without `preventDefault` or `stopPropagation`.
  - The bubble-phase `rove.onKeyDown` ignores modifiers, so it moves focus to the next button.
  - The hook's doc says "An end of the line does nothing". Expected: the chord is consumed at the end too.
- evidence: read
- severity: low

## useBarOverflow's size cache keeps every key it has ever seen
- where: packages/ui/src/components/Bar/useBarOverflow.ts:38 (`sizes`)
- scenario: a `Bar overflow="menu"` whose item keys change over its life, such as cells keyed by node id or path and rebuilt per selection.
  - `measure` only ever calls `set` on `sizes.current`, and no key is ever deleted, so the map grows by every distinct key for as long as the bar is mounted.
  - Keeping a size for an item that has moved into the menu is intended. Keys that are no longer in `keys` should be dropped when the signature changes.
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

<!-- done: 8 findings, files read: 40 -->