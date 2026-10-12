---
'@weasel-js/ui': patch
'@weasel-js/text-dom': patch
---

Adds API: `CharacterOptions` in `@weasel-js/ui`, the strip of character controls for a text edit in progress. It draws the options the text tool declares (`useTextTool.options`) from a `RangeStyle`, shows a control's mixed state where the range disagrees, and reports each edit as a `RunStylePatch`. `isCharacterChrome` is the matching `isEditorChrome` for `useTextEdit`: it claims the strip and any kit popover one of its controls opens, so using the strip does not end the edit.

Adds API: `useTextEdit` and `useSceneTextEdit` return `effectiveStyle`, what a styling control shows during an edit — the node's style and paint, the range's styling over it, and the styling armed for the next character last. It is `null` outside an edit. A strip is wired with `<CharacterOptions style={edit.effectiveStyle} onPatch={edit.applyStyleToSelection} />`.
