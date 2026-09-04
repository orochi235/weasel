---
'@weasel-js/labkit': patch
---

Bundle labkit's `.d.ts` from its dependencies' built declarations instead of re-deriving them from source.

The old pipeline aliased every weasel specifier to `src/`, so emitting labkit's types pulled the entire engine — around 1,900 files — into one TypeScript program. It needed just under 4GB of heap, which is above a CI runner's default, and had been failing the build. It now reads each dependency's `exports` `types` entry, the same tier ordering the JS build already relies on, and needs a little under 2GB. The emitted declarations are unchanged: same 749 exported symbols across the same 15 entry points, with identical type strings.

Building labkit alone in a tree whose other packages have never been built now fails with the tiers to run rather than an unresolved import.
