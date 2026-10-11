---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

labkit: a sidebar section can set `fill`, which gives it the pane's spare height and holds its body to that height, so the body can scroll one part of itself under the rest. This adds to `SidebarSection`.

forge: the CSS Vars section fills the aside. Its tabs and filter sit above the token list, which scrolls on its own; before, they were sticky inside the scrolling aside and the scrollbar ran past them.
