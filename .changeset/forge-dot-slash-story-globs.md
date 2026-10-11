---
'@weasel-js/forge': patch
---

`forge` and `forgeTest`: a `stories` glob written with a leading `./`, such as `./src/**/*.stories.tsx`, now matches everywhere. The workshop indexed such files at startup but never indexed one added later, and `forgeTest` matched no file at all, so its story project ran zero tests and passed.
