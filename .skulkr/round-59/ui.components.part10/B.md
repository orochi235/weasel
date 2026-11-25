I couldn't save the findings: `.skulkr/out/findings.md` was created with the first finding, then later writes were refused at the permission prompt. The whole document is below instead. I couldn't run `git log` either, so I didn't check what changed in the last week.

# Audit round 59 — ui.components.part10

## ToolPalette never re-renders on a mode switch, so dim/hide and the disabled reason go stale
- where: packages/ui/src/components/ToolPalette/ToolPalette.tsx:117,125 (ToolPaletteRail)
- scenario: `<ToolPalette modeRegistry={reg} />`, then `reg.setMode('view')`. `allowed()` and `disabledReason` read `modeRegistry.current()` during render, but nothing subscribes to `reg.subscribe`. The palette keeps the old mode's tools enabled, and with `ineligible="hide"` keeps the old set, until something unrelated re-renders it. It should subscribe to the registry and re-render when the mode changes.
- evidence: read (`ModeRegistry.subscribe` exists in packages/modes/src/registry.ts; no ToolPalette test calls `setMode`)
- severity: medium

## A stacked tool silently loses `carryTool` and `onToolDragStart`
- where: packages/ui/src/components/ToolPalette/ToolPalette.tsx:139-141,147 (ToolPaletteRail); packages/ui/src/components/ToolRail/RailStack.tsx:60-71
- scenario: `<ToolPalette stacks={[['rect','ellipse']]} carryTool={…} onToolDragStart={…} />`. `button()` builds `onPointerDown`, `onDragStart` and the `carrySource` class for each stack member. `RailStack` draws a single `ActionButton` and uses only the members' `onPress`. Pressing or dragging the stack's face neither carries nor fires `onToolDragStart`, though the props promise that each tool's button is a source.
- evidence: read
- severity: medium

## useTimelinePlayback ignores a negative time scale: a reversed timeline at 0 reads "playing" and spins the frame loop forever
- where: packages/ui/src/components/Transport/useTimelinePlayback.ts:8-11 (isAdvancing), :48 (onPlayingChange)
- scenario: a handle with `setTimeScale(-1)` and loop `false`. The animator accepts any finite scale, and `createTimeline` stops a backward run at `pos.atEnd(true)`.
  - Once it has played back to 0, `isAdvancing` still answers `time() < duration()`, which is true. `playing` stays true, so the button reads "Pause", and the `useVisibleRaf` callback requests a new frame every frame, so the transport re-renders at frame rate indefinitely.
  - Pressing play there doesn't rewind, because `time() >= duration()` is false, and `resume()` is a no-op because `rearm` declines at the backward end.
  - `rate` also passes the negative scale into Transport's rate detents, which show it as "-1x".
- fix: both checks should test the end the scale plays toward.
- evidence: read (packages/animator/src/timeline/createTimeline.ts:73,110; playhead.ts `atEnd`)
- severity: medium

## useTimelinePlayback never hears `edit`, so duration, scrub range and a rearmed timeline go stale
- where: packages/ui/src/components/Transport/useTimelinePlayback.ts:19,27-31
- scenario: the hook subscribes only to `subscribePlayback`. `handle.edit` calls `rearm()`, changes the duration and emits only `edited` (`handle.subscribe`), never `playbackChanged`.
  - An edit that lengthens a paused timeline leaves the readout's end time and the scrub bar's max stale.
  - An edit that lengthens a finished timeline restarts it, but nothing renders, so the every-render effect that should restart the frame loop never runs. The playhead moves while the readout stays frozen.
  - The comment at lines 27-28 counts on that render happening.
- evidence: read (createTimeline.ts `edit`: `edited.emit()` only)
- severity: medium

## useHeldAriaRef never clears its marks under React 18, which the package still supports
- where: packages/ui/src/components/heldItem.ts:21-35 (useHeldAriaRef)
- scenario: packages/ui promises `react >=18`. React 18 ignores a ref callback's returned cleanup and calls the old ref with `null` instead.
  - When a Select, ComboBox or Tabs row goes from held to free, the old callback gets `null` and returns early, and the new one returns at `!held`.
  - `aria-disabled`, `data-disabled` and `aria-description` stay on the row, so it stays dimmed and announced as disabled while it is actually selectable.
- evidence: read
- severity: low

## A stack menu's disabled rows drop their reason
- where: packages/ui/src/components/ToolRail/RailStack.tsx:36-46 (entries)
- scenario: a stack with a member the current mode doesn't allow. Its menu row is `disabled: true` without `disabledReason`, though `MenuItemEntry.disabledReason` exists (packages/menu/src/entries.ts:17). The same tool as a lone button shows "disabled in view mode" in its tooltip.
- evidence: read
- severity: low

## `<TooltipTrigger defaultOpen>` swallows Escape pressed elsewhere
- where: packages/ui/src/components/Tooltip/Tooltip.tsx:49-51 (TooltipTrigger)
- scenario: the internal `open` state starts at `false` whatever `defaultOpen` says, and only `onOpenChange` updates it. While a tooltip opened by default is showing, `useEscapePassesThrough` is off, so an Escape pressed in an editor or on the canvas is stopped at the document. The component promises that it passes through.
- evidence: read
- severity: low

## RailStack forgets its last-used member when its first shown member changes
- where: packages/ui/src/components/ToolRail/ToolRail.tsx:85 with packages/ui/src/components/ToolPalette/ToolPalette.tsx:147
- scenario: the palette sets a stack's id to `slot.members[0].id`, and the rail keys `RailStack` on it. With `ineligible="hide"`, a mode switch that hides the stack's first tool changes the key and remounts the stack. Its `last` state is lost, so the face reverts to the new first member, and an open menu closes.
- evidence: read
- severity: low

## Files read
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

<!-- done: 8 findings, files read: 37 -->