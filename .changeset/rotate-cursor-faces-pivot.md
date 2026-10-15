---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

The rotate cursor now turns with the pointer, so the opening of its arc faces the selection's pivot from wherever the pointer is: over the rotation ring, and through the rotate drag, which used to show no rotate cursor at all. It used to be turned to match the target's own rotation.

Two new surfaces carry it. An `AffordanceRegion`'s `cursor` may be a function of the pointer's world point and the view, worked out on each hit and reported on `AffordanceRegionHit.cursor`; read the cursor there rather than off `region.cursor`, which may now be a function. An `OngoingHandle` may declare `cursor()`, read after every move and ahead of its action's `activeCursor`.
