---
'@weasel-js/routing': patch
---

A canvas-less dispatcher, such as `usePageActions`, ignores keys and pastes typed in a dialog that hides the rest of the page. React Aria's modals hide the page this way, with `inert` or `aria-hidden` in place of `aria-modal`.

<!-- entry: fix -->
