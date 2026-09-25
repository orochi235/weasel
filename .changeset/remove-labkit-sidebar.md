---
'@weasel-js/labkit': patch
---

labkit's own `Sidebar` is removed. Nothing in labkit rendered it, and it shared
its name with weasel-ui's `Sidebar`, which `@weasel-js/labkit/weasel-ui`
re-exports — so the two imports named two different components. Use weasel-ui's
`Sidebar` with `SidebarPanel`. This breaks any caller importing `Sidebar` or
`SidebarProps` from `@weasel-js/labkit`.
