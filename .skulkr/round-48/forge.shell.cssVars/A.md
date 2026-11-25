## A theme save that resolves after the focused trial changes resets the new trial's overrides
- where: packages/forge/src/shell/cssVars/useThemeSave.ts:104 (save)
- scenario: `FocusedCssVars` renders one `CssVarsPanel` instance for whichever trial is focused (no `key`), so a trial switch keeps the hook instance and only changes `TrialIdContext`. Click "Save to theme" on trial A, then focus trial B before the GET/PUT round trip finishes. The awaited closure calls the old `history.current()` and `history.reset()`, but those read the shared refs (`rendered`, `ahead`, `latestApply` in `varsHistory.ts`), which now hold trial B's state and trial B's `apply`. So trial B's persisted overrides lose every name A saved, `vars.set null` goes to B's frame, and no undo step is recorded for it. Meanwhile the closure's `setStored(null)` clears A's history while A's own overrides are never removed, so A goes on showing the saved values as unsaved edits. `saving` also carries over, so B's Save button shows loading. The save should apply its reset to the trial it was started for, or drop the reset when `trialId` has changed.
- evidence: read (usePersistedState binds its setter to the render's trial key; `useVarsHistory`'s `current`/`emit` read refs shared across trials)
- severity: medium

## An edit made while a save is in flight is dropped if it touches a token the save wrote
- where: packages/forge/src/shell/cssVars/useThemeSave.ts:99-108 (save)
- scenario: Edit `--wzl-accent` to `#f00` and click Save. While the PUT is pending (the button is disabled, but the token fields are not), change `--wzl-accent` to `#0f0`. When the save returns, `saved` is computed from names alone and `history.reset` filters `history.current().overrides` by those names. The override holding `#0f0` is removed and the history is cleared, while the file holds `#f00`. The newer edit is lost, and it cannot be undone back. The reset should keep an override whose value differs from the one that was saved.
- evidence: read
- severity: medium

## A scale edit outlives its steps' overrides and is later shown, and then saved, as if it were current
- where: packages/forge/src/shell/cssVars/useVarsEdits.ts:36 (write); packages/forge/src/shell/cssVars/useThemeSave.ts:103 (save)
- scenario: Edit the font-size scale (`edited['type…'] = {base: 16, …}`, every step overridden), then reset one step and press Save. `unsavedScales` skips the scale because a step is no longer overridden. The remaining step overrides are each saved as token pins and removed. But `groups` holds only the saved scales, so `edited[group]` stays. (Resetting every step by hand with `write(name, null)` leaves it the same way, since `write` never touches `scales`.) Later, hand-edit one font-size step: `scalesFor` sees an overridden step and shows the stale `{base: 16}` edit instead of the scale the steps stand at. If every step gets overridden by hand again, `unsavedScales` returns that stale edit, and Save writes `base: 16` into `seeds.ui-base` even though the user discarded it. An edit should be dropped once none of its group's steps is overridden, and on a save that pins or removes its steps.
- evidence: read
- severity: low

## SectionJump finds the panel through two different lookups, and jumping fails where reading works
- where: packages/forge/src/shell/cssVars/SectionJump.tsx:79 (jump) vs :43 (effect)
- scenario: The effect falls back to `document.body` when the bar is not inside `.lk-sidebar-section, .lk-panel-tile`, so the icons light up and enable from the panel it finds there. `jump` uses `ref.current?.closest(HOST)?.querySelector(PANEL)` with no fallback, so in that same host every click returns early and nothing scrolls. Both should resolve the root the same way.
- evidence: read
- severity: low

## A picked section stays lit after scrolling with the scrollbar
- where: packages/forge/src/shell/cssVars/SectionJump.tsx:20 (MANUAL)
- scenario: After a jump sets `held`, only `wheel`, `touchmove` and `keydown` release it. Dragging the list's scrollbar thumb, or middle-click autoscroll, scrolls by hand without any of those events. `read` keeps returning early while `held` is set, so the bar keeps lighting the picked section while a different one is at the top. The comment says the hold should end when the reader scrolls by hand. A `pointerdown` on the scroller would also release it.
- evidence: read
- severity: low

## Files read
packages/forge/src/shell/cssVars/CssVarsPanel.tsx
packages/forge/src/shell/cssVars/SectionJump.tsx
packages/forge/src/shell/cssVars/cssVars.css
packages/forge/src/shell/cssVars/cssVarsChrome.ts
packages/forge/src/shell/cssVars/overrides.ts
packages/forge/src/shell/cssVars/reveal.ts
packages/forge/src/shell/cssVars/saveScales.ts
packages/forge/src/shell/cssVars/saveTokens.ts
packages/forge/src/shell/cssVars/themeScales.ts
packages/forge/src/shell/cssVars/useStoryTokens.ts
packages/forge/src/shell/cssVars/useThemeSave.ts
packages/forge/src/shell/cssVars/useThemeTokens.ts
packages/forge/src/shell/cssVars/useTrialSelection.ts
packages/forge/src/shell/cssVars/useVarsEdits.ts
packages/forge/src/shell/cssVars/varsHistory.ts

<!-- done: 5 findings, files read: 15 -->
