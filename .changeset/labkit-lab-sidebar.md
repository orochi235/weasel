---
'@weasel-js/labkit': patch
---

A lab has a `sidebar` region: `labChrome` contributions with `region: 'sidebar'` render as foldable sections in a resizable column left of the tool rail. Fold state and width persist lab-wide. A lab with no sidebar contributions renders exactly as before. `SidebarRegion` is now generic over `SidebarSlotContext`, so a chrome without tear-out can host it.
