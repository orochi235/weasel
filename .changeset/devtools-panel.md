---
"@weasel-js/devtools": patch
"@weasel-js/core": patch
---

Add `@weasel-js/devtools`, a panel that reads and steers every `<SceneCanvas>` on a page over the
devtools hook. `DevtoolsPanel({ transport })` shows a picker for the page's canvases and four tabs:
Scene (the node tree, loaded a level at a time, and a picked node's parent, pose and data; hovering a
row outlines the node on the canvas), State (selection, view, active tool, debug overlay flags and
probes, with the tool and the flags settable), Dispatch (the dispatch trace, newest first, under what
a press at the pointer would do, filterable by handled and unhandled, each decision opening to its
path and its fallthrough diagram; coord records behind a toggle), and Frame (the last paint's cost
while the `fps` overlay is on). `createInPagePanelTransport()` connects it to the page's own hook.
`connectDevtools` and `followTrace` are the protocol client underneath, without React. Import
`@weasel-js/devtools/style.css` beside it.

Core exports `DEBUG_FEATURES`, every debug overlay feature a `DebugConfig` flag turns on;
`DebugFeature` is now derived from it.
