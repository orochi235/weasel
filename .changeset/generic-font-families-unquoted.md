---
"@weasel-js/font": patch
"@weasel-js/text": patch
"@weasel-js/core": patch
"@weasel-js/diagram": patch
---

Canvas text in a CSS generic family — `sans-serif`, `monospace`, `system-ui` and the rest — now renders in that family. The dynamic glyph atlas quoted every family, and a quoted `"sans-serif"` names a font nobody has, so the browser drew it in its default serif; every `DiagramView` on default options was affected.

Every font string the kit builds now goes through one helper, `cssFamilyName`, exported from `@weasel-js/font` and `@weasel-js/core`: a generic keyword stays bare, a single named family is quoted, and a family list passes through as written. `fontString` and the DOM face's fallback therefore now quote a named family (`"Helvetica"`), which CSS reads the same.
