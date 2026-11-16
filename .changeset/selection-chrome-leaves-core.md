---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

The selection chrome moves to `@weasel-js/editing`: the outline, resize handles and rotate badge it paints, and the handles a press grabs.

This is breaking. A canvas with no editing preset paints nothing in the `selectionOverlay` slot and grabs no resize or rotate handle; a layer of the consumer's own in that slot still paints. `outlinePreset`, `resizePreset` and `rotatePreset` include the new `selectionChromePreset`, which hands the canvas `SELECTION_CHROME` through the new `FeaturePreset.selectionChrome` role, so a canvas using them changes nothing.

From editing, under the same names: `createSelectionOverlayLayer`, `createSelectionOutlineLayer`, `createSelectionHandlesLayer`, `composeSelectionPose`, `ComposeSelectionPoseOptions`, `createCornerResizeAffordance`, `CornerResizeAffordanceOptions`, `CornerResizeScratch`, `createRotationAffordance`, `RotationAffordanceOptions`, `RotationScratch`, `rotationHandle`, `hitRotationHandle`, `DEFAULT_ROTATION_HANDLE_DISTANCE` and `RotationHandle`. Core keeps the slot's option types (`SelectionOverlayLayerOptions` and the rest), the affordance mechanism, the path-anchor affordances and chrome-caps, and adds `SelectionChrome` and `SelectionChromeSizes` for a preset drawing chrome of its own.

<!-- entry: rank=10 breaking api -->
