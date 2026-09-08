---
'@weasel-js/labkit': patch
---

**Breaking:** `@weasel-js/labkit` no longer ships its own copy of
`@weasel-js/core`. Install core alongside it, at the matching version:

```bash
npm i @weasel-js/labkit @weasel-js/core
```

Core is now an exact `peerDependency`, and labkit's `dist` imports it rather
than inlining it. npm reports a version mismatch at install time instead of
nesting a second copy.

The second copy was the problem. Core keeps its content handlers, paint kinds,
shape painters, markers and program registry in module globals, so two copies
are two sets of registries: an app using labkit *and* core registered a face or
a paint kind into one and read the other, and got a blank canvas with no
diagnostic beyond `layoutRuns`' duplication warning. The same failure
`@weasel-js/svg` and `@weasel-js/font` were peered to close, reached by another
route.

labkit's other weasel siblings — `ui`, `loupe`, `svg`, `theme` — are still
bundled; only core changes. Removing it also drops what it pulled in behind it,
taking labkit's JS from 1.99 MB to 0.97 MB.
