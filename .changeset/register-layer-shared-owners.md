---
'@weasel-js/core': patch
---

A layer registered twice through `registerLayer` stays until both registrations are released.

Registering a layer again also moves it to the top of hit order.

<!-- entry: fix -->
