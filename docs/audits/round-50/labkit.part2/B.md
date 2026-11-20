I couldn't write `.skulk/out/findings.md` because the write was refused, so the whole findings document is below.

```markdown
## useTrialScene writes a Reset or an outside load back into state, because loadState's history 'clear' step is not skipped
- where: packages/labkit/src/scene/useTrialScene.ts:49 (useTrialScene, history observer), with the loadState calls at :63 and :69
- scenario: the scene holds any undo/redo entries. Then either (a) Reset sets `state.scene` to `null`, or (b) another tab's write or a Clone lands in `state.scene`. The effect calls `scene.loadState(...)`, which runs `recording.clearHistory()` (packages/core/src/core/scene/scene.ts:230). `history.clear()` sends a `'clear'` step whenever the stacks were non-empty (packages/history/src/history.ts:103-107). The observer returns early only for `'restore'`, so it runs `setState({ ...prev, scene: scene.toJSON() })`. In (a), `state.scene` is a new JSON object right after Reset instead of `null`, so the trial reads as edited. In (b), the receiving tab writes a new JSON object back, which is the echo the comment at :48 says must not happen. The tab that wrote first then loads that echo as an outside write, and its own loadState clears its undo history. It should skip `'clear'` as well as `'restore'`, since that step changes no node.
- evidence: read (loadState → clearHistory → 'clear' step traced through core and history; the effect on the other tab follows from the same code)
- severity: medium

## sceneTrialHistory.restore registers a fresh TRIAL_EDIT_OP handler on every call, so a second restore into the same scene throws
- where: packages/labkit/src/scene/sceneTrialHistory.ts:91 (sceneTrialHistory, restore)
- scenario: `restore` calls `scene.registerOp(TRIAL_EDIT_OP, { apply, revert })` with a new handler object each time. Core's op table returns early only when the same handler object is registered again; a different one throws `ExtensionConflictError` unless `replace` is passed (packages/core/src/core/scene/opTable.ts:109-111). useRestoredHistory restores once per saved object (packages/labkit/src/trial/useRestoredHistory.ts:72-75). So any second saved `undo.own` reaching a trial whose scene is still mounted throws inside an effect, through `restoringOwnUndo`, which does not catch: for example a record re-read with a new `undo` object, or the source being rebuilt after the `history` prop toggles off and on and then restoring. The restored history never loads and the error reaches React. It should register once per scene (a module-level handler keyed by scene, or `{ replace: true }`).
- evidence: read (the throw is confirmed in opTable.ts; the trigger that delivers a second saved object to a live scene is inferred, not run)
- severity: medium

## Files read
packages/labkit/src/overview/TrialOverview.tsx
packages/labkit/src/overview/index.ts
packages/labkit/src/passthrough/weasel-canvas.ts
packages/labkit/src/pbt.fixture.ts
packages/labkit/src/scene/TrialSceneCanvas.less
packages/labkit/src/scene/TrialSceneCanvas.tsx
packages/labkit/src/scene/index.ts
packages/labkit/src/scene/sceneResets.ts
packages/labkit/src/scene/sceneTrialHistory.ts
packages/labkit/src/scene/useSceneCamera.ts
packages/labkit/src/scene/useSceneToolSlot.ts
packages/labkit/src/scene/useTrialScene.ts
packages/labkit/src/styles.dev.ts
packages/labkit/src/styles.less
packages/labkit/src/test-setup.ts
packages/labkit/src/testing/lab.ts
packages/labkit/src/testing/lens.ts
packages/labkit/src/testing/liveTest.ts
packages/labkit/src/theme/Interstellar.stories.less
packages/labkit/src/theme/Interstellar.stories.tsx
packages/labkit/src/theme/base.less
packages/labkit/src/theme/index.ts
packages/labkit/src/theme/interstellar.ts
packages/labkit/src/tools/labTool.ts
packages/labkit/src/tools/types.ts
packages/labkit/src/undo/editStamp.ts
packages/labkit/src/undo/index.ts
packages/labkit/src/undo/stateOp.ts
packages/labkit/src/undo/useUndoKeys.ts
packages/labkit/src/vite/index.ts
packages/labkit/src/vite/labRoutes.ts

<!-- done: 2 findings, files read: 31 -->
```

<!-- done: 2 findings, files read: 31 -->