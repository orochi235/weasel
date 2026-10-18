---
'@weasel-js/diagram': patch
'@weasel-js/core': patch
---

A diagram's ports now stay off a layer the view hides with `layerVisibility` or leaves out of `layerOrder`, not only off a layer the scene itself hides. They are not drawn there, a press there does not grab one, and a connect drag started in that view does not land on one. To make that possible, `ChromeState` carries `layerIsPainted(layerId)` for the view it was built for, the same answer `ViewApi.layerIsPainted` gives, so any affordance can turn its chrome away from a layer that view does not paint. `sceneParticipants` now reports each participant's `layer`, and `offersPorts` takes the view's gate as a second argument. Additive.
