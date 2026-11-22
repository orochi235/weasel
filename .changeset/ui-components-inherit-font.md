---
'@weasel-js/ui': patch
---

ui's components take their font family from their container, so a panel, field, button or popover inside a narrow-font page stays in it.

Code, headings and stance titles still use their own faces through `--wzl-font-mono`, `--wzl-font-display` and the `*-title-font` tokens; set one of those to change them. A callout's, dialog's or sidebar panel's title inherits too, unless a stance's theme gives it a face. Import `@weasel-js/theme/fonts.css`, or set a family on your own root, to keep the kit's face where nothing else chooses one.

<!-- entry: rank=10 fix visual behavior -->
