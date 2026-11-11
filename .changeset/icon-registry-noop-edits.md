---
"@weasel-js/icons": patch
---

The icon registry no longer advances its version or notifies subscribers when `add` is given an empty list, or when `provideVariants` names only variants it already knows: `entries()` keeps its array and a `useSyncExternalStore` reader does not re-render.
