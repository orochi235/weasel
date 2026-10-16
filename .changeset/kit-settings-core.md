---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/react': patch
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
'@weasel-js/labkit': patch
---

Kit settings for gestures, targets, the camera, orbit and the loupe. Under a `<KitSettingsProvider>` a consumer can now set `gestures.doubleClickMs`, `doubleClickPx`, `longPressMs`, `tapPx` and `dragPx` (read by the dispatcher, the move action and `useDragHandle`; an explicit `longPress` prop or `dragThresholdPx` param still wins); core's `targets` leaves `handlePx`, `anchorHitPx` and `rotationDistancePx` (the base that device scaling multiplies, under an explicit `handleHitRadius`), `segmentHitPx`, `anchorClickPx`, `pickTolerancePx` (under `geometry.pickTolerancePx`), and the pen, bone, weight and slice overlay dot radii; `view.animationMs` (under a move's own `ms`); `orbit3d.orbitRate` and `dollyRate` in kernel3d; and `loupe.wheelRate` in labkit. `coreKitSettingsSchema`, `kernel3dKitSettingsSchema` and `labkitKitSettingsSchema` describe these as prefs groups whose paths are the settings' paths, each default being the existing constant. Underneath: `createPointerRecognizer` takes `doubleClickMs`, `doubleClickPx`, `tapPx` and `dragPx` thunks; `<SceneCanvas>` publishes the provider's store as the `kitSettings` dep; `targetSizesPx` and `mergeLayersWithDefaults` take optional base sizes; `createPenPreviewLayer`, `createBoneOverlay` and `createWeightOverlay` take optional size readers; `@weasel-js/react` declares `KitTargetSettings`, the shared `targets` area. Additive.
