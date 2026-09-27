---
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

The text node's properties now cover every authored `TextStyle` field. Italic, underline, strikethrough, overline, superscript and subscript sit in one row of glyph toggles; Italic was a Normal / Italic dropdown, and superscript and subscript were missing. Alignment is drawn with glyphs, and reads a `start` / `end` alignment as the edge it paints at. New rows: Wrap, Direction, and the box's vertical alignment (`data.verticalAlign`, the field the `kit:text` painter and the editor already read). New glyphs: `textAlignLeft` / `Center` / `Right` and `textAlignTop` / `Middle` / `Bottom`.

Two schema additions make that possible and are general: `ToolPrefBoolean.encoding` (`ToolPrefBooleanEncoding`, `PrefBooleanEncoding` in `@weasel-js/ui`) stores a flag as another value, which is how Italic writes `fontStyle`; and `ToolPrefEnum.clearable` lets a toggle's lit segment be clicked off, removing the field. `PropertyControl`'s enum takes the matching `onClear`. The text tool's Script control in the options bar is now such an enum, replacing the app-drawn renderer it needed.

Fixed: in `SelectionPanel`, editing any field of an object leaf (the text style, the stroke) with several nodes selected wrote one object over every node, dropping each node's other fields, and reported every field as mixed. Fields are now read and written node by node; `PropertyRenderContext.update` is the new per-node write.
