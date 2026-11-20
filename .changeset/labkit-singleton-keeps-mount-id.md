---
'@weasel-js/labkit': patch
---

`<SingletonExperimentProvider>` keeps the trial it mounted with when its `id` changes, and warns in development that the change is ignored.

<!-- entry: fix -->
