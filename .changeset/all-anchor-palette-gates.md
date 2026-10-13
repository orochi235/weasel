---
'@weasel-js/theme': patch
---

Fixes: `generate` reported a palette whose every swatch is an anchor as `feasible` without measuring any gate. It measures the anchors against the hue floor, contrast, surface distance, and pairwise distance, as it does when at least one swatch is free.

Breaking: a categorical ramp with every step pinned can now raise `infeasible-ramp` where it raised nothing before.
