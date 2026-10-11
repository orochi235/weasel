---
'@weasel-js/svg': patch
---

SVG import converts `em` and `ex` by the element's computed font size wherever a length is read: geometry attributes, `stroke-width`, `stroke-dasharray`, `letter-spacing`, and the root `width` and `height`. `<circle r="2em">` now imports with r = 32, or 20 under `<g font-size="10">`, where it used to import with r = 2 and a warning. A `font-size` in `em`, `ex`, or a percentage resolves against the parent's size, so a percentage on `<text>` no longer falls back to 16px with a warning. `ex` is taken as half an em.
