## The mode breadcrumb's target label never updates when the target's label or text changes during the mode
- where: apps/draw/src/modality/useCanvasModes.ts:66 (useModeTargetLabel)
- scenario: enter text-edit on an unlabeled text node (breadcrumb shows its text, e.g. "Hello"), then type "Hello world" — or rename a node's label from the inspector while path-edit is open on it. The hook subscribes only to the mode registry (`useModeId`) and memoizes on `[targetId, scene]`, so the label stays "Hello" until the target id changes; even an unrelated re-render returns the memoized stale string. The entered-group label beside it (`useEnteredGroupLabel` in enteredGroup.ts) subscribes to the scene and updates, so the two breadcrumb labels answer "when is the label re-read" two different ways.
- evidence: read
- severity: medium

## enterModeOn treats "already on this target" as "already in this mode", whatever mode is asked for
- where: apps/draw/src/modality/enterModeOn.ts:12 (enterModeOn)
- scenario: a soft mode is open on node X and a caller asks for a different soft mode on the same X (e.g. path-edit open on X, then `useTextEditSession`'s onStart calls `enterModeOn(machine, 'text-edit', X)`, or the reverse via the path-edit host's `open`). The guard `getActiveTargetId() === targetId` returns early without checking `current.id === modeId`, so the machine stays in the old mode and the requested one is never entered; the doc comment says only "already there changes nothing", i.e. same mode and target. In the text case the edit opens with the machine still in path-edit, so `onEnd`'s `inModeOn` check fails and path-edit is left open after the edit ends.
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
