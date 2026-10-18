---
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

A blend can lay its steps along a spine and space them by distance. A blend node whose `dependsOn` names a third path, `[from, to, spine]`, places each step on the spine as far along it as the step is between its sources, and paints nothing while that spine is gone; `orient` also turns each step by how far the spine's heading differs from the straight run between the sources. `spaceBy: 'distance'` puts a step every `distance` from the first source, along the spine where there is one, as many as fit short of the second; `spaceBy: 'count'`, the default, keeps `steps` evenly spread. Blend made with three shapes selected takes the third as its spine, and `blend` and `editPathEffect` take `spaceBy`, `distance`, and `orient` as params.
