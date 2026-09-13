---
'@weasel-js/labkit': patch
---

labkit re-exports `ToggleBar` and `Button`, with their prop types, from its
package root alongside the property rows, so chrome built on labkit needs no
direct `@weasel-js/ui` dependency to use them.
