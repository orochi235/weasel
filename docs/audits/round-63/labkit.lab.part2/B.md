# Audit round 63 — labkit.lab.part2 findings

## `labkit:play` does not start an ended non-seekable run over, unlike the play button it claims to match
- where: packages/labkit/src/lab/presentationMessages.ts:107 (run)
- scenario: a presented trial whose clock is not seekable (a `step`-driven or live clock) plays to its end; the host page posts `{ type: 'labkit:play' }`. `run` builds `transportControl(handle.clock, hold.get(), hold.set)` with no `reset` argument, so `play()` sees `playedOut` and `!clock.seekable`, calls `reset?.()` → nothing, and sets the rate on a clock that stays ended. The play button (`useTransportControl`, clock/useTransportControl.ts:24) passes `handle?.reset` and restarts the run. The type's own doc ("As the play button: an ended run starts over", presentationMessages.ts:17) says the message should restart it. Should pass `handle.reset` (and `hold.touch`) like the transport does.
- evidence: read
- severity: medium

## A presented lab in dark mode still paints the starfield over the page it hands its ground back to
- where: packages/labkit/src/lab/presentation.less:13 (`.lk-lab--present`)
- scenario: `<Lab present>` (or `?present`, or a `still` poster) resolving to dark mode, embedded in a host page. `.lk-lab--present` clears `--wzl-backdrop` and sets `background: transparent` so the embedder shows through (and `:root:has(.lk-lab--framed)` makes the frame's root transparent for the same reason), but nothing hides `.lk-lab::before` (theme/base.less:88): an absolutely positioned, `inset: 0`, `z-index: 0` layer of white radial-gradient stars, hidden only under `[data-wzl-mode='light']`. The presented trial's stage, canvas well and stage are all made transparent, so the stars show through over the host page's own background, and land in every dark poster. Should `display: none` the `::before` under `.lk-lab--present`, as light mode does.
- evidence: read (presentation.less, theme/base.less:79–127, styles.less import order)
- severity: medium

## The lab fit warning measures the global `document`, not the lab's own
- where: packages/labkit/src/lab/fitCheck.ts:82 (explainLabScroll), fitCheck.ts:111 (useLabFitWarning)
- scenario: a lab rendered into another document than the script's (a portal into a popout window or same-origin frame — the case `useFocusPick`, `useStill` and `useLabPresentation` handle by reading `labBody.ownerDocument`). `useLabFitWarning` watches `document.documentElement` and `explainLabScroll` tests `document.scrollingElement` of the opener, so a lab that scrolls its own window is never reported and the opener page's scroll is blamed on the lab instead. Should use `lab.ownerDocument`.
- evidence: read
- severity: low

## Files read
packages/labkit/src/lab/TriallessPage.tsx
packages/labkit/src/lab/UnreadableRecords.tsx
packages/labkit/src/lab/Workspace.less
packages/labkit/src/lab/Workspace.stories.less
packages/labkit/src/lab/Workspace.stories.tsx
packages/labkit/src/lab/Workspace.tsx
packages/labkit/src/lab/fitCheck.ts
packages/labkit/src/lab/index.ts
packages/labkit/src/lab/keyClaims.ts
packages/labkit/src/lab/labAmbient.ts
packages/labkit/src/lab/labChords.ts
packages/labkit/src/lab/labChromeAll.ts
packages/labkit/src/lab/labContextMenus.ts
packages/labkit/src/lab/labMenus.ts
packages/labkit/src/lab/labModes.ts
packages/labkit/src/lab/labProps.ts
packages/labkit/src/lab/nebula.ts
packages/labkit/src/lab/openLab.ts
packages/labkit/src/lab/owningTrial.ts
packages/labkit/src/lab/panelHost.ts
packages/labkit/src/lab/presentation.less
packages/labkit/src/lab/presentation.tsx
packages/labkit/src/lab/presentationMessages.ts
packages/labkit/src/lab/snapshotCommands.ts
packages/labkit/src/lab/still.ts
packages/labkit/src/lab/storeCommands.ts
packages/labkit/src/lab/tileChrome.tsx
packages/labkit/src/lab/trialless.ts
packages/labkit/src/lab/useFocusPick.ts
packages/labkit/src/lab/workspaceStore.ts

<!-- done: 3 findings, files read: 30 -->
