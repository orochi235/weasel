---
'@weasel-js/geom': patch
---

polygon-clipping is an optional peer of the ./booleans subpath, not a dependency

geom's description promises a "dependency-free core; polygon booleans in the
./booleans subpath", and `booleans/index.ts` says the split exists "so the core
stays `deps: {}`". The subpath split delivered that for the *import* graph only:
`polygon-clipping` sat in `dependencies`, so every consumer installed it and its
own two transitive deps — roughly half a megabyte — whether or not they ever
imported the subpath that uses it.

It reaches consumers through `@weasel-js/text`, which needs one type from geom
(`Rect`, in `measure/lineBoxes.ts`) and none of its runtime. Nothing on that
path can bundle the clipper, so it was pure install weight.

**Anyone importing `@weasel-js/geom/booleans` must now install
`polygon-clipping` themselves.** It is declared as an optional peer, so npm no
longer installs it automatically and the subpath is the only thing that breaks
without it. `@weasel-js/core` declares its own copy and is unaffected.
