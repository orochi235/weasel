## useModeTargetLabel never re-reads the target's label or text after the mode opens, so the breadcrumb goes stale
- where: apps/draw/src/modality/useCanvasModes.ts:64-74 (useModeTargetLabel)
- scenario: Enter path-edit (or text-edit) on a node labelled "Star", then rename it from the layers panel, or change the text of the node text-edit is open on. `useModeId` re-renders only when the mode changes, and the `useMemo` is keyed on `[targetId, scene]`, both unchanged, so it keeps returning "Star" (or the text as it was when the edit opened) until the mode closes. The breadcrumb should name the node as it is now. `useEnteredGroupLabel` (enteredGroup.ts:33-45) handles the same question by subscribing to `scene` and reading on every change, so the two breadcrumb labels give the same answer two different ways: the group's follows a rename and the mode target's doesn't.
- evidence: read
- severity: low

## enterModeOn treats "same target" as "already there" whatever mode is asked for, so a different mode on the same node is silently dropped
- where: apps/draw/src/modality/enterModeOn.ts:12 (enterModeOn)
- scenario: The machine is in soft mode A (say `text-edit`) on node X, and a caller asks for mode B (`path-edit`) on X, for example the path-edit host's `open(X)` (pathEditHost.ts:19). `getActiveTargetId() === targetId` returns early, so the machine stays in A and the request is a no-op, even though the doc says only "Already there changes nothing", which means being in `modeId` on `targetId`. The check should also compare `current.id === modeId`, and otherwise exit the soft mode and enter B, as it already does for a different target. useTextEditSession.ts:47 has the same problem in the other direction: a text edit opening on the node path-edit is on leaves the machine in path-edit, and `open.current` names a node that `inModeOn` never matches.
- evidence: read
- severity: low

## Files read
apps/draw/src/modality/chrome/ModeBreadcrumb.module.css
apps/draw/src/modality/chrome/ModeBreadcrumb.tsx
apps/draw/src/modality/chrome/ModeStatusIndicator.tsx
apps/draw/src/modality/enterModeOn.ts
apps/draw/src/modality/enteredGroup.ts
apps/draw/src/modality/index.ts
apps/draw/src/modality/machine.ts
apps/draw/src/modality/modeScope.ts
apps/draw/src/modality/pathEditHost.ts
apps/draw/src/modality/shortcuts.ts
apps/draw/src/modality/useCanvasModes.ts
apps/draw/src/modality/useModality.ts
apps/draw/src/modality/useModeId.ts

<!-- done: 2 findings, files read: 13 -->
