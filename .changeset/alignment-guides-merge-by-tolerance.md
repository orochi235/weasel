---
"@weasel-js/guides": patch
---

`deriveAlignmentGuides` merges edges and centers that lie within 0.001 of each other into one guide wherever they fall, so two boxes whose left edges are at 10.0004 and 10.0006 share a guide spanning both. It used to round offsets to a 0.001 grid, which kept such a pair apart when they sat on either side of a rounding boundary.
