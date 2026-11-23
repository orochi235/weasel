---
'@weasel-js/core': patch
---

`useSceneStream` keeps streaming after React reruns its effects, as StrictMode and a reshown `<Activity>` do. A render React throws away no longer leaves an edit pass on the scene.

<!-- entry: fix -->
