# Audit round 50 — labkit.lab.part2

## Uninstalling one `useLabAmbient` caller removes every caller that installed the same array
- where: packages/labkit/src/lab/labAmbient.ts:34 (useLabAmbientHost → host.install's uninstall)
- scenario: two components under one lab call `useLabAmbient(KEYMAP)` with the same hoisted array. The docs ask callers for exactly that ("Pass a stable array"), and two trials of one instrument installing that instrument's module-level keymap is the obvious case. Each `install` pushes the same reference onto `installed`. When one of them unmounts, its uninstall runs `prev.filter((e) => e !== entries)`, which drops **both** copies. `entriesById`, and with it the lab dispatcher's bindings and `useLabEntries()`, then lose the keymap while the surviving caller is still mounted, and its actions are still registered on the registry. Uninstall should remove only its own install, for example by wrapping each install in a fresh token object or splicing out one index.
- evidence: read
- severity: medium

## A presenting lab blanks the host page's root and body background and resets its color-scheme even when it is not in an iframe
- where: packages/labkit/src/lab/presentation.less:3 (`:root:has(.lk-lab--present)`)
- scenario: a page renders `<Lab present>` inline rather than in a frame, which is supported: presentationMessages documents `window.postMessage` "for one in the page itself", and `gestures` exists to "let the page scroll past an embed". The rule matches the embedding page's own `:root` and sets `color-scheme: normal; background: transparent` on it and `background: transparent` on its `body`. A dark host page loses its background, and its native controls and scrollbars switch to the light scheme, for as long as the embed presents. The comment explains the rule only for an iframe whose document the lab owns. The override should apply only when the lab is that document's whole content, for example gated on the lab being framed, not to whichever page contains the lab.
- evidence: read
- severity: medium

## `presentation.enter()` in a lab with no focused trial hides the lab's chrome and presents nothing
- where: packages/labkit/src/lab/presentation.tsx:108 (useLabPresentation → enter)
- scenario: `usePresentation().enter()` is public API, documented as "Present the focused trial". It sets `presentedBy` whether or not a trial is focused. In a trialless lab (`instruments` empty, so `focusedTrialId` is null), `active` becomes true and `trialId` stays null. `lk-lab--present` then hides the shell header, footer and palette region, and no `[data-lk-presented]` element exists to fill the body. The lab loses its header, menus and history buttons for a "presentation" of nothing until Escape. `enter` should be a no-op, or report that it is unavailable, while `focusedTrialId` is null.
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
