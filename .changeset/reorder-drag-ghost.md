---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A drag from `useReorderDragList` now has a ghost. The hook's state carries
`ghost` — the dragged ids and a client-space box that keeps the grabbed point
under the pointer — and `ItemList`'s `ghost` prop draws those rows there,
portaled to the list's nearest themed host so no panel clips them.
