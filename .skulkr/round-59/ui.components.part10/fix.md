ToolPalette ignores mode switches (A+B, first finding in each): fixed 6debb195cb

Playback treats a finished numeric-`loop` timeline as still playing (A): not a defect. `handle.loop()` returns the passes left, and it reads `false` once the last pass is under way (`playhead.ts:90`), so `isAdvancing` is right for counts.

Playback treats a backward timeline that reached 0 as still playing, and its frame loop spins (A+B): fixed ad9a43c596

ToolPalette drops `carryTool` and `onToolDragStart` for stacked tools (A+B): fixed 1e56aa3245. The stack's button now takes the shown tool's pointer, drag and class fields. A carry swallows the click its release sends, so a stack opens no menu when a carry ends. This replaces the old `carried()` flag.

ButtonTooltip remounts the button when a reason first gives it a tooltip (A): fixed 6eb27c1d52

Play does nothing on a timeline that finished playing backward (A+B): fixed 1fab9d92c5

A stack's button remounts and forgets its last-used tool when its first shown tool changes (A): fixed b4cfd6ec08

A button held for a reason stays draggable (A): fixed ba6a4b7270

The scrub bar speaks the absolute playhead whatever `timeReadout` and `formatTime` say (A): fixed 0050af5f09

ToolPalette goes stale on a mode switch (B): duplicate of the first finding, A's mode-registry finding (fixed 6debb195cb).

ToolPalette drops carry and drag for stacked tools (B): duplicate of A's stack carry finding (fixed 1e56aa3245).

A negative time scale reads as playing, Play declines, and the rate shows as "-1x" (B): the first two parts are duplicates of ad9a43c596 and 1fab9d92c5. The rate part is fixed in 94f5a2df85: the transport now shows a negative scale as the reverse switch plus a positive rate. Its changeset is `minor` and tagged `fix new`, because the switch now appears on `AnimatedTransport` and `AnimatedTimeline`.

Playback never hears `edit` (B): fixed f3336d74c4

`useHeldAriaRef` never clears its marks under React 18 (B): fixed c9f4318266. The test drives the React 18 ref protocol by hand, since React 19 is what is installed here.

A stack menu's disabled rows drop their reason (B): fixed fd06c825d7

`<TooltipTrigger defaultOpen>` swallows Escape pressed elsewhere (B): fixed 51d4ab4b48

A stack forgets its last-used tool when its first shown tool changes (B): duplicate of A's stack remount finding (fixed b4cfd6ec08).

Extra:
- `TriggerTooltip` remounts a `Select` trigger, and drops its focus, when the trigger first gains a tooltip (sweep): fixed 5adc75460d. Same mistake as ButtonTooltip's.

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`: pass for `Select.test.tsx`, `ToolPalette.stacks.test.tsx`, `ToolPalette.test.tsx`, `Tooltip.test.tsx`, `buttonTooltip.test.tsx`, `Transport.test.tsx`, `useTimelinePlayback.test.tsx` and `heldItem.test.tsx`.
- Neighboring directories, `ActionButton`, `Bar`, `Button`, `MenuButton`, `Segmented`, `ToggleChips`, `Tooltip`, `ToolRail`, `ToolPalette`, `Select`, `ComboBox`, `Tabs` and `Timeline/AnimatedTimeline`: pass.
- Unrun browser tests: `ToolPalette.stacks.browser.test.tsx` and `Transport.browser.test.tsx` (`*.browser.test.*`, cannot run here).
- `npm run checks:gate`: pass, "all 32 passed". The first run failed `check:changesets` on four titles over 140 characters and one wrong level; I fixed each inside its own commit.
- `npm run lint -w @weasel-js/ui`: fail, "Missing script: lint". The package has no lint script; the root `npm run lint` passed inside the gate.
- The tree is clean.

tally: 13 of 16 fixed, 1 extra fixed