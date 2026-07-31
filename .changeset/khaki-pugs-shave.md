---
"@weasel-js/font": minor
"@weasel-js/ui": minor
---

`@weasel-js/font` gains `listCanvasFonts()`, the enumeration companion to
`isCanvasFont`. Families served by the dynamic canvas-SDF tier could only be
queried one at a time, so a font picker had no way to offer them without
hard-coding a list beside the `registerCanvasFont` calls. Reports service
rather than membership, matching `isCanvasFont`: an auto-enrolled family
appears only while the `'canvas'` fallback policy is in force.

`@weasel-js/ui`'s `Select` marks its portalled popover with
`data-weasel-overlay`. A consumer asking "did focus leave my component?" via
`closest()` gets the wrong answer for portalled DOM — a text editor whose
font menu is a `Select` ended its edit session the moment the menu was
clicked, discarding the style patch that click was making.
