---
'@weasel-js/text-dom': patch
'@weasel-js/core': patch
---

text-dom: a new package holding in-place text editing, moved out of core. `useTextEdit` mounts a contenteditable overlay over a box on screen and commits styled runs; `runsToDom`, `domToRuns`, `charOffsetToDomPosition`, and `domPositionToCharOffset` convert between runs and the overlay's DOM. The types `TextEditScreenPose`, `TextEditClipRect`, `TextEditCommit`, `TextEditSelection`, `StartEditOptions`, `UseTextEditOptions`, `UseTextEditReturn`, and `StyleToggle` come with it, as does `TEXT_EDIT_FONT_HOLD`. It depends on `@weasel-js/text`, `@weasel-js/font`, `@weasel-js/paint`, and `@weasel-js/react`, needs React, and has no scene.

The `text-dom@1.9.4` seeded on npm exports `overlayTop` and `baselineDrop`, which are internal; this release takes them off the entry. `@weasel-js/core` still exports every name it did before, and `useSceneTextEdit` stays in core.
