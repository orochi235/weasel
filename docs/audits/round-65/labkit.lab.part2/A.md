# Audit round 65 — labkit.lab.part2 findings

## `LabBaseProps.mode` says a stored lab keeps its last-switched mode over the prop, but the prop overwrites it at mount
- where: packages/labkit/src/lab/labProps.ts:36 (`LabBaseProps.mode` doc); behavior in packages/labkit/src/lab/Lab.tsx:132 (`useHeldProps`)
- scenario: `<Lab storageKey="k" mode="light">`; the user switches the lab to Dark (stored as `mode: 'dark'`) and reloads. `openStoredLab` opens the store at the stored `'dark'`, then `useHeldProps`'s mount effect sees `mode ('light') !== store mode ('dark')` and calls `setMode('light')`. The lab opens Light and the stored choice is overwritten. The doc promises the stored mode wins and that `mode` is "read once, at mount"; the code also follows every later change of the prop. One of the two is wrong; as written, consumers following the doc lose the user's choice on every reload.
- evidence: read
- severity: medium

## `labChrome` doc still says gaining a first sidebar contribution remounts the workspace and every trial
- where: packages/labkit/src/lab/labProps.ts:74 (`LabBaseProps.labChrome` doc)
- scenario: The doc tells consumers "Going from no sidebar contributions to some remounts the workspace and every trial, dropping unpersisted trial state." Commit d994b53c78 ("keep a lab's trials mounted while its sidebar or aside pane comes and goes") made `LabPanes`/`LabPage` always render both splits, so no remount happens. A consumer reading the doc works around a remount that no longer exists (e.g. keeps a placeholder sidebar contribution mounted).
- evidence: read (git show d994b53c78)
- severity: low

## Lab chords read the global `document.activeElement`, not the lab's own document
- where: packages/labkit/src/lab/labChords.ts:49 (`ownerNow`)
- scenario: A lab rendered (via portal) into another window's document — the case `useFramed` and `useFocusPick` already handle by reading `labBody.ownerDocument` — with focus inside trial B while the lab's focused trial is A. `document.activeElement` is the opener's element (outside every trial), so `owningTrial` returns null and Mod+Z / Shift+Mod+Z / Mod+S go to the focused trial A instead of B, where the key was typed. Should read the active element of the document the key event landed in (or the lab body's `ownerDocument`).
- evidence: read
- severity: low

## Incoming `messages.origins` check compares raw strings while outgoing posts normalize them
- where: packages/labkit/src/lab/presentationMessages.ts:142 (`usePresentationMessages` onMessage)
- scenario: `messages={{ origins: ['https://host.example/'] }}` (trailing slash, or any URL with a path). `host.postMessage(state, 'https://host.example/')` delivers — `postMessage` parses the target to its origin — so the host receives `labkit:state`. But every command it sends arrives with `event.origin === 'https://host.example'`, which `targets.includes(event.origin)` rejects, so play/pause/seek/query are silently dropped. The same option is answered two ways; normalize each entry with `new URL(o).origin` (keeping `'*'`) before both uses. Also, `origins: ['*']` posts state to anyone but accepts no command, since no event origin is `'*'`.
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

<!-- done: 4 findings, files read: 30 -->
