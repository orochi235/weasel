---
'@weasel-js/ui': patch
---

A `Bar`'s keyless cells stay mounted, keeping focus and an open popover, when a conditional child ahead of them appears or leaves.

Two children sharing a key in one bar keep apart too: the later one is keyed by its place and warns.

<!-- entry: fix -->
