---
"@weasel-js/ui": patch
---

`PropertyPanel` takes a `motif`, as `PropertyGroup` and `Subpanel` do. Its own look is now the `sheet()` motif, and `<DefaultMotif panel={…}>` sets the motif every panel below draws in, beside the `group` and `subpanel` slots. A titled panel is now a `group` named by its title.

A frame's kind owns its colors and title type, and the motif only its geometry: a panel drawn as a `titlebar()` keeps the `--wzl-panel-*` slots, and a subpanel drawn as a `stereo()` keeps its own. The `panel` and `subpanel` stance rules are now keyed `.panel[data-motif]` and `.subpanel[data-motif]` to beat the frame rules on the same element.

`MotifFrame` takes an optional `title` (an untitled frame is not a named group), `twistyAt` to put the fold twisty at the end of the heading, and `attrs` for `data-*` attributes on its root.

Breaking: the `panelTitle`, `panelHeader` and `panelActions` classes are gone, replaced by the `sheet` motif's own.
