---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

labkit and forge import `@weasel-js/ui` through its component subpaths (`@weasel-js/ui/components/<Name>`) instead of the root barrel, wherever a subpath publishes the name. Nothing changes for a consumer: labkit re-exports the same names, and its `weasel-ui` subpath still re-exports the barrel. A few modules in each still import the barrel, for names no subpath publishes yet (`useStance`, `OverlayPortalProvider`, `useOverlayPortal`).
