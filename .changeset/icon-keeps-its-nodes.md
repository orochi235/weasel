---
'@weasel-js/ui': patch
---

Keep an icon's drawn nodes across a re-render, so an icon button's click lands.

`Icon` passed React a new `dangerouslySetInnerHTML` object on every render, and
React 19 rewrites `innerHTML` whenever that object changes. A re-render during a
press — labkit's lab toolbar re-renders on pointerdown — replaced the
`<path>` the pointer went down on, and the browser synthesizes no `click` when
that node is gone. The Export panel could not be opened with a mouse.
