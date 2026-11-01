---
'@weasel-js/ui': patch
---

Dialogs, popovers, and tooltips portal where `OverlayPortalProvider` says again, so inside a light-themed root they draw in its theme instead of the default dark one. The build had inlined its own copy of react-aria's `PortalProvider`, which the overlays from `react-aria-components` never read; it now leaves every dependency the package declares, `react-aria` and `prism-react-renderer` included, for the consumer to install once.
