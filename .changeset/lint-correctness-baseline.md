---
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Fix a hook-order defect in the Badge effects and several stale-closure bugs,
found by turning on a correctness lint baseline.

Six Badge effects (`Aqua`, `Bevel`, `Bevel2`, `Metal`, `Sheen`, `Woodgrain`)
called `useId` after an early return keyed on `variant`. Changing a `<Badge>`'s
variant to one those effects don't render, and back, remounted the component
and issued fresh ids — so the `<clipPath>` and gradient ids their `url(#…)`
references point at changed identity mid-life.

Also fixed: `Canvas.tsx`'s paint effect read a stale `helpersForLayers` through
its closure rather than the ref the file maintains, and `useDeviceProfile`
ignored a `targetScale` supplied by a provider.

`composeOrderedLayers` is now generic over the `LayersMap` it receives instead
of taking `any`; inference at existing call sites is unchanged.
