---
"@weasel-js/ui": patch
---

A bar's action button now says why it is disabled: given a reason by its action, it stays
focusable, keeps its tooltip, and carries the reason as its `aria-description`, as a panel's row
already did. Breaking for direct callers of `useLeafAction`: its `reason` field is renamed
`disabledReason`, the name `BarActionButton` reads, so its result spreads straight in.
