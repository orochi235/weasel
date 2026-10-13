---
'@weasel-js/diagram': patch
---

The force layout takes `createSimulation` and its types from `@weasel-js/simulation`, where they live, and no longer through `@weasel-js/core/math`. `@weasel-js/simulation` is a new peer dependency of `@weasel-js/diagram`.
