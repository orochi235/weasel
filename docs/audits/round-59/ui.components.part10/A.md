Permission to write `.skulkr/out/findings.md` was refused after the first entry, so the file on disk holds only finding 1. The full document is below.

# Findings — ui.components.part10

## ToolPalette never subscribes to `modeRegistry`, so after a mode switch its buttons are still dimmed or hidden for the old mode
- where: packages/ui/src/components/ToolPalette/ToolPalette.tsx:117,125 (ToolPaletteRail)
- scenario: mount `<ToolPalette modeRegistry={reg} />`, then switch the mode through `reg`. `allowed()` and `disabledReason` read `modeRegistry.current()` only during render, and nothing subscribes to `reg.subscribe` / `getVersion`. The palette keeps showing the previous mode's eligibility: tools the new mode forbids stay clickable, tools it allows stay inert or hidden, and the reason text names the old mode. This lasts until something unrelated re-renders the palette. It should re-render whenever the registry notifies.
- evidence: read (no subscription anywhere in the file; the tests cover only the mode at mount)
- severity: high

## `useTimelinePlayback` treats a finished timeline with a numeric `loop`, or one played backward, as still playing, and its frame loop never stops
- where: packages/ui/src/components/Transport/useTimelinePlayback.ts:8-11 (isAdvancing)
- scenario: a timeline created with `loop: 3` (three passes; `lapsOf`, `packages/animator/src/timeline/playhead.ts:8`), or `loop: 1` / `loop: 0`, which are one pass, runs to its end. `handle.loop() !== false` counts any number as endless. `playing` stays true, so the button shows Pause for a stopped timeline, and the rAF callback re-requests itself every frame until unmount. A negative `timeScale` that has rewound to 0 does the same, because `time() < duration()` is true. The check should test laps left and direction.
- evidence: read
- severity: medium

## ToolPalette's `carryTool` / `onToolDragStart` are silently dropped for every tool inside a stack
- where: packages/ui/src/components/ToolPalette/ToolPalette.tsx:139-141,147; packages/ui/src/components/ToolRail/RailStack.tsx:60-71
- scenario: `<ToolPalette stacks={[['rect','ellipse','star']]} carryTool={…} onToolDragStart={…} />`. The palette builds each member's `onPointerDown` / `onDragStart` / `carrySource` class, but `RailStack` uses only `onPress` (`items.ts:35-36`). The stack button is neither a carry source nor draggable. The prop docs promise "each tool's button", and the default `stacks` from an `include` set turns this on with no visible sign.
- evidence: read
- severity: medium

## ButtonTooltip remounts its button when a reason first gives it tooltip content, so the focused button loses focus
- where: packages/ui/src/components/Tooltip/buttonTooltip.tsx:88-95 (ButtonTooltip)
- scenario: `<Button disabled={saving} disabledReason="Saving…">Save</Button>` with no shortcut or tooltip. Enabled, the content is undefined and the bare `<button>` is returned. Held, the content is "Save: Saving…" and the button is wrapped in `TooltipTrigger` / `Focusable`. The element type at that position changes, so React remounts the focused button and focus falls to `<body>` right after the press. The comment at :89 claims the button is not remounted; that holds only when both states have content.
- evidence: read
- severity: medium

## Play does nothing on a timeline that finished playing backward
- where: packages/ui/src/components/Transport/useTimelinePlayback.ts:46-50 (onPlayingChange)
- scenario: a handle with `timeScale() < 0` finishes at 0. On Play, the rewind checks only `time() >= duration()`, so there is no seek. `resume()` → `rearm` then declines because `pos.atEnd(wantScale() < 0)` is true at 0 (`packages/animator/src/timeline/createTimeline.ts`, rearm). The press is lost. It should seek to `duration()` when the scale is negative.
- evidence: read
- severity: low

## A stack's button remounts and forgets its last-used member when its first shown member changes
- where: packages/ui/src/components/ToolPalette/ToolPalette.tsx:147 (`id: slot.members[0].id`); packages/ui/src/components/ToolRail/RailStack.tsx:29
- scenario: stack `['rect','ellipse','star']`. The user picks star, then another tool, so the face shows star. `include` or `ineligible="hide"` then drops `rect`. The key becomes `ellipse`, so `RailStack` remounts, `last` resets, the face jumps to ellipse, and focus is lost if the button held it.
- evidence: read
- severity: low

## A button held for a reason stays draggable, where a natively disabled one does not
- where: packages/ui/src/components/Tooltip/buttonTooltip.tsx:43-56 (stillReachable)
- scenario: `<ActionButton disabled disabledReason="Locked" onDragStart={…} />`. ActionButton sets `draggable` and `onDragStart` (`ActionButton.tsx:112`). `stillReachable` drops the press handlers but keeps both, so the held button still starts a drag and runs `onDragStart`. Disabled without a reason, the same button is natively disabled and cannot be dragged.
- evidence: read
- severity: low

## The Transport scrub bar speaks the absolute playhead whatever `timeReadout` / `formatTime` say
- where: packages/ui/src/components/Transport/Transport.tsx:185 (Transport)
- scenario: `start={5000} playhead={5000} duration={10000} timeReadout="elapsed" onSeek={…}`. The readout shows "0.00s / 10.00s", but the slider's `valueText` says "5.00 seconds". A `formatTime` is ignored the same way, so the screen shows one time and a screen reader speaks another.
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