---
"@weasel-js/guides": patch
---

`useGuides`'s `getGuides` answers each change as soon as it is made, and `subscribe` hears it then, rather than once React renders it. A history step running several guide ops, such as a jump across steps, read the list from before the first of them, so undo put back the wrong guides. A write inside a suspended transition is now in the list at once.
