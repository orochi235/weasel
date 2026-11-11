---
"@weasel-js/core": patch
---

`hitTestArea` and `rectRegion` take a rect with a negative width or height as the same rect named from its other corner. Before, its bounds stayed inverted while its outline did not, so a marquee given that way took only some of the nodes it covers.
