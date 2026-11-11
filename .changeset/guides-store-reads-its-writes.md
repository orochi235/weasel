---
"@weasel-js/guides": patch
---

Undo across several guide ops puts back the right guides: `useGuides`'s `getGuides` answers each change as soon as it is made.

`subscribe` hears the change then too, rather than once React renders it. A write inside a suspended transition is now in the list at once, where `getGuides` used to answer the committed list.

<!-- entry: rank=5 behavior fix -->
