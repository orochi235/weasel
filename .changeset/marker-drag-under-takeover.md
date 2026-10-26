---
'@weasel-js/core': patch
---

A view marker now drags under a `tools` takeover. The surface installs its marker-drag entry beside the takeover's tool set, as it already did its preset bindings, unless the takeover's ambient lists the entry itself. Before, a takeover turned marker dragging off until the consumer added `createViewMarkerContribution()` to its own ambient. `actions={null}` still turns it off.
