Note: commit 7c016ebfdf6a5facdd58c7d93e390fdfdd4ffe84 is not in this repository (`git cat-file` fails). The listed
files were read at HEAD d057251407, where the area has no uncommitted changes.

## A save that resolves after the focused trial changes resets the new trial's overrides and clears the old trial's history
- where: packages/forge/src/shell/cssVars/useThemeSave.ts:104 (save), with packages/forge/src/shell/cssVars/varsHistory.ts:45-51,92-96 (current/emit/reset)
- scenario: Trial A has a scale edit. Press "Save to theme", then focus trial B before `api.get`/`api.put` resolve. `FocusedCssVars` does not key `CssVarsPanel` by trial, so the same instance re-renders for B. When the save finishes, the `save` closure still holds A's `history` object. But `history.current()` reads the `rendered`/`ahead` refs, which now hold B's state, and `reset` → `emit` calls `latestApply.current`, whose `setOverrides`/`setEdited`/`send` belong to B. So B loses every override whose name A saved (including B's own values for those tokens), with no undo entry, and B's frame gets `vars.set … null` for them. Meanwhile `history.clear()` and `setStored(null)` run on A's history and record, and A keeps the overrides that were just saved. `saving` is not keyed by trial either, so while A's save is in flight B's Save button shows as loading and disabled. The intended behavior is that the reset applies to A, the trial whose edits were saved, or is skipped if A is gone.
- evidence: read
- severity: medium

## Edits made while a save is in flight are thrown away when it resolves
- where: packages/forge/src/shell/cssVars/useThemeSave.ts:99-108 (save)
- scenario: Press "Save to theme" with a font-size scale edit (base 14). While `api.put` is pending, drag the scale again to base 16; only the Save button is disabled, not the panel. When the put resolves, `saved` still lists the font-size step names from the scales captured at click time. `reset` filters `history.current()` by name only, so it drops the newer base-16 overrides and the base-16 scale edit, which were never written. It also clears the history, so the edit cannot be undone or redone. The trial falls back to the saved base-14 values. The reset should drop only overrides whose value still equals what was saved, and only scale edits equal to the saved `edit`.
- evidence: read
- severity: medium

## The panel's history is opened once per trial, so another tab's edits are overwritten and reverted by undo
- where: packages/forge/src/shell/cssVars/varsHistory.ts:55-69 (useVarsHistory)
- scenario: `usePersistedState` re-renders when another tab changes a record. Overrides and the serialized history follow those changes, but the `createHistory` instance is built only when `trialId` changes and never re-reads `stored`. Example: tabs 1 and 2 show the same trial. Tab 1 edits `--wzl-gray-50`, then tab 2 edits `--wzl-bg`. Tab 2's history knows nothing of tab 1's entry, and `keep()` writes tab 2's serialization over the stored history, so tab 1's step is lost. An undo in tab 1 then emits its stale whole-state `before` snapshot, which also wipes tab 2's `--wzl-bg` override. Either re-open the history from `stored` when it changes from outside, or don't persist it across tabs.
- evidence: read
- severity: low

## "Commits in one tick are one step" fails when `history.coalesceMs` is 0
- where: packages/forge/src/shell/cssVars/varsHistory.ts:22,76-84 (commit)
- scenario: The same-tick merge works only through the op-level `coalesceKey`. The history's `canCoalesce` (packages/history/src/recording.ts:38) refuses any merge when `windowMs` is not > 0. With the kit setting `history.coalesceMs: 0` (no coalescing of separate edits), several `write`/`editScale` calls in one handler become separate undo entries. One Undo then reverts only part of what one user action did, which contradicts the interface's own contract.
- evidence: read
- severity: low

## The section jump stays lit on a picked section after the list is scrolled other than by wheel, touch or key
- where: packages/forge/src/shell/cssVars/SectionJump.tsx:38-62,83 (SectionJump)
- scenario: Pick "Motion" in the jump bar (`held = true`). Then click a token link in a lens readout: `useRevealToken` calls `scrollIntoView` on a color row. Or drag the list's scrollbar. Neither is a wheel, touchmove or keydown event, so `held` stays true and `read` never updates `current`. The bar keeps lighting Motion while the list shows Color, until the next wheel or keystroke anywhere in the document.
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
