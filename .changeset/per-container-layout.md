---
'@weasel-js/guides': patch
---

Adds API: `perContainer(factory, { snap })`, for a layout strategy that keeps state. `factory` runs once for each container the layout is asked about, and the strategy it returns serves that container from then on, so it can close over a spatial index or its last arrangement. The result is an ordinary `LayoutStrategy`, declared on a container like any other, with a `forget(containerId)` to drop one container's state.

Decided on an agent's judgment: the factory form is a wrapper in `@weasel-js/guides` rather than a second shape of `ContainerNode.layout`, so the scene and `move` are unchanged. `snap` and `contains` are read with no container in hand, so every container shares the ones passed in the options. It keeps 256 containers' strategies by default (`max`) and rebuilds the one used longest ago when asked for it again.
