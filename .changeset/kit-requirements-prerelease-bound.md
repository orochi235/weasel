---
'@weasel-js/core': patch
---

A contribution's `requires` range no longer accepts a prerelease of the version it stops at. `satisfiesRange('2.0.0-rc.1', '^1.4.0')` returned `true`, because the prerelease orders below `2.0.0`, so a contribution written against 1.x passed its check on a release candidate of the breaking major. An exclusive upper bound (`<2`, or the one implied by `^`, `~`, and a partial version) now also excludes that version's prereleases. A space after an operator (`>= 1.2.3`) is read as npm reads it instead of reporting `invalid-range`.
