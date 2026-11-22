# Audit round 67 — ui.components.part10

## A canceled tool carry leaves its ghost stuck on the page
- where: packages/ui/src/components/ToolPalette/useToolCarry.tsx:42 (useToolCarry press)
- scenario: `ToolPalette` with `carryTool` and `carryGhost`. Press a tool button and drag past the slop, so the ghost shows; then the window loses focus (Cmd-Tab), or the browser sends `pointercancel`. `startCarry` reports that through `onCancel` ("Exactly one of `onEnd` / `onCancel` fires", routing `carry.ts:43`, and `onBlur` → `session.cancel()`), but the hook passes only `onMove` and `onEnd`, and `setGhost(null)` lives only in `onEnd`. The `DragGhost` stays drawn at the last pointer position indefinitely, until some later carry from this palette ends normally. It should also clear the ghost in `onCancel`.
- evidence: read (carry.ts startCarry / CarryCallbacks)
- severity: medium

## A stack's cycle click does nothing when its face is the only enabled member and is not active
- where: packages/ui/src/components/ToolRail/RailStack.tsx:51 (RailStack onClick)
- scenario: a stack [rect, ellipse] whose face is `ellipse` (last used, not active, e.g. `select` is the active tool) and `rect` is disabled by the mode. Alt-click on the stack: the loop runs `step` from 1 to `members.length - 1`, so it only visits members other than the face; `rect` is disabled, so nothing is pressed. The button is drawn enabled (anyEnabled), shows `ellipse`, and an Alt-click silently does nothing, where it should press `ellipse` (the only enabled member). The loop should also consider the face itself when the face is not active (`step <= members.length` or start at 0 when `!current`).
- evidence: read
- severity: low

## A stack with a duplicated id makes a stack button holding the same tool twice
- where: packages/ui/src/components/ToolPalette/stacks.ts:39 (stackIndex), :27 (placeSlots)
- scenario: `stacks={[['rect', 'rect']]}` (or a set whose members name `rect` twice via nested sets). `stackIndex` accepts it since `held === stack`, and `placeSlots` maps `stack.flatMap(id => shown.get(id))` to `[rect, rect]`: length 2, so it becomes a stack of two identical members, a menu with two rows sharing React key `rect` (duplicate-key warning) and an Alt-cycle that steps to the same tool. Expected: dedupe the ids (one member → lone tool), or throw as for an id in two stacks.
- evidence: read
- severity: low

## A tool disabled by the mode still gets the carry-source class
- where: packages/ui/src/components/ToolPalette/ToolPalette.tsx:144 (button)
- scenario: `carryTool` returns a payload for `rect`, and the mode makes `rect` ineligible with `ineligible="dim"`. `onPointerDown` is withheld (`carryTool && enabled`), but `className` is set from `carryTool?.(tool) != null` with no `enabled` check, so the dimmed, inert button still wears `s.carrySource` (its grab affordance) though pressing it carries nothing. The two fields answer "is this a carry source" two ways; the class should follow the same `enabled` gate.
- evidence: read
- severity: low

## RailStack throws on a stack with no members
- where: packages/ui/src/components/ToolRail/RailStack.tsx:30 (RailStack)
- scenario (empty stack): a `ToolRail` consumer builds `{ id: 'shapes', members: shapes.filter(visible) }` and the filter leaves nothing. `useState(members[0].id)` throws `Cannot read properties of undefined`, taking the rail down. `ToolRailStack` is public and its type allows `[]`; `ToolPalette` avoids it only because `placeSlots` never builds one. `railRuns`/`ToolRail` should drop an empty stack (and draw a one-member stack as a button, as `placeSlots` does).
- evidence: read
- severity: low

Note: the brief names commit a2dfd0456e1787d352e92d6a6a6ad07fce7f5229, but this checkout's HEAD is 1eae5ad17c and `git diff` reports `bad object` for a2dfd04, so I could not confirm the files match it. The files were read as they stand in the working tree; line numbers refer to that tree.

## Files read
packages/ui/src/components/ToolPalette/ToolPalette.stories.tsx
packages/ui/src/components/ToolPalette/ToolPalette.tsx
packages/ui/src/components/ToolPalette/index.ts
packages/ui/src/components/ToolPalette/order.ts
packages/ui/src/components/ToolPalette/stacks.ts
packages/ui/src/components/ToolPalette/useToolCarry.tsx
packages/ui/src/components/ToolRail/RailStack.tsx
packages/ui/src/components/ToolRail/ToolRail.module.css
packages/ui/src/components/ToolRail/ToolRail.stories.tsx
packages/ui/src/components/ToolRail/ToolRail.tsx
packages/ui/src/components/ToolRail/index.ts
packages/ui/src/components/ToolRail/items.ts
packages/ui/src/components/Tooltip/Focusable.tsx
packages/ui/src/components/Tooltip/Tooltip.module.css
packages/ui/src/components/Tooltip/Tooltip.stories.tsx
packages/ui/src/components/Tooltip/Tooltip.tsx
packages/ui/src/components/Tooltip/buttonTooltip.tsx
packages/ui/src/components/Tooltip/index.ts
packages/ui/src/components/Transport/AnimatedTransport.tsx
packages/ui/src/components/Transport/Transport.module.css
packages/ui/src/components/Transport/Transport.stories.module.css
packages/ui/src/components/Transport/Transport.stories.tsx
packages/ui/src/components/Transport/Transport.tsx
packages/ui/src/components/Transport/index.ts
packages/ui/src/components/Transport/timeText.ts
packages/ui/src/components/Transport/timelineHandle.fixtures.ts
packages/ui/src/components/Transport/useTimelinePlayback.ts
packages/ui/src/components/ZoomControl/ZoomControl.module.css
packages/ui/src/components/ZoomControl/ZoomControl.stories.tsx
packages/ui/src/components/ZoomControl/ZoomControl.tsx
packages/ui/src/components/ZoomControl/index.ts
packages/ui/src/components/appearance.ts
packages/ui/src/components/appearanceIcons.ts
packages/ui/src/components/checker.module.css
packages/ui/src/components/heldItem.ts
packages/ui/src/components/listOption.ts
packages/ui/src/components/toggleLabel.module.css
packages/ui/src/components/toggleModifiers.ts

<!-- done: 5 findings, files read: 38 -->
