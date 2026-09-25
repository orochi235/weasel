---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

`<Lab theme>` sets the theme the lab's chrome resolves against, defaulting to
`interstellarTheme`. forge's shell config takes `labTheme(globals)`, the theme
the workshop's own chrome takes at the lab's current globals, so a global can
restyle the workshop as well as the stories. A global declared `under` another
shows in a popover beside that one's select rather than in the toolbar itself.
